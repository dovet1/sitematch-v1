# Handoff: SiteSketcher automatic parking layouts

## Overview
Adds an **Auto layout** method to SiteSketcher's existing Parking tool. Users either place parking blocks manually (unchanged) or generate a complete concept parking layout inside a selected site boundary. Everything happens inside the existing left panel / map / right inspector structure — no wizard, no separate page, map stays dominant.

## About the design files
`SiteSketcher Auto Parking.dc.html` in this bundle is a **design reference written in HTML** — a prototype of the intended look and behaviour, not production code to copy. Recreate it in the SiteSketcher codebase using its existing environment, components and map layer APIs (React + Mapbox GL in the reference screenshots' product). If no environment exists yet, pick the framework that best fits and implement the states there. The map in the prototype is a stylised stand-in; the real implementation draws these features as Mapbox GL layers over the live basemap.

## Fidelity
**High fidelity.** Colours, type, spacing, radii and copy are final-intent. Recreate pixel-close using existing SiteSketcher primitives (panel sections, segmented controls, steppers, property inspector rows, destructive button).

## Screens / views
Screenshots in `screenshots/`, one per state.

### 01 — Parking method choice (`01-parking-method-choice.png`)
Purpose: user picks how to create parking. Manual is the default so existing behaviour is untouched.
Layout: app header 64px; left rail 56px; left panel 322px; map fills the rest (no inspector).
Panel order: sketch header (‹ Sketches + UNSAVED CHANGES, "Untitled Sketch" + Save), 5-item tool row (Select / Polygon / Parking / CAD / Measure — Parking active), `PARKING METHOD` section, then the existing manual block controls (SPACES stepper 10, LAYOUT Single/Double, STALL SIZE Standard/Larger, BLOCK FOOTPRINT 24.0 × 4.8 m).
Method control: 2-up segmented, container `#F6F4F0` + 1px `#EAE6DF`, radius 13, 4px padding; active segment `#6B2FE3` fill, white 600 13.5px label, radius 9; inactive label `#57534E`, hover fill `#EFECE6`. Icons: car outline (Manual), 4-point spark (Auto layout).
Copy: selected description "Place and configure individual parking blocks." (`#7C766E`); the other method's one-liner sits under it in `#A29C93`: "Auto layout — generate parking bays and circulation within a site boundary."

### 02 — Auto layout setup (`02-auto-layout-setup.png`)
Purpose: show the two required inputs and the automatically detected exclusions.
Panel: method segmented (Auto layout active) → `REQUIRED` status rows → `LAYOUT SETTINGS` (scrollable) → pinned footer with the primary action.
Status rows (radius 11, `#FBFAF8`, border `#EFEBE5`): "Site boundary / Plot A · 1.59 ha" with violet check + text action "Change"; "Buildings detected / 1 polygon · 1 CAD overlay" + "Review"; "Vehicle access / Click a boundary edge on the map" in pending style (border `#DFD1FB` 1.5px, bg `#F8F5FF`, dashed 20px circle, violet helper text).
Settings: Stall size segmented (Standard/Larger) + mono caption "2.4m × 4.8m per space"; three compact cards in a 3-col grid — Drive aisle 6.0 m, Setback 3.0 m, Bldg clear. 5.0 m; "Advanced settings" disclosure row (chevron).
Footer: full-width pill 46px; disabled state bg `#E7E2DA`, label `#A8A29A`; helper below, centred, "Set a vehicle access point to continue".
Map: violet boundary (fill `rgba(107,47,227,.16)`, stroke `#7C4DFF` 3.5px) with 4 white vertex handles; internal polygon and the CAD overlay that crosses the boundary both rendered as exclusions (dark `rgba(38,36,42,.55)` fill, cream dashed 2px outline, CAD additionally hatched at 35°); white map labels "Building · polygon", "CAD overlay · crosses boundary". Top-left toast card: violet check + "2 buildings detected" / "Treated as parking exclusions" + "Review". Floating 2D/3D, m/ft and Map Style controls unchanged, right side.

### 03 — Access point + review (`03-access-point-and-detected-buildings.png`)
Purpose: place the access point; confirm what was detected.
Review expanded: the Buildings row becomes a violet-bordered container whose action flips to "Hide", with a white sub-list — "Building A · polygon / inside", "BBS2025 Type 15 · CAD / crossing" (12px colour chip, mono right-hand qualifier).
Access row now reads "South edge · 42 m from corner" with action "Move".
Advanced settings open: Check vehicle manoeuvring (on), One-way circulation (off), Gate queue allowance 12 m, Reserve accessible bays (on) + 6% slider.
Footer: enabled primary — `#6B2FE3`, shadow `0 6px 16px rgba(107,47,227,.24)`, spark icon + "Create layouts"; helper "Generates up to 3 concept options".
Map: hovered boundary edge thickened (`#C4B2F7`, 9px, round caps); detected objects outlined `#C4B2F7` 3px; access marker = 11px violet dot with 3px white ring plus a pulsing 26px halo (2.4s ease-in-out); dashed white corridor arrow pointing into the site; dark tooltip "Vehicle access here / click to place · drag to move".

### 04 — Generating (`04-generating.png`)
Purpose: restrained progress; nothing is written to the sketch yet.
Panel: status rows dimmed to 50% opacity; primary button becomes `Creating layouts…` with an 17px white spinner (0.9s linear); checklist card — "Boundary and exclusions read" ✓, "Access corridor set out" ✓, "Fitting bays and aisles" (spinner), "Comparing options" (empty ring, `#A8A29A`); note "Usually under 10 seconds. You can keep panning the map."; outline "Cancel" returns to state 03 with inputs intact.
Map: boundary, buildings and CAD stay fully visible; faint candidate rows at 14–22% white; one 6px white sweep bar animating down the boundary (2.2s linear infinite); top-left card "Testing bay orientations…".

### 05 — Candidate comparison (`05-candidate-comparison.png`)
Purpose: compare up to three concept layouts; selection updates the map instantly.
Panel: `CONCEPT LAYOUTS · 3` + text action "Regenerate"; three cards (radius 13, border `#EFEBE5`, hover `#DCD6CD`). Selected card gets a 2px `#6B2FE3` ring + `rgba(107,47,227,.05)` tint. Each card: "Option N", mono figure (112 / 126 / 131) + "spaces", then mono meta row (rows, m², accessible). Option 2 carries the `BEST YIELD` chip (10px mono, `#6B2FE3` on `#F1EBFE`, border `#E2D6FC`). Option 3 carries an amber warning block (`#FDF6EC` / `#F2E3CB` / text `#8A6318`): "6 bays fall within the 5 m building clearance. Manoeuvring check failed on 1 row."
Sticky footer: disclosure paragraph "Concept layout only. Review planning compliance, accessibility, vehicle tracking, gradients, drainage and detailed highway design separately."; primary "Use this layout"; secondary pair "Adjust settings" / "Regenerate".
Map: bays = near-white fill with 1.2px violet stall lines every 11px, stroke `#5A23D0` 1.6px; aisles = `rgba(35,31,43,.42)`; access corridor = dashed white 2px, 28–30% white fill; parking group is masked by the site polygon **minus** the exclusions plus clearance, so no bay ever crosses a building or CAD; option changes bay rotation (−7° / −9° / −13°), row count and aisle positions. Top-left "Option N preview · N spaces · CONCEPT"; bottom-left legend for bays, aisle, corridor, access point, exclusions.

### 06 — Applied layout (`06-applied-layout-and-inspector.png`)
Purpose: the result behaves like any other SiteSketcher object.
Left panel returns to Select: `PLOTS · 1` Plot A 1.59 ha; `PARKING · 2` — "Auto layout 1 / 126 sp" as a selected grouped card (1.5px `#6B2FE3`, bg `#F8F5FF`, spark icon, mono sub-line "7 rows · 8 accessible · concept") and the untouched "Parking 1 / 10 sp"; `CAD OVERLAYS · 1`.
Right inspector (322px, scrollable, header "Auto parking layout" + close): Name field "Auto layout 1"; TOTAL SPACES card 126 with Standard 118 / Accessible 8 / Footprint 3,340 m²; property rows — Stall size Standard · 2.4 × 4.8 m, Aisle width 6.0 m, Boundary setback 3.0 m, Building clearance 5.0 m, Exclusions used 1 polygon · 1 CAD; concept disclosure; outline "Edit layout settings" and "Regenerate"; destructive "Remove from Sketch" (`#FEF1F1` bg, `#FADCDC` border, `#E5484D` text, radius 14). No per-bay editing affordances.
Map: applied layout plus the manual "Parking 1 · manual" block; bottom-left chip "CONCEPT — Parking-yield estimate — not a construction layout".

### 07 — Edge states (`07-edge-states.png`)
Five annotated panel snippets, all handled in the same left panel:
1. **No site boundary** — "Draw a site boundary to continue", actions "Draw polygon" (primary) / "Use Manual". Switching tools keeps Auto layout armed and returns when the plot closes.
2. **Multiple possible boundaries** — "Pick the site boundary", candidate list (Plot A 1.59 ha selected, Plot B 0.74 ha); hovering a row highlights the polygon; largest enclosing plot pre-highlighted; map click also selects.
3. **No valid layout** — amber card, "No layout fits these settings", cause ("usable area is 18 m wide — under one bay plus aisle") and remedies; panel returns to settings, nothing added to sketch.
4. **Candidate with warnings** — warning lives in the card, never blocks "Use this layout", and follows the object into the inspector.
5. **Out of date** — amber "Layout out of date / Plot A was reshaped after this layout was generated" + "Regenerate"; list shows an amber dot on the object and the map draws it at 55% opacity.

## Interactions & behaviour
- Selecting Parking shows the method segmented control; Manual is the default and remembered per sketch. ←/→ moves between methods.
- Switching to Auto layout replaces the block controls in place. Existing selection is reused as the boundary when it is a single outer polygon.
- Detection runs on entering Auto layout and on any geometry change: every polygon or CAD overlay wholly inside, partially inside or crossing the boundary becomes an exclusion. Users never redraw them. Review toggles highlight + list; a row can be unticked to drop it from the calculation.
- Access point: hovering the boundary thickens the nearest edge, click snaps the marker to it, drag moves it along the edge, Esc cancels.
- Create layouts is disabled until boundary + access exist, with the reason inline. Generation is non-blocking (map stays pannable); Cancel restores state 03.
- Selecting a candidate re-renders the map preview immediately, no confirm. "Use this layout" commits one grouped object; "Adjust settings" returns to the settings state with values intact; "Regenerate" re-runs.
- After a boundary / polygon / CAD change, the applied layout is marked out of date (amber dot, 55% map opacity) until regenerated or dismissed.
- Animations: spinner 0.9s linear; generation sweep 2.2s linear; access halo pulse 2.4s ease-in-out; panel section transitions should match existing SiteSketcher disclosure timing.

## State management
`parkingMethod: 'manual' | 'auto'`; `boundaryId`; `detectedExclusions: [{id, type: 'polygon'|'cad', relation: 'inside'|'crossing', included}]`; `accessPoint: {edgeId, distanceAlong}`; `settings: {stallSize, aisleWidth, setback, buildingClearance, checkManoeuvring, oneWay, gateQueue, accessibleBays:{on, percent}}`; `generation: 'idle'|'running'|'failed'`; `candidates: [{id, spaces, rows, footprint, accessible, bestYield, warnings[], geometry}]`; `selectedCandidateId`; `appliedLayouts[]` each with `stale` flag and a hash of boundary + exclusion geometry + settings.
Generation should run off the main thread (worker or server) and return candidate geometry as GeoJSON: bay rows, aisles, access corridor, plus per-candidate metrics and warnings.

## Design tokens
Colours — violet primary `#6B2FE3`; map stroke `#7C4DFF`; bay stroke `#5A23D0`; violet tints `#F1EBFE`, `#F8F5FF`, `#F5F0FE`, `#EDE6FE`, border `#E2D6FC` / `#DFD1FB`; text `#26242A` primary, `#57534E` secondary, `#7C766E`, `#8A857D`, `#A29C93` muted; surfaces `#FFFFFF`, `#FBFAF8`, `#F6F4F0`; borders `#EEEAE4`, `#EFEBE5`, `#EAE6DF`, `#E6E1D9`; amber warning bg `#FDF6EC`, border `#F2E3CB`, text `#8A6318`, icon `#B07A1E`; destructive `#E5484D` on `#FEF1F1` / `#FADCDC`; map exclusion `rgba(38,36,42,.55)`, aisle `rgba(35,31,43,.42)`, boundary fill `rgba(107,47,227,.12–.16)`.
Type — Poppins 400/500/600 for UI (12–19px; panel titles 19/600, section body 13.5/400, chips 12–13.5); JetBrains Mono 400/600 for section labels (10.5px, uppercase, letter-spacing .12em) and all numerics.
Spacing — panel padding 20px horizontal, 14–18px vertical; section gaps 8–16px; rail 56px, panels 322px, header 64px.
Radii — 6 chips, 9–13 cards and segments, 14 panels/cards, pills = height/2.
Shadows — panel/frame `0 1px 2px rgba(24,20,14,.05), 0 14px 34px rgba(24,20,14,.06)`; floating map controls `0 4px 14px rgba(20,16,10,.14)`; map toasts `0 6px 20px rgba(20,16,10,.18)`; primary button `0 6px 16px rgba(107,47,227,.24)`.

## Assets
None external. Icons are inline outline SVGs (1.6px stroke, 24px grid) matching the current set: cursor, hexagon, car, layers, ruler, pin, search, spark, check, chevron, alert, download, save, close. Satellite imagery in the screenshots is an indicative CSS stand-in — use the live Mapbox basemap.

## Files
- `SiteSketcher Auto Parking.dc.html` — all six primary states plus the edge-state panel snippets on one canvas (candidate selection is live).
- `screenshots/01…07-*.png` — one image per state, in flow order.
