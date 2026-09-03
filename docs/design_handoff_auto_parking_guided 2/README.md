# Handoff: SiteSketcher — Auto Parking Layout (Guided flow)

## Overview
Auto parking layout lets a SiteSketcher user generate concept car-park layouts on satellite imagery from a small set of inputs — a drawn site boundary, any buildings/obstacles to route around, a building entrance, and a vehicle access point. The tool proposes up to three layout options (bays + circulation aisles) that fill the usable area, flow around any buildings inside the boundary, anchor the accessible bays near the entrance, and respect bay-size / aisle / setback settings. The user compares options, drags the boundary / buildings / entrance / access in real time to re-fit, then applies one as a normal sketch object.

This is the **"Guided panel"** direction (option 2a from the earlier flow exploration): the Auto panel fills itself in step by step, mirroring the rhythm of the existing Manual parking panel.

### What changed in this version (the "new autolayout")
Two inputs were added between the boundary and the vehicle access, and the panel is now a **five-step** guided list:

1. Draw the site boundary
2. **Add the buildings** *(new — optional)*
3. **Set the building entrance** *(new)*
4. Set a vehicle access point
5. Create layouts

- **Buildings (step 2)** are drawn or picked from existing map shapes, listed in the panel, and treated as no-park zones the layout routes around. Optional — skippable when the plot is clear.
- **Building entrance (step 3)** snaps to a building wall and **anchors where the accessible bays are placed**. When there are no buildings, it becomes a plain "target point" for where visitors arrive.
- The compare screen now re-fits live when the boundary, a **building**, the **entrance**, or the vehicle access is dragged.

## About the Design Files
The files in this bundle are **design references created in HTML** — a prototype showing intended look and behaviour, **not production code to copy directly**. The main file (`SiteSketcher Auto Parking Guided.dc.html`) is an internal "Design Component" format; `support.js` is only its preview runtime. Do **not** ship either file.

The task is to **recreate these designs inside SiteSketcher's existing codebase**, using its established framework, map library (the mocks imply Mapbox GL), component library, and styling patterns. Where this document gives exact hex/px values, match them; where SiteSketcher already has an equivalent token or component, prefer the existing one.

## Fidelity
**High-fidelity.** Final colours, typography, spacing, copy, and interaction intent are all specified. Recreate the UI to match, substituting SiteSketcher's real map tiles and real geometry for the indicative SVG map used in the mock.

> Note on the map: in the prototype the satellite imagery, boundary, bays, buildings, and entrance are drawn as a static SVG in a 520×520 coordinate space purely to communicate intent. In production these are real map features rendered by the map engine. Treat the SVG only as a description of *what* is drawn, not *how*.

## Integration model (most important)
Auto layout is **not a new screen**. It is a **sub-mode of the existing Parking tool**, selected by a `Manual | Auto layout` segmented toggle at the top of the Parking panel. Everything else is the existing shell and must be reused unchanged:

- Global top bar: logo, address search, **Export**, account avatar
- Left 52px icon rail (location, search, sketch/pen active, layers)
- Sketch panel header: "Untitled Sketch" + **Save**
- Tool row: **Select · Polygon · Parking · CAD · Measure** (Parking active in Auto mode)
- Map overlay controls: **2D/3D**, **m/ft**, **Map Style** (Satellite / Hybrid / Streets)
- The right-hand **Select inspector** once a layout is applied

Manual parking is unchanged and remains the default method. Buildings are captured **inside Auto mode** (draw or pick-existing) rather than via a separate CAD step.

## Screens / Views
The flow is eight states inside the same window. Screenshots are in `screenshots/`, numbered in flow order.

### 01 · Draw the site boundary — `01-draw-boundary.png`
- **Purpose:** user traces the plot outline. There is deliberately **no option to pick an existing polygon** for the boundary; it is always drawn.
- **Panel:** the five-step vertical list. Step 1 active (violet-bordered card `#DFD1FB` on `#F8F5FF`, numbered chip `#6B2FE3`); steps 2–5 dimmed (`opacity:.55`, grey chips `#E7E2DA`).
- **Footer:** disabled "Create layouts" button (`#E7E2DA` bg, `#A8A29A` text) + "Draw a site boundary to continue".
- **Map:** partially-drawn boundary — placed vertices (white dots, violet stroke) with a dashed rubber-band segment to the cursor. Dark pill: "Drawing boundary · N points · double-click to close".

