# Handoff: SiteSketcher — Map-based site sketching tool

## Overview

SiteSketcher is a map-based tool that lets users sketch site drawings on a Mapbox map to evaluate whether a store is viable at a given location. Users draw polygons to represent buildings and plots, drop parking blocks, overlay a CAD image of a store footprint, and save sketches to revisit later. The tool is **desktop and tablet (landscape) only** — phones get an "unsupported viewport" screen.

This is a **full redesign** of the existing SiteSketcher tool, matching the design language of the new SiteMatcher homepage (warm cream surfaces, ink text, violet accent, Inter + JetBrains Mono).

## About the design files

The HTML files in this bundle are **design references** — high-fidelity prototypes built with React + Babel inline JSX, served from a single HTML file. They show the intended visual design, layout, copy, and interaction states.

**They are not production code to copy directly.** The task is to recreate these designs in the SiteMatcher codebase's existing environment (likely React + Mapbox GL JS), using its established patterns, component library, and routing. If no codebase exists yet, choose the most appropriate framework for a real Mapbox-driven web app — React with `react-map-gl` or `mapbox-gl` directly is the obvious choice.

The mocked "map" in the design files is a stylised SVG aerial drawing, not a real Mapbox embed. In production, replace `<MapBackdrop>` with a real `mapbox-gl` map instance and render the polygon/parking/CAD overlays via Mapbox layers (or Konva/SVG overlay synced to the map's transform).

## Fidelity

**High-fidelity.** Exact colors, typography, spacing, copy, and interaction states are specified. Recreate pixel-perfectly using the codebase's component library, but the visual targets here are intentional.

## Tech assumptions

- **Mapbox GL JS** for the map (the user has confirmed this is the existing tech)
- **React** for the UI shell (assumed — adjust to actual stack)
- **Geometry**: polygons in GeoJSON; areas computed via `@turf/area`; distances via `@turf/distance`
- **Storage**: sketches saved server-side, keyed to the user; auto-save changes
- **Desktop/tablet only**: detect viewport ≥ 1024px landscape; show unsupported screen otherwise
- **Units**: metric default; conversion factor 1 m² = 10.7639 ft², 1 m = 3.281 ft

## Design tokens

### Colors
```
bg              #FBFAF7   page background (warm cream)
surface         #FFFFFF   cards, panels, top bar
ink             #171419   primary text, primary button
ink2            #4A4451   secondary text, body
ink3            #7C7588   tertiary text, metadata
ink4            #B5AEC0   disabled, dividers
border          #E8E4DC   default borders
borderSoft      #EFEBE2   subtle inner borders
borderHard      #D8D2C5   stronger borders (dashed dropzones)

violet          #7033FF   primary brand / active accent
violetDeep      #5421CC   pressed / strong accent text
violetTint      #EEE9FF   chip backgrounds, badges
violetTintSoft  #F5F1FF   selected row, info panels

orange          #F26B1F   coral polygon color, secondary accent
ok              #16A34A   success states
warn            #D97706   warning states
danger          #DC2626   destructive button text
warn bg         #FEF3C7   warning panel bg
warn border     #FCD34D   warning panel border
warn ink        #92400E   warning panel text
```

### Polygon palette (muted — default)
Six muted, harmonious colors so each polygon is distinguishable:
```
violet   stroke #7033FF  fill rgba(112, 51, 255, 0.18)
coral    stroke #F26B1F  fill rgba(242, 107, 31, 0.20)
teal     stroke #0F9488  fill rgba(15, 148, 136, 0.20)
amber    stroke #D97706  fill rgba(217, 119, 6, 0.20)
rose     stroke #E11D74  fill rgba(225, 29, 116, 0.18)
lime     stroke #65A30D  fill rgba(101, 163, 13, 0.20)
```
Two alternate palettes are exposed in Tweaks but the **muted** palette is the production default. Polygons cycle through this palette in order as the user adds them.

### Typography
- **Inter** (400, 500, 600, 700) — UI, body, headings
- **JetBrains Mono** (400, 500) — measurements, coordinates, kbd keys, monospace metadata labels

Type ramp:
```
display    22px / 600 / -0.3 letter-spacing   modal titles
h1         17px / 600 / -0.2                  modal title, sidebar header
h2         15px / 600 / -0.2                  panel title bold
body       13.5px / 500                        primary UI text
body sm    12.5px / 500                        secondary
caption    12px / 500                          hints
meta       11px / 500 mono                     coordinates
micro      10.5px / 600 mono uppercase 1.2px   panel section caps
nano       10px / 600 mono uppercase 1px       group labels
```

### Spacing
4 / 6 / 8 / 10 / 12 / 14 / 16 / 18 / 20 / 22 / 24 / 28 / 32 px scale. Common patterns:
- Card padding: 14–22px
- Panel section padding: `14px 16px 16px`
- Button padding: 9px × 14px (md), 6px × 10px (sm), 12px × 18px (lg)
- Row gaps: 4–10px (tight UI), 12–18px (form fields)

### Radii
- 4 — micro pills (key caps)
- 6 — small buttons
- 7–8 — inputs, tool buttons
- 9–10 — cards, panels
- 12 — large containers, drop zones
- 14 — modal header icon
- 16 — modal
- 999 — pills, badges, toggles

### Shadows
```
modal       0 40px 80px -20px rgba(20,10,40,0.4), 0 0 0 1px rgba(0,0,0,0.04)
dropdown    0 24px 60px -20px rgba(20,10,40,0.3)
popover     0 20px 50px -10px rgba(20,10,40,0.35), 0 0 0 1px rgba(0,0,0,0.04)
floating    0 14px 30px -10px rgba(20,10,40,0.2)
inset card  0 1px 3px rgba(20,10,40,0.08)
```

## App shell

```
┌─────────────────────────────────────────────────────────────┐
│  TOP BAR  56px                                              │
├──┬──────────┬───────────────────────────────────────┬───────┤
│ R│  LEFT    │                                       │ RIGHT │
│ A│  PANEL   │            MAP CANVAS                 │ INSP. │
│ I│  304px   │            (flex)                     │ 320px │
│ L│          │                                       │       │
│56│          │                                       │       │
│  │          │                                       │       │
└──┴──────────┴───────────────────────────────────────┴───────┘
```

- **Top bar (56px)**: logo · breadcrumb (folder / project name + saved badge) · search (centered, max 600px) · undo/redo · share · save · avatar
- **Left rail (56px)**: tool buttons (Select, Polygon, Parking, CAD, Measure) at top; divider; Saved-sketches button at bottom
- **Left panel (304px)**: contextual — content swaps based on selected tool / panel
- **Map canvas**: fills remaining horizontal space; floating controls top-right; status bar bottom (lat/lon, zoom, scale bar)
- **Right inspector (320px)**: details/edit for the currently selected object (or empty state)

### Floating map controls (top-right of map, stacked, 8px gap)
1. **2D / 3D segmented toggle** — dark ink background when active
2. **m / ft units toggle** — same segmented style, mono labels
3. **Map style card** (132px wide): "Satellite / Hybrid / Streets" radios + a "Side labels" toggle row (controls polygon edge distance annotations)
4. **Zoom + compass stack**: +, −, compass

### Status bar (bottom of map, 12px from edges, pointer-events disabled except contents)
- Left pill: contextual status (e.g. "DRAWING POLYGON · 4 points placed · 90° lock ON")
- Right side: scale bar (e.g. "20 m" with tick marks) + extra status

## Tools (left rail, top group)

Active tool = highlighted (ink fill, white icon). Each tool changes:
- The left panel content
- The cursor behavior on the map
- The right inspector's empty-state copy
- The keyboard shortcut hints in the rail (small mono shortcut in the corner of each tool button — V, P, K, C, M)

| Tool      | Shortcut | Left panel shows                                          |
|-----------|----------|-----------------------------------------------------------|
| Select    | V        | Layers manager (search, filter chips, grouped list)       |
| Polygon   | P        | 90° toggle, colour swatch, edge-distances toggle, grid snap |
| Parking   | K        | Spaces count, single/double, stall size, footprint preview |
| CAD       | C        | Upload dropzone OR placed-image config                     |
| Measure   | M        | Two-point chain ruler with per-segment + total readout     |

## Panels (left rail, bottom group)

| Panel           | Notes                                                                  |
|-----------------|------------------------------------------------------------------------|
| Saved sketches  | List of all user sketches; filter; open flies the map to that location |

Layers manager **is the default left-panel content** when the Select tool is active — there is **no separate "Layers" rail icon**, because it would be redundant with the default sidebar.

## Screens & states (in order of priority)

### 1. Empty / fresh map
- Onboarding card in left panel: violet circle icon, "Start sketching" heading, three buttons (Draw a polygon / Add parking / Upload CAD), a "Shortcut" hint about searching postcodes
- Map shows a faint center crosshair
- Right inspector shows empty state (Nothing selected)
- Status bar: "Ready · 0 polygons"

### 2. Drawing a polygon
- **Left panel** — "Draw polygon" with violet info card explaining clicks, 90° toggle, colour swatches (6 muted swatches in 6-col grid), edge-distances toggle, grid-snap toggle, and a shortcuts grid (Finish ↵, Cancel last ⌫, Toggle 90° ⇧, Close: click first point)
- **Map** — placed points as white circles with violet border; live edge to cursor is dashed; back-to-start hint line is dashed and lower-opacity; first point gets a target ring as click-to-close affordance; small square+dot icon at the corner of the last edge indicates 90° lock is on; tooltip near cursor: violet pill "Click to place · 90° lock"
- **Edge distance pills** — dark `rgba(23,20,25,0.92)` background, mono cream text, rotated to align with each edge (auto-flip if upside down)
- **Right inspector** — "Drawing — Plot A" header, list of placed edges with mono lengths, big violet "Current area" readout, primary "Finish polygon" button, "Undo last point", destructive "Cancel drawing"
- **Status bar** — pulsing violet dot + "DRAWING POLYGON · 4 points placed · 90° lock ON"

#### 90° mode
When toggled on, the next edge being drawn snaps to the nearest cardinal angle (0°/90°/180°/270°) relative to the previous edge. Render a small square indicator at the last vertex while in this mode.

#### Edge distances
Live during drawing. After completion, toggleable per-polygon (default on) and globally via the floating map control "Side labels" toggle.

### 3. Polygon selected
- **Map** shows multiple polygons. The selected one has corner handles (small white squares with colored border) at every vertex, plus a rotation handle floating above the bounding box (dashed line + circle with curved arrow)
- **Left panel** = Layers manager:
  - Totals strip (Total area, Layers count) at top
  - Filter input + chip filters (All / Polygons / Parking / CAD with counts)
  - Grouped list (Buildings / Parking) — each group has count + collapse caret
  - Each row: drag handle · color swatch (with type glyph for parking/CAD) · name + detail · eye (visibility) · more (⋯)
  - Selected row has violet-tinted background and a 3px violet left border
- **Right inspector** = polygon details:
  - Selected header (color swatch + name + point count)
  - Measurements (Area accent-colored to match polygon, Perimeter)
  - **Width × Depth** row with hint "Smallest rectangle this shape fits in — useful for plot sizing"
  - Transform: rotation slider with degree readout, "Snap to N" and "Reset" buttons
  - Display: edge distances toggle, area readout toggle, colour swatches
  - Footer: Duplicate · Delete polygon (danger)

### 4. Parking workflow
- **Left panel** — info card, "Number of spaces" stepper input (− / value / +), Layout segmented (Single row / Double row), Stall size as two big buttons (Standard 2.4×4.8 / Larger 2.7×5.0), live "Block footprint ~XYZ m²" readout, primary "Drop on map" violet button
- **Map** — placed blocks render as N×rows grids with stall dividers and a 3px curb on the leading edge; selected block gets corner handles + rotation handle; ghost-block follows cursor at 65% opacity; cursor tooltip "24 spaces · click to place"
- **Right inspector** = parking details: stall size + layout segmented controls, spaces input, total spaces / area metrics, danger delete button

### 5. CAD image flow (3 steps)

**5a. Upload — empty state in left panel**
Dropzone card with violet upload icon, "Upload a CAD image", "PNG · JPG up to 20 MB", "Choose file" button, and a "How it works" 4-step explainer.

**5b. CAD image uploaded, ready to calibrate**
- Map area is dimmed (`rgba(20,14,34,0.55)`) and the uploaded PNG sits centered as a white photo-frame card with a 6px white border
- Left panel: file card (icon, name, dimensions, ×), violet "Next — calibrate" info card with 3-step ol, primary "Calibrate scale" button, ghost "Replace image" link
- Status: "CAD UPLOADED · storeplan_v3.png · 2400 × 1680 · awaiting calibration"

**5c. Two-point calibration**
The user clicks two points on their image to mark a known distance, then types how long that line is in real life. We compute the px-to-metres scale from that.
- **Map area**: dimmed `rgba(20,14,34,0.6)`; image centered; two violet dots labelled "A" and "B" connected by a violet line with a centered violet pill "48.0 m"; cursor tooltip "A–B set · enter distance →"
- **Left panel**:
  - 3-step progress bar (Upload ✓ done · Calibrate active · Place pending)
  - Violet info card explaining what to click
  - "Points" list — each row shows a violet circle "A"/"B", label, mono coord, green check
  - **Real-world distance** input with unit toggle (m/ft)
  - "Resulting scale" / "Implied footprint" two-column readout in a card
  - Yellow warning: "Once placed, the image size is locked. You can only move and rotate it on the map."
  - "Reset points" ghost + "Confirm & place" violet primary

**5d. CAD image placed**
- Map shows the PNG rotated and at 70% opacity over the satellite, with a violet 2px outline, corner handles, and a rotation handle. A small violet label tab in the top-right reads "storeplan_v3 · 1,632 m²" (counter-rotated so it stays upright).
- Left panel = file card + locked-scale display ("1 px = 0.0238 m" with Recalibrate link) + position buttons (Move / Rotate)
- Right inspector = CAD image header + Real-world dimensions (Footprint, Width × Depth) + Transform (Rotation slider, **Opacity slider**, lock notice) + actions (Recalibrate scale, Replace image, Remove from map)

### 6. Saved sketches (Saved-sketches panel active)
- Left panel = filter input at top + scrollable list. Each sketch card: name, location, mono metadata (polygons count · last updated), more (⋯). Active item has violet-tint background, violet 1px border, and a small "Open · flying to location" status block.
- Right inspector when a sketch is highlighted = "Sketch info" panel (name, location, "FLYING TO LOCATION…" with pulsing dot), "Contents" list of layers inside the sketch with mini swatches + areas, "Activity" (last edited, created, auto-save note), action buttons: Open sketch (primary), Share link (ghost), Delete sketch (danger).
- Map shows the sketch overlay with two concentric dashed targeting rings around the center to communicate the fly-to animation.

### 7. 3D mode
- Polygons render extruded — base footprint + simulated side faces in stroke color at varying opacities (0.25 / 0.40 / 0.55 for back / side / front), top face uses fill+stroke; top edge gets corner handles + rotation handle.
- Subtle dark vignette overlay (`linear-gradient(180deg, rgba(0,0,0,0.18), rgba(0,0,0,0), rgba(0,0,0,0.25))`).
- Left panel: Layers · **Building heights** with per-building sliders · **Camera** with Pitch and Bearing sliders (degrees readout in mono on the right).
- Real Mapbox 3D uses `map.setPitch(pitch)` + `map.setBearing(bearing)` and `fill-extrusion` layers for the polygons. Heights live in the polygon's properties.

## Flows & modals

### Search (top-bar autocomplete)
- Wider focused search bar (560px, violet ring), placeholder "Search a location, postcode or address…"
- Dropdown panel with two sections separated by a divider:
  1. "Locations · powered by Mapbox" — featured first match has violet-tint background and ↵ hint
  2. "From your sketches" — folder icon, matching saved sketches
- Selecting a location flies the map there.

### Save sketch (modal, 520px)
- Name input (defaults to "Untitled sketch" until first save)
- Folder picker (breadcrumb display "My sketches / UK · 2026")
- "What we're saving" card — six rows: Location coords, Zoom level + style, Polygons, Parking blocks, CAD overlays, Total area
- "Keep auto-saving from now on" toggle (default on)
- Footer: Cancel (ghost) · Save sketch (violet primary)

### Share sketch (modal, 500px)
- Share link with inline Copy button (ink fill)
- Access segmented control: Only me / Anyone with link / My team
- "Invite by email" row with email input + role select + Invite button
- "People with access" card listing existing collaborators (avatar circle, name, email, role)
- Footer: Done (ghost) · Copy link (primary)

### Delete confirmation (modal, 420px)
- Title states what's being deleted
- Subtitle mentions the undo window (30 seconds, available from top bar)
- Subject card: color swatch + name + mono metadata ("612 m² · 4 points · created 2 days ago")
- Footer: Cancel (ghost) · Delete polygon (danger button, `#DC2626` fill)

### Right-click context menu (popover, 240px)
Position at click coords. Items:
- Move
- Rotate (R)
- Snap to 90° grid (⇧G)
- Duplicate (⌘D)
- ―
- Hide layer (H)
- Bring to front (])
- Send to back ([)
- ―
- Delete polygon (⌫, danger)

### Saved sketches — empty (first time)
Centered card in left panel: large violet folder icon, "No saved sketches yet", "Sketches you save will show up here. Hit ⌘S any time to save your current map.", "Start a new sketch" violet button.

### Unsupported viewport (phone portrait)
Full-screen message: logo, big violet cube icon, heading "Best on a bigger screen", paragraph explaining tablet/desktop only, "Try instead" card with two bullets (browse saved sketches, email yourself a link), "Email me a link" button.

## Interactions & behavior

### Polygon drawing
1. User clicks Polygon tool (P).
2. Click on map → place first point. Cursor changes to crosshair.
3. Subsequent clicks add vertices; a dashed line previews the next edge from last placed point to cursor.
4. Distance pills appear at the midpoint of every edge, rotated to lie along the edge (auto-flip if angle > 90° or < −90° so text stays right-side-up).
5. **90° lock (shift held OR toggle on)** — snap the next edge to nearest 90° relative to previous edge.
6. **Close** — click within ~14px of the first point, or press ↵.
7. **Undo last point** — ⌫.
8. **Cancel drawing** — Esc, or the danger button in the inspector.

### Polygon selection & edit
- Click polygon body to select. Selected polygon shows corner handles (small white squares with colored border, 8×8) at each vertex and a rotation handle (circle on a dashed line) above the bounding box.
- **Drag body** → move polygon (translate all vertices)
- **Drag a corner handle** → move that vertex only
- **Drag rotation handle** → rotate the entire polygon about its centroid (cursor changes to rotate icon)
- **Right-click** → context menu (see above)
- **⌫ when selected** → delete (no confirm for single objects; 30s undo)
- Holding Shift while rotating snaps to 15° increments.

### Parking
- Configure block in left panel; the panel updates a live "Block footprint" readout.
- Press "Drop on map" or just click anywhere on the map. The block follows the cursor as a 65%-opacity ghost until clicked.
- Once placed, the block is a single selectable object — drag to move, rotation handle to rotate, ⌫ to delete.
- Single row = 1 row of stalls; double row = 2 rows back-to-back (no aisle).
- Stalls are oriented with their length (4.8 m / 5.0 m) perpendicular to the curb.

### CAD calibration
1. User uploads a PNG or JPG (drag-drop or browse).
2. Image appears in the map area as a centered photo-frame card. **No automatic CAD parsing — it's a raster image.**
3. User clicks "Calibrate scale" or the tool advances automatically to the calibration step.
4. User clicks **point A** on the image — anywhere they know the real-world distance from.
5. User clicks **point B** — the other end of that known distance. A violet line connects them with a "0.0 m" label.
6. User types the real-world distance in the input (m or ft toggle).
7. We compute `metres_per_pixel = real_world_distance / pixel_distance(A, B)`.
8. User clicks "Confirm & place". Image drops onto the map at the current map center, scaled so 1 image pixel = `metres_per_pixel` real-world metres.
9. **Size is now locked.** User can only translate and rotate the image (no resize handles, only corner translate handles + rotation handle).
10. Opacity slider in the inspector lets the user see the satellite underneath.
11. "Recalibrate scale" restarts the two-point calibration flow.

### Saving & loading
- **Save** (⌘S or top-bar button) — first save opens the Save modal. Subsequent saves write quietly to the same sketch.
- **Auto-save** — once a sketch has a name, every change auto-saves after a 1s debounce. Top-bar "Saved" badge reflects current state ("Saved", "Saving…", "Unsaved changes").
- **Open sketch** — click a row in the Saved sketches panel. Map flies to the sketch's saved viewport (center, zoom, pitch, bearing) over ~1.2s with a Mapbox `flyTo`. Two concentric dashed rings pulse at the target during the flight. Once landed, all polygons / parking / CAD render in.
- **Delete sketch** — danger action with confirmation modal.

### Units
- Toggle lives in the floating map controls (m / ft segmented).
- Switching is instantaneous — all readouts re-render from the source SI value.
- Persists per-user (localStorage + server-side preference).
- Conversions: `ft = m × 3.281`, `ft² = m² × 10.7639`.

### Undo / redo
- ⌘Z / ⌘⇧Z (top-bar buttons too)
- 30-second visible undo for destructive actions; full session history for the current sketch.

## State management

Suggested shape (whatever framework you choose):

```ts
type Sketch = {
  id: string;
  name: string;
  location: { lat: number; lng: number; zoom: number; pitch: number; bearing: number };
  polygons: Polygon[];
  parkingBlocks: ParkingBlock[];
  cadImages: CadImage[];
  createdAt: string;
  updatedAt: string;
};

type Polygon = {
  id: string;
  name: string;            // "Plot A — Main building"
  colorIndex: number;      // 0..5 — index into the palette
  points: [lng, lat][];    // GeoJSON-style (closed ring)
  rotation: number;        // degrees, applied around centroid
  height?: number;         // metres, for 3D
  showDistances: boolean;
  showArea: boolean;
};

type ParkingBlock = {
  id: string;
  spaces: number;
  layout: "single" | "double";
  stallSize: "standard" | "larger"; // 2.4×4.8 vs 2.7×5.0
  anchor: [lng, lat];      // bottom-left in unrotated coords
  rotation: number;
};

type CadImage = {
  id: string;
  fileName: string;
  url: string;             // upload destination, served back as a tile/image
  metresPerPixel: number;  // from calibration
  anchor: [lng, lat];      // center in real-world coords
  rotation: number;
  opacity: number;         // 0..1, default 0.7
  imageWidthPx: number;
  imageHeightPx: number;
};

type UiState = {
  activeTool: "select" | "polygon" | "parking" | "cad" | "ruler";
  activePanel: "layers" | "saved" | null;
  units: "metric" | "imperial";
  mapStyle: "satellite" | "hybrid" | "streets";
  view: "2d" | "3d";
  sideLabelsOn: boolean;
  selectedId: string | null;
  drawing: PolygonInProgress | null;
};
```

## Iconography

All icons are 16×16, 1.6px stroke, currentColor, line-style. The design file includes `<Ico name="..." />` with a complete set: cursor, polygon, parking, cad, ruler, right, rotate, trash, search, layers, save, folder, upload, plus, minus, close, check, more, eye, eyeoff, cube, square, drag, pin, undo, redo, compass, lock, share. Match these or use the codebase's icon set if it has equivalents — the names map cleanly to Lucide / Heroicons.

## Files in this bundle

| File                          | Contents                                                            |
|-------------------------------|---------------------------------------------------------------------|
| `SiteSketcher.html`           | Main entry — wires everything together via a Design Canvas          |
| `sitesketcher-core.jsx`       | Design tokens (`SS`), polygon palette (`POLY`), icon set (`Ico`), logo (`SMLogo`), map backdrop SVG (`MapBackdrop`), polygon primitive (`SketchPolygon`), parking primitive (`ParkingBlock`) |
| `sitesketcher-chrome.jsx`     | Reusable atoms (button, input, segmented, toggle, panel) + top bar, left rail, left panel shell, status bar, floating map controls |
| `sitesketcher-panels.jsx`     | Left-panel content for each tool (PolygonToolConfig, ParkingToolConfig, CADToolConfig, LayersList, SavedSketches) + right inspectors |
| `sitesketcher-states.jsx`     | Composed screens: Empty, Drawing, Selected, Parking, CAD (placed), Saved, 3D |
| `sitesketcher-flows.jsx`      | Modal/flow screens: Save, Share, Delete, Context menu, CAD upload, CAD calibration, Measure tool, Search, Saved empty, Unsupported viewport |
| `design-canvas.jsx`           | Utility — pan/zoom canvas used to present all artboards side-by-side. **Not part of the production app.** |
| `tweaks-panel.jsx`            | Utility — design-time tweaks panel. **Not part of the production app.** |
| `screenshots/`                | PNG renders of every artboard at native size — quick reference for visual targets |

## Screenshots

Every screen state rendered at its native size. Open the matching PNG when implementing each section.

### Primary states (1440 × 900)
| File                                  | Screen                                                                  |
|---------------------------------------|-------------------------------------------------------------------------|
| `screenshots/01-empty.png`            | Empty / fresh map — onboarding card                                     |
| `screenshots/02-drawing.png`          | Drawing a polygon, 90° lock on, distance pills live                     |
| `screenshots/03-selected.png`         | Polygon selected — Layers panel + Plot C with handles & rotation        |
| `screenshots/04-parking.png`          | Parking tool — block configuration + ghost block on cursor              |
| `screenshots/05-cad-placed.png`       | CAD raster image placed at 70% opacity on satellite                     |
| `screenshots/06-saved.png`            | Saved sketches panel — opening sketch with fly-to targeting rings       |
| `screenshots/07-3d.png`               | 3D mode — extruded polygons with pitch/bearing                          |

### Tablet landscape (1180 × 820)
| File                                  | Screen                                                                  |
|---------------------------------------|-------------------------------------------------------------------------|
| `screenshots/08-tablet-drawing.png`   | Drawing — tablet                                                        |
| `screenshots/09-tablet-selected.png`  | Selected — tablet                                                       |
| `screenshots/10-tablet-3d.png`        | 3D — tablet                                                             |

### Flows & modals (1440 × 900)
| File                                  | Screen                                                                  |
|---------------------------------------|-------------------------------------------------------------------------|
| `screenshots/11-search.png`           | Search active — geocoder results dropdown                               |
| `screenshots/12-measure.png`          | Measure tool — multi-segment ruler chain with totals                    |
| `screenshots/13-context-menu.png`     | Right-click context menu on selected polygon                            |
| `screenshots/14-save-modal.png`       | Save sketch modal                                                       |
| `screenshots/15-share-modal.png`      | Share sketch modal — link, access, invitees                             |
| `screenshots/16-delete-modal.png`     | Delete confirmation modal                                               |
| `screenshots/17-cad-upload.png`       | CAD image uploaded, ready to calibrate                                  |
| `screenshots/18-cad-calibrate.png`    | CAD two-point calibration step                                          |
| `screenshots/19-saved-empty.png`      | Saved sketches — empty / first-time user                                |

### Unsupported (414 × 780)
| File                                  | Screen                                                                  |
|---------------------------------------|-------------------------------------------------------------------------|
| `screenshots/20-unsupported.png`      | Phone portrait — "Best on a bigger screen" message                      |

## Notes & gotchas

- **Polygon area is computed on the geodesic** in production (use `@turf/area`), not on flat pixel coords as the mock does. Display rounded to nearest m²/ft².
- **Edge distances** use great-circle distance (`@turf/distance`) since polygons can be large enough that flat-plane distance is wrong at high latitudes.
- **CAD images** are placed at a specific lat/lng anchor and rendered as a Mapbox `image` source + `raster` layer. The scaling stays consistent at all zooms because the image's geographic bounds are fixed at placement time.
- **3D extrusions** use Mapbox `fill-extrusion-height` driven by the polygon's `height` property. Match the shading by relying on Mapbox's default 3D shading + a subtle vignette overlay div on top of the map.
- **Side-label toggle** is global *and* per-polygon. Treat the global as a default; per-polygon override survives.
- **No CAD vector parsing.** Earlier designs imagined parsing DWG/DXF; the actual flow is image upload + two-point manual calibration. This is intentional and much simpler to ship.
- The mocked search dropdown shows Mapbox geocoder results — use the real Mapbox Geocoder API in production.
- The "Saved" green pill in the breadcrumb is a state indicator. Variants: `Saved` (green), `Saving…` (amber, mono italics), `Unsaved changes` (orange).
