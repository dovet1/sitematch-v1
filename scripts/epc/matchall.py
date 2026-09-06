"""Match all 43,070 stores against both EPC registers.

Same evidence rules as the validated 10-brand run, with the hardcoded parts
replaced by configuration derived from data: aliases from brand and fascia names,
rivals scoped by operator family, and admissible property types learned from
certificates that name the brand.
"""
import csv, json, math, pickle, sys
from collections import defaultdict, Counter
from matchlib import (norm_tokens, units, numbers, compatible, addr_score,
                      store_addr_parts, store_tokens, corroboration)

MATCHER_VERSION = "epc-2026.09.05-allbrands"
NEAR, MARGIN = 25.0, 25.0
BASE_CLASSES = {"retail", "food"}
ALL_CLASSES  = {"retail","food","warehouse","industrial","office","hotel",
                "leisure","institution","other"}
ROOFTOP = {"Rooftop"}

stores = list(csv.DictReader(open("all_stores.csv")))
index  = pickle.load(open("index_all.pkl", "rb"))
coords = pickle.load(open("coords_all.pkl", "rb"))
cfg    = json.load(open("brand_config.json"))

aliases   = {b: [tuple(p.split("|")) for p in ps] for b, ps in cfg["aliases"].items()}
family    = {b: set(v) for b, v in cfg["family"].items()}
ambiguous = set(cfg["ambiguous_aliases"])

# phrase -> brands claiming it, indexed by first token for a cheap scan
owners = defaultdict(set)
for b, ps in aliases.items():
    for p in ps: owners[p].add(b)
by_first = defaultdict(list)
for p in owners: by_first[p[0]].append(p)

def phrases_on(ctoks):
    """Alias phrases present in a certificate address."""
    found = set()
    for i, t in enumerate(ctoks):
        for p in by_first.get(t, ()):
            if ctoks[i:i+len(p)] == list(p): found.add(p)
    return found

def hav(a, b, c, d):
    R = 6371000.0; p1, p2 = math.radians(a), math.radians(c)
    dp, dl = math.radians(c-a), math.radians(d-b)
    x = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*R*math.asin(math.sqrt(x))

def fnum(v):
    try:
        f = float(v)
        return f if f > 0 else None
    except (TypeError, ValueError): return None

