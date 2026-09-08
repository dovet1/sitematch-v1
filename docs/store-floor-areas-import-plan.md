# Store size in the import flow, and visible on the admin side

**Status:** proposal, not started — revision 2
**Date:** 2026-09-07 (revised; first written 2026-09-06)
**Depends on:** `docs/store-floor-areas-plan.md` (the assessment), `scripts/epc/` (the matcher),
migrations `20260907000000` and `20260908000000` (the tables and the concession fix)
**See also:** `docs/epc-licensing-brief.md` — the licensing position and the options

**Revision 2 changes:** §3 loads the full register and stores certificate coordinates;
§4.4 is new and finds our coordinates are far better than the matcher believes; §5 fixes
two ordering and constraint bugs that would have broken the first rebuild; §9 reorders so
the cheap evidence comes first.

---

## 0. Progress — updated 2026-09-08

**Steps 0–6 are done and verified against real data.** The three admin screens are built,
the import route records geocode quality and hands over to the matcher, and both defects
in §9 are fixed. Verified 2026-09-08 against the live database: the health page in
0.26–1.4s with every figure cross-checked, the brand tab reproducing Tesco's published
profiles (Express 3,950 sq ft, Extra 105,201, brand-level a useless 4,801), and the
evidence view showing a demoted Tesco Express matched to "Wonder Wok, 89 Bath Road" —
the concession failure mode, legible in one screen.

The health page's first version counted certificates live and died on the 8s statement
timeout every time. Measured: a count over `epc_certificates` runs 0.2s warm and past 8s
cold, and `count(*) FILTER (geom IS NOT NULL)` runs 2.5–3.3s however warm it is, because
the rows carry four token arrays each. `20260914000000` moved those figures onto the load
run that established them — they cannot change until the next load. Both migrations are
applied.

| Step | State |
|---|---|
| 0 Confirm coordinate-quality counts | done — every store carries `pqi='Rooftop'` or a `google_place_id`; none lack both |
| 1 Holdout test | done — §4.5. Overturned the one-line gate widening; spatial stays out of v1 |
| 2 Register in the database | done — 1,321,580 E&W certificates, 89.9% with `geom`, load run complete |
| 3 SQL maintenance functions | done — self-test passed: 0 demoted, 330 profiles reproduced exactly |
| 4 Match state, matcher, cron | done — cron verified end to end on 10 cleared rows: 10/10 restored, 8/10 byte-identical |
| 5 Admin screens | done — §6.1 health page, §6.2 store evidence view, §6.3 brand floor-areas tab, all verified against live data |
| 6 `pqi` on import, two code fixes | done — Mapbox accuracy written through, completion-screen handover line, `geocode_needs_review` wired, STORE_IMPORT_IMPLEMENTATION.md corrected |

**Applied migrations:** `20260909000000` (epc_certificates, epc_load_runs, epc_delete_source),
`20260910000000` (demote + rebuild functions), `20260911000000` (match_attempts, last_error,
epc_match_runs), `20260912000000` (epc_stores_awaiting_match).

`20260913000000` (`epc_pipeline_health()` — the single read behind the health page;
every panel on it is an aggregate and PostgREST cannot group), superseded by
`20260914000000` — `with_geom` and `newest_certificate` on `epc_load_runs`, a one-off
backfill of both, and the function rewritten to read no certificates at all and to make
three passes over `stores`/`store_floor_areas` where it made eight.
`load_certificates.py` now records both figures at load time, so no future load needs the
backfill.

**Code added:** `apps/web/src/lib/epc/{normalise,aliases,classes,match}.ts`,
`apps/web/src/app/api/cron/match-store-floor-areas/route.ts`,
`scripts/epc/{load_certificates,holdout_spatial,dump_normalise_fixture}.py`.
The import route now triggers matching fire-and-forget; the cron is the backstop (§4.1 [R3]).

