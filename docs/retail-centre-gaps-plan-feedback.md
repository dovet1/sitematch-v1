# Find Gaps — retail centres: review of the implementation plan

Feedback on the proposed GeoDS retail-centre integration. The overall shape is right:
make Find Gaps geography-agnostic, with towns and retail centres as two implementations
of one workflow, rather than forcing GeoDS data into the BUA tables. The plan also
correctly spotted the duplicate `/find` + `/filter` execution in
`apps/web/src/app/sitematcher-unified/lib/hooks/useFindGaps.ts:43`.

The amendments below are ordered by how much they change the build.

---

## 1. Drop the population filter and sort entirely in retail-centre mode

The plan treats population as a straight swap ("GeoDS-derived census population").
It isn't a swap — it has to go.

**Why it can't work as specified.** Resident population *inside* a retail-centre
polygon is near-zero by construction; retail centres are non-residential. And
`MIN_POPULATION = 5001` in
`apps/web/src/app/sitematcher-unified/lib/services/gaps-service.ts`, so the default
slider position would exclude essentially every retail centre in the country. The
"<5k" banding in `POPULATION_FILTER_LOGIC.md` and the population `step` colour ramp
at `UnifiedMap.tsx:461` inherit the same problem.

**It is also forced by the data.** GeoDS Retail Centre Boundaries v4.0 ships
boundaries, names and classification only — 8 columns. It carries no population and
no census attributes. See §2.

**Decision: in retail-centre mode there is no population filter and no population
sort.** Hide the "Town size (optional)" block (`ULeftPanel.tsx:458`), drop the
population clause from the "You're looking for" summary sentence
(`UInspector.tsx:250`), and drop `pop` from the `gapSort` options
(`UInspector.tsx:285` — `az` stays).

### 1a. Implement this as predicate *omission*, not a widened range

If "no filter" is expressed as `minPop = 0, maxPop = 999999999`, rows with a NULL
population are still silently dropped: every rule builder emits
`WHERE b.pop_final BETWEEN %s AND %s`
(`scripts/filter-buas-with-expression.sql:182`), and `BETWEEN` excludes NULLs. The
generic builder must emit **no population clause at all** in retail mode. Same for
the map: `buaFilter` (`UnifiedMap.tsx:91`) must reduce to the ID list alone, not a
wide-open comparison against a property the retail tileset won't have.

Worth knowing while you are in there: the `<5k` special case documented in
`POPULATION_FILTER_LOGIC.md` lives in `scripts/drop-and-recreate-bua-function.sql`
and **not** in the expression function, so the two filter paths already disagree
today. Don't propagate the inconsistency into the generic version.

### 1b. You still need a rank — the 1,000-row cap makes it load-bearing

`stores-service.ts:718` truncates to the top 1,000 matches
(`.in('gsscode', allMatchingGsscodes.slice(0, 1000))`), and "top" currently means by
population. The inspector surfaces the truncation as "X of Y" with a progress bar
(`UInspector.tsx:258`). With 9,623 centres and a loose rule set you will exceed 1,000
routinely. Remove population with nothing in its place and the user sees an arbitrary
1,000 of 4,300, with the excluded set undefined.

Rank by classification instead — see §3, which is not as simple as `ORDER BY tier`.

**Deterministic tiebreak is mandatory.** There are only 11 distinct classification
values across 9,623 rows, so the top-1,000 cut lands *inside* a tier. Without an
explicit secondary sort (name, then id) the cut is arbitrary and unstable between
identical requests. Add it to the ORDER BY, not just to the client sort.

### 1c. Useful side effect

The plan's constraint that "population shown in results, the result header and census
tab must all originate from the same GeoDS metric" dissolves. There is no
result-level population to reconcile. The Catchment tab becomes the only place a
population figure appears, and it is a catchment population — clearly labelled as
such, and the number a retail agent actually wants. See §5.

---

## 2. Corrected premises about the GeoDS data

The v4.0 headline figures in the plan are right; what the release *contains* is not.

**Confirmed.** Retail Centre Boundaries v4.0, updated 3 September 2026, built from
November 2025 data: 9,623 UK retail agglomerations, GeoPackage and GeoParquet, 11
classification tiers, 8 columns. Full UK coverage including Scotland and Northern
Ireland — v4 switched to Foursquare OS Places, an openly licensed pre-geocoded POI
source covering all four nations, which is what unlocked NI.

**Licence is not a blocker.** OGL, with open data certification. Commercial use is
permitted, attribution required. This can come off the risk list — earlier caution
about needing a licence review before build was misplaced.

