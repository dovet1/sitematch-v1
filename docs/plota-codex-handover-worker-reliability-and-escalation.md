# Codex hand-over: worker reliability, and the research escalation pass

Date: 9 September 2026
Two independent work packages. **A is small and urgent. B is substantial.**

## Continuation status — Codex, 9 September 2026

- **Package A is implemented.** Migration `20260921000000_add_classification_lease.sql`
  has been applied. Classification claims are atomic, stale work is reclaimed, provider
  calls are bounded, and abandoned run/usage rows are conservatively settled.
- The one live `$0.00300` orphaned reservation was settled without deleting it. A second
  check found zero reserved initial-stage rows.
- **Package B is implemented and its queue migration is applied.** Verified against the
  configured database after `20260922000000_add_planning_research_queue.sql` was applied.
- The complete research worker was tested on real application `07/26/0675/F` using
  `openai/gpt-5.2`: 10,196 input tokens, 1,306 output tokens, `$0.0318534`. Its `$0.10`
  reservation settled to actual cost, with no failure and no operator claim passing
  grounding. The temporary v4 proxy escalation and pending projections were removed after
  the run; the immutable run and usage ledger remain as the audit trail.
- The current database has zero `escalate_for_research = true` rows because the 164 stored
  classifications predate v5. Consequently, the required live worker run against a handful
  of escalated rows remains pending; do not manufacture escalation or reclassify the sample
  before the labelling decision.
- A live no-op batch check returned cleanly before the proxy run. The post-run integrity
  check confirmed the development was restored to `escalate_for_research = false` /
  `research_state = not_eligible`, with zero pending research signals and zero reserved
  web-usage rows.
- A second real proxy, Rotherham `RB2026/1058`, exposed two faults in the first pass: the
  discretionary web-search tool could be skipped, and the extractor labelled a private
  applicant plus the planning agent as `applicant_developer`. The final pass uses one
  guaranteed bounded web search, stores its memo/citations, and rejects agents and titled
  private applicants. Its corrected run searched once, stored six citations, emitted zero
  signals, and cost `$0.0210965`; the sources named no proposed cash-and-carry operator.
  One intermediate deliberate failure was conservatively charged its full `$0.10`
  reservation and remains in the ledger.
- The research pass now also retrieves evidence-backed commercial facts. It follows an
  explicitly labelled cross-origin Plans/Documents link, supports Rotherham's public
  Plan Portal document-list service, ranks the Application Form first, and sends a scanned
  form through one bounded Mistral OCR file-parser call. Web search remains a separate,
  guaranteed bounded pass; separating the two plugins avoided a live OpenRouter internal
  error. Arbitrary drawings and reports are not fetched merely to fill the document limit.
- Real read-only prompt-v2 measurement on Rotherham `RB2026/1058` found **1,409 m² existing
  GIA, 531 m² lost, 1,836 m² proposed GIA, and +427 m² net GIA**, plus **B2 General
  Industrial -> B8**. Every value passed exact URL/excerpt grounding. It still found no
  named proposed operator. The successful final call used 11,010 input tokens, 2,144 output
  tokens and cost `$0.0796627`, inside the existing `$0.10` reservation. The measurement
  script is read-only, so these calibration attempts created no queue, run or ledger rows.
- Migration `20260923000000_add_research_commercial_details.sql` has been **applied**. It adds directional
  existing/proposed use-class arrays and records the GIA/NIA/GEA basis on floor-area
  observations. The one-record test script restores both arrays and removes only its own
  pending URL-grounded observations; runs and usage rows remain immutable.
- The complete post-migration worker test on `RB2026/1058` succeeded: one item considered,
  one researched, zero failed/deferred, zero operators, and six commercial facts (four GIA
  measurements plus two directional use classes). It used 11,185 input / 2,057 output
  tokens and cost `$0.07451735`; the `$0.10` reservation settled to actual. The final
  integrity check found the proxy restored to `escalate_for_research = false`,
  `research_state = not_eligible`, empty directional use-class arrays, zero pending research
  observations/signals, and zero reserved web-usage rows.
