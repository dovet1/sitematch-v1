# Plota development intelligence plan

## Purpose

Build a national planning-intelligence system with Plota as the only planning-data
provider. The system should:

1. keep property professionals abreast of relevant commercial and residential activity;
2. identify which brands appear to be acquisitive, and where;
3. explain how an area is changing commercially and residentially.

The first production version should target Plota Starter (£49/month), a hard $20/month
LLM budget, and fewer than 15,000 of Starter's 20,000 monthly API requests.

PlanIt is not part of the target architecture or evaluation process. PlanNexus may be used
as a non-authoritative free-tier sidecar for document discovery and quality assurance in a
five-council pilot, but it must not become a production discovery, refresh, or display
dependency.

## Decisions

### 1. Store two tiers of planning data

The system needs both a broad factual layer and a selective intelligence layer.

#### Census tier

The preferred scope is every current planning application if Plota confirms that Starter's
licence permits the intended nationwide storage and paid-product presentation. Request
volume is not the constraint: at roughly 450,000–600,000 applications a year, discovery
would consume about 750–1,000 Starter search pages per month.

If the licence does not permit a full current census, use this reduced census:

- every application with a Plota `commercial_work` value, including `new`, `extension`,
  `to-commercial`, `between`, `loss`, and `minor`;
- every application with `dwelling_count >= 1`;
- selected `advert-consent` and `listed-building` applications where required to catch
  occupier activity not covered by the commercial classification.

The census tier receives no LLM classification. It supports area totals, maps, trends,
coverage reporting, brand-alias matching, and the complete Planning list.

Obtain written confirmation of the permitted scope before either national backfill. The
same data model and ingestion path support both options.

Store only the fields needed for these uses:

- Plota ID, authority and reference;
- address, postcode, UPRN and location;
- description, procedure, category, commercial classification, and use class;
- stated dwelling count and floorspace;
- status, stage, decision and dates;
- document count and source links;
- first seen, last seen, source changed timestamp, and last checked timestamp.

#### Intelligence tier

Promote a census record to the intelligence tier when any limb applies:

| Limb | Rule | Initial status |
|---|---|---|
| A | `commercial_work` is `new`, `to-commercial`, or `between` | Required |
| B | `dwelling_count >= 16` | Required |
| C | A known brand alias appears in the description or permitted corporate applicant data | Activate after evaluation target is met |
| D | `commercial_work` is `loss` | Required for area-change intelligence |

Limb C runs before the intelligence gate. An address-only alias hit remains a census flag
and cannot promote a record because former occupiers, street names and named buildings
produce too many false positives. Activate limb C after it achieves at least 95% precision
on a labelled set of at least 200 alias hits.

An LLM cannot override deterministic membership of a limb. It can rank relevance within
the intelligence tier.

### 2. Make scheduled search the authoritative ingest path

Use the search API for backfill, daily discovery and refresh. This gives one resumable,
verifiable and idempotent code path.

Saved-alert webhooks can be added as a latency accelerator after the search path is proven.
Webhook events create or update the same stored record and never bypass normal
deduplication or classification.

The ingest job should:

1. query each census filter for the target date window;
2. paginate until the cursor is exhausted;
3. upsert by Plota ID;
4. record the run and its high-water marks;
5. retry pages through leases/checkpoints;
6. update per-authority coverage observations;
7. enqueue intelligence classification only when the relevant input hash changed.

Run a rolling overlap window so applications published late with earlier received dates
are recovered.

### Initial history and ongoing ingestion

At launch, backfill the preceding 12 months nationally using whichever census scope the
licence permits. After that baseline is complete, ingest new applications daily and keep
live records current through the rotating refresh tiers below.

Apply different processing depths to the backfill:

- store every matching application as a census record;
- run deterministic brand matching and intelligence-limb assignment;
- run Stage 1 classification only for intelligence-tier records;
- fetch detail and associations for pending applications, applications decided in the
  preceding 90 days, and exceptional older records with clear current value;
- run document or web enrichment only when the Development remains actionable or is needed
  for a current product claim.

Do not initially import and enrich Plota's complete archive back to 2016. Fetch older
history selectively when a user opens a site, Development or area where it would answer a
specific question. Older-history requests must be queued, rate-limited, cached and stored
as census data first; they do not automatically trigger LLM or document enrichment.

