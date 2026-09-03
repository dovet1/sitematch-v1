# Handoff: SiteSketcher — Auto Parking Layout (Guided flow)

## Overview
Auto parking layout lets a SiteSketcher user generate concept car-park layouts on satellite imagery from just two inputs — a drawn site boundary and a vehicle access point. The tool proposes up to three layout options (bays + circulation aisles) that fill the usable area, flow around any obstacle polygons inside the boundary, and respect bay-size / aisle / setback settings. The user compares options, drags the boundary / access / obstacles to re-fit in real time, then applies one as a normal sketch object.

This is the **"Guided panel"** direction (option 2a from the earlier flow exploration): the Auto panel fills itself in step by step, mirroring the rhythm of the existing Manual parking panel.

## About the Design Files
The files in this bundle are **design references created in HTML** — a prototype showing intended look and behaviour, **not production code to copy directly**. The main file (`SiteSketcher Auto Parking Guided.dc.html`) is an internal "Design Component" format; `support.js` is only its preview runtime. Do **not** ship either file.

The task is to **recreate these designs inside SiteSketcher's existing codebase**, using its established framework, map library (the mocks imply Mapbox GL — see the "© Mapbox" attribution in the real product), component library, and styling patterns. Where this document gives exact hex/px values, match them; where SiteSketcher already has an equivalent token or component, prefer the existing one.

## Fidelity
**High-fidelity.** Final colours, typography, spacing, copy, and interaction intent are all specified. Recreate the UI to match, substituting SiteSketcher's real map tiles and real geometry for the indicative SVG map used in the mock.

> Note on the map: in the prototype the satellite imagery, boundary, bays, and obstacle are drawn as a static SVG in a 520×520 coordinate space purely to communicate intent. In production these are real map features rendered by the map engine. Treat the SVG only as a description of *what* is drawn, not *how*.

## Integration model (most important)
Auto layout is **not a new screen**. It is a **sub-mode of the existing Parking tool**, selected by a `Manual | Auto layout` segmented toggle at the top of the Parking panel. Everything else is the existing shell and must be reused unchanged:

- Global top bar: logo, address search, **Export**, account avatar
- Left 52px icon rail (location, search, sketch/pen active, layers)
- Sketch panel header: "Untitled Sketch" + **Save**
- Tool row: **Select · Polygon · Parking · CAD · Measure** (Parking active in Auto mode)
- Map overlay controls: **2D/3D**, **m/ft**, **Map Style** (Satellite / Hybrid / Streets)
- The bottom-left **Issue** pill
- The right-hand **Select inspector** once a layout is applied

Manual parking is unchanged and remains the default method. There is **no CAD step for obstacles** — any polygon inside the boundary is treated as an obstacle automatically and the layout flows around it.

## Screens / Views
The flow is six states inside the same window. Screenshots are in `screenshots/`.

### 01 · Draw the site boundary — `01-draw-boundary.png`
- **Purpose:** user traces the plot outline. There is deliberately **no option to pick an existing polygon**; the boundary is always drawn.
- **Panel body:** a 3-item vertical step list. Step 1 active (violet-bordered card `#DFD1FB` on `#F8F5FF`, numbered chip `#6B2FE3`): "Draw the site boundary / Click points on the map to trace the plot; double-click to close it." Steps 2 (Set a vehicle access point) and 3 (Create layouts) are dimmed (`opacity:.55`, grey number chips `#E7E2DA`).
- **Footer:** disabled "Create layouts" button (bg `#E7E2DA`, text `#A8A29A`) + helper "Draw a site boundary to continue".
- **Map:** partially-drawn boundary — a `polyline` of 3 placed vertices (white dots, violet stroke) with a dashed rubber-band segment to the cursor crosshair. Dark pill top-left: "Drawing boundary · 3 points · double-click to close".