- A second portal-family exercise covered North Warwickshire's Online Register using high-
  priority application `2026/0682/FUL`. The collector now accepts the public disclaimer into
  an in-memory session, parses its document table, requests the application form through the
  portal's documented binary endpoint, and decodes the returned PDF for OCR. It does not
  persist the temporary cookie. Generic discovery was also tightened so navigation links
  such as Weekly List and Pre-Application are not mistaken for application documents.
- The Online Register end-to-end run succeeded: **119 m² existing GIA, 0 m² lost, 729 m²
  proposed GIA, and +610 m² net GIA**. The form states `B8 - Storage or distribution`, but it
  does not explicitly identify that row as a directional existing or proposed class, so the
  worker correctly stored no existing/proposed use-class claim. `A5 Spas Ltd` was retained
  only as the explicitly named applicant organisation (`applicant_developer`), not as a
  proposed occupier/operator. The run used 11,916 input / 2,273 output tokens and cost
  `$0.089675`; cleanup restored the proxy and left zero pending observations/signals and zero
  reserved web-usage rows.
- OpenRouter's Parallel web engine returned repeatable internal errors for this application.
  That failed prompt-v2 attempt was conservatively charged its full `$0.10` reservation and
  remains in the audit ledger. The bounded web pass now uses Exa auto mode and prompt version
  `planning-research-v3`, preserving the failed v2 run rather than overwriting it.
- This is not universal Idox support. Plymouth's public portal presented an incomplete TLS
  certificate chain to Node and Tendring's `robots.txt` disallowed the application route; the
  worker correctly did not bypass either restriction. Those portal variants still need a
  compliant adapter or authority-side fix before they can be claimed as supported.
- A repeatable, read-only document-coverage audit now lives at
  `apps/web/scripts/audit-planning-document-coverage.ts`. It makes no AI/OCR-provider calls
  and no database writes, and emits JSON plus CSV grouped by portal family and host. The
  9 September baseline covered all **44** stored high-relevance applications across **35**
  hosts: 14 council pages were accessible (31.8%), and actual application-form PDFs were
  retrieved for Rotherham and North Warwickshire only (2/44 overall; 2/20 or 10% where Plota
  declared a positive document count). Twenty-seven applications across 19 hosts were
  explicitly disallowed by `robots.txt`; three more hosts failed during transport/certificate
  access. HTML document tabs, application summaries and map pages are recorded as candidates,
  not falsely counted as downloaded planning documents.
- Type-check is clean and the focused planning regression set is **112 tests across 15
  suites**, all green. `PLANNING_RESEARCH_ENABLED` remains absent/false.

You have no context from the session that wrote this, so everything you need is below.
Background reading, in this order:

1. `plota-development-intelligence-session-2-handover.md` — pipeline state and standing cautions
2. `plota-development-intelligence-classifier-v3-spec.md` — the current classifier design

## What this subsystem is

Plota supplies UK planning applications. A deterministic filter promotes some into an
"intelligence tier"; an LLM then classifies each one. It serves three business objectives:

1. Surface applications that matter to a commercial property professional
2. Show which brands are expanding and where
3. Track market size from housing schemes over 15 dwellings

**Everything is behind flags and every flag is off.** The schema and the stored records are
inert. 164 applications are classified and sitting unreviewed.

## Standing rules — these are not negotiable

- **Never enable a flag and walk away.** Turn it on, invoke once, turn it off.
- **Never delete rows from `planning_ai_usage`.** It is the budget ledger, and failed calls
  belong in it. Census and Development rows are disposable; that table is not.
- **Do not commit `.env.local` or print its values.**
- **Do not touch the relevance rubric or the escalation threshold in
  `openrouter.ts`.** A domain expert is labelling a 164-record sample right now, and that
  boundary is theirs to set. An earlier session tuned it by eye against the previous prompt's
  own answers, which is circular; the spec explains why. Changing broken behaviour is fine.
  Changing where `high` stops is not.
- **A prompt change cannot be reviewed by reading it.** If you touch a prompt, classify real
  records before and after and compare. It costs under a penny. Two faults were introduced
  and shipped past careful review this way before being caught by exactly this comparison.
