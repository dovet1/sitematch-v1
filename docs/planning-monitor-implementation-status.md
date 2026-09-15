# Planning Monitor — implementation status

Date: 15 September 2026. Companion to `docs/planning-monitor-implementation-plan.md`.

## Start here

1. ~~Apply `supabase/migrations/20261012000000_planning_monitor.sql`~~ (applied 15 Sep). It adds tables, functions and triggers, and seeds three flags as **off**. It also adds two indexes on `planning_applications`: `date_decided` and `date_validated`.
1a. ~~Apply `supabase/migrations/20261014000000_planning_monitor_review_fixes.sql`~~ (applied 15 Sep). The worker now calls `planning_monitor_finish_run`, which this migration adds. Without it, every run fails at save. The migration fixes three review findings: weekly reports are scheduled regardless of email preference, a report and its delivery commit together, and ambiguous delivery retries are leased. The fixtures are in `supabase/tests/planning-monitor/review-fixes.sql`, and they pass on local PostGIS.
1b. **Apply `supabase/migrations/20261015000000_planning_monitor_national_proximity.sql`.** Then re-time All UK with store proximity (see "Desktop walkthrough" below). Results are unchanged; only `planning_monitor_match_sql` is replaced. The fixtures are in `supabase/tests/planning-monitor/national-proximity.sql`: the national path matched the per-record probe in all 12 cases, and `fixtures.sql` output is identical.
2. From `apps/web`, run the Phase 2 gate: `../../node_modules/.bin/tsx scripts/check-planning-monitor-queries.ts`. It times count, view and list reads on the live store and checks that they agree. Compare the results with the plan's targets: count under 1 s, viewport under 1.5 s.
3. ~~Turn on `planning_monitor_enabled` for internal testing only.~~ (on since 15 Sep; the code is on `july-sitematcher-upgrade` only, not deployed). The Planning rail item appears, and the APIs stop returning 404.
4. Desktop only (mobile is out of scope). Walked through signed in on 15 Sep; see "Desktop walkthrough". Still to check: save, watch, and a report. Check the UI signed in: national → patch → edit → save/cancel → select a row or pin → report, then mobile width and every existing mode.
5. AI briefings: set `PLANNING_MONITOR_MODEL`, then flip `planning_monitor_ai_enabled`. Choose the model by evaluation; none is hard-coded. Optional: `PLANNING_MONITOR_MONTHLY_BUDGET_USD` (default 10).
6. Email: configure the Resend webhook (`email.bounced`, `email.complained`) to `/api/webhooks/resend-planning-monitor`. Set `RESEND_PLANNING_MONITOR_WEBHOOK_SECRET`, then flip `planning_monitor_email_enabled` for internal recipients first.

The migration is applied. Nothing is deployed, all flags are off, and no subscription or schedule is live.

## Desktop walkthrough (15 Sep, signed in, local dev against live data)

Worked:
- Patch view: totals, "may be in this area", criteria chips, the list in both groupings, clusters, the patch outline and the estate's store squares.
- Selecting a row flies the map to it and opens the popover.
- The criteria editor frames the saved patch and shows a live count. Cancel leaves the patch unchanged.
- Switching to Assess and back restores each mode's basemap and layers.

Fixed in the working tree:
- **Stale map markers.** Cluster updates were dropped when they arrived while tiles loaded after a move, because `isStyleLoaded()` was false. They are now applied at the next idle.
- **A failed list kept the previous scope's "Show more".** The totals line also went blank without saying why.
- **The editor's draw hint overlapped the Mapbox logo.**
- **All UK with store proximity timed out.** Live timings for Lidl and Aldi at 3 miles, all UK by received date:
  - this year: 5.5–5.8 s count, against 0.3–0.5 s without proximity
  - 90 days: 2.1 s
  - 30 days: 0.55 s
  - The page reads the count and the list together, which passes 8 s. Fixed by migration 20261015; still to be re-timed live.

Open:
- **Duplicate applications from shared portals.** Mid Kent's `26/503351/FULL` is stored three times, under Swale, Maidstone and Mid Kent, and counts three times. This is ingest, not the Monitor. A separate task was suggested.
- **An intermittent 404 from `/api/planning-monitor/query`.** Two were seen during rapid scope and grouping switches; 12 sequential and 16 parallel requests did not reproduce it. The access guard reads the flag and fails closed, which would return this 404, so it is a candidate.
- **"Preparing your first briefing" never resolves locally**, because no worker runs there. Reports were not seen.

