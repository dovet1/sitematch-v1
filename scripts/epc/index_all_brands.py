"""Index both registers against all 30,586 store postcodes, then resolve UPRNs."""
import csv, glob, pickle, zipfile, io
from collections import defaultdict
csv.field_size_limit(10**7)

stores = list(csv.DictReader(open("all_stores.csv")))
want = {s["postcode"].upper().replace(" ", "") for s in stores if s["postcode"].strip()}
print(f"{len(stores):,} stores, {len(want):,} postcodes", flush=True)

def cls(pt):
    p = (pt or "").lower()
    if "retail" in p: return "retail"
    if "restaurant" in p or "cafe" in p or "takeaway" in p or "drinking establishment" in p: return "food"
    if "storage" in p or "distribution" in p: return "warehouse"
    if "industrial" in p: return "industrial"
    if "office" in p or "workshop" in p: return "office"
    if "hotel" in p: return "hotel"
    if "assembly" in p or "leisure" in p or "night club" in p or "theatre" in p: return "leisure"
    if "institution" in p or "education" in p or "health" in p or "hospital" in p: return "institution"
    return "other"

by_pc = defaultdict(list)
kept = tot = 0
for path in sorted(glob.glob("/Users/tomdove/Downloads/non-domestic-csv/certificates-*.csv")):
    for r in csv.DictReader(open(path, newline="", encoding="utf-8", errors="replace")):
        tot += 1
        pc = (r.get("postcode") or "").upper().replace(" ", "")
        if pc not in want: continue
        a = ", ".join(x for x in (r.get("address1"), r.get("address2"), r.get("address3")) if x) \
            or (r.get("address") or "")
        by_pc[pc].append({"src":"epc_ew","cn":r["certificate_number"],"addr":a,
                          "pt":r.get("property_type"),"cls":cls(r.get("property_type")),
                          "fa":r.get("floor_area"),"date":r.get("lodgement_date"),
                          "uprn":(r.get("uprn") or "").strip()})
        kept += 1
print(f"E&W: scanned {tot:,}, kept {kept:,}", flush=True)

sc = 0
for r in csv.DictReader(open("scot_hist/AltHistoricExtract2013to2026ND.csv",
                             newline="", encoding="utf-8-sig", errors="replace")):
    pc = (r.get("POSTCODE") or "").upper().replace(" ", "")
    if pc not in want: continue
    u = (r.get("OSG_REFERENCE_NUMBER") or "").strip()
    a = ", ".join(x for x in (r.get("ADDRESS1"), r.get("ADDRESS2")) if x)
    by_pc[pc].append({"src":"epc_scotland","cn":r.get("REPORT_REFERENCE_NUMBER"),"addr":a,
                      "pt":r.get("PROPERTY_TYPE"),"cls":cls(r.get("PROPERTY_TYPE")),
                      "fa":r.get("FLOOR_AREA"),"date":r.get("LODGEMENT_DATE"),
                      "uprn":u if u.isdigit() else ""})
    sc += 1
print(f"Scotland: kept {sc:,}", flush=True)

pickle.dump(dict(by_pc), open("index_all.pkl","wb"), protocol=4)
print(f"indexed {kept+sc:,} certificates at {len(by_pc):,} of {len(want):,} store postcodes", flush=True)

need = {c["uprn"] for cs in by_pc.values() for c in cs if c["uprn"]}
print(f"resolving {len(need):,} UPRNs", flush=True)
coords = {}
with zipfile.ZipFile("open_uprn.zip") as z:
    n = [x for x in z.namelist() if x.lower().endswith(".csv")][0]
    with z.open(n) as fh:
        for r in csv.DictReader(io.TextIOWrapper(fh, encoding="utf-8-sig", errors="replace")):
            k = (r["UPRN"] or "").strip()
            if k in need:
                try: coords[k] = (float(r["LATITUDE"]), float(r["LONGITUDE"]))
                except (ValueError, TypeError): pass
pickle.dump(coords, open("coords_all.pkl","wb"), protocol=4)
print(f"resolved {len(coords):,}/{len(need):,} ({100*len(coords)/max(1,len(need)):.1f}%)")
