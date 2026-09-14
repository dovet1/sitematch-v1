# Planning pilot: from collection to published findings

Written 14 September 2026 after Astra's third review, amended the same evening after the fourth.
This plan leads the planning work.
[planning-development-linking-plan.md](planning-development-linking-plan.md) still describes the
family machinery; its steps 5 and 6 are narrowed here to the pilot schemes.

## The pipeline we are finishing

Collect → select schemes worth investigating → research missing facts → admin completes what
research could not → publish the findings with their sources.

No new architecture. The objective is a promising application becoming a useful, sourced
commercial property record with a manageable amount of admin work. Prove it on 3–5 schemes, then
20–30, and only then schedule research at scale.

**First acceptance.** One scheme is selected for investigation, researched once as a family,
handed to admin with its remaining gaps named (including one where documents could not be
reached), completed or marked unavailable by admin, and then displayed with every fact and its
source.

**Scaling decision.** Made on the results across the whole pilot, blocked and incomplete schemes
included, and on whether commercial agents find the completed records useful. One success proves
the machinery, not the value.

## Where we stand (verified in code and data, 14 September)

| Stage | Today | Gap |
| --- | --- | --- |
| Collect | National store; discovery, late and deep lanes running; linking steps 1–4 built and pilot councils seeded | Refresh reliability; linking not yet on in the workers |
| Filter | Deterministic tier rule ([eligibility.ts:26](../apps/web/src/lib/planning-intelligence/eligibility.ts)) decides what the classifier ever sees | Commercial extensions never qualify on their own (below) |
| Select | Initial classifier grades every tier record | Inflated "high"; research selection is `relevance = high AND creates commercial space` ([classify.ts:92](../apps/web/src/lib/planning-intelligence/classify.ts)) and the rubric asks "is there an incoming operator to find" |
| Research | GPT-5.2 pass reads council documents and searches the web ([research.ts](../apps/web/src/lib/planning-intelligence/research.ts)); unscheduled | Three-case trial found nothing verified; Crawley worked once documents were retrievable. Most sampled portals blocked (12 of 20 by robots.txt) |
| Store | Operator signals, use classes and commercial floor area stored; site area only in run JSON | Repeat runs erase findings (below) |
| Admin | Review screen and `apply_planning_review_v2` | A quality-control queue for the cheap classifier, not a completion queue |
| Show | Map shows descriptions and some figures | Researched and reviewed fields not exposed |

Defects found:
- **Commercial extensions are filtered out before any model sees them.** The tier's commercial limb
  accepts Plota's `new`, `to-commercial` and `between`, not `extension`. Measured on applications
  received 17 August–6 September: 135 extensions nationally, none in the tier, and 133 of them
  without a stated floor area, so a size threshold cannot rescue the large ones. The one with a
  size was a 12,000 m² arena extension at Milton Keynes. Archive records have the same gap:
  the description reader has no extension kind.
- **A repeat research run erases earlier findings.** It deletes pending URL-grounded signals and
  floor-area rows before inserting, and writes `existing/proposed_commercial_use_classes` from the
  new run even when that run found nothing ([research.ts:208](../apps/web/src/lib/planning-intelligence/research.ts)).
- **Research is per application and retries forever.** The queue reclaims `failed` items with no
  attempt cap, and a follow-up in the same family would be researched as a separate scheme.

What the admin queue does today: it lists Developments with `review_state = pending`, lowest
classifier confidence first, filterable to uncertain or open-question cases. The reviewer approves,
corrects or rejects the classification and edits existing brand-signal and floor-area rows by id.
It cannot add an operator, floor area or site area that has no row, cannot mark a fact unavailable,
and does not wait for research.

## Steps

### 1. Family first

For each pilot scheme:
- complete the family from stored links; spend at most one Plota family lookup per scheme whose
  original is missing, from October's 300-request pilot limit;
- give the scheme one Development: step 5's merge with its protections (condition submissions and
  non-material amendments never change description, relevance or figures; figures never summed;
  ambiguous families stay separate; human-reviewed Developments refused);
- research reads the principal and the members that change the scheme (section 73, reserved
  matters, material amendments) together, as one research subject.

The October dependency applies only to schemes whose original must be fetched. The first 3–5
schemes are families whose original we already hold, so they need no Plota requests.

National seeding, the linking worker deploy and the national one-pin view wait until the pilot has
shown the rest of the pipeline works.

### 2. A checklist with a precise meaning of "complete"

Each scheme tracks these facts separately:

| Fact | Complete only when |
| --- | --- |
| Operator or occupier | A named business that will occupy or run the space. An applicant, developer, landowner or agent is recorded, but never completes this fact |
| Existing use class | The use before the proposal |
| Proposed use class | The use the proposal creates |
| Existing commercial floor area | The existing building's commercial area |
| Proposed commercial floor area | The area the proposal results in |
| Net change in commercial floor area | Stated, or derived only from existing and proposed figures with the same scope and basis |
| Site area | The site, never a building's floor area |

