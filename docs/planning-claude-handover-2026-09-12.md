# Planning intelligence: Claude takeover handover

Snapshot updated: 14 September 2026. Read this first; the longer handover contains historical states
that are superseded by this snapshot. All figures below are observations, not live counters.

## Current position — 14 September 2026: Claude owns operations

- **The 3,500 reserve is the user's decision, not an unexplained change.** The user approved
  lowering it from 5,000 in the Claude session on 13 September, after measuring discovery at
  about 160 requests a day. On 14 September the user reconfirmed 3,500 after it had been reverted
  to 5,000. Backfill running below 5,000 was therefore **not a breach**.
- **Claude is the sole operator of the planning pipeline** at the user's request. Codex's
  `september-planning-backfill` heartbeat stays paused. No other agent should start backfill,
  drains or deployments, or change the reserve or budgets.
- Reserve restored to `3_500` in `plota.ts`, with the approval recorded beside it.
- **The national backfill is complete**, 10 September 2025 to 10 September 2026 across all 389
  councils, finished at 07:31 UTC on 14 September. The last run used 173 requests and left 4,087.
  No backfill restart is needed, in October or at any other time.
- Classification caps are $10 initial and $12 monthly, both locally and on the workers.
- **Workers deployed 14 Sep 07:46 UTC as `dpl_HXCfXPLGjgfAFaTSeKZUTKGn2Fp1`**, from
  `/private/tmp/planning-workers-20260914`. The live source was verified identical to that package.
  It adds the 7-day discovery window, the late lane (`45 */6`), the deep lane (`5 1,13`, UTC) and
  the 3,500 reserve. The previous production deployment was `dpl_B473gqdzcHLWYuerFEAFuDbYKWUW`.
- **Supabase compute upgraded from Nano to Micro** on 14 September; Nano could not serve the
  national store (ranked reads and the status report timed out). The status report still counts
  every row and may time out; the tab's freshness no longer depends on it.
- **Phase 1 cutover measured** and recorded in the delivery plan. The tab code now
  calls `planning_tab_applications_v3` and reads freshness from four indexed values.
- **PlanIt removed from the codebase** (14 September). The planning tab reads only stored
  data; there is no stored-read flag any more, so deploying the main website is the cutover.

- **All work is committed and pushed** to `july-sitematcher-upgrade` (commits `527ef96` pipeline,
  `49b4589` research, `6781c46` review screen, `428583a` tab cutover). Vercel's production branch
  for `sitematch-v1-web` is `main`, so branch pushes only create previews. Left uncommitted on
  purpose: `docs/brand-centric-model-sketch.md` and the three `.claude/worktrees` entries.
- All migrations through `20261005000000_planar_prefilter_planning_tab_read.sql` are applied.

### Later on 14 September (second Claude session)

- **Operations check, 10:25 UTC:** latest allowance **4,044** (544 above reserve); main discovery
  runs **full** census (`census_scope: full`), 20 requests at 09:00. No late, deep or refresh run
  since the 07:46 deploy yet: the late lane is next due 12:45 and deep 13:05 UTC. Late, deep and
  refresh cannot spend the reserve, so they share only ~540 requests for the rest of September.
- **Lane gap measured and fixed locally, not deployed.** Six weeks of the full census (4 May-14
  Jun 2026, 73,474 records): the reduced specs miss 238 of 4,724 intelligence-tier records (5.0%),
  all uncounted housing. 167 are amendments/discharges quoting a parent permission; of the 71 real
  proposals, `category=new-homes` returns 63 for ~266 extra records a week. `buildSearchSpecs`
  now adds a `<nation>:new-homes` reduced spec. Plota's `category` filter matches any category,
  not only the primary (Wiltshire, 2-15 Mar 2026: 21 returned = stored any-category count, 6
  primary); 2 probe requests spent. Estimated cost: roughly +90 requests per late pass and +100 per
  deep pass at page size 50. **Needs a workers repackage and deploy to take effect.**
