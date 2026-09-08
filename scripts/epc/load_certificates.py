"""Load a non-domestic EPC register into public.epc_certificates.

Dry run unless --apply, like load_to_db.py.

    python3 load_certificates.py --source epc_ew                 # counts only
    python3 load_certificates.py --source epc_ew --apply         # writes
    python3 load_certificates.py --source epc_scotland --apply

A load REPLACES its source wholesale. The register's delta endpoint reports removals
and UPRN changes but not new certificates, so incremental refresh needs a second
mechanism to be correct at all; a quarterly full replace is one moving part instead of
four. A load that fails part-way leaves its source short — hence the run status, which
the admin health page reads.

No address text is written. matchlib's extractors run here, once, and only their output
is stored; see the migration header (20260909000000) for why, and note that the four
extractors disagree about what may be discarded, so no single normalised string can
stand in for them.

Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and open_uprn.zip in this
directory (OS Open UPRN, OGL — see README).
"""
import argparse, csv, glob, io, json, os, sys, time, urllib.error, urllib.request, zipfile
from matchlib import norm_tokens, units, numbers, house_numbers

csv.field_size_limit(10**7)

AP = argparse.ArgumentParser()
AP.add_argument("--source", required=True, choices=["epc_ew", "epc_scotland"])
AP.add_argument("--path", help="register file or directory (default: the laptop paths)")
AP.add_argument("--apply", action="store_true")
AP.add_argument("--batch", type=int, default=1000)
A = AP.parse_args()

BASE = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
KEY  = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
H    = {"apikey": KEY, "Authorization": "Bearer " + KEY, "Content-Type": "application/json"}

DEFAULT_PATH = {
    "epc_ew":       os.path.expanduser("~/Downloads/non-domestic-csv"),
    "epc_scotland": os.path.expanduser("~/Downloads/scot_hist/AltHistoricExtract2013to2026ND.csv"),
}

# Column names differ between the registers; everything downstream uses these keys.
FIELDS = {
    "epc_ew": dict(cn="certificate_number", pc="postcode", pt="property_type",
                   fa="floor_area", date="lodgement_date", uprn="uprn",
                   addr=("address1", "address2", "address3")),
    "epc_scotland": dict(cn="REPORT_REFERENCE_NUMBER", pc="POSTCODE", pt="PROPERTY_TYPE",
                         fa="FLOOR_AREA", date="LODGEMENT_DATE", uprn="OSG_REFERENCE_NUMBER",
                         addr=("ADDRESS1", "ADDRESS2")),
}[A.source]


# Must stay in step with index_all_brands.py:cls(). Duplicated rather than imported
# because that module reads files at import time; if either copy changes, both must.
def cls(pt):
    p = (pt or "").lower()
    if "retail" in p: return "retail"
    if any(k in p for k in ("restaurant", "cafe", "takeaway", "drinking establishment")): return "food"
    if "storage" in p or "distribution" in p: return "warehouse"
    if "industrial" in p: return "industrial"
    if "office" in p or "workshop" in p: return "office"
    if "hotel" in p: return "hotel"
    if any(k in p for k in ("assembly", "leisure", "night club", "theatre")): return "leisure"
    if any(k in p for k in ("institution", "education", "health", "hospital")): return "institution"
    return "other"


def rows():
    """Every certificate in the register, as raw dicts."""
    path = A.path or DEFAULT_PATH[A.source]
    files = sorted(glob.glob(os.path.join(path, "certificates-*.csv"))) if os.path.isdir(path) else [path]
    if not files:
        sys.exit(f"no register files at {path}")
    enc = "utf-8-sig" if A.source == "epc_scotland" else "utf-8"
    for f in files:
        with open(f, newline="", encoding=enc, errors="replace") as fh:
            yield from csv.DictReader(fh)


def fnum(v):
    try:
        f = float(v)
        return f if f > 0 else None
    except (TypeError, ValueError):
        return None


def clean_uprn(v):
    v = (v or "").strip()
    return v if v.isdigit() else ""


def req(method, path, body=None, headers=None):
    r = urllib.request.Request(BASE + path, method=method,
                               data=json.dumps(body).encode() if body is not None else None,
                               headers={**H, **(headers or {})})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(r, timeout=180) as resp:
                raw = resp.read()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            detail = e.read().decode()[:400]
            if e.code < 500 or attempt == 4:
                sys.exit(f"\n  {method} {path} failed {e.code}: {detail}")
            print(f"    {e.code}, retrying ({attempt+1}/4)", flush=True)
        except Exception as e:
            if attempt == 4:
                sys.exit(f"\n  {method} {path} failed: {e}")
            print(f"    {type(e).__name__}, retrying ({attempt+1}/4)", flush=True)
        time.sleep(2 ** attempt)


# --- pass 1: which UPRNs do we need? -----------------------------------------
print(f"[{A.source}] pass 1: collecting UPRNs", flush=True)
need, total = set(), 0
for r in rows():
    total += 1
    u = clean_uprn(r.get(FIELDS["uprn"]))
    if u and fnum(r.get(FIELDS["fa"])):
        need.add(u)
print(f"  {total:,} certificates, {len(need):,} distinct UPRNs to resolve", flush=True)

