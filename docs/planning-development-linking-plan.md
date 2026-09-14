# Planning: development linking plan

Date: 14 September 2026. Revised twice the same day after Astra's reviews. Expands Phase 2d of
`plota-planning-delivery-plan.md` and runs before the relevance-grading fix, at the user's request.
Step 1 (the linker, measured nationally) is built and committed. Nothing writes linked families
to live records yet.

**Scope: a complete fix for new imports and for the applications already stored.** Linking runs
as part of normal ingestion, missing parents are recovered through Plota family lookups that are
reused rather than repeated, and the same process works through the backlog. Implementation
starts now; only paid lookups are bounded by budget and timing.

## The idea

Create a folder for each building project. The original permission, its amendments and its
condition submissions go inside. The folder gets one map pin, one assessment and a history in date
order.

For Broadland Business Park, that means one entry reading "Warehouse club and petrol station:
permission approved, 11 later applications", with the individual applications underneath.

This changes the existing system rather than adding a new one. `developments` and the
`development_applications` link table already exist. The missing work is deciding which
applications belong together, and which application's information describes the project.

## The problem, in one example

Permission **2024/3141** (approved: "Erection of a Warehouse Club (Sui Generis) including tyre
installation and sales, a petrol filling station, deck and surface car parking…") has eleven
follow-on applications between April and September 2026:
- ten condition submissions (construction management, foundation risk, archaeology, petrol
  filling station delivery times, fire hydrants);
- one non-material amendment to the mezzanines and glass canopy.

We store all eleven follow-ons and none is classified: each one, read alone, is paperwork. We do
not store the permission, which predates our twelve-month window. A warehouse club moving towards
construction therefore shows as eleven unlabelled admin rows.

In the other direction, related applications that each pass the filter each create their own
Development, classification and research queue entry. A dwelling figure quoted from the parent is
repeated on every one.

## What exists today

- A trigger (`ensure_development_for_planning_application`) creates one Development per
  intelligence-tier application, always role `primary` and source `initial`. Nothing else writes
  `development_applications`.
- The link table already allows roles `principal`, `member`, `amendment`, `condition`, `related`
  and sources `plota_associated`, `cited_reference`, `shared_uprn`, `address_name`, `manual`.
  None is used.
- Classification is per application and **writes the Development's summary and figures from
  whichever application it processes**. Once applications are linked, a condition submission
  could overwrite the main proposal.
- Research is queued per Development, which is already the right unit.
- The planning tab (`planning_tab_applications_v3`) returns one row per application.
- Non-tier applications never get a Development, so they cannot appear in a history.

## What the data says

### Plota already builds families

`GET /v1/applications/{id}/associated` returns:
- the principal application;
- every member, with `parent_reference`, `depth` and `linked_by` (`citation` or `reference`);
- a condition ledger.

Plota links only two exact ways, within one council: a member's description cites the parent's
reference, or the references share a core (`24/01355/FUL`, `24/01355/COND1`) and the records share
a site. Paid plans include archive members.

Probed on Broadland: one request returned 12 applications, including the 2024 archive principal,
and a 10-row ledger. The principal carries description, route, procedure, stage, dates, address
and links. It does not carry location, UPRN, dwelling count or commercial work.

**The ledger is not a list of outstanding conditions.** It is derived from the discharge and
variation applications in the family. Statuses are `discharged`, `submitted`, `decided`,
`refused`, `withdrawn`, `varied` and `variation_sought`. Where the council's decisions are not
re-checked, only `submitted` and `variation_sought` appear. Ten condition applications do not mean
ten conditions discharged, nor that construction has started.

### Archive records cannot pass the commercial filter

Plota's derived fields are live-only. In our own store:

| Received | Source | Applications | `commercial_work` set | Intelligence tier |
|---|---|---|---|---|
| 15 Oct 2025 | historical | 2,416 | **0** | 26 (1.1%) |
| 16 Mar 2026 | live | 3,315 | 235 | 206 (6.2%) |

The eligibility filter's commercial limb reads `commercial_work`. So a recovered archive
principal, such as the warehouse club, would be stored and still never assessed, even with its
full record fetched. The same fault already applies to **our backfill from 10 September to 31
December 2025**: commercial schemes received then rarely reach classification. Only dwelling
count is backfilled onto the archive.

### How much we can link for free

Measured over the full twelve months for 12 councils in all four nations (47,330 applications:
South Norfolk Broadland, Wandsworth, Westminster, Birmingham, Cardiff, Belfast, Glasgow,
Edinburgh, Canterbury, Cornwall, Leeds, Manchester). This is not a random sample; national figures
(×13) are rough.

| Measure | Sample | Share |
|---|---|---|
| Applications citing another reference from their council | 9,411 | 20% of all |
| …whose cited parent is stored | 2,326 | 25% of citing |
| …whose cited parent is not stored | 7,085 | 75% of citing |
| Distinct missing parents | 4,934 | |
| …with 3+ follow-ons in our store | 535 | ~7,000 nationally |
| …with at least one intelligence-tier follow-on | 146 | ~1,900 nationally |
| Tier applications whose parent is also tier (Developments that would merge) | 27 | 1.3% of tier |
| Non-tier follow-ons of a tier parent (history entries gained) | 79 | |

All 40 random resolved links read were genuine. They were follow-ons, companions (the same
proposal under planning plus listed-building or advert consent, often "Linked with …") and chains
(a discharge of a condition "as amended by" an amendment). Reference cores are council-specific:
Glasgow `DOCnn` are discharges and `NMVnn` non-material variations, but Westminster `TCA`/`TPO`
pairs are tree works. **Shared UPRN alone joined different proposals for the same building**, such
as unrelated short-term lets in one Edinburgh tenement.

### Provider cost is requests only, on our key

Plota's published plans meter records as well as requests. **Our key returns no `X-Records-*`
headers**, only request limits (checked 14 September), and our usage far exceeds any published
record allowance. So requests are the binding cost: one per family call. Both allowances reset per
calendar month. The Plota dashboard on 14 September showed 16,020 of 20,000 requests used.
**September's remainder is kept for live discovery**, so the pilot's family fetches wait for
October.

## Principles

1. **A link is evidence, kept with its supporting text and reversible.** Store it separately from
   Development membership, so a wrong link can be removed without losing anything.
2. **Strong links only, automatically.** A description that says what it is doing to another
   application ("discharge of condition 14 of 2024/3141", "variation of condition 2 of …",
   "non-material amendment to …", "Linked with …"), a follow-on reference core for that council, or
   a Plota family. An incidental mention ("adjacent to the site approved under …") is weak: it is
   stored, but only a reviewer acts on it. UPRN and address are not used in the first release.
3. **Related does not mean identical scope.** A 500-home outline permission can have reserved
   matters for an 80-home phase. The phase belongs in the same history, but its 80 never replaces
   the scheme's 500.
4. **A section 73 approval is a new permission alongside the original, not a replacement.** It is
   recorded in the history with its own figures. It does not overwrite the original's figures
   automatically.
5. **Paperwork can never overwrite what the scheme is.** Condition submissions and non-material
   amendments add history entries only.
6. **Every figure names its source application.** Figures are never summed across members.
7. **Ambiguous families go to review, not automatic merge.** Examples: two candidate parents, a
   weak link, phases whose figures conflict, or a Development a human has already reviewed.
8. **Linking and the classification rules ship together.** There must be no period in which
   linked applications write over one another.
9. **Alternative permissions are never added together.** Two schemes for the same site (a refused
   and a resubmitted scheme, or competing permissions) stay distinct in the history.
10. **Protect human decisions, and do not recreate a removed link.** Detaching a link records
    that decision, so neither the linker nor a later Plota family puts it back automatically.
11. **Plota is evidence, not the answer.** It uses similar clues. Where its family disagrees with
    local evidence, the family goes to review.

## Steps

Built in order. Steps 3 and 5 write to live records only together. Paid lookups (step 4) run only
within an agreed request limit, starting with the pilot. The work succeeds when Broadland appears
as one correctly assessed scheme with its history visible, and new paperwork joins it without
overwriting what the scheme is or fetching the family again.

### Step 1 — Link clear references in stored data, no writes to live records

A pure linker per council produces edges, each with:
- source and strength (strong or weak);
- the matched text;
- the resolved parent, or the unresolved reference.

It uses citation phrases matched against that council's reference formats (excluding dates,
`APP/…` appeal references and the application's own reference). It also applies follow-on core
rules for councils that use them, excluding tree-work pairs, and resolves chains to the root.

A read-only report covers the national store.

Done when strong links reach at least 98% precision on 200 labelled examples.

**Done, 14 September 2026.** Built in `apps/web/src/lib/planning-intelligence/linking.ts` (31 tests)
with the read-only report `scripts/report-planning-links.ts`. The final national run is in
`reports/planning-links-2026-09-14.json`, and the labels are in
`reports/planning-links-labels-2026-09-14.json`.

**Reference reading: Claude judged 241 of 243 sampled strong links correct (99.2%).**
- Quoted-reference links: 212 of 213; these are 99.5% of all strong links.
- Case-number links (condition, amendment, companion, 10 labelled each): 29 of 30.

This is Claude's reading of stored descriptions, not proven accuracy. It checks one thing: whether
each child genuinely follows on from, or is a companion of, the reference it was linked to. Only 44
of the 243 parents are stored, so most verdicts rest on the child's wording alone. It does not
measure whether whole families are complete and correctly grouped, or whether the resulting
Developments are accurate. Each link's verdict and explanation are in the labels file.
Validation of those three levels is set out below.

It took six national runs to reach that, and three rules were rejected on the evidence:
- **A follow-on's own number is not its parent's.** The first case-number rule was 3 of 43 correct
  for conditions and 0 of 15 for amendments, because most councils number follow-ons
  independently: Leeds `26/01686/COND` discharges `24/03592/FU`.
- **A same-numbered sibling is not enough on its own.** Descriptions that repeat their own
  reference, and councils that mix numbering, left those links at 8 and 6 of 10.
- **Case-number reuse is measured per council and per suffix family.** Cambridge reuses the number
  for `COND` and `NMA` but not `S73`; Falkirk reuses it for `COND` but not `MSC`.

Recall: 116,583 of 129,457 applications *recognised as follow-ons by their wording or procedure*
(90%) now have a strong link. This does not cover follow-ons the wording test misses, and it is
not a share of all projects. Most of
the rest quote no reference at all ("Construction of Dwellinghouse", or conditions listed with no
permission named).

National result, 393 councils and 614,390 applications:

| Measure | Count |
|---|---|
| Families | 72,049, covering 128,157 applications |
| …with 3+ applications | 9,308 (762 with 10+) |
| …headed by a stored permission | 9,884 |
| …missing their parent permission | 61,552 (67,897 distinct missing references) |
| …with several missing parents (masterplans and chains, for review) | 4,877 |
| Families with an intelligence-tier member | 2,755 |
| Developments that would merge | 1,053 of 29,648 (3.6%) |
| Non-tier applications joining a tier family's history | 6,385 |
| **Overlooked families** (3+ applications, none assessed, parent missing, active since 14 March 2026) | **5,535**, covering 28,617 applications |

Broadland Business Park comes out as one family of exactly the 11 follow-ons Plota lists, missing
only 2024/3141. For the pilot councils:
- South Norfolk Broadland: 465 families, 34 overlooked.
- Wandsworth: 395 families, 39 overlooked.
- Glasgow: 98 families, 1 overlooked.

What this changes for later steps:
- The overlooked families are the pilot's recovery pool. At one Plota request each, all 5,535
  would be affordable over time. Their value is still unmeasured: step 4 measures it on the pilot
  councils first.
- Families with several missing parents are almost all phased masterplans or chains of variations
  (the 49-application New Covent Garden Market family in Wandsworth). Principle 7 applies: review,
  not automatic merge.

### Step 2 — Let archive schemes be assessed

Add a description-based commercial test for records without `commercial_work`, mirroring the
existing uncounted-housing limb. This lets recovered parents, and the commercial applications we
already store from September to December 2025, reach the tier.

Calibrate it for free on 2026 live records, where `commercial_work` is known. Agreement with
Plota's field is calibration, not proof, so also:
- read a sample of what it catches that Plota does not;
- read a sample of what Plota flags that it misses;
- read a sample of archive-era records it would now admit.

Done when:
- catches and misses are measured and read, not just agreement;
- the Broadland principal's description passes it;
- re-evaluating the stored archive records is a measured, bounded job.

**Built, 14 September 2026, not yet applied to stored records.**
- **Test:** `apps/web/src/lib/planning-intelligence/commercial-description.ts` (38 tests).
- **Eligibility:** applies it only when a record's source is known and not live, recording limbs
  `A-described` and `D-described` so the weaker evidence stays visible on the stored row.
- **Backlog job:** `scripts/requeue-archive-commercial.ts`, dry-run by default.
- **Verdicts:** `reports/planning-archive-commercial-labels-2026-09-14.json`.

**Calibration against Plota** (live records, where `commercial_work` is known), final rules on 15
days not used for tuning (33,430 applications):
- 86% of what it admits Plota also marks commercial.
- It finds 70% of what Plota marks.
- It finds 81% of Plota-commercial applications the classifier went on to grade high.

Two earlier sets used for tuning scored 74% and 71% recall.

**Reading what it admits (Claude's judgement, not council records):**
- 55 of 60 on live holdout days;
- 55 of 60 on the first archive sample;
- 42 of 60 on a second archive sample drawn after the first fixes, which exposed overfitting (tree
  works, householder "Class E outbuilding", caravan rally notices, cattle housing, sheds beside
  existing warehouses);
- **52 of 60 (87%) on a clean November 2025 sample** after those fixes. This is the figure to rely
  on. Its errors were mostly paperwork phrasings and household or minor works, and small generic
  fixes followed.

**What it misses** is mostly Plota being broader than any wording test: screening opinions,
demolition notices, street hubs, parcel lockers, and changes described without naming the new
use.

**Broadland:** the warehouse club permission (2024/3141) passes as new commercial space.

**National dry run** over the stored archive (10 Sep – 31 Dec 2025):
- 181,624 applications scanned;
- **8,284 would newly reach the tier** (4.6%): 6,219 commercial supply and 2,065 commercial loss;
- archive admission would rise from about 1.4% to about 6%, close to the live rate;
- classification at about $0.00023 each is roughly $1.90;
- at 87% judged precision, roughly 1,100 of those would be classified without being commercial,
  and graded low.

Not yet done: the committed backlog run, and a worker deploy so that future archive and
recovered records use the new limbs. Recovered parents arrive only with step 4, so the deploy can
wait for that.

### Step 3 — Linking in normal ingestion

Every application, whether new or refreshed, is linked when it is stored. Ordinary imports never
wait on a lookup.
- **Parent already known:** the application joins that family, and so its Development (through
  step 5).
- **Parent missing:** the missing reference is queued for a Plota family lookup, with a priority
  (step 4). The application is stored as usual.
- **Council context:** reference formats and case-number reuse are learned per council, so they
  are kept as a small per-council profile refreshed from stored data, not recomputed for every
  application.
- **Indexes:** lookups need an index on a stored reference case number alongside the existing
  `(authority_slug, reference)` key.

Done when:
- a new application citing a stored permission joins its family at ingestion;
- a new application citing a missing one creates one queue entry per missing family, not per
  application;
- ingestion latency and failure behaviour are unchanged when the queue is paused.

**Built, 14 September 2026; migration not yet applied, nothing seeded, flag off.**
- **Migration** `20261007000000_planning_application_links.sql` adds:
  - `reference_normalised` and `reference_core` on applications, as plain columns set by code
    (a generated column would rewrite the 614k-row table under lock), with council-scoped indexes;
  - `planning_council_link_profiles`;
  - `planning_application_links` (evidence per child, family and source; a removal is kept);
  - `planning_family_lookups` (one row per missing family; a completed or locally resolved family
    is never re-queued);
  - bulk functions `planning_set_reference_keys`, `planning_resolve_family_parents` and
    `planning_request_family_lookups`.
- **Linker** `linking.ts`: split into a council profile, a resolver and per-application links. The
  national report's pilot-council figures are unchanged. A test proves that linking from only the
  candidates an application's keys point to gives the same links as linking from the whole council.
- **Ingestion** `link-ingest.ts`, called from `runPlotaSync` after each page when
  `PLANNING_LINKING_ENABLED=true`. For each page it:
  - stores the keys;
  - loads only candidate parents;
  - writes new evidence (never overwriting existing rows);
  - attaches earlier follow-ons to a parent that has just arrived;
  - requests one lookup per missing family.

  A council without a profile is skipped rather than guessed. A linking failure is counted and
  logged, never thrown, so the page is still stored.
- **Seeding** `scripts/seed-planning-links.ts` (dry-run default, `--councils`, `--after`). Dry run on
  the pilot councils: 10,024 applications, 2,074 links (1,895 strong, 231 resolved to a stored
  parent), 934 missing families. Glasgow reuses case numbers for `DOC` and `NMV`.
- The worker packager now includes `commercial-description.ts`, `linking.ts` and `link-ingest.ts`.
  The step 2 eligibility change had left the package unable to build.

To go live, in order:
1. The user applies the migration.
2. Seed the pilot councils with `--commit` and check Broadland's family rows.
3. Seed nationally.
4. Deploy the workers with the flag on.

This writes only evidence and the lookup queue; Development membership waits for step 5.

### Step 4 — Plota family lookups, stored and reused

One worker spends requests on `GET /applications/{id}/associated`:
- **Storage:** the principal and every member returned, with their links, the condition ledger,
  and when the family was fetched. Members we lacked are stored as partial records until
  discovery supplies the full record. The principal's location comes from a member, because Plota
  links shared numbers only on a shared site.
- **Reuse:** a follow-on whose parent belongs to a fetched family joins it without another
  request. The family is refreshed only when a new member cites a reference the stored family
  does not contain, or when its outstanding ledger entries warrant it. Never on a timer alone.
- **Priority:**
  1. families attached to an already-relevant Development whose original is missing;
  2. overlooked families with recent activity (5,535 nationally at 3+ applications);
  3. potentially important single follow-ups, such as a condition submission for a scheme whose
     wording names major development, a commercial use or many homes.
  A family's size is a signal, not a gate.
- **Conflicts:** where Plota's family and the local links disagree (a member in one and not the
  other, a different principal), the family goes to review, not automatic merge.
- **Budget:** a separate monthly allowance for lookups, never spending below the discovery
  reserve, with a hard per-run cap. The queue simply waits when the allowance is spent.

The backlog uses the same queue, seeded from the national report. There is no backfill rerun.

Done when:
- a second follow-up of a fetched family makes no request;
- a conflict produces a review item and no merge;
- requests per recovered family are measured.

**Built, 14 September 2026; migration `20261008000000_planning_family_lookups.sql` not yet applied;
no requests spent.**
- **Client:** `PlotaClient.associated(id)`.
- **Storing a family** (`storeFamily` in `family-lookup.ts`):
  - members we lack become applications recorded as eligible but not admitted to the tier until
    step 5;
  - a fetched member borrows a stored member's location, recorded as
    `borrowed_from_family_member`, which is never treated as exact;
  - Plota's relationships become `plota_associated` links, skipping any child and family a person
    removed;
  - waiting local follow-ons attach to the new members;
  - the family, ledger and raw response go in `planning_families`;
  - every queued lookup whose key is a family member's reference or case number closes;
  - disagreements (local follow-ons Plota excludes, or members tied locally to a parent outside
    the family) are stored with `review_state = 'pending'`.
- **Running lookups** (`runFamilyLookups`):
  - lookups are taken in priority order;
  - it asks about the most recent live follow-on;
  - usage is recorded under its own endpoint;
  - it stops at the per-run limit, the monthly allowance (counting earlier runs), the discovery
    reserve, or a 429 (deferred);
  - it skips a lookup an earlier family in the same run already closed.
- **Priority** (`family-priority.ts`), in this order:
  - relevant Developments missing their original (high 4000, medium 3000, any tier follow-on 2000);
  - a follow-on quoting a major proposal, commercial or 15+ homes (+1500);
  - activity within 180 days (+500);
  - family size (+100 each, up to 10).
- **Tests:** 11, on the real Broadland family response.
- **Operation:** `scripts/run-family-lookups.ts`, dry-run by default; a commit needs `--councils`,
  `--limit` and `--allowance`. The cron route `lookup-plota-families` is packaged but unscheduled,
  and off unless `PLOTA_FAMILY_LOOKUPS_ENABLED` and a monthly allowance are set.
- **Pilot councils seeded** (14 Sep): 2,074 links and 934 lookups. Broadland's 2024/3141 lookup has
  11 strong follow-ons.
- **Priorities computed:**
  - 24 lookups tied to high-relevance Developments, 7 to medium, 77 with a tier follow-on;
  - 39 quoting a major scheme;
  - 367 in the middle band;
  - 420 low;
  - Broadland ranks 147 of 934, inside the 300-request pilot.
- **Open question for the pilot:** some families can only be asked about through an archive id
  (`h_…`). Plota documents that single-record fetches of archive ids return 404; whether the
  family endpoint does too is measured on the first such lookup.

### Step 5 — One Development per family, with rules that protect it

Ship together with step 3's writes, never before:
- **Schema:** the links table (evidence, source, strength, created, removed-by with reason);
  `principal_application_id` and `latest_activity_at` on `developments`; a `phase` or `scope`
  label on membership.
- **Membership:** strongly linked applications join the family's Development, and non-tier members
  join as history entries.
- **Merge and undo:** transactional merge and detach functions move members, observations, brand
  signals and review history. They refuse Developments a human has reviewed, and a detach is
  remembered.
- **Eligibility:** computed per family. A family qualifies if its principal or any member does.
- **Classification:** reads the principal's substantive proposal.
  - Condition submissions and non-material amendments are marked `linked_member`. They do not
    change the Development's description, relevance or figures.
  - Section 73 approvals and reserved matters keep their own figures and phase labels.
  - Figures are never summed across members or alternative permissions.
  - A test proves classification order cannot change a Development's output.
- **Ambiguity:** families with several missing parents, conflicting evidence or competing
  permissions stay separate pending review.

Done when:
- a condition submission arriving leaves the Development's description, relevance and figures
  unchanged;
- merge, detach and the non-recreation of a detached link pass the verification script;
- ambiguous families are listed for review instead of merged.

### Step 6 — One pin and a basic history

The planning tab shows one row and pin per Development: the principal's proposal, its stage, the
latest activity date and the number of applications. The inspector lists the applications in date
order with plain labels from procedure and stage:
- "permission approved";
- "amendment submitted" and "amendment approved";
- "condition details submitted" and "condition details approved".

No label claims construction has started. Unlinked applications are unchanged. The tab's ranking
and 2,000-row cap must be re-proven on the new read.

## Validation

Three levels, reported separately. None of them replaces the others.

1. **Reference reading:** does each link point at the application the child acts on? Measured in
   step 1 from descriptions, and repeated on a fresh sample once parents are fetched, so the parent
   side is read too.
2. **Family grouping:** is each family complete and free of strangers? Compared against Plota
   families on a fresh sample that deliberately includes:
   - missed follow-ups (applications worded as follow-ons with no link);
   - masterplans with several missing parents;
   - companion pairs and chains.
   Council records are checked where Plota and local evidence disagree.
3. **Development accuracy:** does each resulting Development describe the scheme correctly, with
   figures attributed to the right application and nothing summed or overwritten? Checked in the
   pilot on what users actually see.

Every checked item keeps its own verdict and explanation.

## Pilot

South Norfolk Broadland, Wandsworth and Glasgow, testing the complete process on:
- overlooked families (74 across the three councils at 3+ applications, plus eligible single
  follow-ups);
- known assessed Developments, including ones missing their originals;
- ambiguous examples (masterplans, competing permissions, conflicts with Plota);
- follow-ups arriving during the pilot, which must join automatically.

It measures:
- correct grouping;
- useful schemes recovered;
- accurate figures;
- duplicates removed;
- requests consumed per family.

The one-pin view and history are part of the pilot, not a later stage.

**Request limit:** **300 requests** (agreed 14 September), covering those families, a
validation sample of about 50, and refreshes. Taken from October's allowance, never below the
discovery reserve. National expansion is proposed from the measured value per request.

**Acceptance example, Broadland:**
- one correctly assessed warehouse-club Development;
- 2024/3141 and its 11 follow-ups visible together;
- the next condition application joins automatically, without a new Development and without
  fetching the family again.

## Simpler Plota integration (proposal, not a dependency)

Ask Plota whether its bulk search feed can carry `parent_reference`, or a family id, on each
application, the same links its associated endpoint already computes. That would let normal
ingestion link without a separate lookup. Everything above is built against the existing family
endpoint, so the answer changes cost, not design.

## Deferred

- Address and UPRN suggestions.
- Progress scoring (for example "construction likely started").
- Comprehensive condition tracking, beyond showing the ledger as Plota reports it.
- Manual attach and detach on the admin review screen. Detach exists as a database function for
  corrections in the first release.

## Decisions

Made on 14 September:
- Pilot councils: South Norfolk Broadland, Wandsworth and Glasgow.
- Companion consents merge into one Development.
- **Pilot request limit: 300 Plota requests**, from October's allowance and never below the
  discovery reserve.

Still needed:
1. **Standing lookup allowance** after the pilot, set from its measured value.
2. **Whether to ask Plota** about parent references in the bulk feed.

## Relationship to the grading fix

Linking changes what the classifier reads: the principal's proposal instead of a discharge's.
Fixing the grading afterwards measures it on the inputs it will actually get. The grading problem
remains meanwhile (10,009 high, 235 medium, discharges graded high), so **research stays off until
both are done.**
