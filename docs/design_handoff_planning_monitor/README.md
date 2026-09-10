# Handoff: Planning Monitor

## Overview
"Planning monitor" is a mode in SiteMatcher that lets a retailer find and watch UK planning applications relevant to their store estate — residential schemes that grow a catchment, or commercial units a competitor/partner brand might take. It has three linked views: a map-first Monitor (default landing), a Set Criteria modal, and a zoomed-in Market Change view that projects local population/spend impact.

## About the Design Files
The files in this bundle are **design references built in HTML** — prototypes showing intended look and behavior, not production code to copy directly. The task is to recreate these designs in the target codebase's existing environment (React, Vue, native, etc.) using its established components, patterns and design tokens — or, if no such environment exists yet, to choose the most appropriate framework and implement the designs there.

`planning-modes-reference.html` is a single self-contained file — open it directly in a browser to interact with/inspect the static mockups (hover to see exact spacing via devtools). It also contains the "Contact brands" mode; only the three "1a" screens (ids `1a`, `1acrit`, `1azoom`) are in scope for this handoff.

## Fidelity
**High-fidelity.** Colors, typography, spacing and iconography are final-intent. Copy is representative but not final. All data (application counts, addresses, projections, dwelling figures) is **illustrative/stylised** — not real planning records — and must be replaced with live data.

## Screens / Views

### 1. Monitor (default view)
**Purpose:** Landing screen. Shows the user's saved patch on a map with matching applications, plus a summary panel.

**Layout:** Full-bleed app shell — 72px top bar, 72px icon rail (left), 426px fixed-width side panel, remaining space is the map. Side panel is `padding: 24px 26px 0`, flex column, internal scroll on the application list only.

**Components:**
- **Scope toggle** — segmented control, 2 options ("My patch" / "All UK"), pill background `#F2F0F9`, active segment white with `box-shadow: 0 2px 6px rgba(0,0,0,.06)`, `border-radius: 8px` inner / `11px` outer.
- **AI summary card** — gradient `linear-gradient(180deg,#F3EFFF,#FAF8FF)`, `1px solid #E7DEFF`, `border-radius: 16px`, sparkle icon + `#6C47FF` label at 11px/700/.1em tracking, body text 14px/1.55/`#2A2833` with bold inline spans for key figures.
- **Criteria chips** — pill buttons, `border-radius: 999px`, 12.5px/600. Color-coded by type: patch = `#F1EEFA` bg/`#4B23C9` text, estate proximity = `#EAF8F1`/`#177E4E`, plain filters = `#F4F3F8`/`#3D3C47`, brand watch = `#FEF3E0`/`#B7860B`.
- **Application list rows** — leading 10px dot colored by category (purple = residential ≥50 units, green = relevant commercial, amber = brand-linked), title 14px/600, meta line 12.5px/`#8A8895`. Selected row: `#F6F3FF` bg, `1px solid #ECE6FB`.
- **Map** — dark basemap (`#0E1522` + soft radial greens/blues + diagonal hatching for texture). Store-estate markers: `12px` rounded-square, `#0EAE73`, dashed ring at intended proximity radius. Drawn patch: dashed `#9E82FF` outline, organic blob shape, `rgba(139,108,255,.13)` fill, label chip top-left.
- **Clusters** — circular badges with count, sized ~36-40px, colored by dominant category, white 3px border, drop shadow.
- **Selected-application popover** — anchored beside its marker (never on top of it), 320px wide, white card, `border-radius: 16px`. Top section: status pill + headline + meta. Bottom section (on `#F6F3FF` bg): "Market impact" label + 3 stat columns (residents, catchment %, grocery spend) + primary "View application" button (`#6C47FF` fill) + secondary "Watch" button (outlined).
- **Map controls** — zoom +/- stack (white, `border-radius: 11px`) and a "Market change: On/Off" toggle chip, top-right.
- **Legend** — bottom-right card listing the 4 marker colors/meanings.

### 2. Set criteria (modal)
**Purpose:** Define what counts as a "relevant" application — opened via "Edit criteria".

**Layout:** Centered modal, 1040px wide, max-height 840px, `border-radius: 22px`, over a dimmed/blurred map background. Header with title + close (X). Body splits into a 420px fixed-width left column (draw/upload/search a patch) and a flexible right column (scrolling form), footer bar with live match count + Cancel/Save actions.

**Components (5 steps, right column):**
1. **Location** — three mode buttons (Draw/Upload/Search), draw canvas shows vertex handles and a helper caption ("Click to add points · double-click to close").
2. **Proximity to store estate** — estate picker + radius input, side by side.
3. **Application type** — checklist, checked items show a filled `#6C47FF` checkbox with white checkmark; each has an inline editable threshold/description in muted text.
4. **Dates & status** — single-select pill row for date range (active pill filled `#6C47FF`), separate multi-select pills for status (`#F1EEFA`/`#4B23C9` when selected).
5. **Brand watch** — tag input; existing tags are amber pills (`#FEF3E0`/`#B7860B`) with a remove (✕) affordance; dashed "+ Add brand" pill to add more.