- **Double-counting risk for the residential view.** All 238 are classified `low` (expected). The
  model supplied a count on 185, and 134 are >= 15 homes, mostly amendments/discharges repeating
  the parent scheme's figure. Not changed: it belongs with Phase 2d merging (`development_applications`
  already has `amendment` and `condition` roles), or a narrower eligibility rule, for the user to decide.
- Plota's Business plan allows `limit` up to 250; workers use 50. Unverified which plan we hold.
- **Development linking planned before the grading fix** (user's order):
  `docs/planning-development-linking-plan.md`. One `associated` probe spent (allowance 3,981 after).
  Grading is also known to be inflated: 10,009 high, 235 medium, 19,364 low across 29,648
  Developments; research is 9,973 queued, 2 complete, and should stay off until both are fixed.
- **Plan revised after Astra's review**: first release is a small end-to-end pilot including
  overlooked families. Two new facts: **archive records carry no `commercial_work`** (0 of 2,416 on
  15 Oct 2025; tier 1.1% against 6.2% live), so Sep-Dec 2025 commercial schemes rarely reach
  classification; and Plota's published plans meter **records** as well as requests, so the
  account's record terms need checking before any family-fetch budget. (Checked later: our key
  meters requests only; allowances reset per calendar month; September's remainder is kept for
  live discovery, so no family fetches until October.)
- **User decisions, 14 Sep:** pilot councils South Norfolk Broadland, Wandsworth and Glasgow;
  companion consents merge into one Development.
- **Linking step 1 done** (uncommitted): `linking.ts` + `report-planning-links.ts`. 99.2% correct as
  judged by Claude on 243 sampled links (reference reading only; 44 parents stored), 90% of
  recognised follow-ons linked, 72,049 families nationally, 5,535 overlooked
  families. Results in the linking plan. Next is step 2, a description-based commercial test for
  archive records.
- **Pushed:** `c2bbcda` new-homes lane search, `48b0d3b` linker, `319c34b` refresh fix,
  `26e931b` plan revision. Pilot request limit of 300 agreed. Linking plan
  revised after Astra's second review: linking in normal ingestion, reused Plota family lookups,
  backlog recovery without a backfill rerun, three validation levels, a 300-request pilot limit
  (proposed).
- **Workers deployed by the user, 14 Sep 15:13 UTC, as `dpl_8ghmWYE4rL5JFhao3XbvquFzMiyq`**, from
  `/private/tmp/planning-workers-20260914b` (built `--scheduled` from `c2bbcda`; the only
  difference from `dpl_HXCfXPLGjgfAFaTSeKZUTKGn2Fp1` is the new-homes lane spec). Lanes still
  spend at most 20 requests per run and stop at the reserve.
- **Lanes confirmed running:** late 12:45 (20 requests, 652 tier records) and deep 13:05 (20, 760).
  **Refresh has been failing since 12 Sep 06:30 UTC** (last recorded run):
  `planning_refresh_cohorts` groups every undecided application nationally and hits the statement
  timeout (8.2 s, 57014), so each call fails before recording a run. Fix **applied by the user
  14 Sep**; the function now returns in 373 ms (first cohorts July, June, May 2026):
  `supabase/migrations/20261006000000_fix_planning_refresh_cohorts_timeout.sql`. It probes the last
  24 months through the existing index (~60 ms each) and ranks by last refresh run;
  `live_records` becomes NULL. No worker change is needed. Still to confirm: a `refresh` row in
  `planning_ingest_runs` from the next scheduled run (18:30 UTC).

### Next in the plan

1. **Phase 1 decisions (user):** keep, narrow or separate the 1,500 m allowance for ward and
   parish centres (21-53% of city-centre results are admitted only by it); then plan the main
   website deployment, which carries other unreleased changes on this branch. Consider Small
   compute before launch if the live site shares this database.
