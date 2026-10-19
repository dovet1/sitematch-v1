# Handoff: Planning Monitor (SiteMatcher unified view)

## Overview
Planning monitor is a third mode in SiteMatcher's unified map view, alongside **Assess area** and **Find gaps**. It lets a retailer or agent:

1. See every UK planning application on a map, grouped into **developments** (one pin per site, however many documents it carries).
2. Filter by time frame, residential (with a minimum-dwellings floor of 15), commercial use classes, and proximity to any tracked brand's stores.
3. Free-draw a single personal **patch**, name it, attach filters that persist, and watch it.
4. Receive a **weekly summary** of what's new inside the patch in the previous 7 days, led by an AI write-up of the week.
5. Step back through previous weekly summaries.
6. Opt in to receiving that summary by email.
7. Rename, re-draw, re-filter or delete the patch.
8. Tie sidebar rows to map pins by hover and click.
9. Open a development's full detail — status, location, use type, planning reference, dwellings, dates, and a link to the application on the planning authority's own portal.

## About the Design Files
`Planning Monitor Flows.dc.html` is a **design reference built in HTML** — a prototype showing intended look and behaviour, not production code to copy. The task is to recreate these designs inside the SiteMatcher Next.js app (`dovet1/sitematch-v1`, `apps/web`) using its existing components, Tailwind tokens and Mapbox setup.

The file is a canvas document: eleven annotated frames laid out side by side, each with a numbered notes column. Open it in a browser and pan/zoom, or use the PNGs in `screenshots/`. Frames carry anchor ids `1a` … `1j`.

The shell (top bar, icon rail, left control panel, right results panel, satellite basemap) is **reconstructed from the real app** — from `apps/web/src/app/gapfinder/`, `apps/web/src/components/gapfinder/`, `apps/web/tailwind.config.js`, `apps/web/src/app/layout.tsx`, and screenshots of the live Assess area / Find gaps modes. Reuse the real components rather than rebuilding them: the mock's chrome is an approximation of them.

The map in every frame is a **stylised placeholder** (CSS gradients), not a map tile. Production uses the existing Mapbox satellite basemap.

## Fidelity
**High-fidelity.** Colours, type, spacing and component treatment are final intent. Copy is representative but not final. All data — counts, addresses, references, dwelling numbers, dates, the AI summary text — is **illustrative**, not real planning records.

---

## Screens / Views

### 1a · Whole-UK map (default view, no patch yet)
**Purpose:** landing screen for the mode. Every UK application in view, grouped into developments.

**Layout** (frame 1440 × 880):
- Top bar `height: 62px`, white, `border-bottom: 1px solid #EDEBE7`, `padding: 0 18px`. Logo + violet wordmark (19px/700, `letter-spacing: -.02em`) in a 230px block; centred search pill `width: 460px; height: 42px; background: #F5F4F2; border-radius: 999px`, placeholder "Search a town, postcode or address…" 14.5px `#8A857D`, `⌘K` in mono 11.5px `#A8A29A`; right block 230px with violet Export button (`#7033FF`, white, 14.5px/700, `padding: 10px 17px`, `border-radius: 12px`, download icon) and a 34px avatar circle outlined `1.5px #7033FF`.
- Icon rail `width: 58px`, white, `border-right: 1px solid #EDEBE7`, `padding: 14px 0`, `gap: 6px`. Six 40px circular icon buttons (20px stroke icons, `stroke-width: 1.8`, colour `#57534E`); the active one is `background: #171419; color: #fff`. A 36px dark "N" avatar pinned to the bottom. **Planning monitor is a new sixth icon** (document/clipboard).
- Left control panel `width: 302px`, white, `border-right: 1px solid #EDEBE7`.
- Map fills the space between the two panels.
- Right results panel `width: 340px`, white, `border-left: 1px solid #EDEBE7`.