**Footer:** live count text ("Matching 12 applications right now"), Cancel (outlined) and "Save & monitor" (filled `#6C47FF`) buttons, both `border-radius: 12px`.

### 3. Market change (zoomed)
**Purpose:** Drill-down into one location's applications and projected impact, reached by zooming into a cluster or opening a pin with "Market change" on.

**Layout:** Same map shell, denser zoom. Minimal translucent top bar (blurred white, `rgba(255,255,255,.96)`) with a "Back to patch" link, place name, radius/count summary, and the impact toggle. A 400px-wide floating panel on the right (`border-radius: 18px`, internal scroll) carries all the projection content.

**Components:**
- **Build footprints** — semi-transparent purple rectangles on the map marking consented-but-unbuilt sites.
- **Before/after stat pair** — two cards side by side: "Today" (neutral `#F5F6FA`) and target year (`#F3EFFF` bg, `#4B23C9` accent), each showing a population figure and delta.
- **Dwellings pipeline** — simple 4-bar chart, one bar per year, increasing height/saturation (`#E3DCFB` → `#6C47FF`) to show cumulative pipeline growth.
- **Catchment uplift card** — `#F6F3FF` bg, two stats (annual spend uplift, catchment % change).
- **Export area report** — full-width filled button at the panel's base.

## Interactions & Behavior
- Scope toggle (My patch/All UK) re-scopes the same criteria; no page navigation.
- "Edit criteria" opens the Set Criteria modal over the current view (modal, not a route change) and returns to Monitor on save/cancel.
- Clicking a map pin or an application-list row opens/updates the selected-application popover; the two are synced (hover/select state should mirror both ways).
- Popover position is calculated relative to its marker so it never covers the marker itself.
- Zooming into a cluster (or clicking a pin with "Market change: On") transitions to the Market Change view for that location; "Back to patch" returns to the prior Monitor state (scope, zoom).
- The "Market change: On/Off" toggle affects whether the residential-impact overlay/panel is available; default state has not been specified — confirm with product.
- Set Criteria's match count should recompute live as any control changes (debounce network calls).
- Brand-linked applications carry an inferred-match label ("likely Aldi") — this is a confidence flag, not a confirmed source; label it as inferred wherever it appears.

## State Management
- Active criteria set (patch geometry, estate + radius, application type(s), date range, status(es), watched brands) — persisted per user, editable via the modal.
- Current map viewport/zoom and selected application id.
- Market-change-overlay on/off flag.
- Selected place/radius when in the zoomed Market Change view.
- Async states to design for: loading applications for a viewport, loading market-change projections for a location, saving criteria.

## Design Tokens
**Colors**
- Primary purple: `#6C47FF` (accent, primary buttons, active states)
- Purple dark (text/hover): `#4B23C9`
- Ink: `#1C1B22` / `#14121A`
- Muted text: `#6B6B78` / `#8A8895`
- Borders: `#ECEAF3` / `#EEECF5` / `#E6E3EF`
- Surface tint (purple): `#F1EEFA` / `#F6F3FF` / `#F3EFFF`
- Success/green (store estate, relevant commercial): `#0EAE73` / `#34D399` / `#177E4E` / `#EAF8F1`
- Amber (brand-linked / acquisitive): `#FBBF24` / `#B7860B` / `#FEF3E0`
- Map basemap: `#0E1522` (dark navy-green)
- App background: `#EEECF6` / `#F6F5FB`

**Typography**
- Display/headings/labels: "Space Grotesk", weight 700
- Body/UI text: "Figtree", weights 400–800
- Small label tracking: `letter-spacing: .1em`–`.14em`, uppercase, 11–13px

**Radii**
- Cards/panels: 14–24px
- Buttons/inputs: 9–12px
- Pills/chips: 999px

**Shadows**
- Popovers/cards: soft, large offset, low opacity, e.g. `0 22px 54px -18px rgba(0,0,0,.5)`

## Assets
No custom icons/images — all iconography is inline SVG (stroke-based, 1.8–2.2px weight, currentColor-style). Map imagery is a stylised placeholder (gradients + hatching), not a real map tile provider — integrate a real map (e.g. Mapbox/Google Maps) for production, keeping the marker/legend/popover treatment described above.

## Files
- `planning-modes-reference.html` — self-contained bundle of the full mockup file. In-scope sections have anchor ids `1a` (Monitor), `1acrit` (Set criteria), `1azoom` (Market change).
- `screenshots/planning-monitor.png`
- `screenshots/planning-criteria.png`
- `screenshots/planning-marketchange.png`
