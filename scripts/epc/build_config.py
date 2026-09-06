"""Brand aliases, operator families, and an empirical noise score per alias.

Aliases come from data we already curate: the brand name plus its fascia trading
names. Nothing is invented. Two problems have to be solved before they can be
used across 226 brands:

  1. Shared trading names. Sixteen distinct co-operative societies all trade as
     "The Co-operative Food". Treating every other brand's alias as a rival would
     make them rivals of each other and reject every Co-op match. Brands sharing
     a fascia name form an operator family and are never rivals within it.

  2. Noisy aliases. "Next", "Cook", "Three" and "The Range" appear in ordinary
     address text. A dictionary test over-flags (Iceland, Subway and KFC are
     dictionary words but perfectly distinctive), so noise is measured instead:
     how often the alias appears on certificates nationally, relative to how many
     stores the brand has.
"""
import csv, json, re, glob, pickle
from collections import defaultdict, Counter
csv.field_size_limit(10**7)

NOISE_TOKENS = {"THE","AND","OF","CO","LTD","LIMITED","PLC","GROUP","UK","GB"}

def norm(s):
    s = (s or "").upper().replace("&", " AND ").replace("'", "")
    return [t for t in re.sub(r"[^A-Z0-9 ]+", " ", s).split() if t and t not in NOISE_TOKENS]

ref = json.load(open("brand_reference.json"))
brands, brand_fascias = ref["brands"], ref["brand_fascias"]
stores = list(csv.DictReader(open("all_stores.csv")))
store_counts = Counter(s["brand_id"] for s in stores)

# --- aliases -----------------------------------------------------------------
aliases = {}
for bid, name in brands.items():
    if not store_counts.get(bid):
        continue
    phrases = {tuple(norm(name))}
    for f in brand_fascias.get(bid, []):
        phrases.add(tuple(norm(f)))
    aliases[bid] = sorted({p for p in phrases if p}, key=len)

# --- operator families (brands sharing a fascia trading name) ----------------
by_fascia = defaultdict(set)
for bid, names in brand_fascias.items():
    if store_counts.get(bid):
        for n in names:
            by_fascia[tuple(norm(n))].add(bid)
family = {bid: {bid} for bid in aliases}
for members in by_fascia.values():
    if len(members) > 1:
        union = set()
        for m in members: union |= family.get(m, {m})
        for m in members: family[m] = union
fam_sizes = Counter(len(v) for v in family.values())

# --- empirical alias noise ---------------------------------------------------
# One pass over the whole register counting how many certificates contain each
# alias phrase anywhere in their address.
phrase_index = defaultdict(set)          # phrase -> brand_ids claiming it
for bid, ps in aliases.items():
    for p in ps: phrase_index[p].add(bid)
first_tok = defaultdict(list)
for p in phrase_index: first_tok[p[0]].append(p)

hits = Counter()
scanned = 0
for path in sorted(glob.glob("/Users/tomdove/Downloads/non-domestic-csv/certificates-*.csv")):
    for r in csv.DictReader(open(path, newline="", encoding="utf-8", errors="replace")):
        scanned += 1
        toks = norm(r.get("address") or "")
        if not toks: continue
        tset = set(toks)
        for i, t in enumerate(toks):
            for p in first_tok.get(t, ()):
                if toks[i:i+len(p)] == list(p):
                    hits[p] += 1
print(f"scanned {scanned:,} certificates for alias occurrences", flush=True)

# noise ratio: certificate hits per store. A brand's own estate generates several
# certificates per store over time, so ~1-6 is normal; far above that is a word
# appearing in address text rather than an occupier name.
alias_noise = {}
for p, n in hits.items():
    owners = phrase_index[p]
    est = sum(store_counts.get(b, 0) for b in owners) or 1
    alias_noise["|".join(p)] = {"hits": n, "stores": est, "ratio": round(n/est, 2)}

json.dump({
    "aliases": {b: ["|".join(p) for p in ps] for b, ps in aliases.items()},
    "family":  {b: sorted(v) for b, v in family.items()},
    "alias_noise": alias_noise,
}, open("brand_config.json", "w"))

print(f"{len(aliases)} brands aliased; families >1 member: {fam_sizes.get(1,0)} singletons, "
      f"{sum(v for k,v in fam_sizes.items() if k>1)} brands in shared families")
print("\nnoisiest aliases (ratio = certificate hits per store):")
for k, v in sorted(alias_noise.items(), key=lambda x: -x[1]["ratio"])[:14]:
    owners = ", ".join(brands[b] for b in phrase_index[tuple(k.split("|"))])[:44]
    print(f"  {k:22s} hits={v['hits']:7,d} stores={v['stores']:5,d} ratio={v['ratio']:8.1f}  {owners}")