**Admin screens:** `apps/web/src/app/admin/stores/floor-areas/` (§6.1 health page and
`RunMatchButton`), `apps/web/src/app/admin/stores/[id]/` (§6.2 evidence view),
`apps/web/src/app/admin/brands/components/FloorAreasSection.tsx` (§6.3 tab) with
`api/admin/brands/[id]/floor-areas`, plus `api/admin/stores/floor-areas/run-match` (the
"Run now" trigger — an admin-gated call to the cron route, not a second matcher).
Shared: `lib/epc/profile-eligibility.ts` — the one implementation of "does this store
reach a user, and if not why not", used by §6.2 and §6.3 and unit-tested; and
`lib/epc/display.ts` for formatting. Types in `types/floor-area-health.ts`.

**Step 6, in the import route:** `pqi` now carries Mapbox's own accuracy grade, written
verbatim in Mapbox's vocabulary (`rooftop`, `street`, …) and deliberately NOT normalised
to the existing `Rooftop` — that population's 25m calibration was measured on it alone,
and renaming into it would enrol new stores in a calibration never measured for them.
`geocode_needs_review` now records something real (a coordinate that skipped the Google
check, or a coarse geocode) instead of a hardcoded `false`. The completion screen reports
how many stores were queued and links to the health page.

**Tests:** `npx jest src/lib/epc` — 43 tests (33 matcher, 10 profile-eligibility). The conformance test needs
`EPC_CONFORMANCE_URL` / `EPC_CONFORMANCE_KEY` (not the usual names: `jest.setup.ts` pins
Supabase to localhost so unit tests cannot reach a real database). It measures the
TypeScript matcher against matchall.py's committed answers: **99.7% same certificate**.

**What the health page needs to read**, all of it already present:
`epc_load_runs` (register freshness), `epc_match_runs` (last run, tier counts, duration,
status), `epc_stores_awaiting_match()` (queue depth), `store_floor_areas.last_error` +
`match_attempts` (dead letters), and `stores.pqi` / `google_place_id` for the
coordinate-quality split. One new thing is needed: a "Run now" trigger, which is just an
authenticated call to the cron route.

**Also fixed along the way:** the `build_config.py` alias normaliser bug (see
`scripts/epc/README.md`) — 9 dead aliases, 4 brands with no brand signal, now 0 and 0.

---

## 1. Where we are

| | |
|---|---|
| Floor areas exist | `store_floor_areas`, 19,111 high-confidence rows from run `epc-2026.09.05-allbrands` |
| Aggregates exist | `brand_floor_area_profiles`, read by `/api/public/brands/floor-area-profiles` and shown in the Assess-Area size panel |
| The matcher exists | `scripts/epc/`, Python, run by hand on a laptop against ~1.4M certificates in `~/Downloads` |
| New stores get nothing | the import route (`api/admin/stores/import/upload/route.ts`) inserts stores and never touches floor areas |
| Nobody can see any of it | there is no admin screen for floor areas at all |

So a store imported today is invisible to the size filter, permanently, until
somebody remembers to re-run Python. And nothing in the product says so.

Three gaps to close: **match new stores**, **make the pipeline legible**, **keep the
register fresh**. In that order, because the second is what makes the first
trustworthy and the third is what stops it rotting.

---

## 2. The shape

One rule, and everything else follows from it:

> **The certificates live in the database. Matching a store is then a small
> database job. The admin screens are just views over the tables it writes.**

Today the certificates live in a Downloads folder, so matching a single new store
means reproducing a laptop. Once the register is a table, matching one store is a
postcode lookup over a few hundred rows.

The second rule is about what we *don't* build:

> **The full-estate Python matcher stays as it is, and stays the source of truth.
> The import path gets a deliberately smaller matcher that only handles the easy,
> safe evidence.**

That is the decision that keeps this from becoming a monster, and section 8
explains why the smaller matcher can honestly be much smaller.

---

## 3. Part 1 — Put the register in the database

**New tables** (one migration):

```sql
epc_certificates (
  source, certificate_number,          -- PK: cert numbers are only unique per register
  load_run_id,
  postcode_norm, address_norm,         -- restricted fields, service_role only
  property_type, property_class,
  floor_area_m2, lodgement_date, uprn,
  geom                                 -- geography(Point,4326), from the UPRN
)

epc_load_runs (
  id, source, snapshot_ref, row_count, status, started_at, finished_at
)
```

