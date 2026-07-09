# Handoff: GapFinder — Unified Workspace

## Overview
The **Unified Workspace** collapses SiteMatcher's four previously-separate tools — GapFinder (find gaps), SiteAnalyser (catchment/demographics), Browse Requirements (occupier demand), and SiteSketcher (site sketching) — into a **single workspace built around one map and one selection**. Instead of switching apps, the surveyor picks a mode from a left rail, selects an opportunity (a built-up area, a dropped pin, or a sketch), and works it through four tools presented as **tabs on that one selection**: Summary · Catchment · Requirements · Sketch.

Core mental model:
- **One map**, two scales — a "national" UK view for discovery (gap-opportunity rings on cities) and a "local" zoomed aerial view for a selected opportunity (catchment cells, requirement pins, sketch overlays).
- **One selection** drives everything. Pick Manchester and every tab (catchment, requirements, sketch) operates on Manchester.
- **Four modes** on the left rail: Assess Area, Find Gaps, Sketch Site, Requirements.

## About the Design Files
The files in this folder are **design references created in HTML + React-via-Babel** — prototypes demonstrating the intended look, layout, and interaction patterns. They are **not production code to ship directly**.

Your task is to **recreate these designs in the SiteMatcher codebase's existing environment**, using its established framework, component library, styling conventions, state management, and routing. If no such environment exists yet, choose the most appropriate modern stack (e.g. React + TypeScript + a real map library) and implement the designs there.

**Do not ship, as-is:**
- The Babel-in-browser `<script type="text/babel">` loading approach — precompile components in your build.
- The `<style>{U_STYLE(sa)}</style>` template-string CSS injection — port to your styling system (CSS modules, Tailwind, styled-components, etc.). Keep the token values.
- The `Stage` wrapper in `u-app.jsx` — it scales a fixed **1440×900** canvas to fit the design-tool viewport. In a real app the workspace should be **fully responsive/fluid**; the fixed canvas exists only so the prototype renders at a known size.
- The `Object.assign(window, {...})` global-export pattern at the bottom of each file — that only exists to share components across separate Babel `<script>` tags. Use real ES module imports.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, shadows, copy, and interactive states are all final and intentional. Recreate them pixel-accurately using your codebase's primitives.

The only deliberately-rough / mock elements:
- **The map** (`u-map.jsx`) is a hand-drawn CSS/SVG backdrop with fake gradient "aerial" fills, a repeating-grid streets look, and hard-coded `%`-positioned dots/pins/rings. **Replace entirely with a real map library** (Mapbox GL JS, MapLibre GL, Google Maps) fed by real geospatial data. Preserve the *overlay design* (gap rings, requirement diamonds, store dots, LSOA catchment cells, the legend/scale/attribution chrome), but drive positions from real coordinates.
- **Brand logos** are rendered as coloured initials squares (`UBrandLogo`). Replace with real brand logo marks where available; keep the initials chip as a fallback.
- **All data** in `u-core.jsx` (`U_BUAS`, `U_STORES`, `U_MISSING`, `U_REQS`, `U_SAVED`, brand/fascia taxonomy) is representative mock data. Wire to real APIs.
- **Sliders** (`UPseudoSlider`) are static visual mocks — implement as real range inputs.

---

