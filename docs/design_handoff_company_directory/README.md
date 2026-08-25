# Handoff: Company Directory — Occupier Profile

## Overview
The **Directory** is a card-based browser of the retail market inside the SiteMatcher workspace. It connects three entity types:

- **Brands (occupiers)** — retailers who are expanding: their estate, in-house team, and live requirement.
- **In-house expansion teams** — the people at a brand who acquire sites.
- **Agents (agency reps)** — retained surveyors acting for one or more brands.

The graph is navigable: **Brand → Agent → other Brands** and back. This handoff focuses on the **brand ("occupier") profile page** — the detail view reached by clicking a brand card in the directory grid — plus the directory grid it sits behind.

## About the Design Files
The files in `source/` are **design references created in HTML/React-via-Babel** — prototypes showing the intended look and behaviour, **not production code to copy directly**. The task is to **recreate these designs in the target codebase** using its established patterns, component library, and conventions (the prototype happens to use React, but implement in whatever the app actually uses). If no front-end environment exists yet, choose the most appropriate framework and implement there.

`directory-prototype-standalone.html` is a fully self-contained, runnable version — open it in a browser to click through the real interactions. `u-directory.jsx` and `u-dir-data.jsx` are the readable source for the directory view and its mock data.

## Fidelity
**High-fidelity.** Final colours, typography, spacing, and interactions. Recreate the UI pixel-accurately using the codebase's existing primitives. Exact tokens are listed under **Design Tokens**.

---

## Screens / Views

### 1. Directory grid (`screenshots/01-directory-grid.png`)
- **Purpose**: Browse and search all brands, agents, and in-house teams; jump into any profile.
- **Layout**: Centred content column (max ~1480px). A page header (mono kicker `DIRECTORY` + title "Brands, teams & agents" + one-line description). Below it a segmented tab control (`Brands 18` / `Agents 6` / `In-house teams 15`) on the left and a search field on the right. Then a responsive **4-column card grid** (`repeat(auto-fill, minmax(~215px, 1fr))`, gap 14px).
- **Brand card**: white surface, 1px `#E8E4DC` border, radius 15px. Top row = colour avatar (rounded square, brand colour, white initials) + name + sector sub-label. A status kicker line (e.g. `● ACTIVELY ACQUIRING` in green, `SELECTIVE` in amber, `NO REQUIREMENT ON FILE` in grey). Footer = 3 stats (UK STORES / IN-HOUSE / AGENTS) as number + mono uppercase micro-label. Hover raises the card.

### 2. Brand profile — with requirement (`screenshots/02-brand-detail.png`, `03-detail-targets-activity.png`)
- **Purpose**: Everything a user needs to assess and contact an expanding brand.
- **Layout**: `.oc-wrap` is a vertical flex stack, `gap: 14px`, max-width 1480px, designed to **fit a desktop viewport without scrolling**. Bands top to bottom:
  1. **Hero panel** (`.oc-hero`) — avatar (54px, radius 14) + name (with website globe link) + tag row (sector pill in ink, use-class pill, requirement status pill). Right-aligned stat cluster (`.oc-hstats`, separated by a left border): UK stores / Head office / Operating since.
  2. **Main row** (`.oc-main`) — CSS grid, two columns `minmax(0,0.82fr) minmax(0,1.18fr)`, `gap: 14px`, `grid-auto-rows: minmax(310px, auto)`, `align-items: stretch`:
     - **Left — Expansion requirement panel**: two stat tiles side by side — "Stated requirement" (neutral tile) and "Size seen in market" (violet-tinted tile with a check icon and a "Basis:" source line). Below: a summary paragraph, a 3-up meta row (Listing / Use class / Verified), a dark "View requirement brochure" button, then "Target locations" violet chips.
     - **Right — Estate map panel**: fill-height map with a segmented toggle (**Existing estate** / **Targets**) top-left, a store/town count pill top-right, and a legend (Trading / New / Closing) bottom-left. Stores render as coloured dots on a stylised UK landmass; Targets render as violet halo-pins. (Toggling swaps the count pill text too.)
  3. **Key contacts panel** (full width) — header shows `N in-house · N agents`. Body is a responsive tile grid (`repeat(auto-fit, minmax(230px, 1fr))`, gap 10). Each tile: name + a mono tag (`IN-HOUSE`, or violet `AGENT · <firm>`), role line, then email / phone / link rows with inline icons. **Agent tiles are visually distinct** (violet tag) and their name + last row are buttons that navigate to the agent profile.
  4. **Recent & upcoming activity panel** (full width) — 4-column card row. Each event card has a coloured top border (green = opening, red = closure), a mono type badge + date, and a headline link.

