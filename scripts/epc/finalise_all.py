"""Size plausibility gate, validation, CSV, and brand/fascia profiles."""
import csv, json, math, pickle, re, statistics as st
from collections import defaultdict, Counter

d = pickle.load(open("rows_all.pkl", "rb"))
rows = d["rows"]
BAND, MIN_N = 3.0, 8

def band_range(b):
    """'< 3,013 ft2 (280m2)' -> (0, 280).

    The unit suffix must be stripped BEFORE extracting numbers: the "2" in "m2"
    is a digit, so "(280m2)" otherwise reads as [280, 2] and every small store
    looks like it falls below its own band.
    """
    if not b: return None
    m = re.search(r"\(([^)]*m2[^)]*)\)", b)
    if not m: return None
    txt = re.sub(r"m\s*2", " ", m.group(1))
    n = [float(x.replace(",", "")) for x in re.findall(r"[\d,]+", txt)]
    if not n: return None
    if len(n) >= 2: return (n[0], n[1])
    if b.strip().startswith("<"): return (0.0, n[0])
    return (n[0], math.inf)

def pct(v, q):
    v = sorted(v); k = (len(v)-1)*q; lo, hi = math.floor(k), math.ceil(k)
    return v[lo] if lo == hi else v[lo] + (v[hi]-v[lo])*(k-lo)
def cv(v): return st.stdev(v)/st.mean(v) if len(v) > 1 and st.mean(v) else None

# --- size plausibility, anchored on brand-named certificates -----------------
ref = defaultdict(list)
for r in rows:
    if r.get("confidence") == "high" and r.get("brand_on_certificate") == "yes" and r.get("floor_area_m2"):
        ref[(r["brand_id"], r["fascia_id"])].append(r["floor_area_m2"])
        ref[(r["brand_id"], "*")].append(r["floor_area_m2"])
prof = {k: st.median(v) for k, v in ref.items() if len(v) >= MIN_N}

demoted = ungated = 0
for r in rows:
    r["size_plausibility"] = ""
    fa = r.get("floor_area_m2")
    if not fa or r.get("confidence") != "high": continue
    m = prof.get((r["brand_id"], r["fascia_id"])) or prof.get((r["brand_id"], "*"))
    if not m: ungated += 1; continue
    if fa > BAND*m or fa < m/BAND:
        r["size_plausibility"] = "implausible_for_format"; r["confidence"] = "low"; demoted += 1
    else: r["size_plausibility"] = "plausible"
print(f"size gate: {demoted:,} demoted, {ungated:,} had no profile to test against")

# --- output ------------------------------------------------------------------
F = ["store_uuid","store_id","brand_id","brand","fascia_id","fascia","store_name",
     "store_address","postcode","pqi","size_band","confidence","match_method",
     "floor_area_m2","source","certificate_number","certificate_date","certificate_address",
     "property_type","property_class","uprn","address_corroboration","brand_on_certificate",
     "foreign_operator","spatial_distance_m","size_plausibility","candidate_count",
     "certs_at_address","matcher_version"]
with open("epc_all_brands.csv","w",newline="") as f:
    w = csv.DictWriter(f, fieldnames=F, extrasaction="ignore"); w.writeheader()
    for r in rows: w.writerow({k: r.get(k, "") for k in F})

# --- validation --------------------------------------------------------------
# The most common band is "< 280 m2", whose floor is zero. A too-small match can
# never fail such a band, so that subset is reported separately as vacuous rather
# than counted as a pass.
print("\nValidation against size_band (independent of the register):")
print(f"  {'tier':8s} {'stores':>8s} {'checkable':>10s} {'vacuous':>9s} {'testable':>9s} "
      f"{'too small':>11s} {'>1.6x band':>11s}")
for t in ["high","medium","low"]:
    sub=[r for r in rows if r["confidence"]==t]
    ck=[]
    for r in sub:
        b=band_range(r.get("size_band"))
        if b and r.get("floor_area_m2"): ck.append((r["floor_area_m2"], b))
    if not ck: continue
    vac=sum(1 for fa,b in ck if b[0]==0.0)
    testable=[x for x in ck if x[1][0]>0]
    below=sum(1 for fa,b in testable if fa<b[0])
    above=sum(1 for fa,b in ck if b[1]!=math.inf and fa>b[1]*1.6)
    br=f"{below:,} ({100*below/len(testable):.0f}%)" if testable else "-"
    print(f"  {t:8s} {len(sub):8,d} {len(ck):10,d} {vac:9,d} {len(testable):9,d} "
          f"{br:>11s} {100*above/len(ck):10.0f}%")

# --- coverage by brand estate size: does the long tail behave differently? ----
cnt = Counter(r["brand_id"] for r in rows)
print("\nCoverage by brand estate size:")
print(f"  {'estate':10s} {'brands':>7s} {'stores':>8s} {'high':>8s} {'rate':>6s}")
for lbl, lo, hi in [("1-9",1,9),("10-49",10,49),("50-199",50,199),
                    ("200-999",200,999),("1000+",1000,10**9)]:
    bs = {b for b,n in cnt.items() if lo <= n <= hi}
    sub = [r for r in rows if r["brand_id"] in bs]
    h = sum(1 for r in sub if r["confidence"]=="high")
    print(f"  {lbl:10s} {len(bs):7,d} {len(sub):8,d} {h:8,d} {100*h/len(sub):5.0f}%")

# --- brand / fascia profiles -------------------------------------------------
good = defaultdict(list)
for r in rows:
    if r["confidence"]=="high" and r.get("floor_area_m2"):
        good[(r["brand_id"], r["fascia_id"], r["brand"], r["fascia"])].append(r["floor_area_m2"])
        good[(r["brand_id"], None, r["brand"], "")].append(r["floor_area_m2"])
profiles=[]
for (bid,fid,bn,fn), v in good.items():
    if len(v) < 5: continue
    profiles.append({"brand_id":bid,"fascia_id":fid,"brand":bn,"fascia":fn,
        "p25_m2":round(pct(v,.25),1),"median_m2":round(st.median(v),1),
        "p75_m2":round(pct(v,.75),1),"min_m2":round(min(v),1),"max_m2":round(max(v),1),
        "sample_count":len(v),
        "coefficient_of_variation":round(cv(v),3) if cv(v) is not None else None})
with open("brand_profiles.csv","w",newline="") as f:
    w=csv.DictWriter(f,fieldnames=list(profiles[0].keys())); w.writeheader(); w.writerows(profiles)
print(f"\n{len(profiles):,} brand/fascia profiles with >=5 stores "
      f"({sum(1 for p in profiles if p['fascia_id'] is None):,} brand-level)")
c=Counter(r["confidence"] for r in rows)
print(f"\nFINAL: {c['high']:,}/{len(rows):,} high confidence ({100*c['high']/len(rows):.1f}%)")