Complete the twelve-month baseline before replacing the existing Planning view nationally.
For a full census, throttle the one-time backfill across available monthly request capacity
so routine discovery retains its 5,000-request reserve. A reduced commercial/residential
backfill can normally complete more quickly.

### 3. Refresh in batches rather than per application

Plota search results contain `status`, `stage`, `decision`, decision dates, key dates and
`documents_count`. Use paginated searches to refresh cohorts of records, then fetch an
individual detail only when a changed record needs fields that are absent from search.

Because Starter has no `changed_since`, use three rotating refresh tiers:

- daily discovery with a rolling received-date overlap;
- weekly batch refresh of recent and high-value intelligence cohorts;
- monthly batch refresh of other live intelligence cohorts;
- quarterly or on-demand batch refresh of census-only cohorts;
- a final refresh of decided/withdrawn records, then stop routine polling;
- an on-demand queued refresh for a stale Development opened by a user.

Cohorts should be expressed as authority plus received-date windows so each search result
can be compared with stored state. Do not issue one request per live application.

The monthly request controller should stop optional detail and association work before it
can threaten ingestion. Reserve at least 5,000 requests for recovery and unexpected volume.

Indicative search-request arithmetic at Starter's 50-record page size:

| Scope | Discovery | Census refresh | Weekly intelligence refresh | Search total/month |
|---|---:|---:|---:|---:|
| Reduced commercial/residential census | 250–400 | 200–400 | 700–1,300 | 1,150–2,100 |
| Full current-application census | 750–1,000 | about 600 averaged monthly with quarterly census sweeps | about 1,300 | 2,650–2,900 |

The full-census estimate assumes about 90,000 live records, a quarterly census-only sweep,
and roughly 15,000 live intelligence records refreshed weekly. Details, associations,
retries and backfill still fit comfortably below the 15,000 internal ceiling. Recalculate
these figures from observed volumes before changing cadence.

### 4. Treat source coverage and freshness as product data

Maintain a per-authority coverage record containing:

- Plota authority identifier;
- Plota's latest published application date;
- Plota's last-checked time and freshness state where supplied;
- our last successful discovery and refresh runs;
- records observed over the last 30 days;
- latest source application date observed;
- current error or degraded state.

Every area total must be able to distinguish no activity from missing or stale coverage.
Show `last checked` on user-facing planning records because Starter uses tiered refresh.

### 5. Use PostGIS for every spatial product path

Store the best available location as `geography(Point,4326)` with a GIST index.

Also store location provenance:

- `source_exact` for a Plota/council coordinate;
- `postcode_centroid` for a fallback derived from `uk_postcode_centroids`;
- `missing` when neither is available.

A postcode centroid can support inclusion in area-level results but must not be presented
as an exact site location.

Add a spatial query/RPC for Developments and census applications within an Assess Area or
Find Gaps boundary. Planning alerts should use the same stored geometry rather than
postcode-prefix fan-out.

## Data model

### Planning application census record

One row per Plota application. Store normalized fields plus the raw response needed for
audit and reprocessing. Keep source timestamps separate from our ingestion timestamps.

Plota's `dwelling_count` is a stated count derived from description text; it is not a safe
net-change measure. Store it as `stated_dwelling_count`.

Where intelligence processing can establish the values, store separate observations for:

- existing dwellings;
- proposed dwellings;
- dwellings lost;
- calculated net change;
- evidence and confidence.

Apply the same proposed/existing/lost discipline to commercial floorspace.

### Development

A Development represents the real-world scheme or site and can contain multiple planning
applications.

Store:

- canonical name and site address;
- UPRN and best available geometry;
- lifecycle stage and key dates;
- related planning applications and their roles;
- residential and commercial components;
- scoped floorspace and dwelling observations;
- developer/applicant organisations where permitted;
- brand associations and their roles;
- document and web evidence;
- relevance, confidence, review state, and freshness.

Group applications in this order:

1. Plota's explicit associated-application family;
2. shared UPRN;
3. explicit cited planning references;
4. strong normalized address and scheme-name evidence;
5. manual confirmation.

Never merge automatically from coordinate proximity alone. Uncertain relationships remain
proposals for review.