## Screenshots
Reference renders of the key states are in `screenshots/`:
```
01-assess-empty.png          Assess Area — landing (national UK map, no selection)
02-find-gaps.png             Find Gaps — presence/proximity rule builder + ranked results
03-summary-tab.png           Selected area (Manchester) — Summary tab, missing brands
04-catchment-tab.png         Catchment tab — LSOA selection + demographic report
05-requirements-tab.png      Requirements tab — local + nationwide occupier demand
06-sketch-launcher.png       Sketch Site — launcher (new + saved sketches)

Sketch Site — one shot per tool (in an open session):
07-sketch-select-layers.png  Select tool — Layers list (polygons, parking, CAD, scheme versions)
08-sketch-polygon.png        Polygon tool — colour palette, 90°/edge-distance/grid options, shortcuts
09-sketch-parking.png        Parking tool — space count, single/double row, stall size, live W×D preview
10-sketch-cad.png            CAD tool — searchable to-scale plan library (drop plan on parcel to test fit)
11-sketch-measure.png        Measure tool — ruler, empty-state prompt + shortcuts

Find Gaps — the presence/proximity rule builder (brand · category · fascia):
12-filter-brand.png          Match on "Brand" — searchable brand list (Asda, Tesco, Sainsbury's…) + committed rules above
13-filter-fascia.png         Match on "Fascia" — individual fascias (Asda Superstore / Supermarket / Local…)
14-filter-category.png       Match on "Category" — broad categories (Grocery, Convenience, Food & Beverage…)
15-filter-proximity.png      Condition "Proximity" — Within/Beyond + distance steps (1/3/5/10 km)
```
Committed rules render as coloured pill-rows above the builder (green "Contains"/"Within" = positive, red "Excludes"/"Beyond" = negative); click a rule's condition label to flip it, the × to remove it. Each rule is `{ kind:"presence"|"proximity", type:"category"|"brand"|"fascia", value, op, km? }` — see State Management.
Note: the map imagery in these shots is the prototype's mock CSS/SVG backdrop (the "Mapbox · OpenStreetMap" text and 2D/3D toggle are mock chrome). Replace with a real map library in production — see Fidelity.

## File Map
```
design_handoff_unified_workspace/
├── GapFinder - Unified Workspace.html   ← entry point; fonts, React/Babel, script order, mounts <Stage/>
├── u-app.jsx              ← App shell: layout grid, ALL top-level state, tweaks, U_STYLE CSS, Stage wrapper
├── u-core.jsx            ← mock data + shared atoms (UKicker, UBrandLogo, UGapPill, UVerified, USecHd, Metric)
├── u-panels.jsx          ← top chrome, left rail, left context panel (filters/catchment/sketch tools), rule builder
├── u-map.jsx             ← the shared map (national + local), overlays, popovers, legend/controls
├── u-inspector.jsx       ← right panel: Find-Gaps results list + selected-opportunity inspector (the 4 tabs)
├── u-cadlib.jsx          ← CAD plan library data + plan SVG renderer (Sketch mode)
├── u-sketch-session.jsx  ← Sketch launcher, session bar (rename/save/autosave), leave-guard modal
├── sitesketcher-core.jsx ← DESIGN SYSTEM: SS tokens, POLY palette, Ico icon set, map backdrop primitives
├── siteanalyser-core.jsx ← AIco icon set + census/demographic primitives reused by Catchment
├── siteanalyser-report.jsx ← demographic report blocks reused in the Catchment tab
├── sitesketcher-chrome.jsx ← shared chrome bits reused by the workspace
├── tweaks-panel.jsx      ← design-tool tweak panel — IGNORE for implementation (see Tweaks note below)
├── logo-full.svg         ← SiteMatcher wordmark + icon
├── logo-icon.svg         ← icon-only mark
└── screenshots/          ← reference renders of the six key states (see above)
```

`<Stage/>` (bottom of `u-app.jsx`) → `<App/>` is the root. `App` holds all state and composes: `UChrome` (top bar) · `URail` (left rail) · `ULeftPanel` (context panel) · `UnifiedMap` (center) · `UInspector` (right) · `UCompareTray` + modals.

---

## Design Tokens

Defined as the `SS` object at the top of `sitesketcher-core.jsx`. This is the global SiteMatcher design system — use the same tokens across the app.

### Colors
```
bg              #FBFAF7   page / app background (warm off-white)
surface         #FFFFFF   chrome, panels, cards, rows
ink             #171419   primary text, active dark buttons, active tab bg
ink2            #4A4451   secondary text
ink3            #7C7588   tertiary / muted labels
ink4            #B5AEC0   faintest text, kbd hints, empty dots
border          #E8E4DC   standard 1px border
borderSoft      #EFEBE2   faint dividers, section rules
borderHard      #D8D2C5   stronger dividers
violet          #7033FF   brand primary — pins, active states, requirement diamonds, progress fill
violetDeep      #5421CC   eyebrow kickers, active filter values, links on tint
violetTint      #EEE9FF   tinted borders
violetTintSoft  #F5F1FF   tinted button/hint backgrounds
orange          #F26B1F   traffic overlay / count-point heat
ok              #16A34A   verified / positive
warn            #D97706   medium gap
```

