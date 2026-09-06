# Store floor areas from the EPC registers — findings and implementation plan

**Status:** revision 2 — not approved for implementation
**Date:** 2026-09-05
**Review:** Codex, 2026-09-05. Findings accepted; this revision responds to them.
Changes are marked **[R2]**.
**Scope of work so far:** read-only feasibility assessment. Nothing has been written to the database.

---

## 0. Summary for a reviewer

We tested whether the non-domestic EPC registers can supply floor areas for the
stores in `public.stores`. They can, for roughly half the estate, at a
**proxy-detected mismatch rate of ~3%** — but only if matching is done carefully.
Naive postcode matching returns a plausible-looking floor area for the wrong
building about half the time.

**[R2] That 3% is not a measured error rate.** It is the rate at which an
independent proxy (`stores.size_band`) can *detect* a mismatch, and the proxy is
one-sided. True error is higher and currently unquantified.

The assessment ran on **10 brands / 8,050 stores** chosen for deliberately
different formats. Result: **4,303 of 8,050 (53%)** carry a floor area we would
defend. This document records how that number was reached, what was validated
and how, then proposes how to (1) backfill all 43,070 stores, (2) keep the data
current, and (3) surface it in sitematcher-unified.

**[R2] Two blockers stand before any implementation:**

1. **Licensing (section 2.4).** EPC address and postcode fields are *not* OGL.
   They carry OS/Royal Mail terms restricting use to specified energy-related
   purposes. Commercial site matching is not among them. This was missed in
   revision 1 and is now the first go/no-go gate.
2. **Product/schema mismatch (section 9).** `requirements` is keyed to brand,
   holds a single integer, and describes what an occupier *wants*. EPC describes
   the *observed estate*. Revision 1 proposed writing estate statistics into the
   curated requirement field. That was wrong and has been withdrawn.

**What a reviewer should still challenge:** section 3.4 (accuracy evidence is
weaker than revision 1 claimed), section 6.2 (alias learning is untested and
tests recall, not precision), section 4.3 (the size gate filters on size), and
section 6.3 (the sample is 10 large, well-known brands).

---

## 1. The question

Can the non-domestic EPC register give us usable floor areas for stores in our
database, and for how many?

Original brief specified: query by postcode, filter to retail property types
(a1-a2, a3-a4-a5), attempt full-address match then fall back to postcode-only,
keep the most recent certificate by lodgement date, and report match rate,
per-brand distribution, and outliers above 3× the brand median.

---

## 2. What we found about the source

### 2.1 The endpoint in the brief is retired

`epc.opendatacommunities.org` 301-redirects to the MHCLG service. Current API:

| | |
|---|---|
| Host | `https://api.get-energy-performance-data.communities.gov.uk` |
| Search | `/api/non-domestic/search?postcode=…` |
| Certificate detail | `/api/certificate?certificate_number=…` |
| Auth | `Authorization: Bearer <token>` (not Basic) |
| Rate limit | 6,000 requests / 5 min per IP |
| Bulk download | `/api/files/non-domestic/csv/download` |

Token comes from the "My account" page after GOV.UK One Login.

**Floor area is not in the search response.** Search returns address, postcode,
`registrationDate`, `certificateNumber`. `floor_area` and `property_type` require
the per-certificate call, or the bulk CSV. We switched to the bulk CSV
(1,321,580 certificates) once it was available; it carries everything in one
place including `uprn` and `lodgement_date`.

### 2.2 Coverage is territorial, and the registers are separate

| Territory | Register | Bulk data? |
|---|---|---|
| England & Wales | MHCLG | Yes — 1,321,580 certs |
| Scotland | statistics.gov.scot (published by Scottish Government) | Yes — 91,981 certs, quarterly |
| Northern Ireland | GOV.UK search UI only | **No** |
| Channel Islands / IoM | none | n/a |

The Scottish register site prohibits automated access; the statistics.gov.scot
extract is the sanctioned route and is what we used.

**NI is genuinely blocked.** The GOV.UK "Find an energy certificate" service
covers NI, and `epbniregister.com` now redirects there — but NI data is not in
the open-data feed. Verified two ways: five NI postcodes queried against the API
all return 404 "no certificates found", and the bulk file contains **0 BT
records out of 1,321,580**. The only route is a data request to DoF NI.

### 2.3 Two data traps that silently destroy match rate

**Trap 1 — the register uses two names for the same use class.** Post-2020
certificates drop the Use Class prefix:

- `A1/A2 Retail and Financial/Professional services` (pre-2020 form)
- `Retail/Financial and Professional Services` (post-2020 form)

Filtering on the literal `A1/A2` from the brief would have discarded **21,186 of
60,946 retail certificates (35%)**. We match on the wording instead.

Scotland uses the post-2020 vocabulary exclusively, so the same filter works
there unchanged.

**Trap 2 — `stores.address_line_1` sometimes contains the town and postcode
inline** (e.g. `"308 Baker Street, Enfield, EN1 3LD"`). This inflated the
address-match denominator and rejected genuine matches. Stripping it took
address matches from 86 to 139 in the 200-store sample.

### 2.4 [R2] Licensing — the first gate

Verified against MHCLG's licensing guidance:

- **All fields except address and postcode are Open Government Licence v3.0.**
  That includes `floor_area`, `property_type`, `lodgement_date` and `uprn`.