### Brand development signal

Do not mix inferred planning events into the admin-curated `brand_activity` table.

Create a separate evidence-bearing relationship with:

- Development and brand IDs;
- observed name;
- role: proposed occupier, proposed operator, applicant/developer, existing occupier,
  former occupier, neighbouring occupier, referenced only, or unclear;
- evidence source and excerpt;
- confidence and review status;
- first and latest observed dates;
- planning outcome.

Only a proposed occupier/operator above the agreed confidence threshold may appear as a
confirmed association in a brand modal.

### Brand expansion rollup

Produce a brand-by-county-by-quarter rollup containing:

- applications and Developments by brand role;
- pending, approved, refused and withdrawn outcomes;
- proposed openings, relocations, expansions and closures;
- store snapshot changes, separating real openings from imported records;
- curated `brand_activity` events;
- stated acquisition requirements.

Planning represents pipeline, store snapshots represent delivery, and requirements
represent intent. Keep the provenance of each signal visible rather than reducing them to
one unexplained score.

## Classification and enrichment

### Stage 0: deterministic processing

For every census record:

- normalize address, text and identifiers;
- identify explicit numeric values;
- match known brand aliases before the intelligence gate;
- assign intelligence limbs;
- calculate a stable input hash;
- retain the decision even when the record is not promoted.

Do not send individual applicant names, addresses, contact information or other personal
data to an LLM or expose them in the product. Plota contact data is not included in base
Starter and is not required for the first version. Corporate applicant names found on a
council record may be used selectively when their business relevance is clear.

### Stage 1: inexpensive classification

Run a structured-output open-weight model for intelligence-tier records. Return:

- relevance: high, medium or low;
- substantive proposal and development type;
- opportunity type;
- brand mentions with role and evidence;
- scoped dwelling and floorspace observations;
- reasons and uncertainties;
- whether detail, documents or web research would materially improve the record;
- specific unanswered questions.

Store provider, model, prompt/schema versions, input hash, output, token/cost usage,
timestamp and human overrides.

### Stage 2: stronger review

Use a stronger model only for a material ambiguity involving brand role, grouping,
floorspace, dwelling net change, or a user-facing high-value claim. Give the reviewer model
the first-pass result and the precise issue to resolve.

### Stage 3: council record and documents

For a high-value unresolved record:

1. inspect structured metadata on the council application page;
2. collect document titles, dates, types, sizes and public links;
3. rank documents locally;
4. extract text locally or with the free parser;
5. use paid OCR only for selected scanned pages;
6. send only relevant passages or pages to a capable model;
7. retain fact-level evidence, page references and confidence.

Use stage-aware document priorities:

- pending: application form/council metadata, planning statement, design and access
  statement, accommodation schedule, retail assessment, and selected plans;
- decided: decision notice and committee/officer report first, followed by supporting
  documents only when necessary.

Default limits are three documents and 50 processed pages per application. A table or
drawing extraction must use a model demonstrated to be accurate on the evaluation set;
otherwise leave the value unknown.

The capable-model document budget supports approximately 50 fully enriched applications
per month at launch, not 10–25% of the intelligence feed. Rank the queue by relevance and
unanswered product value. Metadata collection and free local text extraction may cover
more records, but no additional model-based factual extraction runs after the monthly cap.

Portal adapters are deliberately constrained. Begin with the highest-volume portal
technology, measure the share of high-relevance applications covered, and add another
adapter only when that share justifies the maintenance cost. Always provide the council
record link as the fallback.

### Stage 4: web research

Research only high-relevance Developments with a specific unanswered commercial question.
Default limits are 100 Developments per month, two searches per Development and five
results per search. Prefer official council, developer, agent and operator sources.

Every retained fact needs its URL, publication date, evidence, confidence and research
timestamp.

## Optional PlanNexus free-tier sidecar

PlanNexus Free currently provides 1,000 requests per month, limited to a patch of up to five
councils, ten postcode districts, or a 25 km radius. Its application data is delayed by
seven days. These limits make it unsuitable for national ingestion, current status, alerts,
or any user-facing service-level promise.

It can reduce risk in two bounded ways. Do not build its document-list integration in the
first version. Validate document ranking on 20–30 applications collected manually from
council records. Reconsider the endpoint only if manual evaluation proves document
enrichment valuable and the first portal adapter is materially blocked.

