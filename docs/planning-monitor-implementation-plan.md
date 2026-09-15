# Planning Monitor — implementation plan

Date: 15 September 2026

## 1. Outcome and scope

Add **Planning** as a mode inside `/sitematcher-unified`. Users can explore UK planning applications, save a geographic patch and criteria, watch developments, and receive a weekly, source-linked AI briefing in the application and by email.

Build the Monitor and Set Criteria screens from `design_handoff_planning_monitor`. Deliver Market Change later, when its projection inputs are available. This follows the existing delivery plan's decision to defer Market Change and spend modelling.

**Launch scope, updated after product feedback:** use-class, site-area, floorspace and operator coverage is currently insufficient for dependable filtering. Launch the Monitor, patches, weekly AI briefing and email using the core planning record. Improve enrichment and introduce those filters as a separate follow-on; they are not launch dependencies. The first-release design should feel complete with only the available controls.

### Proposed product defaults

- Start in **My patch** when a saved patch exists; otherwise start in **All UK** with a prominent “Create your patch” action.
- Confirmed scope: **commercial proposals or residential schemes with 15+ dwellings**, replacing the illustrative 50-home threshold in the handoff. Users may raise the residential threshold above 15; mixed-use schemes can satisfy either branch.
- **All UK changes geography only.** The user confirmed that neither view should offer unrestricted browsing of smaller residential or unrelated applications. Enforce this base eligibility rule server-side, independently of optional filters and AI research eligibility.
- Support multiple named patches in storage and a simple active-patch selector. Start with one criteria set and one weekly briefing per patch; team sharing and multiple saved searches per patch can follow.
- Weekly email is an explicit preference in “Save & monitor”. Proposed schedule: Monday at 08:00 Europe/London, covering the previous Monday–Sunday.
- Treat the map's date window and the weekly briefing period as separate controls. Changing the viewport or temporarily browsing All UK must not change a saved patch's subscription.
- “Watch” follows a development and its related applications. Include watched changes in a clearly separate section of the patch digest even if they later fail its filters.

## 2. What already exists, and what needs extending

This assessment is based on checked-in code and repository documents, not a fresh production database or deployment audit. Earlier plans contain historical descriptions of gaps that later code addresses; verify deployed migrations and pilot results before rollout.

| Area | Existing foundation | Implementation work |
| --- | --- | --- |
| Workspace | Next.js, React, Zustand, Mapbox; Assess, Find, Sketch and Directory modes; server-side Plus access gate | Add `planning` mode, state, panel and map layer; preserve existing mode behaviour |
| Planning data | Stored Plota census, ingestion/refresh workers, freshness reporting, classification and admin review | Verify current national coverage and operational freshness; build Monitor reads from this store |
| Existing Planning tab | Boundary query, relevance ranking, linked-development UI, source/approximate-location labels | Reuse its commercial/15+ eligibility contract; replace the 2,000-record read cap with scalable national map queries and pagination |
| Enriched facts | `development_facts` supports operator, existing/proposed use classes and floorspace, net floorspace, site area, evidence and review decisions, but coverage is insufficient | Follow-on: improve coverage, validate it, then expose resolved values as indexed filter fields. No required enrichment joins or completeness gate for launch |
| Development families | Linking and fact-precedence code plus a documented pilot | Verify pilot acceptance before national grouping and aggregate dwelling totals; keep unresolved families visibly unresolved |
| Alerts | PlanNexus-based monthly POC, patch geometry, immutable reports, Resend email, monthly cron | Add self-service criteria, stored-Plota weekly selection, AI, reliable delivery and unsubscribe |

**Reuse the current planning store.** Map browsing and weekly digests should not issue separate provider searches for every user. The monthly service still uses PlanNexus even though a later migration permits `plota` in alert-run records.

**Keep the existing pilot as the gate for scaling paid research.** A weekly summarisation feature does not require researching every national record again.

**Missing enrichment must not exclude a qualifying application.** Base eligibility uses the existing commercial/15+ homes contract. Commercial records do not need a known use class, area or operator to appear. Family grouping and dwelling-count correctness still need validation, but completing operator/area research is not a prerequisite for publishing a core record.

## 3. User experience and filter contract

### Monitor