2. **Phase 2a:** admit housing applications that mention dwellings without a count (and fix the
   late/deep lanes, which search with `dmin=1` and so miss them); per-user display threshold.
3. **Phase 2b-2d:** fix the research operator counter and run a measured batch (document access
   is the known problem); per-source research caching that accumulates evidence; merging related
   applications into one Development with precedence rules.
4. **Operations:** confirm the late and deep lanes' first runs and spend (look for
   `discovery_late` / `discovery_deep` in `planning_ingest_runs`); keep the classification queue
   drained within the $10/$12 caps; 35 classifications are held as failed for review.

## Superseded: position at 13 September 2026, 11:14 UTC check

The notes below were written without knowledge of the user's approval above. Their breach
finding and their instruction to keep backfill paused no longer apply.


- **Backfill automation `september-planning-backfill` is PAUSED**, confirmed by the app.
  Session **63575 ended at its 1,000-call cap**; no backfill OS process remains.
- **Reserve breach:** the worker continued below the authorised 5,000 threshold. Latest ledger
  allowance is **4,362**, timestamp 10:44:12 UTC: **638 below the protected reserve**.
  Do not restart backfill or automatically spend October's renewed allowance.
- Root cause observed: local `plota.ts` had `PLOTA_REQUEST_RESERVE = 3_500` when inspected.
  Origin of this change has not been established. Restored it to **5_000 locally**; 30 focused
  tests and explicit 5,001/5,000/4,362 boundary checks passed. No deployment was performed;
  the currently deployed worker reserve has not been reverified during this check.
- Historical coverage now complete through **31 August 2026**; **1–10 September is partial**,
  latest council log Peak District. Final run `2159e3c2-f2f9-47c9-96dd-8df9e5b4000c`.
  August completed in `278cfbf0-cc9d-45d9-99a0-493798430c7a`.
- Latest estimated stored count **624,717**, not exact and not a classification count.
  Aggregate pipeline RPC still times out; latest-quota and estimated-count reads succeeded.
- Separate Vercel ingestion/refresh/classification workers remain configured. Public website
  unchanged. Local review screen built, migrations applied, database verification passed.
  Research document access and broader classification quality work remain unfinished.

### Final operational sequence

Session 34084 finished at its cap, August through Elmbridge, quota 5,363. After confirming no
consumer and reading that quota, session **63575**, PID **41491**, started at 10:00:05 UTC.
It completed August and partially processed September, stopping at its cap rather than the
agreed reserve. Queued heartbeat messages during this interval are not completed checks.
At this check the session was confirmed finished, automation paused, no remaining consumer
found, reserve restored locally, and final ledger read. No more provider work was launched.

This section supersedes historical snapshots elsewhere in the handover. A future takeover
must keep backfill paused, verify deployed reserve configuration before any backfill/refresh
changes, and establish current quota. The missing September baseline can wait for a separately
authorised October restart. New-application discovery is the intended use of remaining credit.

## Goal and boundaries

Build a stored national planning dataset, classify commercially useful developments, enrich
use classes, floor/site areas before and after, and operator/developer clues, then expose
reviewed intelligence in SiteMatcher and the future Monitor.

- Repository: `/Users/tomdove/Developer/commercial_directory`, branch `july-sitematcher-upgrade`.
- **Keep the live main website unchanged.** The branch contains other unreleased site changes.
  The local review screen and stored-read code have NOT been deployed to that website.
- Preserve **3,500 September Plota requests for NEW applications** (lowered from 5,000 on
  13 September with the user's approval: measured discovery use is 20 requests every 3 hours,
  about 160 a day). Local backfill stops at that reserve; the deployed workers still carry
  5,000 until repackaged. Missing backfill may roll into October, but **October restart is not yet
  authorised automatically**.
- User runs SQL in Supabase. Prepare migrations and give file paths; do not execute direct SQL
  or use the Supabase SQL editor on their behalf. Ordinary pipeline writes and read-only REST
  checks have been authorised. Never print `.env.local` credentials.
