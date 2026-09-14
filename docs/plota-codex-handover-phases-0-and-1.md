# Codex hand-over: planning Phases 0 and 1

> **Correction, 14 September 2026.** The 3,500 reserve was approved by the user in a Claude
> session on 13 September and reconfirmed on 14 September. The "reserve breach" recorded below
> was not a breach. Claude now operates the pipeline alone at the user's request, so do not
> restart the backfill heartbeat or change the reserve. See
> `docs/planning-claude-handover-2026-09-12.md`.


**For takeover, read `docs/planning-claude-handover-2026-09-12.md` first.** It consolidates
current state and supersedes older operational snapshots below. In particular, classification
catch-up 77253 has stopped (3,493 successes, 10 failures, then a network error); it is not
still running. Backfill is now PAUSED after a reserve breach; see the latest 13 September check below.

Date: 10 September 2026
Both phases are **written and committed; the stored-read cutover is not live.** The two
migrations were applied and verified on 10 September. Separate Vercel workers were deployed,
smoke-tested and scheduled on 11 September; the live website is unchanged. National backfill
is complete through August 2026; 1–10 September is partial. Automatic continuation is PAUSED.
The September backfill reserve remains 5,000 requests. See the operational continuation below.

### Final check — 13 September 2026, 11:14 UTC

**Automation PAUSED; no backfill process remains. Reserve breach: 4,362 remaining**, ledger
10:44:12 UTC, 638 below the agreed 5,000. Session 63575 (started 10:00:05 UTC after 34084
finished and quota/process checks passed) completed August and reached Peak District in
1–10 September before its 1,000-call cap. Local reserve was found at 3,500; origin unknown.
Restored 5,000 locally; 30 tests and explicit boundary checks pass. No deployment performed.
Estimated store count 624,717. Do not restart backfill; no automatic October restart.
Read the consolidated Claude handover for the incident and current state. Earlier statements
that the worker would stop at 5,000 were incorrect for the code used by this final batch.

### Automatic check — 13 September 2026, 09:44 UTC

Session **34084 remains running**. **July completed**, final run
`941b819d-f9f4-434d-8515-72e1c60c2d78` (68 calls, 2,933 rows). August is partial through Coventry,
900 calls this invocation, **5,463 remaining** (**463 above reserve**). First two August chunks
upserted 4,216 and 4,344 rows. National completion is through 31 July. No duplicate consumer
started; inspect this session next time and verify fresh quota before any post-cap restart.

### Automatic check — 13 September 2026, 09:29 UTC

Session **34084 remains running**, July through Watford, 550 calls this invocation.
Latest allowance **5,813** (**813 above reserve**). Three further chunks upserted 4,060,
4,168 and 4,171 rows. June is complete, July partial. No duplicate consumer started.
Inspect this same session next time; pause the heartbeat once the reserve is reached.

### Automatic check — 13 September 2026, 09:14 UTC

Session **34084 remains running**, July through North West Leicestershire, 200 calls this
invocation. Latest allowance **6,163** (1,163 above reserve). Two completed chunks upserted
4,437 and 4,167 rows; months through June skipped with zero search calls. July remains
partial. No duplicate consumer started; inspect this session next time. Heartbeat stays active.

### Automatic check — 13 September 2026, 09:00 UTC

Session **16776 finished at its 1,000-call cap**, July through Hyndburn, still partial.
Confirmed no other backfill process; latest quota **6,383** at 08:52:57 UTC, 1,383 above reserve.
Estimated stored count **559,270**; aggregate status still timed out. Resumed with the same
reserve/cutoff in **session 34084**, PID **38357**. Catalogue loaded 389 councils; initial
checkpoint scan underway. June is fully complete. Inspect session 34084 at the next heartbeat.

### Automatic check — 13 September 2026, 08:44 UTC

Session **16776 remains running**, July through East Dunbartonshire, 800 calls this invocation.
Latest allowance **6,583** (1,583 above reserve). Three completed July chunks upserted 4,297,
4,397 and 4,351 rows. June is complete, July partial. No duplicate consumer started;
inspect this same session next time as it approaches its 1,000-call cap. Heartbeat stays active.

### Automatic check — 13 September 2026, 08:29 UTC

Session **16776 remains running**. **June completed** in run
`69dcdf5e-7ad9-4575-be88-3747fffcc37b` (final 44 calls, 1,884 rows). July is partial through
Ashford, latest log 475 calls this invocation, **6,908 remaining** (1,908 above reserve).
National completion is through 30 June 2026. No duplicate consumer started; inspect this
same session next time. Heartbeat remains active.

### Automatic check — 13 September 2026, 08:14 UTC

Session **16776 remains running**, June through Solihull, 125 requests this invocation.
Latest allowance **7,258** (2,258 above reserve). Completed months through May skipped with
zero search calls; first resumed June chunk upserted 3,972 rows. June remains partial.
No duplicate consumer started; inspect this same session next time. Heartbeat remains active.

### Automatic check — 13 September 2026, 08:00 UTC

After confirming no existing backfill process and reading quota **7,384** (07:36 UTC ledger),
resumed in **session 16776**, lock PID **35097**, with the existing reserve/cutoff intact.
Catalogue loaded 389 councils; initial checkpoint scanning is in progress. Estimated stored
count **514,342**; aggregate status still timed out. May is complete, June partial. Inspect
session 16776 next time. Heartbeat remains active; 2,384 requests above the protected reserve.

### Automatic check — 13 September 2026, 07:44 UTC

