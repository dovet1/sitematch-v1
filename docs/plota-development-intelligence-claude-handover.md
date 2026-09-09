# Plota Development Intelligence — Claude handover

Date: 8 September 2026

## Objective

Continue implementing and validating the approved Plota Development Intelligence plan.
The immediate product priority is accurate, inexpensive ingestion and classification—not
the final UI.

Plota is the production planning-data provider. PlanIt is not part of the target
architecture or comparison process. PlanNexus Free may eventually be used as a bounded QA
sidecar, but nothing currently depends on it.

## User decisions

- Use OpenRouter and an inexpensive open-weight model for automatic first-pass
  classification.
- During development, use Codex/Claude as the stronger reviewer through a review queue;
  the running application must not pretend it can invoke an interactive coding conversation.
- Initial historical baseline: preceding 12 months nationally.
- The user confirms they are licensed to store planning records as far back as required.
- Therefore use a **full census**, retrieve records broadly, and apply intelligence filters
  locally.
- User will run the database migration against production Supabase.
- OpenRouter has $5 credit. The intended operating ceiling remains $20/month.

## Implemented

### Database

Migration:

`supabase/migrations/20260915000000_create_plota_development_intelligence.sql`

It adds:

- `planning_applications`: thin Plota census rows plus raw audit input;
- `planning_ingest_runs` and resumable `planning_ingest_checkpoints`;
- `planning_authority_coverage`;
- `developments` and `development_applications`;
- scoped `development_observations` for dwellings and commercial floorspace;
- evidence-bearing `development_brand_signals`;
- `development_evidence`;
- `planning_classification_runs`;
- atomic, reservation-based `planning_ai_usage`;
- `planning_provider_usage` for Plota quota headers;
- PostGIS spatial query functions for census records and Developments;
- postcode-centroid fallback with explicit location provenance;
- conservative one-Development-per-intelligence-application creation;
- a reviewed-only brand development quarterly view;
- `plota` added to the existing planning-alert provider constraint;
- service-role-only permissions/RLS for all new data.

The migration has not been executed by Codex because the local Docker-backed Supabase stack
was not running. The user intends to run it in production. It is additive, but it has not
yet been proven against a real database, so inspect any SQL error carefully before changing
production state.

### Plota ingestion

Core files:

- `apps/web/src/lib/planning-intelligence/plota.ts`
- `apps/web/src/lib/planning-intelligence/ingest.ts`
- `apps/web/src/lib/planning-intelligence/eligibility.ts`
- `apps/web/src/lib/planning-intelligence/types.ts`
- `apps/web/src/lib/planning-intelligence/db.ts`
- `apps/web/src/app/api/cron/sync-plota/route.ts`

Behaviour:

- Search-first, cursor-paginated ingestion.
- One checkpoint after every page.
- Idempotent upsert by `(provider, provider_id)`.
- `include_contact=false` on every Plota request.
- Loads all brand/fascia aliases in paginated batches, once per ingest run.
- Stable classification input hash avoids reclassifying unchanged records.
- Deterministic intelligence limbs:
  - A: `commercial_work` is `new`, `to-commercial`, or `between`;
  - B: `dwelling_count >= 16`;
  - C: distinctive brand alias in description, feature-gated off;
  - D: `commercial_work = loss`.
- Address-only or ambiguous aliases cannot activate limb C.
- Plota allowance values are captured from the actual header names:
  `x-ratelimit-limit-month` and `x-ratelimit-remaining-month`.
- The worker preserves a 5,000-request reserve on a Starter allowance.
- Demo-safe defaults: one page, ten records.

The route refuses a reduced-census backfill beginning before 2026 because Plota documents
`commercial_work` and `dmin` as live-only filters. Since the user has now confirmed full
historical storage is permitted, production should set `PLOTA_CENSUS_SCOPE=full`; the
restriction then does not apply.

### OpenRouter classification

Core files:

- `apps/web/src/lib/planning-intelligence/openrouter.ts`
- `apps/web/src/lib/planning-intelligence/classify.ts`
- `apps/web/src/lib/planning-intelligence/budget.ts`
- `apps/web/src/app/api/cron/classify-planning/route.ts`

Behaviour:

- Default model: `openai/gpt-oss-120b`.
- Strict JSON-schema output validated again with Zod.
- Prompt explicitly treats planning text as untrusted data.
- Returns relevance, proposal, opportunity type, brand roles, scoped observations,
  uncertainties and enrichment needs.
- Model output cannot change deterministic intelligence membership.
- Each call atomically reserves budget in Postgres before contacting OpenRouter.
- Defaults: $20 overall monthly ceiling, $2 initial-classification ceiling, $0.01 reserved
  per first-pass call.
- Failed calls conservatively consume their reservation, preventing retries from evading
  the ceiling.
- A custom model requires an explicit reservation value.
- All model-produced observations and brand signals remain pending review.

### Review and product seam

- `apps/web/src/app/api/admin/planning/review/route.ts`
  - GET returns pending Developments with applications, observations and brand signals.
  - PATCH approves/corrects/rejects the Development and individual evidence rows.
- `apps/web/src/app/api/public/planning/stored.ts`
  - Reads the stored census spatially through PostGIS.
  - Preserves the existing Planning API shape and 2,000-record truncation contract.
- `apps/web/src/app/api/public/planning/route.ts`
  - Uses stored Plota data only when `PLANNING_STORED_READ_ENABLED=true`.
  - The current legacy path remains the fallback until the baseline and recall audit pass.
- `PlanningApplication` received optional Plota/Development metadata in
  `apps/web/src/app/sitematcher-unified/types/unified-workspace.ts`.

No dedicated Planning page or brand-modal visual treatment has been built. Those need
design and should wait until reviewed real data establishes the useful information density.

## Safety flags and configuration

Documented in `.env.local.example`:

```text
PLOTA_SYNC_ENABLED=false
PLOTA_CENSUS_SCOPE=reduced
PLOTA_PAGE_SIZE=10
PLOTA_MAX_PAGES_PER_RUN=1
PLANNING_CLASSIFICATION_ENABLED=false
OPENROUTER_PLANNING_MODEL=openai/gpt-oss-120b
PLANNING_LLM_MONTHLY_BUDGET_USD=20
PLANNING_LLM_INITIAL_BUDGET_USD=2
PLANNING_LLM_CLASSIFICATION_RESERVATION_USD=0.01
PLANNING_BRAND_LIMB_ENABLED=false
PLANNING_STORED_READ_ENABLED=false
```

For production, change `PLOTA_CENSUS_SCOPE` to `full` based on the user's licensing
confirmation. Keep all three enable flags false until the migration and one-page inspection
are complete.

The actual secret values are already in `apps/web/.env.local`. Never print or commit them.

## Live API work already performed

### OpenRouter

Two synthetic smoke classifications were run with `openai/gpt-oss-120b`:

- First result correctly marked high relevance but chose `commercial_loss` for a mixed-use
  replacement scheme.
- Prompt precedence was tightened: mixed residential/commercial proposals must be
  `mixed_use`; commercial loss applies only when removal is the primary outcome without
  material replacement commercial space.
- Second call returned the intended `mixed_use` result.
- Combined reported cost: **$0.000211595**.

Smoke command:

```bash
cd apps/web
npm run smoke:planning-llm
```

### Plota archive probe

Probe command:

```bash
cd apps/web
npm run probe:plota-archive
```

File: `apps/web/scripts/probe-plota-archive-filters.ts`

Canterbury, November 2025 was queried unfiltered, with all `commercial_work` values, and
with `dmin=1`. The Demo key stopped all three at the archive entitlement gate and returned
the same message: historical data before 2026 is available on paid plans. Therefore the
Demo key cannot empirically establish whether a paid plan applies these filters server-side.