Every figure keeps what it describes: whole development, one unit, one phase or one building, and
its measurement basis (gross internal, gross external, net) where stated. A unit or phase figure
never completes a whole-development fact, and finding the existing area never completes the
proposed one.

Each fact has one state:
- `not_checked`;
- `found`;
- `not_found_after_research`, with the reason (documents inaccessible, documents silent, attempt
  limit reached);
- `conflicting`;
- `unavailable` — an admin decided it cannot be established. The task is closed, and the fact is
  shown as unavailable, never as found;
- `not_applicable`.

Each state records its value and scope, sources (URL, excerpt, page), who set it (classifier,
research, admin) and what was attempted (documents tried, retrieval failures, searches run).

Storage: `development_facts`, one row per Development and fact, holding every finding with its
source, plus the attempts. Site area is read from there rather than from run JSON. Migration
`20261009000000_planning_development_facts.sql` (built 14 September).

**Precedence.** Admin decisions (a fact added, a conflict chosen, `unavailable`) are never
overwritten or reopened by later research or classification. New machine evidence that disagrees
is attached for review instead.

The classifier fills what the description states and leaves the rest `not_checked`. A missing fact
is a reason to research, never a reason to lower relevance.

### 3. Filter and selection, both measured

The filter first, because a scheme the filter drops never reaches the classifier:
- admit Plota `extension` records to the tier for classification, and give the description reader
  an extension kind for archive records. At ~45 a week nationally the classification cost is a few
  cents a month; the classifier judges scale;
- test with samples of rejected applications, not only admitted ones: extensions, `minor` commercial
  work (452 in the same three weeks), detail submissions, and not-eligible records whose
  descriptions mention commercial uses. Report how many worthwhile schemes each rejection
  bucket contains.

Then selection. Replace the escalation rule and the rubric's operator framing with one question:

> Is this a meaningful commercial scheme where investigating the operator, use or size would be
> worthwhile?

- Operator identification is one reason among three, not a prerequisite.
- This is where the inflated "high" grading gets fixed; it is the same rubric.
- A labelled test set comes first: schemes the agents judge worth investigating, including ones
  the current rule filters out (medium relevance, commercial loss, extensions, no nameable
  operator), plus clear negatives. Report accuracy before and after, on a held-out split.

### 3a. Group before classifying (user, 14 September)

No bulk classification or re-grade runs application by application. Related applications are
grouped first and each development is assessed once.

- **Grouping** uses stored links only, with no Plota requests.
- **The assessment** reads the original proposal together with its relevant amendments (section
  73 variations, reserved matters, material amendments).
- **Routine paperwork** (condition submissions, non-material amendments) joins the development's
  timeline and triggers no classification.
- **An unclear scheme whose original is missing** is flagged for parent retrieval, not graded low.
  It joins the family lookup queue with a raised priority.
- **Uncertain links** (weak, several missing parents, conflicting) stay separate developments,
  assessed on their own.
- **Future ingestion follows the same sequence:** link, then join or assess. An existing
  development is reassessed only when new information materially changes the scheme: a new
  section 73 or material amendment, reserved matters, or a changed description on the principal.
  Paperwork and status changes update the timeline only.

**Before any national run,** a dry-run report gives:
- applications in scope;
- separate development assessments after grouping;
- paperwork joining timelines without assessment;
- schemes flagged for parent retrieval;
- uncertain links kept separate.

The report is re-run on the day, not taken from the figures below.

**Measured 14 September** (`scripts/report-grouped-assessments.ts`, rules in `assessment-groups.ts`,
all 393 councils, 614,400 applications, read-only):

| | Tier today (re-grade) | Tier plus archive backlog |
| --- | --- | --- |
| Applications in scope | 29,804 | 38,088 |
| Separate development assessments | **28,079** | **36,212** |
| Read inside another application's assessment | 228 | 248 |
| Routine paperwork joining a timeline, not assessed | 200 | 209 |
| Waiting for parent retrieval, not assessed | 1,437 | 1,546 |
| Assessments that also request their missing original | 992 | 1,104 |
| Uncertain links kept as separate assessments | 1,063 | 1,216 |
| Non-tier applications joining tier families' timelines | 5,584 | 6,573 |

The archive backlog's 8,284 applications become 8,133 assessments.

Grouping removes about 6% of assessments. The saving is small because the tier already excludes
most condition submissions, but grouping still stops one scheme being assessed several times.
The 1,437 schemes waiting for parent retrieval are far more than the 300-request pilot limit, so
nationally they wait for a standing lookup allowance.

**State on 14 September:**
- No bulk classification is running. The hourly worker is classifying newly ingested applications
  (89 queued, about 50 an hour). That is routine ingestion, so it continues, and its results are
  kept.