Session **72278 exited with a Plota connection timeout**, not its batch cap. Latest successful
log: June through Oldham, 925 requests, **7,393 remaining** (2,393 above reserve). Latest
completed chunk upserted 4,160 rows. May is complete, June partial. No immediate retry;
retry on the next heartbeat after verifying fresh quota and no other active consumer.
Heartbeat remains active; session 72278 is no longer running.

### Automatic check — 13 September 2026, 07:29 UTC

Session **72278 remains running**, June through Medway, 800 calls this invocation.
Latest allowance **7,518** (2,518 above reserve). Two further chunks upserted 4,358 and
4,348 rows. May is complete, June partial. No duplicate consumer started; inspect this
session next time as it approaches its 1,000-call cap. Heartbeat remains active.

### Automatic check — 13 September 2026, 07:14 UTC

Session **72278 remains running**, June through Guildford, 600 calls this invocation.
Latest allowance **7,718** (2,718 above reserve). Two further completed chunks upserted
4,242 and 4,341 rows. May is complete, June partial. No duplicate consumer started;
heartbeat remains active and should inspect this same session next time.

### Automatic check — 13 September 2026, 06:59 UTC

Session **72278 remains running**, June through Conwy in the latest council log. Two further
100-call chunks upserted 4,437 and 4,378 rows; completed chunks total 397 calls this invocation.
Latest quota log at 375 calls: **7,943 remaining**, 2,943 above reserve; actual quota may now
be lower. May remains fully complete, June partial. No duplicate consumer started.

### Automatic check — 13 September 2026, 06:44 UTC

Session **72278 remains running**. **May is complete**, final run
`dd061db3-decb-48b0-983c-f6ceb1b3fef9` (97 calls, 4,100 rows). June is partial through Bolton;
first June 100-call chunk upserted 4,157 rows. Latest log: 200 calls this invocation,
**8,118 remaining** (3,118 above reserve). National completion is through 31 May 2026.
No duplicate consumer started; continue inspecting session 72278.

### Automatic check — 13 September 2026, 06:29 UTC

Session **72278 remains running**, with May through West Oxfordshire, 25 search requests this
invocation, and **8,293 remaining** (3,293 above reserve). Completed months through April were
skipped with zero search calls. No duplicate consumer started; May remains partial and the
heartbeat remains active. Inspect this session next time.

### Automatic check — 13 September 2026, 06:15 UTC

Session **72278 remains running**, with no additional output since its initial completed-window
check. No duplicate consumer started. Latest observed quota remains 8,319 at 06:01 UTC;
no new quota measurement on this check. Keep inspecting this session; heartbeat remains active.

### Handover check — 13 September 2026, 06:13 UTC

Session **90793 finished** at its 1,000-request cap, reaching May through Welwyn Hatfield.
After the temporary Codex usage block cleared, no existing consumer was found and continuation
started in **session 72278**, PID **22960**, at 06:09:47 UTC. This session is confirmed running,
has loaded the 389-council catalogue and is checking completed windows. Latest recorded quota
is **8,319** at 06:01 UTC, leaving **3,319 above reserve**; estimated stored count **453,629**.
May is still partial. The heartbeat remains active; do not start a duplicate consumer.
See the consolidated Claude handover for takeover instructions and remaining feature work.

### Automatic check — 12 September 2026, 18:59 UTC

Backfill **session 90793 remains running**, May through Peterborough, 700 requests this
invocation. Latest allowance **8,699** (3,699 above reserve). Two further completed chunks
processed 4,266 and 4,037 rows. No duplicate consumer started. April remains the latest
fully completed month; inspect session 90793 at the next check. Heartbeat stays ACTIVE.

### Automatic check — 12 September 2026, 18:44 UTC

Session **90793 is still running**, with May progressed through Leeds. This invocation has
made 500 search requests; latest allowance **8,899**, leaving 3,899 above the 5,000 reserve.
Latest completed 100-call chunk processed 4,306 rows. No second worker started; continue
inspecting this session. Baseline is complete through April; heartbeat remains ACTIVE.

### Automatic check — 12 September 2026, 18:29 UTC

Backfill **session 90793 remains running**, May through Harrow, 400 requests this invocation.
Latest observed allowance **8,999** (3,999 above reserve). Two further 100-call chunks processed
4,210 and 4,136 rows. No duplicate worker started; no budget or reserve changes. Inspect this
same session on the next scheduled check. National completion remains through April.

### Automatic check — 12 September 2026, 18:14 UTC

Backfill **session 90793 remains running**; no second consumer started. Confirmed fresh May
progress through East Cambridgeshire: 250 requests this invocation, **9,149 remaining**
(4,149 above the protected reserve). First two 100-call chunks processed 4,213 and 4,396 rows.
Completed months through April were skipped with zero provider search calls. Heartbeat stays
ACTIVE; next check should inspect session 90793 before considering any restart.

### Automatic check — 12 September 2026, 17:59 UTC

Confirmed no backfill OS process and no lock before restart. Latest recorded quota: 9,420
at 15:01:38 UTC; estimated stored applications 439,576 (not exact). Aggregate status RPC still
timed out. Resumed the authorised fixed dated command with September cutoff in **session
90793**. This is now the consumer to inspect; do not overlap it. April is complete and May
partial at the last confirmed checkpoint. Reserve remains 5,000. The intervening queued
heartbeat messages are not evidence of successful runs or new ingestion.

### Automatic check — 12 September 2026, 13:29 UTC

Session 77554 exited with a Supabase/network fetch error in May (`upsertApplications`).
April finished completely in run `5f8b47eb-6f29-4f27-874e-1665e4bf9d00`. Last successful
provider output: 600 calls this invocation, Bracknell Forest in May, 9,441 remaining.
No replacement started on this check: the scheduled policy retries transient failures on a
later check rather than immediately looping. At the next check, confirm no other consumer,
read September's current quota, then resume the fixed dated command with its deadline/lock.
The 5,000 reserve and all other budgets remain unchanged. Heartbeat stays ACTIVE.