Plota's public API documentation calls both filters live-only. Because full historical
storage is permitted, correctness should not depend on this: download the full archive and
filter locally. Re-run the probe after purchasing Starter only if server-side filtering
would be a useful optimisation.

The probe was initially run with three requests and then rerun with the three probes plus
a quota-header inspection, consuming seven Demo requests total. The last response reported:

- monthly requests remaining: **489**;
- delivered rows remaining: **980**.

Do not rerun it on the Demo key without a concrete reason.

## Verification status

Passing:

```bash
cd apps/web
npm run type-check
npm test -- --runInBand \
  src/app/api/cron/sync-plota/__tests__/route.test.ts \
  src/lib/planning-intelligence/__tests__ \
  src/app/api/cron/classify-planning/__tests__/route.test.ts \
  src/app/api/public/planning/__tests__/route.test.ts
```

Latest result: **32 tests passed across seven suites**, and TypeScript passed.

`git diff --check` also passes.

The repository-wide Jest run is not green: 39 unrelated legacy suites currently fail,
mostly in old listings, organisation and UI surfaces. It reported 1,104 passing tests and
138 failures. Do not attribute those existing failures to this planning work without first
reproducing a focused regression.

Local Supabase SQL execution was not possible because Docker Desktop was not running.

## Immediate next steps

1. Wait for the user to run the migration in production Supabase.
2. If it fails, diagnose the exact SQL error and patch the migration rather than applying
   ad hoc production changes.
3. Set the production environment to `PLOTA_CENSUS_SCOPE=full`; leave all workers disabled.
4. Temporarily enable `PLOTA_SYNC_ENABLED=true` with page size 10 and max pages 1.
5. Invoke one discovery page only and inspect:
   - ingest run and checkpoint;
   - census field mapping and raw payload;
   - deterministic limbs;
   - postcode/location provenance;
   - automatic Development creation;
   - stored Plota quota headers.
6. Disable Plota sync again while inspecting if invocation is manual rather than scheduled.
7. Enable `PLANNING_CLASSIFICATION_ENABLED=true`, classify no more than five real
   intelligence records, then disable it again.
8. Review the model outputs manually through the admin review endpoint. Pay particular
   attention to:
   - proposed versus former/existing/neighbouring brand roles;
   - mixed-use versus commercial-loss categorisation;
   - gross/stated dwellings versus proposed, lost and net values;
   - stated floorspace versus existing/proposed/lost scope;
   - whether document or web research is genuinely needed.
9. Build a labelled sample before enabling brand limb C. Required shipping bar:
   at least 95% precision on at least 200 description/corporate-applicant alias hits.
10. Plan the full twelve-month backfill in monthly date windows only after the one-page
    ingest is sound. Keep the stored Planning read disabled until the baseline and manual
    two-authority council-register recall audit pass.

## Later phases not yet implemented

- Fetching Plota associated-application families and conservatively merging Developments.
- Detail refresh tiers and final refresh on decided/withdrawn records.
- Manual 20–30 application document-ranking evaluation.
- Council portal document adapters and text/OCR pipeline.
- Evidence-backed web research for a tightly ranked high-relevance queue.
- Optional PlanNexus QA sidecar.
- Planning alerts switched from upstream postcode fan-out to stored PostGIS data.
- Dedicated Planning page, richer Development cards and brand-modal UI.
- Full brand expansion view joined to store snapshots and requirements; the initial
  reviewed planning rollup exists, but the product comparison is not finished.

## Important files

- Approved plan: `docs/plota-development-intelligence-plan.md`
- Claude's earlier feedback: `docs/plota-development-intelligence-plan-feedback.md`
- Operational runbook: `docs/plota-development-intelligence-implementation.md`
- This handover: `docs/plota-development-intelligence-claude-handover.md`
- Migration: `supabase/migrations/20260915000000_create_plota_development_intelligence.sql`

## Working-tree caution

The worktree already contained unrelated modified `.claude/worktrees/*` entries before
this implementation. Preserve them. The plan and feedback documents were also untracked at
the start of implementation; do not delete them as cleanup.