**Left panel contents**
- Mono eyebrow `PLANNING MONITOR` — JetBrains Mono, 11px, `letter-spacing: .14em`, `#8A857D` — plus a panel-collapse icon, matching Assess area / Find gaps.
- Title 22px/700 `letter-spacing: -.02em`: "What's coming near us?"; body 13.5px/1.5 `#57534E`.
- `SCOPE` segmented control: `background: #F5F4F2; border-radius: 999px; padding: 4px`; active segment white, 13px/700, `border-radius: 999px`, `box-shadow: 0 1px 3px rgba(0,0,0,.1)`. Options: Whole UK / My patch. My patch is disabled with the hint "No patch yet — draw one to unlock." (12px `#A8A29A`).
- **Create your patch card**: `border: 1.5px dashed #D9CFFA; background: #F7F4FF; border-radius: 14px; padding: 15px`; title 14.5px/700, body 12.5px `#57534E`, primary button `background: #7033FF`, white, 13.5px/700, `padding: 10px`, `border-radius: 10px`.
- `FILTERS` summary rows (see 1b for the full panel). Each row: `border: 1px solid #EDEBE7; border-radius: 11px; padding: 11px 12px`, mono 9.5px label, 13.5px/600 value, trailing `▾` or a pill toggle. Active rows take their type colour: residential `border: 1.5px solid #7033FF; background: #F7F4FF`; commercial `border: 1.5px solid #0F9B8E; background: #F0FAF8`.
- "All filters" button: `border: 1px solid #E3DEFA; color: #5421CC`, 13px/700, full width.

**Map contents**
- Active filter chips, top-left, `gap: 7px`, each `border-radius: 999px; padding: 8px 12px`, 12.5px, `box-shadow: 0 4px 12px -4px rgba(0,0,0,.4)`. Neutral chips white; residential `#EEE9FF`/`#5421CC`; commercial `#E4F5F2`/`#0B7D72`; each removable via `✕`.
- Cluster badges: circles 38–52px by count, `background: #7033FF` (or `#0F9B8E` when commercial-dominant), `border: 3px solid #fff`, white 14–16px/700, `box-shadow: 0 8px 20px rgba(0,0,0,.45)`.
- Individual pins: 14px circles, `border: 2.5px solid #fff`, coloured by use.
- **Hovered pin**: grows to 26px with `border: 4px solid #fff`, a `box-shadow: 0 0 0 8px <colour>/.3` ring, and a dark name tooltip (`#171419`, white 11.5px/600, `border-radius: 7px`) showing "<name> · N docs".
- Legend bottom-left: `background: rgba(255,255,255,.95); border-radius: 12px; padding: 12px 14px`, mono 9.5px header, 12px rows with 10px colour dots.
- Mapbox attribution bottom-right in mono 10px `rgba(255,255,255,.85)`.

**Right panel contents**
- Mono eyebrow `IN THIS VIEW`, then a big count (30px/700, `letter-spacing: -.02em`) with mono unit label `DEVELOPMENTS`, then `3,906 DOCUMENTS` in mono 11px — mirroring Find gaps' "1,000 OF 1,463" treatment.
- Sort row: mono `SORT` label, active pill `background: #171419`, white mono 10.5px, `border-radius: 999px`; inactive pill outlined. A dark `CSV` export pill sits right.
- **Development rows**: `padding: 14px 20px`, `border-bottom: 1px solid #F3F1ED`. Leading 17px map-pin icon in the use colour; title 14.5px/600; mono 10.5px meta line `#8A857D` (dwellings / class · status · date); chips row — use-type chip (`#EEE9FF`/`#5421CC`, `#E4F5F2`/`#0B7D72`, `#FDEEE3`/`#B4531A`, `border-radius: 6px`, 11.5px/600) and a neutral "N documents ▾" chip; trailing `›`.
- **Hover/selected row**: `background: #F7F4FF` with `box-shadow: inset 3px 0 0 #7033FF`.

---

### 1b · All filters
**Purpose:** set what counts as relevant. Same component used in the whole-UK view, the patch view, and the patch's saved criteria.

