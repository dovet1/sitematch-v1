"""Load matched floor areas and brand profiles. Run after the migration is applied.

Idempotent: upserts on the primary key, so a rerun replaces rather than duplicates.
"""
import csv, json, os, sys, urllib.request, urllib.error

BASE, KEY = os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"]
DRY = "--apply" not in sys.argv

def post(table, rows, on_conflict=None):
    # rows already cleared for tables loaded by delete-then-insert, so no conflict
    # target is needed there; a stale one fails with 42P10.
    q = f"?on_conflict={on_conflict}" if on_conflict else ""
    req = urllib.request.Request(
        f"{BASE}/rest/v1/{table}{q}",
        data=json.dumps(rows).encode(),
        headers={"apikey": KEY, "Authorization": "Bearer " + KEY,
                 "Content-Type": "application/json",
                 "Prefer": "resolution=merge-duplicates,return=minimal"},
        method="POST")
    try:
        with urllib.request.urlopen(req) as r: return r.status
    except urllib.error.HTTPError as e:
        print("  ERROR", e.code, e.read().decode()[:400]); raise

def num(v):
    if v in ("", None): return None
    try: return float(v)
    except ValueError: return None
def i(v):
    if v in ("", None): return None
    try: return int(float(v))
    except ValueError: return None
def txt(v): return v if v not in ("", None) else None

# ---- store_floor_areas ------------------------------------------------------
rows = []
for r in csv.DictReader(open("epc_all_brands.csv")):
    rows.append({
        "store_id": r["store_uuid"],
        "floor_area_m2": num(r["floor_area_m2"]),
        "source": txt(r["source"]),
        "certificate_number": txt(r["certificate_number"]),
        "certificate_date": txt(r["certificate_date"]),
        "certificate_address": txt(r["certificate_address"]),
        "property_type": txt(r["property_type"]),
        "property_class": txt(r["property_class"]),
        "uprn": i(r["uprn"]),
        "confidence": r["confidence"],
        "match_method": r["match_method"],
        "address_corroboration": txt(r["address_corroboration"]),
        "brand_on_certificate": (None if r["brand_on_certificate"] in ("", None)
                                 else r["brand_on_certificate"] == "yes"),
        "foreign_operator": txt(r["foreign_operator"]),
        "spatial_distance_m": num(r["spatial_distance_m"]),
        "size_plausibility": txt(r["size_plausibility"]),
        "candidate_count": i(r["candidate_count"]),
        "certs_at_address": i(r["certs_at_address"]),
        "matcher_version": r["matcher_version"],
    })

# ---- brand_floor_area_profiles ---------------------------------------------
profs = []
for p in csv.DictReader(open("brand_profiles.csv")):
    profs.append({
        "brand_id": p["brand_id"],
        "fascia_id": txt(p["fascia_id"]),
        "p25_m2": num(p["p25_m2"]), "median_m2": num(p["median_m2"]),
        "p75_m2": num(p["p75_m2"]), "min_m2": num(p["min_m2"]), "max_m2": num(p["max_m2"]),
        "sample_count": i(p["sample_count"]),
        "coefficient_of_variation": num(p["coefficient_of_variation"]),
        "matcher_version": "epc-2026.09.05-allbrands",
    })

print(f"store_floor_areas: {len(rows):,} rows  "
      f"({sum(1 for r in rows if r['confidence']=='high'):,} high)")
print(f"brand_floor_area_profiles: {len(profs):,} rows")
if DRY:
    print("\nDRY RUN — nothing written. Re-run with --apply once the migration is in.")
    sys.exit(0)

for n in range(0, len(rows), 500):
    post("store_floor_areas", rows[n:n+500], "store_id")
    print(f"  store_floor_areas {min(n+500,len(rows)):,}/{len(rows):,}", flush=True)
# Profiles are replaced wholesale rather than upserted: the conflict target would
# be fascia_key, a generated column that cannot appear in the payload, and PostgREST
# may refuse it. 330 rows makes delete-then-insert the simpler correct option.
req = urllib.request.Request(
    f"{BASE}/rest/v1/brand_floor_area_profiles?brand_id=not.is.null",
    headers={"apikey": KEY, "Authorization": "Bearer " + KEY, "Prefer": "return=minimal"},
    method="DELETE")
try:
    with urllib.request.urlopen(req) as r: print(f"  cleared existing profiles ({r.status})")
except urllib.error.HTTPError as e:
    print("  ERROR clearing profiles:", e.code, e.read().decode()[:300]); raise
for n in range(0, len(profs), 500):
    post("brand_floor_area_profiles", profs[n:n+500])
print("done")
