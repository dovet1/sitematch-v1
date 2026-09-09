# Plota development intelligence — review of the plan

The core judgement is right: one provider, deterministic eligibility, store-then-classify,
a Development entity above raw applications, evidence-linked enrichment, and a hard cost
ceiling. The ingestion and cost-control halves of this plan are well built and I would not
change their shape.

The problem is upstream of all of it. The plan was written to answer *"what should we
ingest from Plota?"* and it answers that well. It was not written against the three product
aims, and when you hold it up to them, the eligibility rule — the one deterministic gate
that decides what the system can ever know — throws away the evidence for two of the three.

Aims, restated:

1. keep property professionals abreast of relevant commercial and residential applications
2. show which brands are actually acquisitive, and where
3. show how an area is changing, commercially and residentially

Aim 1 is served well. Aim 2 is served weakly and for a structural reason the plan does not
mention. Aim 3 is not served at all by a pipeline whose first act is to discard most of the
area's activity.

Amendments below are ordered by how much they change the build.

---

## 1. The eligibility rule excludes the evidence for aims 2 and 3

The gate is `commercial_work ∈ {new, to-commercial, between}` OR `dwelling_count >= 16`.
Three things fall outside it, and each one is load-bearing for an aim.

### 1a. Most brand acquisition leaves no planning trace in those categories

Use Class E has merged shops, offices, restaurants, gyms, clinics and nurseries since
September 2020. Movement between them is not development and needs no permission. When a
brand takes a former bank, a former Carphone Warehouse or a dark unit in a parade, there is
usually **no `commercial_work='between'` record to find**, because there is no application.

What that brand does file is an advertisement consent, a shopfront alteration, an extraction
flue for hot food, a mezzanine, or a listed-building consent. Those are exactly the records
this plan drops, and the existing deterministic classifier already routes them to `low`
(`apps/web/src/lib/planning-alerts/relevance.ts:60`, `:98`). The plan then reinforces it in
the relevance guidance ("minor subdivisions", "ancillary facilities").

So the aim-2 claim — *which brands are acquisitive and where* — would be built on the
subset of brand activity that happens to involve construction. That biases hard towards
drive-thru, roadside, foodstore and warehouse operators, and away from every in-town
Class E occupier. It will look like data and be a systematically skewed sample.

### 1b. Commercial *loss* is missing, and loss is the area-change story

`to-commercial` and `between` are in. Change **out** of commercial use is not. Class MA
office/retail-to-residential prior approvals, upper-floor conversions and demolition of
employment floorspace are the dominant structural change on UK high streets right now, and
they are the single most useful input to "how is this area changing" — and to supply-side
questions a retailer actually asks (is units stock shrinking? is the pitch weakening?).

Confirm whether `commercial_work` has a loss/`from-commercial` value. If it does, it belongs
in the gate. If it does not, loss has to be detected from use-class transitions or
description text, and that needs to be designed now, not discovered in Phase 4.

### 1c. Brand-alias matching happens on the wrong side of the gate

Stage 0 runs "exact and alias-based matches against the existing brand database" — but
Stage 0 runs *after* eligibility. A named brand in an application that fails the gate is
never seen, never stored, never auditable. That is the cheapest, highest-precision signal
in the entire system and it is being discarded before it is computed.

**Decision: four eligibility limbs, not two.**

| Limb | Rule | Tier |
|---|---|---|
| A | `commercial_work ∈ {new, to-commercial, between}` | intelligence |
| B | `dwelling_count >= 16` | intelligence |
| C | brand-alias hit in description, address or applicant/agent — **any application type, any size** | intelligence |
| D | commercial-loss categories (see 1b) | intelligence |

Limb C is deterministic, costs nothing, and is the only limb that can catch a Greggs
opening. Run the alias match *before* the gate and let it open the gate.

---

## 2. Aim 3 needs a census tier; the plan has no denominators

"How is this area changing" is a statistical claim. A pipeline that stores 25–40k
applications a year out of the roughly 450k filed cannot make it — it can list events, but
it cannot say whether commercial floorspace in a town is net up or down, or what share of
new dwellings came from small sites, because it never saw the other 90%.

Worse, the plan removes the thing that currently does this. The Planning tab today returns
*everything* inside the boundary via PlanIt (`apps/web/src/app/api/public/planning/planit.ts`),
capped at 2,000 records. Swapping it for eligible-only Developments is a visible regression
for any user who currently uses the tab to see what is going on.

**Decision: two storage tiers with one gate between them.**