- **Address lines 1–3 and postcode are restricted**, derived from Ordnance
  Survey and Royal Mail data. Permitted purposes are energy-related: property
  management promoting energy efficiency, research on building energy
  efficiency, evaluating improvements, marketing energy-efficiency programmes,
  EPB enforcement, local-authority building control, crime prevention.
- Any other use "requires an appropriate licence from Ordnance Survey."

Floor-area matching for a commercial property directory does not obviously fall
within the permitted purposes. MHCLG also notes address-level EPC data can be
personal data, which brings lawful-basis, retention and access-control duties.

**This must be resolved before any table is created.** Four options:

| Option | Coverage | Note |
|---|---|---|
| Obtain OS/PAF licence | 57% E&W | Preferred if commercially viable |
| Match transiently, retain no restricted fields | 57% at match time | Needs legal view on whether transient use is itself in-purpose |
| UPRN/geometry only — no EPC address or postcode | **21%** | Fully OGL; measured, see below |
| Non-address fields only, no matching | 0% | Not viable |

**The UPRN-only ceiling is measured, not estimated:** matching store coordinates
to certificate UPRN coordinates at ≤25 m yields **1,471 of 7,039 England & Wales
stores (21%)**, against 3,982 (57%) when address text is available. So the
licensing answer decides whether this feature is worth building at all.

(That measurement still used postcode to narrow candidates as an optimisation. A
compliant build would need a spatial index over all certificate UPRNs, which
should give a similar or marginally better figure.)

Whatever the outcome, `epc_certificates` must not sit readable in the exposed
`public` schema. It needs RLS, revoked anon/authenticated grants, and — if
restricted fields are retained at all — a documented retention and deletion
policy.

---

## 3. How the matcher was built, and what each step bought

Each step below was added because evidence demanded it, and each was measured.

### 3.1 The central problem: "matched" ≠ "correct"

A certificate came back for **92%** of stores. But postcode-only fallback
returns a real certificate, with a real floor area, for the shop next door or
the whole shopping centre. It fails silently.

Independent validation used `stores.size_band` (populated for 18,220 of 43,070
stores), which is not derived from EPC. EPC `floor_area` is gross internal area
while the band tracks sales area, so EPC running moderately high is expected;
falling **below** the band floor is not — the unit is too small to be that store.

Measured error by tier:

| Tier | Definition | Proxy-detected mismatch |
|---|---|---:|
| high | unit/house-number agreement, or brand named on cert, and no rival named | **3%** |
| medium | street name only, sole candidate on that street | 42% |
| low | street name with rivals, or postcode-only | ~50% |

**[R2] These are proxy-detected mismatch rates, not error rates.** `size_band` is
one-sided (it detects "too small", not a same-size wrong neighbour) and measures
sales area against EPC's gross internal area. The true error rate is unmeasured
and is higher than 3%. A manually labelled gold set is required before any
accuracy figure is published — see 6.3.

The medium tier was dropped from all downstream use once it measured 42% at
scale (n=91). Only `high` is counted as coverage.

### 3.2 Signals that make a match trustworthy

In precedence order:

1. **Unit or house-number agreement** — the store's number appears on the cert
2. **Brand name on the certificate** — near-conclusive; the register carries
   trading and legal names (`Aldi Foodstore Ltd`, `TJ Morris` for Home Bargains)
3. **Spatial agreement** — cert UPRN within 25 m of the store's rooftop coordinate

Plus two rejection rules:

4. **Rival operator named** → the certificate is the host building, not our unit.
   A Greggs at "58 High Street" matched `Tesco Stores Ltd, 58 High Street` —
   correct address, but 10,100 m² of Tesco. The Greggs is a concession inside it.
5. **Size implausible for the format** → see 4.3

### 3.3 Spatial matching, and why the radius is 25 m

Rather than guessing a radius, we calibrated it against matches already trusted:

| | Trusted matches | Unreliable matches |
|---|---:|---:|
| Median store↔cert distance | **8 m** | 82 m |
| p90 | 65 m | 251 m |

Then validated candidate radii against `size_band`:

| Distance | Error rate |
|---|---:|
| ≤25 m | **4%** |
| 25–50 m | 24% |
| 50–100 m | 32% |
| 100–150 m | 40% |

So the usable cutoff is **25 m**, not the 150 m originally assumed. Beyond that
you are picking a neighbouring unit. Geocode quality does not explain the
degradation — all the tested stores are `pqi = Rooftop`.

A **margin rule** also applies: the nearest candidate must be at least 25 m
clearer than the second nearest, so ambiguous geometry is declined rather than
guessed.

Inputs: `uprn` is on 89.8% of E&W certificates and 62.6% of Scottish ones
(`OSG_REFERENCE_NUMBER`); OS Open UPRN (OGL, free, 42M rows) resolves 99.9% of
the UPRNs we need to lat/lon.

### 3.4 Independent check on spatial accuracy

The 4% figure comes from `size_band`, which is a one-sided test — it detects
matches that are too small, not a wrong pick of similar size. So we ran a second,
fully independent test.

Take the 3,727 stores where **text** matching already gives a trusted answer, and
run spatial on them blind. It fired on 976 and picked the **same certificate 920
times (94.3%)**. Text and geometry are independent signals, so this measures
spatial accuracy without touching `size_band`.