### Automatic September backfill continuation — 12 September

User explicitly requested automatic continuation until the 5,000-request reserve. Created
thread heartbeat `september-planning-backfill`, ACTIVE, every 15 minutes through September.
It checks the active consumer before starting another, resumes the fixed 2025-09-10 through
2026-09-10 national command after a 1,000-call cap, and pauses when reserve is reached, baseline
is complete, or September ends. It must not use October's renewed allowance automatically.
This is a local Codex schedule: the Mac and Codex app must remain running.

Current consumer 77554 predates the new process lock; do not overlap it. Latest observed fresh
April page: Sedgemoor, 175 requests in this invocation, 9,866 remaining. First new 100-call
batch imported 4,011 rows. Subsequent launches use the script's exclusive PID lock in
`apps/web/reports/planning-backfill.lock` and the absolute cutoff argument
`--stop-at=2026-09-30T23:00:00Z` (midnight London at the end of September). Cutoff checked before
provider requests, including after rate-limit waits. Three cutoff tests, TypeScript and diff
checks passed. Existing rate limits and the 5,000 reserve are unchanged. No extra Vercel cron
or website deployment was made for this continuation.

### Backfill status check — 12 September, after review verification

Prior backfill session 16029 finished its 1,000-call invocation cap in April, at New Forest
District, with 10,082 requests remaining then. It was paused, not ingesting in the background.
Latest ledger reading before restart: 10,042 remaining at 12:01:52 UTC; estimated stored
application count 404,892. Aggregate status RPC timed out, so do not claim this as an exact count.
March remains the latest fully completed national month; April is partial.

Resumed the same national dated command in session 77554, with the existing 1,000-call cap and
5,000-request reserve. Provider catalogue returned 389 councils. The script is checking saved
completed months first (September completed with zero provider calls); confirm subsequent fresh
April page output before claiming a new quantity imported. This leaves approximately 5,042
calls above reserve at the last reading. No reserve, date range or spending cap changed.

### Classification quality and admin review — 12 September 2026

Built `/admin/planning` in the working branch, with source comparison, confidence/questions
filters, corrections, evidence review and audited decisions. Main website remains unchanged.
User applied `20261001000000_extend_planning_review_fields.sql`. Synthetic RPC verification
confirmed audited saves, evidence ownership and human unknown counts; all fixtures removed.
User also applied `20261002000000_harden_planning_review.sql`; all 13 verification checks
now pass without skip flags, including map reads and stale conflicts. Three real UK-area
first-page reads passed on retry in 1.9–4.6 seconds. Local admin screen available at
`http://localhost:3107/admin/planning` (server session 3408); normal admin login required.
No live website deployment or stored-read cutover. See the quality report for measured limits. See `docs/planning-classification-quality-2026-09-12.md` for scope,
validation, the 30-record sample and four review candidates.

Both confirmed housing false positives were conditionally removed from the unprocessed queue.
Regression-tested eligibility fix deployed to separate workers:
`dpl_B473gqdzcHLWYuerFEAFuDbYKWUW` (READY). No classifier prompt change or new paid research.

### Failed-row hold verified — 12 September 2026, 07:03 UTC

The user confirmed applying `20260930000000_hold_failed_classifications_for_review.sql`.
The previous catch-up repeatedly reclaimed one schema-invalid application (60 successes,
20 failed attempts). Failed rows now await review instead of automatic reclamation; stale
processing leases remain recoverable. The worker also stops its batch after a failure.
Separate worker deployment `dpl_6EboJo6gUNDtrDzsT4nVNFomaW8u` is READY with that safeguard.

Restarted bounded catch-up: first five rounds classified 400 applications, zero failures
or budget deferrals. Process session 77253 remains running (maximum 5,000 applications).
National backfill session 16029 completed March and reached April/Hackney, with 10,282
Plota requests remaining and 177 calls left in this invocation. Resume from saved checkpoints
after the invocation cap if appropriate; retain the 5,000-request reserve.

At 07:02 UTC the monthly AI ledger showed initial classification $1.081389572 and research
$1.0043826, approximately $2.09 total against the $7 overall cap. These are recorded charges,
not a fresh OpenRouter account-credit reading. The aggregate pipeline status RPC timed out
under concurrent work, so no new exact stored/queued totals are claimed; recent individual
classification runs and ingestion checkpoints verify progress. TypeScript and diff checks
passed. The main website remains unchanged.

### Classification recovered — 12 September 2026

The user applied `20260929000000_optimise_classification_queue_claim.sql`. Verified the
ordered queue read improved from timeout at 8.48 seconds to 142 ms. The index matches
`date_received DESC NULLS LAST, id` for eligible queue states; the claim function includes
the matching explicit state predicate while preserving stale-lease and SKIP LOCKED rules.

The separate worker deployment is READY: `dpl_91Dq1trgU8xY3sLivn8dPAdFMxQF`, canonical
`sitematch-planning-workers.vercel.app`. Classification now defaults to the configured
50-item hourly batch. A 20-item live check classified all 20 with no failure/budget deferral.
At 06:47 UTC, status reported 3,343 classified, 11,487 queued and 358,426 stored records;
Plota balance 11,083. A bounded four-consumer catch-up run (maximum 5,000 items) was started.
The national backfill was also resumed and successfully retrieved the 389-council catalogue;
confirm live page progress before describing the outage as fully resolved.