- **Tier A — census.** Every application the discovery searches return, stored as a thin
  row: id, authority, reference, coordinates/postcode, description, type, use class,
  dwelling count (net), floorspace, status, dates, source URL. No LLM, ever. No refresh
  beyond a periodic bulk status sweep. This is what area analytics and the "everything
  here" list read.
- **Tier B — intelligence.** Limbs A–D above. Classification, grouping into Developments,
  enrichment, brand association.

Tier A is affordable and the plan's own arithmetic proves it. At 50 records per request,
25–40k eligible records cost 500–800 requests to backfill a year. Widening residential to
`dwelling_count >= 1` and taking all commercial-work categories perhaps triples the record
count: ~1,500–2,400 requests for a 12-month backfill, and ~150–250 a month ongoing. That is
1–2% of the Starter allowance for the entire aim-3 dataset. Storage is not the constrained
resource here; requests and tokens are, and Tier A consumes almost none of either.

Also required for aim 3, and absent from the plan:

- **`dwelling_count` must be net, with losses stored separately.** Gross unit counts double
  count conversions and make residential stock change wrong in the direction that flatters.
  The floorspace model already gets this right (proposed/existing/lost) — apply the same
  discipline to dwellings.
- **A per-authority coverage table.** 393 councils is not all UK LPAs, and any council can
  silently stop publishing. An area view must be able to say "Canterbury: last synced
  2026-09-07, 412 applications" rather than render an empty chart that reads as "nothing is
  happening here". Store `authority`, `last_successful_sync`, `records_last_30d`, and show
  it wherever an area total is shown.

---

## 3. The refresh budget is understated by roughly 3×, and the fix is cheap

The largest line in the table — 3,000–5,000 requests/month for refreshing active
Developments — is the only one not derived from a stated volume. Deriving it:

At 25–40k eligible/year, assume 20% high relevance and 40% medium (the plan gives no
estimate — that is itself the gap). Majors sit undetermined for 4–8 months, minors 8–13
weeks; call it 0.4 years average in a live state.

- high, pending, live stock: 5,000–8,000/yr × 0.4 ≈ **2,000–3,200**
  weekly refresh → ×4.3 = **8,600–13,800 requests/month**
- medium, surfaced, live stock: 10,000–16,000/yr × 0.4 ≈ **4,000–6,400**
  monthly refresh → **4,000–6,400 requests/month**

That is 12,600–20,200 a month for refresh alone, against a 15,000 ceiling, before discovery,
details, associations or retries. The plan hits its upgrade trigger in year one — not
because Starter is too small, but because the refresh design is per-application.

**Decision: refresh through search, not detail.** A search request returns 50 records. If
the search payload carries status and decision fields — it must, since eligibility is
evaluated from search results — then refreshing 50 applications costs one request instead
of fifty. Sweep by authority plus received-date window, diff the returned status against
stored status, and spend a per-application detail request only on the records that actually
changed.

That turns the largest line into roughly 300–600 requests a month and makes the
"compensating for the missing change feed" section genuinely viable rather than a slow
burn towards Pro. It also makes daily status freshness affordable for *every* stored record,
including Tier A — which is what aim 3 needs, since the plan currently never refreshes
low-relevance records and would therefore report outcomes it never learned.

**Confirm first:** which fields the search endpoint returns versus the detail endpoint. If
status is detail-only, this whole approach collapses and the budget needs rebuilding around
that constraint. This is question one for Plota alongside §4.

---

## 4. Applicant and agent names are the highest-value unknown in the plan

The plan's Stage 1 input never mentions the applicant or agent. That is the strongest brand
signal that exists in planning data — "Aldi Stores Ltd", "Starbucks Coffee Company (UK) Ltd",
or a known retail agent acting for a named client — and it needs no documents and no web
research to obtain.

We do not have it today: PlanIt returns the placeholder `"See source"`
(`apps/web/src/app/sitematcher-unified/types/unified-workspace.ts:131`).

If Plota carries applicant and agent on Starter, then:

- limb C above becomes dramatically more productive
- brand-role classification gets an anchor ("applicant is the brand" is a different and far
  safer inference than "the brand is mentioned in the description")
- the entire Phase 4 document pipeline drops several places in priority, because its main
  job was finding the occupier

If Plota does not carry it, the document pipeline stays essential and its risk (§7) becomes
the project's dominant risk. Answer this before committing to portal adapters.

---

## 5. Aim 2 needs an output the plan does not produce