def match(s, admissible):
    # admissible=None means 'every property class' (pass 1)
    bid  = s["brand_id"]
    fam  = family.get(bid, {bid})
    mine = set(aliases.get(bid, []))
    unamb = {p for p in mine if "|".join(p) not in ambiguous}
    pool = index.get(s["postcode"].upper().replace(" ", ""), [])
    ok_cls = ALL_CLASSES if admissible is None else admissible.get(bid, BASE_CLASSES)
    # A certificate with no reference number cannot be cited, audited, or
    # reconciled against a later refresh. 122 Scottish rows (0.1%) lack one.
    elig = [c for c in pool if c["cls"] in ok_cls and fnum(c["fa"]) and (c["cn"] or "").strip()]

    s_parts, stoks = store_addr_parts(s), store_tokens(s)
    scored = []
    for c in elig:
        ct = norm_tokens(c["addr"])
        present = phrases_on(ct)
        brand_named = bool(present & mine)
        rival = ""
        for p in present - mine:
            other = owners[p] - fam
            if other:
                rival = "|".join(p); break
        comp = compatible(s_parts, [c["addr"]])
        sc = addr_score(stoks, ct) if comp else 0.0
        scored.append({"c": c, "sc": sc, "ok": comp, "named": brand_named,
                       "unamb": bool(present & unamb), "rival": rival, "ct": ct})

    addr  = [x for x in scored if x["ok"] and x["sc"] >= 0.6]
    # an ambiguous alias may corroborate but may not carry a match alone
    brandm = [x for x in scored if x["ok"] and x["unamb"]]

    if addr:     method, group = "address", addr
    elif brandm: method, group = "brand", brandm
    elif len(elig) == 1: method, group = "postcode-single", scored
    elif len(elig) > 1:  method, group = "postcode-ambiguous", scored
    else: return {"match_method": "none", "confidence": "none"}

    best = max(group, key=lambda g: (g["sc"], g["c"]["date"] or ""))
    key  = tuple(norm_tokens(best["c"]["addr"]))
    same = [g for g in group if tuple(norm_tokens(g["c"]["addr"])) == key]
    newest = max(g["c"]["date"] or "" for g in same)
    tied = [g for g in same if (g["c"]["date"] or "") == newest]
    pick = sorted(tied, key=lambda g: g["c"]["cn"] or "")[0]
    c = pick["c"]

    row = {"match_method": method, "source": c["src"], "certificate_number": c["cn"],
           "certificate_address": c["addr"], "certificate_date": c["date"],
           "property_type": c["pt"], "property_class": c["cls"], "uprn": c["uprn"],
           "floor_area_m2": fnum(c["fa"]),
           "address_corroboration": corroboration(s_parts, c["addr"]),
           "brand_on_certificate": "yes" if pick["named"] else "no",
           "foreign_operator": pick["rival"], "candidate_count": len(elig),
           "certs_at_address": len(same), "spatial_distance_m": ""}

    # spatial, for anything the text evidence does not already settle
    strong = (pick["named"] or row["address_corroboration"] in ("unit", "number"))
    if not strong or pick["rival"]:
        try: la, lo = float(s["lat"]), float(s["lon"])
        except (TypeError, ValueError): la = None
        if la is not None and (s.get("pqi") or "") in ROOFTOP:
            cand = []
            for x in scored:
                xy = coords.get(x["c"]["uprn"])
                if not xy or (x["rival"] and not x["named"]): continue
                cand.append((hav(la, lo, xy[0], xy[1]), x))
            if cand:
                cand.sort(key=lambda t: t[0])
                d, x = cand[0]
                marg = (cand[1][0] - d) if len(cand) > 1 else float("inf")
                if d <= NEAR and marg >= MARGIN:
                    c = x["c"]
                    row.update(match_method="spatial", source=c["src"],
                               certificate_number=c["cn"], certificate_address=c["addr"],
                               certificate_date=c["date"], property_type=c["pt"],
                               property_class=c["cls"], uprn=c["uprn"],
                               floor_area_m2=fnum(c["fa"]), address_corroboration="spatial",
                               brand_on_certificate="yes" if x["named"] else "no",
                               foreign_operator="", spatial_distance_m=round(d, 1))
                    pick = x

    if row["foreign_operator"] and row["brand_on_certificate"] != "yes":
        conf = "low"
    elif row["brand_on_certificate"] == "yes" or row["address_corroboration"] in ("unit","number","spatial"):
        conf = "high"
    elif method in ("postcode-single", "postcode-ambiguous"):
        conf = "low"
    else:
        rivals_on_street = sum(1 for g in group if g["sc"] >= 0.6
                               and tuple(norm_tokens(g["c"]["addr"])) != key)
        conf = "medium" if not rivals_on_street else "low"
    row["confidence"] = conf
    return row

# ---- pass 1: ALL property classes, to learn what each brand actually occupies --
# Restricting pass 1 to retail/food would make the learning circular: it could
# never discover that Screwfix trade counters are certificated as warehouses,
# because it would never look at a warehouse certificate. Anchors are certificates
# that NAME the brand, so they are trustworthy regardless of property type.
learn = defaultdict(Counter)
for s in stores:
    r = match(s, None)
    if r.get("confidence") == "high" and r.get("brand_on_certificate") == "yes":
        learn[s["brand_id"]][r["property_class"]] += 1
print(f"pass 1: {sum(sum(c.values()) for c in learn.values()):,} brand-named anchors", flush=True)

# a class is admitted for a brand when its own brand-named certificates use it
admissible = {}
for bid, c in learn.items():
    tot = sum(c.values())
    extra = {k for k, v in c.items() if k not in BASE_CLASSES and v >= 5 and v/tot >= 0.20}
    admissible[bid] = BASE_CLASSES | extra
extra_n = {b: v - BASE_CLASSES for b, v in admissible.items() if v - BASE_CLASSES}
print(f"pass 1: {len(extra_n)} brands admitted extra property classes", flush=True)

# ---- pass 2 ----------------------------------------------------------------
rows = []
for i, s in enumerate(stores, 1):
    r = match(s, admissible)
    r.update(store_uuid=s["id"], store_id=s["store_id"], brand=s["brand"],
             brand_id=s["brand_id"], fascia=s["fascia"], fascia_id=s["fascia_id"],
             store_name=s["name"], postcode=s["postcode"], size_band=s["size_band"],
             pqi=s["pqi"], matcher_version=MATCHER_VERSION,
             store_address=", ".join(x for x in [s["address_line_1"], s["address_line_2"],
                                                 s["town"]] if x))
    rows.append(r)
    if i % 10000 == 0: print(f"  pass 2: {i:,}/{len(stores):,}", flush=True)

pickle.dump({"rows": rows, "admissible": {b: sorted(v) for b, v in admissible.items()}},
            open("rows_all.pkl", "wb"), protocol=4)
print()
print(Counter(r["confidence"] for r in rows).most_common())
print(Counter(r["match_method"] for r in rows).most_common())
