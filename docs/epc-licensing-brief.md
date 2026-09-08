# EPC register data: what we may and may not do, where we currently stand, and the ways out

**Status:** briefing for a legal/commercial decision. Not legal advice.
**Date:** 2026-09-06
**Sources:** MHCLG licensing guidance as recorded in `docs/store-floor-areas-plan.md` §2.4
(verified 2026-09-05), `scripts/epc/README.md`, and the code and tables cited below.

---

## 1. The short version

The EPC register is **not one dataset with one licence. It is one file with two
licences inside it**, and we are using the restricted half.

| Fields | Licence | May we use them for site matching? |
|---|---|---|
| `FLOOR_AREA`, `PROPERTY_TYPE`, `LODGEMENT_DATE`, `OSG_REFERENCE_NUMBER` (UPRN) | Open Government Licence v3.0 | **Yes**, with attribution |
| `ADDRESS1`, `ADDRESS2`, `ADDRESS3`, `POSTCODE` | Restricted — Ordnance Survey and Royal Mail derived | **No**, not without a further licence |

The floor area — the number we actually want — is free and open. The address that
tells us *which building the number belongs to* is not. That is the entire problem
in one sentence.

---

## 2. Why the address fields are restricted

Three separate sets of rights sit on top of the address fields. They are cumulative:
satisfying one does not satisfy the others. This matters enormously when choosing a
way out, because most of the obvious fixes only address one layer.

**Layer 1 — MHCLG's own terms.** We accepted these when we created the account and
downloaded the bulk file. They list the purposes for which address data may be used:
property management promoting energy efficiency, research on building energy
efficiency, evaluating energy improvements, marketing energy-efficiency programmes,
EPB enforcement, local-authority building control, and crime prevention. Anything
else, in MHCLG's words, "requires an appropriate licence from Ordnance Survey."

Matching shop floor areas for a commercial property directory is not on that list.
It is not close to being on that list.

**Layer 2 — Ordnance Survey.** The addresses come from AddressBase, which is OS
intellectual property. OS also asserts rights over *derived data* — information you
created by using their data, even if none of their data remains in what you kept.

**Layer 3 — Royal Mail.** Postcodes and postal address formatting come from the
Postcode Address File. PAF is separately licensed by Royal Mail and bulk retention
of PAF-derived address data normally requires a PAF licence.

**The trap most people fall into.** It is natural to think "we only *use* the
address to find the right certificate, then we throw it away, so we are fine." That
reasoning fails at Layer 1, because the restriction is on the **purpose** you use it
for, not on whether you keep it. Using restricted address data for thirty seconds to
build a commercial product is using it for a non-permitted purpose. Deleting it
afterwards is good hygiene, not compliance. (It does help — see option D — but it is
a mitigation, not a cure.)

---

## 3. Where we stand right now

Ordered by how exposed each item is.

**3.1 We store certificate addresses in the production database.**
`store_floor_areas.certificate_address` is populated for all 19,111 matched rows
(`scripts/epc/load_to_db.py:44`). This is restricted OS/Royal Mail address text,
retained indefinitely, in a commercial product's database. It is the single most
visible thing on this list. The migration that created it already anticipates this
and says the column "should be dropped if the licensing position requires it —
nothing computes from it."

**3.2 The matching itself uses restricted fields.** This is the substantive breach,
and it does not go away by deleting a column. `index_all_brands.py:41-44` indexes
every certificate by `POSTCODE` and builds an address string from `ADDRESS1` and
`ADDRESS2`; `matchlib.py` scores our store address against it. Postcode and address
text are how 57% of our coverage is achieved.

**3.3 The strongest signal we have is entirely restricted data.** The operator's name
— "Iceland Foods Plc", "TJ Morris" — appears inside `ADDRESS1`/`ADDRESS2`. There is
no separate occupier field. So `brand_on_certificate`, the single best evidence we
have that a certificate describes *our* unit, is derived wholly from restricted text.
Any compliant rebuild loses it. This is worth understanding before comparing options:
we would not merely be losing coverage, we would be losing the thing that makes the
matches trustworthy.