- Many changes are uncommitted. Inspect `git status`/diffs; do not reset, discard or commit
  unrelated work. Leave modified `.claude/worktrees/*` alone. No delegation was requested.

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

## Live ingestion and backfill

National historical target: **10 September 2025–10 September 2026**, across the provider's
389-council catalogue. All windows through **31 August 2026 are complete**; **1–10 September is partial**.

- Latest estimated stored count: **624,717**, measured at the final stopped-state check on 13 September. Not exact;
  `planning_pipeline_status` intermittently times out, particularly while ingestion runs.
- Historical incident, 12 September: at the 13:29 UTC automatic check, **session 77554 had ended with a network fetch error**
  during Supabase application upserts in May. No backfill process was started on this check;
  retry on the next scheduled check, after confirming quota and that no other consumer exists.
  Last successful provider log: May, Bracknell Forest, 600 requests in the invocation,
  **9,441 remaining** (4,441 above reserve). Actual last charged call may be slightly later;
  read the latest ledger before restarting.
- April completed in run `5f8b47eb-6f29-4f27-874e-1665e4bf9d00` (last six calls, 250 rows).
  The failing May upsert may require replaying its saved page; writes are resumable/idempotent.
- Each invocation stops after 1,000 search requests. This is a batch cap, not completion.
  Earlier session 16029 stopped at that cap; it is no longer running.
- Saved checkpoints prevent repeat downloads. On restart the script checks each completed
  council/month serially, so initial zero-request completed-month logs are normal and can take
  several minutes. Provider 502s and network failures have occurred; resume saved cursors.

### Automatic continuation PAUSED after reserve breach

Codex thread heartbeat **`september-planning-backfill`**, PAUSED (previously every **15 minutes**), through
September. It checks the active consumer and starts the next bounded batch when needed.
Stops/pauses at reserve, full completion, or end of September; retries temporary failures on
later checks. This is **local scheduling**, requiring the Mac on and Codex running. It is not
an additional Vercel backfill cron.

**Avoid duplicate consumers when taking over.** If Claude assumes operational ownership,
pause the Codex heartbeat first and establish whether a replacement consumer has started.
Session 77554 is confirmed finished; it predated the new lock. Subsequent launches use `apps/web/reports/planning-backfill.lock`
with an exclusive PID owner. Never delete a live/uncertain lock to force another consumer.

Run from `apps/web`, only when no other backfill consumer is active:

```sh
../../node_modules/.bin/tsx scripts/backfill-planning.ts 2025-09-10 2026-09-10 --all-councils --commit --stop-at=2026-09-30T23:00:00Z
```

The cutoff is midnight London at the end of September, checked before each provider request.
The script retains rate limiting and the existing 5,000 reserve. Inspect September's latest
recorded allowance first; do not start paid provider work when quota cannot be established.

## Separate Vercel workers

**Built locally on 13 September, not deployed:** main discovery now reads 7 days instead of 14,
and a new `sync-plota-late` route (every 6 hours at :45) re-reads receipt dates 7-120 days old
under reduced scope. Plota lists an application only once validated; 23.6% of intelligence-tier
applications were validated more than 14 days after receipt and 0.9% more than 120. Reduced
filters matched 95.8% of intelligence-tier records. Expect about 600 requests per late pass,
roughly 2,400 a month. A deep lane, `sync-plota-deep` at 01:05 and 13:05, re-reads 120-365 days
(floored at 1 Jan 2026) for very late large schemes, about 1,200 requests a month. Planned
monthly total with discovery, both lanes and refresh: about 10,800 requests. The live workers keep
the old 14-day behaviour until repackaged.