- Preserve the pre-existing modified `.claude/worktrees/*` entries; they are unrelated.
- All of this work is uncommitted and untracked on `july-sitematcher-upgrade`.

## Commands

```bash
cd apps/web
npm run type-check
npx jest --runInBand src/lib/planning-intelligence/__tests__ \
  src/app/api/cron/sync-plota/__tests__/route.test.ts \
  src/app/api/cron/classify-planning/__tests__/route.test.ts \
  src/app/api/cron/research-planning/__tests__/route.test.ts \
  src/app/api/public/planning/__tests__/route.test.ts
```

**112 tests across 15 suites must stay green.** The repo-wide Jest run is NOT green; roughly 39
legacy suites fail for unrelated reasons. Do not try to fix those, and do not treat them as
your regression.

Workers run by starting the dev server and calling the cron routes with
`Authorization: Bearer $CRON_SECRET`. Both routes refuse to run while their flag is false.

---

# Package A — a record can strand in `processing` forever

## The fault, which is two halves

**Half one: nothing can ever pick the record up again.** `classifyPlanningBatch` in
`apps/web/src/lib/planning-intelligence/classify.ts` selects its queue like this:

```ts
.eq('intelligence_tier', true)
.in('classification_state', ['queued', 'failed', 'deferred_budget'])
```

`processing` is not in that list. The worker sets a record to `processing` immediately before
calling the model. If the worker dies in between, the record is unreachable by any later run.
One live record did exactly this during an earlier session.

**Half two: the worker has no timeout, so dying mid-record is easy.**
`classifyWithOpenRouter` in `openrouter.ts` accepts an optional `signal`, and nothing ever
passes one. A stalled connection hangs indefinitely. This is not theoretical: a probe using
the same function hung for nine minutes before being killed, and only returned once an
`AbortSignal.timeout` was added.

Fix both. Fixing only the reclaim leaves the pipeline generating new stuck records; fixing
only the timeout leaves the existing one, and any future one, unreachable.

## The part that is easy to miss

A stranded record leaves **three** rows behind, not one:

| Table | State left behind | Consequence |
|---|---|---|
| `planning_applications` | `classification_state = 'processing'` | unreachable by the queue |
| `planning_classification_runs` | `status = 'running'`, `finished_at` null | run never resolves |
| `planning_ai_usage` | `status = 'reserved'` | **permanently consumes budget** |

That last one matters more than it looks. `chargedUsage` in `budget.ts` returns
`reserved_usd` for any row that is not `complete` or `failed`, so an abandoned reservation
counts against the monthly and stage ceilings forever. A backfill that strands fifty records
quietly burns its reservations and then starts refusing work with `deferred_budget` for no
visible reason.

**This is not hypothetical, and you can see it right now.** Checked against production on
9 September 2026:

| Check | Count |
|---|---|
| `planning_applications` in `processing` | 0 |
| `planning_classification_runs` in `running` | 0 |
| `planning_ai_usage` in `reserved` | **1, holding $0.00300** |

The record that stranded earlier had its application state cleared, and its run resolved, but
**its reservation was never settled and is still consuming budget today**. That single
orphaned row is the whole argument for this package: the visible half of the fault got tidied
up and the invisible half is still there. Settling it is part of the work.

**So reclaiming a record must settle its orphaned run and usage rows, not just flip the
application state.** Decide deliberately whether a reclaimed attempt is charged or released,
and write the reasoning into the migration or the function comment. The existing convention,
stated in `classify.ts`, is that once a call starts the reservation is charged in full,
because the provider may already have billed for an answer that never arrived. A timeout is
that case. Departing from that convention is defensible but must be argued, not assumed.

## Suggested shape

Take a different approach if you see a better one; this is the shape that fits what is there.

1. **Migration** — `supabase/migrations/2026092100000_add_classification_lease.sql`
   (pick the next free timestamp; do not reuse one). Add
   `planning_applications.classification_started_at timestamptz` and an index supporting the
   reclaim query. **You author migrations; the human applies them.** Say clearly in your final
   message that it needs applying.