The plan's aim-2 deliverable is "confirmed Development associations in the brand modal".
That is a list of things near a brand. It is not *"which brands are acquisitive and where"*,
which is a ranked, comparative, time-series claim.

The pieces already exist and the plan does not connect them:

- `public.brand_store_snapshots` (`supabase/migrations/20260905000000_create_brand_store_snapshots.sql`)
  — monthly estate history by brand and county, with `opened_in_period` separated from
  `added_in_period` precisely so imports are not mistaken for growth.
- `public.brand_activity` — curated openings and closures, `kind IN ('opening','closure')`.
- `public.requirements` — stated acquisition intent.

Planning gives you the **pipeline**; snapshots give you **delivery**; requirements give you
**intent**. A brand filing twelve applications a quarter and opening nothing is a different
proposition from one filing three and opening three, and only the join tells you which.

**Decision: add a brand expansion rollup** — applications by brand × county × quarter,
split by role (proposed occupier vs applicant vs referenced) and by outcome, joined to the
snapshot deltas. That is the aim-2 product. The brand modal is one view of it.

Note `brand_activity` is documented as admin-curated. Planning-derived rows must carry a
source and confidence, or live in a separate table — do not let inferred rows silently mix
with curated ones.

---

## 6. Make daily search primary and webhooks the accelerator

The plan asks this as question 2. Answer: **search primary.**

- The nightly 14-day sweep is mandatory regardless, so the search path must be built and
  correct anyway. Webhooks add a second ingestion path that can only ever be an optimisation.
- Backfill, sweep and daily discovery then share one code path, one dedupe, one upsert.
- It is resumable and verifiable. The alerts pipeline already learned this the hard way —
  `planning_alert_run_prefixes` with per-item leases and checkpointing exists
  (`supabase/migrations/20260722150000_checkpoint_planning_alert_generation.sql`,
  `apps/web/src/lib/planning-alerts/service.ts:215`) because long fan-outs fail midway.
- The request budget permits it comfortably at Tier A volumes (§2).

Add webhooks afterwards for latency, with the sweep as the authority when they disagree.

---

## 7. Do not delete PlanIt in Phase 5 — it is the only audit oracle we have

Eligibility depends entirely on Plota's own derived `commercial_work` and `dwelling_count`.
If Plota mislabels an application, it never reaches us, and **no metric in the plan's quality
section can detect it** — "eligibility recall" measured against Plota-sourced records is
recall against the thing being tested.

PlanIt scrapes council portals independently. For one or two councils, fetching the same
period from both and diffing is a direct measurement of Plota's field accuracy, and it is
nearly free. That is worth more than most of the listed metrics.

**Decision:** keep PlanIt as an offline audit path and as the "show me everything here"
fallback until Tier A demonstrably matches it on sampled boundaries. Gate its removal on a
written coverage comparison, not on a phase number.

---

## 8. Phase ordering conflicts with itself

Phase 5 migrates Assess Area, Find Gaps and brand modals to stored Developments. Phase 6
then says "begin with Kent". You cannot serve a national product from Kent-only ingestion.

The confusion is treating ingestion breadth and enrichment depth as one rollout. They are
not, and they have opposite cost profiles: national ingestion is cheap and uniform;
enrichment is expensive and per-council fragile.

**Decision:**

- ingest **nationally** from Phase 2, Tier A and Tier B (§2) — a few hundred requests a month
- stage **enrichment** by council portal, starting with the highest-volume portal technology
- stage the **UI cutover** by surface: Planning tab first (it has a PlanIt fallback), brand
  modals last (they carry the highest precision requirement)
- move the coverage comparison (§7) ahead of any deletion

---

## 9. Document enrichment: right instinct, wrong budget and wrong first target

The selection ranking and the three-document cap are sensible. Two corrections.

**The $6 monthly document budget only works with weak models.** Stage 1 is fine — ~3,000
records at ~1.2k tokens is under 4M tokens a month, well under $1 on an open-weight model.
But 300–800 enriched applications at ~30k tokens of planning statement each is 10–25M
tokens; that is $2–3 on a cheap long-context model and $50–75 on a capable one. Extracting a
floorspace schedule from a PDF table is exactly the task cheap models fail at, and a wrong
floorspace figure presented with a page-number citation is worse than no figure.

**Start with decision notices and committee reports, not planning statements.** They are
short, text-native, structurally consistent, and they carry the two facts with the highest
product value: what was actually permitted, and the officer's description of the scheme.
Planning statements are long, promotional and expensive to read.

