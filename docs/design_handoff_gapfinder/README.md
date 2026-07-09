# Handoff: GapFinder v2 Redesign

## Overview
GapFinder is SiteMatcher's tool for identifying **commercial property gap opportunities** — cities and areas in the UK where selected brands have no store yet. The redesign brings it in line with the new SiteMatcher visual system (warm off-white palette, Inter + JetBrains Mono type, violet accent). It is a two-mode tool:

- **Find Gaps** — shows a UK map with gap-opportunity rings overlaid on cities, filtered by brand selection and population threshold. Results list ranks cities by population.
- **Assess Area** — drop a pin on the map to see every brand trading within a chosen radius, plus which brands are absent from that area.

## About the Design Files
The files in this folder are **design references created in HTML/React-via-Babel** — prototypes showing the intended look, layout, and interaction patterns. They are **not production code to copy directly**.

Your task is to **recreate these designs in the SiteMatcher codebase's existing environment**, using its established framework, component library, styling conventions, and routing — or, if starting fresh, choose the most appropriate stack and implement them there.

**Do not ship:**
- The Babel-in-browser `<script type="text/babel">` approach
- The `<style>{G_CSS}</style>` template-string CSS injection
- The `DesignCanvas` / `DCArtboard` wrapper — that exists solely to render all states side-by-side in the design tool

## Fidelity
**High-fidelity.** Colors, type, spacing, radii, shadows, copy, and interactive states are all final. The only rough elements are:
- **Map** — the `UKMap` component is a hand-drawn SVG silhouette with fake dot positions. Replace with a real map tile library (Mapbox GL JS, MapLibre, Google Maps, etc.) using real brand-location data.
- **Brand logos** in the results panel — rendered as coloured initials squares. Replace with real brand logo marks.

## File Map
```
design_handoff_gapfinder/
├── GapFinder v2.html       ← entry point; mounts 4 states in a design canvas
├── gapfinder-v2.jsx        ← ALL design logic: tokens, CSS, components, mock data
├── shared.jsx              ← VideoSlot, Check, Dash, PRICING, FAQS, LOGOS (shared across app)
├── design-canvas.jsx       ← design-tool scaffold — IGNORE when implementing
├── logo-full.svg           ← SiteMatcher wordmark + icon
├── logo-icon.svg           ← icon-only mark
├── sitematcher-logo.png    ← logo as used in the app chrome
└── screenshots/
    └── 01-find-gaps-default.png
```

All design logic lives in `gapfinder-v2.jsx`. The four exported root components at the bottom are the four artboard states — `GapFinderFind`, `GapFinderFindBrandsOpen`, `GapFinderAssessEmpty`, `GapFinderAssessPicked`.

---

## Design Tokens

These are defined as `G_COLORS` at the top of `gapfinder-v2.jsx` and are consistent with the global SiteMatcher design system.

### Colors
```
bg              #FBFAF7   page / app background (warm off-white)
bgAlt           #F5F1E8   filter row bodies, slider tracks
surface         #FFFFFF   sidebar, results panel, cards
ink             #171419   primary text, active tab bg, dark CTAs
ink2            #4A4451   secondary text
ink3            #7C7588   tertiary / placeholder text
ink4            #A39CAD   faintest text, search kbd hint
border          #E8E4DC   standard border
borderSoft      #EFEBE2   faint dividers, section rules
violet          #7033FF   brand primary — pins, active states, progress fill
violetDeep      #5421CC   eyebrow kickers, active filter values
violetTint      #EEE9FF   tinted button/icon border
violetTintSoft  #F5F1FF   tinted button/icon background
orange          #F26B1F   (unused in GapFinder but in token set)
green           #15803D   save-state indicator dot
greenTint       #E7F5EC   (in token set, not directly used)
```

Map-specific colors (used as literals):
```
brand dots      #2A6FDB   existing store locations (small dots)
brand dots lg   #1E4FBA   larger / cluster dots
```

### Typography
- **Primary:** Inter (400, 500, 600, 700)
- **Mono / eyebrow:** JetBrains Mono (400, 500, 600)