- Add a Planning rail item and show the scope toggle, patch selector, weekly summary card, criteria chips and application list alongside the map.
- Recreate the supplied panel, card, chip, marker, cluster and popover styling using existing components and tokens. The handoff's 72px header/rail differs from the current shell; retain the shared shell dimensions and target the 426px Planning panel at suitable desktop widths.
- Use the existing Mapbox integration with a dark basemap for Planning; restore the appropriate style when leaving the mode.
- Keep map/list hover and selection synchronised. Anchor the popover beside its marker and adjust it at viewport edges. “View application” opens the existing detail experience, with the council source link available there; “Watch” persists independently of selection.
- At national zoom, show server-generated clusters. At local zoom, show individual records or verified development groups. Never download the national dataset into the browser.
- Offer “Developments / Applications”; label counts explicitly, such as “18 developments · 31 applications”. Both presentations retain base eligibility. Include qualifying records without AI classification or development membership; related paperwork remains accessible in the development history.
- Show patch-wide totals separately from “in this map view”. Cluster counts must use the same counting unit as their current grouping mode.
- First-release rows and popovers focus on address, proposal description, commercial/residential type, status, dates, known dwelling count and source link. Use residential/commercial markers and estate markers; omit the handoff's amber operator-linked category and its legend entry until that feature is available. Mixed-use records appear once and retain both type labels.
- Omit empty enrichment cards, operator-watch tags and unsupported controls from the main experience. Existing sourced facts may still appear in application details when present, but are optional context and never a requirement to render a row, marker or summary.
- Provide loading, empty, stale/partial coverage, request failure and missing-location states. Approximate markers need a distinct treatment and textual label, not colour alone.
- On small screens use a Map/List switch or bottom sheet; use a full-screen criteria form with sticky actions. Support keyboard selection, visible focus, accessible labels, modal focus trapping and touch patch editing.

### Patch and Set Criteria

Draw a Polygon/MultiPolygon, upload GeoJSON, or search for an area. Search should select a known administrative boundary where available; a town/postcode point needs an explicit radius and must be labelled as a radius, not an administrative boundary. Add KML/shapefile import later if requested.

Validate uploads and drawings server-side: coordinates, closed rings, topology, holes, vertex count and payload size. Preserve an exact saved geometry; use a separate simplified geometry for display when needed. Search/index boundary data availability is a Phase 1 dependency.

Edit a draft copy in the modal. Debounce the match count, cancel stale requests, and commit patch geometry plus criteria atomically on “Save & monitor”. Cancel restores the saved state. Saving zero matches is valid. Criteria changes create a new revision, leaving old emailed reports intact.

For the first release, keep the handoff's patch editor and modal structure but reflow the form around **Location, Store proximity, Application type, and Dates & status**, with keywords/watched-only as simple refinements. Omit use class, site area, floorspace, detailed commercial sector and operator/brand-watch controls entirely; do not leave disabled fields or an empty fifth step. Add future groups within the same scrolling form when ready.

| Filter | Behaviour and delivery |
| --- | --- |
| Residential | First release: minimum dwellings, default 15, with presets such as 15/50/100 and a custom value of at least 15. Show count provenance |
| Commercial | First release: new premises, extensions, change to/between commercial uses and commercial loss, following the existing Planning tab's scheme contract |
| Commercial category | Follow-on: retail/foodstore, restaurant/café, takeaway/drive-through, industrial/logistics, office, leisure, hotel, healthcare and other/unknown. Launch with broad commercial/residential selection; validate detailed sector coverage before adding it |
| Use class | Follow-on: existing/proposed selector and multi-select. Preserve original class, nation and historical context; add a reviewed cross-nation category mapping rather than treating “E/A1” as a universal UK label |
| Site area | Follow-on: min/max; hectares/acres display with square metres stored. Only use site-area evidence, never a postcode footprint or invented boundary |
| Floorspace | Follow-on: min/max; sq ft/sq m display. Default proposed commercial floorspace; allow existing/net where supported. Preserve gross/net measurement basis and whole-site versus unit/phase extent |
| Dates | Received, validated, decided or materially updated; 7/30/90 days, this year, all available history and custom ranges. Default browsing window: received in the last 30 days |
| Status and procedure | Multi-select pending/approved/refused/withdrawn/other; full/outline/reserved matters/change of use/prior approval and follow-on paperwork. Retain the council's original wording |
| Geography | Patch, nation, local authority, town/postcode search |
| Store proximity | First release: one or more selected brands/estates and a radius in miles/km, using existing store locations. This does not require knowing the application's operator. Initially straight-line distance; travel-time proximity is a later feature |
| Brand involvement | Follow-on: confirmed/evidenced versus inferred proposed operator/occupier. Separate from existing-store proximity. Developers, former occupiers and neighbouring brands must not be presented as incoming occupiers |
| Useful refinements | First release: keyword include/exclude, new versus changed, watched only and source precision. Later: enrichment confidence, consultation deadline or permission expiry where sourced |