### 02 · Add the buildings — `02-mark-buildings.png`
- **Purpose:** capture buildings / structures the layout must avoid. **Optional.**
- **Panel:** Step 1 completed (check card, "Plot A · 1.59 ha", **Change**). Step 2 active card labelled **"Buildings"** with an `OPTIONAL` tag and a live count on the right ("2"). Copy: "Layouts route around anything here. Skip if the plot is clear." Two mode buttons: **Draw building** (primary, active) and **Select on map** (secondary). Below them the **added-buildings list**: each row a dark swatch + name + source/area + an `×` remove control — e.g. "Building A · drawn · 640 m²" and "Existing structure · selected on map · 410 m²". Steps 3–5 dimmed.
- **Footer:** primary **"Continue"** (enabled — the step is skippable) + "N buildings added · next, set the building entrance".
- **Map:** a top toolbar pill toggles **Draw building | Select existing**. One building shown **drawn** (solid dark fill, white vertex handles, "Building A · drawn" tag); one shown **selected** (dashed outline). A dark tooltip on a picked shape: "Added as building / click again to unmark". Legend swatch bottom-left: "Buildings — layouts route around them".

### 03 · Set the building entrance — `03-building-entrance.png`
- **Purpose:** drop the primary entrance on a building wall; it anchors where accessible bays sit.
- **Panel:** Steps 1 and 2 completed. Step 3 active card **"Set the building entrance"**: "Click a building wall to drop the primary entrance. Accessible bays are placed nearest to it — drag to slide it along the wall." Plus a fallback line: "No buildings? Drop a target point where visitors arrive instead." Steps 4–5 dimmed. Footer disabled + "Set the entrance to continue".
- **Map:** dark **"Placing entrance · snaps to the nearest wall"** status pill (green dot) top-left. The nearest building wall is highlighted in **entrance-green `#2FA37A`**; a green entrance marker with white ring sits on it; a dashed **accessible-bay zone** (green, `rgba(47,163,122,.14)` fill) fans out from the entrance. Dark tooltip: "Primary entrance / accessible bays go here · drag along wall". Legend: "Building entrance — anchors the accessible bays".

### 04 · Set the vehicle access point — `04-set-access.png`
- **Purpose:** place the single vehicle entry on a boundary edge.
- **Panel:** Steps 1–3 completed cards (Site boundary · Plot A · 1.59 ha; Buildings · 2 added; Building entrance · North wall — each with **Change**). Step 4 active card **"Set a vehicle access point"**: "Hover the boundary — the nearest edge thickens. Click to drop the entry; drag to slide it along the edge." Step 5 dimmed. Footer disabled + "Set an access point to continue".
- **Map:** full boundary polygon; buildings shown dashed ("Building · layout will avoid it"); the entrance marker (green) in place; a violet **vehicle-access** marker with pulse ring at the hovered boundary point; dark tooltip "Vehicle access here / click to place · drag to move". (This shot also shows the **Map Style** popover — Satellite / Hybrid / Streets, Hybrid selected — as an example of the existing overlay control.)

### 05 · Ready — create layouts — `05-ready-create.png`
- **Purpose:** all inputs satisfied; generate.
- **Panel:** four completed cards (boundary, buildings, entrance, vehicle access — each with **Change**), a **collapsed "Layout settings"** row (chevron), and helper text ("Defaults: 2.4 × 4.8 m bays, 6.0 m aisles, 3.0 m setback. Open to change before or after generating.").
- **Footer:** **enabled** primary "Create layouts" (violet `#6B2FE3`, sparkle icon, shadow `0 6px 16px rgba(107,47,227,.24)`) + "Generates up to 3 concept options · usually under 10 s". A brief in-panel generating/spinner state follows the press (not a separate screen).
- **Map:** boundary + buildings + entrance + access, no bays yet.

### 06 · Compare & refine — live — `06-compare-live.png`
- **Purpose:** the core screen. Compare options and drag geometry with live re-fit.
- **Panel:**
  - Four compact ticked chips (Site boundary, Buildings · 2, Building entrance, Vehicle access — each with Change).
  - `LAYOUTS · 3` label + **Regenerate** link.
  - Three option cards. **Clicking a card selects it and redraws the map immediately** — no confirm. Option 2 carries a `BEST YIELD` tag; Option 3 carries an amber warning row (non-blocking): "Tighter aisles — 1 row failed the manoeuvring check. Selectable; warning follows to the inspector."
  - An **expanded "Layout settings"** drawer (Bay width 2.4 m, Aisle 6.0 m, Setback 3.0 m, Reserve accessible bays). The panel middle scrolls so the drawer is always reachable.
- **Footer:** primary **"Use this layout"** + caveat "Concept layout only. Review compliance, tracking, gradients and drainage separately."
- **Map:** selected option's bays (white fill, violet stall lines `#5A23D0`) and charcoal circulation aisles, flowing around the buildings. **Drag handles** on every boundary vertex, the entrance (green), and the vehicle access (dashed ring). The green **accessible-bay zone** sits around the entrance. Overlays: option summary pill ("Option 2 · 104 spaces · CONCEPT"), a green-dot hint "Drag boundary, access, a building or the entrance — bays re-fit live", and a **Legend** (Parking bays / Circulation aisle / Building · avoided / Vehicle access / Building entrance / Accessible bays near entrance).