We then checked whether that holdout generalises, expecting it to be optimistic
(easier stores). **The opposite is true** — the margin rule filters out crowded
geometry before spatial commits:

| | Candidates ≤50 m | Gap to runner-up |
|---|---:|---:|
| Holdout (text-matched) | 3.0 | 2 m |
| Where spatial is actually used | 1.0 | 65 m |

**[R2] Revision 1 called this "a conservative floor" on accuracy. That was
wrong** and the claim is withdrawn. Agreement between two matchers is not
correctness: both can be wrong together. Text and geometry are also only
partially independent — our store coordinate is geocoded from the store address,
and the certificate coordinate comes from AddressBase matching of the certificate
address, so both descend from address text, albeit through different pipelines
and reference data. Restricting to cases where both fire adds further selection
bias, only part of which the density comparison above addresses.

What the holdout supports is narrower: *where both methods fire, they agree 94.3%
of the time, on geometry harder than where spatial is deployed.* That is
encouraging, not a precision measurement.

Corroboration profile of the spatial matches in use: 68% carry the brand name,
18% are the sole candidate in range, **only 14% rest on distance alone**.

### 3.5 Spatial also corrects text matches

For 379 stores, spatial landed on a brand-named certificate where address
matching had picked a rival occupier at the same address:

| Store | Text picked | Spatial picked |
|---|---|---|
| Greggs, 385 Kirkstall Road | Iceland Foods Plc — 784 m² | **Greggs — 142 m²** |
| Iceland, Unit 11A The Junction | Dominos — 108 m² | **Iceland Foods Plc — 1,182 m²** |
| Iceland, 20-30 Bury Old Road | POUNDSTRETCHER — 1,546 m² | **Iceland Foods Plc — 1,032 m²** |

---

## 4. Bugs found and fixed (in order)

These matter for review because each changed the numbers materially.

### 4.1 Format-aware property types

The brief's retail-only filter discards trade counters, which are certificated as
what the building is: **B8 Storage or Distribution**. Screwfix went **27% → 60%**.

But relaxing it universally costs precision: for the other nine brands the extra
non-retail matches were 17% wrong against band, versus 3% for retail-only. So
the filter is **per format**, not global:

| Format | Admissible classes |
|---|---|
| trade-counter | retail, food, warehouse, industrial, office |
| retail-warehouse | retail, food, warehouse |
| standard | retail, food |

Screwfix's added matches were validated distributionally (they have no
`size_band`): median 514 m² vs 543 m² for the ones already matching, IQR 412–718
vs 409–744. Two independent subsets converging on the same distribution.

### 4.2 Digits inside proper names read as house numbers

A McDonald's at `"Junction 1 Retail Park"` matched `"Unit 1, Junction One Retail
Park"` — 9,672 m² — because the "1" in the park's *name* was treated as a street
number.

Fix: house numbers are only recognised at the start of an address component or
after `Unit/No/Block/Suite/Plot`. **Rejection still uses the broad rule** (any
number disagreement remains suspicious); only positive corroboration got
stricter, so nothing new slips through.

Effect: McDonald's-in-retail-parks CV **1.73 → 0.76**; max 9,672 → 3,506 m².

### 4.3 No size sanity check

A certificate can agree on address and still describe the host building. Matches
are now tested against a size profile built **only from certificates that name
the brand** (effectively self-verifying), grouped by `(brand, fascia)`, and
rejected outside a 3× band. 274 demoted.

**This cannot be validated with size-based metrics — it filters on size.** The
independent evidence is `size_band`: of the 131 demotions it can check, **103
(79%) are confirmed out-of-band**.

| Direction | Count | Checkable | Confirmed wrong |
|---|---:|---:|---:|
| Too large for format | 71 | 18 | 18 (100%) |
| Too small for format | 203 | 113 | 85 (75%) |

**Residual risk:** roughly a quarter of the "too small" group may be genuine small
units (a Greggs kiosk at 32 m²) rather than mismatches. They are demoted, not
deleted — `size_plausibility = implausible_for_format`.

### 4.4 Territorial filter excluded English stores

TD is a Scottish postcode area, but **TD15 is Berwick-upon-Tweed, England**. Seven
stores were wrongly written off; against the English register they match at 86%.

Lesson for implementation: **do not filter by postcode area.** Attempt every
store against every register and let "no certificate found" be the answer.
Postcode area is useful for *explaining* failures, not for gating.

---

## 5. Current results

### 5.1 Coverage

| Territory | Stores | Trusted | Rate | Source |
|---|---:|---:|---:|---|
| England & Wales | 7,046 | 3,982 | 57% | MHCLG bulk |
| Scotland | 793 | 321 | 40% | statistics.gov.scot |
| Northern Ireland | 199 | 0 | 0% | no bulk data |
| Channel Islands / IoM | 12 | 0 | 0% | no register |
| **Total** | **8,050** | **4,303** | **53%** | |

Progress across the phase: 44% → 47% (format-aware types) → 53% (spatial) →
57% (Scotland) → 53% (after the size gate removed 274 bad matches).

Scottish precision is worse than E&W (7% vs 3% before the size gate), most
likely because UPRN coverage is 63% vs 90%, so fewer matches get spatial
corroboration.

### 5.2 How the trusted matches were established