Key type usages:
```
App chrome kicker     JetBrains Mono  10px  1.4px tracking  uppercase  violetDeep
App chrome tool name  Inter           17px  600  -0.3px       ink
Section kicker        JetBrains Mono  10.5px 1.4px tracking  uppercase  ink3
Filter row label      Inter           14px  500  -0.1px       ink
Filter value badge    JetBrains Mono  11px  0.4px tracking   uppercase  ink3 / violetDeep
Slider values         JetBrains Mono  11px  0.4px             ink2
Checkbox label        Inter           14px  400               ink
Results kicker        JetBrains Mono  10.5px 1.4px tracking  uppercase  violetDeep
Results title         Inter           20px  600  -0.3px       ink
Results count "big"   Inter           24px  600  -0.5px       ink
Results meta "of"     JetBrains Mono  11px  0.6px tracking   uppercase  ink3
Results sort label    JetBrains Mono  10.5px 1.2px tracking  uppercase  ink3
Location name         Inter           15px  500  -0.1px       ink
Location meta         JetBrains Mono  10.5px 0.8px tracking  uppercase  ink3
Brand row name        Inter           14px  500  -0.1px       ink
Brand row meta        JetBrains Mono  10.5px 0.6px tracking  uppercase  ink3
Brand dist value      JetBrains Mono  11px                   ink2
Missing brand tag     Inter           12px                   ink
Map controls          JetBrains Mono  11px  0.6px tracking              ink2
Map count chip        JetBrains Mono  11px  0.6px tracking   uppercase  ink2
Map attribution       JetBrains Mono  10px  0.4px tracking              ink3
Step title            Inter           13px  600  -0.1px       ink
Step subtitle         Inter           12px  400               ink3
Empty-state title     Inter           15px  600  -0.1px       ink
Empty-state body      Inter           13px  400               ink2
```

### Spacing & Layout
```
App grid rows       64px header / 1fr body
Body grid cols      360px sidebar / 1fr map / 380px results
Sidebar padding     22px 24px
Section header      26px top / 12px bottom
Filter row padding  0 24px
Filter row header   16px 0
Filter body         4px 0 18px
Slider track        4px height / 18px vertical margin
Results header      22px 24px 16px
Results meta        14px top
Results sort        14px top
Location row        14px 24px (grid: 24px pin / 1fr text)
Brand row           13px 24px (grid: 32px logo / 1fr text / auto dist)
Missing section     16px 24px header / 4px 16px 18px body
Empty state         32px padding
```

### Border Radius
```
Back button           7px
Sidebar toggle        7px
Icon buttons          10px
Search input          8–10px
Tab (active/inactive) 8px
Filter value badge    999px (pill)
Slider handle         999px
Tick buttons          6px
Checkbox              5px
Swatch                4px
Empty state container 14px
Location card         12px
Map mode toggle       10px
Map zoom control      10px
Map count chip        999px (pill)
Results panel icon btn 10px
Missing brand tag     6px
Brand logo square     7px
```

### Shadows
```
Map controls  0 8px 20px -10px rgba(20,10,40,0.12)
```

---

## Screens / States

### 1. App Chrome (`GF_Chrome`)
Sticky 64px header. Three-column grid: left / center / right.

**Left:**
- SiteMatcher logo image (`sitematcher-logo.png`, 26px height, `mix-blend-mode: multiply`)
- Sidebar toggle button (panel-layout icon, 30×30px, 7px radius)

**Center:**
- Mode tabs: `Find Gaps` (search icon) · `Assess Area` (pin icon). Active tab: ink bg, white text. Inactive: transparent, ink2 text. 36px height, 13.5px Inter 500, 8px radius.

**Right:**
- Global search input: 280px wide, 36px high, 8px radius, white bg, border. `IcSearch` left. `⌘K` kbd hint right (JetBrains Mono).

---

### 2. Sidebar — Find Gaps (`GF_SideFind`)
360px left panel, white bg, right border.

**Structure (top to bottom):**
1. **Context hint** — violet-tinted info strip (`#F5F1FF` bg, `#EEE9FF` border). Info icon (violetDeep) + instructional text. Reads: *"Pick **Brands** in Filters below — the map and list show cities where those brands have **no store yet**."*
2. **`OVERLAY` section divider** — JetBrains Mono 10.5px, ink3, with hairline rules either side.
   - `Requirement Locations` — toggle (off by default)
   - `Traffic` — toggle (off by default)
3. **`FILTERS` section divider**
   - `Population` — collapsible row, value badge `ALL`
     - When open: range slider (0 → 500k+), dual handles, four tick buttons (10k / 50k / **100k** active / 250k)
   - `Brands` — collapsible row, value badge `ALL` (or `3 SELECTED` when active)
     - When open: checkbox list of brands, each with: checkbox, colour swatch, brand name, location count (mono). Default: Allpress Espresso, Goodhood, ShakeDown checked ON; Card Factory, The Entertainer, Knoops unchecked.

**Collapsible filter row anatomy:**
- Header: chevron (rotates 90° when open) / label / value badge or toggle
- Body: expands below; 4px 0 18px padding

