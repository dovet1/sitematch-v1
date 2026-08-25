# Handoff: Compare Two Locations (SiteMatcher — Unified Workspace)

## Overview
Adds a **compare-two-locations** capability to the SiteMatcher "Assess Area" flow.
A user drops a pin on the map (Pin A), clicks **Compare with another location**, then
drops a second pin (Pin B). A comparison modal opens showing, for the two catchments:

1. **Brands present in one location but not the other** — two columns ("Only at A" / "Only at B").
2. **Brands missing from both locations** — a chip list of the shared gap.
3. **Difference in catchment stats** — a table (Pin A · Pin B · Δ B–A) for population,
   households, affluence, brands trading, brands missing, traffic index.

## About the Design Files
The files in this bundle are **design references created in HTML/React (Babel-in-browser)** —
a prototype showing intended look and behavior, **not production code to copy directly**.
The task is to **recreate this feature in the target codebase's existing environment**
(the real SiteMatcher app — React + a real map, e.g. Mapbox GL) using its established
components, tokens, and data services. Where this prototype synthesizes data, wire the
equivalent real queries instead.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and interactions are final. Recreate the
modal, tray, map pins, and entry buttons pixel-closely using the app's component library.
The one thing that is *mocked* is the underlying data (brand presence + point stats are
generated deterministically from map coordinates — see "Data / State" below); replace with
real catchment queries.

## Screens / Views

### 1. Entry — "This point" left panel + Opportunity inspector (Assess Area, pin dropped)
- **Purpose:** After a pin is dropped, offer the compare action.
- **Left panel** (`ULeftPanel`, `view === "assess" && area`): a new **Compare** section
  (`<USecHd>Compare</USecHd>`) sits above **Overlays**. It contains a full-width ghost button
  **"Compare with another location"** plus helper text "Drop a second pin to compare brands
  and catchment stats side by side." When arming, the button becomes active and reads
  **"Drop pin B on the map…"**; helper text becomes "Click anywhere on the map to drop the
  second pin." Once a pair exists, the section shows a note pointing to the bottom tray.
- **Inspector header** (`UOpportunity`): for a dropped point (`area.custom === true`) the
  primary action button is the same **Compare with another location** (active label
  "Drop pin B on the map…"). For non-custom areas (Find Gaps cities) the original multi-area
  "Compare" behavior is retained.

### 2. Arming state — map (national scale)
- **Purpose:** pick the second location anywhere in the UK.
- On arming, the map switches to **national scale**. Gap-city rings are dimmed
  (`opacity: 0.35`) and non-interactive (`pointer-events: none`) so the whole map is a drop
  target; cursor is `crosshair`.
- Pin A renders at its coordinates with a small **"A" badge** (violet).
- A top-center **drop hint** pill reads: *"Click a second location to drop pin B and compare"*
  with an orange pin glyph.

### 3. Comparison modal (`UPointCompare`)
- **Overlay:** `.uw-overlay` (rgba(23,20,25,.45), centered, 40px padding). Card `.uw-compare`
  `width: min(900px, 100%)`, `border-radius: 16px`, `background: #FBFAF7`,
  `box-shadow: 0 30px 80px -20px rgba(20,10,40,.4)`. Body scrolls (`overflow: auto`).
- **Header:** kicker "LOCATION COMPARISON" (mono, var(--acc-deep)), title **"Pin A vs Pin B"**
  (Inter 22/600, letter-spacing -0.4), close icon button (`.uw-iconbtn`).
- **Two-point cards:** side by side (`UPtHeadCard`), each a white card with a round badge
  ("A" violet / "B" orange `#E8622C`), the point name ("Dropped point"), and
  `coords · <radius> radius` in mono. A muted "vs" between them.
- **Section 1 — "Brands in one location, not the other":** two `UCmpCol` columns
  ("Only at A" / "Only at B") separated by a 1px hairline. Each column caps at
  `max-height: 246px; overflow-y: auto`. Each row (`UCmpBrand`) = 26px brand logo chip +
  name (Inter 13/600) + sector (mono 9.5) + side letter (A violet / B orange). Empty state:
  dashed-border "Nothing unique to A/B".
- **Section 2 — "Missing from both":** count on the right; wrap of pill chips
  (20px logo + name). Empty state: "No shared gaps…".
- **Section 3 — "Catchment stats":** table, columns blank · Pin A · Pin B · Δ B–A.
  Rows via `UCmpStat`: Population, Households, Affluence (1 dp), Brands trading, Brands
  missing, Traffic index. Δ cell shows ▲/▼/– arrow + signed delta + (±%); color green
  (`#15803D`) when the change is "good", orange (`#C2410C`) when "bad", grey when neutral.
  `better` per metric: higher is good for pop/households/affluence/trading/traffic; **lower**
  is good for "brands missing".