### 02 · Drop the vehicle access point — `02-set-access.png`
- **Purpose:** place the single entry point on a boundary edge.
- **Panel body:** Step 1 now a completed **required card** (check icon in `#EDE6FE` circle, "Site boundary / Plot A · 1.59 ha", **Change** link). Step 2 active card: "Set a vehicle access point / Hover the boundary — the nearest edge thickens. Click to drop the entry; drag to slide it along the edge." Step 3 dimmed.
- **Footer:** disabled Create + "Set an access point to continue".
- **Map:** full boundary polygon; the **south edge is thickened** in light violet `#C4B2F7` (edge-snap affordance); a violet access marker with pulse ring at the hovered point; dark tooltip "Vehicle access here / click to place · drag to move". Obstacle polygon shown dashed with label "Obstacle · layout will avoid it".

### 03 · Ready — create layouts — `03-ready-create.png`
- **Purpose:** both inputs satisfied; generate.
- **Panel body:** two completed required cards (Site boundary, Vehicle access — each with **Change**). A **collapsed "Layout settings"** row (chevron down). Helper text: "Defaults: 2.4 × 4.8 m bays, 6.0 m aisles, 3.0 m setback. Open to change before or after generating."
- **Footer:** **enabled** primary "Create layouts" (violet `#6B2FE3`, star/sparkle icon, shadow `0 6px 16px rgba(107,47,227,.24)`) + "Generates up to 3 concept options · usually under 10 s". (A brief generating/spinner state occurs after this press; not drawn as a separate screen.)
- **Map:** boundary + access dot + obstacle, no bays yet.

### 04 · Compare & refine — live — `04-compare-live.png`
- **Purpose:** the core screen. Compare options and drag geometry with live re-fit.
- **Panel body:**
  - Two compact ticked chips (Site boundary, Vehicle access, each with Change).
  - `LAYOUTS · 3` label + **Regenerate** link.
  - Three option cards (see Components). **Clicking a card selects it and redraws the map immediately** — no confirm.
  - Option 2 carries a `BEST YIELD` tag; Option 3 carries an amber warning row (non-blocking): "Tighter aisles — 1 row failed the manoeuvring check. Selectable; warning follows to the inspector."
  - An **expanded "Layout settings"** drawer (chevron up) with Bay width (slider, 2.4 m), Aisle (slider, 6.0 m), Setback (3.0 m), Reserve accessible bays (6%). The panel middle region scrolls (`overflow-y:auto`) so the drawer is always fully reachable.
- **Footer:** primary **"Use this layout"** + caveat "Concept layout only. Review compliance, tracking, gradients and drainage separately."
- **Map:** selected option's bays (white fill, violet stall lines `#5A23D0`) and charcoal circulation aisles, flowing around the obstacle. **Drag handles** on every boundary vertex (white/violet, r=6.5), every obstacle vertex (white/grey, r=4.5), and the access marker (dashed ring). Overlays: option summary pill ("Option 2 · 104 spaces · CONCEPT"), a green-dot "Drag boundary, access or obstacle — bays re-fit live" hint, and a **Legend** (Parking bays / Circulation aisle / Obstacle · avoided / Vehicle access).

### 05 · Applied — Select view — `05-applied-select.png`
- **Purpose:** layout committed; back to the normal Select tool.
- **Left panel:** Select tool active. `PLOTS · 1` (Plot A · 1.59 ha). `PARKING · 2`: a selected **"Auto layout 1"** object (violet-bordered `#6B2FE3` on `#F8F5FF`, star icon, "126 sp", sub-line "8 rows · 8 accessible · concept") and a plain "Parking 1 · 10 sp" manual block — Auto and Manual coexist.
- **Right inspector (300px):** title "Auto parking layout" + close X; Name field ("Auto layout 1"); a **TOTAL SPACES** stat card (126, with Standard 118 / Accessible 8 / Footprint 3,340 m²); a spec list (Stall size 2.4 × 4.8 m, Aisle width 6.0 m, Boundary setback 3.0 m, Obstacles avoided 1); secondary buttons **Edit layout settings** and **Regenerate**; destructive **Remove from Sketch** (`#FEF1F1` bg, `#FADCDC` border, `#E5484D` text).
- **Map:** final bays; the manual "Parking 1" block near the top; concept caveat pill bottom-left.