## Phase 1 — core data and contracts

Measured read-only on 15 Sep with `scripts/check-planning-monitor-coverage.ts`:

- About 615k records, 13.5k with no location. Provenance: 181k `source_exact`, 421k `source_centroid`.
- Received in the last 30 days: 34,561 applications. Of these, 2,190 have a commercial limb and 163 state 15+ homes. The classifier's dwelling counts add more that this probe does not count.
- Exact whole-table counts and `date_decided` range scans exceed the API role's statement timeout of about 8 s. The Monitor therefore always filters by date or space first. The migration indexes decided and validated dates.
- All 393 authority coverage rows are `fresh`. Nation is not recorded on them, so representative samples from all four nations are checked through the benchmark's Edinburgh, Cardiff and Belfast cases instead.

Still open:

- **Boundary search.** There is no administrative-boundary polygon source. Built-up areas exist only as vector tiles. Search therefore creates an explicit, labelled radius patch; drawing and GeoJSON upload are available.
- **Family grouping.** The pilot acceptance for national grouping and aggregate dwelling totals is still governed by the linking plan. The Monitor keeps unresolved families (`awaiting_original`) out of confident totals.

## Phase 2 benchmark (15 Sep, after the migration was applied)

`scripts/check-planning-monitor-queries.ts`, warm reads:
- Patches in Leeds, central London, the Cotswolds, Edinburgh, Cardiff and Belfast (30 days to all history): count, clusters and first page each ran 45–350 ms. List, count and clusters agreed in every case.
- All UK at 30 days: about 150 ms each. The map read first timed out because a UK-wide viewport box pushed the planner onto the spatial index. The service now omits the box below zoom 7, and the benchmark does the same.
- **All UK beyond about 30 days ("this year" and longer) exceeded the 8 s timeout** for count, clusters and list.
- Fixed by `20261013000000_planning_monitor_eligible.sql`, applied 15 Sep.
  - Adds `planning_monitor_eligible`, one row per qualifying application, kept current by triggers on `planning_applications`, `development_applications` and `developments`.
  - `planning_monitor_match_sql` reads this table; its output is unchanged.
  - Locally, the fixture output is identical and `eligible-maintenance.sql` shows zero drift.
- Benchmark after applying (warm):
  - Every patch total matched the pre-change run exactly: Leeds 26 and 268, central London 431 applications / 420 developments, Cotswolds 16, Edinburgh 401, Cardiff 129, Belfast 171. List, count and clusters agreed in every case.
  - All UK 30 days (2,341 applications): about 55–90 ms per read.
  - All UK this year (27,760): count about 130 ms, clusters about 180 ms, first page 380–510 ms.
  - All UK all history (30,428): count 215–473 ms, clusters about 170 ms, first page about 500 ms.
  - Overall p95: counts 248 ms, viewport reads 689 ms, within the 1 s and 1.5 s targets. **The Phase 2 performance gate is met.**

## Phase 2 — query and persistence (built and applied)

- `src/lib/planning-monitor/criteria.ts` holds the v1 criteria schema. It enforces the 15-home floor, rejects follow-on filters the server has not enabled, normalises, and builds the one flat predicate every read uses.
- The migration provides:
  - `planning_monitor_match_sql`: a single builder that always applies base eligibility.
  - `planning_monitor_count`, `planning_monitor_rows` (keyset pagination, developments or applications) and `planning_monitor_clusters` (grid cells sized by zoom).
  - Patches, revisions, subscriptions, watches, change events, digest runs and deliveries, with owner row-level security.
  - `planning_monitor_save_patch`: one transaction with an optimistic revision check. Enabling weekly email disables the user's monthly POC subscription.
  - Material-change triggers on `planning_applications` and `developments`. A replayed change is deduplicated by `event_key`.
- APIs: `/api/planning-monitor/{query,count,patches,patches/[id],patches/[id]/digest,watches,digests/[id],unsubscribe}`. Each checks the flag, then the Plus plan, then the owner, before reading anything.
- Fixtures: `supabase/tests/planning-monitor/` covers 14/15/50 homes, commercial-only, mixed use, unknown and reviewed-to-unknown counts, holes, approximate points, store proximity, the no-estate case, watched families, more than 2,000 matches with full paging, clusters, change-event replay, revisions, cross-owner refusal, invalid geometry, daylight-saving scheduling, enqueue idempotency and double-claim protection. All pass on local PostGIS.