coords = {}
if need:
    if not os.path.exists("open_uprn.zip"):
        sys.exit("open_uprn.zip not found — see README (OS Open UPRN, OGL)")
    print("  resolving against OS Open UPRN", flush=True)
    with zipfile.ZipFile("open_uprn.zip") as z:
        name = [x for x in z.namelist() if x.lower().endswith(".csv")][0]
        with z.open(name) as fh:
            for r in csv.DictReader(io.TextIOWrapper(fh, encoding="utf-8-sig", errors="replace")):
                k = (r["UPRN"] or "").strip()
                if k in need:
                    try:
                        coords[k] = (float(r["LATITUDE"]), float(r["LONGITUDE"]))
                    except (ValueError, TypeError):
                        pass
    print(f"  resolved {len(coords):,}/{len(need):,} "
          f"({100*len(coords)/max(1,len(need)):.1f}%)", flush=True)

# --- pass 2: extract features and load ---------------------------------------
run_id = None
if A.apply:
    snapshot = os.path.basename(A.path or DEFAULT_PATH[A.source])
    run = req("POST", "/rest/v1/epc_load_runs",
              [{"source": A.source, "snapshot_ref": snapshot, "status": "running"}],
              {"Prefer": "return=representation"})
    run_id = run[0]["id"]
    print(f"\n  load run {run_id}", flush=True)
    # Replace the source. Rows first, then the runs they referenced are left in place
    # as an audit trail.
    print("  clearing previous rows for this source", flush=True)
    cleared = 0
    while True:
        n = req("POST", "/rest/v1/rpc/epc_delete_source",
                {"p_source": A.source, "p_limit": 50000})
        if not n:
            break
        cleared += n
        print(f"    deleted {cleared:,}", flush=True)

print(f"\n[{A.source}] pass 2: extracting and loading", flush=True)
batch, loaded, skipped_area, skipped_cn, skipped_pc, with_geom, seen = [], 0, 0, 0, 0, 0, set()
# Both of these are recorded on the load run at the end: deriving them later costs a
# full scan of the loaded table, and neither can change until the next load.
newest = None


def flush():
    global batch, loaded
    if not batch:
        return
    if A.apply:
        req("POST", "/rest/v1/epc_certificates", batch, {"Prefer": "return=minimal"})
    loaded += len(batch)
    batch = []
    if loaded % 50000 < A.batch:
        print(f"    {loaded:,}/{total:,}", flush=True)


for r in rows():
    cn = (r.get(FIELDS["cn"]) or "").strip()
    if not cn:
        skipped_cn += 1
        continue
    area = fnum(r.get(FIELDS["fa"]))
    if not area:
        skipped_area += 1
        continue
    pc = (r.get(FIELDS["pc"]) or "").upper().replace(" ", "")
    if not pc:
        skipped_pc += 1
        continue
    # A certificate is lodged once, so it should appear in exactly one yearly file and
    # this should never fire. It exists because the PK would otherwise reject the whole
    # 1,000-row batch on a single duplicate. Files are read in ascending year order, so
    # if a repeat does occur the earliest occurrence is the one kept.
    if cn in seen:
        continue
    seen.add(cn)

    addr = ", ".join(x for x in (r.get(k) for k in FIELDS["addr"]) if x)
    u = clean_uprn(r.get(FIELDS["uprn"]))
    xy = coords.get(u)
    if xy:
        with_geom += 1
    pt = r.get(FIELDS["pt"])
    date = (r.get(FIELDS["date"]) or "")[:10] or None
    if date and (newest is None or date > newest):
        newest = date  # ISO dates, so string order is date order

    batch.append({
        "source": A.source,
        "certificate_number": cn,
        "load_run_id": run_id,
        "postcode_norm": pc,
        "tokens": norm_tokens(addr),
        "units": sorted(units(addr)),
        "numbers": sorted(numbers(addr)),
        "house_numbers": sorted(house_numbers(addr)),
        "property_type": pt,
        "property_class": cls(pt),
        "floor_area_m2": area,
        "lodgement_date": date,
        "uprn": int(u) if u else None,
        "geom": f"SRID=4326;POINT({xy[1]} {xy[0]})" if xy else None,
    })
    if len(batch) >= A.batch:
        flush()
flush()

print(f"\n  loadable          {loaded:,}")
print(f"  with coordinates  {with_geom:,} ({100*with_geom/max(1,loaded):.1f}%)")
print(f"  newest lodgement  {newest or 'unknown'}")
print(f"  skipped: no floor area {skipped_area:,}, no certificate number {skipped_cn:,}, "
      f"no postcode {skipped_pc:,}")

if not A.apply:
    print("\nDRY RUN — nothing written. Re-run with --apply.")
    sys.exit(0)

from datetime import datetime, timezone
req("PATCH", f"/rest/v1/epc_load_runs?id=eq.{run_id}",
    {"status": "complete", "row_count": loaded,
     "with_geom": with_geom, "newest_certificate": newest,
     "finished_at": datetime.now(timezone.utc).isoformat()},
    {"Prefer": "return=minimal"})
print(f"\n  run {run_id} complete")