**Layout:** the left panel widens from 302px to **390px** over the map (not a modal); the map behind dims with `rgba(20,16,10,.35)`. Panel has a sticky footer.

**Groups** (each preceded by a mono 10.5px `letter-spacing: .12em` `#8A857D` label):
1. **TIME FRAME** — single-select pill row: 7 days / 30 days / 3 months / 12 months / Custom… Active pill `background: #7033FF`, white 12.5px/700; inactive `border: 1px solid #EDEBE7`, `#57534E`; Custom is dashed. Helper: "Dated on validation, or on decision where a decision exists."
2. **USE** — three cards, `border-radius: 13px`, `padding: 13px 14px`:
   - *Residential* (on): `border: 1.5px solid #7033FF; background: #F7F4FF`. Pill toggle 32×19px. Contains **Minimum dwellings** number input: `border: 1.5px solid #D9CFFA; border-radius: 10px`, − / value (15px/700) / + segments divided by `1px solid #EDEBE7`. **Floor is 15**: − disables at 15 and typing lower snaps back with the helper line "15 is the floor — smaller schemes aren't tracked."
   - *Commercial* (on): `border: 1.5px solid #0F9B8E; background: #F0FAF8`. Multi-select class chips — selected `background: #D6F0EC; color: #0B7D72`; unselected `border: 1px solid #CFE7E3; color: #4A7A75`. Classes: Class E, Retail warehouse, B2 industrial, B8 logistics, Sui generis.
   - *Mixed use* (off): neutral card, `background: #E5E2DC` toggle track. Helper: "Matched by either test above."
   - Residential and commercial are **independent**: either, both, or neither. Neither on = no use filter, not zero results.
3. **PROXIMITY TO A BRAND** — brand select + radius select side by side (`border: 1px solid #EDEBE7; border-radius: 11px; padding: 10px 12px`, mono 9.5px label above 13.5px/600 value), plus a dashed "+ Add another brand" chip. Helper: "Any tracked brand, not only your own estate. Several brands are OR'd; the radius applies to each."
4. **STATUS** — multi-select chips: Validated / Pending / Approved / Refused / Withdrawn. Selected `#EEE9FF`/`#5421CC`.

**Footer:** `border-top: 1px solid #EDEBE7; background: #FBFAF8; padding: 14px 22px`. Live mono count `1,284 MATCHES` (debounced recompute on every change), Cancel (outlined) and Apply (`#7033FF`).

---

### 1c · Development detail
**Purpose:** everything about one development, plus its paperwork.

**Card:** 390px wide, white, `border-radius: 16px`, `box-shadow: 0 26px 60px -18px rgba(0,0,0,.6)`, anchored **beside** its pin (never over it), flipping side near an edge.

- **Header block** (`padding: 16px 18px 15px`): status pill — mono 10.5px, `letter-spacing: .08em`, approved `#E4F5F2`/`#0B7D72`, with a leading `●`; close `✕`. Address 19px/700 `line-height: 1.25`. Chips: use type + planning authority.
- **Fact grid** — 2 columns, `gap: 13px 16px`. Each cell: mono 9.5px `letter-spacing: .1em` `#8A857D` label over the value.
  - `DWELLINGS` 16px/700 (residential/mixed only)
  - `PLANNING REF` in **JetBrains Mono** 13px/600
  - `DECIDED` 13.5px/600
  - `VALIDATED` 13.5px/600
- **Brand distance strip** (only when a proximity filter is on): `background: #FDEEE3; border-radius: 10px; padding: 10px 12px`, 12.5px `#7A3B12`.
- **Documents block**: mono header `N DOCUMENTS IN THIS DEVELOPMENT`; rows with a 6px status dot (lead application `#7033FF`, others `#C9C3BA`), title 13px/600, mono 10px `ref · STATUS date`, trailing `↗` link-out. The lead row is tinted `#F7F4FF`.
- **Footer**: primary "View on <Authority> ↗" (`#7033FF`, full-width flex) and an outlined "Watch" button; `background: #FBFAF8`.

