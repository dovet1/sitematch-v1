# Planning: delivery plan

Date: 10 September 2026
Revised after an audit against the code. Six gaps found; all six verified and folded in.
Sequence: the planning tab first, then the Planning Monitor mode.

The classification pipeline is built and working. What follows is about getting it in front of
users, in the order that ships something usable soonest and learns most per week of work.

Background: `plota-classifier-handover.md` for the classifier and its evidence,
`design_handoff_planning_monitor/` for the Monitor concept.

## Why this order

The planning tab already has a working data path that reads the new store. It is a small,
contained piece of work that puts real classified applications in front of a user this week.

The Monitor is a much larger build, and two of its three application categories are thin in
today's data. Doing the tab first buys the thing the Monitor most needs, which is evidence
about whether the classification is useful in practice, at a fraction of the cost.

## Phase 0 — Unblock the data. Do this first, it gates everything.

**Buy the Plota subscription.** 465 requests remain and the demo key stops after one request
per run regardless of configuration. No amount of work downstream changes this, and every
phase below is starved without it.

**One ingest is not a pipeline.** There is no Plota or classification schedule in
`vercel.json` at all, and the sync endpoint exposes discovery and backfill only. Its 14-day
discovery window finds new applications; it does not revisit older ones whose decision changes,
and a decision changing is exactly the event a monitoring product exists to catch.

Done when: ingest and classification run on a schedule; a separate pass refreshes the status of
applications already stored; queue depth and data freshness are observable; and the tab has a
defined behaviour when data is stale rather than silently showing an old world.

## Phase 1 — The planning tab, ranked by relevance

The tab exists in the unified workspace inspector. `stored.ts` already reads the new store
behind `PLANNING_STORED_READ_ENABLED`, joins each application to its Development, and carries
`intelligenceTier`, `locationProvenance` and `commercialWork`.

**What is missing is small and specific.** The stored path does not select `relevance`,
`summary`, `creates_commercial_space` or `model_dwelling_count` from `developments`, and it
orders by `date_received`.

1. **Join the classification through.** Add relevance, the plain-English summary, the model's
   dwelling count and the commercial-space answer to the projection and to the
   `PlanningApplication` type.
2. **Agree the coverage contract before switching providers.** The tab does not currently show
   everything, and this plan previously said it did. The PlanIt path requests
   `app_size: Large`, `app_state: Undecided,Permitted,Rejected`,
   `app_type: Full,Outline,Amendment` and a start date. The stored path applies **none** of
   those and returns whatever happens to have been ingested. Switching providers therefore
   changes what a user sees, in both directions, and comparing one boundary would not detect
   it. Write down the intended filters and the historical window first, then measure against
   them.
3. **Order in the database, before the cap.** `stored.ts` takes the newest 2,000 rows and only
   then loads Development links, so sorting the result would permanently drop older
   high-relevance applications that never made the first 2,000. Ordering has to happen in the
   query, as a join, with an explicit `high → medium → low → unclassified` sequence, a date
   tie-break within each band, and a stable final tie-break on id.
4. **Show why.** A relevance badge, the one-sentence summary the classifier already writes,
   and the dwelling count where there is one. The summary is the part that makes a ranked list
   readable rather than merely sorted.
5. **Cut over against the written contract**, not against a single boundary. Measure coverage
   on several, including at least one where the two providers are expected to disagree.

Done when: a user sees classified applications ranked high to low with a readable reason;
coverage against the agreed contract is measured and accepted on more than one boundary; and
the ordering is proven to survive the 2,000-record cap on a boundary that exceeds it.

**Known caveat, stated rather than solved.** Relevance is currently calibrated as "worth
paying to investigate", which is a spending question, not "useful to look at", which is what a
ranked tab implies. They overlap heavily and the difference is not worth blocking on. Watching
how people use a ranked tab will settle it better than another labelling round would.

## Phase 2 — Make the data support the Monitor

The Monitor sorts applications into residential, relevant commercial, and brand-linked. Today
the second is nearly everything and the other two are nearly empty. Two of those are fixable
and one is unproven.

### 2a. Let residential schemes in

The eligibility filter was built to catch commercial supply. Residential schemes reach the
tier only through the dwelling-count limb, which reads Plota's `dwelling_count` — **empty on
130 of 164 records**. Meanwhile the classifier reads counts out of the description reliably.

**The bigger exclusion is upstream, not local.** Reduced-scope ingestion searches residential
records with `dmin: '1'`, so a purely residential application with no stated count is dropped
at ingest and the local filter never sees it. Widening the eligibility limb alone would change
nothing for those records.

So this is two changes in order: make full-census ingestion (or a demonstrably wide enough
search) a prerequisite, then re-evaluate what is already stored under a widened limb that
admits applications whose description mentions dwellings without a count, letting the
classifier supply the number.

