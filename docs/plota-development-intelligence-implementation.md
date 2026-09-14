# Plota Development Intelligence: implementation runbook

This is the first end-to-end production slice of the approved plan. It creates the census,
Development and evidence model; resumable Plota search ingestion; deterministic limbs A-D;
budget-capped OpenRouter classification; a human/Codex review queue; and a feature-gated
stored-data path for the existing Planning tab.

Nothing spends money merely because this code is deployed. Both external workers and the
stored-data product read are off by default.

## Safety defaults

- `PLOTA_SYNC_ENABLED=false`: prevents accidental use of the remaining Demo allowance.
- `PLOTA_PAGE_SIZE=10` and `PLOTA_MAX_PAGES_PER_RUN=1`: one Demo request per manual run.
- `PLANNING_CLASSIFICATION_ENABLED=false`: prevents accidental OpenRouter calls.
- `PLANNING_BRAND_LIMB_ENABLED=false`: limb C remains measurement-only until it reaches
  95% precision on at least 200 labelled description/applicant hits.
- `PLANNING_STORED_READ_ENABLED=false`: users remain on the existing Planning data until
  the 12-month Plota baseline and council coverage audit pass.
- Plota requests always include `include_contact=false`.
- OpenRouter is limited to $20 per calendar month overall and $2 for initial classification.
  Each call reserves budget atomically in Postgres before it starts.

## Activation order

1. Apply migration `20260915000000_create_plota_development_intelligence.sql` to a staging
   database.
2. Keep the reduced census until Plota confirms the licence permits nationwide full-census
   storage and paid-product display. Set `PLOTA_CENSUS_SCOPE=full` only after that confirmation.
3. Run one Demo page manually and inspect the ingest run, checkpoint, application and
   Development rows. This is one Plota request, not a whole backfill.
4. Enable classification and process a very small batch. Confirm the OpenRouter usage row,
   structured result, observations and brand signals.
5. Review records through `GET /api/admin/planning/review`; save adjudication with `PATCH`
   to the same endpoint. During development, this is where Codex supplies the stronger
   second opinion. The running app does not pretend it can invoke this conversation.
6. Build the labelled alias and relevance sets. Do not activate limb C before its stated bar.
7. After purchasing Starter, use page size 50 and increase pages per run. Backfill monthly
   date windows across the prior 12 months; checkpoints make each window resumable. Plota's
   `commercial_work` and `dmin` filters are documented as live-only, so the worker refuses
   a reduced-census window beginning before 2026. The September–December 2025 portion needs
   either licensed full-census ingestion or a supported archive-filter route confirmed by
   Plota; it must not be reported as complete otherwise.
8. Complete the two-authority council-register audit and reach the plan's recall targets.
9. Enable `PLANNING_STORED_READ_ENABLED` in staging, compare area results, then enable it in
   production. Remove the legacy upstream planning path only after this gate.

## Worker endpoints

Both routes require `Authorization: Bearer <CRON_SECRET>`.

- `GET /api/cron/sync-plota` runs a 7-day rolling discovery window (14 days until 13 Sep 2026).
- `GET /api/cron/sync-plota-late` re-reads receipt dates 7-120 days old under reduced scope,
  because Plota lists applications only once validated and a fifth of intelligence-tier
  applications are validated more than 14 days after receipt. It stops at the reserve.
- `GET /api/cron/sync-plota-deep` (01:05 and 13:05) re-reads receipt dates 120-365 days old,
  also reduced and reserve-limited: 3.6% of schemes with 10+ homes or 1,000+ sqm were validated
  more than 180 days after receipt. Both lanes share `discovery-lane-route.ts` and floor at 2026-01-01.
- `GET /api/cron/sync-plota?kind=backfill&date_from=2026-08-01&date_to=2026-08-31`
  runs or resumes that backfill window.
- `GET /api/cron/classify-planning?limit=5` processes at most five queued intelligence
  records, stopping immediately when either LLM budget is exhausted.

The ingestion worker deliberately uses overlapping searches in reduced-census mode.
Applications are deduplicated by Plota ID. Every individual page is checkpointed, and the
worker records the allowance headers returned by Plota.

## What remains behind later gates

- Plota associated-application retrieval and conservative Development merging.
- Council portal document adapters, after the manual 20–30 application document test.
- High-value web research and evidence capture.
- Dedicated Planning page and richer Development cards in the Planning tab.
- Approved Development signals in brand-modal UI (the reviewed relationship and rollup
  data model are present; the visual treatment still needs design).
- Optional PlanNexus quality sidecar.

Those are intentionally not allowed to delay or destabilise the census and classification
foundation. They can be built against real reviewed records once this slice has passed its
accuracy gates.

## Validation completed on 8 September 2026

- 31 focused tests pass across eligibility, brand-limb gating, the Plota client, strict
  OpenRouter output, budget accounting, worker kill switches and the existing Planning API.
- The web app passes TypeScript checking.
- Two synthetic live classifications completed with `openai/gpt-oss-120b`. The first
  exposed an opportunity-category ambiguity; after tightening the mixed-use precedence,
  the second returned the intended `mixed_use` result. Combined reported cost was
  $0.000211595.
- No Plota request was made during implementation, so the remaining Demo allowance was
  not reduced during the initial build. A later archive-filter probe used seven requests;
  the Demo key reported 489 monthly requests and 980 delivered rows remaining afterwards.
- The database migration could not be executed locally because the Docker-backed Supabase
  development stack was not running. Apply it to a local or staging database before either
  worker flag is enabled.

The repository-wide Jest run still contains unrelated legacy failures (39 suites at this
point). The focused planning tests are green; the full-suite failures predate this work and
are mostly in the old listing, organisation and UI test surfaces.

## Archive-filter probe

The Demo key was tested against Canterbury for November 2025 with an unfiltered query, a
`commercial_work` query and a `dmin=1` query. All three were stopped at the plan-level
archive gate and returned the same note that pre-2026 data requires a paid plan. The Demo
key therefore cannot prove whether paid archive filtering occurs server-side.

Plota's documentation labels both derived filters as live-only. Since nationwide historic
storage has now been confirmed as permitted, the reliable backfill route is the full census:
set `PLOTA_CENSUS_SCOPE=full`, retrieve the licensed archive broadly, and apply the
intelligence limbs locally. Re-run the four-call probe after purchasing Starter if we still
want to measure whether its server happens to optimise those filters; correctness no longer
depends on the result.
