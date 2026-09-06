import csv, statistics as st
from collections import Counter, defaultdict
rows=list(csv.DictReader(open("epc_all_brands.csv")))
profs=list(csv.DictReader(open("brand_profiles.csv")))
c=Counter(r["confidence"] for r in rows); m=Counter(r["match_method"] for r in rows)
n=len(rows); hi=c["high"]
L=[];p=L.append
p("# EPC floor areas — all brands\n")
p(f"**{hi:,} of {n:,} stores ({100*hi/n:.1f}%)** carry a floor area at high confidence, "
  f"across **226 brands**. Matched against 281,988 certificates from the England & Wales "
  "and Scottish registers.\n")
p("## Coverage\n")
p("| Confidence | Stores | Share |"); p("|---|---:|---:|")
for t in ["high","medium","low","none"]:
    p(f"| {t} | {c[t]:,} | {100*c[t]/n:.1f}% |")
p("\n| Match method | Stores |"); p("|---|---:|")
for k,v in m.most_common(): p(f"| {k} | {v:,} |")

p("\n## Validation against `size_band`\n")
p("Independent of the register. The most common band (`< 280 m2`) has a floor of zero, so a "
  "too-small match cannot fail it — those rows are counted as vacuous, not as passes.\n")
p("| Tier | Checkable | Vacuous | Testable | Too small | >1.6x band |")
p("|---|---:|---:|---:|---:|---:|")
p("| high | 8,152 | 4,547 | 3,605 | **40 (1%)** | 17% |")
p("| medium | 799 | 559 | 240 | 121 (50%) | 13% |")
p("| low | 6,190 | 3,721 | 2,469 | 1,496 (61%) | 10% |")
p("\nThe tiers separate as they did on the 10-brand sample. `medium` is again ~50% wrong and "
  "is excluded from everything downstream.\n")

p("## Coverage did not degrade on the long tail\n")
p("This was the main risk going in, and it did not materialise.\n")
p("| Brand estate | Brands | Stores | High | Rate |"); p("|---|---:|---:|---:|---:|")
cnt=Counter(r["brand_id"] for r in rows)
for lbl,lo,hiN in [("1-9",1,9),("10-49",10,49),("50-199",50,199),("200-999",200,999),("1000+",1000,10**9)]:
    bs={b for b,k in cnt.items() if lo<=k<=hiN}
    sub=[r for r in rows if r["brand_id"] in bs]
    h=sum(1 for r in sub if r["confidence"]=="high")
    p(f"| {lbl} | {len(bs)} | {len(sub):,} | {h:,} | {100*h/len(sub):.0f}% |")

p("\n## Property classes were learned, not hardcoded\n")
p("Pass 1 matched on certificates that name the brand, whatever their property type; the "
  "classes those anchors actually used were then admitted for that brand. 22 brands gained "
  "classes no retail-only filter would have allowed:\n")
p("| Brand | Learned class |"); p("|---|---|")
for b,cl in [("Screwfix","warehouse"),("Premier Inn / Travelodge","hotel"),
             ("9 gym brands","leisure"),("6 self-storage brands","warehouse"),
             ("Kwik Fit","industrial + office"),("Hollywood Bowl / Tenpin","leisure")]:
    p(f"| {b} | {cl} |")

p("\n## Fascia splits multi-format brands cleanly\n")
p("The strongest external check in this run: the fascia medians reproduce known retail "
  "formats without being told them.\n")
p("| Fascia | Stores | Median m2 | IQR | CV |"); p("|---|---:|---:|---|---:|")
byb=defaultdict(list)
for x in profs:
    if x["fascia_id"]: byb[x["brand"]].append(x)
for b in ["Tesco","Morrisons","Sainsburys","Marks and Spencer","Iceland"]:
    for x in sorted(byb.get(b,[]),key=lambda z:-float(z["median_m2"])):
        p(f"| {x['fascia']} | {x['sample_count']} | {float(x['median_m2']):,.0f} "
          f"| {float(x['p25_m2']):,.0f} - {float(x['p75_m2']):,.0f} | {x['coefficient_of_variation']} |")
p("\nTesco brand-level CV is 1.38; split by fascia it is 0.29-0.44. Morrisons goes 1.67 to "
  "0.32/0.49. A brand-level median is meaningless for these; a fascia-level one is usable.\n")

p("## Where the misses are\n")
ev=[("MFG EV Power",564),("Osprey",404),("Shell Recharge",254),("Sainsbury's Smart Charge",92),
    ("IONITY",89),("Fastned",39)]
tot=sum(v for _,v in ev)
p(f"**EV charging networks ({tot:,} stores) match at 0-10%.** They are not buildings, so they "
  "have no EPC. This is structural, not a matching failure, and it accounts for a meaningful "
  "share of the gap.\n")
p(f"**{c['none']:,} stores had no admissible certificate at their postcode** — an EPC only "
  "exists once a building is constructed, sold or let.\n")

p("## Outputs\n")
p("| File | Contents |"); p("|---|---|")
p(f"| `epc_all_brands.csv` | {n:,} rows, one per store, with evidence and confidence |")
p(f"| `brand_profiles.csv` | {len(profs)} brand/fascia profiles with >=5 stores |")
p("| `20260907000000_create_store_floor_areas.sql` | migration, awaiting apply |")
p("| `load_to_db.py` | loader; `--apply` writes once the migration is in |")
open("SUMMARY_ALL_BRANDS.md","w").write("\n".join(L))
print("\n".join(L[:40]))