### 3. Brand profile — no requirement on file (`screenshots/04-brand-no-requirement.png`)
- Same structure. The requirement panel shows an **empty state**: doc icon, "No requirement on file", and a prompt to contact the team. The map still renders the estate. Contacts and activity bands are unchanged.

---

## Interactions & Behavior
- **Grid card → profile**: clicking a brand card opens its profile (in-app view swap, not a route reload in the prototype). A back button + breadcrumb (`Directory › Brands › <name>`) returns to the grid.
- **Map toggle**: `Existing estate` / `Targets` swaps the plotted layer and the count-pill label. Active tab = ink fill, white text; inactive = transparent, grey text. 0.15s transitions.
- **Contact → agent**: clicking an agent's name or "View agent profile" navigates to that agent's profile (which lists the other brands they represent).
- **Hover**: cards lift; contact/activity links shift to violet `#7033FF`; brochure button background goes ink → violet.
- **External links**: website globe, LinkedIn, and activity headlines open in a new tab.
- **Responsive**: below ~720px the main row collapses to a single column, activity becomes 2-up, and the hero stat cluster hides. This view is **desktop-first**.

## State Management
- `view` / selected-entity state: which of {grid, brand-detail, agent-detail} is showing and the active entity id.
- `mapView` (per profile): `"estate" | "targets"` — drives the plotted layer and count label.
- Directory tab filter: `"brands" | "agents" | "inhouse"` + search query string.
- Data is static mock in the prototype (`u-dir-data.jsx`). In production this is fetched: a brand record with `team[]`, `agentIds[]`, `estate{count, top[]}`, and a nullable `requirement{}`. Agents are resolved from `agentIds`; the brand↔agent relationship is bidirectional.

## Design Tokens
Colours (warm-neutral base, violet accent):
- Background `#FBFAF7` · Surface `#FFFFFF`
- Ink `#171419` · Ink-2 `#4A4451` · Ink-3 `#7C7588` · Ink-4 `#B5AEC0`
- Border `#E8E4DC` · Border-soft `#EFEBE2` · Border-hard `#D8D2C5`
- Accent (violet) `#7033FF` · Accent-deep `#5421CC` · Accent-tint `#EEE9FF` · Accent-soft `#F5F1FF`
- Positive/open `#16A34A` (bg `#DCFCE7`, text `#15803D`) · Negative/close `#DC2626` (bg `#FEE2E2`)
- Warn/selective `#D97706`
- Map: land `#E2DBC9` / stroke `#C9C1AA`, canvas `#EFEBE1`

Typography:
- **Inter** — UI text. Names 21–23px/600 (letter-spacing -0.5px); stat values 19–24px/600; body 12.5–13.5px/400–500 (line-height ~1.6); labels 11–12px.
- **JetBrains Mono** — kickers, micro-labels, dates, counts. 9–11px, weight 600–700, uppercase, letter-spacing 0.5–1.4px.

Radius: cards/panels 15px · tiles/buttons 11–12px · pills 999px · avatars 12–14px.
Spacing: band gap 14px; panel padding 14–18px; tile padding 13–16px.
Shadow (panels): `0 1px 2px rgba(23,20,25,.03)`; grid cards add a soft lift on hover.
Icon set: Lucide-style 2px stroke line icons (mail, phone, doc, chevrons, check, globe); LinkedIn as a filled glyph.

## Assets
- **No external image assets.** The SiteMatcher logo, all icons, avatars (coloured initial squares), and the estate map (stylised inline SVG UK outline + plotted dots/pins) are code-drawn. In production, swap the placeholder map for the app's real mapping component and plot actual store/target coordinates. Fonts are Google Fonts (Inter, JetBrains Mono).

## Files
In `source/`:
- `u-directory.jsx` — the directory view: grid, brand profile (`DirBrandDetail`), estate map (`OccMap`), contact tile (`OcContact`), and all `.oc-*` / `.ud-*` styles. **Primary reference.**
- `u-dir-data.jsx` — mock data model: brands, agents, teams, estates, requirements. Shows the exact shape of every field the UI consumes.
- `directory-prototype-standalone.html` — self-contained runnable prototype. Open in a browser and click **Directory** in the left rail to explore.

Note: the prototype's `.oc-*` classes and the `DirBrandDetail` / `OccMap` / `OcContact` components in `u-directory.jsx` are the authoritative spec for the occupier profile.