Use class and commercial category are different dimensions: one is the source's planning classification, the other helps a property user describe the kind of opportunity. The schema must retain jurisdiction; official Welsh guidance describes its own use-class categories. [GOV.WALES](https://www.gov.wales/planning-permission-use-classes-change-use).

### Exact matching rules

- OR within a multi-select; AND between independent filter groups. Residential and commercial are alternative branches. A 15-home threshold must not accidentally exclude a standalone commercial proposal.
- At launch, apply dwelling constraints to the residential branch and geography, dates and status to the combined result. Mixed-use records appear once. When introduced later, commercial category/floorspace constraints apply to the commercial branch and site area to the combined result.
- Missing use class, area or operator has no effect on launch eligibility, counts or default ranking. In the follow-on, an unset filter means no restriction; an active site-area/floorspace filter offers “Also show unknown size”, separately counted. This cannot bypass base eligibility: a residential-only scheme with an unknown dwelling count does not qualify as 15+ homes. Preserve conflicting/unavailable facts and their reasons; do not invent counts to make an application qualify.
- Recommended geography: My patch uses the patch boundary; optional proximity narrows it to applications also near the selected stores. All UK removes only the patch boundary, retaining the selected brands and other filters. Estate highlighting can be enabled without making it a filter.
- This intersection rule differs from the monthly POC, which also includes buffers extending outside the patch. Preserve that legacy behaviour during migration unless the user explicitly chooses the new rule.
- Use current uncertainty-overlap logic consistently for approximate locations; show confirmed spatial matches separately from “may be in this area”. Do not quote precise nearest-store distances for centroid locations.
- Follow-on only: operator/brand-watch tags highlight matching applications by default; “Only these brands” is an explicit restrictive filter. Watching an individual development is a separate feature and remains available at launch.
- Human-reviewed facts, including a correction to unknown, remain authoritative. Reuse the existing fact-resolution rules; do not create a competing source/model precedence rule in the Monitor.

## 4. Architecture and persistence

### Client integration

Extend `WorkspaceMode`, `URail`, `UnifiedWorkspace` and `UnifiedMap`. Add a dedicated planning store for scope, active patch, draft/applied criteria, grouping, selection, viewport and summary state. Saved definitions belong in the database; transient map state belongs in Zustand and shareable non-sensitive URL state.

Proposed components: `PlanningMonitorPanel`, `PlanningCriteriaModal`, `PlanningPatchEditor`, `PlanningMapLayer`, `PlanningApplicationPopover`, `PlanningSummaryCard`, and `PlanningNotificationSettings`. Reuse `UPlanningModal`, development-history presentation, brand selectors and available drawing primitives. Isolate patch drawing from Sketch mode's editor state and keyboard handlers.

### Shared server query layer

Create `src/lib/planning-monitor/` with a versioned Zod criteria schema, normalisation and a query service using existing core record fields and dwelling-count resolution. Add the advanced resolved-fact projection in the enrichment follow-on. Execute filtering in PostGIS **before** pagination or aggregation.

### Adding filters later without breaking saved patches

- Keep criteria versioned and define extension points for use classes, site area, floorspace, commercial category and operator IDs. Their absence means **no restriction**, never a requirement that a fact exists. Do not require their extraction or indexed projections to build v1.
- Publish server-owned filter capabilities to the UI. Initially expose only core filters; introduce advanced groups individually after coverage and accuracy are measured. Gate both the controls and the API predicates, rather than hiding controls while accepting unsupported filters.
- Reject attempts to save an unavailable active filter with a clear validation error; do not silently ignore it. If an enabled filter is later withdrawn, flag affected saved criteria and pause their scheduled reports until resolved rather than silently broadening them.
- When a capability becomes available, existing criteria continue to match identically until the user chooses it. Background enrichment may improve optional details but must not auto-enable filters or rewrite historic digest snapshots.
- Make enriched response fields optional and keep launch queries independent of those rows. Any optional joins must preserve qualifying records with no enrichment. Use the same capability/version rules for query, count and digest selection.

Proposed authenticated endpoints:

- `/api/planning-monitor/query`: viewport clusters or paginated rows, match totals, uncertainty counts and freshness.
- `/api/planning-monitor/count`: same predicate with a lightweight count response for draft criteria.
- `/api/planning-monitor/patches` and `/patches/[id]`: owned patch/criteria CRUD and notification preferences.
- `/api/planning-monitor/watches`: watch/unwatch a development.
- `/api/planning-monitor/digests/[id]`: immutable report; `/patches/[id]/digest` reads the latest status/report.

Use spatial indexes, indexes on core dwelling/status/date fields, cursor pagination and bounded cluster payloads. Add advanced numeric/use-class/operator indexes in the follow-on. Cache using normalised criteria, capability version, scope/geometry, zoom or tile, data revision and estate revision. Authorise before cache access and prevent cached private patch data crossing users. Benchmark low-zoom clusters on the actual national store; introduce vector tiles only if the measured query approach needs them.

The query contract should return a criteria hash and dataset revision so the list, count and clusters can identify stale responses. Weekly selection shares the non-temporal predicate and fact-resolution code; it deliberately applies its own change window rather than the map's received-date window.

### Proposed new tables

| Table | Purpose |
| --- | --- |
| `planning_monitor_patches` | Owner, name, exact geometry, current criteria/version, active state and geometry provenance |
| `planning_monitor_patch_revisions` | Immutable geometry/criteria revisions for reproducible reports |
| `planning_monitor_subscriptions` | Patch, recipient user, timezone, cadence, enabled state, next due time and cancellation state |
| `planning_monitor_watches` | User/patch plus development identity, with uniqueness and a policy for later family merges |
| `planning_change_events` | Application/development, material before/after values, provider time, observed time and stable event identity |
| `planning_monitor_digest_runs` | Patch revision, period, source cutoff, frozen input/evidence, structured summary, model/prompt version, usage and generation status |
| `planning_monitor_deliveries` | Run/recipient, stable delivery key, provider message ID, attempts and delivery state |

Keep these weekly records separate from the monthly POC to preserve existing report URLs and semantics. Reuse email/report utilities where useful. Make `(subscription_id, period_start, period_end)` unique for scheduled runs; snapshot the revision when claimed so a mid-run edit cannot generate a second weekly email. Store initial preview reports separately from scheduled sends.

Apply owner-based row-level security, matching API checks and the workspace's Plus entitlement checks. Workers use service-role access only on the server and recheck subscription eligibility before sending. Report links require authentication initially; signed unsubscribe links are scoped to disabling that subscription.

## 5. Weekly AI briefing and email

### Practical workflow

1. **Keep data current centrally.** Use the existing ingestion/refresh pipeline. Add durable material-change events in the same transaction as relevant data changes; repeated polling with no change produces no event. Include core dwelling-count corrections; add advanced enrichment event types in the follow-on.
2. **Schedule small jobs.** A frequent scheduler claims due subscriptions and enqueues generation. Calculate Monday 08:00 in Europe/London with daylight-saving handling; store actual UTC period boundaries. Do not run all users sequentially inside one long request.
3. **Freeze an input snapshot.** Include newly observed applications, decisions, withdrawals and meaningful proposal changes within the reporting period. Include an older application approved this week even if its received date is outside the map's window. Record late discoveries as “newly found”, with their original dates. Add newly established operator evidence as a change category in the follow-on.
4. **Separate monitoring changes.** A criteria/estate edit can make an old application newly relevant without the application changing. Show that separately from new planning activity. A first report is explicitly an initial snapshot; do not present the entire historic backfill as this week's submissions.
5. **Deduplicate by verified development.** Calculate application/development counts and known dwelling totals in code with existing authoritative-fact rules. Parent permissions, amendments and discharges cannot each add the same homes. Do not produce patch-wide floor-area or operator-coverage totals at launch. Unresolved families do not contribute confident combined capacity totals.
6. **Prepare evidence packets.** At launch, supply proposal descriptions, dates/status changes, known dwelling counts, source IDs/URLs, precision and relevant existing-store context. These are sufficient for a useful briefing. Researched size/use-class/operator fields are optional future inputs; their absence must never prevent generation or trigger fresh web/document research.
7. **Summarise with a powerful model.** Use a separately configured high-capability model through the existing model-provider integration. Select its exact model/version by evaluation at implementation time. For large patches, summarise bounded groups with source IDs and synthesise them; calculate full totals outside the model and disclose highlights omitted from the short narrative.
8. **Validate and save.** Require structured output with overview, key changes, residential/commercial themes, watched changes, evidence references and caveats. Validate IDs, numbers and allowed claims before publishing. At launch, do not infer an operator, use class or area to fill a data gap, or require operator-based themes. Reject unsupported growth/spend claims. Treat application text as untrusted source material, not model instructions.
9. **Display and deliver the same report.** The patch card shows the saved summary, period and generation date. The email uses that same summary, deterministic counts, top linked applications and “Open full patch report”. The report opens the frozen snapshot; “View current map” is a separate action.