**v4.0 does NOT include catchments, indicators, or any census data.** Those live only
on the separate 2022 v3.0 record ("Retail Centre Boundaries, Catchments, Typology and
Open Indicators"), which covers 6,423 centres — a different, older, smaller set of
boundaries with different IDs. And the v3.0 open indicators cover only 1,245 of those
centres (those with 50+ retail units, excluding Northern Ireland).

**Consequence for plan step 6.** The plan offers two implementations for the census
tab and recommends the first: "if it contains centre-level aggregates, display those
directly". It doesn't. No centre-level census aggregates exist for v4 boundaries. The
separate GeoDS unified-census project harmonises variables to standard census
geographies; it is not keyed to retail centres, so joining it to a retail centre still
means doing the spatial aggregation ourselves. Plan for that, or take §5's route.

**Do not mix releases.** Attaching v3.0 catchments or indicators to v4.0 boundaries
by name is not safe; treat identifier stability across releases as unproven until
verified against both extracts.

Still to confirm from the actual file, not from the portal page: exact field names,
CRS (expect British National Grid, EPSG:27700 — the DB stores geography in 4326, so
the importer must reproject), and the exact classification label strings.

---

## 3. Classification is two dimensions, not one ladder

This matters because §1b makes classification the ranking key.

The 11 tiers are not a single ordinal scale. Roughly seven of them form a size
hierarchy of high-street-type centres:

    Regional Centre → Major Town Centre → Town Centre → Market Town
    → District Centre → Local Centre → Small Local Centre

The remainder are *forms* that sit outside that ladder — large and small retail parks,
and large and small shopping centres. The GeoDS v4 build treats retail parks as an
explicitly separate pathway (1,172 of them, up from 497 in the 2022 release). A large
retail park does not sit cleanly above or below a District Centre; the question is
meaningless.

Tier assignment is a deterministic rule set over retail unit count plus rank within
region, local authority and built-up area, with adjustments (e.g. district centres
with several major anchors are promoted to town centres). Market Towns and District
Centres both carry a 150-unit minimum, with Market Towns being the highest-ranked
centre in their built-up area.

**What to build:**

- A **`retail_centre_classifications` lookup table** we own, mapping each label to
  `form` (`high_street` | `retail_park` | `shopping_centre`) and an integer
  `sort_rank`. Ordering becomes a product decision expressed in data, not logic
  buried in SQL, and it survives GeoDS relabelling.
- Filter on **two controls**, both in the slot vacated by the population slider:
  a **form** toggle and a **tier** multi-select. The plan defers classification
  filtering to "later" — promote it to launch. Population was doing real work in town
  mode as the volume control; without a replacement, retail mode has no way to get
  from "every centre in Britain" to a workable shortlist.
- The form filter also has product meaning on its own: a retail park and a high
  street are different acquisition targets, and users will want one or the other.
- Verify the exact label strings against the extract before writing the lookup —
  published descriptions vary between "Retail Park" and "Retail Centre" wording for
  the out-of-town tiers.

---

## 4. Don't migrate the BUA tables into `gap_areas` — mirror them

The plan's own verification list includes "town mode produces identical results before
and after the refactor". That is an expensive property to have to prove, and it
becomes free if the town path is never touched.

**Recommendation.** Keep `built_up_areas`, `built_up_area_geometries`,
`bua_store_presence` and `bua_store_nearby` exactly as they are. Add
`retail_centres`, `retail_centre_geometries`, `retail_centre_store_presence` and
`retail_centre_store_nearby` with identical column shapes. Generalise the SQL
*builders* by passing table and column names from a hard-coded whitelist registry.

Same code reuse the plan is after, none of the migration risk on a load-bearing path,
and no `area_type` predicate added to every existing query. The long-form
`gap_area_census_metrics` table is also unnecessary under §5.

**Injection.** The rule builders in `scripts/filter-buas-with-expression.sql` construct
SQL by string interpolation via `format()`. If `areaType` is threaded through, it must
be validated against a fixed enum before it reaches any format call — never passed
through raw.

**Migration hygiene.** `filter_buas_with_expression` currently lives in `scripts/`,
outside migration history. The generic replacement should land as a proper migration
in `supabase/migrations/`.

**Dead code.** `filter_buas_rule_demographic` and `bua_demographic_tags` have no
TypeScript caller anywhere in `apps/web/src`. Don't port them.

---

## 5. Census: use the centroid catchment, don't block on GeoDS census

The plan makes the GeoDS census variable mapping the gating unknown for milestone 1.
It doesn't need to be, and per §2 the data it assumes does not exist for v4 anyway.

The existing catchment flow already has a mode that fits retail centres exactly: the
Assess dropped-point path in
`apps/web/src/app/sitematcher-unified/lib/hooks/useCatchment.ts` does distance,
drive-time and walk-time analysis around a coordinate, with interactive LSOA
refinement, and needs no polygon. For a retail centre a 10-minute drive catchment is
*more* meaningful than anything measured inside the boundary.

Note also that `get_lsoas_for_bua` is polygon-intersection based
(`supabase/migrations/20260718000000_get_lsoas_for_bua.sql`). For a retail park that
returns one or two LSOAs, which would be actively misleading presented as "the
catchment". Do not generalise that function for retail centres.

**Recommendation.** Ship retail centres using the existing centroid catchment. Treat
the GeoDS unified-census work as a separate later upgrade whose real win is UK-wide
harmonisation across all four nations, benefiting towns and retail centres alike. This
removes the only unbounded dependency from the critical path.

---

## 6. The summary rebuild is already at its ceiling

> **BUA update (September 2026):**
> `20260913010000_bua_proximity_from_boundary.sql` introduced the safer staged
> rebuild. `20260913020000_include_presence_in_proximity_filters.sql` subsequently
> restored the faster centroid proximity cache and combines it with polygon
> presence at query time. It swaps both summaries only after validation and uses
> a transaction-scoped advisory lock.
> The original warning remains relevant to the separate retail-centre rebuild.

`supabase/migrations/052_fix_rebuild_statement_timeout.sql` and `053_...` exist
because the rebuild was being killed by statement timeouts. It now runs with
`statement_timeout = 0` behind a **15-minute lock expiry**, and
`rebuild_bua_store_nearby` is a `CROSS JOIN` of areas × stores executed four times,
once per distance threshold (`039_create_bua_summary_rebuild_functions.sql`).

Adding 9,623 retail centres — concentrated in dense urban areas, where a 10 km radius
sweeps up very large store counts — will likely push the total past that 15-minute
expiry. At which point a second rebuild acquires the lock and `TRUNCATE`s the tables
mid-write. "Using spatial indexes" does not address this.

**Required before the first import, not after:** chunked inserts, a separate lock per
geography, and a raised expiry. Four call sites invoke `rebuild_all_bua_summaries`:

- `apps/web/src/app/api/admin/stores/process-rebuild-queue/route.ts:89`
- `apps/web/src/app/api/admin/stores/rebuild-summaries/route.ts:18`
- `apps/web/src/app/api/admin/stores/import/upload/route.ts:796`
- `apps/web/src/app/api/cron/process-cache-rebuilds/route.ts:91`

Carry-forward caution when writing the generic rebuild: the presence join is
`JOIN fascia_categories fc ON fc.fascia_id = s.fascia_id`, an inner join. A fascia
with no category mapping never reaches the presence table at all, so a "has <fascia>"
rule silently fails for it. Existing behaviour, worth not replicating blindly.

---

## 7. Retail centres are invisible at national zoom

The plan treats the map as a like-for-like tileset swap. BUAs are large blobs that
read fine at national zoom; retail centres are small polygons that will render as
nothing on the national Find view — which is the view users start from.

**Required:** a point layer (centroids as circles, sized and coloured by
classification) at low zoom, crossfading to polygons at high zoom. The population
`step` colour ramp (`UnifiedMap.tsx:461`) is replaced by classification for this
layer, per §3.

The rest of the plan's map section is sound, including selecting the stored centroid
rather than the clicked point.

---

## 8. Smaller corrections

- **Overstated work.** Missing-fascias and nearby-stores are already centroid +
  radius (`lib/hooks/useAreaData.ts`), so they work for retail centres unchanged.
  Only `stores/in-bua`, `get_bua_boundary_geojson` and planning scoping need generic
  polygon versions.
- **Type churn.** `WorkspaceArea.kind` is `'bua' | 'point'`
  (`types/unified-workspace.ts:21`) and is branched on across the map, compare and
  sketch flows. A third kind needs a sweep, not just a type widening.
- **Export.** The CSV writes a `# Population Range` metadata row and a `Population`
  column (`app/api/public/gaps/export/route.ts:138`). In retail mode both become
  classification. Add the OGL attribution and the GeoDS dataset version to the
  metadata rows.
- **Results display.** Showing classification under the name, as proposed, is right —
  it becomes the primary size signal now that population is gone.

---

## Revised milestones

**M1 — Data.** Import v4.0 boundaries into mirrored `retail_centre_*` tables
(reproject to 4326), build the classification lookup with agreed `form` and
`sort_rank`, and rework the rebuild for chunking and per-geography locks. No UI.

**M2 — Feature.** Geography toggle, generic filter path with the population predicate
omitted, classification form + tier filters, dual-zoom map layer, centroid-based
catchment, generic polygon endpoints, export. Behind the `retail_centre_gaps` flag.

**M3 — Separate.** GeoDS unified census as a demographics upgrade for both
geographies, if it still looks worthwhile once M2 is in use.

The original plan's verification list stays valid, minus the "identical town results"
item, which §4 makes structurally true rather than something to test.

---

## Sources

- https://data.geods.ac.uk/dataset/retail-centre-boundaries — v4.0 record
- https://geods.ac.uk/2026/07/01/building-new-open-retail-centre-boundaries-for-the-uk/ — v4 build notes, retail-park pathway
- https://data.geods.ac.uk/dataset/retail-centre-boundaries-and-open-indicators — 2022 v3.0 catchments/typology/indicators
- https://www.nature.com/articles/s41597-022-01556-3 — Ballantyne et al., delineation and hierarchical classification method