**Sidebar in this state:** the matching row expands inline — the documents chip flips to `background: #171419` with `▴`, and a nested white card (`border: 1px solid #E3DEFA; border-radius: 10px`) lists the same documents compactly. **Selection is one shared state**: a card is never open without its row marked, and vice versa.

**Map in this state:** the site boundary polygon draws where the authority publishes one — `background: rgba(112,51,255,.28); border: 1.5px solid #9E82FF; border-radius: 8px`, labelled in mono 10px white.

---

### 1d · Free-draw the patch
**Purpose:** create the patch boundary. Free draw is the only option.

**Mode takeover:** the right results panel closes (map runs to the frame edge), the other rail icons grey to `#D5D0C8`, and Export greys out.

**Left panel (302px):**
- Violet mono eyebrow `DRAWING YOUR PATCH`; title "Trace the area you cover" 21px/700; body 13.5px.
- Three-step tracker — 22px numbered circles, active `#EEE9FF`/`#5421CC`, pending `#F5F4F2`/`#A8A29A`; step 1 shows the live point count.
- `AREA SO FAR` card (`background: #FBFAF8; border: 1px solid #EDEBE7; border-radius: 12px`): 19px/700 area plus mono `≈ N DEVELOPMENTS INSIDE`.
- "Undo point" and "Start again" buttons (outlined, 50/50).
- Primary button is disabled (`background: #E5E2DC; color: #A8A29A`) and reads "Close the shape to continue"; a text Cancel sits under it.

**Map:**
- In-progress polygon: `fill: rgba(112,51,255,.22); stroke: #B49CFF; stroke-width: 3; stroke-dasharray: 9 7`; a white dashed rubber-band line runs from the last vertex to the cursor.
- Vertices: 11px white circles with `2.5px solid #7033FF`; the **first vertex enlarges to 13px with a 3px border** as a snap target.
- Crosshair cursor with a dark tooltip "Click the first point to close".
- Mode toast, top centre: `background: rgba(23,20,25,.92)`, white 13.5px/600, pen icon, "Free-draw mode · Esc to cancel · ⌘Z to undo".
- **Error state:** a self-intersecting edge turns amber and closing is blocked until the point moves.

---

### 1e · Name and save
**Purpose:** name, filters and email in one step so there's no second setup trip.

Left panel at 390px, eyebrow `NEW PATCH · STEP 3 OF 3`.
- **Patch name** text input, auto-focused, pre-filled from the largest authority inside the shape: `border: 2px solid #7033FF; border-radius: 11px; padding: 12px 14px; box-shadow: 0 0 0 4px rgba(112,51,255,.12)`; value 15px/600 with a caret. Helper: "Shown on the map, in the summary and in the email subject."
- **Area / matches strip**: two mono-labelled stats with a "Redraw" link that returns to 1d with the shape intact.
- **Filters for this patch**: chips summarising the inherited filter set, with an Edit link opening 1b. Helper explains they persist with the patch and drive the summary.
- **Email opt-in card**: `border: 1.5px solid #E3DEFA; background: #F7F4FF; border-radius: 13px`. Toggle **on by default**, title "Email me the weekly summary", body "Monday mornings, covering the previous 7 days. Opt out any time from the patch menu.", and the target address in mono-labelled form.
- **Footer**: Discard (outlined) / Save patch (`#7033FF`, `flex: 1.6`).

Map shows the closed polygon (`fill: rgba(112,51,255,.26)`, solid 3px `#B49CFF` stroke), vertex handles, a dark name chip, and the matching pins inside.

---

### 1f · Patch view (the new home view)
Once a patch exists the mode opens here instead of 1a.