Keep two thresholds apart, because they are different things. The **ingestion and
classification floor** is global and decides what the system knows about. A **display
threshold** is per user and decides what they see — the Monitor concept shows 50 units, the
expert works to 15, and that is a toggle, not a constant.

Done when: a residential scheme with no stated count in the source reaches the tier and
carries a model-supplied count, and the display threshold is user-controlled.

### 2b. Measure the research pass before changing it

An earlier version of this plan said the research pass needed pointing at news rather than
documents. **That was wrong.** `research-openrouter.ts` already runs a web search and its
prompt already asks for "reputable property and local-news coverage" alongside first-party
applicant, occupier, developer and agent pages. Retrieval is not the known problem.

The real unknown is the hit rate, and it is genuinely unknown: the 164 records were classified
but never put through research, which has only run five times in total. So run the batch first
and read what comes back — which sources were retrieved, and where grounding failed — before
deciding anything needs to change. Changing retrieval before measuring it would be guessing at
a problem that may not exist.

Done when: a real batch has run; hit rate and cost per identified operator are known; and the
failures have been read rather than counted.

### 2c. Stop re-reading what has already been read

`research_state` prevents a Development being researched twice, but it is per Development, not
per source. Nothing records that a particular application form has already been scanned, so a
re-run pays to read it again. Web search can reasonably repeat, since coverage changes; a
scanned PDF should not.

This needs a per-source record: what was fetched, when, its hash, and what came out. It also
unlocks incremental improvement of a Development over time, which is the stated goal: new
sources add to what is known rather than replacing it.

### 2d. Merge related applications into one Development

One real site currently becomes several Developments. `development_applications` already allows
`cited_reference` as a relationship, and detail submissions carry the parent's reference in the
description. This has always been blocked on a deep backfill, which Phase 0 unblocks.

## Phase 3 — The Monitor mode

Only once Phase 2 has made the three categories real. Three views, per the handoff:

- **Monitor** — the map-first landing view with the patch, the categorised markers, the
  application list and the AI summary card.
- **Set criteria** — patch geometry, estate proximity, application types, dates and status,
  brand watch. This needs new persistence: criteria are per user and editable.
- **Market change** — the zoomed view, and **its Phase 3 scope needs a decision**. With spend
  excluded and population projections deferred to Phase 4, what remains is the consented-but-
  unbuilt build footprints on the map and the dwellings pipeline chart, which is dwelling counts
  grouped by year. That is real but thin, and the before/after population pair and catchment
  uplift card — the two things that make the view feel like an answer — both depend on Phase 4.
  Either ship the footprints and pipeline as a modest view, or hold the whole view until
  Phase 4. Worth deciding deliberately rather than discovering halfway through.

**The AI summary card is new work and worth calling out.** It writes a short weekly narrative
across a patch, which is a different job from classifying one application. It is also the most
visible thing on the screen.

**Map accuracy will show.** 71 of 164 positions are ward or parish centroids rather than real
coordinates, and the design quotes distances like "0.8 mi from nearest store". Either improve
positions via postcode lookup, or show provenance honestly on the marker. Do not quote a
precise distance from a centroid.

## Phase 4 — Population growth from census

Join census population to the dwelling pipeline to project catchment change. Explicitly later,
and explicitly without spend modelling.

## Running alongside: the admin review surface

Not a phase, because it is needed as soon as anything is user-facing.

The review API is transactional and audited, and records the model's answer beside the human's.
**There is no screen.** It is an API route and nothing else.

**The API cannot correct everything the tab will show.** It accepts relevance, summary, brand
signals and observations. It does **not** accept `model_dwelling_count` or
`creates_commercial_space`, and correcting an observation does not propagate to those
Development fields. So the moment the tab displays a dwelling count, it displays a number no
reviewer can fix. Extend the audited correction path to cover every field the tab consumes, and
decide explicitly which value the tab reads when the source figure, the model figure and a
human correction disagree.

One design note: the review triggers in the original goal — flag where commercial floorspace or
the brand behind an application is missing — would currently fire on almost every record.
Floorspace is empty on 162 of 164, and no incoming occupier has been identified. Until Phase 2
changes that, review should key on the classifier's own `unanswered_questions` and its
confidence, not on the absence of fields that are always absent.

Done when: every field the tab shows can be corrected and audited, and the precedence between
source, model and human values is written down.

## What is deliberately not in this plan

- **Further prompt tuning.** The test split leaks, the sample is 164 records, and two humans
  agree with each other less often than the model agrees with either. Corrections arriving
  through the review screen are now recorded properly, so labels accumulate as a by-product of
  use. That is a better source than another labelling exercise.
- **Splitting relevance into a UI ranking and a research priority.** A real distinction, worth
  revisiting once there is usage data. Not worth blocking Phase 1 on.