User added $5 and reported $5.90 OpenRouter credit. With authorisation, local and separate
worker config now use initial-stage cap $5, overall planning monthly cap $7, and research
stage stays $2. These are ledger caps INCLUDING month-to-date spend, not new credit grants.
At the change, prior total spend was about $1.78, leaving about $5.22 under the overall cap.
No main-website deployment, stored-read cutover, or extra research schedule was made.

### Capacity and classification failure check — 11 September, 22:26 UTC

Read-only audit: 356,037 stored applications; 2,991 classified; 11,815 queued. Plota balance
11,166, leaving 6,166 above the agreed reserve. Completed October–February run totals used
1,418 / 1,255 / 1,296 / 1,110 / 1,199 requests respectively (include pilot/retry overhead).
March is partial at 1,082 recorded requests. Remaining backfill is likely around 6,500–8,000
requests, a rough projection rather than a guarantee; plan on some October carryover.

Classification is stalled: Vercel logs show repeated hourly `/api/cron/classify-planning`
500 responses with PostgreSQL 57014 statement timeout. Latest successful initial run was
14:17 UTC; eight subsequent hourly failures were observed. This is not a budget stop.
September initial-stage ledger charge $0.773625972 across 3,204 completed usage entries
(includes repeats/failures; not distinct classified applications), no reserved entries.
At that observed average, the current 11,815-item queue costs roughly $2.85 more, versus
about $1.23 left in the $2 stage cap. Overall monthly cap remains $20; web-stage charge
$1.0043826. Need diagnose the failing queue/database statement, then reassess catch-up
throughput and stage budget. No budget or schedule changed during this read-only check.
`scripts/check-planning-capacity.ts` reproduces the audit. The deferred-state count failed;
do not report it as zero. Backfill remains paused on provider 502s; restart failed at the
council catalogue as well as the earlier page request.

### Backfill and extraction check — 11 September 2026, 21:02 UTC

National backfill is complete through February 2026. Latest resumed reading: 11,166 remaining, March at South Downs. The previous invocation stopped at
its 1,000-call cap in March at North Somerset with 11,427 remaining. Resumed the identical
fixed-window command; the fresh REST usage reading was 11,367 remaining and the store
count was **estimated 347,337**. The combined pipeline status RPC timed out again while
these narrow reads succeeded. Do not claim the status-query performance issue is permanently
resolved. `scripts/check-planning-progress.ts` reproduces these read-only checks.

Crawley extraction is evaluated separately by `scripts/evaluate-crawley-research.ts`, which
uses recovered document text and the production budget ledger. It writes evaluation run
output, preserving queue state and product evidence. The v5 evaluation failed to parse JSON;
its $0.10 reservation was conservatively charged. v6 allows 3,200 structured output tokens
and includes finish diagnostics in JSON parse errors. The default per-item reservation is
now $0.20 against unchanged $2 research-stage and $20 monthly caps. The v6 retry completed at $0.08868125 (run `0e6ad204-3bd7-49fe-8f0d-6b16bc9eba24`), returning site area,
use classes, proposed/lost/net floorspace and agent; it missed existing floorspace and
applicant. The new standard-form reader recovers both from the real cached document in an
offline check and is integrated into extraction. No further paid retry was made.

The NEC public Continue Browsing GET/session flow is implemented and verified to recover
Birmingham 2026/03654/PA's application page. It does not yet retrieve that application's
PDFs. Source collector tests and the TypeScript check pass. No website deployment or SQL
was performed during this continuation.

### Document access recovery — 11 September 2026

The 20-item no-model audit initially retrieved zero PDFs. Fixed Northgate button links,
Crawley's disclaimer variant and public-session document cookies, and misleading success
reporting for browser-warning pages. A targeted repeat now retrieves Crawley
CR/2026/0416/FUL's application form and planning statement. Manual evidence review verifies
347 m² existing and proposed commercial floor area, net zero, 631 m² site, change from
nightclub/restaurant to Class E offices, applicant Connect UK and agent Squires Planning.
No operator is confirmed. See `docs/planning-document-access-2026-09-11.md` for sources,
remaining access gaps and the increased bounded PDF text allowance. No new paid research,
SQL, database update or website deployment was performed for this recovery.

### Research field expansion — 11 September 2026

Research prompt v5/schema v3 now retains explicit site-area observations (original units,
existing/proposed/unspecified) and named applicant/developer/agent clues separately from
operator/brand signals. Individuals can be applicant clues without being labelled developers.
These evidence-backed arrays are persisted in the existing classification-run JSON output;
no SQL migration is required. They are not yet promoted to editable Monitor fields.

A missing web memo no longer discards council/document evidence: extraction can use the
retrieved sources, with finish reason and token diagnostics recorded as research warnings.
If neither memo nor retrievable evidence exists, it still fails and stops the batch. No new
web retry or budget increase was added. The cause of the original empty response remains
unproven because the original failure did not retain provider finish reasons.

The source collector now follows one bounded level of document-list links, prioritises forms,
retains PDF page labels, and flags missing PDFs. Council document fragment identifiers remain
part of grounding URLs so different files in the same portal do not overwrite each other's
source text. Validation: 30 research tests pass across three suites (including persistence),
plus TypeScript checking. The revised live trial completed three developments with no verified findings, costing
$0.1294545. All three council pages were disallowed by robots.txt; retrieved web evidence
was insufficient. One empty web memo reported finish_reason=length, 1,000 completion tokens.
See `docs/planning-research-trial-2026-09-11.md`. Do not scale paid research on this evidence.

### Latest continuation — 11 September 2026

