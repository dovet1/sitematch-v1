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

[2026-09-07] Aliases are now normalised with matchlib.norm_tokens, the same function
that normalises the certificate text they are matched against. They previously used a
local normaliser that folded no street suffixes and used a shorter noise list, so any
alias containing one of matchlib's folded or dropped tokens could never match anything.

Nine aliases were dead, and four brands had no working alias at all — Pets at Home
(PETS|AT|HOME: matchlib drops AT), Dunnes Stores (drops STORES), Rocks Lane (LANE->LN),
Blank Street Coffee (STREET->ST). Pets at Home is a substantial estate that was matching
on address text alone, with no brand signal, which is the strongest evidence available
and the one that separates a store from the concession trading inside it.

The rule is now simply: both sides of a comparison are normalised by the same function.
"""
import csv, json, glob, pickle
from collections import defaultdict, Counter
from matchlib import norm_tokens
csv.field_size_limit(10**7)

# The single token build_config's old noise list carried that matchlib's does not.
# "The Co-operative Group" and "The Gym Group" trade as Co-op and The Gym; "Group" is a
# corporate suffix that never appears on a shopfront or a certificate. Dropping it from
# the ALIAS side only is safe and strictly more permissive, because an alias matches as a
# contiguous run of tokens inside the certificate text: a shorter alias still matches
# longer text, never the reverse.
#
# Without this, normalising aliases with matchlib cost The Co-operative Group its bare
# OPERATIVE alias (2,384 stores) to gain four small brands a working one (56 stores) —
# a fix that was a net loss by a factor of fifty.
ALIAS_ONLY_NOISE = {"GROUP"}

def norm(s):
    toks = norm_tokens(s or "")
    trimmed = [t for t in toks if t not in ALIAS_ONLY_NOISE]
    # Never let the trim empty an alias outright — a brand actually called "Group" keeps it.
    return trimmed or toks

# Hand-curated: ordinary English that occurs in address text. An ambiguous alias may
# corroborate a match but may not carry one alone.
#
# Held here as the words themselves rather than as normalised phrases, and re-normalised
# on every build. The list previously lived only in the generated brand_config.json,
# where build_config.py could not see it — so regenerating the file silently dropped it,
# and any change to normalisation silently invalidated every entry. Both are now
# impossible.
#
# scripts/epc/README.md asks that this list be reviewed rather than extended silently.
AMBIGUOUS_RAW = [
    "Blank Street Coffee", "Boom Battle Bar", "Byron", "Centra", "Coffee House", "Cook",
    "EE", "Entertainer", "Escape Hunt", "Free People", "Gravity", "Gym", "Hop", "Next",
    "Odyssey", "Pure", "Range", "Revolution", "Six", "Superbowl", "Three", "Toni and Guy",
    "Zone",
]

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

ambiguous = sorted({"|".join(norm(a)) for a in AMBIGUOUS_RAW if norm(a)})

json.dump({
    "aliases": {b: ["|".join(p) for p in ps] for b, ps in aliases.items()},
    "family":  {b: sorted(v) for b, v in family.items()},
    "alias_noise": alias_noise,
    "ambiguous_aliases": ambiguous,
}, open("brand_config.json", "w"))
print(f"{len(ambiguous)} ambiguous aliases carried through")

print(f"{len(aliases)} brands aliased; families >1 member: {fam_sizes.get(1,0)} singletons, "
      f"{sum(v for k,v in fam_sizes.items() if k>1)} brands in shared families")
print("\nnoisiest aliases (ratio = certificate hits per store):")
for k, v in sorted(alias_noise.items(), key=lambda x: -x[1]["ratio"])[:14]:
    owners = ", ".join(brands[b] for b in phrase_index[tuple(k.split("|"))])[:44]
    print(f"  {k:22s} hits={v['hits']:7,d} stores={v['stores']:5,d} ratio={v['ratio']:8.1f}  {owners}")