**The portal adapters are the project's largest hidden cost.** 393 authorities across Idox
Public Access, Northgate, Arcus, Ocella and bespoke builds; Idox gates documents behind a
disclaimer/session step; several councils sit behind bot protection. This is one bullet list
in the plan and it is probably more work than everything in Phases 2 and 3 combined. Scope
it explicitly to the top portal technology, measure what share of high-relevance
applications that covers, and treat anything beyond it as optional.

---

## 10. Migrating alerts is a bigger win than the plan credits

"Connect planning alerts to stored Developments" is one bullet. It deletes a lot of
machinery: the postcode-prefix envelope model, the ONSPD-driven prefix rebuild, the
per-prefix work queue with five-minute leases, and the five-prefixes-per-request interactive
generation — all of which exist only because PlanNexus cannot be queried by polygon.

Against a stored, PostGIS-indexed table, an alert is one spatial query. Monthly becomes
daily or weekly at no upstream cost. Say so in the plan; it is a payoff, and it justifies
the Development table's geometry work.

Two mechanical notes:

- `planning_alert_runs.provider` is `CHECK (provider IN ('mock','plannexus'))` — widen it.
- The immutable `digest_payload` snapshot should stay immutable. Do not "improve" it into a
  live join; emailed links must keep resolving to what was sent.

---

## 11. Data-model corrections

- **Geometry must be PostGIS, not a lat/lng pair.** "latitude and longitude, geometry where
  available" will not serve Assess Area or Find Gaps. Use `geography(Point,4326)` with a
  GIST index, and expose a `developments_in_boundary` RPC alongside the existing helpers in
  `supabase/migrations/20260737000000_find_sites_search_helpers.sql`. Every other spatial
  feature in this codebase already works this way.
- **Geocode the gaps from data we already hold.** Applications with no coordinates are
  invisible in an area-first product. `public.uk_postcode_centroids` is already imported
  (`supabase/migrations/20260722130000_planning_alert_postcode_coverage.sql:7`) — postcode
  centroid is a perfectly good fallback provided the row records that its position is
  derived, so it is never treated as a site location.
- **`last checked` is not optional.** The plan says "potentially in the user interface".
  With no change feed and tiered refresh, a status can be a month stale; showing it without
  a date is a correctness problem, not a polish item.
- **Applicant names are personal data when the applicant is an individual.** Householder-scale
  records will carry real names. Exclude them from prompts and from any public surface;
  brand-level applicants are the only ones with product value.

---

## 12. Licensing is a gate, not a review question

Question 10 asks whether Starter's commercial licence covers nationwide filtered storage and
presentation to paying customers. That is not a question to resolve at architecture review —
it determines whether the project is viable at £49/month or at a renegotiated figure, and
the answer changes the business case, not the design.

Get it in writing before Phase 2 spend, the way `docs/epc-licensing-brief.md` handled the
same problem for EPC data.

---

## Questions for Plota, in priority order

1. Does the **search** response carry status and decision, or are they detail-only? (§3 —
   this decides the entire request budget.)
2. Are **applicant and agent names** available on Starter? (§4 — this decides how much
   document work is needed.)
3. Is there a **commercial-loss** value in `commercial_work`, or must loss be derived? (§1b)
4. What is the full `commercial_work` enumeration, and how is it derived — declared field,
   or Plota's own classification? What is its measured accuracy?
5. Can saved alerts express `commercial_work` and `dmin`? (Now lower stakes: search is
   primary either way.)
6. Which of the 393 councils are covered, at what latency, and is there a per-council
   freshness or failure signal we can read? (§2 coverage table.)
7. Does the record carry document metadata — titles and URLs — or only a count? (Decides
   whether portal adapters are needed at all for discovery, §9.)
8. Written confirmation on the commercial licence. (§12)

---

## What I would keep unchanged

- Deterministic eligibility that an LLM cannot override.
- Store-raw-then-classify, with input hashes, prompt and schema versions, and human
  overrides recorded.
- The Development entity, and the grouping precedence that refuses to merge on coordinates.
- Floorspace as multiple scoped observations rather than one number.
- Evidence links on every enriched fact, and no unsupported assertion presented as fact.
- Hard per-stage budget ceilings that defer work rather than overspend.
- Precision over coverage for brand associations.
- Phase 1's eval harness before any subscription — with the labelled set extended to cover
  Class E moves, advert- and shopfront-only brand entries, and commercial-loss conversions,
  since those are the cases §1 adds.