- **Footer:** "N brands trade in both locations." + **Clear comparison** (ghost) +
  **Export comparison** (primary).

### 4. Persistent tray (`UPointCompareTray`)
- Shown when a pair exists but the modal is closed. Bottom-center pill (`.uw-tray`):
  "COMPARING" · **A** badge + name · "vs" · **B** badge + name · **Clear** link ·
  **View comparison** primary button (reopens the modal).

## Interactions & Behavior
- **Arm:** click "Compare with another location" (requires a dropped point) → `compareArm = true`,
  map forced to national scale.
- **Drop B:** clicking the map while armed calls `onDropCompare(point)` →
  `comparePair = { a, b }`, `compareArm = false`, modal opens.
- **Close modal:** keeps the pair; tray appears; both pins remain on the national map
  (A violet + "A" badge, B orange + "B" badge).
- **Reopen:** tray "View comparison".
- **Clear:** resets `compareArm`, `comparePair`, `pointCompareOpen`.
- **Auto-reset:** switching mode (`doMode`) or closing the area (`closeArea`) clears the compare state.
- Map drop is disabled (no new Pin A) while arming or while a pair exists (`canDropNew` guard).

## Data / State
State lives in `App` (`u-app.jsx`):
- `compareArm: boolean` — waiting for Pin B.
- `comparePair: { a, b } | null` — the two point objects.
- `pointCompareOpen: boolean` — modal visibility.
Handlers: `armPointCompare()`, `onDropCompare(b)`, `clearPointCompare()`.

**Point objects** come from `uSynthArea(x, y)` (`u-map.jsx`) — synthesizes `pop`, `households`,
`affluence`, `stores`, `missing`, `traffic`, and now `lat`/`lon`/`coords` from the click
coordinates. **In production, replace with a real catchment/demographics lookup.**

**Brand presence** comes from `uPointBrands(area)` (`u-core.jsx`): splits the fixed pool
`U_COMPARE_BRANDS` (name, initials, color, sector, `p` = prevalence 0–1) into `present`/`missing`
**deterministically from the point's map coordinates** via an FNV-style hash. Diff logic in
`UPointCompare`: `onlyA`, `onlyB`, `both` = set intersections of the two `present` lists;
`missingBoth` = pool items absent from both. **In production, replace with the real
"brands trading within catchment" query per point; keep the same diff logic.**

## Design Tokens (as used here)
- **Accent (violet):** `--acc #7033FF`, `--acc-deep #5421CC`, `--acc-soft #F5F1FF`, `--acc-tint #EEE9FF`.
- **Pin B / secondary marker:** `#E8622C` (orange).
- **Delta colors:** good `#15803D`, bad `#C2410C`, neutral = ink3.
- **Surfaces/ink:** from shared `SS` tokens — bg `#FBFAF7`, surface white, plus `SS.border`,
  `SS.borderSoft`, `SS.ink/ink2/ink3/ink4`.
- **Type:** Inter (UI), JetBrains Mono (kickers, coords, deltas). Kicker = mono 9.5–10px,
  letter-spacing ~0.8–1.4, uppercase.
- **Radii:** cards 12–16px, chips/pills 9–999px. **Shadow (modal):** `0 30px 80px -20px rgba(20,10,40,.4)`.

## Files (where the feature lives)
- `u-core.jsx` — `U_COMPARE_BRANDS`, `uHashStr`, `uPointBrands` (brand universe + deterministic split).
- `u-map.jsx` — `uSynthArea` (adds `lat/lon/coords`); `NationalMap` A/B labeled pins + `PinBadge`;
  `UnifiedMap` drop-mode branching (`arming`/`paired`/`canDropNew`), `onDropCompare`.
- `u-inspector.jsx` — `UPointCompare` (modal), `UPointCompareTray`, `UCmpBrand`/`UCmpCol`/`UCmpStat`/
  `UPtHeadCard`/`PtBadge` helpers; `UOpportunity` custom-point compare button.
- `u-panels.jsx` — `ULeftPanel` "Compare" section in the "This point" panel.
- `u-app.jsx` — compare state, handlers, prop wiring, modal + tray render.
- `GapFinder - Unified Workspace.html` — entry HTML (loads the JSX modules via Babel).

## Screenshots
See `screenshots/`:
- `01-flow.png` — comparison modal (Section 1, brand diff columns).
- `02-flow.png` — arming state: national map, Pin A badge, "Drop pin B" hint + left-panel Compare section.
- `03-flow.png` / `04-flow.png` — modal, scrolled.

## Assets
No external image assets. All brand marks are CSS initial-chips (`UBrandLogo`). Map is a
placeholder SVG/aerial mock in the prototype — use the real map provider (e.g. Mapbox GL) in production.
