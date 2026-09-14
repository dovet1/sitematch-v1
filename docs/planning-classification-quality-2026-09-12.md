# Classification quality and review screen — 12 September 2026

## What was checked

Read 30 stored classifications: the ten most recently seen Developments in each relevance band.
This is a stratified spot check, not a random national accuracy estimate. It used no Plota or
OpenRouter requests. Reproduce with `apps/web/scripts/audit-planning-quality.ts` from apps/web.
The local report is `apps/web/reports/planning-quality-sample.json` (ignored operational output).

Findings requiring human review:

| Development ID | Source proposal | Current answer | Review issue |
| --- | --- | --- | --- |
| 40d4732d-6873-42ff-aff3-b9179efd71ec | Employee-only canteen, gym, changing rooms and lockers | High, 90% confidence | Ancillary employee facilities do not establish an incoming occupier. Confidence alone would not surface this. |
| 8288e903-9afa-409a-bda8-35c8a4cb0fee | Class E space becomes four apartments | Medium, 80% | Conflicts with the rubric's low band for a housing outcome. |
| f4b3289e-bc2b-4484-a23d-2e68eb05da09 | Office becomes residential HMO | Medium, 70% | Another housing-outcome case to review against the low band. |
| 271f2246-e2bf-40c6-8722-5a1c58efef11 | Storage/office unit becomes veterinary surgery | Medium, 70% | Check whether this is an agent-scale unit or the rubric's narrow micro-unit category; description alone does not settle scale. |

These are review candidates, not newly supplied expert labels. No model prompt or historical
model output was rewritten from this sample. The established `commercialSpace.creates` field
means a unit is built OR changes use; a commercial-to-residential conversion returning yes is
therefore not itself an implementation error. The review UI uses that more precise wording.

## Confirmed eligibility fixes

- Croydon 26/00115/FUL: “Change of use of Housing Manager's Flat to be used as an age-restricted
  dwelling” accidentally matched the bare word housing. Exclude housing manager/officer uses
  from this recall rule while retaining genuine housing association homes.
- Swansea 2025/2044/DOC: “Residential redevelopment of the site including conversion of 1912
  building - Discharge of condition 34 …” hid the procedural lead behind a long scheme title.
  Strip only a bounded residential title followed by a clear discharge/details lead.

Exact descriptions are regression tests, alongside genuine housing, reserved matters and
section 73 cases. `reconcile-planning-quality.ts --commit` changed exactly these two application
rows from queued/intelligence to not_eligible/non-intelligence. It compares input hash, queue
state and review state to avoid changing a record claimed or reviewed meanwhile. No source
record, completed classification or human review was deleted.

The eligibility change is live on the separate workers, deployment
`dpl_B473gqdzcHLWYuerFEAFuDbYKWUW`. The main website was not deployed.

## Review screen built in the working branch

Route `/admin/planning`, linked from the admin dashboard, with both page and API admin guards.
It shows a paginated pending queue ordered by confidence, optional low-confidence/questions
filters, original application text, council links, pre-review classification, source dwelling
count, evidence excerpts, and approve/correct/reject actions. It supports relevance, summary,
dwelling count, commercial-unit change, use classes, existing observation values/scopes, and
brand roles/evidence decisions. Missing evidence remains missing; this version does not add
new site-area or operator evidence records.

`20261001000000_extend_planning_review_fields.sql` must be applied by the user before saving.
It adds `apply_planning_review_v2`, full before/after audit snapshots, child ownership validation,
a confidence-queue index, and a versioned planning-tab read. A stale loaded version returns a
conflict instead of overwriting another change. Changing commercial-unit status reconciles
paid research eligibility within the same transaction. Already-running research can finish;
the UI reports that limitation after saving.

Precedence: approving/correcting the displayed dwelling count marks it human-reviewed,
including explicit unknown or zero. The new stored read displays that value before source or
model estimates. Raw provider figures remain untouched; prior model outputs remain in run
history. Other human Development corrections retain the existing worker protection against
machine overwrites. Rejected classifications are excluded from the new tab's classification
join; the underlying planning application remains discoverable.

Validation: 86 focused tests passed after final UI polish; TypeScript checked separately. Desktop and
390px mobile screenshots with synthetic records showed no horizontal overflow or browser
runtime errors. The UI was checked using synthetic display data; database RPC saves were subsequently
verified with isolated fixtures as recorded below. Authenticated user-browser saves have not
been exercised by the agent. Temporary preview route removed before delivery.

## Database verification after user applied review migration

The user confirmed applying `20261001000000_extend_planning_review_fields.sql` on 12 September.
Isolated fixtures verified actual RPC saves, before/after dwelling and evidence snapshots,
negative net floor area, commercial-status research reconciliation, rejection of evidence
IDs outside the Development, rollback without partial audit events, and explicit unknown
counts retaining human provenance. All generated Developments, applications and audit events
were removed; no real application review was changed. The reviewer identity was explicitly
`system:codex-synthetic-verification`, not an impersonated user.

Two checks remain blocked. The national map RPC returned PostgreSQL 57014 statement timeout.
Its row-dependent spatial radius lacks a constant indexed candidate bound. A repeated stale
review request timed out at the client twice rather than delivering the expected serialization
error; evidence-ownership errors returned normally. No claim is made that these two paths pass.

Prepared `20261002000000_harden_planning_review.sql`, awaiting the user:
- Add an indexable maximum-uncertainty spatial bound, retaining the original per-record radius,
  ranking and limit. This is a proposed performance fix, not yet measured against the database.
- Raise `PT409` for a stale review rather than a retryable `40001` serialization error. The API
  maps either to conflict. This change also requires live verification after application.

Re-run `scripts/verify-planning-review.ts` without skip flags after the follow-up migration.
`--skip-map-read --skip-conflict-check` is the limited verification that passed so far; it must
not be presented as a complete end-to-end screen or map verification.

## Follow-up migration verified — 12 September, 13:02 UTC

The user applied `20261002000000_harden_planning_review.sql`. The complete verification script
ran without skip flags and passed all 13 checks, including the versioned map join, reviewed
zero and unknown precedence, stale-conflict rejection, rejected-classification exclusion and
fixture cleanup. No generated records or test audit events remain.

Read-only real-area checks also passed on retry (the first attempt had a client network
timeout): Balham first 1,000 rows in 4,634 ms; Birmingham 700 in 2,225 ms; Canterbury 910 in
1,914 ms. Each returned ordered relevance and included approximate-location overlaps. Balham
is a first-page check, not a complete boundary/2,000-record cap proof. The pending review queue
returned 26 IDs in 230 ms initially and 1,308 ms on retry. These are observed request times,
not guarantees. Reproduce with `scripts/check-planning-review-reads.ts`.

TypeScript and diff checks passed. Local server is running on port 3107 (process session 3408)
for `/admin/planning`, using the real database and normal admin authentication. The browser
open request was queued in Codex. No live website deployment or stored-read cutover occurred.
The earlier blocked statuses above are historical; no further SQL is needed for these checks.