- Left panel header: patch name 21px/700 with a patch icon and a `⋯` menu; mono sub-line `YOUR PATCH · 212 SQ MI · 96 MATCHES`; scope toggle now defaults to **My patch**.
- **Summary prompt card** — the only dark card in the UI: `background: #171419; border-radius: 14px; padding: 15px`, violet mono label `NEW SUMMARY READY` with a `#B49CFF` dot, headline 16px/700, body 12.5px `#C9C3BA`, white button "Open weekly summary". It appears while an unread week exists and collapses to a line once opened.
- Filters chip summary + "Edit patch filters".
- Email state line: "Weekly email **on** · Mondays" with a teal mail icon.
- **Map**: patch polygon at `rgba(112,51,255,.2)`; a dark name chip with the same `⋯` menu; **NEW badges** (mono 9px, use colour, `border-radius: 5px`) above pins added in the last 7 days; applications **outside** the patch render dimmed white rather than disappearing.
- **Right panel**: `IN <PATCH NAME>`, count, a `12 new this week` chip, rows with inline NEW badges; new rows tinted `#FCFBFF`.

---

### 1g · Weekly summary panel
**Purpose:** the week's new applications, generated every Monday from the previous 7 days inside the patch, using the patch's saved filters.

**Layout:** a **560px panel sliding over the map from the right** (`box-shadow: -24px 0 60px -20px rgba(0,0,0,.45)`), map dimmed `rgba(20,16,10,.42)` behind it. Dismiss with `✕`, Esc, or a click on the map. It is a panel, not a route.

- **Header**: violet mono `WEEKLY SUMMARY · <PATCH>`; headline is the count — "12 new applications" 25px/700.
- **Week stepper**: `‹` (outlined 30px square), the date range as a button with `▾` (it *is* the week picker), `›` disabled on the latest week with a mono `LATEST WEEK` label beside it.
- **Three counters**, `gap: 10px`: Residential (`#F7F4FF`/`#E3DEFA`, count + total dwellings), Commercial (`#F0FAF8`/`#D6F0EC`), Near <brand> (`#FDEEE3`/`#F7DCC7`). Each: mono 9.5px label, 22px/700 count, 11.5px sub-line.
- **AI summary card** — `background: #F7F4FF; border: 1px solid #E3DEFA; border-radius: 14px; padding: 15px 16px`; violet sparkle icon + mono `AI SUMMARY OF THIS WEEK`; body 13.5px/1.6 `#2A2833` with bold spans on the key figures; mono footnote `GENERATED FROM THE 12 APPLICATIONS BELOW`. It is written from that week's applications, names the developments it draws on so claims are checkable against the rows, and is replaced by the plain "nothing new" line on a zero-application week.
- **Grouped list**: mono group headers (`RESIDENTIAL · 7 DEVELOPMENTS`), rows `border: 1px solid #EDEBE7; border-radius: 12px; padding: 13px 14px` with a 10px use dot, title 14.5px/600, mono meta (dwellings · status · date · authority), mono doc count, `›`. A violet "Show N more residential" link caps each group. Clicking a row closes the panel and opens that development's card on the map.
- **Footer**: email toggle "Email me this every Monday" + "Export week ↓".
- **Quiet week:** zero new applications still generates a summary — "Nothing new in <patch> this week" — with stepper and toggle intact.

---

### 1h · Previous weeks
Same panel; the date label opens a dropdown (`width: 330px`, `border-radius: 14px`, `box-shadow: 0 24px 50px -16px rgba(0,0,0,.35)`) listing kept weeks with a mono count chip each. The current week is tinted `#F7F4FF` with a `#7033FF` chip; **zero weeks are listed with `0 NEW` rather than hidden**. Header states retention: `PREVIOUS WEEKS · 14 KEPT`.

Viewing an archived week also re-scopes the map behind the panel to that week, stated by an info strip (`background: #FBFAF8; border: 1px solid #EDEBE7`, clock icon, 12.5px): "Viewing an archived week. The map shows that week's applications only."

Weeks are kept from the patch's creation date. **Editing the boundary or filters does not rewrite past weeks** — they stay as they were sent.

---

