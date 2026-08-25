# Handoff: Requirement Modal (Redesign)

## Overview
A redesigned detail modal for a **retailer requirement** in the SiteMatcher unified workspace. It opens when a user selects a requirement (from the map or a list) and shows what a property agent needs to assess and act on it: the retailer's identity, their live UK store estate on a map, the requirement's key facts, the areas they want to expand into, and the acquiring contact(s) — with Brochure / Contact actions.

Layout: a **two-column modal**. The retailer's **store estate owns the entire left column** (identity + stats + a full-bleed map). The **requirement detail** sits in a scrollable **right column** with a pinned action footer.

## About the Design Files
The file in this bundle (`Requirement Modal - States.html`) is a **design reference created in HTML/CSS/JS** — a prototype showing intended look, layout, and states. It is **not production code to copy directly**. Recreate it in the target codebase's environment (SiteMatcher is React) using the app's existing components, tokens, Mapbox GL map, and patterns.

> The scenario controls at the top of the prototype (the "16 / 100 / Nationwide" segmented control and the "Multiple contacts" toggle) are **review scaffolding only** — they exist so you can preview each data state. They are **not part of the modal**; do not build them. In production the modal simply renders whatever the requirement's data dictates.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, radii, and states are specified below and should be reproduced closely. The one exception is the map: the prototype uses a stylised SVG placeholder for the UK/Birmingham view — in production this must be a **real Mapbox GL map** of the retailer's store estate.

## Screenshots
In `screenshots/`:
- `01-standard.png` — default state: a short list of named target areas + a single contact.
- `02-many-locations.png` — large target-area list (up to ~100): flat, alphabetical, scrollable, with a search filter and a total-count pill.
- `03-nationwide-multi-contacts.png` — "Nationwide" requirement (no named areas) + the multi-contact list.
- `04-contact-chooser.png` — the popover shown when the footer **Contact** button is pressed.

## The four data states you must handle

### A. Named target areas — few (default)
A flat wrapping list of pill tags, each `"Town, County"`. A count pill (`16 towns`) sits beside the "Wants to be in" label.

### B. Named target areas — many (up to ~100)
Do **not** render 100 loose tags. Instead:
- Count pill shows the total (`99 towns`).
- A **search input** filters the list live (matches anywhere in the `"Town, County"` string).
- Tags render inside a **bounded, vertically-scrollable box** (`max-height: 250px`), **sorted alphabetically**.
- Empty search → a "No towns match …" message.
- **No regional grouping** — region metadata is not available in the data, so grouping is intentionally omitted. A flat sorted+searchable list is the chosen pattern.

### C. Nationwide (no named areas)
When the requirement names no towns, replace the entire "Wants to be in" block with a **"Target area" panel**:
- Heading **"Open to sites nationwide"**, subtext *"No specific towns named — will consider suitable opportunities across the UK. Match on size, use class and catchment rather than location."*
- Also show a small **"Nationwide" pill** next to the brand name in the left column header.