| Signal | Stores |
|---|---:|
| House-number agreement | 1,793 |
| Unit agreement | 692 |
| Spatial (≤25 m) | 557 |
| Street name only + brand named | 1,261 |
| *(of all the above, cert names the brand)* | *2,521* |

### 5.3 Per-brand distributions

| Brand | n | Median m² | CV |
|---|---:|---:|---:|
| Aldi | 646 | 1,686 | 0.18 |
| Wickes | 139 | 2,619 | 0.25 |
| Lidl | 588 | 1,774 | 0.28 |
| Primark | 50 | 4,573 | 0.36 |
| Iceland | 493 | 882 | 0.37 |
| Screwfix | 502 | 540 | 0.41 |
| McDonald's | 1,002 | 380 | 0.42 |
| Home Bargains | 123 | 1,483 | 0.47 |
| Greggs | 460 | 124 | 0.51 |
| Marks and Spencer | 300 | 2,551 | 0.92 |

### 5.4 Variance decomposes by fascia — but much less than it first appeared

This was measured twice, and the second measurement corrected the first.

**Before the size gate**, splitting by fascia or retail-centre form looked
broadly useful: M&S 1.07→0.58 (fascia), McDonald's 0.92→0.67 (both), Home
Bargains 0.75→0.66 (centre form), Greggs 0.89→0.79 (centre form).

**After the size gate (4.3) removed the bad matches, most of that effect
disappeared:**

| Brand | CV brand-level | by fascia | by centre form | by both |
|---|---:|---:|---:|---:|
| Marks and Spencer | 0.92 | **0.44** | 0.92 | 0.43 |
| McDonald's | 0.42 | 0.33 | 0.36 | **0.33** |
| Iceland | 0.37 | 0.36 | 0.36 | 0.35 |
| Home Bargains | 0.47 | 0.47 | 0.45 | 0.45 |
| Greggs | 0.51 | 0.51 | 0.51 | 0.51 |

**Interpretation:** what looked like retail-centre format variance was largely
contamination concentrated in particular centre types — bad matches cluster in
retail parks, where anchor units get picked instead of our unit. Once those are
removed, centre form adds almost nothing.

**Fascia remains genuinely valuable, but essentially only for M&S** (0.92→0.44)
and modestly for McDonald's (drive-thru 352 m² vs standard 583 m²). Iceland,
Home Bargains and Greggs are adequately described at brand level once clean.

This matters for section 9: the product should split on **fascia**, and should
not bother modelling retail-centre form.

M&S by fascia (post-fix):

| Fascia | n | Median m² | IQR |
|---|---:|---:|---|
| Marks and Spencer (full-line) | 142 | 6,882 | 4,976–9,344 |
| MSA (motorway services) | 5 | 2,849 | 2,812–3,115 |
| Simply Food | 94 | 1,455 | 1,070–1,700 |
| Foodhall | 56 | 1,395 | 1,153–1,625 |

Retail-centre form came from point-in-polygon against the GeoDS boundaries
already in the repo (`retail_centre_geometries`, 9,623 centres), collapsed to
high street / retail park / shopping centre / isolated. It proved more useful as
a diagnostic than as a product dimension.

**Subgroup CV works as a contamination detector** — it is what surfaced the bug
in 4.2. McDonald's-in-retail-parks showed CV 1.73 while every sibling subgroup
sat between 0.34 and 0.57. A subgroup whose CV is far above its siblings is
usually contaminated rather than genuinely variable. Worth keeping as a standing
data-quality check after each backfill.

### 5.5 A hard ceiling

**756 stores have no certificate at all.** An EPC is only created when a building
is constructed, sold or let — a store trading in the same unit for twenty years
never generates one. No matching improvement reaches those. This is the main
argument for evaluating the VOA rating list (section 8).

### 5.6 [R2] Certificate recency and prior occupiers

Raised in review and now measured. A brand-named certificate is evidence that the
brand was *at some point* at that address, not that it is there now.

Certificate age of trusted matches:

| Age | Share |
|---|---:|
| 0–3 years | 39% |
| 4–7 years | 32% |
| 8–11 years | 24% |
| 12+ years | 6% |

Of the 728 trusted matches where the store has an `open_date`, **83 (11%) have a
certificate predating the store's opening** — a prior occupier's certificate.

**Nuance the review did not draw:** a prior-occupier certificate for the *same
unit* still yields the correct floor area. The error case is narrower — the brand
moved units within the same postcode and we matched the old one. Conversely, the
rival-operator rejection (3.2 rule 4) may be discarding correct certificates where
the rival is a *former* tenant of our unit, which costs coverage rather than
precision.

Neither effect is currently modelled. Implementation needs certificate lineage
(`relatedRrn` is available), removal/supersession state, and comparison against
`stores.open_date` where present.

---

## 6. Plan: backfilling all 43,070 stores

### 6.1 Move the pipeline into Postgres

The assessment ran as local Python over files. That should not be the production
shape. The database is already equipped:

- `pg_trgm` enabled (migration 043)
- `stores.location` is `geography` with a GIST index
- PostGIS in use for existing spatial functions

**Proposed:** load the registers into `public.epc_certificates` (~1.41M rows —
modest for Postgres). Postcode lookup becomes an index scan, spatial matching
becomes `ST_DWithin`, and the whole match is re-runnable SQL with no local files.