Not done:

- **Response caching.** No cache yet; add one only if the benchmark shows it is needed. Keys must include criteria hash, capability version, scope or geometry, zoom, and data and estate revision, scoped per user.
- **Vector tiles.** Not built; the plan says only if the measured query approach needs them.
- **Plota `changed_since`.** Not assessed.

## Phase 3 — Monitor and criteria (built, not visually verified)

- Planning is a flag-gated rail mode. It switches to a dark basemap, restores the normal style on exit, and hides traffic overlays.
- Components live in `components/shell/planning/` and `components/map/PlanningMapLayer.tsx`. State is in `lib/stores/planning-monitor-store.ts`.
- **Panel:**
  - Scope toggle, active patch selector and "Create your patch".
  - Totals that name both units, with in-view counts shown separately.
  - Summary card, criteria chips, developments/applications toggle and paged list.
  - Stale-data, empty and error states.
- **Map:**
  - Server clusters, with residential and commercial colours.
  - Hollow rings for approximate locations, also labelled in words.
  - Selected-estate store squares and the patch outline.
  - A popover beside the marker that stays on screen, with "View application" (existing detail modal) and "Watch".
- **Criteria modal:**
  - Location: draw with drag, undo and close; GeoJSON upload; or place radius.
  - Store proximity, application type (15/50/100/custom ≥15 homes; commercial work types), and dates and status (date field, presets, custom range, stages, routes).
  - Refinements: keywords, watched-only, exact-only.
  - Weekly email preference, a debounced live count, and focus trap with Escape.
  - Full screen on mobile, with sticky actions.
- No use-class, site-area, floorspace, sector or operator controls exist anywhere.
- Email links deep-link through `?mode=planning&patch=…&report=…&settings=notifications`.
- **Not verified in a browser:** it needs a signed-in Plus session plus the migration and flag. Type-check, lint and the unit tests pass. The existing workspace suites pass: 279 tests, including the new ones.

## Phase 4 — weekly briefing (built behind flags)

- **Selection** (`digest-select.ts`, pure and tested):
  - Scheduled runs combine ledger events in the period with records decided in the period, evaluated against the patch's non-temporal predicate.
  - Late discoveries are labelled; council status wording alone is ignored.
  - Watched families are included regardless of filters.
  - Homes are counted once per development, and unresolved families are excluded.
- **Initial and preview runs** are labelled snapshots of the last seven days, not "this week's submissions".
- **Summary** (`digest-summary.ts`):
  - Structured output validated against evidence ids, numbers present in the evidence, and banned claims (residents, spend, completion, unsupported operator).
  - Bounded retry, then a deterministic fallback that says the AI summary is unavailable. A quiet week needs no model call.
  - Monthly budget cap; usage and latency are stored.
- **Stale source:** a scheduled run waits up to 12 h for recovery, then issues a report labelled partial.
- **Not done:**
  - Model evaluation and choice.
  - Grouped summarise-then-synthesise for very large patches; today it is one bounded pass of 40 evidence items with the omission disclosed.
  - A "criteria edit made an old application newly relevant" section, distinct from planning activity. Previews are labelled as snapshots instead.
  - Evidence caching by development revision.

## Phase 5 — email and pilot (built behind flags)

- `/api/cron/planning-monitor` runs every 15 minutes (`vercel.json`). It enqueues due runs, generates a few, and sends a few. The email flag stops sending only.
- **Delivery ledger:**
  - One delivery key per run and recipient, also used as the Resend idempotency key.
  - Leases and retry with backoff. Rows still in doubt after 23 h are parked `ambiguous` rather than resent.
  - Subscription, patch and Plus eligibility are rechecked before every send.
- **Email:**
  - HTML and plain text, carrying the same saved summary and counts as the card.
  - Report, current-map and preferences links, plus RFC 8058 one-click unsubscribe.
  - The signed token only disables that one subscription, and the GET page asks for confirmation so link scanners cannot unsubscribe anyone.
- **Bounce and complaint webhook:** verifies the Svix signature and disables the subscription on a hard bounce or complaint.
- **Not done:**
  - Operational dashboards (queue age, invalid-summary rate, cost per digest, delivery failures).
  - Migrating existing monthly POC subscriptions. A user's POC is disabled only when they enable weekly email.
  - The pilot's two weekly cycles.

## Phases 6–7

Not started, by design: enrichment and advanced filters, and Market Change.