### 06 · Out of date after an external edit — `06-out-of-date.png`
- **Purpose:** shows what happens when the plot boundary is edited with the **Select tool while Auto layout is not the active mode**. The applied layout is a reviewed snapshot, so it **never silently re-solves** — it is flagged stale instead.
- **Object list:** "Auto layout 1" keeps its selected styling but gains an **amber dot** (`#E9A23B`) and an `OUT OF DATE` amber sub-row (warning icon + `#8A6318` text). Plot A's area updates to the new value (e.g. 1.38 ha).
- **Map:** the **new** boundary drawn solid in amber (`#E9A23B`, fill `rgba(233,162,59,.08)`) with amber vertex handles; the **previous** boundary shown as a faint white dashed outline for reference; the stale bays drawn at **50% opacity, clipped to the new boundary** (no overhang off-site); a centred amber banner "Plot A was reshaped — Auto layout 1 is out of date"; caption "Bays shown at 50% until regenerated · clipped to the new boundary".
- **Inspector:** an amber "Layout out of date" card at the top — "Plot A was reshaped after this layout was generated. Figures below reflect the previous boundary." — with a primary **"Regenerate for new boundary"** button. The Name field and the stats card below are dimmed (`opacity:.55`) and the TOTAL SPACES label reads `TOTAL SPACES · WAS`. Edit layout settings + Remove from Sketch remain.
- **Recovery:** Regenerate re-solves against the new boundary and returns to a normal applied state (05). Nothing recomputes until then.

## Interactions & Behavior
- **Method toggle:** `Manual | Auto layout` switches the Parking panel body. Manual unchanged.
- **Draw boundary:** click to add vertices, double-click to close. No import/select-existing path.
- **Access point:** hover boundary → nearest edge thickens; click to drop; drag to slide **along that edge**; Esc cancels. "Change" re-enters this mode.
- **Create layouts:** enabled only when boundary + access exist. Runs generation (show a brief in-panel progress/spinner; target < 10 s), then transitions to state 04.
- **Option selection:** click a card → map redraws with that option's bays/aisles/rotation/space count instantly. In the prototype `state.a` (1|2|3) drives this; see `renderVals()` in the `<script>` block.
- **Live editing (key requirement):** dragging any boundary vertex, the access marker, or any obstacle vertex re-runs the fit and updates bays **in real time, without leaving Auto mode**. Settings sliders do the same.
- **Warnings** are inline amber, never blocking. A warned option is still selectable and applicable; the warning persists onto the applied object.
- **Use this layout:** commits the selected option as one grouped object under Parking and returns to the Select tool (state 05).
- **Regenerate / Edit layout settings / Remove:** from either the compare footer or the inspector.
- **Editing the plot from outside Auto mode (Select tool):** does **not** re-solve. The Auto layout object is flagged **out of date** (amber dot in the list + at ~50% opacity, clipped to the new boundary on the map) with a Regenerate prompt in the inspector — see state 06. This is the opposite of the live re-fit inside Auto compare, and it protects a reviewed layout from being silently rearranged.
- **Change (on a completed required card):** re-enters that input's edit mode — boundary vertices become draggable / access marker re-placeable. Inside Auto compare this re-fits live; if the edit removes the edge the access sits on, access reverts to unset and step 2 re-opens.

### Edge states (carry over from the broader spec; recreate as needed)
No boundary yet · multiple candidate boundaries to pick · no valid layout fits (usable area too small after obstacles/setbacks) · candidate with warnings · applied layout out of date after the plot was reshaped (amber dot + 55% opacity until regenerated).