```sql
-- [R2] source-scoped identity; certificate numbers are not globally unique
-- across registers. RLS on, anon/authenticated grants revoked.
CREATE TABLE public.epc_certificates (
  source             text NOT NULL CHECK (source IN ('epc_ew','epc_scotland')),
  certificate_number text NOT NULL,
  import_run_id      uuid NOT NULL REFERENCES public.epc_import_runs(id),
  postcode_norm      text,                    -- restricted field, see 2.4
  address_norm       text,                    -- restricted field, see 2.4
  property_type      text,
  property_class     text CHECK (property_class IN
                       ('retail','food','warehouse','industrial','office')),
  floor_area_m2      numeric,
  lodgement_date     date,
  uprn               bigint,
  geom               geography(Point,4326),
  related_rrn        text,                    -- certificate lineage
  removed_at         timestamptz,             -- from /api/deltas
  superseded_by      text,
  PRIMARY KEY (source, certificate_number)
);

-- provenance of each ingest
CREATE TABLE public.epc_import_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source        text NOT NULL,
  snapshot_ref  text NOT NULL,   -- file name / date window
  checksum      text,
  row_count     integer,
  status        text NOT NULL CHECK (status IN ('running','complete','failed')),
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz
);

-- immutable match runs; results are never overwritten in place
CREATE TABLE public.epc_match_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matcher_version text NOT NULL,
  config          jsonb NOT NULL,   -- thresholds, aliases, admissibility
  import_run_id   uuid NOT NULL REFERENCES public.epc_import_runs(id),
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  status          text NOT NULL
);

CREATE TABLE public.store_floor_area_matches (
  match_run_id    uuid NOT NULL REFERENCES public.epc_match_runs(id) ON DELETE CASCADE,
  store_id        uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  source          text,
  certificate_number text,
  floor_area_m2   numeric,
  lodgement_date  date,
  confidence      text NOT NULL CHECK (confidence IN ('high','medium','low','none')),
  match_method    text NOT NULL CHECK (match_method IN
                    ('address','brand','spatial','postcode-single',
                     'postcode-ambiguous','none')),
  address_corroboration text,
  brand_on_certificate  boolean,
  spatial_distance_m    numeric,
  size_plausibility     text,
  candidates      jsonb,            -- rejected candidates + why
  PRIMARY KEY (match_run_id, store_id)
  -- deliberately no FK to epc_certificates: certificates can be removed from
  -- the register, and historical match runs must remain readable
);

-- what the product reads
CREATE VIEW public.store_floor_areas_current AS
  SELECT m.* FROM public.store_floor_area_matches m
  JOIN public.epc_match_runs r ON r.id = m.match_run_id
  WHERE r.status = 'complete'
    AND r.id = (SELECT id FROM public.epc_match_runs
                WHERE status='complete' ORDER BY finished_at DESC LIMIT 1);
```

**[R2] Why this shape.** Revision 1 keyed results on `store_id` alone, so a
re-run had to overwrite and no one could explain why a match changed. Runs are
now immutable and comparable: you can diff two matcher versions, keep rejected
candidates as evidence, and survive certificate removal without breaking a
foreign key. Certificate identity is source-scoped because E&W and Scottish
numbering are separate namespaces.

### 6.2 The scaling blocker, and the proposed unlock

**The matcher is hand-tuned for 10 brands.** Three things are hardcoded: brand
aliases, the rival-operator list, and the format→property-type mapping. That
does not scale to 246 brands.

**Proposal — learn all three from the data.** Run a first pass using *only*
address matching with unit/house-number corroboration and no brand signal. For
each brand, collect the operator-name tokens appearing on those certificates.
Tokens recurring far above chance for one brand are that brand's EPC alias. This
discovers `TJ Morris` → Home Bargains without anyone typing it.

The same table then generates the rival-operator list for free: a rival is any
*other* brand's learned alias. Likewise property types — if >20% of a brand's
confident matches are B8, admit warehouse for that brand rather than a human
deciding Screwfix is a trade counter.

```sql
CREATE TABLE public.brand_epc_aliases (
  brand_id     uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  alias_tokens text[] NOT NULL,
  support      integer NOT NULL,     -- certs supporting this alias
  origin       text NOT NULL,        -- 'learned' | 'manual'
  approved     boolean NOT NULL DEFAULT false,
  PRIMARY KEY (brand_id, alias_tokens)
);
```

**[R2] This is untested, and revision 1's validation proposal was inadequate.**
Rediscovering known aliases on the same ten brands tests *recall*, not
*precision* — it cannot show how often the method invents a false alias. Guards
required before it is trusted:

- **Minimum support and enrichment** — an alias must appear on enough
  certificates *and* be disproportionately associated with one brand versus all
  others, not merely frequent.
- **Score whole normalised phrases**, not token arrays, so common legal and
  address tokens (`LTD`, `HOUSE`, `RETAIL PARK`) cannot become aliases.
- **Stopwords and negative evidence**, maintained explicitly.
- **Model brand relationships.** The "every other brand's alias is a rival" rule
  breaks for parent companies, franchises, concessions and sub-brands. A Greggs
  concession inside a Tesco is a genuine case where both names are correct.
  Needs a parent/sub-brand/franchise relation, not a flat rival set.
- **Validate on held-out brands**, with manual review of the highest-impact
  aliases.