### Accent theming (Tweak-driven — pick ONE as the shipped default)
The workspace themes its accent through CSS custom properties `--acc / --acc-deep / --acc-soft / --acc-tint`. Two palettes exist (`ACCENTS` in `u-app.jsx`):
```
violet     (default)  acc #7033FF  deep #5421CC  soft #F5F1FF  tint #EEE9FF
restrained (mono)      acc #26222C  deep #171419  soft #F1EFEA  tint #E4E0D7
```
**Recommend shipping `violet`** (matches the SiteMatcher brand). Wire all accent usage to these variables so a theme swap is one change.

### Supporting colors used inline
```
Gap pill "High"  bg #F5F1FF  fg #5421CC  dot #7033FF
Gap pill "Med"   bg #FEF3C7  fg #92400E  dot #D97706
Nationwide tag   bg #FEF3C7  fg #92400E
Store dot (map)  #2A6FDB          Traffic legend  #F26B1F
CAD teal (Sketch) #0F9488 / hover fills #ECFBF8 / text #0B6F65
Danger (logout, remove) #DC2626 / #C2410C
Negative filter rule  soft #FCECEA  tint #F4D2CC  deep #B23A2C  acc #C2452F
```

### Typography
- **Inter** (400/500/600/700) — all UI text, headings, body.
- **JetBrains Mono** (400/500/600) — kickers/eyebrows (uppercase, letter-spacing ~1–1.4px), metric units, chip counts, keyboard hints, mono data (m², distances, plan scales).
- Type scale (px, key sizes): panel title 17/600 · inspector headline 20/600 · results headline 24/600 · metric value 22/600 · body 13–13.5 · secondary 12–12.5 · kicker 9.5–10.5 · mono data 10–11.
- Negative letter-spacing (~-0.3 to -0.5px) on large headings.

### Spacing / radii / shadows
- **Density is a Tweak.** Panel padding `gp` = **18px (Calm, default)** or **13px (Dense)**. Left panel width 320/296, inspector 404/376, rail 56 (icon) or 172 (labelled).
- Border radius: buttons/inputs 8–10 · cards/panels 10–14 · pills 999 · icon buttons 7–9 · logo chips 7–11.
- Shadows (all cool violet-tinted, not neutral black):
  - popover `0 24px 60px -20px rgba(20,10,40,.3)`
  - compare tray `0 16px 40px -12px rgba(20,10,40,.22)`
  - map controls / count `0 6px 16px -10px rgba(20,10,40,.2)`
  - edge-toggle `0 6px 16px -10px rgba(20,10,40,.28)`

---

## Layout

Top-level grid (`.uw-app`): **`56px` chrome row** over a **body row** (`1fr`).

Body is a CSS grid whose columns are computed in `App`:
```
[rail] [left panel?] [map 1fr] [inspector?]
```
- **Rail** — always present. 56px (icon-only) or 172px (labelled) per the Navigation tweak.
- **Left context panel** — collapsible via an edge-toggle tab; 320px (calm) / 296px (dense).
- **Map** — always fills remaining space (`1fr`).
- **Inspector** — right panel; hidden in Assess mode until a point is selected; collapsible via edge-toggle. 404px (calm) / 376px (dense).
- **Sketch launcher** special-case: when Sketch mode is open with no active session, the body is just `[rail] [1fr launcher]`.

**Edge toggles** (`UEdgeToggle`): small 22×48 tabs docked at the vertical center of each sidebar's map-side edge, chevron pointing the collapse direction. Cool-shadowed, hover lightens.

---

## Screens / Views

The workspace is one screen with four **modes** (rail) × contextual **tabs** (inspector). Below are the meaningful states.

### 1. Top Chrome (`UChrome`, always visible)
- Left: SiteMatcher logo mark (accent-filled SVG) + "SiteMatcher" wordmark (Inter 16/600).
- Center: search box (`USearchBox`) — 42px tall, `bg` fill, search icon, "Search a town, postcode or address…", `⌘K` mono hint right-aligned. Max-width 460.
- Right: **Requirements** toggle button (diamond swatch, turns accent-tinted when on) · **Traffic** toggle (road icon, turns orange-tinted `#FEF1E7`/`#C2410C` when on) · vertical divider · **Export** primary button (accent, download icon) · **account avatar** (accent circle initial "N" + chevron) opening a 248px dropdown menu.
- Account menu items: Account settings, Manage subscription, Billing & invoices, (divider), Help & support, Log out (danger `#C2410C`). Header shows avatar + "Naomi Whitfield / naomi@northpoint.co.uk" + "Pro plan" mono pill. Closes on outside-click / Escape.

