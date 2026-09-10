# Planning: delivery plan

Date: 10 September 2026
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
phase below is starved without it. Once it is in place, run ingest at volume once and look at
what arrives before committing to anything else.

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
2. **Order by relevance, then date.** Applications outside the intelligence tier have no
   relevance at all, so rank classified ones first and leave the rest in date order beneath.
   That preserves the tab's existing contract, which is to show everything in the boundary up
   to 2,000 records, rather than quietly hiding the unclassified majority.
3. **Show why.** A relevance badge, the one-sentence summary the classifier already writes,
   and the dwelling count where there is one. The summary is the part that makes a ranked list
   readable rather than merely sorted.
4. **Flip the flag** and compare against the PlanIt-backed path on the same boundary before
   removing anything.

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

So the filter is rejecting exactly the schemes the Monitor leads with. Options, cheapest
first: widen the limb to admit applications whose description mentions dwellings even when the
count is absent, and let the classifier supply the number; or run a cheap pre-pass. Either way
the threshold should be **configurable, not fixed** — the Monitor concept shows 50 units, the
expert works to 15, and a user toggle is the obvious answer.

### 2b. Point the research pass at news, not just documents

The expectation is that a brand match will be rare, and that most brand intelligence comes
from **news coverage of a development** rather than the application forms. `research-sources.ts`
is currently built around council pages and document links.

Nothing here is disproven yet: the 164 records were classified but never put through the
research pass, which has only run five times. So the honest position is untested, not failed.
The work is to widen the sources toward news and run it on a real batch, then measure the hit
rate and cost per identified operator before scaling.

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
- **Market change** — the zoomed view. **Spend figures are out of scope**; population growth
  from census data joined to the dwelling pipeline is Phase 4.

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

One design note before building it: the review triggers in the original goal — flag where
commercial floorspace or the brand behind an application is missing — would currently fire on
almost every record. Floorspace is empty on 162 of 164, and no incoming occupier has been
identified at all. Until Phase 2 changes that, review should key on the classifier's own
`unanswered_questions` and its confidence, not on the absence of fields that are always absent.

## What is deliberately not in this plan

- **Further prompt tuning.** The test split leaks, the sample is 164 records, and two humans
  agree with each other less often than the model agrees with either. Corrections arriving
  through the review screen are now recorded properly, so labels accumulate as a by-product of
  use. That is a better source than another labelling exercise.
- **Splitting relevance into a UI ranking and a research priority.** A real distinction, worth
  revisiting once there is usage data. Not worth blocking Phase 1 on.
