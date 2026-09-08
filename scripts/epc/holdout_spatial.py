"""Is spatial matching justified for stores whose coordinates were validated by
Google Places rather than labelled `pqi = 'Rooftop'`?

The matcher only accepts a spatial match for Rooftop stores (matchall.py:18,116),
because the 25 m radius was calibrated on nothing else. But 24,850 of 43,070 stores
carry no pqi at all and were instead confirmed against Google Places to within 10 m
by the import route, which is a tighter tolerance from an independent source.

Method — the holdout from the assessment's section 3.4, which needs no new data:
take stores where TEXT matching already gives a trusted answer, run spatial on them
blind, and measure how often geometry picks the same certificate. matchall skips
spatial entirely for these stores (`strong` short-circuits it), so the two signals
are genuinely independent here. Reported separately for Rooftop and Google-validated
stores: if the two agree at similar rates, the gate can be widened.

Read-only. Touches no table.
"""
import csv, json, math, os, io, sys, zipfile, urllib.request
from collections import defaultdict
from matchlib import norm_tokens

NEAR, MARGIN = 25.0, 25.0
BASE, KEY = os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"]

def page(path, cols, extra=""):
    out, off = [], 0
    while True:
        url = f"{BASE}{path}?select={cols}&order=store_id.asc&limit=1000&offset={off}{extra}" \
              if "store_floor_areas" in path else \
              f"{BASE}{path}?select={cols}&order=id.asc&limit=1000&offset={off}{extra}"
        r = urllib.request.Request(url, headers={"apikey": KEY, "Authorization": "Bearer " + KEY})
        pg = json.load(urllib.request.urlopen(r))
        out += pg
        if len(pg) < 1000: break
        off += 1000
    return out

def hav(a, b, c, d):
    R = 6371000.0; p1, p2 = math.radians(a), math.radians(c)
    dp, dl = math.radians(c-a), math.radians(d-b)
    x = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*R*math.asin(math.sqrt(x))

def fnum(v):
    try:
        f = float(v); return f if f > 0 else None
    except (TypeError, ValueError): return None

print("stores...", flush=True)
stores = {s["id"]: s for s in csv.DictReader(open("all_stores.csv"))}
gp = {s["id"]: s["google_place_id"] for s in page("/rest/v1/stores", "id,google_place_id")}

print("committed matches...", flush=True)
sfa = {r["store_id"]: r for r in page(
    "/rest/v1/store_floor_areas",
    "store_id,certificate_number,match_method,address_corroboration,"
    "brand_on_certificate,confidence,source")}

# The trusted-text holdout set: text evidence matchall treats as `strong`, so it
# never consulted geometry for these. England & Wales only — the Scottish extract
# is not on this machine.
trusted = {sid: r for sid, r in sfa.items()
           if r["match_method"] in ("address", "brand")
           and r["source"] == "epc_ew"
           and (r["brand_on_certificate"] is True
                or r["address_corroboration"] in ("unit", "number"))}
print(f"  {len(trusted):,} trusted text matches (E&W)", flush=True)

want = {s["postcode"].upper().replace(" ", "") for s in stores.values() if s["postcode"].strip()}

def cls(pt):
    p = (pt or "").lower()
    if "retail" in p: return "retail"
    if any(k in p for k in ("restaurant","cafe","takeaway","drinking establishment")): return "food"
    if "storage" in p or "distribution" in p: return "warehouse"
    if "industrial" in p: return "industrial"
    if "office" in p or "workshop" in p: return "office"
    if "hotel" in p: return "hotel"
    if any(k in p for k in ("assembly","leisure","night club","theatre")): return "leisure"
    if any(k in p for k in ("institution","education","health","hospital")): return "institution"
    return "other"

print("scanning E&W certificates...", flush=True)
import glob, pickle
if os.path.exists("holdout_cache.pkl"):
    by_pc, coords = pickle.load(open("holdout_cache.pkl","rb"))
    print(f"  cached: {sum(len(v) for v in by_pc.values()):,} certs, {len(coords):,} coords", flush=True)