### 2. Left Rail (`URail`)
Vertical icon nav. Four **modes** (active = ink `#171419` bg, white text; hover = `borderSoft`):
- **Assess Area** (pin icon) · **Find Gaps** (search) · **Sketch Site** (polygon) · **Requirements** (diamond).
When an area is selected + rail is wide, a divider then **tools** (e.g. Catchment/target). Help "?" pinned to the bottom. In labelled mode each shows a 13/500 label.

### 3. Assess Area — empty (default landing)
- Left panel: "Drop a point" — 3-step explainer (Drop a pin · Set a radius · Read the landscape) + "Or pick Manchester to preview" ghost button.
- Map: national UK view, gap rings on cities, store dots, legend.
- Inspector: hidden (no selection).

### 4. Assess Area — point selected
- Left panel: pin card (name + region), **Radius** slider with mono step buttons (1/3/5/10/20), Overlays toggles (Requirement locations, Traffic heatmap).
- Map: local aerial, catchment ring, brand store dots, requirement diamonds.
- Inspector: the selected point's landscape (brands present / brands missing), with the four tabs.

### 5. Find Gaps
- Left panel "Filters": Overlays toggles · **Presence & Proximity rule builder** (see below) · Population range slider.
- Inspector "Gap opportunities": live count "**N of 1,586**" with progress bar that narrows as rules are added, sort control, then a ranked list of built-up areas (`U_BUAS`) — each row: name, region kicker, population, gap-strength pill (`UGapPill`: High/Med/Low), missing-brand count. Click a row → selects that area.
- Map: national view; rings emphasize matching towns.

### 6. Selected opportunity — the four tabs (`UInspector`)
Tabs (underline-on-active, accent bar): **Summary · Catchment · Requirements · Sketch**.
- **Summary** (GapFinder): area metrics (`Metric` tiles — population, households, affluence, traffic), **Missing brands** list (`U_MISSING`) — each brand row with logo chip, fit rating, UK store count, nearest existing store, note; plus promoted **occupier-requirement rows** (`.uw-spon-row`, inset accent bar + "sponsored/live" tag) folded into the same list. "Add to compare" action.
- **Catchment** (SiteAnalyser): catchment definition (Radius/Drive/Walk segmented + slider), LSOA cell selection stats ("N LSOAs selected of M" + progress), demographic report blocks. Clicking LSOA cells on the map updates figures live.
- **Requirements** (Browse): demand filters (sector checkboxes, use-class pills, size slider, "Include nationwide brands" toggle) + local + nationwide requirement rows.
- **Sketch** (SiteSketcher): switches map to satellite; see mode 7.

### 7. Sketch Site (`SketchPanel`, `u-sketch-session.jsx`)
- **Launcher** first (no session): saved sketches grid (`U_SAVED`) + "New sketch".
- **Session**: session bar (editable name, save state — editing → saving → saved with autosave debounced ~2.5s; `LeaveGuardModal` intercepts mode-switch/exit with unsaved changes).
- Five sketch tools (`SKETCH_TOOLS`): **Select** (layers list) · **Polygon** (color from `POLY` palette, 90° snap, edge distances, grid snap, shortcuts) · **Parking** (count stepper, single/double row, stall size, live W×D preview) · **CAD** (upload + searchable to-scale plan library, tap to place on parcel) · **Measure** (ruler).
- Map: satellite style; polygons, parking blocks, CAD overlays, measurement lines drawn to scale.

### 8. Overlays & modals
- **Requirement modal** (`UReqModal`) — centered card for nationwide/browse requirements: brand logo, sector kicker, summary, KV grid (size wanted, use class, listing, verified), "wants to be in" location tags, contact card, Brochure + Contact buttons.
- **Compare tray** (`UCompareTray`) — bottom-center floating pill; holds up to **3** areas; opens `UComparePanel` overlay for side-by-side.
- **Map popovers** (`.um-pop`) — store/requirement detail popovers anchored on the map with KV grid + contact list + copy actions.

