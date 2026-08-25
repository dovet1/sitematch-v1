# Find Sites — Occupier → Candidate Site Matching (MVP)

> **What this is.** A first-pass, real-data feasibility experiment: can SiteMatcher take a real
> occupier acquisition brief, search **real** land/site polygons enriched with **real** road,
> traffic and land-use data, apply acquisition criteria, and surface **candidate sites** a
> developer considers worth investigating?
>
> **What this is NOT.** It does not claim a site is *suitable*, has adequate highways access,
> will get planning permission, or can definitely accommodate an occupier. Language is hedged
> throughout: *candidate site*, *plausible match*, *requires review*, *access potential*,
> *planning constraints detected*. The score is a **"% criteria match"**, never "% suitable".

The work is delivered in **vertical slices (milestones) with inspection gates**. Each real-data
milestone STOPs to report coverage/quality on the actual Canterbury data before proceeding — and
we are willing to change the next milestone based on what we find. **We do not substitute synthetic
data for the hard geospatial/data problems.** Synthetic data is used only for automated tests and
UI scaffolding, never for the validation search.

---

## Architecture (deterministic + geospatial, not LLM)

```
candidate_sites (real polygons, source-agnostic internal concept) ─┐
road_segments / road_nodes (OS Open Roads)                         ├─ PostGIS enrichment
traffic_counts (DfT AADF)                                          │   → candidate_site_features (+provenance)
land_use (multi-signal, real or unknown)                           │
constraint_layers (Flood / Green Belt) ────────────────────────────┘─ derived → candidate_site_constraints

Search: requirement defaults + per-search overrides + search area + brand
  → PostGIS spatial pre-filter + same-brand distance
  → deterministic criterion registry (pure, unit-tested)
  → filtering funnel (fail vs not-evaluable) → scoring → ranked shortlist
```

The matching/scoring engine is **pure and unit-tested** (`apps/web/src/lib/site-matching/`). PostGIS
does the spatial pre-filter and distance maths. No LLM is on the matching path (a free-text brief
parser is a stubbed boundary only).

### Two distinct funnels (keep these separate everywhere — architecture, diagnostics, docs)

> **Enrichment criteria belong to the reusable land dataset. Search criteria belong to the occupier
> requirement.** Do not conflate them.

1. **Data-enrichment universe** — *"what land are we preparing for SiteMatcher to search?"* This is a
   reusable, occupier-agnostic dataset. For the Canterbury MVP: the 74,486 HMLR polygons → an
   **ingestion threshold of ≥ 0.3 ac** → **enrich every remaining polygon once** (roads, traffic, land
   use, geometry, constraints). The 0.3-ac floor is a **configurable MVP ingestion threshold**, *not* a
   universal SiteMatcher rule; if we later target smaller sites we revisit it and re-ingest below it.

2. **Occupier search funnel** — *"which enriched polygons satisfy this particular brief?"* Occupier-
   specific area/road/traffic/frontage/land-use/brand criteria apply **after** enrichment, at search
   time. A drive-thru wants 0.3–0.7 ac; a supermarket 1.5–4 ac; residential dev 2–10 ac — all read the
   same enriched dataset. **We must never re-run enrichment just because another occupier wants a
   different size.** Area (and every other criterion) lives in the search funnel, never baked into the
   enriched dataset as a filter.

### The matching engine (`apps/web/src/lib/site-matching/`)

| File | Role |
|---|---|
| `types.ts` | Normalised, source-agnostic domain types (`SiteFeaturesRaw`, `CriterionConfig`, `SiteMatchResult`, `SearchDiagnostics`). |
| `criteria.ts` | The **criterion registry** — one pure evaluator per criterion. Add a criterion later = add one evaluator + a `CriterionKey`; the engine and funnel pick it up automatically. |
| `scoring.ts` | Transparent "% criteria match" (pass/fail weighted; `unknown` neutral, never a fail; required-fail ⇒ ineligible). Qualitative label **Strong / Potential / Weak**. |
| `diagnostics.ts` | The **filtering funnel** — each required gate reports `entering / pass / fail / unknown` (unknowns retained), plus data-coverage %, so poor coverage is never mistaken for tight criteria. |

Criteria supported in the MVP: `site_area`, `road_proximity`, `traffic_aadf`, `road_frontage`,
`junction_distance`, `land_use`, `planning_constraints`, `same_brand_distance`, and `access`
(deliberately **always `unknown` → "Requires highways review"** — never a suitability claim).

Run the engine tests:

```bash
cd apps/web && npm test -- src/lib/site-matching
```

---

## Data sources (real; refined and reported as we go)

| Layer | Source | Licence | Notes |
|---|---|---|---|
| Candidate polygons | HMLR INSPIRE Index Polygons | OGL (HMLR + OS attribution required) | *Indicative* extent of registered freeholds only — not legal extent; leaseholds/some tenures absent; a title can span several polygons. **M2 tests whether this is a useful candidate unit.** |
| Roads | OS Open Roads (RoadLink + RoadNode) | OGL | Wider network, junctions, frontage. |
| Traffic | DfT AADF (+ DfT Major Roads Database) | Open | Preserve `estimation_method` ("Counted" vs "Estimated"), year, count-point ref. |
| Land use | Multi-signal (OS if licensed, OSM, functional sites, stores, planning, address) | mixed | **The hard part.** No comprehensive open UK land-use classification exists (OS NGD is PSGA/commercial-gated). We report coverage honestly; `unknown` is a valid result and never synthesised. |
| Existing estate | SiteMatcher `stores` | — | Same-brand distance. |
| Constraints | EA Flood Zones 2/3, English Green Belt | Open | Keep to 1–2 layers. |

### Required attribution (HMLR INSPIRE)

Carried in each row's `provenance`. When surfacing HMLR-derived polygons, display:

> © Crown copyright and database right {year}. This information is licensed under the terms of the
> Open Government Licence. © Crown copyright and database rights {year} OS {licence number}.

---

## Milestone status

**Enrichment universe for M3–M8 = all Canterbury HMLR polygons ≥ 0.3 ac (8,226).** Everything below
enriches that reusable dataset once; occupier area criteria apply later at search time (M9).

