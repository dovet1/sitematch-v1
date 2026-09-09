# Plota Development Intelligence — handover after session 2

Date: 9 September 2026

**This supersedes `plota-development-intelligence-claude-handover.md`**, which describes the
state before any migration was applied and predates every bug listed below. Read this one first;
keep the older file for the plan and the original design rationale.

## Where things actually are

The pipeline runs end to end on real data: Plota ingest → deterministic limbs → Development
creation → LLM classification → review-gated storage. Everything found below was found by
running it against live records, not by reasoning about the code.

**Nothing is switched on.** All flags are off in `apps/web/.env.local`; the schema and the
stored records are inert until something is deliberately enabled.

### Applied migrations (all four are live in production)

| Migration | What it does |
|---|---|
| `20260915000000_create_plota_development_intelligence.sql` | Codex's foundation. Applied. |
| `20260916000000_fix_plota_location_provenance.sql` | Adds `location_precision`; adds `source_centroid`; stops claiming exactness. |
| `20260917000000_treat_rooftop_precision_as_exact.sql` | Recognises `rooftop` as exact; adds `postcode` to the promotion trigger. |
| `20260918000000_create_planning_label_submissions.sql` | Temp anon-insertable table for human labels. **Revoke when calibration is done.** |
| `20260919000000_extend_planning_label_submissions.sql` | The v3 label columns. Applied 9 Sep 2026, verified end to end. |
| `20260920000000_add_classifier_v3_development_columns.sql` | Development columns for v3. **Not applied — apply before any v5 run or every classification fails on the write.** |

### Data currently in production

- **164 planning applications** in the intelligence tier, **all classified under prompt
  `planning-stage1-v4`**. The code now emits `planning-stage1-v5` /
  `planning-classification-v3`; nothing has been reclassified, so every stored verdict is
  still v4. See `plota-development-intelligence-classifier-v3-spec.md` — one prompt version across the whole set, which matters because the
  set is a calibration sample.
- Model relevance spread: **44 high / 32 medium / 88 low**.
- Developments exist for every intelligence record; all `pending` review.
- Roughly 200 further census records that did not qualify.
- `planning_label_submissions` is empty apart from whatever labelling has since happened.

### Budgets

- **Plota: ~465 of 500 monthly requests left.** The Demo key's allowance sits below
  `PLOTA_REQUEST_RESERVE` (5,000), so **every run stops after exactly one request** regardless
  of `PLOTA_MAX_PAGES_PER_RUN`. N pages means N invocations.
- **OpenRouter: ~$0.09 spent** of the $5 credit, ~$0.0004 per record including retries.

## Bugs found in live data and fixed

1. **Locations were labelled more precise than they are.** Plota reports
   `location.precision`; the original trigger set `source_exact` for every coordinate. Nine of
   nine records were actually `centroid`. Vocabulary observed so far: `centroid`, `rooftop`.
   **`exact` has never appeared** — do not write rules that key on it.
2. **Condition-discharge applications masqueraded as major schemes.** They inherit the parent
   permission's `dwelling_count`, so two "Details of … pursuant to …" records each claimed the
   same 113 dwellings and each created its own Development. Now excluded in
   `eligibility.ts` (`isDetailSubmission`). **`procedure` cannot be used for this test** —
   Wandsworth returns `reserved-matters` for both those records and for a genuine
   retail-to-gym change of use.
3. **The model wrote `0` for "not stated".** One record asserted zero commercial floorspace at
   0.85 confidence beside evidence describing a health centre and two commercial units.
   `value` is now nullable and unquantified observations become unanswered questions.