Suggested briefing length: 150–250 words plus up to five highlights. Focus on **what changed, why it matters to this patch, and which source supports it**. An approved proposal is not a completed building. A useful launch briefing can describe a residential approval, a new commercial proposal and their proximity to existing stores without knowing the commercial scheme's operator or size. When operator inference is introduced later, it must remain explicitly labelled in every surface.

### First use, editing and failures

- On first save, enqueue an initial in-app summary in the background. Show “Preparing your first briefing”; the map remains usable. Show the next scheduled email date.
- After criteria changes, mark the previous summary with its old revision/date and offer one debounced replacement preview; do not repeatedly call the model as filters change.
- No qualifying changes: generate a factual “No matching changes this week” report without a model call. Send that short weekly email by default, with an optional skip-quiet-weeks preference.
- Model failure: retry with bounded attempts, then send a deterministic source-linked digest clearly stating that the AI summary is unavailable. Do not recycle old prose as this week's summary.
- Data failure: display and report the known coverage gap. Delay generation for a bounded recovery window, then issue a labelled partial report if needed; never translate failed ingestion into “no changes”.
- Store token/cost usage and latency. Add per-run and global budget caps; cache evidence preparation by development revision. Establish cost per patch-week in the pilot before committing to pricing or unlimited usage.

### Reliable delivery

Use the existing Resend integration with a durable delivery ledger, job leases, retries/backoff, provider message IDs, bounce/complaint handling and a stable idempotency key per run/recipient. The current check-then-send monthly loop is insufficient protection against concurrent workers or a crash after provider acceptance.