---

### 3. Sidebar — Assess Area (`GF_SideAssess`)

**Empty state (no pin dropped):**
1. Context hint — "**Click the map** to drop a pin…"
2. `SELECTION` section divider
3. Steps list (numbered 1–2–3): Drop a pin / Set your radius / Read the landscape. Each step: numbered circle (violetTintSoft bg, violetDeep text) + title (Inter 13px 600) + subtitle (Inter 12px ink3).
4. `PARAMETERS` section divider
5. Radius filter (collapsed, value `5 KM`)
6. Brands filter (collapsed, value `ALL`)
7. Requirement Locations toggle

**Pin dropped / populated state:**
- `SELECTION` shows **Location card** instead of steps:
  - Kicker: `ANCHOR POINT · SAVED` (mono, violetDeep)
  - Place name: `Manchester city centre` (Inter 15px 600)
  - Coordinates: `53.4808° N · 2.2426° W · M1 1AE` (mono 11px ink3)
  - Action buttons: `Move` (with left-arrow icon) / `Clear` — side by side, 8px radius, border, surface bg
- `PARAMETERS` shows **Radius** filter expanded with value `5 KM` active (violetTintSoft badge):
  - Single-handle slider 0.5km → 25km
  - Tick buttons: 1 / 2 / **5** (active) / 10 / 25

---

### 4. Map (`UKMap`)

**Visual composition:**
- Background: CSS radial gradients (purple tint top-left, warm tint bottom-right) + grid lines on `#F4F1EA` base
- Faint UK SVG silhouette (mainland + Ireland + Scotland) — `#E2DBC9` fill, `#C9C1AA` stroke
- Brand dots: `#2A6FDB` circles (6px standard, 9px large/cluster), positioned by `%` across the map

**Find Gaps mode overlays:**
- Gap-city rings: violet (`#7033FF`) circles with 10% fill, `border: 2px solid violet`, sized by population (14px → 30px diameter). Positioned at each city's `%` coordinate.

**Assess Area mode overlays:**
- Violet pin marker (`IcPinFilled`, 32px) at anchor `%` position
- Radius circle: 220×220px, 8% violet fill + 2px solid violet border, centered on anchor

**Controls (top-right):**
- Mode toggle pill: `2D` (active = ink bg) · `3D`. JetBrains Mono 11px 600.
- Zoom control: `+` / `−` / compass buttons stacked, 36×36px each.

**Bottom overlays:**
- Left: count chip pill (violet dot + text: `1,586 candidate gaps · 22,470 stores mapped` / or "Click anywhere to drop a pin")
- Left +54px: scale bar (`0 ——— 50 km`, mono 10px)
- Map legend (above scale bar): dot key for "Existing stores" (blue) and "Gap cities" (violet ring), white/94% bg, 9px radius
- Right: attribution (`© Mapbox · OpenStreetMap · Maxar`, mono 10px, white/85% bg)

---

### 5. Results Panel — Find Gaps (`GF_ResultsMatching`)
380px right panel, white bg, left border.

**Header:**
- Kicker: `FIND GAPS · LIVE` (mono, violetDeep)
- Title: `Gap opportunities` (Inter 20px 600)
- Subtitle: `Cities where selected brands have no store` (Inter 12px ink3)
- Download icon button (tinted violet: `#F5F1FF` bg / `#EEE9FF` border)
- Meta row: `1,000 OF 1,586` + progress bar (63% filled, violet)
- Sort row: `SORTED · POPULATION ↓` + `Change →` link

**List rows (scrollable):**
Each location: pin icon (violet) / name (Inter 15px 500) / meta line (ENGLAND · Pop 1,121,375 — mono 10.5px).

Mock locations (12): Birmingham, Glasgow, Liverpool, Leeds, Sheffield, Manchester, Edinburgh, Bristol, Leicester, Croydon, Coventry, Cardiff.

---

### 6. Results Panel — Assess Area Empty (`GF_ResultsAssessEmpty`)

**Header:**
- Kicker: `LIVE · ASSESS AREA`
- Title: `Nearby brands`
- Count: `0 locations in radius`
- Download button: 40% opacity, non-interactive

**Body:** Centred empty state:
- Violet pin icon in `violetTintSoft` / `violetTint` square (48×48, 12px radius)
- `Drop a pin to begin` (Inter 15px 600)
- Instructional body text (Inter 13px ink2)
- `↖ CLICK ON THE MAP TO START` pill (mono, bg, border)

**Footer:** Missing brands collapsed panel:
- Header: chevron + `Missing brands` label + `0` count badge (ghost style)
- Body: empty (no tags)