2. **Set the lease** where the worker already writes `classification_state: 'processing'`.

3. **Reclaim in the queue query.** Include `processing` rows whose lease is older than a
   window. Supabase's PostgREST builder makes an OR across two conditions awkward; a small
   SQL function or an `.or()` filter both work. Make the window a named constant with a
   comment, comfortably longer than the worst-case call: three attempts at the timeout you
   choose, plus overhead. Do not make it configurable by environment variable without reason.

4. **Timeout the model call.** Pass an `AbortSignal` from `classifyPlanningBatch` into
   `classifyWithOpenRouter`. Note that `MAX_CLASSIFICATION_ATTEMPTS` is 3 and the provider
   bills every attempt, so decide whether the budget is per attempt or per queue item and
   keep `DEFAULT_CLASSIFICATION_RESERVATION_USD` a true upper bound on one queue item. It is
   currently 0.003, sized for three worst-case attempts.

5. **Settle the orphans on reclaim**, per the section above.

6. **Settle the orphaned reservation that exists today.** As of 9 September 2026 nothing is
   stuck in `processing` and no run is `running`, but one `planning_ai_usage` row sits in
   `reserved` holding $0.00300. Write a one-off script under `apps/web/scripts/` to settle it,
   not a hand-edit in the SQL editor, and re-check the counts first in case the state has
   moved. Settle it, do not delete it: the ledger keeps failed and abandoned calls.

## Tests

Add to `src/lib/planning-intelligence/__tests__/` and the cron route suite. Cover at least:

- a `processing` record with a stale lease is picked up
- a `processing` record with a fresh lease is left alone, so two workers do not collide
- a timed-out call settles the run and usage rows rather than leaving them open
- the reclaim does not change behaviour for `queued`, `failed` or `deferred_budget`

## Definition of done

Migration written and flagged for applying. Both halves fixed. New tests pass and the 76
existing ones still do. `npm run type-check` clean. No flag turned on and left on.

---

# Package B — the research escalation pass

## Why this exists

Objective 2 is currently producing nothing. **Zero brand mentions across all 164 records.**
That is not a model failure. UK planning descriptions name the use, not the operator: they say
"change of use of retail warehouse to gymnasium", never which gym. An independent alias matcher
hit only 14 of 240 records and most hits were common words caught by accident (PADEL seven
times, THREE five times, GYM twice). One genuine hit, Tesco.

So the operator is not in the description. It is in the application documents, or on the web.
The classifier's job is therefore **not extraction but rationing**: deciding the minority of
applications worth paying a more capable model to research properly.

**That gate is built. Nothing consumes it. That is your job.**

## What already exists

- `developments.escalate_for_research boolean` — set by the classifier as
  `relevance === 'high' && commercialSpace.creates === 'yes'`. See `shouldEscalate` in
  `classify.ts`. On the current sample this selects roughly 44 of 164, about a quarter.
- A partial index on that column, for exactly this query.
- **`supabase/migrations/20260920000000_add_classifier_v3_development_columns.sql` creates
  it and is NOT YET APPLIED.** Verified against production on 9 September 2026: the column
  does not exist. Nothing in Package B works until a human applies it, and the classifier
  itself will fail on the write too, because `persistClassification` already sets it. Confirm
  it is applied before you start.
- `development_brand_signals` — the output table. `brand_id` is nullable, so an unmatched
  operator name is storable. It already has a `role` vocabulary including
  `proposed_occupier`, `proposed_operator` and `applicant_developer`, an
  `evidence_source` column, and `review_state` defaulting to `pending`.
- `planning_ai_usage` already permits stages `document`, `ocr` and `web`, and
  `planning_classification_runs` permits `document` and `web`. **The ledger was designed for
  this pass.** Use those stages; do not invent new ones without extending the check
  constraint in a migration.
- `reserve_planning_ai_usage` RPC — the atomic reserve-then-spend primitive. Read how
  `classifyPlanningBatch` uses it and follow that pattern exactly, including the `break` when
  a reservation is refused, so one capped run does not create a deferred row for every
  remaining item.