else:
  by_pc, kept = defaultdict(list), 0
  for path in sorted(glob.glob("/Users/tomdove/Downloads/non-domestic-csv/certificates-*.csv")):
    for r in csv.DictReader(open(path, newline="", encoding="utf-8", errors="replace")):
        pc = (r.get("postcode") or "").upper().replace(" ", "")
        if pc not in want: continue
        a = ", ".join(x for x in (r.get("address1"), r.get("address2"), r.get("address3")) if x)
        by_pc[pc].append({"cn": r["certificate_number"], "addr": a,
                          "cls": cls(r.get("property_type")), "fa": r.get("floor_area"),
                          "uprn": (r.get("uprn") or "").strip()})
        kept += 1
  print(f"  kept {kept:,} certificates at {len(by_pc):,} postcodes", flush=True)
  need = {c["uprn"] for cs in by_pc.values() for c in cs if c["uprn"]}
  print(f"resolving {len(need):,} UPRNs from OS Open UPRN...", flush=True)
  coords = {}
  with zipfile.ZipFile("open_uprn.zip") as z:
    n = [x for x in z.namelist() if x.lower().endswith(".csv")][0]
    with z.open(n) as fh:
        for r in csv.DictReader(io.TextIOWrapper(fh, encoding="utf-8-sig", errors="replace")):
            k = (r["UPRN"] or "").strip()
            if k in need:
                try: coords[k] = (float(r["LATITUDE"]), float(r["LONGITUDE"]))
                except (ValueError, TypeError): pass
  print(f"  resolved {len(coords):,}/{len(need):,}", flush=True)
  pickle.dump((dict(by_pc), coords), open("holdout_cache.pkl","wb"), protocol=4)

# Aliases, only to reproduce matchall's candidate filter (drop a certificate naming
# a rival operator unless it also names ours).
cfg = json.load(open("brand_config.json"))
aliases = {b: [tuple(p.split("|")) for p in ps] for b, ps in cfg["aliases"].items()}
family  = {b: set(v) for b, v in cfg["family"].items()}
owners  = defaultdict(set)
for b, ps in aliases.items():
    for p in ps: owners[p].add(b)
by_first = defaultdict(list)
for p in owners: by_first[p[0]].append(p)

def phrases_on(ctoks):
    found = set()
    for i, t in enumerate(ctoks):
        for p in by_first.get(t, ()):
            if ctoks[i:i+len(p)] == list(p): found.add(p)
    return found

# Every property class is admitted here rather than the per-brand set matchall
# learned in pass 1. That is deliberately conservative: more candidates means more
# chances for the margin rule to decline or for geometry to pick differently, so it
# makes the test harder to pass, not easier.
# Build the candidate distance list once per store, then sweep thresholds over it.
cands = {}
for sid, r in trusted.items():
    s_ = stores.get(sid)
    if not s_: continue
    try: la, lo = float(s_["lat"]), float(s_["lon"])
    except (TypeError, ValueError): continue
    bid = s_["brand_id"]; fam = family.get(bid, {bid}); mine = set(aliases.get(bid, []))
    out = []
    for c in by_pc.get(s_["postcode"].upper().replace(" ", ""), []):
        if not fnum(c["fa"]) or not (c["cn"] or "").strip(): continue
        xy = coords.get(c["uprn"])
        if not xy: continue
        present = phrases_on(norm_tokens(c["addr"]))
        named = bool(present & mine)
        if any((owners[p] - fam) for p in present - mine) and not named: continue
        out.append((hav(la, lo, xy[0], xy[1]), c["cn"]))
    out.sort(key=lambda t: t[0])
    pqi = (s_.get("pqi") or "")
    grp = "Rooftop" if pqi == "Rooftop" else ("Google-validated" if gp.get(sid) else "neither")
    cands[sid] = (grp, out, r["certificate_number"])

def evaluate(near, margin):
    res = defaultdict(lambda: {"elig": 0, "fired": 0, "agreed": 0})
    for grp, out, truth in cands.values():
        res[grp]["elig"] += 1
        if not out: continue
        d, cn = out[0]
        marg = (out[1][0] - d) if len(out) > 1 else float("inf")
        if d <= near and marg >= margin:
            res[grp]["fired"] += 1
            if cn == truth: res[grp]["agreed"] += 1
    return res

print("\n" + "="*78)
print("Blind spatial vs trusted text match — threshold sweep")
print("="*78)
print(f"{'near':>5}{'margin':>8}   {'Rooftop: fired / agree':<28}{'Google-validated: fired / agree'}")
for near, margin in [(25,25),(20,25),(15,25),(10,25),(15,35),(10,35),(25,50),(15,50)]:
    r = evaluate(near, margin)
    cells = []
    for g in ("Rooftop", "Google-validated"):
        v = r[g]
        pc = f"{100*v['agreed']/v['fired']:.1f}%" if v["fired"] else "n/a"
        cells.append(f"{v['fired']:>5,} ({100*v['fired']/v['elig']:>2.0f}%)  {pc:>6}")
    print(f"{near:>5}{margin:>8}   {cells[0]:<28}{cells[1]}")
print("="*78)
for g in ("Rooftop","Google-validated","neither"):
    n = sum(1 for grp,_,_ in cands.values() if grp==g)
    if n: print(f"  holdout {g}: {n:,}")