---

### 7. Results Panel — Assess Area Populated (`GF_ResultsAssessPopulated`)

**Header:**
- Kicker: `LIVE · ASSESS AREA · 5 KM`
- Title: `Nearby brands`
- Count: `36 brands in radius` + progress bar (45%)
- Sort: `SORTED · DISTANCE ↑`
- Download button: active (tinted)

**Brand list rows (scrollable):**
Grid: `32px logo / 1fr text / auto dist`. 8 mock brands:
| Brand | Sector | Colour | Distance |
|---|---|---|---|
| Allpress Espresso | Food & Beverage | `#6F4A2E` | 0.4 km |
| Goodhood | Retail | `#171419` | 0.7 km |
| ShakeDown | Food & Beverage | `#E8B22A` | 1.1 km |
| Card Factory | Retail | `#2A5DD1` | 1.4 km |
| The Entertainer | Retail | `#E0392F` | 1.8 km |
| Knoops | Food & Beverage | `#1F1A14` | 2.2 km |
| Rodd & Gunn | Retail | `#2C3F2A` | 2.7 km |
| Ben's Greengrocers | Retail | `#7A1F2E` | 3.4 km |

**Missing brands footer (expanded):**
- Header: down-chevron + `Missing brands` + `12` count (violet pill bg)
- Body: wrapping tag cloud (12 brands): Pret A Manger, Pure, Joe & The Juice, LEON, Itsu, Wagamama, Five Guys, Honest Burgers, Crosstown, Boots, Lush, Rituals. Each tag: white bg, border, violet dot prefix.

---

## Interactions & Behaviour

| Interaction | Trigger | Result |
|---|---|---|
| Sidebar collapse | Click sidebar-toggle button in header | Left panel hides; grid shifts to `0 1fr 380px`. Toggle button persists in chrome. Animated via `transition: grid-template-columns 0.25s ease-out`. |
| Mode switch | Click `Find Gaps` or `Assess Area` tab | Active tab gets ink bg / white text. Sidebar, map overlays, and results panel all swap to the matching state. |
| Filter row expand | Click anywhere on filter row header | Chevron rotates 90°. Body expands below. Multiple rows can be open simultaneously. |
| Filter toggle | Click toggle switch | Pill slides right; bg changes to violet. Currently visual-only in the mock. |
| Brand checkbox | Click checkbox row | Checkbox fills violet with checkmark. Value badge on the parent filter row updates (e.g. `3 SELECTED`). |
| Slider tick | Click tick button | Tick inverts to ink bg / white. Slider fill updates. |
| Map click (Assess Area) | Click on map area | Pin drops at click position. Sidebar switches from step-list to location card. Results panel populates. Radius ring appears. |
| Location card — Move | Click `Move` button | Clears pin, returns to step-list / empty results. |
| Location card — Clear | Click `Clear` button | Same as Move. |
| Missing brands panel | Click panel header | Expands/collapses the tag cloud. |
| Map zoom/mode buttons | Click | Visual-only in mock. In production: wire to map library's `map.zoomIn()` / `zoomOut()` / bearing reset and `map.setProjection()`. |
| Download CSV | Click download icon button | Export current results as CSV. Currently visual-only. |

---

## Layout — Body Three-Column Grid

```css
.gf-body {
  display: grid;
  grid-template-columns: 360px 1fr 380px;
}
/* Sidebar collapsed: */
.gf-body.collapsed {
  grid-template-columns: 0 1fr 380px;
}
```

The map fills all remaining space. There is no explicit min-width on the map column — it will shrink freely. For viewports narrower than ~900px you will need a responsive breakpoint (stacked layout, or a drawer-based sidebar).

---

## Real Map Integration Notes