RLS on, `anon`/`authenticated` revoked, service_role only — same posture as
`store_floor_areas`, and for the same licensing reason.

**One loader script**, `scripts/epc/load_certificates.py`: read the E&W bulk CSV
and the Scottish quarterly extract, normalise postcode and address with the
existing `matchlib.py` functions, insert, mark the run complete. It **replaces the
whole source** each time rather than merging deltas (section 7 says why).

**Load the whole register, not just certificates near a store.** `index_all_brands.py`
keeps only certificates in postcodes where a store already exists, which is right for a
full run over a known estate and wrong here: newly imported stores arrive in postcodes we
have never held, and a filtered table would return nothing for exactly the stores this
plan exists to serve. The cost is holding more restricted address data — see §8.2.

**Resolve UPRNs to coordinates at load time** and store the result as `geom`. The
pipeline already does this resolution (OS Open UPRN, OGL, resolves 99.9% of the UPRNs we
need). Persisting it costs one column and means spatial matching can be switched on later
with a `ST_DWithin` clause instead of a full reload. PostGIS is already in use.

`index_all_brands.py` keeps doing what it does for the full run; this is an
additional, simpler output path, not a rewrite of it.

---

## 4. Part 2 — Match new stores

### 4.1 The import route barely changes

Two edits, both small:

1. **Record geocode quality.** It currently writes `pqi: null`
   (`upload/route.ts:752`), discarding what Mapbox already told us. Write the Mapbox
   accuracy through instead. This is no longer what blocks spatial matching (§4.4), but
   it is free and it is the honest record of what the geocoder said.
2. **Trigger matching, fire-and-forget.** A request to the cron route with the
   `CRON_SECRET`, not awaited.
3. **Report the handover.** The completion screen gains one line: *"N stores
   queued for floor-area matching"*, linking to the admin page in Part 4.

**[R3] The cron is a backstop, not the only route.** Revision 2 had matching happen
only on a daily timer, which meant an admin importing 400 stores waited up to 24 hours
to find out whether they got sizes. That is the wrong default for the one case this
plan exists to serve.

But the trigger cannot be the only route either, and it must not run inline:

- **Fire-and-forget can be dropped.** The function can be killed once the response is
  sent, a deploy can land mid-request, the network can fail. Nothing would retry, and
  the store would silently never get a size — which is exactly the failure this whole
  document exists to remove.
- **Stores arrive by other paths.** The single-store admin create, and anything added
  later. A derived queue plus a timer catches all of them without each new writer having
  to remember to call the matcher.
- **Transient failures need a scheduler anyway.** `match_attempts` is only useful if
  something comes back to try again.
- **Inline is worse than either.** The route already spends its 300-second budget on
  geocoding, Google validation, entity resolution and a fire-and-forget BUA rebuild. A
  fifth responsibility there is a failure that is hard to see and harder to retry.

So: trigger for latency, timer for correctness. Failure of the trigger costs a delay,
never a missing row. This is the same shape as the existing `cache_rebuild_queue` and
its 30-minute sweeper, which is already in the codebase for the same reason.

### 4.2 The queue is derived, not stored

The matcher writes a row for **every** store it considers, including
`confidence = 'none'` when no certificate is admissible (`matchall.py:92`). So:

> **queue = stores with no row in `store_floor_areas`**

No enqueue step, no trigger, nothing to fall out of sync with the stores table, and
"never attempted" is genuinely distinguishable from "attempted, found nothing".

Errors need somewhere to go, so two columns on `store_floor_areas`:

```sql
ALTER TABLE public.store_floor_areas
  ADD COLUMN match_attempts integer NOT NULL DEFAULT 1,
  ADD COLUMN last_error     text;
```

A store that errors gets a `none` row carrying `last_error`, is retried while
`match_attempts < 3`, and after that sits visibly in a dead-letter list rather than
being retried forever or disappearing.

### 4.3 The job

`/api/cron/match-store-floor-areas`, daily, `CRON_SECRET`-guarded like the existing
five crons, capped at a few hundred stores per run. Same file shape as
`snapshot-brand-stores/route.ts`.