## State Management
- `parkingMethod`: `'manual' | 'auto'`
- `boundary`: polygon geometry (null until drawn) → gates step 2
- `accessPoint`: `{ edgeId, distanceAlongEdge }` (null until placed) → gates Create
- `obstacles`: polygons detected inside boundary (derived, silent)
- `settings`: `{ bayWidth: 2.4, bayLength: 4.8, aisle: 6.0, setback: 3.0, accessiblePct: 6, stall: 'standard' }`
- `options`: array of generated layouts, each `{ id, spaces, rows, footprint, accessible, rotation, bays[], aisles[], warnings[] }`
- `selectedOptionId`
- `phase`: `'draw' | 'access' | 'ready' | 'generating' | 'compare' | 'applied'`
- Re-fit is triggered by changes to boundary, accessPoint, obstacles, or settings while in `compare`.

## Design Tokens
**Colours**
- Primary violet `#6B2FE3`; pressed/stroke `#5A23D0`; bay stall line `#5A23D0`; boundary stroke `#7C4DFF`; light-violet accent `#C4B2F7`
- Violet tints: `#EDE6FE`, `#F1EBFE`, `#F5F0FE`, `#F8F5FF`, `#F3EFFD`; violet border `#DFD1FB` / `#E2D6FC`
- Text: primary `#26242A`, secondary `#57534E`, tertiary/muted `#8A857D` / `#7C766E`, disabled `#A8A29A`
- Neutrals/surfaces: page `#F3F1EC`, card `#FBFAF8`, white `#fff`; borders `#E9E5DF` / `#EEEAE4` / `#EFEBE5` / `#EAE6DF`
- Dark UI: `#231F2B` / `#3B3742`
- Warning (amber): bg `#FDF6EC`, border `#F2E3CB`, icon/stroke `#B07A1E`, text `#8A6318`
- Destructive: bg `#FEF1F1`, border `#FADCDC`, text `#E5484D`
- Success dot `#3FB27A`
- Obstacle fill `rgba(38,36,42,.5–.6)` with dashed `#F4F1EA` outline; circulation aisle `rgba(35,31,43,.4)` (legend swatch `#7A7486` / `#3B3742`)
- Satellite map base gradient: greens `#7C8662 → #8C9369 → #78845C` with darker radial patches `#46543A`–`#515F3F`

**Typography**
- UI font: **Poppins** (400/500/600). Numeric/labels: **JetBrains Mono** (400/500/600).
- Sizes: window/section title 18px 600; sketch title 17px 600; inspector title 16px 600; body 12.5–14px; option space count 16–17px mono 600; mono micro-labels 10px 600 with `letter-spacing:.12em`, uppercase.

**Radius:** buttons/pills 16–22px; cards 11–14px; window 16px; small chips 5–8px.
**Shadows:** window `0 1px 2px rgba(24,20,14,.05), 0 16px 36px rgba(24,20,14,.07)`; floating map controls `0 4px 12px rgba(20,16,10,.14)`; primary button `0 6px 16px rgba(107,47,227,.24)`.
**Spacing:** panel padding 13–18px; card padding 9–13px; gaps 7–14px. Left icon rail 52px; parking panel 300–312px; inspector 300px.

## Assets
- **Icons:** simple 1.6–2px stroke line icons (pin, search, layers, select cursor, polygon, parking "P"/car, CAD cube, measure, save, export, sparkle, warning, gear, checkmark). Use SiteSketcher's existing icon set — the SVGs in the mock are stand-ins.
- **Map:** real satellite/hybrid tiles from the production map engine. No raster assets are shipped in this bundle.
- **Fonts:** Poppins + JetBrains Mono (Google Fonts) — or the app's existing equivalents.
- No AI-generated imagery is used.

## Files
- `SiteSketcher Auto Parking Guided.dc.html` — the prototype (all five states, canvas layout). The logic (option data, selection handlers) is in its trailing `<script data-dc-script>` block.
- `support.js` — preview runtime only; **do not ship**.
- `screenshots/01-draw-boundary.png … 06-out-of-date.png` — full-window renders of each state.

Prior context (not in this bundle): earlier exploration compared three flows — 2a Guided (this one, chosen), 2b Reactive canvas, 2c Layout studio — in `SiteSketcher Auto Parking Flows.dc.html`.
