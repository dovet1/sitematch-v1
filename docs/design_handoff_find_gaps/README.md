# Handoff: Find Gaps — "Two Buckets" filter (Direction F)

## Overview
**Find Gaps** is a SiteMatcher feature that helps a retail/expansion analyst answer one question: *"Where can we open next?"* It lists every UK town that matches a location strategy the user builds from two simple buckets:

1. **Show towns that are MISSING these** brands/categories (your white space)
2. **Show towns that ALREADY HAVE these** brands/categories (co-location requirement)

Results are combined with an **AND** operator and shown as a map + a scrollable, exportable shortlist.

This handoff covers **Direction F**, the chosen design. It replaced earlier directions (A/B/D/E) after user feedback to: move filters into a left sidebar, reduce the filter to two plain boxes, make AND logic explicit, add proximity radius per bucket, keep a population filter, and surface a plain-English summary at the top of the results panel.

## About the Design Files
The files in this bundle are **design references created in HTML/React (Babel-in-browser)** — prototypes showing intended look and behavior, **not production code to copy directly**. They render inside a bespoke "design canvas" harness used for review.

The task is to **recreate this design in the target codebase's existing environment** (its component library, styling system, map provider, and data layer), following that codebase's established patterns — not to ship this HTML. If no front-end environment exists yet, pick the most appropriate framework and implement there.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, and interaction states are final and should be reproduced closely. The only intentionally rough element is the **map** (a static satellite-style placeholder with decorative "gap" ring markers) — wire this to the codebase's real map provider.

## Screens / Views
Three states of a single screen are documented. All are **1440 × 860** (desktop). Layout is a 4-column CSS grid: `56px` icon rail · `400px` filter sidebar · `1fr` map · `440px` results panel.

### 1. Both boxes filled + results (`01-both-boxes-filled.png`)
The default working state.

- **Top chrome** (full width): SiteMatcher logo (violet diamond + wordmark) left; centered search input "Search a town, postcode or address…" with ⌘K hint; violet **Export** button + circular avatar right.
- **Icon rail (56px):** map-pin, search (active — dark filled square), and edit/pencil icons stacked; a help "?" at the bottom.
- **Filter sidebar (400px, left):**
  - Kicker `FIND GAPS` (violet, mono, uppercase) → H1 **"Where can we open next?"** → subhead "Fill the two boxes below. We'll show every town that matches **both**."
  - **Bucket 1** — violet-tinted card, numbered badge "1", title "Show towns that **are MISSING**" (verb in violet), sub "Towns where these haven't opened yet". Tokens: `Aldi`, `AND`, `Lidl`, then a ghost `+ Add`. Below a dashed divider: proximity row "Count a match when it's" + pill choices `In the town` (selected), `Within 1 km`, `Within 3 km`, `Within 5 km`, `Within 10 km`.
  - **"AND ALSO"** divider (mono, uppercase, centered between rules).
  - **Bucket 2** — teal-tinted card, badge "2", title "Show towns that **ALREADY HAVE**" (verb in teal), sub "Towns that already contain these". Tokens `Tesco`, `AND`, `Asda`, `+ Add`. Proximity row with `Within 5 km` selected.
  - **Town size** section (top divider): label "Town size (optional)" with mono value `50k – 500k` right-aligned; helper "Only show towns within this population range."; dual-handle range slider (min 5k, max 1.2m).
- **Map (1fr):** satellite placeholder with concentric violet ring markers ("gaps"), labelled.
- **Results panel (440px, right):**
  - **"You're looking for"** summary card (warm-grey `#f6f4ef`): mono uppercase label + sentence reading back the full query: *"Towns missing **Aldi** and **Lidl**, that have **Tesco** and **Asda** within 5 km, with a population of 50k–500k."*
  - Header: mono label `MATCHING TOWNS`, big count **212** + `OF 1,586 UK TOWNS`, dark **Export CSV** button right.
  - Sort row: mono `SORT` + pills `Population ↓` (active) and `A–Z`.
  - Scrolling list of town rows: violet pin, town name, `REGION · POP nnn`, and two tags — accent "Missing Aldi, Lidl" + teal "Tesco, Asda within 5 km"; "Open ›" link right.

### 2. Empty state (`02-empty-state.png`)
No brands added yet.
- Both buckets show a dashed drop-zone with helper text ("Add the shops you're checking for" / "Optional — leave empty to ignore") and a **solid violet "+ Add a brand or category"** button.
- Results panel shows an onboarding explainer: target icon, H2 "Two boxes, one list", a paragraph, and a 4-point checklist (Box 1 = missing / Box 2 = already have / Both must be true / Export as CSV).
- Map shows a centered "Fill the boxes to light up the map" callout.

### 3. Adding a brand / category (`03-adding-brand-category.png`)
Picker open after clicking "+ Add".
- Bucket 1 gets a violet focus ring (`box-shadow: 0 0 0 4px rgba(109,49,232,0.12)`) and raises above a scrim (`rgba(20,16,40,0.14)`) over the sidebar.
- Popover: search field (focused, violet border) with placeholder "Type a shop or category" showing typed "al"; sections **BRANDS** (Aldi/Lidl show "✓ Added", others a "+" affordance) and **CATEGORIES** (Supermarkets, Discount grocers, Clothing, Coffee shops with a layers icon).
- Footer: "**2** added to 'missing'" + violet **Done** button.

