# Claude Design brief: integrating `/find-sites` into SiteMatcher

## The assignment

Explore how the new `/find-sites` capability should fit into SiteMatcher as a product, navigation system, and end-to-end workflow. Do not assume that the current standalone page or its current place in the architecture is correct.

Produce **three meaningfully different product-design directions**. They must differ in mental model, entry point, and relationship to the rest of SiteMatcher—not merely in colour, card styling, or panel arrangement. Make a clear recommendation after comparing them.

This is a design exploration, not a production implementation. Work in concepts or a separate prototype; do not modify production code.

## Product context

SiteMatcher helps UK commercial property professionals move from market opportunity to a viable site and then towards a deal.

The current unified workspace is built around one map and currently exposes these modes in the left rail:

- **Assess Area** — drop a point, define a catchment, and understand the local brand, demographic, traffic, planning, and requirement landscape.
- **Find Gaps** — identify towns/built-up areas that fit a location strategy, mainly using brand/category presence, proximity, and population.
- **Sketch Site** — test a scheme on a specific plot in 2D/3D, including building plans, boundaries, measurements, and parking.
- **Directory** — browse brands, requirements, agents, contacts, estates, and targets.

The intended product story is “one map, one selection, one workflow,” with users progressively narrowing their focus:

`UK market → town/opportunity → candidate parcel → local evidence → site layout → output/action`

The open question is what role **Find Sites** should play in that system.

## What `/find-sites` does today

The current route is a gated, Plus-only experiment, outside the unified workspace and limited to real Canterbury data. It is intentionally described as broad-brush prospecting rather than due diligence.

Its current flow is:

1. Choose one of four example acquisition briefs: small drive-thru, roadside/commercial, larger retail/leisure, or industrial/logistics.
2. Optionally choose a brand and a minimum distance from its existing estate to reduce cannibalisation.
3. Search registered land parcels against measurable criteria.
4. Review a map and ranked shortlist grouped into **Strong**, **Potential**, and **Worth reviewing** signals.
5. Open a parcel to inspect area, apparent land use, roads, traffic, frontage, junction proximity, distance from the brand estate, constraints, confidence labels, and a passed/partial/failed/unknown criteria breakdown.

The product must never imply that a result is available, developable, commercially viable, or definitively suitable. The parcel is a registered freehold extent, not necessarily the development plot. Availability, lawful access, planning consent, and commercial viability remain unknown and must be investigated.

Important current implementation references:

- Existing Find Sites UI: `apps/web/src/app/find-sites/`
- Search contract: `apps/web/src/lib/site-matching/find-sites-dto.ts`
- Example briefs: `apps/web/src/lib/site-matching/requirement-presets.ts`
- Unified workspace shell: `apps/web/src/app/sitematcher-unified/`
- Unified workspace design handoff: `docs/design_handoff_unified_workspace/README.md`
- Current visual references:
  - `docs/design_handoff_unified_workspace/screenshots/01-assess-empty.png`
  - `docs/design_handoff_unified_workspace/screenshots/02-find-gaps.png`
  - `docs/design_handoff_unified_workspace/screenshots/03-summary-tab.png`
  - `docs/design_handoff_unified_workspace/screenshots/05-requirements-tab.png`
  - `docs/design_handoff_unified_workspace/screenshots/06-sketch-launcher.png`

Treat the current code and screenshots as the source of truth where older design documentation differs from the live workspace.

## The core design problem

Find Sites is adjacent to several existing jobs but is not the same as any of them:

- **Find Gaps** finds promising markets/towns; **Find Sites** finds candidate land parcels.
- **Directory/Requirements** explains occupier demand; **Find Sites** can turn an acquisition brief into a parcel shortlist.
- **Assess Area** evaluates the landscape around a location; **Find Sites** screens many parcels before deeper evaluation.
- **Sketch Site** tests physical fit on a chosen plot; **Find Sites** should create a natural handoff into that deeper work.

Resolve these questions through the concepts:

1. Is Find Sites a new top-level mode, a stage inside Find Gaps, a requirement-led workflow, a cross-product action, or something else?
2. Where can a user enter it—from the workspace rail, a selected town, a brand/requirement profile, a saved requirement, the dashboard, or several contextual entry points?
3. What is the primary object the user is working on: an acquisition brief, a search, a shortlist, a parcel, or a project?
4. How does context carry forward so users do not repeatedly choose the same brand, geography, catchment, and criteria?
5. What should happen after a parcel is shortlisted: save, compare, assess, sketch, export, share, investigate ownership/contact, or create a project?
6. How should the UI distinguish screening evidence, missing data, warnings, and hard failures without turning an internal score into a false “suitability percentage”?
7. How can the product remain usable when the search expands beyond Canterbury to national data and potentially thousands of parcels?