- [x] **M1 — Matching engine.** Types, evaluators, scoring, funnel + Jest tests (38 tests, synthetic fixtures). ✅
- [x] **M2 — Real candidate universe.** Imported 74,486 HMLR INSPIRE polygons for Canterbury; area/centroid/shape computed; inspected. **Finding: HMLR is a viable real-world polygon *substrate*, not itself a candidate-site dataset — an open question to be tested by enrichment. Enrichment universe = 8,226 polygons ≥ 0.3 ac.** (see M2 findings). ✅
- [x] **M3 — Real roads (OS Open Roads) + parcel→road association, across all 8,226 ≥ 0.3-ac polygons.** Imported 4,310 links + 3,692 nodes; associated 8,226 sites → 25,966 road rows (top-K nearest + nearest-per-primary-class, full provenance). **Finding: coverage is bimodal — 48% have a road ≤ 200 m (40% front one within 10 m), 52% have no *mapped* road within 200 m** (genuine landlocked interiors + OS-Open-Roads track exclusions; a screening signal, not an access verdict). Drive-thru subset: 15% (454/3,084) have a qualifying A/B road ≤ 100 m. Debug-map spot-check clean. (see M3 findings). ✅
- [x] **M4 — Real traffic (DfT AADF) + parcel→road→AADF, same universe.** Imported 804 Canterbury-bbox count points (all years; combined/non-directional); associated 8,226 sites → 2,123 rows under **two comparable methods** (`count_point_direct` vs `via_road`). **Finding: traffic is a thin, major-road-biased, mostly-Estimated signal — only 15% of the universe has any count point nearby.** Method comparison: 93% agree on the same count point; where they diverge (7%), via_road more often captures the busier fronted road (25 vs 10). **Verdict: `via_road` is the primary linking method (cross-checked by direct, snap distances surfaced); the DfT Major Roads geometry arm was not needed to decide.** (see M4 findings). ✅ **STOP gate: land use (M5) is the pivotal uncertainty — proceed there next.**
- [x] **M5 — Real land use as evidence fusion**, across all 8,226 ≥ 0.3-ac polygons. Imported 21,470 land-use features (OSM multipolygons + points + 77 stores) → normalised class + confidence + retained evidence; fused per site. **Finding: fused open land use classifies 48% of the universe (85% of it high-confidence), 52% stays unknown (retained). Residential dominates (1,719; 43% of classified) — the M2 "sub-parcel population is residential" hypothesis is now evidenced for the classified parcels, and is the key occupier discriminator; retail/commercial/food/fuel/vacant are a small usable positive minority. The 52% unknown correlates with the same interior/rural parcels already weak on roads/traffic.** Verdict: a real, mostly-high-confidence discriminator on the classified half — enough to materially improve the search; NOT a sole gate (unknowns stay `unknown`). Caught+fixed a `power=generator` rooftop-solar misclassification during prep. (see M5 findings). ✅ **STOP gate: proceed to M6 as planned; land-use × road coverage cross-tab flagged as a cheap M9 input.**
- [x] **M6 — Derived geometry** (approx frontage + nearest significant junction/roundabout distance) as screening signals — never a "suitable access" claim. Enriched all 8,226 sites (frontage buffer 12 m, junction radius 500 m). **Finding: frontage is measured for exactly the M3 roadside subset — unknown 4,317 (52%) / measured 3,909 (48%), the split lining up precisely with M3, so `unknown` ≠ fabricated-zero holds on real data; of measured, moderate/wide dominate (p50 72.7 m), ≥20 m = 3,163 (38%), onto a classified road 635. Junctions dense (p50 30.7 m; 47% within 25 m). Geometry verified: 0 `frontage>perimeter` violations, 0 buffer violations, frontage/perimeter p50 0.20 / max 1.00 → no over-capture; 12 m buffer needs no tuning.** Verdict: a geometrically-verified screening signal on the roadside ~48%, screening-only (never a surveyed frontage/access claim). (see M6 findings). ✅ **STOP gate: proceed to M7 as planned; land-use × road cross-tab still queued as an M9 input.**
- [x] **M7 — Existing estate (same-brand distance).** Search-time, per-brand — NOT enrichment: added read-only RPCs (`nearest_same_brand_store`, `brand_estate_summary`, `debug_site_brand_map`), a Jest-tested pure module (`brand-distance.ts`, 16 tests), and inspect + debug-map scripts. Validated against **McDonald's** (1,497 stores; universe p50 = 3.0 mi, 15% within 1 mi, 85% pass a ≥ 1-mi rule) with a **Sainsburys** multi-fascia parent-group cross-check (p50 = 2.08 mi). **Finding: the cleanest criterion in the pipeline — a precise, 100%-covered per-brand distance with NO `unknown` state; a brand with no estate is trivially satisfied (nothing to cannibalise). KNN verified against a brute-force full-estate scan (0/36 mismatches); edge-distance ≤ centroid-distance on all.** Populates the engine's stubbed `same_brand_distance` criterion with real values. (see M7 findings). ✅ **STOP gate: proceed to M8 as planned.**
- [x] **M8 — Constraints (EA Flood Zones 2/3 + English Green Belt).** Occupier-agnostic enrichment (like M3–M6): a source-agnostic `constraint_features` polygon substrate + a `candidate_site_constraints` association (one aggregated row per site × constraint type, union overlap-fraction of the parcel), interpreted by a pure Jest-tested module (`constraint-screening.ts`, 15 tests, 147 total). Imported **726 EA flood features (400 FZ3 + 326 FZ2)** clipped from the 13 GB national GeoJSON; **Green Belt = 0 for Canterbury** (a real geographic fact — verified non-zero on west Kent). Associated all 8,226 → 1,138 rows. **Finding: flood zones flag 603 sites (7%) — FZ3 530 (6%), 274 of them ≥ half within; the two published layers are not strictly nested (389 both / 141 FZ3-only / 73 FZ2-only), a real EA property; overlap invariant holds (0 rows > 1 after a float-noise clamp); near-miss corner-clips correctly excluded from the token list.** Populates the engine's `planning_constraints` evaluator with real tokens. Severity stays an occupier search-time decision; an intersection is a screening flag, never a suitability/planning verdict; "clear" = "not within the mapped zone", not "no flood risk". (see M8 findings). ✅ **STOP gate: proceed to M9 as planned — no milestone change needed.**
- [x] **M9 — First real recall-favouring search + known-site recall test — passed as a broad-brush parcel-screening instrument.** McDonald's drive-thru over the 8,226-site universe: hard gates (area 0.3–0.7 ac / exclude FZ3 / same-brand ≥1 mi) → **2,407 eligible (29%)**; road/traffic/frontage/junction/land-use rank but never eliminate. **Finding: the evidence + search pipeline works end-to-end on real data and produces hedged, inspectable, honestly-ranked output; the known-site recall test worked by *disclosing* a real limitation rather than hiding it — both existing Canterbury McDonald's are spatially found (2/2 in universe) but map to whole HMLR titles (4.32 ac retail park, 7.47 ac city block) far outside the drive-thru area band (each store is a sub-plot of a larger enclosing title; physical fit of those titles is strong, 86–88%). HMLR titles remain useful as indicative registered freehold extents — they must NOT be presented as exact development plots. The land-use × road cross-tab is strongly positive: P(classified LU | roadside) = 96% vs 5% for no-road. Score saturates (top-20 all 100%).** Verdict: **passed as a broad-brush prospecting instrument.** The title-granularity issue is a **disclosed limitation, not a blocker** — it bites when a footprint is smaller than its enclosing title, and does **not** justify speculative geometry now. (see M9 findings). ✅ **STOP gate: a bounded M9.1 search-semantics + ranking correction, then the M10 real-data prototype. No plot refinement.**
- [x] **M9.1 — Product-readiness correction** (bounded; pure engine + Jest, no migration). (1) **Area semantics:** below-min still fails, in-range passes, **above-max retained not failed** — `oversized` flag, honest label ("larger than requested footprint; may contain a suitable area"), transparent ranking penalty, real title area preserved (`site_area` in `criteria.ts`). (2) **Transparent tiers** (`tiering.ts`): Strong parcel signal / Potential / Worth reviewing / Unlikely + a passed/partial/failed/unknown **evidence summary** per result, replacing the surfaced suitability % (partial = soft-evidence pass — Estimated AADF / approx frontage/junction / non-high-confidence land use — or an oversized title or a constraint flag). (3) **Generic requirements** (`requirement-presets.ts`): brand + same-brand optional; four preset briefs (drive-thru, roadside/commercial, retail/leisure/employment, industrial/logistics) as configs. **Finding (validated on real Canterbury data): saturation fixed** — the McDonald's drive-thru run went from "top-20 all 100%" to a real spread (strong 31 / potential 2,929 / review 3,665 / unlikely 1,601). **Oversized retention works** — with the same-brand gate relaxed, both known McDonald's titles (4.32 ac / 7.47 ac) are now **eligible and retained** (ranked #377 / #202, median rank ~289 vs ~3,200 in M9) instead of eliminated by the area gate. A brand-agnostic industrial brief (2–25 ac) confirms same-brand is optional and the presets generalise across formats. **179 Jest tests green; new files tsc-clean.** ✅
- [ ] **M9.2 (queued) — remove the now-dead code path.** M9's saturating `score`/`labelForScore` (`scoring.ts`, strong/potential/weak) is kept only as an internal ordering aid and is no longer surfaced; fold it into the tiering layer or delete once M10 confirms nothing depends on it.
- [ ] **M10 — Real-data product prototype** (standalone experimental route *outside* the unified workspace for now; integrate later). Read-only endpoint reusing the engine over the existing Canterbury data; requirement setup → synchronised map + ranked parcel list → parcel detail (registered-title area + oversized note, land use + confidence, roads, traffic counted/estimated, frontage, junction, existing-estate distance when a brand is selected, constraints, passed/partial/failed/unknown breakdown); result tiers not a precise %; persistent caveats (registered extent not a plot; availability/access/planning/viability unknown). Validate with three materially different briefs. **No in-app feedback capture** (research done manually). Reuses the SiteMatcher map stack + `sm-*` design tokens.

> **Debug mapping is not deferred to M10.** M3–M9 need enough internal/ugly map tooling to visually
> interrogate polygons, roads, traffic points/links, the selected road, land-use evidence, frontage,
> junctions, constraints and scores. Geospatial correctness is judged on the map, not from DB rows alone.

> **Cheap geometry diagnostics on every enriched polygon** (area, perimeter, compactness, bbox dims,
> min-rotated-rect dims / width-depth where straightforward) are stored as diagnostic attributes now —
> not necessarily used for ranking yet — so we can later explain false positives (thin strips, awkward
> titles, oversized mixed parcels) without another enrichment pass.

---

## Running M2 (real candidate universe)

Migrations are **authored here; you apply them** to Supabase (I never touch the remote DB).

### 1. Apply the migration

Apply `supabase/migrations/20260723000000_create_candidate_sites.sql` via your usual path
(Supabase SQL editor, or `supabase db execute`, or `scripts/run-migration.js`). It creates
`public.candidate_sites` + the `import_candidate_sites()` service-role RPC. Requires PostGIS
(already enabled).

### 2. Obtain + prepare the HMLR data

1. Download **INSPIRE Index Polygons** for the Canterbury local authority from
   <https://use-land-property-data.service.gov.uk/datasets/inspire> (GML, monthly release).
2. Convert to WGS84 GeoJSON, clipped to the Canterbury area, with GDAL/ogr2ogr:

   ```bash
   # Canterbury bbox (approx): 1.00,51.22 → 1.20,51.32  (minLon minLat maxLon maxLat)
   ogr2ogr -f GeoJSON -t_srs EPSG:4326 \
     -clipsrc 1.00 51.22 1.20 51.32 \
     canterbury_inspire.geojson Land_Registry_Cadastral_Parcels.gml
   ```

### 3. Import

```bash
cd apps/web
npm run import:candidate-sites -- \
  --file /abs/path/canterbury_inspire.geojson \
  --source hmlr_inspire \
  --ref-property INSPIREID \
  --dataset "HMLR INSPIRE Index Polygons" --version 2026-08
```

(If you skip the ogr2ogr reprojection and pass raw BNG GeoJSON, add `--srid 27700` and
`--bbox 1.00,51.22,1.20,51.32`.)

### 4. Inspect — the M2 gate

```bash
npm run inspect:candidate-sites -- --source hmlr_inspire --sample 30
```

Then **record the answer** to the M2 question in this doc: is an HMLR INSPIRE polygon a
sufficiently useful *starting* unit for candidate discovery, or only after filtering/enrichment?
Classify the sample visually (residential title / commercial site / agricultural or large rural
parcel / road-or-infrastructure artefact / very large mixed site / potentially useful standalone
development parcel) and note the area + compactness distribution. If HMLR looks like the wrong unit,
we reconsider M3 (e.g. HMLR ∩ OS land use) before enriching around it.

### M2 findings

_Import: 74,486 features (HMLR INSPIRE Index Polygons, dataset version 2026-08), Canterbury bbox,
source SRID 4326. 0 outside bbox, 0 non-polygon skipped._

**Numbers are authoritative** — taken from Postgres `count: 'exact'` predicates, not the paged
distribution pull. (The `inspect` script originally paginated `.range()` **without `ORDER BY`**, which
repeats/skips rows and undercounted every bucket — e.g. it reported ≥0.3 ac as ~6,549 vs the true
**8,226**. Fixed in `scripts/inspect-candidate-sites.ts` by adding `.order('id')`.)

- **Polygon count (Canterbury):** 74,486. No null `area_acres`/`compactness`.
- **Area distribution:**

  | Band | Count | % |
  |---|---:|---:|
  | < 0.1 ac | 48,876 | 65.6% |
  | 0.1–0.3 ac | 17,384 | 23.3% |
  | **< 0.3 ac (total)** | **66,260** | **89.0%** |
  | **≥ 0.3 ac — enrichment universe** | **8,226** | **11.0%** |
  | — 0.3–0.7 ac (drive-thru subset) | 3,084 | 4.1% |
  | — 0.7–2 ac | 1,994 | 2.7% |
  | — 2–10 ac | 1,777 | 2.4% |
  | — ≥ 10 ac | 1,371 | 1.8% |

- **Compactness / sliver rate:** median ≈ 0.55. **2,116 (2.8%)** very elongated (< 0.15) — road/verge/
  infrastructure artefacts. Within the ≥0.3-ac universe, 7,514 survive a compactness ≥ 0.15 filter
  (712 slivers dropped).
- **Land use known:** 0 / 74,486 (0%). HMLR carries no land-use attribute; there is no enrichment yet.
- **Sample observation (evidence vs hypothesis — kept distinct):** the **evidence** is that 89% of
  polygons are < 0.3 ac and the sampled small parcels sit at 0.06–0.11 ac, compactness ~0.45–0.60. It
  is a *hypothesis* — **not a classified finding** — that many of these are individual residential
  freeholds; we have **not** classified them. We are choosing not to ingest the sub-0.3-ac population
  for this MVP because we are focusing on larger land/property opportunities, and that threshold is
  revisitable if smaller sites are needed later. Geometry alone also cannot tell a 0.4-ac shop-and-yard
  from a 0.4-ac large house plot — that needs land use (M5). A geographically varied map spot-check of
  the ≥0.3-ac universe is scheduled as M3 debug tooling.

**Is HMLR a useful candidate unit?**

> **HMLR INSPIRE provides a viable real-world polygon substrate for continuing the experiment, but an
> INSPIRE polygon should not itself be interpreted as a development opportunity.**
>
> For the current drive-thru brief, area alone reduces the Canterbury universe from 74,486 polygons to
> **3,084** within the 0.3–0.7-acre target range.
>
> More broadly, **all polygons ≥ 0.3 acres (8,226) will be retained and enriched** during the
> Canterbury MVP so the resulting dataset can support other occupier and development requirements.
>
> Whether these polygons can be transformed into a useful candidate-site universe **remains an open
> question**, to be tested through road, traffic, land-use and other enrichment.

**Roadmap consequences (a real change, per the gate's promise):**

- **Enrichment universe = all 8,226 polygons ≥ 0.3 ac** (7,514 excluding slivers) — *not* the 3,084
  drive-thru band. Enrich once into a reusable, occupier-agnostic dataset; occupier area criteria apply
  later at search time (see *Two distinct funnels*). The 0.3-ac floor is a **configurable ingestion
  threshold**, not a universal rule.
- **M3/M4 (roads, traffic) proceed next** against that universe, retaining full provenance. We compare
  road→AADF association methods on real data (OS-Open-Roads-linked vs DfT Major Roads geometry) rather
  than assuming one. **After M4 we STOP and reassess the land-use strategy with evidence** — land use is
  the pivotal uncertainty (0% today) but we gather road/traffic evidence first.
- Every enriched polygon carries cheap geometry diagnostics and is inspectable on a debug map; coverage
  is always reported as entering/pass/fail/**unknown** so missing data is never mistaken for tight
  criteria.

---

## Running M3 (real road network — OS Open Roads)

Migrations authored here; **you apply them** and **download the OS data**.

### 1. Apply the migration

Apply `supabase/migrations/20260724000000_create_road_network.sql`. It creates `public.road_links`
+ `public.road_nodes` and the service-role RPCs `import_road_links()` / `import_road_nodes()`.

### 2. Obtain + prepare OS Open Roads (OGL, free)

1. Download **OS Open Roads** (GeoPackage `oproad_gb.gpkg`) from
   <https://osdatahub.os.uk/downloads/open/OpenRoads> (or the OS OpenData portal). It contains
   `RoadLink` (centrelines) and `RoadNode` (junctions), in EPSG:27700.
2. Convert + clip to the Canterbury area with GDAL (same bbox as HMLR):

   ```bash
   ogr2ogr -f GeoJSON -t_srs EPSG:4326 -clipsrc 1.00 51.22 1.20 51.32 \
     canterbury_roadlink.geojson oproad_gb.gpkg RoadLink
   ogr2ogr -f GeoJSON -t_srs EPSG:4326 -clipsrc 1.00 51.22 1.20 51.32 \
     canterbury_roadnode.geojson oproad_gb.gpkg RoadNode
   ```

   (If you prefer to pass raw BNG GeoJSON, skip `-t_srs` and add `--srid 27700` to the import.)

### 3. Import

```bash
cd apps/web
npm run import:road-network -- --file /abs/path/canterbury_roadlink.geojson --layer link \
  --source os_open_roads --dataset "OS Open Roads" --version 2025-10
npm run import:road-network -- --file /abs/path/canterbury_roadnode.geojson --layer node \
  --source os_open_roads --dataset "OS Open Roads" --version 2025-10
```

The importer maps OS field names (`roadClassification`, `roadFunction`, `roadClassificationNumber`,
`name1`, `formOfWay`, `primaryRoute`, `trunkRoad`, `startNode`/`endNode`, `formOfRoadNode`) and keeps
the full source properties in `metadata`. **Attribution:** "Contains OS data © Crown copyright and
database right {year}." (stored in each row's `provenance`).

### 4. Associate + inspect — the M3 gate

**Authored:** migration `20260725000000_associate_candidate_roads.sql` (apply it first) creates
`public.candidate_site_roads` + three read-only reporting/debug RPCs and the service-role write RPC
`associate_candidate_site_roads()`, plus scripts `associate:candidate-roads`,
`inspect:candidate-roads`, `export:road-debug-map`.

**Association design (against real geometry, not a naive single nearest road):**

- Distance is **polygon edge → road centreline in metres** (PostGIS `geography`); a road that
  touches/crosses a parcel is distance 0, a frontage road is its true distance.
- We store the **top-K nearest links overall** (K=8 default) so parallel roads, both carriageway
  centrelines of a dual carriageway, and roundabout links are all visible for inspection and feed the
  engine's "nearest per relevant class" bundle.
- We **additionally** guarantee the nearest link of each **primary class** (A/B/Motorway) is kept even
  if it falls outside top-K, so a site that fronts an A road amid many minor access roads still records
  it (`is_nearest_in_primary_class`). `is_nearest_overall` marks the single closest link.
- **Occupier-agnostic:** no area/road occupier criteria are baked in — only distance/class/number/
  form-of-way + provenance. The drive-thru A/B preference is applied later at report/search time.

Run (from `apps/web`, after applying the migration and importing sites + roads):

```bash
npm run associate:candidate-roads    # enrich the 8,226 universe (idempotent per site)
npm run inspect:candidate-roads      # both funnels, reported SEPARATELY (authoritative SQL counts)
npm run export:road-debug-map        # standalone Leaflet HTML → artifacts/find-sites-m3/road-debug-map.html
```

`inspect:candidate-roads` reports, via the `candidate_road_coverage()` RPC:

- **Overall coverage (Funnel 1):** of the 8,226, how many have a road within the 200 m search radius,
  the nearest-road distance p50/p90 + cumulative bands, and the best (nearest-overall) class mix.
- **Drive-thru subset funnel (Funnel 2, 3,084):** how many have a qualifying A/B road within
  `--qualifying-distance` (default 100 m) — reported *separately* from the reusable dataset, per the
  two-funnel rule.
- **Visual inspection:** `export:road-debug-map` picks a geographically varied sample (grid-spread,
  seeded) and plots each site polygon + its coloured associations (red = nearest overall, amber =
  nearest A/B/Motorway) + the surrounding context roads/nodes on OSM tiles. Open the HTML and check the
  *selected* road is the one the site actually relates to. Look for systematic errors: parallel roads,
  dual carriageways, roundabouts, shared road numbers, large polygons touching several roads.

### M3 findings

_Import done (OS Open Roads GeoPackage `oproad_gb.gpkg`, release 2025-10, layers `road_link`/`road_node`,
source EPSG:27700 → clipped to Canterbury bbox + reprojected to 4326 via `ogr2ogr -spat …
-clipsrc spat_extent`). **Association step authored** (`20260725000000_associate_candidate_roads.sql` +
scripts) — awaiting the user applying the migration and running association to fill the numbers below._

- **Road links imported:** 4,310 (0 dropped). By classification: A Road 432, B Road 59, Classified
  Unnumbered 330, Unclassified 1,874, Not Classified 557, Unknown 1,058. Numbered: 491. `length_m`
  computed for all. This OS release keys links by GUID `id` (not TOID) — stored as `source_reference`.
- **Road nodes imported:** 3,692 — junction 2,190, road end 1,209, pseudo node 228, roundabout 65.
- **Association done (2026-08-24):** 8,226 sites → **25,966 `candidate_site_roads` rows** (top-K nearest +
  nearest per primary class within 200 m; idempotent). Authoritative counts via `candidate_road_coverage()`.

- **Funnel 1 — enrichment universe (≥ 0.3 ac = 8,226):** road within 200 m = **3,909 (48%)**; **no road
  within 200 m = 4,317 (52%)**. Nearest-road distance p50 = **2.1 m**, p90 = **33.4 m**. Cumulative (of the
  whole 8,226): ≤ 10 m 3,277 (40%), ≤ 30 m 3,483 (42%), ≤ 50 m 3,622 (44%), ≤ 100 m 3,754 (46%),
  ≤ 200 m 3,909 (48%). Best (nearest-overall) class of the associated: Unclassified 1,538, Unknown 1,151,
  Classified Unnumbered 422, Not Classified 387, **A Road 354, B Road 57**.
  - **Finding — strongly bimodal.** A parcel either *fronts* a road (40% within 10 m; p50 just 2.1 m) or
    has **no mapped road within 200 m** (52%). This is the honest split of HMLR ≥ 0.3-ac freeholds into
    roadside vs landlocked-interior. **Caveat (do not overclaim "no access"):** OS Open Roads is the *open*
    road product and deliberately **excludes minor/unclassified tracks, private drives and farm roads**
    (unlike OS MasterMap Highways). So "no road within 200 m" reflects **both** genuinely interior
    rural/agricultural parcels **and** a completeness limitation of the open road layer — it is a screening
    signal, never a highways/access verdict. Flag for M5 (land use) and any future road-completeness pass.
- **Funnel 2 — drive-thru subset (0.3–0.7 ac = 3,084), reported SEPARATELY:** road nearby = 1,444 (47%);
  **qualifying A/B road ≤ 100 m = 454 (15%)**. Best class: Unclassified 577, Unknown 367, Classified
  Unnumbered 177, Not Classified 151, A Road 145, B Road 27. (Occupier signal against the reusable dataset —
  the A/B ≤ 100 m rule is applied at report time, not baked into enrichment.)
- **Visual inspection (debug map, geographically varied 30-site sample):** associations look correct on
  spot-check — frontage parcels get their abutting road (p50 2.1 m), and the **nearest A/B road is retained
  even when a minor road is closer** (e.g. site `62415244` → A257 at 137 m as `nearest_primary_class`, with a
  nearer unclassified road as `nearest_overall`). No systematic mis-association seen in the sample (parallel
  roads / dual carriageways / roundabouts handled by top-K + per-class retention). A fuller 20–30 site pass is
  reproducible via `npm run export:road-debug-map`. **No suitability/access claim is made anywhere.**

---

## Running M4 (real traffic — DfT AADF)

Migrations authored here; **you apply them** and **download the DfT data**.

### 1. Apply the migrations

Apply, in order:

- `supabase/migrations/20260726000000_create_traffic_counts.sql` — `public.traffic_counts`
  (one row per DfT count point per year) + the `import_traffic_counts()` service-role RPC.
- `supabase/migrations/20260727000000_associate_candidate_traffic.sql` —
  `public.candidate_site_traffic` + the write RPC `associate_candidate_site_traffic()` and
  the read RPCs `candidate_traffic_coverage()` / `debug_site_traffic_map()`.

Requires M3 applied (the via_road method reads `candidate_site_roads`).

### 2. Obtain the DfT AADF data (OGL, free)

1. Go to <https://roadtraffic.dft.gov.uk/downloads> and download **"AADF data"** (the
   combined, non-directional file `dft_traffic_counts_aadf.csv`, not the raw counts nor the
   by-direction variant). The CSV carries `count_point_id, year, local_authority_name,
   road_name, road_category, road_type, latitude, longitude, easting, northing,
   estimation_method, …, all_motor_vehicles` — one row per count point per year, all GB, all
   years. `latitude`/`longitude` are already WGS84, so no reprojection is needed. **Note the
   `local_authority_name` is the UPPER-TIER authority ("Kent"), not the district
   ("Canterbury")** — so we filter geographically by bbox, not by `--la`.

### 3. Import (bbox-filtered, streamed)

The importer STREAMS the file line-by-line (the national file is ~150 MB / 600k rows) and
keeps only count points inside the Canterbury bbox — the same bbox as the HMLR polygons and
OS roads, so traffic lines up with the 8,226 sites:

```bash
cd apps/web
npm run import:traffic-counts -- \
  --file ~/Downloads/dft_traffic_counts_aadf.csv \
  --source dft_aadf --bbox 1.00,51.22,1.20,51.32 \
  --dataset "DfT AADF" --version 2025-06
```

(Every DfT year in the bbox is imported — one row per count point per year — preserving the
trend; association picks the latest year per count point. Add `--year 2023` to keep a single
year, or `--use-bng` if a file lacks lat/long. `--la "Kent"` works on this file if you also
want the LA gate, but bbox is what matches the rest of the pipeline.)

### 4. Associate + inspect — the M4 gate

```bash
npm run associate:candidate-traffic   # enrich the 8,226 universe (idempotent; both methods)
npm run inspect:candidate-traffic     # coverage + direct-vs-via_road method comparison
npm run export:traffic-debug-map      # standalone Leaflet HTML → artifacts/find-sites-m4/traffic-debug-map.html
npm run export:traffic-debug-map -- --only-divergent   # bias the sample to disagreeing sites
```

**Two linking methods, computed per site so they can be COMPARED (the gate):**

- `count_point_direct` — nearest DfT count point to the site polygon within radius (raw
  proximity). Simple, but can attach a minor service-road count while the site fronts a
  busy A road whose count point is a little further.
- `via_road` — the count point snapped (tight tolerance) to the site's already-associated
  M3 road link. Because M3 retained the nearest link of each primary class, this can
  attribute an A-road AADF to a site that fronts that A road even when a minor count point
  is physically nearer. The representative pick (`is_best_for_method`) uses the site's
  nearest primary-class road, else its nearest-overall road — deterministic, occupier-agnostic.

`inspect:candidate-traffic` reports, via `candidate_traffic_coverage()`: coverage under each
method, the best-pick AADF p50/p90, the **Counted-vs-Estimated** mix (Estimated = modelled,
never hidden behind a score), and the **method comparison** — how many sites agree on the same
count point vs diverge, and where they diverge, which method finds the higher AADF.

**DfT Major Roads geometry arm.** `road_links` is source-agnostic, so if you also want to
compare against DfT's own major-road geometry: import the DfT Major Road Network link
geometry into `road_links` with `--source dft_major_roads`, run
`associate:candidate-roads -- --road-source dft_major_roads`, then
`associate:candidate-traffic -- --road-source dft_major_roads`. OS-mediated vs
DfT-Major-Roads-mediated then differ only by which network mediated the snap.

**After running, record the numbers below, eyeball 20–30 sites (especially `--only-divergent`),
decide which linking method is more reliable — then STOP and reassess the land-use strategy
(M5) with the road+traffic evidence in hand.**

### M4 findings

_Import + association + inspection run 2026-08-24 against remote Supabase (on the user's
explicit request — a one-off waiver of the usual author-and-hand-off rule, as in M3; do NOT
assume it generalises). Source: DfT `dft_traffic_counts_aadf.csv` (combined/non-directional,
all-GB, all years 2000–2025), streamed and bbox-clipped to Canterbury (`1.00,51.22,1.20,51.32`)._

- **Imported:** 600,551 rows scanned → **804 count-point rows** inside the Canterbury bbox
  (one row per count point per year; all years retained, association picks the latest per
  point). 0 no-geometry. **Data-shape gotchas fixed during the run:** (1) DfT writes the
  literal `NA` for missing numerics (minor roads / un-sampled years) — the importer now
  coerces `NA`/`N/A`/`-` to null before the numeric casts (first run aborted on
  `invalid input syntax for type numeric: "NA"`). (2) This national file records
  `local_authority_name` as the **upper-tier authority ("Kent")**, not the district — so we
  filter by **bbox**, never `--la "Canterbury"` (which matches 0 rows). (3) The importer
  **streams** the 150 MB / 600k-row file line-by-line (no whole-file read) to stay off the heap.
- **Association (2026-08-24):** 8,226 sites → **2,123 `candidate_site_traffic` rows** across
  both methods (idempotent). Authoritative counts via `candidate_traffic_coverage()`.

- **Funnel 1 — enrichment universe (≥ 0.3 ac = 8,226):** with a count point linkable —
  **via_road 710 (9%), count_point_direct 1,046 (13%), either 1,255 (15%)**. Best-pick AADF
  (All motor vehicles): via_road p50 = **8,739**, p90 = **27,069**; direct p50 = 7,986, p90 =
  22,999. Best-pick DfT road category (via_road): MCU 321, PA 217, TA 144, MB 28. **Estimation
  method of the best pick: Estimated 431 vs Counted 279** — i.e. **most linkable Canterbury
  AADFs are MODELLED, not observed**; preserved on every row, never hidden behind a score.
  - **Finding — traffic is a sparse, major-road-biased signal.** Only ~15% of the ≥0.3-ac
    universe has ANY DfT count point within reach, entirely consistent with M3 (52% of the
    universe has no mapped road within 200 m) and with DfT sampling major roads densely and
    minor roads sparsely/rotating. "No count point nearby" is a real result, not a data gap —
    and it is *not* a low-traffic claim (an un-counted road may still be busy). A screening
    signal only.
- **Funnel 2 — drive-thru subset (0.3–0.7 ac = 3,084), reported SEPARATELY:** either method
  488 (16%); via_road best-pick AADF p50 = **9,617**, p90 = 27,069. Estimated 135 vs Counted
  102. (Occupier signal against the reusable dataset; no AADF threshold baked into enrichment.)

- **THE GATE — method comparison (direct vs via_road), the reason M4 computes both:** of the
  **501** sites with a best pick under *both* methods, **465 (93%) agree on the exact same
  count point**; **36 (7%) diverge**. Where they diverge, **via_road finds the higher AADF on
  25, direct on 10** (1 tie), and median |AADF diff| over all "both" sites = **0** — the two
  methods overwhelmingly agree, and where they part, via_road more often captures the busier
  road the parcel actually fronts. Worked examples:
  - `171c95ff` — direct → A290 (AADF 8,739); **via_road → A2050 (AADF 28,801)**, both ~170 m
    from the site. The site fronts the higher-order A2050; direct snapped to the quieter A290.
    **via_road right.**
  - `0ba56fa9` — direct → A28 (AADF 14,489) @195 m; **via_road → A2 (AADF 20,298)**, snapped
    5 m to the site's associated A2 link but the count point is **1,275 m along the A2**.
    via_road attributes the trunk-road flow (AADF is a link attribute, ~constant between
    junctions) — **but the distance must be surfaced** (it is: `site_to_count_m` /
    `road_to_count_m` on every row), because a far snap can cross an intervening junction.
  - `171ba5a3` / `2b3050a6` — both methods pick an unclassified (`U`, MCU) minor road; the
    divergence is between a **2025 Counted 160** and a **2019 Estimated 406** on nearby minor
    count points — trivial magnitudes, different latest-year per point. Noise, not signal.

**Verdict — which linking method (the gate's decision):**

> **`via_road` is the more reliable PRIMARY linking method; keep `count_point_direct` as a
> cross-check, and always surface the snap distances.** via_road routes traffic through the
> road the parcel actually relates to (M3's per-primary-class retention lets a parcel fronting
> an A road inherit that A road's AADF even when a minor count point is physically nearer) —
> exactly the roadside-occupier case. The 93% agreement shows it rarely disagrees with naive
> proximity; the 7% where it does are mostly via_road correctly upgrading to the fronted
> higher-order road. The one caveat is a *distant* snap along a long associated link (e.g. A2
> @1,275 m); we do not hide it — `site_to_count_m` and `road_to_count_m` are stored and shown,
> and M9 can cap the along-road distance if needed. **The DfT Major Roads geometry arm was not
> needed to decide this** (OS-mediated via_road vs direct already answers the gate); it remains
> available for free (import into `road_links` as `dft_major_roads`, re-run with
> `--road-source dft_major_roads`) if a later pass wants to compare mediation networks.

**STOP / roadmap consequence:** M4 confirms traffic is a **thin but honest** enrichment layer
(15% coverage, mostly Estimated) — useful as a *positive* signal on the roadside minority, never
as a discriminator against the un-counted majority. Combined with M3 (bimodal road coverage),
**the pivotal uncertainty remains land use (M5)** — 0% today, and the thing that will decide
whether the ≥0.3-ac universe can become a real candidate set. Proceed to M5 as evidence-fusion
(OSM / OS functional sites / stores / UPRN / planning / brownfield), `unknown` staying `unknown`.

---

## Running M5 (real land use — evidence fusion)

Migrations authored here; **you apply them** and **download the OSM + brownfield data**. Land use
is the pivotal uncertainty (0% today, and no comprehensive open UK land-use dataset exists), so M5
does not trust one source — it **fuses evidence** from many, keeping every signal + its provenance,
and leaving `unknown` genuinely unknown.

### The design (why it is split the way it is)

- **`land_use_features`** (migration `20260728000000`) is the source-agnostic **evidence substrate**
  — the land-use analogue of `road_links`/`traffic_counts`. One row per source feature (an OSM
  landuse/amenity/shop/building, a brownfield polygon, a store point), each normalised to one broad
  class + a **source-level confidence** (how firmly its tags imply that class) with its **raw tags
  retained**. Polygons and points both allowed (`feature_kind`).
- **`candidate_site_land_use`** (migration `20260729000000`) is the **association** (like
  `candidate_site_roads`/`_traffic`): every land-use feature that spatially relates to a site, with
  *how* it relates — polygon **overlap fraction of the site** (a landuse polygon covering the whole
  parcel is strong; a sliver is weak), or point **inside/nearby**.
- **The mapping + the fusion are pure TypeScript, unit-tested with Jest** (not buried in SQL), because
  they are the parts most prone to silent error and most in need of tuning:
  - `apps/web/src/lib/site-matching/land-use-classification.ts` — `classifyOsmTags()` (ordered rules:
    explicit landuse/amenity/shop = `high`; typed building = `medium`; unclassifiable = `null`, never
    a guessed class), plus brownfield + store helpers.
  - `apps/web/src/lib/site-matching/land-use-fusion.ts` — `fuseSiteLandUse()` reduces a site's
    evidence to one class + fused confidence + retained evidence. **`unknown` stays `unknown`** (no
    evidence, or evidence below a weight floor → `null`); **weak evidence never forces a class**;
    **conflicting strong evidence → `mixed`** (capped at `medium`). It **classifies, never excludes** —
    acceptance is a search-time decision (`criteria.ts` `land_use`).
  - Run the tests: `cd apps/web && npm test -- src/lib/site-matching` (49 new M5 tests, 87 total).
- The `associate:candidate-land-use` script runs the PostGIS association, then runs the TS fusion in
  Node and writes the result back via `apply_candidate_land_use_fusion()`. Coverage +
  `debug_site_land_use_map()` read RPCs report/inspect the outcome.

### 1. Apply the migrations

Apply, in order: `supabase/migrations/20260728000000_create_land_use_features.sql`, then
`supabase/migrations/20260729000000_associate_candidate_land_use.sql`. (M5 fusion writes onto the
`current_land_use` / `land_use_confidence` / `land_use_evidence` columns already on `candidate_sites`
from M2. The association reads nothing from M3/M4.)

### 2. Obtain + prepare the land-use sources

- **OSM (the workhorse; © OpenStreetMap contributors, ODbL 1.0 — share-alike, attribution required).**
  Download an extract (Geofabrik `england-latest.osm.pbf`, or Overpass for the bbox) and convert each
  relevant layer to WGS84 GeoJSON, clipped to the Canterbury bbox (same as everything else):

  ```bash
  ogr2ogr -f GeoJSON -t_srs EPSG:4326 -spat 1.00 51.22 1.20 51.32 \
    canterbury_osm_multipolygons.geojson england-latest.osm.pbf multipolygons
  ogr2ogr -f GeoJSON -t_srs EPSG:4326 -spat 1.00 51.22 1.20 51.32 \
    canterbury_osm_points.geojson england-latest.osm.pbf points
  ```

  The importer merges GDAL's promoted columns (`landuse`, `amenity`, `shop`, `building`, …) with the
  `other_tags` hstore, so both point and polygon layers classify correctly.
- **Brownfield register (OGL v3).** Canterbury City Council publishes a Brownfield Land Register
  (CSV/GeoJSON). Convert to WGS84 GeoJSON if needed; every feature imports as `vacant_or_brownfield`.
- **Existing estate.** No download — a live-DB sync (step 3).
- *(Deferred but architecturally supported: OS functional sites, OS Open UPRN, planning history,
  Copernicus land-cover triage. Add later as more `import:land-use --source …` runs or `--fixed-class`
  layers; the fusion picks them up on the next `associate` with no schema change.)*

### 3. Import + sync

```bash
cd apps/web
npm run import:land-use -- --file /abs/path/canterbury_osm_multipolygons.geojson --source osm \
  --dataset "OpenStreetMap" --version 2026-08
npm run import:land-use -- --file /abs/path/canterbury_osm_points.geojson --source osm \
  --dataset "OpenStreetMap" --version 2026-08
npm run import:land-use -- --file /abs/path/canterbury_brownfield.geojson --source brownfield_register \
  --dataset "Canterbury Brownfield Land Register" --version 2026
npm run sync:store-land-use          # live stores → point evidence (class=retail, medium)
```

Each import prints its class histogram + how many features were unclassifiable (skipped — unknown
stays unknown). Re-running any import is safe (upsert on `source, source_reference`).

### 4. Associate + fuse + inspect — the M5 gate

```bash
npm run associate:candidate-land-use    # enrich the 8,226 universe (association + TS fusion; idempotent)
npm run inspect:candidate-land-use      # coverage + confidence + class distribution + source agreement
npm run export:land-use-debug-map       # standalone Leaflet HTML → artifacts/find-sites-m5/land-use-debug-map.html
npm run export:land-use-debug-map -- --only-unknown     # eyeball the unknowns — genuine gaps or missed signals?
```

`inspect:candidate-land-use` reports, via `candidate_land_use_coverage()` (two funnels, SEPARATE):
% with **any** signal, % **classified** (and its high/medium/low split), % **unknown** (retained),
the **class distribution**, **per-source contribution**, and **multi-source agreement vs conflict**
(where ≥2 sources overlap a site, do they agree on the class or disagree → `mixed`?).

**After running, record the numbers below, eyeball 20–30 sites on the debug map (especially
`--only-unknown`), and judge honestly whether combining OSM + brownfield + estate produces a land-use
signal good enough for the occupier search — then STOP and reassess before M6.** A qualified/negative
result ("open land use is inadequate at parcel level, because…") is an acceptable, valuable outcome.

### M5 findings

_Import + sync + association + fusion + inspection run 2026-08-24 against remote Supabase (on the
user's explicit request — a one-off waiver of the author-and-hand-off rule, as in M3/M4; do NOT assume
it generalises). Sources: OSM (`.osm.pbf` for a Canterbury rectangle → ogr2ogr `multipolygons` +
`points` layers, clipped to the pipeline bbox) + live SiteMatcher stores (bbox-scoped). Brownfield
register not yet added (optional; would only raise the `vacant_or_brownfield` count from its current 3)._

- **Land-use features imported:** **21,470** — OSM multipolygons 20,755 (residential 13,386, parking
  2,256, natural 1,627, agricultural 1,433, retail 612, leisure 519, community 377, food_drink 163,
  commercial 138, industrial 98, pub_bar 52, …), OSM points 638 (clean POIs: parking 300, retail 114,
  food_drink 73, community 49, pub_bar 26, fuel 4, …), stores 77. **Skipped as unclassifiable** (unknown
  stays unknown): 3,830 multipolygons (mostly bare `building=yes`) + 11,722 points (benches, trees,
  addresses, street furniture). **A real noise bug was caught + fixed during prep:** 1,030 `power=generator`
  POINTS (rooftop solar panels) were classifying as `utility` and would have mislabelled houses — the
  classifier is now geometry-aware (`power=generator` counts as utility only as an AREA), dropping point
  `utility` from 1,038 → 8 (test added).
- **Coverage (Funnel 1, ≥ 0.3 ac = 8,226):** any land-use signal **4,109 (50%)**; **classified 3,982
  (48%)**; **unknown (retained) 4,244 (52%)**. Confidence of the classified: **high 3,402 (85%)**, medium
  578, low 2 — i.e. most classifications rest on explicit OSM landuse/amenity/shop polygons, not weak
  building guesses. **Class distribution:** residential 1,719, agricultural 892, natural 630, **mixed 285**,
  leisure 109, retail 105, community 68, parking 60, commercial 48, industrial 40, construction 15,
  vacant_or_brownfield 3, food_drink 3, utility 3, transport 2. Source contribution: OSM 4,109 vs stores 63
  (only 63 of 77 stores fall in/near a ≥0.3-ac parcel). Multi-source (≥2 sources) sites: 63 — agree 20
  (32%), conflict 37 (59% → fused `mixed`).
- **Coverage (Funnel 2, drive-thru 0.3–0.7 ac = 3,084), reported SEPARATELY:** any signal 1,494 (48%);
  classified 1,453 (47%); unknown 1,631 (53%). High-confidence 1,314 / 1,453. Class mix is even more
  residential-dominated (residential 1,084, natural 115, mixed 74, agricultural 54, retail 38, …).
- **Visual inspection (debug maps, geographically varied 30-site samples — `artifacts/find-sites-m5/`):**
  the general sample split 18 unknown / 12 classified (natural/agricultural/residential high-confidence,
  one mixed, one retail) — consistent with the headline split and visually plausible against OSM. The
  `--only-unknown` sample confirms the unknowns are dominated by **interior/rural freehold parcels with no
  OSM landuse polygon** — genuine coverage gaps of the open source, not obvious missed signals. No
  systematic misclassification seen in the spot-check.

**Verdict — is fused open land use good enough for the occupier search?**

> **Qualified yes — it is now a real, mostly high-confidence discriminator on ~half the universe, which
> is enough to materially improve the search; but half stays unknown and must remain in the funnel.**
>
> The pivotal uncertainty moved from **0% → 48% classified, 85% of it high-confidence**. Crucially,
> **residential is the single largest class (1,719; 43% of classified, and 75% of the classified drive-thru
> band)** — so the M2 *hypothesis* that much of the sub-parcel population is residential is now, for the
> classified ≥0.3-ac parcels, **evidenced, not assumed**, and it is exactly the "not a roadside/drive-thru
> site" filter the occupier funnel most needs. Retail/commercial/food/fuel/pub/parking/vacant together are
> a small but usable positive minority (~330). So land use will act as a **discriminator among the
> classified** (exclude/deprioritise residential + agricultural + natural; surface retail/commercial/
> vacant/parking), while the **52% unknown is retained as `unknown`, never failed** — precisely the design.
>
> **It is NOT sufficient as a sole gate**, and two honest caveats bound it: (1) the 52% unknown correlates
> strongly with the **same interior/landlocked parcels that were already weak on roads (M3: 52% no mapped
> road ≤200 m) and traffic (M4: 85% no count point)** — so the occupier-relevant *roadside* subset is
> likely better-covered than the blended 48% suggests. A quick **land-use-coverage × road-coverage
> cross-tab is a cheap, high-value M9 input** to confirm this. (2) Absence of an OSM polygon is **not** a
> vacancy claim.
>
> **STOP / roadmap consequence: proceed to M6 (derived geometry) as planned — no milestone change needed.**
> Land use is adequate as a classified-half discriminator, the unknowns are handled honestly, and the
> biggest remaining lever (surfacing the roadside classified minority) is a search/ranking question for M9,
> not a data-collection gap to fix now.

> **Known coarseness carried forward (state plainly wherever land use is surfaced):** (1) store evidence is
> a broad `retail` class — a store proves *active commercial occupation*, but its brand category (food vs
> shop vs services) is deliberately not yet resolved. (2) `mixed` (285) is an honest multi-use flag from
> conflicting strong evidence, not an error. (3) a class is never a suitability/planning claim.

> **Two RPC caveats found at this data scale (the live scripts already work around them; a later tidy-up
> migration should fold the fixes in):** `candidate_land_use_coverage()` re-scans the 74k-row polygon table
> once per sub-metric and hits the statement timeout — `inspect:candidate-land-use` therefore computes the
> same authoritative counts client-side from paged pulls. `sync_store_land_use_features()` (the national
> variant) also times out — `sync:store-land-use` instead pulls only bbox stores via the existing
> `get_stores_in_bbox()` and feeds them through `import_land_use_features()`.

---

## Running M6 (derived geometry — frontage + junction proximity)

Migration authored here; **you apply it** and **run the scripts**. M6 needs **no new
download** — it reuses the OS Open Roads links + nodes (M3) and the M3 road associations.

### The design (why it is split the way it is)

- **`candidate_site_geometry`** (migration `20260730000000`) is the per-site derived-geometry
  table (the M6 analogue of `candidate_site_roads`/`_traffic`/`_land_use`), one row per site:
  - **Approximate frontage** — the length of the parcel boundary running alongside its road,
    measured as *(parcel boundary) ∩ (road buffered by `frontage_buffer_m`)* in **British
    National Grid metres**. Computed against BOTH the site's **nearest-overall** road and its
    **nearest classified (A/B/Motorway)** road (from the M3 `is_nearest_overall` /
    `is_nearest_in_primary_class` flags), so frontage onto an A road amid minor access roads is
    never lost.
  - **Nearest significant junction / roundabout** — distance to the nearest OS `RoadNode` whose
    `formOfRoadNode` is a real `junction` or `roundabout` (road ends / pseudo nodes excluded),
    with the roundabout distance surfaced separately.
  - `has_associated_road` records whether M3 found *any* road, so a **measured zero** frontage
    ("road nearby, no abutting edge") is never confused with an **unknown** one ("no road").
- **The interpretation is pure TypeScript, Jest-tested** (not in SQL, where it would be hard to
  test and easy to get wrong): `apps/web/src/lib/site-matching/geometry-screening.ts`
  (`classifyFrontage` / `classifyJunction` / `screenSiteGeometry` / `toSiteGeometryFeatures`)
  turns raw metres into hedged bands (`unknown` / `none` / `narrow` / `moderate` / `wide`;
  junction `at` / `near` / `moderate` / `far`) and **enforces `unknown` ≠ `zero`**. Run the
  tests: `cd apps/web && npm test -- src/lib/site-matching` (27 M6 tests, 116 total). The
  engine's existing `road_frontage` / `junction_distance` evaluators already read `frontageM` /
  `nearestJunctionDistanceM` / `junctionType`; M6 is what finally populates them with real values.

### 1. Apply the migration

Apply `supabase/migrations/20260730000000_associate_candidate_geometry.sql`. It creates
`public.candidate_site_geometry`, the service-role write RPC `associate_candidate_site_geometry()`,
and the read RPCs `candidate_geometry_coverage()` / `debug_site_geometry_map()`. Requires M2
(sites) and M3 (roads + nodes + `candidate_site_roads`) already applied.

### 2. Associate + inspect — the M6 gate

```bash
cd apps/web
npm run associate:candidate-geometry   # enrich the 8,226 universe (frontage + junction; idempotent)
npm run inspect:candidate-geometry     # frontage (unknown-vs-measured) + junction coverage, two funnels
npm run export:geometry-debug-map      # standalone Leaflet HTML → artifacts/find-sites-m6/geometry-debug-map.html
npm run export:geometry-debug-map -- --only-with-frontage   # bias the sample to measured-frontage sites
```

Tunable params (defaults chosen to be *eyeballed on the debug map*, not asserted):
`--frontage-buffer 12` (metres from centreline that count as fronting — centrelines sit ~half a
carriageway off the kerb), `--junction-radius 500`, `--frontage-min 20` / `--junction-max 100`
(occupier-funnel thresholds for the drive-thru report only).

**After running, record the numbers below, eyeball 20–30 sites on the debug map (does the green
frontage segment run along the edge the parcel actually presents to the road? is the nearest
junction the right one, not one across a barrier?), and judge whether frontage/junction are a
usable screening signal — then STOP before M7.** Also compute the queued **land-use × road-coverage
cross-tab** (a cheap M9 input: does the classified subset concentrate on roadside parcels?).

### M6 findings

_Association + inspection run 2026-08-24 against remote Supabase (on the user's explicit request — a
one-off waiver of the author-and-hand-off rule, as in M3/M4/M5; do NOT assume it generalises). User
applied the migration; association wrote **one candidate_site_geometry row per site (8,226)**,
frontage_buffer 12 m, junction_radius 500 m._

- **Frontage coverage (Funnel 1, ≥ 0.3 ac = 8,226):** frontage **unknown (no road associated) = 4,317
  (52%)**; **measured = 3,909 (48%)** — of which none/no-abutting-edge 617 (16%), narrow <10 m 29 (1%),
  moderate 10–40 m 710 (18%), **wide ≥40 m 2,553 (65%)**; positive-frontage p50 = **72.7 m**, p90 = 267.4 m.
  Frontage ≥ 20 m = **3,163 (38% of the universe)**; onto a **classified (A/B/Motorway) road** = 635 (of
  1,599 sites that have a classified road associated).
  - **The unknown/measured split is EXACTLY the M3 road split** — 4,317 unknown = M3's "no mapped road
    ≤200 m", 3,909 measured = M3's "road ≤200 m". Frontage is measured precisely for the roadside subset
    and stays `unknown` (never a fabricated 0) for the landlocked interior. The `unknown ≠ zero` rule holds
    on the real data.
- **Junction proximity (Funnel 1):** with a significant node (junction/roundabout) ≤ 500 m = **3,902
  (47%)**; within 100 m = 2,942 (36%); p50 = **30.7 m**, p90 = 230.4 m; with a roundabout nearby = 825.
  Bands: at ≤25 m 1,830 (47%), near ≤100 m 1,112 (28%), moderate ≤300 m 734 (19%), far >300 m 226 (6%).
  Junctions are dense — any roadside parcel is typically within ~30 m of one.
- **Funnel 2 — drive-thru (0.3–0.7 ac = 3,084), reported SEPARATELY:** frontage unknown 1,640 (53%),
  measured 1,444 (47%; none 210, moderate 370, wide 852), positive p50 = 53.5 m; frontage ≥ 20 m = 1,177
  (38%); onto a classified road 226 (of 628). Junction present 1,435 (47%), within 100 m 1,154 (37%),
  p50 = 35.6 m; roundabout nearby 343.
- **Geometry verification (in lieu of the debug map, which renders only as a static snapshot in the
  preview pane — the maps are in `artifacts/find-sites-m6/` for manual review):** two physical invariants
  checked over all 3,909 measured sites — **`frontage_m ≤ perimeter_m`: 0 violations**; **`frontage > 1 m`
  ⟹ nearest road within the 12 m buffer: 0 violations**. The **frontage/perimeter ratio** is p10 = 0.05,
  **p50 = 0.20**, p90 = 0.43, **max = 1.00** — i.e. the median parcel presents ~one side (20% of its
  perimeter) to the road and nothing exceeds its own boundary. So the high "wide ≥40 m" share is the
  large-parcel skew of the ≥0.3-ac universe (20% of a 10-acre field's perimeter is already 100 m+), **not**
  buffer over-capture. The 12 m buffer is validated for this network.

**Verdict — is derived frontage/junction a usable screening signal?**

> **Yes — a geometrically-verified screening signal on the roadside ~48%, perfectly aligned with the M3
> road subset, with the `unknown` half preserved (never a fabricated "no frontage").** Frontage grades the
> roadside parcels (moderate/wide dominate; a usable ≥20 m subset of 3,163, and a smaller 635 fronting a
> classified road for the drive-thru case), and junction proximity is dense and plausible. Both are
> **documented approximations from open centreline data** — screening inputs for M9 ranking, never a
> surveyed frontage or a highways/access verdict. The 12 m frontage buffer needed no tuning (0 invariant
> violations, ratio max 1.00). **STOP / roadmap consequence: proceed to M7 (existing estate / same-brand
> distance) as planned — no milestone change needed.** The land-use × road-coverage cross-tab remains
> queued as a cheap M9 input.

**Frontage bug found + fixed (migration `20260731000000_fix_frontage_all_roads.sql`).** The first cut
measured frontage against only the single `is_nearest_overall` road, producing FALSE ZEROS where that link
touches a parcel at a corner / crosses it (distance ~0, ~0 frontage) while the road the parcel actually
fronts — often an A/B road a few metres away — was ignored. Diagnosed on real data (e.g. `bd2e14ea` measured
a Not-Classified corner link @0 m → 0 frontage, but **fronts the A28 @4.2 m for 212 m**; `360fa0d0`→A291
214 m; `8828ee02`→B2068 89 m). Fix: **frontage_m is now the boundary within the buffer of the UNION of ALL
associated roads**, and frontage_road_* is the road contributing the most frontage. After re-running: the
measured-zero ("none") count fell **617 → 600** (the 17 clear wrong-road cases recovered) and positive-frontage
p50 rose **72.7 → 116.9 m** (union captures every road a parcel faces, not just one — note this makes frontage_m
a *total road-facing* measure; the single-access-road view is `primary_frontage_m` / the per-road diagnostic).
Added **`debug_candidate_frontage_by_road()`** — per-road frontage breakdown for any site (used to confirm the
fix) — and the debug map now draws all associated roads + the union frontage segment. **Still open:** ~600
"set-back" parcels whose nearest road is >12 m from the boundary stay at 0 frontage — a `frontage_buffer_m`
tuning question (verge/pavement width), deferred pending an eyeball of whether a wider buffer helps or bleeds.

**Run gotchas fixed live (now in the code):** (1) the write RPC's per-site buffer/intersection frontage
maths is heavier than M3's distance-only association — **batch 200 hit the statement timeout; batch 40
completes the 8,226 universe in ~70 s** (use `--batch 40`; the union re-run uses `--batch 25`). (2) `candidate_geometry_coverage()` re-scans
the 74k `candidate_sites` table per sub-metric and **times out** (the same trap as M5's
`candidate_land_use_coverage()`) — `inspect:candidate-geometry` was rewritten to compute the same
authoritative counts **client-side** from paged pulls of `candidate_sites` + `candidate_site_geometry`.
The RPC remains in the applied migration but is unused/timeout-prone (a later tidy-up migration should
materialize its `universe` CTE, as flagged for M5).

---

## Running M7 (existing estate — same-brand distance)

Migration authored here; **you apply it** and **run the scripts**. M7 needs **no new
download** — it reads the live SiteMatcher `stores` estate.

### The design (why M7 is different from M3–M6)

M3–M6 are **occupier-agnostic enrichment**: computed once per candidate site and stored,
because roads/traffic/land-use/geometry don't depend on who is searching. **Same-brand
distance does** — a KFC brief cares about KFC's estate, a Costa brief about Costa's — so it
is a **search-time, per-brand** calculation, **not** baked into the reusable dataset. Hence
M7 adds **no `candidate_site_*` table**; it adds read-only RPCs the (future M9) search
service calls per brand, plus a debug map.

- **`nearest_same_brand_store()`** (migration `20260732000000`) — for a batch of sites and a
  `brand_id` (optionally narrowed to a fascia set), the nearest store of that brand and its
  distance (parcel-polygon → store-point, geography metres), plus the brand's total estate
  size. **"Same brand" = the PARENT-GROUP estate** (nearest store of *any* fascia the brand
  operates). Computed **uncapped** by default so a real nearest distance is always available
  for the ≥ N-mile test; `p_max_dist_m` bounds it for performance. `brand_estate_summary()`
  and `debug_site_brand_map()` are the run-header + debug-map read RPCs.
- **The interpretation is pure TypeScript, Jest-tested** (not SQL):
  `apps/web/src/lib/site-matching/brand-distance.ts` (`classifyBrandDistance` /
  `toBrandDistanceFeatures` / `describeBrandDistance`). It protects the load-bearing rule
  that **a brand with no estate is SATISFIED, never `unknown`** (nothing to cannibalise) —
  existing-estate distance is one of the few criteria with **no unknown state** (a store's
  location is precisely known). It also maps the raw distance onto the engine's existing
  `same_brand_distance` criterion fields (`sameBrandDistanceM` / `brandHasStores`), which M7
  populates with real values for the first time. Run the tests:
  `cd apps/web && npm test -- src/lib/site-matching` (16 M7 tests, 132 total).

### 1. Apply the migration

Apply `supabase/migrations/20260732000000_same_brand_distance.sql`. It creates the read-only
RPCs `nearest_same_brand_store()`, `brand_estate_summary()`, `debug_site_brand_map()`.
Requires M2 (candidate_sites) applied and a populated `stores` estate.

### 2. Inspect — the M7 gate

Same-brand distance is per-brand, so first pick a brand actually present near Canterbury,
then report the distance distribution across the universe:

```bash
cd apps/web
npm run inspect:candidate-brand -- --list-brands            # brands with stores in the Canterbury bbox
npm run inspect:candidate-brand -- --brand <brand_id>       # distance distribution (two funnels, separate)
npm run inspect:candidate-brand -- --brand-name "costa"     # or resolve a brand by name
npm run export:brand-debug-map  -- --brand <brand_id>       # Leaflet HTML → artifacts/find-sites-m7/brand-debug-map.html
```

`inspect:candidate-brand` reports, per funnel: how many sites have a nearest same-brand store,
the nearest-distance p50/p90/min/max, the distance bands (at ≤ 0.25 mi / near ≤ 1 mi / moderate
≤ 3 mi / clear > 3 mi — screening only), and how many sites **PASS** a `≥ --min-miles`
same-brand-distance rule (the occupier funnel; a brand with no estate passes trivially).
`--fascia <uuid,…>` narrows to specific fascias. Counts are computed **client-side** from
batched RPC calls, so nothing re-scans the 74k table (the M5/M6 timeout lesson).

**After running, record the numbers below, eyeball 20–30 sites on the debug map (does the line
run to the store a human would call nearest? does the distance look right?), and confirm the
criterion behaves — then STOP before M8.**

### M7 findings

_Inspection + debug map run 2026-08-24 against remote Supabase (on the user's explicit
request — a one-off waiver of the author-and-hand-off rule, as in M3–M6; do NOT assume it
generalises). No download: read the live SiteMatcher `stores` estate. Validation brand =
**McDonald's** (the running drive-thru occupier example); **Sainsburys** as a multi-fascia
parent-group cross-check._

- **The estate, per brand (parent-group = all fascias):** McDonald's 1,497 stores across
  2 fascias (2 inside the Canterbury bbox); Sainsburys 1,485 stores across 2 fascias (4 in
  the bbox — Sainsbury's + Sainsbury's Local, so the group rollup genuinely spans fascias).
- **Coverage is 100% by construction, and that is the point.** Unlike roads/traffic/land-use,
  same-brand distance is never `unknown` for a brand that has an estate: every one of the
  8,226 sites has *some* nearest same-brand store, so all 8,226 get a real distance. The
  signal is the **distance distribution**, not a coverage gap.
- **Funnel 1 — McDonald's, ≥ 0.3 ac = 8,226:** nearest-store distance p50 = **3.00 mi**,
  p90 = 5.51 mi, min = **0.00 mi** (a candidate parcel essentially on top of an existing
  restaurant), max = 7.61 mi. Bands: at ≤ 0.25 mi **133 (2%)**, near ≤ 1 mi **1,112 (14%)**,
  moderate ≤ 3 mi 2,869 (35%), clear > 3 mi **4,112 (50%)**. Occupier rule **≥ 1 mi from the
  existing estate: PASS 6,981 (85%)**, too close (< 1 mi) 1,245 (15%).
- **Funnel 2 — drive-thru band (0.3–0.7 ac = 3,084), SEPARATE:** p50 = 2.67 mi, p90 = 5.26 mi;
  at 53 (2%), near 550 (18%), moderate 1,137 (37%), clear 1,344 (44%); **≥ 1 mi PASS 2,481
  (80%)**, too close 603 (20%). The drive-thru band sits slightly closer to the estate than
  the whole universe (Canterbury's McDonald's are on the arterial roads the band also favours).
- **Sainsburys cross-check (multi-fascia rollup working):** denser locally (4 in bbox) → p50
  = **2.08 mi** (tighter than McDonald's), at 314 (4%), near 1,572 (19%), moderate 3,707 (45%),
  clear 2,633 (32%); ≥ 1 mi PASS 6,340 (**77%**). The parent-group semantics matter: the
  nearest store is drawn from *both* fascias, exactly as intended.
- **Geospatial correctness VERIFIED programmatically** (the debug map renders only as a static
  snapshot in the preview pane — the HTML is in `artifacts/find-sites-m7/` for manual review):
  for 36 varied sites the RPC's chosen nearest store **matched a brute-force nearest over the
  full 1,497-store estate on every one (0 mismatches)**, and the RPC's **polygon-edge distance
  was ≤ the centroid distance on every one** (e.g. 630 m edge vs 697 m centroid) — i.e. it
  correctly measures parcel-edge → store, always at/inside the centroid distance. No systematic
  error.

**Verdict — is same-brand distance a usable, honest signal?**

> **Yes — and it is the cleanest criterion in the pipeline: a precise, 100%-covered, per-brand
> distance with no `unknown` state.** For a brand with an estate it ranks/filters every
> candidate by proximity to the existing network (a genuine cannibalisation screen: 15% of the
> universe / 20% of the drive-thru band sit within 1 mile of an existing McDonald's); for a
> brand with **no** estate it is trivially SATISFIED (nothing to cannibalise), never unknown —
> the one criterion whose absence-of-data is a real answer, not a gap.
>
> **Architecturally it confirms the two-funnel design end-to-end:** same-brand distance is NOT
> baked into the occupier-agnostic dataset (it depends on the searching brand), so M7 adds no
> `candidate_site_*` table — just search-time RPCs the M9 search service calls per brand. It
> finally populates the engine's long-stubbed `same_brand_distance` criterion
> (`sameBrandDistanceM` / `brandHasStores`) with real values. **STOP / roadmap consequence:
> proceed to M8 (constraints: Flood + Green Belt) as planned — no milestone change needed.**

> **Coarseness carried forward (state wherever it is surfaced):** (1) distance is parcel-polygon
> → store-point (open store coordinates), a straight-line screen, not a drive-time isochrone —
> a store 1 mi away across a river/motorway may not actually compete. (2) "Same brand" = the
> parent-group estate; a group operating distinct formats (e.g. a large format vs a convenience
> fascia) may want a per-fascia rollup — the RPC already supports `--fascia` for that. (3) A
> large distance means "clear of the existing estate", never "a good site".

**Run gotchas fixed live (now in the code + migration `20260733000000`):** (1) the per-site
nearest LATERAL filtered `stores` by `brand_id` *inside* the loop, so Postgres re-scanned the
national table once per site → statement timeout; the fix **materializes the brand estate once**
(`WITH … AS MATERIALIZED`) then KNNs each site against that small set. (2) `inspect`'s
universe-id fetch used offset `.range()` paging over the 74k table — a deep OFFSET is O(offset)
and one page blew the timeout (~17 s for the full walk); switched to **keyset pagination** on the
PK (`id > :last`), constant per page. (3) the RPC comfortably does ~7–10 ms/site but a 500-batch
(~3.6 s) straddles the statement-timeout budget → **default batch 150** (~1.1 s). (4) the debug
map's centroid fetch hit `universe_site_centroids` (recomputes all centroids per call, capped at
1,000 rows) via offset paging → timeout; it now draws a **single 1,000-row pool** to grid-sample
25 from (ample for an eyeball). (5) a field-name mismatch in `inspect` (`distanceM` vs
`nearestDistanceM`) silently nulled every distance until the raw RPC output was inspected — a
reminder that a `x as T` cast hides missing fields.

---

## Running M8 (constraints — EA Flood Zones + English Green Belt)

Migrations authored here; **you apply them** and **download the two open constraint layers**.
M8 returns to **occupier-agnostic enrichment** (like M3–M6): intersect every candidate site
with authoritative constraint polygons and record *which* constraints touch it and over how
much of its area. Severity (exclude vs warn vs prefer) is **not** decided here — it is an
occupier search-time decision made by the engine's `planning_constraints` evaluator.

### The design (why it is split the way it is)

- **`constraint_features`** (migration `20260734000000`) is the source-agnostic constraint
  polygon substrate (the M8 analogue of `road_links` / `land_use_features`): one row per
  source polygon, normalised to a constraint **token** (`flood_zone_2` / `flood_zone_3` /
  `green_belt` / …) + a broad `category` (`flood` / `green_belt` / `other`), with raw tags
  retained. Constraints are **areas** — points/lines are skipped. `import_constraint_features()`
  bulk-upserts pre-normalised GeoJSON (service-role).
- **`candidate_site_constraints`** (migration `20260735000000`) is the association: **one
  aggregated row per (site, constraint_type)**. A flood zone arrives as many polygons, so the
  write RPC `associate_candidate_site_constraints()` **UNIONs** every intersecting feature of a
  type and stores the union's **area-fraction of the site**. Idempotent per site; recomputes
  against ALL `constraint_features`, so importing another layer and re-running picks it up.
- **The interpretation is pure TypeScript, Jest-tested** (not SQL):
  `apps/web/src/lib/site-matching/constraint-screening.ts` — `normaliseConstraintType()` (the
  importer's classifier: EA/Green-Belt labels → a normalised token, unmappable → `null` so
  unknown stays out), `classifyOverlap()` (share-of-parcel bands `none`/`marginal`/`partial`/
  `majority`/`within`, where a sub-epsilon corner **clip is a near-miss, not an intersecting
  constraint**), and `screenSiteConstraints()` / `toSiteConstraintFeatures()` which produce the
  **`constraints: string[]` tokens the engine consumes** plus hedged notes. It protects the two
  M8 invariants: **absence is honest** ("not within the mapped Flood Zone 2/3 / Green Belt", NOT
  "no flood risk / no nearby designation"), and **nothing is a suitability/planning verdict**.
  Run the tests: `cd apps/web && npm test -- src/lib/site-matching` (15 M8 tests, 147 total).
- Coverage is reported **client-side** by `inspect:candidate-constraints` (paged pulls), not via
  a coverage RPC — every prior enrichment coverage RPC (M5 land use, M6 geometry) re-scanned the
  74k `candidate_sites` table per sub-metric and hit the statement timeout, so M8 does not add one.

### 1. Apply the migrations

Apply, in order: `supabase/migrations/20260734000000_create_constraint_features.sql`, then
`supabase/migrations/20260735000000_associate_candidate_constraints.sql`. Requires M2 (sites)
applied and PostGIS.

### 2. Obtain + prepare the constraint layers (both open)

- **EA Flood Map for Planning — Flood Zones 2 & 3** (OGL v3; © Environment Agency). Download
  each zone (a separate layer) from the DEFRA Data Services Platform / `environment.data.gov.uk`
  ("Flood Map for Planning: Rivers and Sea Flood Zone 2", and "…Flood Zone 3"). Source is
  usually EPSG:27700 — reproject + clip to the Canterbury bbox (same as everything else):

  ```bash
  ogr2ogr -f GeoJSON -t_srs EPSG:4326 -spat 1.00 51.22 1.20 51.32 \
    canterbury_flood_zone_3.geojson "Flood Map for Planning Rivers and Sea Flood Zone 3.shp"
  ogr2ogr -f GeoJSON -t_srs EPSG:4326 -spat 1.00 51.22 1.20 51.32 \
    canterbury_flood_zone_2.geojson "Flood Map for Planning Rivers and Sea Flood Zone 2.shp"
  ```

- **English Green Belt** (OGL v3; © Crown copyright / MHCLG). Download the national Green Belt
  dataset, reproject + clip to Canterbury the same way (`canterbury_green_belt.geojson`).

### 3. Import

```bash
cd apps/web
npm run import:constraints -- --file /abs/path/canterbury_flood_zone_3.geojson \
  --constraint-type flood_zone_3 --source ea_flood_map --dataset "EA Flood Map for Planning" --version 2026-08
npm run import:constraints -- --file /abs/path/canterbury_flood_zone_2.geojson \
  --constraint-type flood_zone_2 --source ea_flood_map --dataset "EA Flood Map for Planning" --version 2026-08
npm run import:constraints -- --file /abs/path/canterbury_green_belt.geojson \
  --constraint-type green_belt --source green_belt --dataset "English Green Belt" --version 2026
```

The constraint type is normally FIXED per file (`--constraint-type`); for a mixed file pass
`--type-property <prop>` and the importer reads the raw type per feature. Only polygonal
features are stored; a feature whose type cannot be mapped is skipped (unknown stays out).
Re-running is safe (upsert on `source, constraint_type, source_reference`).

### 4. Associate + inspect — the M8 gate

```bash
npm run associate:candidate-constraints   # enrich the 8,226 universe (idempotent per site)
npm run inspect:candidate-constraints      # coverage per constraint type, two funnels SEPARATE
npm run export:constraint-debug-map        # standalone Leaflet HTML → artifacts/find-sites-m8/constraint-debug-map.html
npm run export:constraint-debug-map -- --only-constrained   # bias the sample to constrained sites
```

The union-of-intersections maths is heavier than a distance association, so the associate
default batch is **40** (as with M6's frontage) — tune with `--batch`.

`inspect:candidate-constraints` first lists **which layers were actually loaded** (so an absent
layer is never mistaken for a clean site), then reports two funnels: how many sites intersect
each constraint type, the overlap-band distribution, flood/green-belt combinations, and how many
are **clear** of every loaded layer.

**After running, record the numbers below, eyeball 20–30 sites on the debug map (does the parcel
really sit within the drawn flood/green-belt extent? is a corner-clip near-miss correctly NOT
treated as an intersection?), and confirm the tokens are plausible — then STOP before M9.** Also
compute the still-queued **land-use × road-coverage cross-tab** (a cheap M9 input) if not already.

### M8 findings

_Import + association + inspection + verification run 2026-08-24/25 against remote Supabase (on
the user's explicit request — a one-off waiver of the author-and-hand-off rule, as in M3–M7; do
NOT assume it generalises). Sources: EA Flood Map for Planning (Rivers and Sea) Flood Zones 2 & 3
(OGL, © Environment Agency — a single combined national GeoJSON, `flood_zone` = FZ2/FZ3, already
CRS84) + English Green Belt (OGL, planning.data.gov.uk / MHCLG). The national flood GeoJSON is
**13.25 GB uncompressed** — clipped to the Canterbury bbox straight from the file with
`ogr2ogr -spat` (no reprojection needed; disk was too tight to keep a second copy)._

- **Imported:** flood **726 features** in the Canterbury bbox (**FZ3 400 + FZ2 326**; one combined
  file imported with `--type-property flood_zone`, `FZ2`/`FZ3` → `flood_zone_2`/`flood_zone_3`).
  **Green Belt 0 features** — see below. Association over the 8,226 universe → **1,138
  `candidate_site_constraints` rows** (one aggregated row per site × constraint type).

- **Green Belt is genuinely ZERO for Canterbury** — not a data error. The national Green Belt file
  (181 features) clips to **0** in the Canterbury bbox; a sanity clip to a west-Kent bbox
  (Dartford/Sevenoaks) returns 11 features (Metropolitan Green Belt), so the pipeline works and
  **Canterbury/east Kent simply lies outside any designated Green Belt**. Recorded honestly (the
  inspect report lists only the flood layers as loaded). Flood zones are the only active constraint
  layer for this MVP geography.

- **Funnel 1 — enrichment universe (≥ 0.3 ac = 8,226):** any constraint intersecting **603 (7%)**;
  **clear of all loaded layers 7,623 (93%)**. **Flood Zone 3 = 530 (6%)** — overlap bands marginal
  111 / partial 145 / **majority 159 / within 115** (i.e. **274 sites are ≥ half within FZ3**);
  **Flood Zone 2 = 462 (6%)** — mostly marginal 243 / partial 181 (only 36 majority, 2 within),
  consistent with FZ2 being the outer fringe a parcel typically only clips. Green Belt 0.
- **FZ2/FZ3 are NOT strictly nested in the published product** (a real EA data property, not a bug):
  of the flood-intersecting sites, **both = 389, FZ3-only = 141, FZ2-only = 73**. The two layers are
  independent polygon sets (coastal/defended areas can be FZ3 without a mapped FZ2; a fringe can be
  FZ2 without FZ3), so the engine treats each token independently and never infers one from the
  other. (The screening note that "FZ3 sits within FZ2 by definition" is a risk-definition remark,
  not a geometric assumption.)
- **Funnel 2 — drive-thru subset (0.3–0.7 ac = 3,084), reported SEPARATELY:** any constraint 171
  (6%); FZ3 142 (5%; majority 49 / within 36), FZ2 132 (4%); clear 2,913 (94%). The drive-thru band
  is slightly less flood-exposed than the whole universe.

- **Verification (the debug map renders only as a static snapshot in the preview pane — HTML in
  `artifacts/find-sites-m8/` for manual review, so invariants were checked programmatically):**
  - **Overlap invariant holds: 0 rows with `overlap_fraction > 1`** after a clamp. (Found + fixed
    during the run: 28 parcels sitting *fully* within a flood zone recorded `1 + ≤ 2.3e-7` — pure
    floating-point noise between the geodesic intersection area and the M2-stored `area_sqm`. Fixed
    with `LEAST(…, 1.0)` at write time in fix-migration `20260736000000` and a one-off clamp of the
    live rows.) `overlap_fraction ∈ (0, 1]` on all 1,138 rows.
  - **Near-miss handling verified on real data:** e.g. site `d6890eec` stores an FZ3 overlap of
    **0.009** (a corner clip below the 0.01 screening epsilon) → `constraint-screening.ts` correctly
    bands it `none` and does **not** emit an `flood_zone_3` token, while still retaining the row for
    inspection. A marginal touch never fabricates a constraint.
  - **Association spot-check (debug map, 24 geographically-spread constrained sites):** tokens are
    physically coherent — `06bc2468` fully within FZ3 (frac 1.0), `f60e5f92` FZ2 0.505 + FZ3 0.099
    (a parcel half in the outer zone with a smaller FZ3 core), all sampled sites fall in the Stour
    valley / coastal margins where flood zones actually are. No systematic mis-association.

**Verdict — is constraint enrichment a usable, honest screening layer?**

> **Yes — a precise, authoritative, well-behaved screening layer, though a thin one for this
> geography.** Flood Zones flag **7% of the universe (6% touching the planning-significant Zone 3,
> and 274 sites sitting ≥ half within it)** with a graded overlap fraction, verified against the real
> EA extents and with the unknown/near-miss/invariant rules all holding on real data. It populates
> the engine's long-present `planning_constraints` evaluator with real tokens for the first time.
>
> **Two honest bounds, both by design, neither a defect:** (1) **Green Belt is absent in Canterbury**
> — a real geographic fact, so this MVP exercises only the flood layer; the Green Belt path is proven
> to work (non-zero on west Kent) and needs only a geography with Green Belt to light up. (2) A flood
> intersection is a **screening flag requiring a formal flood-risk assessment, never a
> suitability/planning verdict**, and **"clear" means "not within the mapped Flood Zone 2/3", not "no
> flood risk"** — severity (exclude/warn/prefer) stays an occupier search-time decision. **STOP /
> roadmap consequence: proceed to M9 (first real recall-favouring search + known-site recall test +
> go/no-go) as planned — no milestone change needed.** The land-use × road-coverage cross-tab remains
> the one cheap queued M9 input.

**Run gotchas fixed live (now in the code + fix-migration `20260736000000`):** (1) the inspect + associate
+ export universe fetches used offset `.range()` over the 74k `candidate_sites` table → statement
timeout; switched all to **keyset** (`id > :last`, seeded with the zero-UUID) — the M7 lesson, now
applied to M8 from the start of the real run. (2) `overlap_fraction` float-exceeding 1 (above). (3) the
debug-map export hit **three** separate scale traps against the 13 GB-derived data: the
`universe_site_centroids` RPC times out (recomputes all centroids per call) → replaced with a keyset
pull of `candidate_sites` + **client-side EWKB-hex centroid decode**; a **500-UUID `.in()` list** made an
over-long URL ("fetch failed", the M5 trap) → chunked to 100; and EA flood **multipolygons are large
enough that a multi-site `debug_site_constraint_map` response fails the fetch** → the export now calls the
RPC **per site** and skips any single oversized response (0 skipped at radius 150).

---

## Running M9 (first real recall-favouring search + known-site recall + go/no-go)

M9 is the payoff milestone: the first end-to-end search over the real Canterbury universe. It adds **no
new enrichment table** — it *assembles* what M2–M8 already built into the engine's `SiteFeaturesRaw` and
runs the pure engine (criteria/scoring/diagnostics) over a worked occupier brief, then measures the result.

### The design (why it is split the way it is)

- **`src/lib/site-matching/feature-assembly.ts` (PURE, Jest-tested).** Maps grouped enrichment rows →
  `SiteFeaturesRaw`. Encodes the load-bearing rules: `roads = null` only when association never ran
  (unknown) vs `[]` when it ran and found no mapped road (a screening negative, not "no access"); AADF is
  attached to the **same road the parcel fronts** via M4's `via_road` method (direct count points ignored);
  land use / frontage / junction / constraints / same-brand distance flow through the already-tested M5–M8
  modules. Also `crossTabLandUseRoad()` — the **queued land-use × road cross-tab**.
- **`src/lib/site-matching/search-analysis.ts` (PURE, Jest-tested).** `knownSiteRecall()` (rank / eligibility
  / top-N / universe-miss of ground-truth sites) + `shortlistQuality()` (label mix + score span).
- **`scripts/find-sites-search.ts` (IO).** Keyset-paginated fetch of the universe + all enrichment + the M7
  same-brand RPC (batched 150), assemble (pure), `scoreAndRank` + `buildFunnel` (pure), recall test, cross-tab,
  and an explicit feasibility report → `artifacts/find-sites-m9/findings.md` + `results.json`.
- **`scripts/export-find-sites-results-map.ts` (IO).** Leaflet map of the top-N parcels (coloured by label)
  + roads + the known-store recall points, from `results.json`.
- **Migration `20260737000000_find_sites_search_helpers.sql`.** One read-only RPC
  `find_candidate_sites_for_stores()` — maps existing brand stores to the candidate parcel they fall in /
  are nearest to, within the searchable universe, for the recall test. No writes, no new tables.

**Recall-favouring requirement (the M9 rule):** only *hard* criteria are `required` and eliminate — plot
**area** (drive-thru band), an **excluding flood zone** (`flood_zone_3`), and **same-brand cannibalisation**
(≥ N miles). Road proximity / traffic / frontage / junction / land use are all `preferred`: they **rank but
never eliminate**, and unknowns stay neutral. So the funnel keeps recall high and the *ranking* does the work.

### 1. Apply the migration (user)

```
supabase migration up   # applies 20260737000000_find_sites_search_helpers.sql
```

(All M2–M8 migrations + the M3–M8 associate steps must already be applied/run — M9 reads their output.)

### 2. Run the search + recall + report (author-and-hand-off DEFAULT)

Per the standing agreement I **author and hand off**; the M3–M8 remote runs were one-off waivers and do
**not** generalise. Run from `apps/web`:

```
npm run find-sites-search -- --list-brands                 # pick a brand present near Canterbury
npm run find-sites-search -- --brand-name "mcdonald"       # the worked drive-thru example
npm run export:find-sites-results-map                       # Leaflet map of the top-20 + recall points
```

Useful flags: `--dt-min/--dt-max` (drive-thru area band, default 0.3–0.7 ac), `--min-aadf` (default 10,000,
preferred), `--min-miles` (same-brand hard gate, default 1), `--top` (shortlist size, default 20),
`--fascia <uuid,uuid>`, `--bbox`, `--out <dir>`. Output lands in `artifacts/find-sites-m9/`.

### M9 findings

_Search run 2026-08-25 against remote Supabase (on the user's explicit request — a one-off waiver of the
author-and-hand-off rule, as in M3–M8; do NOT assume it generalises). Worked brief: a **McDonald's**
drive-thru (brand `8de3e17c…`, 2 fascias) — the M7-validated brand, present with 2 stores near Canterbury.
Recall-favouring requirement: hard gates = area 0.3–0.7 ac, exclude `flood_zone_3`, same-brand ≥ 1 mi;
road/traffic/frontage/junction/land-use all `preferred` (rank, never eliminate). Output in
`artifacts/find-sites-m9/` (`findings.md`, `results.json`, `results-map.html`)._

- **Candidate universe & coverage.** 8,226 sites (≥ 0.3 ac). Coverage of the universe: road **48%** (3,909),
  frontage **48%** (3,909), land use **48%** (3,982), junction **47%** (3,902), traffic **9%** (710) — the
  same roadside-vs-interior split M3–M6 measured, unchanged.

- **Funnel (recall-favouring — only the 3 hard gates eliminate; unknowns retained).**
  8,226 → **site_area** (0.3–0.7 ac) fail 5,142 → 3,084 → **planning_constraints** (exclude FZ3) fail 142 →
  2,942 → **same_brand_distance** (≥ 1 mi) fail 535 → **2,407 eligible (29%)**. The three hard filters do all
  the elimination; no soft criterion drops a site, and no gate reports `unknown` (area/flood/same-brand are
  known for every site).

- **Result quality — score saturation is real.** Eligible 2,407 / ineligible 5,819; labels **strong 649,
  potential 3,393, weak 4,184**. But the **top-20 shortlist is 20× strong, every one at 100%** (score span
  100 → 100%). This exposes a genuine limitation of the "% of KNOWN criteria matched" score: with lenient
  `preferred` thresholds and `unknown` excluded from the %, many sites trivially max it, so **the score does
  not discriminate at the top** — the ranking there rests entirely on the evidence-count tiebreak (a site
  measurable on 8/8 criteria outranks one on 7/7; 16 of the top 20 have traffic `unknown`). Not a bug in the
  engine (the rules are behaving as written), but the scoring needs to be made discriminating (see next lever).

- **Land-use × road cross-tab (the queued input) — strongly positive.**

  | | roadside (mapped road) | no mapped road |
  |---|---:|---:|
  | classified land use | **3,748** | 234 |
  | unknown land use | 161 | 4,083 |

  **P(classified land use \| roadside) = 96%** (3,748/3,909) vs **P(classified \| no mapped road) = 5%**
  (234/4,317). The land-use-classified subset concentrates almost entirely on the roadside parcels: among the
  3,909 roadside sites, land use is known for 96%. So the well-covered core (roadside **and** classified) is
  ~3,748 sites and is near-fully covered, far better than the blended 48% headline suggests. This confirms the
  M5 hypothesis: the roadside subset an occupier actually cares about is much better covered than the universe
  average, and the 52% `unknown` is overwhelmingly the interior/landlocked parcels already weak on road/traffic.

- **Known-site recall — the headline feasibility result.** Both existing Canterbury McDonald's were **found:
  2/2 mapped to a candidate parcel, 2/2 inside the searched universe** — the substrate spatially covers real
  drive-thru locations. But **0/2 are eligible**, and crucially *not only* because of same-brand cannibalisation:
  relaxing the same-brand gate (`--min-miles 0`) the two parcels score **86% and 88% (strong)** on physical fit
  yet **still fail** — on **area**. They map to HMLR title parcels of **4.32 ac** (the whole Stour Retail Park)
  and **7.47 ac** (a St Georges Street city block), both far outside the 0.3–0.7 ac drive-thru band; each real
  McDonald's occupies a **sub-plot of a much larger enclosing title**. Land use on both is correctly `retail`
  (high confidence). **This re-evidences the M2 verdict at search time: HMLR INSPIRE titles are a *substrate*,
  not drive-thru-sized candidate units.** The pipeline localises the right place but the candidate *unit* is the
  wrong granularity for a small roadside format, and the area gate structurally rejects exactly the known-good
  locations.

- **Failure modes (as a prospecting instrument).** (1) **Footprint-smaller-than-title mismatch.** When an
  occupier's desired footprint is smaller than its enclosing registered title, a known small-format store maps
  to a whole title and the drive-thru *area gate* rejects it — the case above. This is a **disclosed limitation**
  of using registered titles as the screening unit, honestly surfaced; it is **not** a reason to generate
  speculative sub-plots now. It is handled at product level in M9.1 by **retaining oversized titles** (labelled
  "larger than requested footprint; may contain a suitable area") rather than eliminating them. (2) **Score
  saturation.** "% criteria match" reaches 100% too easily under lenient preferred thresholds + unknown-exclusion,
  so the top of the ranking is decided by the evidence-count tiebreak, not the score — corrected in M9.1 by
  transparent tiers + an evidence summary. (3) **Traffic sparsity persists** (9%), so `traffic_aadf` is `unknown`
  for most of even the shortlist — a positive signal on the minority that has it, never a low-traffic verdict.

- **Biggest next improvement.** A small **search-semantics + ranking correction (M9.1)**: retain oversized titles
  with honest labelling + a transparent penalty instead of failing them; replace the saturating suitability % with
  transparent tiers (Strong / Potential / Worth reviewing / Unlikely) + a passed/partial/failed/unknown evidence
  summary; and make the search generic (brand optional, preset briefs). Then the **M10 real-data prototype**.
  Speculative sub-plot generation / title assembly is explicitly deferred to a post-validation backlog.

- **Go / no-go: passed as a broad-brush prospecting instrument.** The full pipeline — engine, M3–M8 enrichment,
  feature assembly, recall-favouring search, funnel, cross-tab, and known-site recall — runs end-to-end on **real
  data**, produces hedged, inspectable, honest output, preserves `unknown`, and the recall test did its job by
  **disclosing a real limitation rather than hiding it**. **HMLR titles are useful as indicative registered
  freehold extents** for prospecting and must not be presented as exact development plots; the title-granularity
  finding is a **disclosed limitation, not a blocker**, specific to footprints smaller than their enclosing title.
  **Proceed to M9.1 (product-readiness correction) then M10 (real-data prototype)** — no plot refinement, no
  milestone block.

---

## Limitations (running list)

- Candidate polygons are *indicative* HMLR extents, not legal boundaries; a development site may span
  multiple titles or be a subdivision of one. Measured/reported at M2.
- No comprehensive open land-use dataset exists, so land use is **fused** from OSM + stores (+ optionally
  brownfield). Measured at M5: **48% of the ≥0.3-ac universe is classified (85% high-confidence), 52% stays
  `unknown`** and is retained (never failed). Absence of an OSM landuse polygon is **not** a vacancy claim;
  store evidence is a broad `retail` class (brand-category refinement deferred); `mixed` is an honest
  multi-use flag. A useful discriminator on the classified half, not a sole gate.
- Highways access is **never** inferred — always `unknown` / requires review.
- Traffic (DfT AADF) is sparse and major-road-biased: only ~15% of the ≥0.3-ac universe has a
  count point within reach, and most linkable AADFs are **Estimated (modelled), not Counted** —
  a positive screening signal on the roadside minority, never a low-traffic verdict on the
  un-counted majority. `estimation_method` is preserved on every row. Measured at M4.
- Frontage & junction proximity are documented approximations (M6), screening signals not engineering
  measurements.
- Constraints (M8: EA Flood Zones 2/3 + English Green Belt) are a **presence** screen from authoritative
  full-coverage national layers: an intersection is a **screening flag requiring review, never a
  suitability / developability / planning-permission verdict**, and "clear" means "not within the mapped
  zone", **not** "no flood risk / no nearby designation". Severity (exclude/warn/prefer) is an occupier
  search-time decision, not baked into the dataset. Only the two named layers are loaded — other designations
  (conservation areas, SSSIs, listed buildings, AONB, TPOs) are out of MVP scope.
- Single-area MVP (Canterbury). National scaling is deferred to the post-validation backlog below.

---

## Post-validation backlog (do NOT build now)

Find Sites is a **broad-brush prospecting instrument** — it surfaces registered land parcels that align with an
occupier's measurable criteria and may be worth investigating, complementing SiteMatcher's occupier→location and
landlord→occupier purposes. The output is an **evidence-backed prospecting shortlist**, not a list of available or
development-ready sites. The following are explicitly **out of scope now** and revisited **only if user research
shows demand** — none is a blocker to M9.1 / M10:

- **Speculative sub-plot generation** within large registered titles (drive-thru-sized developable plots).
- **Title assembly** — combining multiple titles into invented development sites.
- Determining land **availability**.
- Proving legal / technical **access**.
- Claiming **commercial viability** or **planning suitability**.
- **National scaling** beyond Canterbury.
- Adding **large numbers of new datasets** before the experience is tested.
- Turning this into a **specialist land-finding platform**.

Persistent guardrails (unchanged, everywhere): availability, lawful access, planning consent and commercial
viability stay **explicitly unknown**; a registered title is an indicative freehold extent, never an exact
development plot.