### 1i · The weekly email
Same three counters, the same AI summary (shortened), and the same grouping as the panel, capped at the top few rows. Violet logo lockup, headline 20px/700 "12 new applications in West Yorkshire", mono date range, primary button "Open all 12 in SiteMatcher", and a footer stating why they're receiving it with "Change frequency" / "Turn off" links.

**Opt-in is one state surfaced in three places**: the save step (1e), the summary footer (1g), and the patch menu (1j). Turning it off anywhere keeps the in-app summary generating. **Quiet weeks aren't emailed**; the in-app week still exists and says so. Unsubscribe in every send.

---

### 1j · Edit and delete
**Patch `⋯` menu** (250px, `border-radius: 14px`, `padding: 6px`; rows `padding: 10px 12px`, `border-radius: 9px`, 13.5px/600, 16px icons) — identical on the map chip and the panel header:
Rename patch · Edit boundary (highlighted `#F7F4FF`/`#5421CC` while active) · Edit filters · Weekly email (with inline toggle) · divider · **Delete patch** in `#C0453F`.

**Edit boundary:** keeps the shape and exposes draggable vertices; the dragged vertex shows a `0 0 0 7px rgba(112,51,255,.3)` ring. A midpoint handle between two vertices adds a point; dragging a vertex off the shape deletes it. Floating Cancel / Save boundary buttons bottom-right. Saving recomputes the match count immediately; the next summary uses the new shape.

**Delete confirmation** (420px dialog, `border-radius: 18px`, `padding: 24px`): red-tint icon tile (`#FDECEB`/`#C0453F`, 40px, `border-radius: 12px`), title "Delete <patch>?", body naming exactly what is lost — boundary, filters and **N weekly summaries** — and that the email stops while applications themselves are unaffected. A `#FBFAF8` strip offers the lighter path: "Only want a different area? **Edit the boundary** instead and keep your history." Buttons: Keep patch (outlined) / Delete patch (`#C0453F`). **No typed confirmation.** After deleting, the mode falls back to 1a with the Create your patch card restored, and a toast offers a single undo.

---

## Interactions & Behavior
- **Mode entry** — rail icon, same active treatment as the other modes; no route change between Whole UK and My patch.
- **Row ↔ pin linkage (requirement 8)** — hovering a row enlarges its pin, adds the colour ring and shows the name tooltip; hovering a pin tints the row (`#F7F4FF` + `inset 3px 0 0 #7033FF`) and scrolls it into view. Clicking a row flies the map to the pin and opens its detail card. One shared selection state.
- **Grouping rule** — documents group into one development when they share a site boundary or parent reference. The "N documents" count is identical in the row, the pin tooltip and the card.
- **Filters** — debounced live match count; Apply commits, Cancel reverts to the last applied set. The dwelling input clamps at 15.
- **Drawing** — click to add, click the first vertex or Enter to close, ⌘Z undo, Esc cancel. Self-intersection blocks closing.
- **Summary panel** — slide in from the right (~200ms ease-out), map dims; Esc / `✕` / map click dismisses. Week stepper and picker re-fetch that week and re-scope the map.
- **Async states to design for** — loading applications for a viewport, generating/fetching a week's summary (including the AI text, which may resolve after the counts), saving a patch, saving a boundary edit.

## State Management
- `mode` (assess-area | find-gaps | planning-monitor) — existing rail state.
- `scope` (uk | patch).
- `filters`: `{ timeFrame, residential: { enabled, minDwellings ≥ 15 }, commercial: { enabled, classes[] }, mixedUse, brandProximity: [{ brandId, radiusMiles }], statuses[] }`.
- `patch`: `{ id, name, geometry (GeoJSON polygon), filters, emailOptIn, createdAt }` — **exactly one per user**.
- `draftPatch` while drawing/editing: `{ vertices[], isClosed, area, estimatedMatches }`.
- `selectedDevelopmentId`, `hoveredDevelopmentId` — shared by map and list.
- `expandedDevelopmentIds` — sidebar document lists.
- `summary`: `{ weekStart, weekEnd, counts, aiSummary, groups[] }` + `availableWeeks[]` + `activeWeekIndex` + `unreadWeek`.
- Map viewport, and whether the summary panel is open.