- The 1 October archive backlog task was changed to report only: it produces the grouped count
  and queues nothing.
- The re-grade and the backlog queue wait for the grouped path.
- Routine ingestion moves to the grouped path when linking is switched on in the workers.

### 4. Research that ends in a known state

- Research starts from the checklist and only pursues unresolved facts.
- Sources in order: facts already stored → council documents (application form first) → property
  news and developer or operator websites for what documents did not answer.
- **Findings are kept.** A later run adds or conflicts; it never erases an earlier sourced finding
  or any admin decision.
- **Every attempt finishes.** Success, documents inaccessible, documents silent, provider failure
  and attempt limit reached all end the research stage, set each unresolved fact to
  `not_found_after_research` with its reason, and hand the scheme to admin. Nothing can stay in a
  failed-and-retrying loop outside the admin queue.
- Every result keeps source URL, excerpt and page.

### 5. The smallest admin completion view that works

Entry condition: research has ended, in any outcome, and at least one fact is
`not_found_after_research` or `conflicting`.

For each open fact it shows one plain task, for example:

> **Proposed floor area missing.** The council documents could not be accessed (robots.txt).
> Open the application and add the figure, or mark it unavailable.

With the evidence already found, links to the application and sources, and what research tried.
The admin can add the fact with its source and scope, choose between conflicting values, or mark
it unavailable. Each fact publishes on its own: an unknown operator does not hold back a verified
use class or floor area.

Built only as far as the first 3–5 schemes need, then extended from what using it shows. The
existing classification review stays as a separate quality-control view.

### 6. Show and measure

- The planning inspector shows each fact with its state, scope and sources.
- Measured per phase (first 3–5, then 20–30):
  - per fact, how often it was filled correctly (checked against the sources), by research alone
    and after admin;
  - how often retrieval was the blocker, by council;
  - research cost per scheme;
  - admin minutes per scheme;
  - **usefulness:** show commercial agents the completed records, blocked and incomplete ones
    included, and ask whether each helps them identify or understand an opportunity.
- A national research queue needs its own sized allowance, proposed from these numbers.

## Order and timing

**Now (September, no Plota requests, within this month's remaining budget):**
1. Checklist migration, research preservation, attempt cap and hand-off to admin (2, 4).
2. Minimal admin completion view and inspector display (5, 6).
3. Pick 3–5 complete families already held: at least one at a council with readable documents
   (Crawley's portal is proven) and one at a blocked council (Wandsworth). Research them, complete
   them in admin, show them to agents.
4. In parallel, the filter test on rejected applications, the labelled set and the selection
   rewrite (3).
5. The grouped classification path and its dry-run count report (3a).

**From 1 October:**
- expand to 20–30 schemes: family lookups for candidates missing their original (at most 30 of the
  300), step 5 merge for the pilot families, research, admin completion, measurement and agent
  review;
- the grouped count report for the re-grade and the archive backlog. The 1 October task reports
  only; queueing needs the user's go-ahead on the counts;
- the re-grade through the grouped path, once the selection question passes its test set.

## Budget

One combined OpenRouter allocation, because classification and research share the monthly cap.

**September, as measured on 14 September:**
- initial classification $7.21 of its $10 stage cap (31,084 calls, mostly the catch-up; the queue
  is now 89);
- research $1.00 of its $2 stage cap (15 calls);
- total $8.21 of the $12 monthly cap, leaving $3.79.

The first 3–5 schemes (about $0.15 each, $0.20 charged on failure) fit inside the remaining $1.00
research allowance. No September change is needed.

**Proposed for October** (routine classification measured at ~175 calls a day, ~$0.00023 each):

| Use | Estimate | Allocation |
| --- | --- | --- |
| Routine classification of new applications, including extensions | ~5,300 calls, ~$1.25 | $2 |
| Archive commercial backlog (1 October) | 8,284 calls, ~$1.90 | $2.50 |
| Re-grade with the new selection question | ~30,000 calls, ~$7 | $8 |
| Research pilot, 20–30 schemes including failures | ~$4.50 | $6 |
| Headroom | | $1.50 |
| **Total** | ~$14.65 | **$20 monthly: initial stage $12.50, research $6** |

The backlog and re-grade estimates are per application. Grouping lowers them, so they are upper
bounds.

## Decisions

- **Budget (user, 14 September):** $20 monthly, initial stage $12.50, research $6, and it applies
  from September, so the pilot does not wait for October's OpenRouter month. Plota family lookups
  still wait for October's request allowance.
- **Admitting extensions to the tier:** proposed above; it adds classification spend of a few cents
  a month and new Developments that the classifier will mostly grade low.

## Deferred until the pilot passes

- National link seeding and deploying linking in the workers.
- National family lookups and a standing lookup allowance.
- One pin and history for every Development nationally.
- Scheduled research.