### 1. Independent quality sample

Use PlanNexus to compare a small, fixed sample of applications in the five pilot councils
with Plota, then resolve disagreements against the primary council register. Measure:

- whether an application was present in each provider;
- description, type, status, decision and location agreement;
- whether Plota's commercial and dwelling classifications are supported by the council
  record;
- source-link and core-record agreement.

PlanNexus is a diagnostic signal, not the adjudicator. The council register decides any
disagreement. Seven-day-delayed records must only be compared after the delay window.

### 2. Limited enrichment experiments

Use the included 25 monthly PropertyDossier lookups only for internal evaluation of whether
constraints, nearby planning history, EPC information and decision outlook materially
improve a Development. Do not add these fields to the product until their licensing,
accuracy and incremental user value have been reviewed.

### Free-tier request allocation

| Use | Monthly ceiling |
|---|---:|
| Quality sample and status-history checks | 200 |
| PropertyDossier experiments | 25 |
| Retries and reserve | 75 |
| Initial operating cap | 300 |
| Unused free allowance | 700 |

The sidecar must have its own usage counter and kill switch. Exhausting or losing the free
tier must not stop Plota ingestion, classification, document fallback links, planning
alerts, or any product view.

Choose the five pilot councils using three factors: relevance to the initial customer
market, eligible-application volume, and diversity of council portal technology. Do not
assume the free-tier patch can be rotated without PlanNexus confirmation. If document-list
testing is later enabled, exclude these five councils when measuring the independent
coverage achieved by the first council-portal adapter.

## Cost controls

Set a hard OpenRouter ceiling of $20 per calendar month:

| Stage | Monthly ceiling |
|---|---:|
| Initial classification | $2 |
| Stronger review | $4 |
| Document interpretation | $5 |
| OCR | $3 |
| Web research | $4 |
| Evaluation/retry reserve | $2 |

When a stage reaches its ceiling, deterministic ingestion and storage continue while
optional work is deferred. Prioritize model quality over volume for tables and other facts
where an incorrect answer is worse than no answer.

## Product surfaces

### Planning tab

Read the census tier for the complete list and area-change context. Overlay intelligence
where a Development exists. Show coverage and freshness alongside totals.

### Assess Area and Find Gaps

Use PostGIS boundary queries over stored census records and Developments. Provide:

- recent commercial supply and loss;
- residential net-change evidence where available;
- significant pending and approved Developments;
- location confidence;
- coverage/freshness warnings.

### Brand views

Add confirmed Development associations to brand modals. Add the expansion rollup as the
eventual product for comparing which brands are active, in which counties, and whether
planning signals are becoming delivered stores.

### Planning alerts

Replace postcode-prefix upstream fan-out with one spatial query over stored PostGIS data.
Allow daily or weekly alerts without additional Plota calls.

Widen the `planning_alert_runs.provider` constraint for the new stored provider. Preserve
the immutable `digest_payload`; emailed links must continue resolving to the snapshot that
was sent.

## Quality and audit

Do not retain PlanIt as an audit oracle. PlanNexus may provide a secondary cross-check in
the five-council pilot, but measure and adjudicate Plota against primary council records.

Build a labelled evaluation set containing:

- a random sample of all census records from selected council/date periods;
- every record promoted by limbs A-D in those periods;
- known brand openings with and without change-of-use applications;
- commercial losses and residential conversions;
- former, neighbouring and address-only brand mentions;
- administrative and follow-on applications;
- conflicting floorspace and dwelling figures.

For sampled authorities, compare the Plota census with the council's own published register
or export. This is the independent recall test for Plota-derived fields and eligibility.
PlanNexus can help identify disagreements worth checking but is not ground truth.

The first recall audit is manual and happens before portal-adapter development:

- select two authorities with different portal technologies;
- collect two months of their published weekly application lists;
- hand-reconcile approximately 300–600 council records against the Plota census;
- classify every unexplained miss and resolve field disagreements against the council
  record;
- retain the labelled reconciliation as the baseline evaluation set.

Track:

- council-record coverage and lag;
- census recall in audited periods;
- intelligence-limb precision and recall;
- high-relevance precision and recall;
- proposed-brand association precision;
- dwelling and floorspace extraction accuracy;
- Development grouping precision;
- enrichment rate and cost;
- Plota requests per month;
- human correction rate.

Initial user-facing targets:

- at least 95% census recall in the manually audited authority-period samples;
- at least 98% recall for records that should satisfy intelligence limbs A-D in those
  samples;
- at least 95% precision for high-relevance results;
- at least 90% recall on labelled high-relevance records;
- at least 95% precision for proposed-brand associations;
- no proximity-only automatic merges;
- evidence for every enriched fact;
- less than $20 monthly LLM spend;
- fewer than 15,000 monthly Plota requests.

## Delivery plan

### Gate 0: commercial and technical confirmation

Before production subscription or broad ingest:

1. obtain written confirmation that Starter permits the intended nationwide filtered
   storage and paid-product presentation;
2. confirm saved-alert support for the desired filters;
3. re-verify on the purchased Starter key that search responses contain `status`, `stage`,
   `decision`, decision dates, key dates and `documents_count`. These fields were already
   confirmed with a live Demo search on 8 September 2026; do not spend another Demo request;
4. confirm the `/councils` coverage metadata exposed to Starter;
5. select the full current census if permitted by the licence, otherwise use the reduced
   commercial/residential census;
6. approve limb C activation only after the 200-record precision test;
7. confirm PlanNexus Free's internal evaluation usage terms and select
   the fixed five-council patch.

### Phase 1: evaluation harness

- import the Kent sample as the initial test corpus;
- add primary-council samples covering adverts, shopfronts, losses and small Class E moves;
- manually reconcile two authorities × two months of published weekly lists, covering
  approximately 300–600 records;
- define the classification and evidence schemas;
- label difficult cases;
- evaluate inexpensive and reviewer models;
- set confidence thresholds;
- add the isolated PlanNexus sidecar for QA only;
- manually collect documents for 20–30 applications to validate document ranking before
  building an adapter.

### Phase 2: national census ingestion

- implement the search-first, resumable ingestion path;
- add raw/thin census storage and per-authority coverage;
- backfill the preceding 12 months nationally, throttled around the operational reserve;
- implement deterministic limbs and brand aliases;
- add request and source-freshness monitoring;
- add webhooks only after search ingestion is stable.

### Phase 3: Development intelligence

- create Development, application relationship, observation and brand-signal tables;
- implement explicit associations and conservative grouping;
- add Stage 1 classification and review queues;
- add PostGIS boundary queries;
- calculate initial brand expansion rollups.

### Phase 4: staged enrichment

- inspect council-page metadata for high-value records;
- implement one priority portal adapter;
- add stage-aware document extraction;
- add capped web research;
- evaluate evidence accuracy before increasing volume.

### Phase 5: surface-by-surface migration

1. move the Planning tab to stored census records and Developments;
2. add Assess Area and Find Gaps analytics;
3. migrate planning alerts to stored spatial queries;
4. add high-confidence Development associations to brand modals;
5. add comparative brand expansion views;
6. remove PlanIt and PlanNexus code after each dependent surface has migrated and passed
   primary-source audit, retaining only the isolated PlanNexus QA adapter if its value
   justifies it.

National ingestion begins in Phase 2. Enrichment expands gradually by portal technology;
these are separate rollout dimensions.

## Upgrade triggers

Upgrade from Starter only when observed behaviour requires it:

- request usage repeatedly exceeds the 15,000 internal ceiling;
- rotating batch refresh cannot meet promised freshness;
- missing change events produce material user-facing errors;
- a reliable nationwide decisions feed becomes necessary;
- the contact-data add-on has proven value exceeding its cost;
- Plota requires another plan for the intended licence scope.

## Open product decisions

1. Does Plota's written licence permit the preferred full current-application census on
   Starter, or must the reduced commercial/residential scope be used?
2. After limb C clears its precision target, should it immediately affect every user-facing
   surface or launch first as a reviewed brand signal?
3. Which commercial losses should surface as individual Developments versus area-level
   statistics only?
4. What freshness promise should appear in the product?
5. What evidence/confidence threshold confirms a proposed brand association?
6. Should brand acquisitiveness be displayed as raw signals, a ranked score, or both?