For each unmatched store: fetch candidate certificates by normalised postcode from
`epc_certificates`, score them, write one row. Then **demote implausible matches, then**
rebuild the affected brand and fascia profiles — in that order, and iterated (Part 3).
Then record the run.

The order is not cosmetic. A concession match carries its host building's area, and that
inflated row raises the very fascia median it would be judged against. Rebuilding
profiles before demoting bakes the bad row into the baseline and reintroduces exactly
what migration `20260908000000` corrected.

**What the incremental matcher is allowed to use:**

| Evidence | In? | Why |
|---|---|---|
| Unit / house number agreement | yes | the strongest text signal, no learning required |
| Brand named on the certificate | yes | aliases are already computed and committed in `brand_config.json` |
| Rival operator named | yes | same source |
| Size plausibility vs the fascia profile | yes | the profile already exists in the database |
| Concession / host-building rule | yes | ported from migration `20260908000000` (Part 3) |
| **Spatial (25 m UPRN)** | **not in v1** | admissible sooner than this plan first assumed — see §4.4. Out of v1 for simplicity only, and the schema in §3 keeps it one clause away |
| **Property-class learning** | **no** | it is a two-pass job over the whole estate; the classes it learned are config, and config is what we read |

Leaving spatial out of v1 keeps the first cut small. It is a deferral, not a
prohibition — §4.4 explains why the coordinates are better than this plan originally
credited.

The cost is coverage: until spatial is enabled, new stores will match at a lower rate
than the 53% the full run achieves. That is a number the admin page should show, not
something to hide.

Written in TypeScript beside the cron, with Jest tests that replay a sample of the
committed `epc-2026.09.05-allbrands` output and assert the same tier comes back.
`matcher_version` is written as `epc-incremental-<n>`, so every row says which
matcher produced it.

### 4.4 Every store carries a quality signal — but not the same one

The matcher accepts a spatial match only where `pqi = 'Rooftop'` (`matchall.py:18,116`),
because the 25 m radius was calibrated on nothing else. Measured 2026-09-07:

| `pqi` | stores |
|---|---:|
| `null` | 24,850 |
| `Rooftop` | 18,160 |
| `Third Party` / `Building` | 60 |

So 58% of the estate is excluded from spatial matching before it starts. The obvious
reading — those coordinates are of unknown quality — is wrong. They carry a *different*
quality signal, from a different source. §4.5 measures what it is worth.

**Every store imported through the store import route has been positively confirmed by
Google Places to within 10 metres.** `batchValidateGoogle` runs on every import
(`upload/route.ts:666`, unconditionally — the description in
`STORE_IMPORT_IMPLEMENTATION.md` as dry-run-only is stale), and a row whose coordinate
disagrees with Google by `DISTANCE_THRESHOLD_METERS = 10` does not get flagged, it
**fails the import** (`upload/route.ts:315`). A row Google cannot resolve fails too.

`google_place_id` is already persisted for these stores, so the signal is in the database
today. Confirmed 2026-09-07: of the 24,850 stores with no `pqi`, **every one** has a
place id, and no store in the estate lacks both signals.

**[CORRECTED 2026-09-07, from the health page]** That last clause is true only on a
reading that does not matter. 60 stores — 37 `Third Party`, 23 `Building` — carry a
geocoder grade and **no** place id. They are not ungraded, so they do not "lack both
signals"; they hold a grade the 25 m radius was never calibrated for, which leaves them
outside *both* calibrations and unreachable by spatial matching under either. Small, but
it is the difference between "the whole estate is eligible under one gate or the other"
and "all but 60 are".

Ten metres is tighter than the 25 m the matcher needs, and it comes from an independent
source rather than the geocoder grading itself — which made it tempting to treat the two
signals as equivalent. §4.5 tested that and they are not.

### 4.5 [MEASURED 2026-09-07] Google-validated coordinates are worse than Rooftop

The obvious conclusion from §4.4 — admit spatial matching wherever
`google_place_id IS NOT NULL`, one line, 99.9% of the estate — **was tested and does not
hold.** `scripts/epc/holdout_spatial.py` runs the §3.4 method over 18,060 England & Wales
stores whose text match is trusted (so `matchall` never consulted geometry for them) and
compares a blind spatial pick against it:

| near | margin | Rooftop: fired / agreed | Google-validated: fired / agreed |
|---:|---:|---|---|
| 25 m | 25 m | 1,814 (25%) — **93.8%** | 1,492 (14%) — **87.9%** |
| 15 m | 25 m | 1,587 (22%) — 94.3% | 1,300 (12%) — 89.6% |
| 10 m | 25 m | 1,331 (18%) — 94.6% | 1,105 (10%) — 91.0% |
| 10 m | 35 m | 1,208 (16%) — 95.4% | 923 (9%) — **92.5%** |

Holdout: 7,329 Rooftop, 10,713 Google-validated.

**The harness reproduces the published figure.** Rooftop at the production thresholds
returns 93.8% against the assessment's 94.3% on its 10-brand sample, so the
reimplementation of the spatial half is faithful and the comparison is like-for-like.

**Three things follow.**

1. **At production thresholds the gate must not simply be widened.** 87.9% against 93.8%
   is not a rounding difference; it would admit roughly one wrong certificate in eight on
   a population of 24,850 stores.
2. **A tighter threshold for this population is defensible.** At 10 m with a 35 m margin,
   Google-validated stores reach 92.5% — near Rooftop's 93.8% at its own calibrated
   setting. That is the principled form of the change: a second population with its own
   calibration, not one gate stretched over both.
3. **The yield is modest.** Spatial fires on only 9–14% of Google-validated stores
   against 25% of Rooftop ones, so the realistic gain is on the order of 2,000–2,500
   stores, not 24,850. §4.4's "99.9% of the estate" was a statement about eligibility and
   should not have been read as coverage.

**Why they are worse, most likely.** Google Places confirms the store against Google's
record of *that business*, and Google's point for a business is often a POI pin or an
entrance rather than a building centroid. "Agrees with Google to 10 m" therefore means
agreement with Google, not proximity to the building. The lower fire rate — fewer
certificate UPRNs within 25 m at all — is what that would look like, and is what we see.

**Recommendation:** admit `google_place_id IS NOT NULL` for spatial matching at
`near = 10 m, margin = 35 m`, keep Rooftop at 25/25, and record which calibration produced
each row. Treat this as a coverage improvement worth a couple of thousand stores, not as
the unlock §4.4 first suggested.

---

## 5. Part 3 — Rebuild the aggregate in SQL

Today `brand_floor_area_profiles` is computed by `finalise_all.py` on a laptop and
loaded by `load_to_db.py`. If that stays true, a newly matched store never reaches
a user — the profile it belongs to would only change at the next manual run.

Two SQL functions, one migration:

- **`demote_implausible_floor_area_matches()`** — the concession rule from migration
  `20260908000000`, lifted out of that one-off migration into a callable function.
  The migration itself notes the rule "still needs porting into the matcher or the
  next run reintroduces the same rows"; this is that porting, done once, in the
  place both matchers already write to.
- **`rebuild_brand_floor_area_profiles(brand_ids uuid[] default null)`** —
  percentiles over `confidence = 'high'` rows per (brand, fascia), same ≥5 sample
  floor the table already enforces. Called with the affected brands after an
  incremental batch, and with `null` after a full run.

  **It must DELETE, not only upsert.** `brand_floor_area_profiles` carries
  `CHECK (sample_count >= 5)`. When demotions or a corrected match push a fascia below
  five measured stores, an upsert violates that constraint and takes the whole rebuild
  down with it. A profile that no longer qualifies has to be removed, so the UI has
  nothing to render rather than a stale figure.

**The two functions run in order, and the pair repeats.** Demote, rebuild, demote again:
each demotion changes the medians the next pass judges against, and the concession rule
converges after two demoting passes (`20260908000000`). Running the rebuild alone, or
running it first, reintroduces the rows that migration removed.

After this, `load_to_db.py` stops loading profiles and calls the function instead.
One implementation of the aggregate, used by both paths, and it is the same one the
admin screen reads back.

---

## 6. Part 4 — Making it visible

Three screens. Each answers one question.