### 07 · Applied — Select view — `07-applied-select.png`
- **Purpose:** layout committed; back to the normal Select tool.
- **Left panel:** Select tool active. `PLOTS · 1` (Plot A · 1.59 ha). `PARKING · 2`: a selected **"Auto layout 1"** object (violet-bordered `#6B2FE3` on `#F8F5FF`, star icon, space count, sub-line "rows · accessible · concept") and a plain manual "Parking 1" block — Auto and Manual coexist.
- **Right inspector (300px):** title "Auto parking layout" + close X; Name field; a **TOTAL SPACES** stat card (with Standard / Accessible / Footprint); a spec list (Stall size, Aisle width, Boundary setback, Buildings avoided); secondary buttons **Edit layout settings** and **Regenerate**; destructive **Remove from Sketch** (`#FEF1F1` bg, `#FADCDC` border, `#E5484D` text).
- **Map:** final bays; the manual "Parking 1" block; concept caveat pill.

### 08 · Out of date after an external edit — `08-out-of-date.png`
- **Purpose:** what happens when the plot boundary is edited with the **Select tool while Auto layout is not the active mode**. The applied layout is a reviewed snapshot, so it **never silently re-solves** — it is flagged stale instead.
- **Object list:** "Auto layout 1" keeps its selected styling but gains an **amber dot** (`#E9A23B`) and an `OUT OF DATE` amber sub-row. Plot A's area updates to the new value.
- **Map:** the **new** boundary drawn solid in amber (`#E9A23B`, fill `rgba(233,162,59,.08)`) with amber vertex handles; the **previous** boundary as a faint white dashed outline; the stale bays at **50% opacity, clipped to the new boundary**; a centred amber banner "Plot A was reshaped — Auto layout 1 is out of date"; caption "Bays shown at 50% until regenerated · clipped to the new boundary".
- **Inspector:** an amber "Layout out of date" card with a primary **"Regenerate for new boundary"** button; Name field + stats dimmed; `TOTAL SPACES · WAS`.
- **Recovery:** Regenerate re-solves against the new boundary and returns to a normal applied state (07). Nothing recomputes until then.

## Interactions & Behavior
- **Method toggle:** `Manual | Auto layout` switches the Parking panel body. Manual unchanged.
- **Draw boundary:** click to add vertices, double-click to close. No import/select-existing path.
- **Buildings:** two capture modes — **Draw building** (click vertices like a polygon) and **Select on map** (click an existing shape to mark it; click again to unmark). Each captured building appears in the panel list with area + remove (`×`). Optional: **Continue** proceeds even with none. Buildings are no-park zones; layouts route around them.
- **Building entrance:** click a building wall → entrance snaps to the nearest wall (green highlight); drag to slide along the wall. It anchors the accessible-bay cluster. With no buildings, it degrades to a free "target point" for visitor arrival.
- **Access point:** hover boundary → nearest edge thickens; click to drop; drag to slide **along that edge**; Esc cancels. "Change" re-enters this mode.
- **Create layouts:** enabled only when boundary + entrance + access exist (buildings optional). Runs generation (brief in-panel progress; target < 10 s), then → state 06.
- **Option selection:** click a card → map redraws with that option's bays/aisles/rotation/space count instantly. In the prototype `state.a` (1|2|3) drives this; see `renderVals()`.
- **Live editing (key requirement):** dragging any boundary vertex, any **building**, the **entrance**, or the vehicle access re-runs the fit and updates bays **in real time, without leaving Auto mode**. Settings sliders do the same.
- **Warnings** are inline amber, never blocking. A warned option is still selectable and applicable; the warning persists onto the applied object.
- **Use this layout:** commits the selected option as one grouped object under Parking and returns to Select (state 07).
- **Regenerate / Edit layout settings / Remove:** from either the compare footer or the inspector.
- **Editing the plot from outside Auto mode (Select tool):** does **not** re-solve. The Auto layout object is flagged **out of date** (amber dot + ~50% opacity, clipped to the new boundary) with a Regenerate prompt — see state 08. This protects a reviewed layout from being silently rearranged.
- **Change (on a completed card):** re-enters that input's edit mode. Inside Auto compare this re-fits live; if an edit removes the wall/edge a marker sits on, that input reverts to unset and its step re-opens.

### Edge states (recreate as needed)
No boundary yet · plot with no buildings (entrance becomes a target point) · buildings captured by draw vs by select · no valid layout fits (usable area too small after buildings/setbacks) · candidate with warnings · applied layout out of date after the plot was reshaped.