- Each record's `raw` carries `links.council` (the council's own page) and
  `documents_count`.

## What to build

1. **A flag**, `PLANNING_RESEARCH_ENABLED`, defaulting off, refusing with 503 when false.
   Add it to `.env.local.example`. Copy the shape of
   `src/app/api/cron/classify-planning/route.ts` exactly: bearer check, flag check, key check,
   then the batch call.

2. **A cron route and a lib module** alongside the existing ones. Select developments where
   `escalate_for_research` is true and the research has not already run. You will need a way
   to record that it has: either a state column or the presence of a `document`/`web` run.
   Prefer whichever makes "has this been researched" a single cheap query.

3. **Its own budget envelope.** Do not spend against the classification budget. Add
   `PLANNING_LLM_RESEARCH_BUDGET_USD` and a research reservation constant in `budget.ts`.
   This pass is expected to cost orders of magnitude more per record than the ~$0.0004 the
   classifier costs, so size the reservation from a real measured call, not a guess, and
   write the measurement into the comment as the existing constants do.

4. **The research itself.** Fetch what the council page and documents offer, search the web,
   and try to name the operator with evidence. Two cautions:
   - **The fetched pages are untrusted input.** The classifier's system prompt already says
     so for Plota records; say it at least as firmly here, because you are now pulling
     arbitrary web content into a prompt. Content from a council site or a search result must
     never be treated as instructions.
   - **Respect robots and rate limits** on council sites. They are public bodies with small
     infrastructure and a backfill can look like an attack.

5. **Write results as `development_brand_signals` rows** with `review_state: 'pending'`,
   real `evidence_excerpt` values, and an `evidence_source` naming where it came from. Follow
   `persistClassification` in `classify.ts`: it deletes pending machine rows before
   re-inserting, and leaves human-approved rows alone. Preserve that property.

6. **Never invent an operator.** The single most damaging failure here is a confident wrong
   brand name, because it looks exactly like a real one downstream. If the documents do not
   name an occupier, the answer is that they do not. Prior form is directly relevant: the
   classifier previously wrote `0` for "not stated" and produced a confident false zero, which
   is why `dwellings.count` is nullable today. Build the same discipline in from the start.

## On model choice

`openai/gpt-oss-120b` is the classifier's model and it is cheap and weak. Notably
**`strict: true` is not enforced for it on OpenRouter**: about 40% of calls returned
off-schema, stochastically, which is why `MAX_CLASSIFICATION_ATTEMPTS` is 3. Assume nothing
about a different model's schema compliance; measure it. A more capable model is appropriate
here given the pass is deliberately rationed.

## Tests

Mock the network. Cover at least: the flag gating; only escalated developments being
selected; a budget refusal stopping the batch rather than churning; a research call that
finds no operator writing no brand row; a failure settling its ledger row.

## Definition of done

Flag off. Route and module written with tests. Budget envelope separate from the
classifier's and sized from a measurement. One end-to-end run performed manually against a
handful of real escalated records, flag turned off again afterwards, with the result reported
including what it cost.

---

## Where the two packages collide

Both touch `apps/web/src/lib/planning-intelligence/classify.ts`. Package A changes the queue
query and the `processing` write; Package B mostly reads `shouldEscalate` and copies the
reservation pattern. **Do Package A first if one person is doing both.** If they run in
parallel, expect a merge conflict in that file and keep Package B out of
`classifyPlanningBatch` entirely — put the new batch function in its own module.

## What is NOT in scope for either package

- The relevance rubric, the escalation threshold, or any prompt wording. A domain expert is
  labelling; that boundary is theirs.
- Reclassifying the 164 records under the current prompt. It costs about seven pence, so cost
  is not the reason: the threshold may move once labels land and it would need redoing.
- Merging related applications into one Development. Real, known, and blocked on a deep
  backfill that the Plota request budget does not currently allow: roughly 465 requests
  remain and the Demo key stops after exactly one request per run regardless of
  `PLOTA_MAX_PAGES_PER_RUN`.