---

## Interactions & Behavior
- **Mode switch** (`onMode`): resets selection; leaving Sketch ends the session. If a sketch has unsaved changes, opens `LeaveGuardModal` (Save / Discard / Cancel) before proceeding.
- **Select an area** (`pickArea`): sets the area, resets to Summary tab, clears sub-selection.
- **Tab switch**: only enabled when an area is selected.
- **Overlays**: Requirements / Traffic / Nationwide toggle independently. Requirements overlay is forced on in Requirements mode or when the "prominent" Requirements tweak is set.
- **Compare**: add up to 3 areas; tray shows chips; open for side-by-side; clear/remove.
- **LSOA catchment**: click cells on the map to add/remove; stats recompute live; selection resets when focus/catchment definition changes.
- **Sketch save**: manual save → 650ms "saving" → "saved"; autosave debounces ~2.5s after last edit then saving→saved (~850ms).
- **Account menu / popovers**: dismiss on outside-click and Escape.
- **Transitions**: rows/buttons `filter/background .12s`; store-dot select grows 11→17px with accent halo; drop-hint slides in `.3s`; spinner `.7s linear`. Respect `prefers-reduced-motion` in your implementation.

## State Management
All state lives in `App` (`u-app.jsx`). Key variables:
```
view          "assess" | "find" | "sketch" | "requirements" | "saved"   (active mode)
area          selected built-up area object | null
tab           "summary" | "catchment" | "requirements" | "sketch"       (inspector tab)
overlays      { requirements, traffic, nationwide }
selected      { type: "store"|"req", id } | null                        (map sub-selection)
reqModal      requirement object | null                                 (centered modal)
compare       array (max 3) of area objects
compareOpen   bool
brandFilter   array of brand names
gapRules      array of { id, kind:"presence"|"proximity", type:"category"|"brand"|"fascia", value, op, km? }
catchment     { mode:"distance"|"drive"|"walk", value }
showLsoa      bool          lsoaSel { cellId: bool }        catchStats { factor, selCount, totalCount }
sketch        { layer, scheme, cad, show }
sketchSession null | { id, name, status:"editing"|"saving"|"saved", dirty, savedAt, rev, ... }
leaveTo       pending nav blocked by unsaved changes | null
leftHidden / inspHidden   panel collapse flags
```
Derived: `scale` (national vs local), `mapStyle` (streets vs satellite in sketch), `effOverlays`, grid `cols`. Port to your state solution (Redux/Zustand/Context/signals); the shapes above are the contract.

Data fetching (replace mocks): built-up areas / gap scoring, store locations by area+radius, missing-brand analysis, live requirements (local + nationwide), demographic/LSOA census, saved items, CAD plan library.

## Tweaks (design-tool only — decide defaults, don't ship the panel)
`TweaksPanel` and `useTweaks` are prototype controls. They expose four decisions — bake in the recommended default and optionally keep as a real setting:
- **Navigation**: Contextual (default) vs Mode rail (always-labelled rail).
- **Density**: Calm (default) vs Dense.
- **Accent**: Violet (default, recommended) vs Restrained.
- **Requirements emphasis**: Subtle (default) vs Prominent (forces requirement overlay + enlarges pins).

## Assets
- `logo-full.svg`, `logo-icon.svg` — SiteMatcher marks. The chrome uses an inline accent-filled SVG (`SMLogoMark`) — swap for the real logo component in your codebase.
- Brand logos: currently coloured-initials chips (`UBrandLogo`) — replace with real marks.
- Icons: two inline sets — `Ico` (16px line icons, `sitesketcher-core.jsx`) and `AIco` (`siteanalyser-core.jsx`). Map these to your icon library or port the SVGs.
- Fonts: Inter + JetBrains Mono via Google Fonts (see `<head>`).
- No raster image assets — the "aerial"/satellite map look is CSS gradients and must be replaced by a real map.

## Files to reference
Start at `GapFinder - Unified Workspace.html` (script load order), then `u-app.jsx` (state + layout + CSS), then the panel/map/inspector files. Tokens and icons are in `sitesketcher-core.jsx` / `siteanalyser-core.jsx`.