Resend retains idempotency keys for 24 hours. Keep the database ledger longer and reconcile an ambiguous send before retrying beyond that window. [Resend documentation](https://resend.com/docs/dashboard/emails/idempotency-keys).

Include HTML and plain text, reporting dates, coverage status, manage-preferences and unsubscribe links. Unsubscribe disables future delivery without deleting a patch or its reports. Disable the migrated monthly subscription when weekly delivery is activated to prevent overlapping emails; keep all old monthly reports accessible.

Plota documents `changed_since` and distinguishes content changes from routine `updated_at` rechecks. Assess this feed against the actual account entitlement and existing refresh lanes; do not assume it covers archived records. It can improve central ingestion but does not replace the local event ledger, which also captures reviewed facts and late observations. [Plota API documentation](https://plota.co.uk/api-docs).

## 6. Delivery sequence and acceptance gates

| Phase | Work | Exit condition |
| --- | --- | --- |
| 1. Core data and contracts | Confirm deployment/coverage, core eligibility, family/count correctness, proximity rules and searchable boundary sources. Specify v1 criteria and weekly events | Representative samples from all four nations; agreed matching behaviour using core fields. Enrichment completeness is not a launch gate |
| 2. Query and persistence | Add patch/revision tables, access policies, core-field queries, filter capabilities, paginated/cluster/count endpoints and change ledger | Map/list/count use the same predicate; correct results beyond 2,000 records; zero enrichment rows does not break the flow; cross-user access denied; material changes replay without duplicates |
| 3. Monitor and criteria | Add mode, national map, patch creation, core filter form, popovers, watches and responsive states | Users can save, reload and edit patches, browse All UK, and select any result with enriched fields absent; existing modes still work; visual checks against the deliberately simplified handoff screens |
| 4. Weekly briefing | Queue, immutable snapshots, source packets, model evaluation, summary card, report history and deterministic fallback | Initial and weekly reports work; old applications with new decisions appear; all claims trace to evidence; duplicate family counts eliminated |
| 5. Email and pilot launch | Weekly scheduling, Resend delivery ledger, preferences, unsubscribe, POC migration and operational dashboards | One email per scheduled run under concurrency/retries; preview matches email; daylight-saving and unsubscribe checks pass; pilot users complete two weekly cycles |
| 6. Enrichment and advanced filters | Improve use-class, site-area, floorspace, commercial-sector and operator extraction/research/review; measure coverage and accuracy; add indexed fields and activate controls individually | Each released filter has acceptable measured quality, provenance and explicit unknown handling; enabling it leaves existing patches unchanged until users opt in |
| 7. Market Change | Separate data/model work, then the third handoff screen | Projection prerequisites below are met; supported outputs carry provenance and assumptions |

Launch dependency chain: **core data contract → query/persistence → Monitor → briefing → weekly email rollout**. Change-event capture should begin in Phase 2 so the first weekly pilot has real before/after history. **Enrichment and advanced filters are a separate follow-on, not on this launch path.** Their research work can proceed independently, but the map, patch setup, summary and emails must all work before it is complete.

### Essential validation

- Launch query fixtures: 14/15/50 dwellings; commercial-only and mixed-use schemes; unknown/conflicting dwelling counts; patch holes and boundaries; no-estate case; approximate points; more than 2,000 matches.
- Missing-enrichment acceptance: run map → patch save → count → initial summary → weekly digest → email with all use-class, site-area, floorspace and operator fields absent. Qualifying core records still appear, counts agree, no unsupported controls render, and summaries make no invented claims. Existing-store proximity still works.
- Extension compatibility: v1 criteria retain their meaning when later capabilities are enabled; future fields default to no restriction; unsupported active filters are rejected. Follow-on tests cover existing/proposed floorspace, units, nation-specific classes, operator roles and unknown/conflicting advanced facts.
- Count agreement: same criteria/data revision yields the same application and development totals across list, map and preview. Compare weekly selection against equivalent event-period filters, not the map's default received-date filter.
- Watch/family fixtures: a parent and five follow-ons contribute capacity once; family merges preserve watches; a new condition does not imply a new permission.
- Weekly fixtures: old application/new approval; late arrival; review-only change; criteria edit; empty week; source outage; model failure; duplicate jobs; crash after email acceptance; daylight-saving transition; unsubscribe before send.
- UI checks: national → patch → edit → save/cancel → selected row/pin → report; mobile layout, keyboard access and all existing workspace modes.
- Initial performance targets to validate in Phase 2: p95 normal viewport response under 1.5 seconds and debounced count under 1 second, with explicit pending states for expensive nationwide counts. Measure cold/warm national views and dense urban patches before accepting the targets.

Roll out behind separate flags for Planning mode, AI generation and weekly sending. Start with internal/test recipients, then a small opt-in pilot. Monitor source freshness by nation, query latency, queue age, invalid-summary rate, evidence coverage, cost per digest and delivery failures. A send kill-switch must leave map browsing and saved reports usable.

## 7. Market Change prerequisites

Keep this as a later, separately estimated milestone. The illustrative mockup's residents, completion years, footprint rectangles and grocery spend cannot be derived reliably from a dwelling count alone.

Required inputs: deduplicated **net additional** homes, sourced site geometry, current population baseline for the same geography, delivery/completion evidence and explicit occupancy assumptions. Show scenarios or ranges where justified, and source each assumption. Replacing 20 homes with 30 contributes 10 additional homes, not 30.

Until ready, omit the Market Change toggle and impact panel; clusters simply zoom. Do not display artificial footprints or annual delivery charts. Where only gross proposed dwellings are known, label that capacity directly without presenting it as population growth. Spending projections remain out of scope under the existing delivery plan and require a separate methodology decision.

## 8. Implementation starting points

- Design: `docs/design_handoff_planning_monitor/README.md`, its three screenshots and HTML sections `1a`, `1acrit`, `1azoom`.
- Shell: `apps/web/src/app/sitematcher-unified/components/UnifiedWorkspace.tsx`, `components/shell/URail.tsx`, `components/map/UnifiedMap.tsx`.
- State/types: `apps/web/src/app/sitematcher-unified/lib/stores/unified-workspace-store.ts`, `types/unified-workspace.ts`.
- Existing reads/details: `apps/web/src/app/api/public/planning/`, `lib/services/planning-service.ts`, `components/shell/UDetailModals.tsx` within the workspace.
- Data/evidence: `apps/web/src/lib/planning-intelligence/`, especially `facts.ts`, `ingest.ts`, `freshness.ts`, family membership and research modules.
- Monthly POC: `apps/web/src/lib/planning-alerts/`, `apps/web/src/app/api/cron/send-monthly-planning-alerts/route.ts`, `apps/web/vercel.json`.
- Prior decisions: `docs/plota-planning-delivery-plan.md`, `docs/planning-development-linking-plan.md`, `docs/planning-pilot-completion-plan.md`.

This plan proposes implementation work only; no application code, database state, schedules or email subscriptions were changed.