**3.4 Every high-confidence floor area is derived data.** Under a strict OS reading,
the link "store X is 1,032 m²" is itself derived from restricted address data, even
though the number came from an OGL field. The whole table is arguably in scope, not
just the address column.

**3.5 We publish it, unattributed.** Brand and fascia medians reach paying users
through `/api/public/brands/floor-area-profiles`. The OGL fields require attribution
and we display none. That part is trivially fixable and should be fixed regardless
of everything else.

**3.6 The bulk file sits on a laptop.** Downloading it was legitimate. Retaining and
processing it for this purpose is the same Layer 1 problem as 3.2.

**3.7 The proposed `epc_certificates` table would make all of this considerably
worse.** `docs/store-floor-areas-import-plan.md` §3 proposes loading ~1.4M normalised
postcodes and addresses into our production database permanently. That converts a
laptop copy into a hosted, queryable reproduction of OS and Royal Mail address data.
**Do not build that table until this is resolved.** It is the one step in that plan
that should be held.

**3.8 What is *not* wrong.** The repository is clean — `git ls-files scripts/epc`
shows only code, `brand_config.json` (built from our own brand and fascia names) and
`brand_profiles.csv` (aggregates only, no addresses). The `.gitignore` is doing its
job. And because we use only the **non-domestic** register, the personal-data concern
MHCLG raises is largely inapplicable: these are commercial premises, not homes. A
sole trader registered at a home address is the only realistic edge case.

---

## 4. What we could still do with no licence at all

Worth stating plainly, because it is more than nothing:

- Use `floor_area`, `property_type`, `lodgement_date` and `uprn` freely, with OGL
  attribution.
- Match a certificate to a store **by UPRN and geometry only** — never reading the
  certificate's address or postcode. UPRN is on 89.8% of E&W certificates and 62.6%
  of Scottish ones, and OS Open UPRN (OGL, free, 42M rows) resolves 99.9% of them to
  coordinates.
- Publish aggregate statistics derived from OGL fields.

The measured cost of staying inside that boundary is **21% coverage instead of 57%**
(1,471 of 7,039 E&W stores in the assessment sample). Section 6 argues that 21% is
not a fixed ceiling — it is a symptom of something we can fix cheaply and lawfully.

---

## 5. The options

### A. Buy an Ordnance Survey licence

Cures **Layer 2**. Does not automatically cure Layer 1 (MHCLG's permitted-purpose
list is a separate contract we accepted) or Layer 3 (Royal Mail PAF).

- **Coverage:** 57%, unchanged. Keeps the brand-name signal.
- **Cost:** get a quote. AddressBase-class commercial licensing is realistically a
  four- to five-figure annual commitment, and pricing depends on how the use is
  characterised.
- **Effort:** none technically. Everything keeps working.
- **Risk:** you may pay and still be told by MHCLG that the purpose is not permitted.
  **So ask MHCLG first (option F). It is free.**

### B. UPRN and geometry only — fully compliant, no licence needed

Delete `certificate_address`, never index by certificate postcode, match by UPRN
coordinates alone.

- **Coverage:** 21% today.
- **Accuracy:** worse, and this is under-appreciated. Today only 14% of spatial
  matches rest on distance alone — 68% are corroborated by the brand name on the
  certificate and 18% by being the sole candidate in range. Remove the address text
  and that corroboration disappears; every spatial match becomes distance-only.
- **Cost:** free. **Effort:** a spatial index over 42M UPRN points, replacing the
  postcode index. Perhaps a week.
- **Verdict:** this is the safe floor. It is also the base that option E improves.

### C. Change source — VOA rating list (and SAA in Scotland)

**[2026-09-06: investigated. The data is excellent. The licence is worse than EPC's.
This option is downgraded — see below.]**

**The data.** There *is* a free bulk download — no scraping required. The Summary
Valuation file carries, per hereditament:

| Field | |
|---|---|
| `Total Area` | total area of the line items, in m² |
| `Unit of Measurement` | **"GIA" or "NIA"** — the file states which basis it used |
| Line items (record type 02) | floor-by-floor breakdown: floor, description, area, £/m² |
| `Firm's Name` | occupier name as a structured field — but only a minority of assessments |
| `Primary Description` / SCAT code | property classification, richer than EPC's property type |
| `UARN` | VOA's own key. **No UPRN**, so matching is address-based, as with EPC |

Coverage is every non-domestic property in England and Wales, with no equivalent of
EPC's "no certificate until built, sold or let" gap. Weekly change-update files and a
ReST API make the refresh story far simpler than EPC's. The `Unit of Measurement`
flag is the standout: it would resolve the GIA-vs-sales-area labelling risk that
§9.3 of the assessment flags as actively misleading.

**The licence.** Restricted, and narrowly so. From the terms of use:

- *"Publication of this information and its use is restricted to Non Domestic Rating
  (NDR) purposes only."*
- Permitted uses are exercising the right to view rating assessments and reviewing
  the valuation of assessments you have an interest in.
- *"Onward disclosure to a third party is prohibited except where the third party's
  use is for the uses stated above."*
- The user must delete the information when the business need for those purposes ends.
- **"An open government licence does not apply."**

**Why this is worse than EPC, not better.** EPC has an OGL half — floor area,
property type, UPRN are genuinely open, and only the address is restricted. VOA has
no open half at all, and its single permitted purpose is narrower than any of the
seven on MHCLG's list. Showing a floor area to a SiteMatcher user is onward
disclosure to someone whose use is not an NDR purpose, which the terms prohibit
outright.

**And it cannot be fixed by drafting.** The obvious mitigation — pass the terms
through in our own T&Cs — does not work here, because the condition is on the
recipient's *purpose*, not on their acceptance of terms. Our users are not using it
for NDR purposes.

**What remains of this option:** ask VOA for a licence for a different purpose. The
commercial property products already built on rating data are presumably licensed
that way, not running off the free download. That is the same move as option F,
addressed to a different department, and it is free to ask.

### D. Transient matching — use the address, keep only the answer

Match in memory, write the floor area and the certificate number, never persist
address or postcode.

- **Coverage:** 57%.
- **Cures:** retention and redistribution exposure. Removes item 3.1 and prevents 3.7.
- **Does not cure:** Layer 1. The purpose is still non-permitted (see §2).
- **Verdict:** a genuine and material reduction in exposure, and probably part of
  whatever a lawyer signs off. Not a standalone answer.

### E. Fix our own coordinates instead of licensing theirs — **recommended first move**

This is the option the assessment did not consider, and I think it is the best value
on the list.

**Why 21% is not really the ceiling.** 89.8% of E&W certificates carry a UPRN, and
99.9% of those resolve to coordinates. So the certificate side is in good shape. The
bottleneck is *our* side: spatial matching is only admitted for stores with
`pqi = 'Rooftop'` (`matchall.py:18,116`), because the 25 m threshold was calibrated
on nothing else. Every store with a weaker geocode is excluded before matching
begins — and the import route has been writing `pqi = null` for every imported store
ever (`upload/route.ts:752`), which excludes them all permanently.

**So the compliant coverage figure is partly a measure of our own address data
quality, not of the licence.**

- **First action, costs nothing:** `SELECT pqi, count(*) FROM stores GROUP BY pqi`.
  That single query tells you the actual ceiling on option B. If rooftop-quality
  coordinates are a minority of the estate, the headroom is large.
- **Then:** resolve our own 43,070 store addresses to UPRNs or rooftop coordinates
  through a licensed service. Match UPRN-to-UPRN, which is an identity comparison,
  not a fuzzy string one — more accurate than address text, not less.
- **The economics are much better.** A licence covering *our* address data scales
  with our 43,070 stores, once, and is useful across the whole product — geocoding,
  deduplication, the import flow. A licence covering *their* 1.4M certificates buys
  only this feature.