- National monthly backfill checkpoints are complete from 10 September 2025 through
  31 January 2026. February is partial; the resumed run passed Newry, Mourne and Down
  with 12,803 requests remaining. This is a point-in-time provider reading, not a fixed balance.
- The research success counter now counts distinct developments with proposed occupier or
  operator evidence within a batch. Applicant/developer-only findings and repeated findings
  do not inflate it. Regression tests cover role filtering, distinct developments and
  immediate failure retries.
- `apps/web/scripts/run-planning-research-batch.ts` evaluates at most three genuine queued
  developments through the existing research worker and its budget ledger. Default is dry run;
  `--commit` runs the bounded trial. It does not stage proxy applications or enable a schedule.
- The 14:36 UTC trial considered three attempts: one completed, two failed, zero operator
  successes and three use-class findings. Only two unique run rows exist: the failed queue
  item was immediately reclaimed and its run upsert overwritten. Completed run
  `0efeffc3-1231-4511-96d8-a84210151f16` cost $0.0405475; the two failures each settled
  the $0.10 reservation (conservative ledger charges, not measured provider costs).
  Failure: `OpenRouter returned no research memo`, run
  `d7e78bc4-3b77-4bae-ab3d-073051aad063`. The batch now stops after its first failure;
  do not repeat paid evaluation until this empty-memo response is diagnosed. This tiny trial
  does not establish operator hit rate or canonical brand-match accuracy. Research remains
  unscheduled. The evaluation runner now also prints ledger entries so repeated attempts
  cannot disappear behind a run upsert.