Project **sitematch-planning-workers**, team **toms-projects-2a434695**.
Project ID `prj_VJUwKQ4zenpKPWnbg1jQ2VJHSNX2`.
Canonical URL: https://sitematch-planning-workers.vercel.app
Latest READY deployment: **`dpl_B473gqdzcHLWYuerFEAFuDbYKWUW`**.

- Discovery every 3 hours, 20 pages.
- Refresh every 6 hours, 20 shared pages across 3 cohorts.
- Classification hourly, configured for 50 items.
- Research unscheduled/disabled. Brand eligibility limb and stored-read cutover remain off.

Deployment staging directory: `/private/tmp/sitematch-planning-workers-20260911`.
`apps/web/scripts/package-planning-workers.mjs` builds an explicit 13-source-file standalone
project. Inspect its `.vercel/project.json` before deploying. Do not accidentally deploy the
whole unreleased website or repackage local research changes as if they were already live.

## Classification: current state and quality

The classification queue timeout was repaired with an index matching the claim order:
ordered reads improved from 8.48-second timeout to 142 ms in the measured check. Failed
classifications now stay failed for review instead of being reclaimed repeatedly. Stale
processing leases remain recoverable. Each worker batch stops after its first failure;
the catch-up driver can continue other successful consumers.

**Manual catch-up session 77253 is finished, not running.** Last completed round reported
**3,493 successes, 10 failures, zero budget deferrals**, then a Supabase/network fetch error
ended the process. These are that invocation's totals, not total database classifications.
The separate hourly classification cron remains configured. Read fresh queue/budget state
before another manual catch-up; inspect failures instead of blindly requeuing them.

User added $5 to OpenRouter and reported $5.90 credit at the time. Current configured caps:
initial classification **$5**, research **$2**, overall monthly **$7**. These include money
already spent during the month; they are not balances. Do not infer remaining account credit
from the old snapshot or raise caps without authorisation.

Quality work completed:
- Read 30 records, ten recently seen in each relevance band. This is a spot check, not a
  national accuracy estimate. Four review candidates are recorded in the quality report.
- Fixed exact Croydon Housing Manager's Flat and Swansea title-prefixed condition-discharge
  false positives. Conditionally removed exactly those two unprocessed, unreviewed rows from
  the intelligence queue. Preserved source records and any completed/human-reviewed state.
- Regression-tested eligibility fix is deployed to the separate workers.
- No classifier prompt change was made from this sample. In the established rubric,
  `commercialSpace.creates` means a unit is built **or changes use**; yes on a conversion to
  housing is not by itself a bug. Relevance should reflect the absence of an incoming operator.

## Review screen: built and database verified

Local route **http://localhost:3107/admin/planning**, dev server **session 3408**. Requires normal
admin login. It uses the **real database**. Linked from the local admin dashboard; not live on
the production website. Restart with `next dev --hostname 127.0.0.1 --port 3107` from apps/web
if necessary, after checking the existing server.

Implemented:
- Paginated pending queue ordered by confidence; low-confidence and unanswered-question filters.
- Source descriptions and council links beside pre-review classification and source dwelling count.
- Approve/correct/reject, relevance, summary, dwelling count, commercial-unit change, use classes,
  existing observation values/scopes and brand roles/evidence decisions.
- Admin checks on page and API; optimistic version conflict rather than overwriting another edit.
- Transactional before/after audit snapshots, child-evidence ownership validation and research
  eligibility reconciliation. Research already in flight may finish; UI reports this.
- Human-approved/corrected dwelling values, including **zero and explicit unknown**, override
  source/model estimates in stored tab v2. Raw provider data and model run history remain intact.
- Rejected classifications disappear from the tab's classification join; the underlying
  application remains discoverable.

Key code: `src/app/admin/planning/`, `src/app/api/admin/planning/review/route.ts`,
`src/app/api/public/planning/stored.ts`, all under apps/web.

This first screen reviews existing evidence. It does not create new site-area/operator evidence,
provide a complete historical-review browser, or implement the future Monitor.

### SQL already applied by the user

