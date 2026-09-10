# Codex hand-over: planning Phases 0 and 1

Date: 10 September 2026
Both phases are **written and committed, and neither is live.** Two migrations are unapplied
and every feature flag is still off.

Plan of record: `docs/plota-planning-delivery-plan.md`. Read it before this document — this
one says what changed and what will bite you, not why the phases are ordered as they are.

Commits: `e55aaa3` (Phase 0), `6135c4c` (Phase 1).

## Do this before anything else

Nothing below runs, and no test proves anything about the live system, until:

1. **Apply two migrations.**
   - `supabase/migrations/20260926000000_planning_refresh_cohorts_and_status.sql`
   - `supabase/migrations/20260927000000_planning_tab_ranked_read.sql`

   The convention on this project is that the migration is authored here and **the user
   applies it**. Do not apply them yourself, and do not assume they have been applied
   because the code that calls them exists.

2. **Turn on the workers.** `PLOTA_SYNC_ENABLED` and `PLANNING_CLASSIFICATION_ENABLED`.

3. **Raise the Demo-key defaults.** `PLOTA_PAGE_SIZE` is 10 and `PLOTA_MAX_PAGES_PER_RUN` is
   1. A subscription was bought on 10 September 2026, so both are now far too conservative,
   and `PLOTA_REFRESH_COHORTS` (default 3) should rise with them. Three received-date months
   at one page each cannot keep a national store current.

`PLANNING_STORED_READ_ENABLED` stays **off** until the cutover measurement below is done.

## What Phase 0 built

Nothing was scheduled at all before this. `vercel.json` now runs discovery daily at 01:00,
refresh weekly on Mondays at 05:00, and classification every six hours.

**The refresh pass** (`apps/web/src/app/api/cron/refresh-plota/route.ts`, driven by
`runPlotaRefresh` in `apps/web/src/lib/planning-intelligence/ingest.ts`) re-searches the
received-date months that still hold undecided applications, least recently checked first,
and upserts whatever comes back. Discovery only ever looked for records that were new to us,
so an application approved three months after it was received changed in Plota and never
here.

Four decisions inside it that are not obvious from the code:

- **Cohorts are received-date months, not authorities.** The original ingest plan proposed
  authority plus date window. Plota's search is only proven in this codebase for nation,
  census filter and date range, so narrowing by authority would mean sending a parameter we
  have never sent. Confirm that parameter against the live API before changing this.
- **Refresh is its own route, not `?kind=refresh` on the sync endpoint.** A Vercel cron entry
  that lost its query string would silently run discovery instead, and discovery succeeding
  looks exactly like refresh working. Do not consolidate them.
- **Checkpoints are keyed by a cycle key.** A finished checkpoint is skipped, which is what
  makes discovery resumable, and would have made refresh a permanent no-op on its second pass
  over the same window. The key is the UTC date: two runs on one day resume a single walk.
- **Decided records are never re-polled.** The original plan's "one final refresh after a
  decision, then stop" is deliberately not implemented; it needs a marker recording that the
  final check happened, and re-reading every decided record for ever is the failure that rule
  exists to prevent.

**Research is deliberately unscheduled.** It is the paid document and web pass, and Phase 2b
says to fix its success counter and read a real batch before changing anything about it. A
cron would start spending against a measure already known to be wrong. Do not add one.

**Observability.** `planning_pipeline_status()` returns queue depth, the last run of each
kind including failures, store freshness and the remaining provider allowance in one
document, surfaced at `GET /api/admin/planning/status`.

**Staleness.** `apps/web/src/lib/planning-intelligence/freshness.ts` holds the thresholds and
the judgement, and both the admin endpoint and the planning tab read the same function so an
operator and a user cannot be told different things. It names two failures separately on
purpose: discovery falling behind means recent applications are missing altogether, while
refresh falling behind means the listed applications are real but their decisions have moved
on — the more dangerous of the two, because the list still looks complete.

`LIVE_CHECK_STALE_AFTER_DAYS` is 35, and that number is **calculated from the schedule**: a
weekly pass over three cohorts comes round inside five weeks while there are fewer than
fifteen live months. Recalculate it if the cadence or `PLOTA_REFRESH_COHORTS` changes.

## What Phase 1 built