4. **`summary` received the `opportunityType` enum** ("mixed_use" as a scheme's whole summary).
   Guarded in `developmentSummary`.
5. **`strict: true` is not enforced** by `openai/gpt-oss-120b` on OpenRouter. 4 of 10 calls
   returned off-schema, stochastically — one invented its own shape entirely. Fixed with up to
   `MAX_CLASSIFICATION_ATTEMPTS` (3) attempts; failure rate fell to ~1% over 164 records.
6. **Relevance was useless** — everything scored `high`. A rubric now lives in both the JSON
   schema and the prompt.

### A mistake worth not repeating

Telling the model *"…never commercial_loss. commercial_loss requires…"* made **9 of 10**
records come back `commercial_loss`. Naming a category repeatedly anchors it. Rewriting the
rule positively — describe what each category is, mention the rare one once — fixed it.

## Known issues, none fixed

- **An orphaned budget reservation is live right now.** One `planning_ai_usage` row sits in
  `reserved` holding $0.00300, left by the record that stranded in session 2. Its application
  state and run were tidied up; the ledger row was not, and `chargedUsage` counts a reserved
  row against the ceiling forever. Covered in
  `plota-codex-handover-worker-reliability-and-escalation.md`.
- **A record can strand in `processing` forever.** The queue selects only
  `queued|failed|deferred_budget`, so a worker dying mid-record leaves it unreachable. One
  record did exactly this. This will recur during a long backfill.
- **Relevance may now be slightly too strict** — two 11- and 15-storey hotel buildings came out
  `medium`. Direction of travel is right; the calibration sample exists to settle it.
- **Related applications are still not merged.** One real site can become several Developments.
  `development_applications.relationship_source` already allows `cited_reference`, and detail
  submissions carry their parent's reference in the description — but the parent is usually
  outside our date window, so this only becomes possible after a deep backfill.
- **`developments.confidence`, observations and brand signals have never been human-reviewed.**
- The repo-wide Jest run is not green; ~39 legacy suites fail for unrelated reasons. The
  planning suites are green: **76 tests across 9 suites** as of 9 Sep 2026.

## The calibration exercise (current work in flight)

Purpose: measure the classifier's relevance and opportunityType against human judgement,
rather than tuning the prompt by eye.

- **Labelling tool**: superseded on 9 September 2026. It now lives in the repo, asks three
  questions instead of two, and is rebuilt from
  `apps/web/scripts/labelling/page.template.html` by
  `npx tsx scripts/build-labelling-page.ts <out.html>`. See
  `plota-development-intelligence-classifier-v3-spec.md`. It still opens in any browser with
  no account and posts to `planning_label_submissions` with the public anon key; a CORS
  preflight with `Origin: null` returns `*`, so `file://` works — this was verified, not
  assumed. **Migration `20260919000000` must be applied first**, or every post is rejected.
- Labels are **blind**: the model's answer is revealed only after the labeller commits, so the
  measurement is not anchored. Do not "improve" this by pre-filling.
- Each labeller self-declares a name (the `user` capability is unavailable on this account, so
  the page cannot know who a viewer is). Labels are namespaced by it.
- An Artifact version also exists at
  `https://claude.ai/code/artifact/2f776a17-3743-4f2f-ba8f-917747fcbda7`, backed by the
  artifact store. **It cannot reach Supabase** — the artifact CSP blocks all outbound fetch —
  so it is a fallback only; both labellers should use the file so the labels land in one table.
- **Scoring**: `npx tsx scripts/score-relevance-sample.ts` (add a directory to merge in JSON
  dumps or exported CSVs). Reports per labeller, then inter-rater agreement between them —
  which bounds what the model can be expected to reach. It now scores all three questions,
  and works either side of migration `20260919000000`.

Early signal from 12 labels, since discarded: about 50% agreement, with the model **over-rating**
(3 of 5 records the human called `low` were scored `high`). Too small to act on.

As of 9 September 2026 exactly **one** label had been submitted, so nothing has yet been
settled. That single label disagrees with the model: human `high` against model `medium`,
on the Wandsworth retail-warehouse-to-gymnasium conversion.

### What the 164 records showed when measured against the objectives

Measured on 9 September 2026 and the reason the classifier is being revised. Full argument in
`plota-development-intelligence-classifier-v3-spec.md`.

- **`opportunityType` is read by nothing.** Not a column on any table, no product code queries
  it, and `subdivision` and `other` were never once returned.
- **Zero brand mentions across all 164 records.** The independent alias matcher hit 14 of 240
  records and most hits are common words caught by accident: PADEL 7, THREE 5, GYM 2, WILLOW
  1. One genuine hit, Tesco. Planning descriptions name the use, not the operator, so the
  classifier's job for brands is a **cost gate**, not extraction.
- **Plota's numeric fields are too sparse to carry the housing objective.** `dwelling_count`
  is empty on 130 of 164 and only 2 records reach 16 or more; `floorspace_sqm` is empty on
  162 of 164.
- **Housing is not concentrated in `commercial_work = loss`.** Model-found housing by Plota
  value: new 8 of 46, to-commercial 8 of 44, between 3 of 30, loss 3 of 44. Gating a dwelling
  question on `loss` would catch 3 of the 22 housing records, and loss conversions run 1, 2, 3
  and 6 homes so they will almost never reach the 16 threshold. The one 556-dwelling scheme is
  `new`.

## Commands

```bash
cd apps/web
npm run type-check
npx jest --runInBand src/lib/planning-intelligence/__tests__ \
  src/app/api/cron/sync-plota/__tests__/route.test.ts \
  src/app/api/cron/classify-planning/__tests__/route.test.ts \
  src/app/api/public/planning/__tests__/route.test.ts
npx tsx scripts/export-labelling-sample.ts <out.json>   # the sample as raw JSON
npx tsx scripts/build-labelling-page.ts <out.html>     # the standalone labelling page
npx tsx scripts/score-relevance-sample.ts              # score against labels
npx tsx scripts/score-relevance-sample.ts <labels-dir> # ... merging exported CSVs too
```

Workers are invoked by starting the dev server and calling the cron routes with
`Authorization: Bearer $CRON_SECRET`; both routes refuse to run while their flag is false.

## Cautions

- **Never enable a flag and walk away.** Turn it on, invoke once, turn it off.
- The census and Development rows are disposable test data; the `planning_ai_usage` ledger is
  not — it is the budget record and must not be deleted, even for failed calls.
- Do not commit `.env.local` or print its values.
- Preserve the pre-existing modified `.claude/worktrees/*` entries; they are unrelated.
- Everything in this work is still uncommitted and untracked on `july-sitematcher-upgrade`.
