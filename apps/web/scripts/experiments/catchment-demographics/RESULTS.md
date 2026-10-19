# Catchment-based brand profiles: experiment results (19 Oct 2026)

**Verdict: go, with one condition.** Catchments beat towns across the field, but they don't fix Leon
on their own. Leon's estate has two kinds of site, and one spread can't describe both. Split city
sites from roadside and travel sites and Leon scores 0.83.

Nothing in the product or in production tables changed. All the work is in the throwaway
`scratch_catchment` schema, which is safe to drop.

## What was built

1. **Catchments.** Each store is placed in its LSOA. That LSOA's catchment is every LSOA whose
   centroid lies within 1km, widened to 3km where fewer than 5,000 people live within 1km, and to
   5km where 3km still falls short. That gives 14,898 catchments (10,072 at 1km, 3,767 at 3km and
   1,059 at 5km) covering 54,328 England and Wales stores. The measures use the same census
   components and index formulas as the town signals. The formula reproduces the stored town
   scores to within 0.005.
2. **Density peers.** Each catchment is ranked within 74 bands of about 200 catchments, grouped by
   people within 1km. These replace the town-size bands.
3. **Profiles** are rebuilt from store catchments: each unit is the distinct LSOAs a brand or fascia
   trades in, using the same p10–p90 spread, distinctiveness and top-four signals as now.
4. **Backtest.** This is the same five-fold method as `brand_demographic_backtest()`, with three
   changes that keep it honest:
   - Folds are dealt by ~5km grid cell, so neighbouring stores can't leak into each other's test.
   - Negatives are other retail neighbourhoods (an LSOA with any store) in the same density band.
   - Negatives within 1km of the brand's own stores are excluded.

## Head to head (town results from the 16 Oct run)

| | Brands: town | Brands: catchment | Fascias: town | Fascias: catchment |
|---|---|---|---|---|
| Units tested | 194 | 201 | 214 | 222 |
| "Typical everywhere" (no profile) | 54 | 22 | 64 | 25 |
| Median AUC | 0.614 | 0.645 | 0.589 | 0.630 |
| At or above the 0.65 pill bar | **48** | **83** | **48** | **86** |

Among the units both versions score (138 brands), catchment wins 84 and town wins 54. The median
on those shared units is 0.660 against 0.614. Across all brands, 48 newly clear 0.65 (some of them
couldn't be scored before) and 13 drop below it.

## The test cases

| Brand | Town AUC | Catchment AUC | City sites only (catchment) |
|---|---|---|---|
| Leon | 0.61 | 0.57 | **0.83** (47 sites) |
| Auntie Anne's | 0.52 | **0.72** | 0.70 |
| Gail's | 0.83 | 0.78 | 0.79 |
| Pret A Manger | 0.73 | 0.67 | 0.72 |
| Waitrose | 0.71 | 0.67 | — |
| Home Bargains | 0.65 | 0.59 | — |

**Why Leon fails.** About 20 of its 67 neighbourhoods are motorway services and roadside sites,
with under 3,000 people within 1km (Cheshire West, Monmouthshire, Wychavon and others). The rest
are dense city centres. A single p10–p90 spread straddles both groups, so it fits neither well.
Drop the low-density sites and Leon scores 0.83.

**Biggest gains:** Pandora (0.46 → 0.71), Slater Menswear (0.57 → 0.86), Gravity (0.38 → 0.80),
Goldsmiths (0.55 → 0.76) and Escape Hunt (0.63 → 0.85). The Entertainer moves from "typical
everywhere" to 0.73. Seven brands that the town version couldn't test at all are now scored, and
five of them clear 0.78 (Third Space, Margaret Dabbs, Hagen, SushiDog and Creature Comforts).

**Biggest losses** are regional chains and a few London restaurants: IRO Sushi (0.76 → 0.46),
East of England Co-op (0.69 → 0.51), Lincolnshire Co-op (0.74 → 0.61), Franco Manca (0.83 → 0.66)
and Jollyes (0.70 → 0.57). For the co-ops, "which kind of market town" carries more signal than
"which kind of neighbourhood".

## Caveats

- The two backtests answer slightly different questions: "this town or another town of its size"
  against "this neighbourhood or another retail neighbourhood of its density". The AUCs are
  comparable as a guide, not exactly like for like.
- Catchments are centred on the store's LSOA centroid, not the store itself. That doesn't matter
  much in town, but a rural LSOA can be several km across.
- The brand-level negatives come from stores in the database, so the "retail neighbourhood" set is
  only as complete as our store coverage.

## If we go ahead

1. Split each estate by site type before profiling: dense (5,000+ people within 1km) against
   roadside, travel and rural. Profile each part separately and score a site against the part
   that matches its own density.
2. Consider keeping the town profile as a fallback for brands where it still wins, such as
   regional co-ops. The backtest already tells us which those are.
3. Productising this needs migrations (catchment and rank tables, a site-catchment lookup) for Tom
   to apply.

The SQL is in `01_catchments.sql`, `02_density_ranks.sql` and `03_backtest.sql`. The results are
in `scratch_catchment.results`, with the city-only check in `scratch_catchment.backtest_city()`.