## Design Tokens
Taken from `apps/web/tailwind.config.js` — use the Tailwind class names, not the hex values, where they exist.

**Colours**
| Token | Hex | Use |
| --- | --- | --- |
| `sm-violet` | `#7033FF` | primary, active states, residential |
| `sm-violet-deep` | `#5421CC` | violet text on tint |
| `sm-violet-tint` | `#EEE9FF` | chips, badges |
| `sm-violet-tint-soft` | `#F5F1FF` (mock uses `#F7F4FF`) | selected rows, cards |
| `sm-ink` | `#171419` | text, active rail icon, dark cards |
| `sm-ink2` | `#4A4451` | body text |
| `sm-ink3` | `#7C7588` (mock uses `#8A857D`) | mono labels, muted text |
| `sm-border` | `#E8E4DC` (mock uses `#E5E2DC`) | buttons, inputs |
| `sm-border-soft` | `#EFEBE2` (mock uses `#EDEBE7` / `#F3F1ED`) | dividers, panel edges |
| `sm-bg` | `#FBFAF7` (mock uses `#FBFAF8`) | footers, subtle cards |
| `sm-orange` | `#F26B1F` | mixed use |
| — | `#0F9B8E` / `#0B7D72` / `#E4F5F2` / `#D6F0EC` / `#F0FAF8` | commercial (teal, matching Find gaps' Box 2) |
| — | `#FDEEE3` / `#B4531A` / `#7A3B12` | brand-proximity flags |
| — | `#C0453F` / `#FDECEB` | destructive |

**Typography** — `Inter` (body, all weights 400–800) and `JetBrains Mono` via `--font-mono` for every uppercase micro-label, count unit, planning reference and date meta line. Micro-labels: 9.5–11px, `letter-spacing: .1em–.14em`, uppercase. Titles: 19–30px/700, `letter-spacing: -.01em to -.02em`. Body: 13–14.5px, `line-height: 1.45–1.6`.

**Radii** — `sm-btn` 10px · `sm-compact` 8px · `sm-menu` 14px · `sm-card` 18px · pills 999px · detail card 16px · filter cards 11–13px.

**Shadows** — panel overlay `-24px 0 60px -20px rgba(0,0,0,.45)`; detail card `0 26px 60px -18px rgba(0,0,0,.6)`; menus `0 24px 50px -14px rgba(0,0,0,.5)`; map chips `0 4px 12px -4px rgba(0,0,0,.4)`; markers `0 8px 20px rgba(0,0,0,.45)`.

## Assets
No custom images. All icons are inline stroke SVGs at `stroke-width: 1.8–2.2` — replace with the codebase's `lucide-react` equivalents (MapPin, Search, PenTool, Target, Layers, FileText, Download, Mail, Trash2, Clock, Sparkles). The map is a stylised CSS placeholder; production uses the existing Mapbox satellite style, marker and popup treatment from `apps/web/src/components/gapfinder/BUAMap.tsx`.

## Files
- `Planning Monitor Flows.dc.html` — the full annotated design file (frames `1a`–`1j`).
- `screenshots/` — one PNG per frame, each including its annotation column.
- `github.md` (project root) — repo association and screen map.

## Source to build on
- `apps/web/src/app/gapfinder/GapFinderClient.tsx` — the unified shell: panels, map wiring, mode state.
- `apps/web/src/components/gapfinder/ResultsPanel.tsx` — right-panel list patterns, export button, empty/loading states.
- `apps/web/src/components/gapfinder/BUAMap.tsx` — Mapbox setup, markers, clustering, mode-conditional layers.
- `apps/web/src/components/gapfinder/MapLegend.tsx` — legend card.
- `apps/web/tailwind.config.js`, `apps/web/src/app/layout.tsx` — tokens and fonts.