- The resumed stored housing scan finished: 184,144 rows scanned and 261 queued in that
  segment. Concurrent earlier UUIDs can be missed; repeat after ingestion settles. Two
  additional audit examples still need correction before declaring eligibility fully calibrated:
  `3261c858-eb17-4d04-ae44-30bd70e6e8d1` (Housing Manager's Flat) and
  `326624cc-cecb-4631-ab06-e10298842831` (long residential title before condition discharge).
  Preserve any completed classification/review when reconciling their state.

Plan of record: `docs/plota-planning-delivery-plan.md`. Read it before this document — this
one says what changed and what will bite you, not why the phases are ordered as they are.

Commits: `e55aaa3` (Phase 0), `6135c4c` (Phase 1).

## Do this before anything else

Nothing below runs, and no test proves anything about the live system, until:

1. **Apply two migrations. Done and verified on 10 September.**
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

### Residential eligibility and September reserve — 11 September

Follow-up live scan: the first 5,000 rows queued four records. The next scan processed at
least 34,000 more rows and queued 38, before being paused when a `Part Discharge` parent
reference appeared in its samples. The detail-submission predicate now handles Part/Partial
Discharge, with a regression test. A conditional reconciliation checked seven queued
missing-count descriptions mentioning discharge and removed one false positive from the
intelligence queue, retaining its application. The scan resumed from UUID
`3067cb87-2e8e-4466-96cf-131fc87762d5`. Counts are progress snapshots, not a completed audit.
The added exclusion passes 32 eligibility tests; it is included in the latest worker build.


The missing-count housing gate is implemented and deployed in the separate workers.
It admits descriptions proposing new housing when Plota supplies no dwelling count,
without inventing a count or changing the known-count floor of 15. Routine housing
mentions and condition details remain excluded. A dry-run over 5,000 stored records found
five candidates; review caught a housing-titled condition discharge, which now has a
regression test. The corrected run queued four genuine housing proposals. The remaining
store scan runs through `scripts/requeue-uncounted-housing.ts`, keyset-paginated and guarded
against concurrent changes by input hash and state. It does not call Plota or an LLM.
Repeat the scan after ingestion settles to catch rows inserted behind its UUID cursor.
This is the eligibility part of Phase 2a, not completion of the user-controlled display
threshold, residential count validation or the Monitor.

The user reserved 5,000 September requests specifically for NEW applications and accepted
finishing missing history in October. The worker policy now reflects that: backfill,
refresh and on-demand imports stop at 5,000; discovery can use the reserve down to zero.
A preflight reads this month's latest allowance, so repeated invocations do not each spend
one extra request below the reserve. Last month's reading is ignored after the reset.
The existing running local backfill loaded the previous conservative guard; it still
stops at the reserve. Subsequent local runs use the new preflight.

Deployed READY (including Part Discharge exclusion): `dpl_6sQsyDQAcMed8jbppzkZCZYg1Zk7` at the planning-workers domain.
Targeted ingestion, refresh and eligibility tests: 59 passed; TypeScript passed; Vercel
production build passed. No live website deployment or user-applied SQL is needed here.
December's national backfill completed; January is in progress. Admin review UI, the
remaining Phase 2a work, and measured operator research remain outstanding.


### Status timeout diagnosed — user-supplied query plan, 11 September

User confirmed standard VACUUM (ANALYZE) completed. Post-maintenance RPC checks at
10:02 UTC both succeeded: 3,193 ms then 197 ms, while backfill was still writing.
The second response reported 187,551 stored records, 49,038 undecided, 2,937 classified,
2,008 queued and 15,335 provider requests remaining. This verifies recovery in these
checks, not a sustained latency guarantee; recheck as the national import grows.
December backfill remained active at this measurement. No further user SQL requested.


Second supplied plan confirms the new indexes are used. Freshness still takes 9,538 ms:
exact stored count costs 9,406 ms scanning 174,711 index entries with 37,665 heap fetches;
live count costs 130 ms; latest date 2.3 ms; oldest check 0.02 ms. Prepared a standalone
user-run `VACUUM (ANALYZE)` in `docs/planning-status-maintenance.sql` to improve visibility
map coverage. This is maintenance, not a schema migration. It has not been run by the agent.
Re-measure after maintenance; ongoing ingestion can clear visibility bits again, so this
is not yet evidence that exact counts will remain fast at national scale.


Post-migration RPC verification: first request still timed out after 8,323 ms; second
returned successfully in 3,192 ms. Do not claim the timeout is resolved. Need the updated
`docs/planning-status-diagnostics.sql` plan to see whether heap fetches or another scan
remain expensive. Successful status showed 166,314 applications, 43,431 undecided,
2,937 classified, 1,686 queued, and 15,897 provider requests remaining. National November
completed; December has started. A scheduled discovery run at 09:00 UTC processed 20 pages
and 1,000 records successfully, so automated execution is now observed.


The complete status SELECT took 10,725 ms. Freshness consumed 9,517 ms (~89%),
scanning 165,432 applications and reading 23,114 shared blocks. Provider usage consumed
127 ms; adding an index there alone would not address the main bottleneck.

User confirmed applied: `supabase/migrations/20260928000000_optimise_planning_pipeline_status.sql`.
It splits freshness into index-friendly scalar reads, reuses the received-date index,
and adds a partial `last_checked_at` index over all undecided records (including NULL
received dates). Exact counts, NULL semantics, response shape and service-role access remain
unchanged. The user runs SQL; verify the RPC latency and comparable diagnostic plan after
application before claiming the performance issue is fixed.


### Separate workers deployed — 11 September 2026

The user chose to leave the live website unchanged and explicitly authorised Vercel deployment.
The isolated project is `sitematch-planning-workers`, project id
`prj_VJUwKQ4zenpKPWnbg1jQ2VJHSNX2`, in `toms-projects-2a434695`:
https://vercel.com/toms-projects-2a434695/sitematch-planning-workers

Production deployment `dpl_3Xu5oaUZtMCHQhD22nJxB16KprTp` is READY at
https://sitematch-planning-workers.vercel.app. The Vercel project API confirms all three
cron definitions are enabled and attached to this deployment:

- Discovery every three hours, 20 pages of 50 records per invocation.
- Refresh every six hours, sharing 20 pages across up to three cohorts.
- Classification hourly, up to 20 queued records per invocation.

Provider reserve remains 5,000 requests; classification budgets remain $2 initial stage and
$20 monthly. Brand limb, research and stored reads remain disabled. The two data jobs have
a combined maximum of 240 search requests daily (7,200 in 30 days), excluding backfill and
manual runs. This is an initial bounded cadence, **not a demonstrated national freshness
guarantee**. Re-measure cohort completion after the baseline; the original 35-day freshness
assumption was based on much smaller cohorts and must not be used as evidence of throughput.

The initial unscheduled deployment was smoke-tested: health 200, unauthenticated worker 401,
discovery one page/50 records, refresh one page/50 records, classification one successful
record with no failure or budget deferral. Only then was the scheduled deployment released.
No automatic cron execution has yet been observed. Verification: 42 suites/395 tests passed,
four tests skipped; web type-check and the isolated production build pass.

`apps/web/scripts/package-planning-workers.mjs` creates the isolated deployment from 13
explicitly allowed source files; it never copies credentials or the website. It defaults to
no schedule; `--scheduled` includes the schedule above. Example:

```bash
node apps/web/scripts/package-planning-workers.mjs /private/tmp/planning-workers-next --scheduled
```

Install dependencies in that generated directory, link **only** to `sitematch-planning-workers`
in the team above, and deploy there. Production credentials are already configured in Vercel.
This is a CLI deployment, not an automatic Git deployment: future worker changes require a
new package and deployment. The original planning cron entries were removed from the
unreleased website config to prevent duplicates on a future site release. Other website
jobs remain as before. No website deployment was made.

Discovery now retains the previous unfinished date window across midnight, including
unstarted nations, and only advances after all searches complete. Worker authentication
also rejects requests when `CRON_SECRET` is absent.

### National backfill paused on an archive response — 11 September 2026

The national window 2025-09-10 through 2025-09-30 completed. October is partially imported.
The provider catalogue reported 393 councils on 10 September and 389 on 11 September;
reconcile that change before declaring the eventual baseline complete.

The latest run stopped at
`backfill:full:2025-10-01:2025-10-31:council:kensington-and-chelsea:all`.
A repeat of its saved cursor returned 50 live records, `next_cursor: null`, and
`historical_available: true`, with no `historical_included` signal. Request id:
`req_0b3ea56ee3483464ab07bfae`. This differs from the earlier *non-terminal* metadata case:
there is no next page to follow. Investigate provider pagination/coverage or narrower date
windows; do not silently remove the completeness guard or declare an entitlement failure.
No national backfill process is running at this checkpoint. Saved progress remains intact.
The script now spaces requests at least 750 ms apart and retries 429 responses using the
provider delay, with a bounded retry count. Stored reads remain off pending the baseline.

### Deployment inspection — 10 September 2026

The signed-in Vercel dashboard identifies project `sitematch-v1-web` in team
`toms-projects-2a434695`, connected to this repository (`dovet1/sitematch-v1`, root `apps/web`).
Production serves `site-match.co.uk` and `www.sitematcher.co.uk` from `main` at `c9ae8e0`
(the June 5 deployment). `july-sitematcher-upgrade` is a separate preview deployment.
Project variable searches found no `PLOTA`, `PLANNING` or `OPENROUTER` entries, and no shared
variables are linked. Existing secret values were not revealed or changed.

The project-name question was resolved without user action. The deployment choice was
subsequently resolved in favour of separate workers, as recorded above. Do not promote the
entire upgrade branch as part of this work.

### Settled pilot and live cap proof — 10 September, 19:02 UTC

After the three-council twelve-month backfill, a final catch-up classified 219 newly queued
applications with no failures, then found the queue empty. Status: **17,575 stored records**,
**2,897 classified**, no queued/failed classification states, and 19,549 provider requests
remaining. The unclassified rows below are predominantly outside the existing intelligence
tier; an empty classification queue does not mean every census record has a model answer.

| Boundary | Stored shown | Full stored matches | PlanIt | Overlap-only among shown |
| --- | ---: | ---: | ---: | ---: |
| Balham | 2,000 (capped) | 3,062 | 7 | 1,140 |
| Birmingham centre | 686 | 686 | 24 | 243 |
| Canterbury | 904 | 904 | 28 | 210 |
| Wider Wandsworth cap-check box | 2,000 (capped) | 4,659 | not queried | 24 |

All four geometries passed the public API boundary validator. All returned sequences passed
relevance, date, id, rank continuity and duplicate-id checks. For both above-cap boundaries,
the capped first 2,000 ids **exactly matched** the first 2,000 from a full read sorted
independently in the measurement script. That result retains 8 older ranked records in
Balham and 54 in wider Wandsworth which a newest-2,000 cut would discard.
The above-cap live acceptance check is now proved, not inferred from a national count.

Coverage remains a product change: twelve-month full census and approximate overlap versus
PlanIt's two-year large-application/type/status filters. These count comparisons are not a
record-by-record recall audit or a claim that every approximate match is physically inside.

The next backfill invocation expands to the complete provider council catalogue via
`--all-councils`. It verifies the catalogue response is complete, uses the same per-council
checkpoints (so the pilot is retained), caps each invocation at 1,000 search calls, and stops
at the provider reserve. National completion remains outstanding; keep stored reads off.
Worker deployment is now complete, as recorded above. No project details or deployment
decision remain requested from the user. The earlier archive-key question was withdrawn.

### Continuation repair and archive gate — 10 September 2026

`runPlotaRefresh` now checks the latest checkpoint group for each selected month before
starting a new walk. If any expected search is pending **or never started**, it preserves
the original cycle key and end date. This resumes across UTC days and avoids invalidating
a current-month cursor when that month's end date advances. Completed walks can start a
fresh cycle as before. An explicitly supplied cycle key still selects that exact cycle.
Each returned cohort now identifies the actual cycle key it used. No migration is needed.

The live continuation completed both months: September run
`312e5b68-3d71-49ce-9cd1-59a16e8482e1` and August run
`c47c7327-4253-41d4-b78b-7d6d7eda330e` both returned `complete`. The invocation made 100
requests and processed 4,780 records, including 813 intelligence-eligible processing hits.

The original user decisions in `plota-development-intelligence-claude-handover.md` establish
a licensed **full census covering the preceding twelve months**. The dated, resumable
`apps/web/scripts/backfill-planning.ts` is prepared for 2025-09-10 through 2026-09-10,
split into monthly windows. It defaults to a dry run and caps each committed invocation at
1,000 requests, retaining the worker's 5,000-request reserve.

**Follow pagination before judging archive completeness.** A live England archive probe for
September 2025 returned HTTP 200 and a live record received in 2025, but also
`historical_available: true`. [Plota's documentation](https://plota.co.uk/api-docs) describes
that flag as withheld records. A Canterbury query returned 50 historical records and
`historical_included: true` with the same key, proving archive entitlement.
The national pilot later stopped at Kensington and Chelsea, which made the actual pagination
behaviour visible: its first page returns 50 live records and `historical_available: true`;
following its cursor returns a terminal page with `historical_included: true`.
Probe requests: `req_020bd72f93748fc103b86be6`, `req_beee16afcd4992228ec82df9`.
**The early flag is not sufficient to diagnose either a key or a nation-query restriction.**
The first guard was too aggressive and was corrected before resuming the national backfill.
Reject advertised-but-unincluded history only on a terminal page, never instead of following
an available cursor. No subscription/key change is required; no archive-refresh rerouting is
required on this evidence.

`buildSearchSpecs` now accepts explicit council slugs for full-census ingestion, giving each
council its own checkpoint. This parameter was verified against the live API before being
introduced. The backfill runner requires `--councils=...`; its first scope is Wandsworth,
Birmingham and Canterbury for coverage/cap verification, not a claimed national baseline.
The provider council catalogue returned 393 councils for national expansion. This route
allows the pilot's completed councils to be retained when expanding, rather than re-imported.
`runPlotaSync` rejects terminal withheld-archive metadata after logging provider usage but
before marking that query complete. Regression tests cover both true terminal omission and
the legitimate live-page-to-archive continuation. Partial runs do not establish full coverage.

The worker runner also supports `classification --commit --drain`: four independent atomic
queue consumers, bounded to 5,000 items, stopping on failure, budget deferral, or an empty
queue. Existing stage/monthly budgets are unchanged. Production project details have been
requested so recurring jobs can be configured and verified; production flags remain unchanged.

The first catch-up classified 1,839 records and stopped on one failed attempt. A subsequent
status read showed no outstanding failed classification (the item had already recovered via
another queue claim). The second catch-up classified another 668 and then observed an empty
queue. Backfill can enqueue more, so these are run results rather than a permanent queue state.

**Archive identity also needed a live-data fix.** The pilot stopped at Birmingham reference
`2025/07304/PA`: the provider's live and historical ids differ for the same council reference.
Ingestion now deduplicates each page by council/reference, prefers live data over archive
twins, and looks up unseen provider ids by council/reference. When a live id replaces an
archive id it updates through the existing natural-key constraint, retaining the application
UUID and Development links. Ordinary updates still use the provider-id constraint so a
corrected reference can be applied. Raw provider ids are not rewritten inside source payloads.

The resumed pilot skipped its already completed September–November windows without provider
calls, passed the December duplicate, and completed all remaining windows through
2026-09-10 for the three selected councils. The successful continuation used 141 requests;
the original run had already completed the first three windows in 61 requests and had
partially processed December before the duplicate stopped it. Nine archive twins were
skipped in the resumed December batch rather than overwriting live data.

Validation after these changes: TypeScript passed; 42 Jest suites passed (390 tests, four
skipped). The backfill dry run generated thirteen contiguous windows covering the exact
twelve-month dates, including the partial months at either end.

### Operational continuation — migrations applied, 10 September 2026

After the user applied both migrations, all three new RPCs returned successfully. The ranked
read returned a real high-relevance Wandsworth application with its classification and
location uncertainty. A single Plota search confirmed a **20,000-request monthly limit**;
the earlier status document's 500-request allowance was an old observation.

`apps/web/scripts/run-planning-worker.ts` now runs one bounded discovery, refresh or
classification batch using the existing worker libraries. It defaults to a dry run; pass
`--commit` to execute. Run from `apps/web`. It does not enable recurring schedules or run
research. Discovery and refresh use 50 records per page and at most 100 requests, retaining
the provider reserve. Classification handles at most 20 applications under existing budgets.
The current environment's census scope is preserved (reduced for these runs).

- Discovery run `fb345047-7c8c-4045-a573-c615c58329a5` completed all configured searches in
  45 requests: 1,967 records processed/upserted, of which 695 qualified for intelligence.
  These are processing counts across overlapping searches, not unique additions.
- One classification batch considered and classified 20 applications, with zero failures or
  budget deferrals.
- Refresh processed 4,530 records in 100 requests. September completed in run
  `623a71f3-47ed-45b0-bd41-9912070fa586`; August stopped partway through in run
  `53e0397a-343b-4a44-a1b1-9821eea4e1a2`. The August England commercial search completed
  45 pages; the residential search checkpoint holds 22 pages and remains pending.
- Final status at 15:12 UTC: **4,566 unique stored applications**, 4,472 live records,
  1,990 queued for classification and 171 classified. Plota reported 19,855 monthly
  requests remaining. The classifier batch's 20 successes are not a net increase over
  the original 164: ingestion can requeue records whose input changed.

**The live runs exposed a scheduling constraint.** A shared 100-page budget did not finish
even the current two monthly cohorts. Increasing the number of selected cohorts cannot fix
that. A same-day invocation resumes the saved refresh checkpoint; a later UTC date creates
a new cycle key and starts the walk again. Establish continuation across an incomplete cycle
before treating a weekly schedule as a complete refresh strategy. The 35-day warning currently
assumes each selected cohort is completed, which this run disproves at this page budget.
At the current 20 items every six hours, classification can handle at most 80 applications
per day: the observed queue alone needs about 25 days, before new arrivals.

`apps/web/scripts/check-planning-cutover.ts` provides a repeatable read-only comparison with
PlanIt. Initial measurements at approximately 14:59 UTC, while refresh was still running:

| Boundary | Stored | PlanIt | Stored admitted only by uncertainty overlap |
| --- | ---: | ---: | ---: |
| Balham | 16 | 7 | 10 |
| Birmingham centre | 1 | 24 | 0 |
| Canterbury | 3 | 28 | 0 |

Neither provider truncated these results. Stored relevance/rank ordering passed, but **none
exercised the 2,000-record cap**. These are preliminary counts, not accepted coverage or a
record-by-record reconciliation. The script contains the exact boundary coordinates.
Balham demonstrates the expected product disagreement from wider inclusion; the other two
areas expose the remaining historical coverage gap. The store reported 1,800 unique records
at the start of this measurement, with refresh still in progress.

The cutover flag remains off. Production flags were not changed. The current two received-date
cohorts fit within the existing three-cohort selection; increasing that selection alone cannot
improve coverage. Measure refresh completion against the shared page budget before changing
the weekly cycle or its 35-day warning threshold.

Next: finish/repair refresh continuation, size classification throughput against measured
arrivals and the budget, then backfill the agreed historical window and repeat coverage
measurements on a settled store. The three initial small boxes still do not establish the
required above-cap boundary. Do not interpret the national record count exceeding 2,000 as
passing that acceptance case.

Validation: TypeScript passed; 42 relevant Jest suites passed (382 tests, four tests skipped).

### Live readiness check — 10 September 2026

A read-only check against the Supabase database configured in `apps/web/.env.local`
(with root `.env.local` as fallback) found:

- `planning_pipeline_status`, `planning_refresh_cohorts(p_limit)` and
  `planning_tab_applications(p_boundary, p_limit)` all return `PGRST202`: the required
  functions are unavailable through the API. The two migrations above still need to be
  applied, or their exposure checked if they were applied elsewhere.
- An exact count of `planning_applications` returned **240 stored records**. No boundary
  can yet exceed 2,000 stored applications, so the live record-cap acceptance check is
  blocked by data volume as well as the missing ranked-read function.
- Local configuration still has both workers disabled, page size 10, one page per run,
  reduced census scope, and no explicit refresh-cohort or stored-read override.
  These are local settings; deployed environment settings were not inspected.

No migration, worker, paid provider request, or cutover was executed. Resume by having the
user apply the two migrations, then re-check all three functions. Configure the workers
and ingestion budgets against the subscription allowance, populate the store, and perform
the multi-boundary comparison and live cap check below before enabling stored reads.

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