- **Keep property-class admissibility as approved configuration** until learning
  is demonstrably safe. The `>20% B8` heuristic is vulnerable to small samples
  and to already-contaminated matches — it would happily learn from its own
  errors.

### 6.3 [R2] Gold set, then a stratified pilot with gates

Revision 1 proposed a random sample of long-tail brands. That is not enough: a
random draw over-represents tiny brands and under-represents the formats that
account for most stores.

**First, build a manually labelled gold set.** Nothing in this document is a
measured accuracy figure — every number is proxy-detected (4.3). A gold set is
the only way to state precision honestly. Stratify by territory, format, centre
type, match method, brand estate size and certificate age; label by inspecting
the certificate against the store. Report precision **per tier with confidence
intervals**.

**Then a stratified pilot**, weighted back to the full store population, with
predefined gates agreed before it runs:

| Gate | Purpose |
|---|---|
| Minimum manually verified precision for any user-facing aggregate | stops publishing untrustworthy figures |
| Minimum sample count per fascia profile | stops profiles built on 3 stores |
| Maximum stale-record rate | forces the refresh job to actually work |
| Automatic suppression below threshold | fails closed, not open |

Our 10 brands were deliberately chosen as large, well-known chains whose names
appear on certificates. A three-store regional brand will match worse. **53% is
probably optimistic for all 43,070 stores**, and the pilot is the go/no-go for
everything downstream.

### 6.4 [R2] Revised sequence

Licensing moves to the front; nothing else starts until it resolves.

1. **Resolve EPC / OS / Royal Mail licensing and the data-protection position**
   (2.4). Decides whether coverage is 57% or 21% — or zero.
2. **Commit a reproducible evaluation harness** (see 11.8) and build the
   manually labelled gold set (6.3).
3. **Stratified national pilot** against predefined precision and coverage gates.
4. **Storage**: source snapshots, immutable match runs, aggregate profiles as
   separate concerns (6.1).
5. **Queued refresh and import processing** with monitoring and recovery (7.1).
6. **Ship brand/fascia aggregate ranges first.** Retain curated requirements
   untouched; keep store-level values admin-only until precision is established.


---

## 7. Plan: keeping it current

Two distinct flows.

### 7.1 [R2] New stores — queued, not inline

Revision 1 proposed running matching inline in the import route under the
existing `rebuild_lock`. Both parts were wrong, and both were verified in review:

- **`rebuild_lock` is not a generic job lock.** `is_rebuild_running()` and its
  siblings hard-code `lock_name = 'bua_summary_rebuild'`
  (`supabase/migrations/042_create_rebuild_lock_table.sql:24`). Reusing it would
  couple EPC matching to BUA rebuilds.
- **The import route already starts the BUA rebuild fire-and-forget**
  (`apps/web/src/app/api/admin/stores/import/upload/route.ts:759`). Adding a
  second inline responsibility makes failures harder to retry.

**Replacement:** on successful insert, enqueue store ids. A separate idempotent
worker leases batches, matches them, and records retry state with a dead-letter
status.

**[R2] Geocode quality gate.** The import route writes `pqi: null`
(`upload/route.ts:752`). The 25 m spatial threshold was calibrated entirely on
`pqi = 'Rooftop'` stores, so it is not justified for coordinates of unknown
provenance. The worker must therefore record geocoder and positional accuracy,
and **decline spatial-only acceptance when coordinate quality is unknown** —
falling back to address/brand evidence for those stores until quality is known.

### 7.2 Register refreshes

Verified constraint: **`/api/deltas` reports only removals and UPRN changes, not
new certificates.** So two mechanisms are needed:

| What | Mechanism | Cadence |
|---|---|---|
| New E&W certificates | search by date window, **then `/api/certificate` per result** | weekly |
| Removals / UPRN changes | `/api/deltas` | weekly |
| Scotland | re-import quarterly extract | quarterly |
| Full bulk reconciliation | re-download bulk CSV | monthly |

**[R2] Revision 1 omitted the detail fetch.** Section 2.1 already records that
search returns no `floor_area` or `property_type`, but the refresh design only
called search — an internal contradiction. Each new certificate needs a
subsequent `/api/certificate` call before it can be matched.

**[R2] Other constraints the design must handle:** results paginate above 5,000;
`date_end` cannot be today; 429s require backoff. So the job needs durable
watermarks, deliberately overlapping date windows, full page traversal, staging
tables validated before atomic publication, resumable failure recovery, and
reconciliation against the bulk file **monthly** rather than annually — annual
was too loose given removals and supersessions accumulate.

### 7.3 Matcher changes

When the matcher itself changes, bump `matcher_version` and re-run. The job must
be idempotent.

---

## 8. Beyond EPC

- **VOA rating list** — every non-domestic property is rated, so it has no
  equivalent of the 756-store trigger gap. Free but **restricted licence**, not
  OGL: data may be passed to third parties only if the same terms are conveyed.
  Using it as an internal verifier is a different proposition from shipping
  VOA-derived areas in the product. Needs a licensing decision before any
  technical work. Scottish equivalent: SAA.
- **NI** — data request to Department of Finance NI (199 stores).
- **Our own address data** — Home Bargains sits at 26% because our records name
  the estate ("Essington Way Retail Park") while certificates name the unit
  ("Unit 4"). That is our data quality, not the register's.

---

## 9. Plan: surfacing it in sitematcher-unified