### 6.1 "Is the pipeline healthy?" — `/admin/stores/floor-areas`

- **Register:** source, snapshot reference, certificate count, when it was loaded,
  and how many days ago — with an amber state past 120 days.
- **Matching:** last run, stores considered, tier breakdown, errors, duration.
- **Queue:** stores with no floor-area row, and the dead-letter list with its errors.
- **Coverage:** stores with a high-confidence area, as a share of the estate, split
  by full-run rows vs incremental rows — this is where the lower incremental match
  rate becomes a visible fact.
- **Coordinate quality:** the estate split by `pqi` and by whether a Google place id is
  held (§4.4). This is what governs how many stores spatial matching may even consider,
  and it is the number that says how much of the feature would survive if the licensing
  position ever forced us onto the address-free path.
- **Run now**, so an admin who has just imported 400 stores does not wait for 03:00.

Backed by one new table, `epc_match_runs` (id, kind, matcher_version, counts,
status, timings) — the only thing on this page that isn't already derivable.

### 6.2 "Where did this store's size come from?" — the store detail view

For a single store: the area in sq ft and m², the certificate number, source, date
and address, property type, and then the evidence spelled out — how it matched,
whether the brand was named, whether a rival operator was, address corroboration,
certificates at that address, candidate count, size plausibility. Plus
`matcher_version` and `computed_at`.

And one line the other screens can't give: **whether this store counts toward its
brand's profile, and if not, why not** — not high confidence, or demoted as
implausible, or the fascia has fewer than five measured stores.

**`certificate_address` appears here and nowhere else, and never in an export.** It earns
its place on this screen — reading the actual certificate against the store is how the
concession defect was found — but it is restricted OS/Royal Mail text and the first
column to drop if the licensing position changes. Keeping it out of CSV downloads stops
it spreading into spreadsheets that outlive the decision.

### 6.3 "How does that become the number users see?" — brand admin, new tab