## Interactions & Behavior
- **Add token:** clicking "+ Add" opens the picker popover for that bucket (scrim + focus ring). Selecting a row toggles it into/out of that bucket; "Done" closes.
- **Remove token:** the "×" on each token chip.
- **AND semantics:** results = towns that are missing *all* Bucket-1 items **AND** have *all* Bucket-2 items (never OR). Both within-bucket and cross-bucket combination are AND. Empty Bucket 2 = ignored.
- **Proximity:** each bucket has its own radius. "In the town" = strict boundary match. "Within N km" first includes every match inside the town, then uses the selected centroid-distance cache for outside matches. Changing it re-queries and updates the read-back sentence and row tags (e.g. "Tesco, Asda within 5 km").
- **Population slider:** dual-handle range; "optional" — full range = no constraint.
- **Read-back sentence** (top of results) regenerates from current buckets + proximity + population on every change; it is the single source of truth for "what am I asking".
- **Sort:** Population ↓ / A–Z pills re-sort the list.
- **Export CSV:** exports the current shortlist.
- **Row "Open ›":** navigates to that town's detail view.
- **Empty state:** shown whenever Bucket 1 has zero items; results panel shows the explainer instead of a list.

## State Management
- `missingItems: Item[]` — Bucket 1 brands/categories
- `haveItems: Item[]` — Bucket 2 brands/categories
- `missingRadius: 0|1|3|5|10` (km; 0 = "In the town")
- `haveRadius: 0|1|3|5|10`
- `population: [min, max]`
- `sort: 'pop' | 'az'`
- `picker: { open: boolean, bucket: 'missing'|'have', query: string }`
- Derived: `results` (server query on any filter change), `count`, `total`, read-back sentence string.
- `Item = { id, label, type: 'brand'|'category', avatarColor? }`

Data: an autocomplete endpoint for brands/categories, and a towns query endpoint accepting the two item sets + radii + population, returning matching towns with per-town missing/present tags.

## Design Tokens
Sourced from `fg-core.jsx` (the `FG` object) and the live app's palette.

**Colors**
- Ink: `#14121F` (ink) · `#3A3747` (ink2) · `#6B6878` (ink3) · `#9A97A6` (ink4)
- Surface: `#FFFFFF` (surface) · `#F0EEE9` / `#f6f4ef` (paper / paper2, warm greys) · app bg
- Borders: `#E9E8EE` (border) · `#F1F0F4` (borderSoft)
- Violet (primary / "missing"): `#6D31E8` (violet) · `#5620C4` (violetDeep) · `#EBE3FC` (violetTint) · violetSoft (pale violet fill)
- Teal ("already have"): `#0E7C86` (text/border) · `#eef6f6` (fill) · `#bfe0e0` (border)
- Token avatar palette: `#6D31E8 #0E7C86 #B4530E #2456C4 #8A1F5C`

**Typography**
- UI: **Inter** 400/500/600/700
- Mono (kickers, labels, counts, "AND"): **JetBrains Mono** 400/500/600
- Scale seen: H1 21px/700/-0.5ls · panel H2 22px/700 · bucket title 14.5px/700 · body 12.5–13.5px · sub 12px · mono labels 9.5–10px uppercase 1ls · big count 32px

**Radius:** chips/pills 999px · cards 14px · inner drop-zones 11px · avatar squares 6–7px
**Shadows:** popover `0 20px 48px -16px rgba(20,16,40,0.4)` · focus ring `0 0 0 4px rgba(109,49,232,0.12)` · map callout `0 12px 32px -12px rgba(0,0,0,0.4)`
**Spacing:** grid `56 / 400 / 1fr / 440`; panel padding 18–22px; card gaps 11–13px.

## Assets
- **SiteMatcher logo** — violet diamond mark + wordmark; drawn as inline SVG in `fg-core.jsx` (`FGChrome`). Use the codebase's real brand asset.
- **Icons** — inline SVG path set in `fg-core.jsx` (`I` map: search, pin, plus, close, check, chevR, download, target, layers, info, etc.). Replace with the codebase's icon library.
- **Map** — placeholder only; wire to the real map provider. Ring "gap" markers are decorative SVG (`FGGapMarkers`).
- Fonts via Google Fonts (Inter, JetBrains Mono).

## Files
Design reference files included in this bundle:
- `Find Gaps - Directions.html` — full design-canvas harness (all directions A–F, for context)
- `fg-f.jsx` — **Direction F** (the chosen design: buckets, proximity, population, picker, results). Primary reference.
- `fg-core.jsx` — shared visual language: `FG` tokens, `FGChrome`, `FGRail`, `FGMap`, `FGGapMarkers`, `FG_CSS`, icons, `FG_LOCS` sample data.
- `fg-f-shot.html` — standalone render used to produce the screenshots (`?s=main|empty|picking`).
- `screenshots/` — the three documented states.

> Note: `fg-a/b/d/e.jsx` are earlier directions, kept only for context in the harness; Direction F supersedes them.