### 9.1 [R2] Do not write into `requirements` — withdrawn

Revision 1 proposed computing `requirements.size_seen_sqft`. That was wrong on
three counts, all raised in review and all verified:

1. **Conceptual.** `requirements` describes what an occupier *wants*.
   EPC describes the *observed estate*. They are different things and should not
   share a field. `UBrandProfile.tsx` renders them as adjacent tiles — "Stated
   requirement" beside "Size seen in market" — so conflating them is worse than
   cosmetic.
2. **Structural.** `requirements` is keyed by `brand_id` only (migration
   `20260711000000`), with no fascia. `size_seen_sqft` is a single integer. There
   is nowhere to put an IQR or per-fascia profiles.
3. **A unit error in revision 1.** The example basis line read
   `IQR 4,976–9,344 sq ft`. Those figures are M&S **m²**. In sq ft the range is
   approximately **53,600–100,600**. The error is instructive: m²/sq ft confusion
   is the most likely way this feature ships something badly wrong, so conversion
   belongs in one place with tests, not in prose.

**Replacement:** a separate, generated table, leaving curated requirements alone.

```sql
CREATE TABLE public.brand_floor_area_profiles (
  brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  fascia_id       uuid REFERENCES public.fascias(id) ON DELETE CASCADE,  -- NULL = brand level
  p25_m2          numeric NOT NULL,
  median_m2       numeric NOT NULL,
  p75_m2          numeric NOT NULL,
  sample_count    integer NOT NULL,
  measurement     text NOT NULL,      -- 'gross_internal_area'
  source          text NOT NULL,      -- 'epc_ew+epc_scotland'
  match_run_id    uuid NOT NULL REFERENCES public.epc_match_runs(id),
  generated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (brand_id, fascia_id)
);
```

The UI then shows the observed range as its own element, clearly separated from
the stated requirement, with sample count and measurement basis attached.

### 9.2 Three rules the evidence imposes

**Compute at fascia level, display at whichever level is honest.** "M&S needs
6,882 m²" is badly wrong for a Simply Food, so multi-format brands must be split.
But per 5.4, that is a real effect for M&S and (mildly) McDonald's — most brands
are adequately described at brand level once the data is clean. Recommended rule:
compute per fascia always, and collapse to brand level for display only when the
fascia medians are within ~20% of each other. Do not model retail-centre form.

**Show a range, not a point.** CVs sit at 0.18–0.51 even after all fixes. A
single figure implies precision we do not have; the IQR is the honest unit.

**Convert in one place.** m² → sq ft (×10.7639) belongs in a single tested
helper, never inline. See the revision-1 error above.

### 9.3 The labelling risk

EPC floor area is **gross internal area**, not sales area. Retail users read
"size" as NIA/sales area, and GIA runs materially larger. `UBrandProfile.tsx`
renders the stated requirement and the observed figure side by side, which
actively invites the comparison.

Mitigation: label the measurement basis on the tile itself, and treat
"requirement vs observed" as two different measurements rather than two numbers
on the same scale. This is a product decision, not a data one.

### 9.4 [R2] Store level — admin only, initially

Show a store-level figure only for `confidence = 'high'`, and only in admin
views until precision is established against a labelled gold set (6.3). Ship
brand/fascia aggregates to users first. Do not expose a confidence score — a
number with a caveat gets quoted without the caveat.


## 10. [R2] Open decisions

Ordered by what blocks what.

| # | Decision | Owner | Blocks |
|---|---|---|---|
| 1 | **Can we licence EPC address/postcode for this use?** (2.4) | Legal / commercial | Everything. 57% vs 21% vs nothing |
| 2 | Data-protection position on address-level EPC data — lawful basis, retention, deletion | Legal | Schema, RLS, retention policy |
| 3 | Store-level figures exposed, or aggregates only? | Product | 9.4 — recommend admin-only initially |
| 4 | GIA vs sales-area labelling in `UBrandProfile` | Product | 9.3 — actively misleading if unresolved |
| 5 | Acceptance gates for the pilot (precision floor, min sample per fascia) | Product + eng | 6.3 |
| 6 | VOA rating list — restricted licence, needs the same legal review as (1) | Legal | 8 |
| 7 | NI: data request to DoF NI, or accept the 199-store gap | Product | 8 |

**Recommendation:** do not start engineering work until (1) and (2) are answered.
The UPRN-only fallback delivers 21% coverage, which may not justify the build —
that is a commercial judgement, and it should be made before, not after, the
schema exists.


---

## 11. Known weaknesses in this work

Stated plainly so a reviewer can attack them:

1. **The sample is 10 large, well-known brands.** Long-tail brands are untested
   and will very likely be worse. Section 6.3 exists for this reason.
2. **Alias learning (6.2) is a proposal, not a tested method.**
3. **The size gate (4.3) filters on size**, so size-based metrics cannot validate
   it. `size_band` corroborates 79% of demotions; the rest are unverified.
4. **All precision figures rest on `size_band`**, available for 18,220 of 43,070
   stores. Whether that subset is representative is unverified.
5. **The 25 m spatial threshold was calibrated on this estate**, not derived from
   anything universal. It should be re-checked for different formats.
6. **`size_band` measures something different from EPC floor area** (sales area
   vs GIA). It is a good test for "wrong building", a poor test for "exactly
   right area".