On `/admin/brands/[id]`: the profile rows exactly as the public API returns them
(same sq ft conversion, so the screen can't drift from the product), each expanding
into the stores behind it — included with their areas, excluded with their reason.

That is the whole chain on one screen: certificate → store → profile → what a user
sees in the size filter. It is also the fastest way to spot the next concession
defect, which is how the last one was found.

---

## 7. Part 5 — Keeping EPC current

**One quarterly reload. That's the whole mechanism.**

```
download E&W bulk CSV + Scottish quarterly extract
python3 load_certificates.py --apply      # replaces epc_certificates
run the full Python matcher over all stores
python3 load_to_db.py --apply             # writes matches, calls the rebuild function
```

Quarterly because that is Scotland's publication cadence — a weekly E&W refresh
would still leave Scotland three months stale, so the extra machinery buys nothing.

**What we are deliberately not building:** the `/api/deltas` polling, per-certificate
detail fetches, durable watermarks, overlapping date windows, staging tables and
monthly reconciliation sketched in §7.2 of the assessment. That is a real
subsystem with its own failure modes, and it exists to shave weeks off the age of a
number that is already a lagging measurement of a building — most stores occupy
buildings certificated years before they moved in. If a quarterly cycle proves too
slow, it can be run monthly by re-running the same command. Nothing changes but the
frequency.

**Staleness has to be visible or this rule fails silently**, hence the age of the
register on the health page. A reload that nobody notices is missing is the actual
risk here, not the three-month lag.

The full run also **overwrites every incremental row**, which is what keeps the two
matchers honest: any drift lives at most one quarter.

---

## 8. What I'd want challenged

1. **Two matchers.** A TypeScript incremental matcher beside the Python full
   matcher can diverge. Guards: the golden Jest test, the shared SQL aggregate, and
   the quarterly overwrite. The alternative — porting everything to SQL and having
   one — is a much larger job and re-opens the calibration work. I think the guard
   is cheaper than the port, but it is a judgement, not a fact.
2. **Licensing — decided, not resolved.** Decision 2026-09-07: proceed on EPC, revisit
   once there are customers. `docs/epc-licensing-brief.md` sets out the position, where
   we are exposed and the options. This plan makes the footprint larger, not smaller:
   §3 loads the full register rather than only certificates near a store, because a
   filtered table returns nothing for stores in new postcodes — which is the case this
   plan exists to serve. Store `address_norm` only, never raw address; service_role only.
3. **New stores match worse.** Without spatial, coverage is lower. §4.5 now bounds the
   remedy: spatial fires on only 9–14% of Google-validated stores, so enabling it later
   improves matters by thousands, not tens of thousands, and v1 is close to the steady
   state rather than well below it. The
   weak side remains our own address data, not the register (Home Bargains at 26%,
   because our records name the retail park and the certificate names the unit).
4. **GIA is not sales area.** Unchanged from the assessment, and the admin screens
   should carry the same label the user-facing panel does.

---

## 9. Sequence

| # | Step | Size | Delivers |
|---|---|---|---|
| 0 | ~~Confirm the two counts in §4.4~~ | **done 2026-09-07** | every store carries one signal or the other; none lack both |
| 1 | ~~Holdout test on Google-validated stores~~ | **done 2026-09-07** | §4.5: widen the gate at 10 m / 35 m, not at 25/25; worth ~2,000–2,500 stores. Harness at `scripts/epc/holdout_spatial.py` |
| 2 | `epc_certificates` + `epc_load_runs` migration and loader, full register, UPRN resolved to `geom` | 1 day | the register is queryable and spatial stays one clause away |
| 3 | `demote_implausible…()` + `rebuild_brand_floor_area_profiles()` migration | half a day | the aggregate rebuilds itself; the concession rule stops being a one-off |
| 4 | `match_attempts` / `last_error` columns, `epc_match_runs`, the cron and its matcher | 2 days | new stores get areas |
| 5 | Admin health page + store evidence view + brand profile tab | 2 days | all of it visible |
| 6 | `pqi` written on import, completion-screen line, and the two fixes below | 1–2 hours | honest provenance from here on |

Steps 0–1 are complete. They cost an afternoon and they changed the design: the
one-line gate widening is not supported, a second calibration for a second population is,
and the coverage it buys is thousands of stores rather than tens of thousands. Doing them
first is what stopped that becoming a wrong line of code.

Steps 2–3 are useful on their own even if 4 is deferred: they are what stop the
aggregate from being a laptop artefact.

**Two existing defects to fix in step 6, both found while writing this — both fixed
2026-09-08:**

- ~~`geocode_needs_review` is hardcoded `false` at insert (`upload/route.ts:756`);
  `row.geocodeNeedsReview` is never read.~~ **Wired up rather than dropped.** Nothing
  survives the distance check to be flagged by it, so it now records the two cases where
  we genuinely are less sure of a point: coordinates supplied in the CSV on a retry row,
  which skip Google validation entirely, and a Mapbox hit coarser than rooftop/parcel/
  point. Both are "a human should look at this before it is trusted spatially", which is
  what the column's name has always promised.
- ~~`STORE_IMPORT_IMPLEMENTATION.md` describes Google Places validation as running in
  dry-run mode only.~~ **Corrected.** Rule 8, the pipeline steps, the environment notes
  and the cost section now say what the code does: validation runs on every import and
  *rejects* rows rather than flagging them.

I author the migrations; they are applied by hand as usual.

---

## 10. Out of scope, on purpose

Delta polling and watermarks (§7). Alias learning changes (§6.2 of the
assessment). Northern Ireland (§8 of the assessment). Store-level areas shown to users —
they stay admin-only until a labelled gold set exists (§9.4). None of these are
needed to close the three gaps in section 1.

**VOA is closed, not deferred.** Investigated 2026-09-06: the bulk download exists and
the data is better than EPC's — a stated `Unit of Measurement` of GIA or NIA, and a
floor-by-floor breakdown. But its terms restrict use to "Non Domestic Rating (NDR)
purposes only" and prohibit onward disclosure to third parties whose use is not also an
NDR purpose, with no OGL fallback of any kind. That is narrower than EPC, not wider, and
it cannot be cured by passing terms through in our own T&Cs, because the condition is on
the recipient's purpose. See `docs/epc-licensing-brief.md` §C.