### D. Contacts — one or many
- **One contact:** a single contact card (avatar, name, role · org, email, phone, Copy).
- **Multiple contacts:** a **"Contacts" section** with a count pill and one card per person. Each card carries a **label chip** — `IN-HOUSE` (retailer's own team, violet avatar) or `AGENCY` (appointed agent, dark avatar). Each card shows name, role · org, email, phone, and Copy.

## Screens / Views

### Modal container
- Centered dialog over a dimmed scrim.
- Width `960px` (max-width 100%), height `632px`, `border-radius: 22px`, `background: #FFFFFF`, `overflow: hidden`.
- Shadow `0 40px 120px -30px rgba(20,10,40,.65)`.
- CSS grid `grid-template-columns: 372px 1fr`.
- **Scrim:** fixed full-screen, `radial-gradient(120% 90% at 50% 0%, rgba(112,51,255,.10), transparent 60%)` over `rgba(23,20,25,.55)`, `backdrop-filter: blur(2px)`.

### Left column — Store Estate (`.estate`)
Fixed 372px, `background: #FBFAF7`, `border-right: 1px solid #EFEBE2`, vertical flex.

- **Brand identity (padding `26px 26px 18px`):**
  - **Logo tile** `52×52`, radius `13px`, `background #EEE9FF`, text `#5421CC`, weight 700, `19px`, letter-spacing `-.5px`. Content = brand initials (`TH`). Use the app's `BrandLogo`.
  - **Brand name** `The Padel Club` — `22px`/700, letter-spacing `-.5px`, `#171419`.
  - **Nationwide pill** (state C only): inline-flex beside the name, `background #F5F1FF`, `border 1px #EEE9FF`, color `#5421CC`, radius 999px, padding `3px 9px`, `10.5px`/600, globe glyph.
  - **Sector kicker** `LEISURE & SPORT` (kicker style, margin-top 5px).
  - **Section label:** store icon (15px, stroke `#5421CC`) + kicker `STORE ESTATE` in `#5421CC`, margin-top 22px.
- **Estate stats (padding `16px 26px 18px`, grid `auto 1fr`, gap `4px 22px`):**
  - `UK STORES` → `4` (`17px`/600).
  - `LATEST STORE` → `The Padel Club Cheltenham` (`14.5px`/500, single-line ellipsis) **and beneath it an opened date** `Opened 12 Feb 2026` (`.stat-sub`: JetBrains Mono `10.5px`, `#7C7588`, margin-top 4px).
- **Map (`.map-wrap`, flex:1, fills to the rounded bottom-left corner):**
  - `border-top 1px #EFEBE2`; prototype uses a light radial-gradient + faint 34px grid + stylised land SVG standing in for Mapbox.
  - **Store pins:** violet map-pin glyphs (`fill #7033FF`, white center dot), one per store, `drop-shadow(0 3px 5px rgba(84,33,204,.35))`.
  - **Stores chip (top-right, 14px inset):** white pill, `border 1px #E8E4DC`, radius 999px, padding `6px 13px`, shadow `0 4px 14px -6px rgba(20,10,40,.3)`; violet 8px dot + mono `4 stores`.
  - **Attribution (bottom-left):** small mono `mapbox` label. In production use Mapbox's own attribution per ToS.

### Right column — Requirement detail (`.detail`)
Vertical flex, `min-height: 0`.

- **Close button (absolute top-right, 20px inset):** `34×34` circle, white, `border 1px #E8E4DC`, color `#7C7588`; hover `background #FBFAF7`, color `#171419`, border `#D8D2C5`; 15px X glyph.
- **Scroll region (`.detail-scroll`, flex:1, `overflow:auto`, padding `26px 30px 20px`):** custom 8px scrollbar, thumb `#D8D2C5`.
  - **Eyebrow row (margin-bottom 22px):** kicker `REQUIREMENT` (`#4A4451`) + **Verified pill** — `background #F5F1FF`, `border 1px #EEE9FF`, color `#5421CC`, radius 999px, padding `4px 11px`, `11px`/600, 6px violet dot; text `Verified 31 Mar 2026`.
  - **KV grid (2 columns, gap `20px 24px`):** exactly two cells — kicker label (`#7C7588`) + value (`19px`/600, letter-spacing `-.3px`, `#171419`):
    - `Size wanted` → `20,000–50,000 sq ft`
    - `Use class` → `E — Commercial`
    - **Note:** the previous "Listing" field has been **removed**. "Verified" is intentionally not repeated here because it already appears in the eyebrow pill.
  - **Divider:** `1px #EFEBE2`, `margin 24px 0`.
  - **Target areas** (states A/B) or **Nationwide panel** (state C) — see the four states above.
    - **Tag:** white, `border 1px #E8E4DC`, radius 999px, padding `8px 14px`, `13.5px`/500, `#4A4451`; hover border `#D8D2C5`, color `#171419`.
    - **Count pill:** JetBrains Mono `10.5px`/500, `#4A4451`, `background #FBFAF7`, `border 1px #EFEBE2`, radius 999px, padding `3px 9px`.
    - **Search (state B):** `background #FBFAF7`, `border 1px #E8E4DC`, radius 10px, padding `9px 12px`, search glyph + input (`13.5px`).
    - **Scroll box (state B):** `max-height 250px`, `overflow:auto`, 7px scrollbar.
    - **Nationwide panel (state C):** flex row, padding 18px, radius 14px, `background linear-gradient(135deg, #F5F1FF, #FBFAF7)`, `border 1px #EEE9FF`; 40px white icon tile (radius 11px, `border 1px #EEE9FF`, violet globe) + title (`15.5px`/600) + subtext (`13px`, `#4A4451`, line-height 1.55).
  - **Contact(s):**
    - **Card:** flex row, `background #FBFAF7`, `border 1px #EFEBE2`, radius 14px, padding `14px 15px`, gap 14px.
    - **Avatar:** `42×42` circle, initials, `16px`/600. In-house = `background #7033FF`; agency = `background #4A4451`.
    - **Name row:** name (`14.5px`/600) + (multi only) **label chip** — JetBrains Mono `8.5px`, letter-spacing `.6px`, uppercase, `#7C7588`, `background #FFF`, `border 1px #EFEBE2`, radius 5px, padding `2px 6px`.
    - **Role** `12.5px` `#7C7588`; **email** mono `11px` `#4A4451`; **phone** mono `11px` `#7C7588` (margin-top 2px).
    - **Copy button:** `border 1px #E8E4DC`, white, `#4A4451`, radius 8px, padding `6px 11px`, `12px`/500; hover border `#D8D2C5`, color `#171419`. Copies that contact's details.
    - **Multi section header:** kicker `CONTACTS` + count pill; cards stacked with `gap 10px`.
- **Footer (`.footer`, pinned, padding `16px 30px`, `border-top 1px #EFEBE2`, `background #FFF`, flex gap 12px):**
  - Both buttons `flex:1`, height `50px`, radius 13px, `15px`/600, icon + label, gap 9px.
  - **Brochure (secondary):** white, `border 1px #E8E4DC`, `#171419`; hover `background #FBFAF7`, border `#D8D2C5`. Doc icon. Hide when the requirement has no brochure.
  - **Contact (primary):** `background #7033FF`, white, `border 1px #7033FF`, shadow `0 8px 22px -8px rgba(112,51,255,.6)`; hover `background #5421CC`. Users icon. Label is `Contact` for one contact, `Contact (N)` for many.

### Contact chooser popover (`.contact-menu`)
Pressing the footer **Contact** button opens a chooser popover — this is the answer to "what happens with multiple contacts": the user explicitly picks **who** to reach and **how**, instead of the button guessing a default.

- Anchored above the footer, bottom-right (`position:absolute; right:30px; bottom:84px`), width `360px`.
- `background #FFF`, `border 1px #E8E4DC`, radius 16px, shadow `0 26px 64px -22px rgba(20,10,40,.55)`, padding 8px, `z-index 30`.
- **Header kicker:** `WHO WOULD YOU LIKE TO CONTACT?` when multiple; `GET IN TOUCH` when single.
- **Row per contact:** name (`13.5px`/600) + role · org (`11.5px` `#7C7588`) on the left; on the right two action buttons:
  - **Email** — `background #F5F1FF`, `border 1px #EEE9FF`, color `#5421CC`; opens `mailto:`.
  - **Call** — white, `border 1px #E8E4DC`, `#4A4451`; opens `tel:`.
  - Buttons: radius 9px, padding `7px 11px`, `12.5px`/600, icon + label.
- Row hover `background #FBFAF7`.
- **Dismiss:** outside-click or `Esc` closes it.

## Interactions & Behavior
- **Open/close:** reuse the app's modal transition. Close via X, scrim click, or `Esc`.
- **Contact button:** opens the chooser popover (see above) for both single and multiple contacts. Email/Call are real `mailto:` / `tel:` links.
- **Copy button** (on each contact card): copies that contact's details to clipboard.
- **Target-area search (state B):** live filter on input; shows a no-results message when nothing matches.
- **Map:** pan/zoom via Mapbox; pins = the retailer's trading stores; clicking a pin may open a store popover (follow existing map-popover patterns — optional).
- **Scrolling:** only `.detail-scroll` scrolls; the left estate column and the footer stay fixed.
- **Responsive:** designed at a fixed desktop size (960×632). On narrow viewports collapse to a single column (estate stacked above detail) or fall back to the app's responsive modal behavior.

## State Management
`requirement` object drives all content:
```
{
  brand, initials, brandColor, sector,
  estate: { ukStores, latestStore, latestStoreOpened, stores: [{ lat, lng, name }] },
  size, useClass, verified,
  scope: "areas" | "nationwide",
  locations: [ "Town, County", … ],        // present when scope === "areas"
  contacts: [ { name, role, org, email, phone, kind: "in-house" | "agency" }, … ]
}
```
- Location list rendering switches on `locations.length` (few → flat tags; many → search + bounded scroll) and on `scope` (`nationwide` → panel).
- Contact rendering switches on `contacts.length` (1 → single card; >1 → labelled list + chooser lists everyone).
- `isOpen` / `onClose` owned by the workspace. Popover open/close is local modal state.
- The modal renders already-loaded requirement data; it introduces no fetching itself.

## Design Tokens
Colors (SiteMatcher palette): `bg #FBFAF7` · `surface #FFFFFF` · ink `#171419` · ink2 `#4A4451` · ink3 `#7C7588` · ink4 `#B5AEC0` · border `#E8E4DC` · border-soft `#EFEBE2` · border-hard `#D8D2C5` · violet `#7033FF` · violet-deep `#5421CC` · violet-tint `#EEE9FF` · violet-tint-soft `#F5F1FF`.

Typography:
- **Inter** (400/500/600/700) — all UI text.
- **JetBrains Mono** (400/500) — kickers/labels, count pills, email, phone, opened date, attribution.
- **Kicker:** JetBrains Mono `10.5px`/500, `letter-spacing 1.4px`, uppercase, `#7C7588` (violet-deep for the estate section label; `#4A4451` for the requirement eyebrow).

Radii: modal `22px`; cards/buttons `13–16px`; logo tile `13px`; pills/tags/chips `999px`.

Shadows: modal `0 40px 120px -30px rgba(20,10,40,.65)`; chooser `0 26px 64px -22px rgba(20,10,40,.55)`; stores chip `0 4px 14px -6px rgba(20,10,40,.3)`; primary button `0 8px 22px -8px rgba(112,51,255,.6)`; pin `drop-shadow(0 3px 5px rgba(84,33,204,.35))`.

## Assets
- **Fonts:** Inter + JetBrains Mono (Google Fonts) — use the app's existing setup.
- **Icons:** inline 16px line SVGs (`currentColor`, stroke ~1.5): store/estate, close, doc (brochure), users (contact), map pin, globe (nationwide/attribution), envelope (email), phone (call), search. Replace with the app's icon set.
- **Brand logo:** initials-in-tile placeholder (`TH`); use the app's `BrandLogo` with real logo/brand color.
- **Map:** prototype uses a stylised SVG stand-in. **Production must use Mapbox GL** with the retailer's store markers; keep Mapbox attribution.

## Files
- `Requirement Modal - States.html` — the high-fidelity design reference (self-contained; CSS + JS inline). Includes all four data states, toggled via the review-only controls at the top.
- `screenshots/01-standard.png`, `02-many-locations.png`, `03-nationwide-multi-contacts.png`, `04-contact-chooser.png`.