7. **Scotland is validated on a smaller base** (187 checkable) and is measurably
   worse than E&W.
8. **[R2] The assessment is not reproducible from this repository.** The matcher,
   profiles and evidence live in an uncommitted session scratchpad, so no
   reviewer can reproduce the 53%, inspect false positives, or confirm the fixes
   exist. Before implementation, commit a sanitised, versioned evaluation package
   — matcher code, configuration, tests, dataset snapshot dates and checksums,
   aggregate outputs and a review sample — **excluding restricted address data**
   (2.4).
9. **[R2] No measured accuracy figure exists anywhere in this document.** Every
   number is proxy-detected mismatch or inter-matcher agreement. Until the gold
   set exists, no precision claim should be published or quoted externally.
10. **[R2] Certificate lineage, removals and supersession are unmodelled**, and
   11% of datable matches use a certificate predating the store's opening
   (5.6).
11. **[R2] Spatial thresholds are unjustified for newly imported stores**, which
   are written with `pqi = null` (7.1).

---

## Appendix: artefacts from the assessment

Working files are in the session scratchpad, not committed:

| File | Contents |
|---|---|
| `epc_profiles.csv` | 8,050 stores × 35 columns — every match, evidence, and flag |
| `SUMMARY_FIXES.md` | the three bug fixes and their measured effect |
| `SUMMARY_PROFILES.md` | fascia / retail-centre variance decomposition |
| `SUMMARY_NATIONAL.md` | territorial coverage |
| `matchlib.py` | normalisation, corroboration, aliases, admissibility |

External data used: MHCLG non-domestic bulk CSV (1,321,580 certs), Scottish
non-domestic extended historic extract (91,981 certs), OS Open UPRN (42M, OGL),
GeoDS retail centre boundaries (9,623, already in repo).

---

## 11. [2026-09-06] Known defect: concession / host-building matches

A concession trades inside somebody else's building — a Benugo café inside John Lewis,
a Vets4Pets inside a Pets at Home, an MFG EV bay in a Morrisons car park. It shares a
postal address with its host, and the host is who lodges the EPC. The matcher finds that
certificate, agrees on the street number, grades the row `high`, and records the host's
floor area:

| store | recorded | reality |
|---|---|---|
| Benugo John Lewis Oxford | 139,360 sq ft | the John Lewis |
| Mfg Ev Power Morrisons Weybridge | 123,322 sq ft | the Morrisons |
| Vets4Pets Inside Pets At Home, 159 Sir Henry Parkes Rd | 41,086 sq ft | the Pets at Home |

`confidence` cannot catch this and is not wrong not to — it grades whether the certificate
identifies the premises at that address, and it does. The unasked question is whether the
resulting number is credible for the format. That is what `size_plausibility` is for.

The matcher does answer it, partially: run `epc-2026.09.05-allbrands` demoted 2,027 rows
that fell outside 3x their brand/fascia median. It cannot see a concession, because it
anchors on the fascia's own median and a fascia polluted by concessions inflates the very
baseline meant to catch them — hence the category ceiling below, and hence the iteration.
Those 2,027 rows also left the column carrying two vocabularies for one idea; the
migration normalises them to `implausible` and adds the CHECK constraint the original
table declaration lacked.

**Migration `20260908000000_demote_concession_floor_area_matches.sql` corrects the data**
(51 of 19,111 high-confidence rows, 0.27%) and carries the rule in full. It is a
corrective pass over one matcher run — **the rule still needs porting into the matcher**,
which lives outside this repository, or the next run reintroduces the same rows.

The rule, in brief. A high-confidence row is implausible when the certificate does not
name our brand (`brand_on_certificate IS NOT TRUE`) and the area is grossly out of scale:

- **against its own format** — more than 4x the median of its *fascia* profile, where that
  profile rests on at least 20 stores. Fascia, never brand: Morrisons' brand-level median
  is 2,669 sq ft because 660 Morrisons Daily shops outvote the supermarkets.
- **against its category** — for a store with no trusted format baseline, more than 8x the
  category's 99th percentile. Deliberately extreme: at 8x it catches Benugo (21x) and
  leaves IKEA Oxford Street (4.8x), UNIQLO Manchester (1.5x) and Costco Leicester (1.03x)
  alone. Category ceilings are built only from stores that *do* have a trusted baseline,
  so concessions cannot inflate the ceiling meant to catch them.

Applied iteratively: a bad row inflates the very median it is judged against, so each pass
rebuilds the affected profiles and looks again. Converges after two demoting passes.

**Rejected — matching the host's name inside our own store name.** It reads as the obvious
signal and is not safe: "TK Maxx, Willow Place Shopping Centre" matches the brand Willow,
"Co-op Wells Next The Sea" matches Next, "Tesco Lichfield Three Spires Express" matches
Three. The harm is only ever an implausible area, so the test is anchored on area.

**Still unfixed, for whoever picks this up.** The test only catches gross outliers. "Slim
Chickens 226 Bishopsgate" at 47,469 sq ft is almost certainly the host building too, but
at 4.7x its category ceiling it sits below the threshold, and lowering the threshold far
enough to catch it would start demoting real flagship stores. A matcher-side fix — reading
`certs_at_address > 1` together with `brand_on_certificate = false` at match time, where
the candidate certificates are still in hand — would separate these properly. The
database-side rule cannot, because by then only the chosen certificate survives.