- **Trade-off:** still costs money, still needs a legal read on whether a UPRN
  resolved under our own licence may be compared against the EPC UPRN field (I expect
  yes — both sides are then OGL or our own — but confirm it).

### F. Ask MHCLG for written permission

- **Cost:** an email. **Time:** weeks.
- **Value:** a written yes removes Layer 1 entirely and makes option A a clean fix. A
  written no saves you from paying OS for a licence that would not have helped.
- **Verdict:** do this today, whatever else is decided. There is no scenario where
  knowing the answer is worse than not knowing it.

### G. Buy commercial retail data (LDC, CoStar, Green Street, Radius)

- **Cures:** everything, including the accuracy problem we currently cannot measure.
  These datasets are keyed to store level already, so the matching problem disappears.
- **Cost:** five figures annually, realistically, for national retail coverage.
- **Trade-off:** redistribution rights need negotiating — showing figures to paying
  users is exactly the use vendors price for. But it is a price, not a prohibition.
- **Verdict:** the honest comparator. If option A plus a matcher rebuild approaches
  this cost, buy the data instead.

### H. Keep aggregates only

Delete store-level rows, keep brand and fascia medians.

- **Cures:** most of the exposure. An aggregate over hundreds of stores is a derived
  statistic, far more defensible than an address-attributable row.
- **Cost:** you lose the audit trail — and that is a real loss, not a theoretical one.
  Store-level evidence is how the concession defect was found (51 rows where we had
  recorded the host building's area, including a Benugo at 139,360 sq ft). Without it
  the next such defect ships silently.
- **It also directly contradicts** the admin visibility work in
  `store-floor-areas-import-plan.md` §6, which exists precisely to make store-level
  evidence inspectable.

---

## 6. Recommendation

1. **Today, free:** email MHCLG (F). Run the `pqi` query (E). Add OGL attribution
   wherever floor areas are displayed (fixes 3.5).
2. **This week, free:** stop the bleeding — drop `certificate_address` (3.1) and
   hold the `epc_certificates` table (3.7). Neither costs coverage; the column feeds
   nothing and the table is not built.
3. **Then decide with real numbers:** the `pqi` result tells you what option B is
   really worth. MHCLG's answer tells you whether option A is buyable. VOA (C) has
   now been checked and does not rescue us — its data is better, its licence is
   narrower — so the live choice is **A, E and G**, plus asking VOA for a bespoke
   licence in parallel.

**What I would not do** is keep the current arrangement while the product is being
prepared for launch. The enforcement risk is probably low. The commercial risk is
not: "which dataset is your headline feature built on, and under what licence?" is a
routine question in enterprise procurement and investor diligence, and the current
answer is one nobody wants to give.

---

## 7. What I am not certain about, and you should verify

- **The exact current wording of MHCLG's permitted purposes.** §2.4 of the assessment
  verified it on 2026-09-05. Re-read the terms actually shown at download; they change.
- **Scotland.** The statistics.gov.scot extract may be more permissively licensed than
  the E&W file, but its addresses have the same PAF ancestry. Nobody has checked.
  It affects roughly a tenth of the estate.
- **Whether an OS licence alone cures Layer 1.** My reading is that it does not,
  because MHCLG's terms are a separate contract. A lawyer should confirm.
- **Whether UPRN-postcode lookup datasets (e.g. ONS NSUL) are open to us.** If one is,
  it would let us narrow candidates by postcode using *our* postcode and an OGL
  lookup, never the certificate's — a cheap lift for option B. Worth ten minutes.
- ~~VOA floor-area availability and format.~~ **Checked 2026-09-06** against the VOA
  2026 data specification and the download page: bulk file confirmed, fields as listed
  in option C. The terms of use were read via a summarising fetch, not by hand —
  before relying on the quoted wording, read
  https://www.tax.service.gov.uk/view-my-valuation/terms-and-conditions directly.
- **All costs above are orders of magnitude, not quotes.**