## State Management
- `parkingMethod`: `'manual' | 'auto'`
- `boundary`: polygon geometry (null until drawn) → gates step 2
- `buildings`: array of `{ id, source: 'drawn' | 'selected', area, geometry }` (may be empty) → no-park zones
- `entrance`: `{ wallId, distanceAlongWall }` or a free target point when no buildings (null until placed) → anchors accessible bays; gates Create
- `accessPoint`: `{ edgeId, distanceAlongEdge }` (null until placed) → gates Create
- `settings`: `{ bayWidth: 2.4, bayLength: 4.8, aisle: 6.0, setback: 3.0, accessiblePct, stall: 'standard' }`
- `options`: array of generated layouts, each `{ id, spaces, rows, footprint, accessible, rotation, bays[], aisles[], warnings[] }`
- `selectedOptionId`
- `phase`: `'draw' | 'buildings' | 'entrance' | 'access' | 'ready' | 'generating' | 'compare' | 'applied'`
- Re-fit is triggered by changes to boundary, buildings, entrance, accessPoint, or settings while in `compare`.

## Design Tokens
**Colours**
- Primary violet `#6B2FE3`; pressed/stroke `#5A23D0`; bay stall line `#5A23D0`; boundary stroke `#7C4DFF`; light-violet accent `#C4B2F7`
- **Entrance / accessible-bay green** `#2FA37A` (wall highlight, entrance marker, dashed accessible-bay zone `rgba(47,163,122,.14)`); status-dot green also used on the "re-fit live" hint
- Violet tints: `#EDE6FE`, `#F1EBFE`, `#F5F0FE`, `#F8F5FF`, `#F7F4FE`, `#F3EFFD`; violet border `#DFD1FB` / `#E2D6FC` / `#E4DFF7` / `#E7DDFB`
- Text: primary `#26242A`, secondary `#57534E`, tertiary/muted `#8A857D` / `#7C766E`, disabled `#A8A29A`
- Neutrals/surfaces: page `#F3F1EC`, card `#FBFAF8`, white `#fff`; borders `#E9E5DF` / `#EEEAE4` / `#EFEBE5` / `#EAE6DF`
- Dark UI: `#231F2B` / `#3B3742`
- Warning (amber): bg `#FDF6EC`, border `#F2E3CB`, icon/stroke `#B07A1E`, text `#8A6318`; out-of-date accent `#E9A23B`
- Destructive: bg `#FEF1F1`, border `#FADCDC`, text `#E5484D`
- Building fill `rgba(38,36,42,.5–.62)` with dashed/solid `#F4F1EA` outline; circulation aisle `rgba(35,31,43,.4)`
- Satellite map base: greens `#4A5838`–`#4E5C3C` radial patches over an olive ground

**Typography**
- UI font: **Poppins** (400/500/600). Numeric/labels: **JetBrains Mono** (400/500/600).
- Sizes: window/section title 18px 600; sketch title 17px 600; inspector title 16px 600; body 12.5–14px; option space count 16–17px mono 600; mono micro-labels 10px 600, `letter-spacing:.12em`, uppercase.

**Radius:** buttons/pills 16–22px; cards 11–14px; window 16px; small chips 5–8px.
**Shadows:** window `0 1px 2px rgba(24,20,14,.05), 0 16px 36px rgba(24,20,14,.07)`; floating map controls `0 4px 12px rgba(20,16,10,.14)`; primary button `0 6px 16px rgba(107,47,227,.24)`.
**Spacing:** panel padding 13–18px; card padding 9–13px; gaps 7–14px. Left icon rail 52px; parking panel 300–312px; inspector 300px.

## Assets
- **Icons:** simple 1.6–2px stroke line icons (pin, search, layers, select cursor, polygon, parking, CAD cube, measure, save, export, sparkle, pen/draw, warning, gear, checkmark, close). Use SiteSketcher's existing icon set — the SVGs in the mock are stand-ins.
- **Map:** real satellite/hybrid tiles from the production map engine. No raster assets shipped.
- **Fonts:** Poppins + JetBrains Mono (Google Fonts) — or the app's existing equivalents.
- No AI-generated imagery is used.

## Files
- `SiteSketcher Auto Parking Guided.dc.html` — the prototype (all eight states, canvas layout). Logic (option data, selection handlers) is in its trailing `<script data-dc-script>` block.
- `support.js` — preview runtime only; **do not ship**.
- `screenshots/01-draw-boundary.png … 08-out-of-date.png` — full-window renders of each state.

Prior context (not in this bundle): earlier exploration compared three flows — 2a Guided (this one, chosen), 2b Reactive canvas, 2c Layout studio — in `SiteSketcher Auto Parking Flows.dc.html`.