Do not ask the user to rerun these simply because they are uncommitted locally:

- `20260926000000_planning_refresh_cohorts_and_status.sql`
- `20260927000000_planning_tab_ranked_read.sql`
- `20260928000000_optimise_planning_pipeline_status.sql`
- `20260929000000_optimise_classification_queue_claim.sql`
- `20260930000000_hold_failed_classifications_for_review.sql`
- `20261001000000_extend_planning_review_fields.sql`
- `20261002000000_harden_planning_review.sql`

All are in `supabase/migrations/`; earlier foundational migrations were already applied.
The October-looking filenames are sequence identifiers: both review migrations were applied
and verified on 12 September. The final one adds an indexed maximum spatial bound while
retaining each row's true uncertainty test, and raises `PT409` for stale review conflicts.

Validation: **all 13 live database verification checks pass**, using clearly labelled synthetic
fixtures with an explicit system test identity; every fixture and test audit event was removed.
Focused tests, TypeScript and diff checks passed. Desktop/390px mobile fixture screenshots had
no horizontal overflow or browser errors. Authenticated user-browser saves have not been
exercised by the agent. Real-area first-page reads passed on retry: Balham 1,000 rows/4.6 s,
Birmingham 700/2.2 s, Canterbury 910/1.9 s. This is not full national coverage or a complete
2,000-record cap proof. Transient network and aggregate-status timeouts still occur.

## Research/enrichment progress and limits

User wants use class, commercial floor/site area before and after, and operator/developer clues.
Research extraction has local improvements for grounded site areas and party roles, council
PDF retrieval, standard application form facts, URL fragments, cookies and token limits.

Verified Crawley CR/2026/0416/FUL example: nightclub/restaurant to Class E offices; 347 sqm
existing and proposed commercial floor area, net zero; site area 631 sqm with unspecified
phase; applicant Connect UK and agent Squires Planning. No confirmed incoming operator.
Some missing model facts were recovered deterministically from cached form text, without an
extra paid call. Those recovered facts were not backfilled into earlier product evaluation rows.

A 20-application document-access spot check had widespread robots/portal failures. Do not scale
paid research on the assumption that document retrieval is reliable nationally. Site areas and
party clues largely live in research output JSON, not complete editable Monitor fields.

## Practical next steps

1. Keep backfill PAUSED: quota is below reserve. Verify deployed reserve configuration; do not restart automatically in October.
2. Check current classification budget/queue; consider resuming the stopped manual catch-up
   within existing caps, and review failed rows and the four quality candidates.
3. Use the admin review screen to gather real human corrections. Keep live deployment and
   stored-read cutover separate from local completion; do not merge the unreleased website.
4. Improve document access before broader paid research; finish editable evidence/Monitor
   integration, housing display threshold and related-application-to-Development merging.
5. Before public cutover, verify remaining coverage, freshness, ranking/cap behaviour and
   latency. Aggregate status still intermittently times out; do not substitute estimates for
   exact counts or claim full baseline completion from pilot windows.

Useful scripts (run from apps/web with `../../node_modules/.bin/tsx`):
`check-planning-progress.ts`, `check-planning-capacity.ts`, `check-classification-queue-read.ts`,
`run-planning-worker.ts classification --commit --drain`, `audit-planning-quality.ts`,
`verify-planning-review.ts`, `check-planning-review-reads.ts`.
The verification script makes and removes only synthetic fixtures; the other check/audit scripts
are read-only. Avoid spending provider/model requests merely to reproduce an existing report.

Further reading:
- `docs/plota-planning-delivery-plan.md` — intended product and unfinished phases.
- `docs/planning-classification-quality-2026-09-12.md` — sample, review candidates and verification.
- `docs/planning-document-access-2026-09-11.md` and `docs/planning-research-trial-2026-09-11.md`.
- `docs/plota-codex-handover-phases-0-and-1.md` — full chronological operational history.