Potential structural hypotheses worth testing include a fifth workspace mode, a progressive “Find Gaps → Find Sites” drill-down, and a requirement/project-led acquisition journey. These are prompts, not prescribed answers; replace them if stronger models emerge.

## Exploration process

Apply the approach in Anshu Chimala’s article, [“How to turn your AI into a world-class designer”](https://www.lennysnewsletter.com/p/how-to-turn-your-ai-into-a-world): diverge broadly, give each direction a distinct identity, use an independent critic, then remove anything that does not earn its place.

### 1. Discover: go broad before going deep

- Inspect the referenced product flows, screens, tokens, and components first.
- List at least 10 terse integration models before choosing three to visualise. Vary the product architecture, not just the UI.
- To avoid default AI patterns, generate a fresh long random alphanumeric seed for each selected direction and use it privately to provoke a different compositional idea. Do not expose the seed in the product or let it override SiteMatcher’s brand system.
- Give each selected direction a concise design thesis and a deliberate interaction metaphor. Be ambitious, but keep the tool credible for commercial property work.

### 2. Define: make three directions genuinely distinct

For each direction, show the connected journey—not an isolated happy-path screen:

1. Entry/discovery state and navigation placement.
2. Acquisition-brief setup or reuse.
3. Search in progress and/or progressive result disclosure.
4. Map plus shortlist results at national/area/parcel scale as relevant.
5. Selected-parcel evidence and confidence state.
6. At least one incomplete-data, no-results, or warning state.
7. The next-step handoff into the wider product, such as Assess Area, Sketch Site, Directory/contacts, compare, save, or export.

For each concept, explain:

- The user mental model in one sentence.
- Its primary persona and job to be done.
- What changes in the product’s information architecture.
- How it connects to Find Gaps, Assess Area, Directory/Requirements, and Sketch Site.
- What context persists between stages.
- The most important advantage, drawback, and implementation risk.
- What would need to be true for this direction to win.

Use realistic commercial-property labels and data. Do not use lorem ipsum, invented certainty, generic dashboard metrics, decorative charts, or features unsupported by the current product without labelling them as future concepts.

### 3. Critique and refine

After the first pass of each direction:

- Capture the key screens and give them to a fresh design-critic context with no code or prior rationale.
- Ask the critic to judge the concept against the supplied SiteMatcher screenshots and these criteria: product comprehension, workflow continuity, decision usefulness, evidence honesty, visual hierarchy, interaction economy, accessibility, and resistance to generic “AI-designed dashboard” patterns.
- Require tight, specific criticism at both composition and detail level, plus a score out of 10.
- Run no more than two refinement passes per direction. Stop when the critique is no longer converging; do not polish a weak product model indefinitely.

### 4. Deliver with restraint

- Remove explanatory copy, cards, pills, gradients, glows, and containers that do not help the next decision.
- Prefer the existing SiteMatcher primitives and design tokens over novel component chrome.
- Avoid obvious AI tells: excessive rounded cards, every section in a container, gratuitous violet gradients, fake analytics, ornamental microcopy, crowded badges, and animation without task value.
- Use motion only where it clarifies the change of scale or preserves continuity between a town, shortlist, parcel, and downstream task.

## Visual and interaction guardrails

- Preserve the current SiteMatcher language: warm off-white background, white surfaces, restrained borders, near-black ink, violet as the primary accent, orange for traffic, and green/amber/red/grey only where meaning requires them.
- Use Inter for UI and JetBrains Mono for kickers, units, and compact data labels.
- Keep the map as the principal working surface when geography is central; panels should support map decisions rather than turn the experience into a generic dashboard.
- Desktop web is the primary design target. Use a 1440×900 reference viewport, then explain the responsive strategy for narrower laptop widths. Do not hide essential evidence behind hover-only interactions.
- Meet WCAG AA contrast, full keyboard operation, visible focus, and reduced-motion preferences.
- Make uncertainty legible through wording, provenance/confidence, and hierarchy—not only colour.
- Keep **Strong / Potential / Review** as ordered screening signals, never percentages or definitive recommendations.
- The persistent caveats must remain available without dominating every moment of the workflow.

## Required output

Deliver:

1. A short map of the current product architecture and the opportunity you see for Find Sites.
2. The broad list of integration models considered.
3. Three high-fidelity, substantially different concepts with the connected states above.
4. A side-by-side comparison covering comprehension, continuity, flexibility, scalability, evidence integrity, and likely implementation complexity.
5. Your recommended direction—or a clearly explained hybrid—with the key reason it best advances the “market → parcel → assessment → scheme” journey.
6. The critic’s first score, the changes made, and the final score for each direction.
7. A concise list of product questions or data constraints that should be validated before implementation.

Do not begin production implementation. The goal is to make the architectural choice visible enough that the team can select a direction with confidence.