The mock uses a hand-drawn CSS/SVG UK map. In production, replace `UKMap` with your real mapping library (Mapbox GL JS is recommended — it's what the attribution implies).

The mock expresses all positions as `%` coordinates on a roughly `350×700` conceptual UK bounding box. You will need to convert these to real `[lng, lat]` coordinates for each city from your database.

**Layers to implement (Find Gaps mode):**
1. **Brand store dots** — a GeoJSON point layer for all mapped store locations. Blue circle markers, radius 3–5px.
2. **Gap city rings** — a GeoJSON point layer for result cities. Violet circle fill (8–10% opacity) + stroke, scaled by population.

**Layers to implement (Assess Area mode):**
1. **Brand store dots** — same as above.
2. **Selected pin** — custom violet marker at the clicked `LngLat`.
3. **Radius circle** — Mapbox / Turf.js `turf.circle()` around the pin at the chosen radius. Violet fill + stroke.

**Map click handler (Assess Area):**
```js
map.on('click', (e) => {
  const { lng, lat } = e.lngLat;
  setAnchor([lng, lat]);
  // reverse-geocode for display name (Mapbox Geocoding API)
});
```

---

## State Management

All state is local to the GapFinder page. Suggested shape:

```ts
interface GapFinderState {
  mode: 'find' | 'assess';
  sidebarOpen: boolean;

  // Find Gaps filters
  populationMin: number;       // 0
  selectedBrands: string[];    // brand IDs

  // Overlays
  showRequirements: boolean;
  showTraffic: boolean;

  // Assess Area
  anchor: [number, number] | null;  // [lng, lat]
  radiusKm: number;                  // 5

  // Results
  results: GapResult[] | BrandResult[];
  loading: boolean;
}
```

---

## Component Breakdown

Suggested production component tree:

```
GapFinderPage
├── GapFinderChrome           (header, mode tabs, search, sidebar toggle)
└── GapFinderBody
    ├── GapFinderSidebar
    │   ├── ContextHint
    │   ├── SectionDivider
    │   ├── FilterRow             (collapsible, used for Population/Brands/Radius)
    │   │   ├── RangeSlider
    │   │   └── CheckboxList
    │   ├── OverlayToggleRow      (Requirement Locations, Traffic)
    │   ├── StepList              (Assess Area, no pin)
    │   └── LocationCard          (Assess Area, pin dropped)
    ├── GapFinderMap              (Mapbox wrapper)
    └── GapFinderResults
        ├── ResultsHeader         (kicker, title, count, sort)
        ├── GapResultsList        (Find Gaps)
        ├── BrandResultsList      (Assess Area)
        └── MissingBrandsPanel    (Assess Area, collapsible)
```

---

## Assets

| Asset | In handoff | Action for dev |
|---|---|---|
| SiteMatcher logo | `sitematcher-logo.png`, `logo-full.svg`, `logo-icon.svg` | Use SVGs in production |
| Brand logos | Coloured initials squares (mock only) | Request real brand mark assets from data team |
| Map tiles | Fake CSS/SVG (mock only) | Provision a Mapbox GL JS token; use `mapbox://styles/mapbox/light-v11` or a custom style matching the warm palette |
| Fonts | Inter + JetBrains Mono (Google Fonts) | Use `next/font`, fontsource, or self-hosted |

---

## Implementation Notes

1. **Strip the design-canvas wrapper** — `GapFinder v2.html` mounts four states inside `<DCArtboard>` for side-by-side comparison. In production this is one page with real React state transitions.
2. **Template-string CSS → your styling system** — `G_CSS` is a large string injected via `<style>`. Move to CSS modules / Tailwind / styled-components. Token table above maps cleanly to a Tailwind theme extension.
3. **Replace mock data** — `LOCATIONS`, `NEARBY_BRANDS`, `MISSING_BRANDS` are all hardcoded arrays. Wire to your real API (`/api/gapfinder/results`, `/api/assess/nearby`, `/api/assess/missing`).
4. **Accessibility** — currently missing:
   - `aria-expanded` on all collapsible filter rows
   - `role="listbox"` / `aria-checked` on checkbox rows
   - Focus styles on all interactive elements
   - Keyboard-operable slider (use `<input type="range">` under the hood)
   - Map interaction accessible alternative (table view of results)
5. **Responsive** — the mock is designed for desktop 1440px. For smaller viewports, consider:
   - `≤ 1024px` — collapse sidebar to a drawer by default
   - `≤ 768px` — full-screen map with a bottom-sheet results panel (mobile-map pattern)
6. **Performance** — with 22,470+ store points, use a clustering strategy (Mapbox Supercluster or equivalent) for the brand dots layer.
7. **URL state** — encode `mode`, active filters, and anchor location in the URL so users can share / bookmark a GapFinder view.

---

## Open Questions for the SiteMatcher Team

- What is the real GapFinder data API? REST endpoint, query params, pagination strategy?
- How are "gaps" defined — cities with zero stores for ALL selected brands, or any selected brand?
- Mapbox token / map style — confirm the account and preferred style URL.
- Real brand logo assets for the results panel.
- Population threshold logic — does the slider filter the results list, the map rings, or both?
- Should Requirement Locations and Traffic overlays be real data layers or deferred to a later milestone?
- Confirm the exact coordinate source for the anchor reverse-geocode display (e.g. Mapbox Geocoding, OS Places API).