The stored read selected none of the classification and ordered by `date_received`. It now
calls `planning_tab_applications`, which joins each application to its Development and
returns relevance, the classifier's sentence, its dwelling count and the commercial-space
answer.

- **Ranking happens in the database, before the record cap.** Sorting in the application
  would have sorted only what survived the newest 2,000, permanently losing a high-relevance
  application that never made the cut by date.
- **`sort_rank` is returned as a column and ordered on explicitly.** A function's row order
  stops being a contract once PostgREST wraps a `LIMIT` and `OFFSET` around it. Do not drop
  the `.order('sort_rank')` in `stored.ts`.

Two product questions the plan left open were **decided by the user on 10 September 2026**.
Both are implemented, and neither should be revisited without asking.

- **Coverage: show everything stored.** The tab no longer mirrors PlanIt's size, state and
  type filters, and its copy changed to match. Consequence to carry into the cutover: the
  comparison now measures a product change, not a like-for-like migration.
- **Approximate positions are included when they might be inside.** Plota has never once said
  `exact`; 71 of 164 stored positions are a ward or parish centre, and testing that point
  against the drawn area asks about the wrong point. Such records are admitted on overlap,
  flagged `Approx` on the row, and counted in a caption under the total, because the count now
  means "may be in this area".

**The uncertainty radii are assumptions, not measurements.** 1,500 m for a ward or parish
centre, 200 m for a postcode centre, in `planning_location_uncertainty_m`. One function, so
there is one place to correct them. Revisit the moment a stored point can be compared with a
known site address, and do not present them to a user as measured error.

## Traps

- **The client re-filters results against the boundary.** `usePlanningData` applies
  `pointInGeometry` as a belt-and-braces guard, which would have stripped out precisely the
  overlap-admitted records the new inclusion rule exists to keep. It now respects
  `insideBoundary === false`. Any change to that filter must preserve this.
- **`REDUCED_SCOPE_ARCHIVE_FLOOR` lives in `plota.ts`, not `ingest.ts`.** The cron routes that
  enforce it mock the ingest driver in their tests, so a constant imported from there is
  `undefined` under test and the guard silently passes. It was briefly wrong in this way.
- **Freshness failures must not fail the tab.** A broken status read degrades to
  `freshness_unavailable`, meaning "we could not confirm this is current", never to silence
  and never to an exception. This matters most right now, because the status function does
  not exist until the migration is applied.
- **`model_dwelling_count` and `nDwellings` are separate evidence.** Plota leaves its figure
  empty on 130 of 164 records while the description states the number plainly. Where both
  speak they can disagree. Do not merge them.
- **The admin review API still cannot correct every field the tab now shows.** It accepts
  relevance, summary, brand signals and observations, but not `model_dwelling_count` or
  `creates_commercial_space`. The tab displays a dwelling count no reviewer can fix. This is
  a known gap, written up in the plan's review section, and it is now user-visible.

## Verification

```bash
cd apps/web && npx tsc --noEmit -p tsconfig.json
```

```bash
cd apps/web && npx jest src/lib/planning-intelligence src/app/api/public/planning src/app/api/cron src/app/sitematcher-unified
```

Both were clean at `6135c4c`. Four suites elsewhere under `src/app/api` fail — leads,
consultant profile, gaps find, and gapfinder requirement-locations. They fail identically on
a stashed tree and are unrelated legacy failures; do not try to fix them as part of this work.

New test files: `__tests__/refresh.test.ts` and `__tests__/freshness.test.ts` under
`src/lib/planning-intelligence`, `src/app/api/cron/refresh-plota/__tests__/route.test.ts`, and
`src/app/api/public/planning/__tests__/stored.test.ts` — the stored read had no test at all
before this.

## What is next

**The cutover, and it needs live data, not more code.** Measure coverage on more than one
boundary including at least one where the two providers should disagree; prove the ranking
survives the 2,000-record cap on a boundary that exceeds it; then turn on
`PLANNING_STORED_READ_ENABLED`.

**Then Phase 2**, making the data support the Monitor. Its first step is 2a, letting
residential schemes in, and the exclusion there is upstream at ingest rather than in the local
eligibility filter — read that section before touching the limbs.

The standing lesson from three audits of this work: almost every defect was invisible in the
code and only appeared when real records ran through it. Trust live data over the code's
intent, and change one thing at a time.
