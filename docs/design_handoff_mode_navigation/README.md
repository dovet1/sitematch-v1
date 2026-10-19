# Handoff: Mode navigation (first-login chooser + labelled rail)

## Overview
New users don't understand what the six modes in the left icon rail do. This change adds:
1. **Mode chooser on login** — a modal "What do you want to do today?" over the map, shown on every login until the user ticks "Don't show this again".
2. **Labelled rail with hover cards** — the icon rail gets a short text label under each icon, and hovering an icon shows a card explaining the mode.

Modes (rail order, top → bottom):
| # | Mode | Rail label | Icon (current) |
|---|---|---|---|
| 0 | Assess area | Assess | map pin |
| 1 | Find gaps | Gaps | magnifier |
| 2 | SiteSketcher | Sketch | pen |
| 3 | Planning monitor | Planning | clipboard |
| 4 | Brand matcher | Match | storefront |
| 5 | Directory | Directory | layers (consider a book/contacts icon — layers usually means map overlays) |

## About the design files
`Mode Navigation.dc.html` is a **design reference built in HTML**, not production code. Recreate it in the existing SiteMatcher web app (`dovet1/sitematch-v1`, `apps/web/src` — see `github.md`) using its React/Tailwind patterns and existing shell (top bar, icon rail, left control panel, Mapbox map). Do not ship the HTML.

The file contains two turns. **Build section 2a** (top of file, clickable). Turn 1 (1a/1b/1c) is exploration; 1b and 1c are the visual source for 2a, 1a was not chosen.

## Fidelity
**High-fidelity.** Colours, type, spacing and copy are final. Map is a placeholder gradient — keep the real Mapbox map. Hover-card preview area is a placeholder for a short looping clip per mode (assets to be supplied).

## Screens

### A. Login chooser (`screenshots/01-login-chooser.png`, `02-…-dont-show-ticked.png`)
- **Backdrop**: covers everything below the 62px top bar, `rgba(14,12,22,.6)`. Top bar stays visible and un-dimmed.
- **Modal**: centred in the area below the top bar; width 1040px (max-width: calc(100vw − 48px)); bg #FFFFFF; radius 22px; padding 34px 36px 28px; shadow `0 40px 100px -30px rgba(0,0,0,.6)`.
- **Eyebrow**: "WELCOME TO SITEMATCHER" — JetBrains Mono 11px, letter-spacing .14em, #7033FF.
- **Title**: "What do you want to do today?" — Inter 700 30px, letter-spacing −.02em, #171419, margin-top 8px.
- **Subtitle**: "Pick a starting point. You can switch any time from the rail on the left." — Inter 15px #57534E, margin-top 6px.
- **Card grid**: 3 columns × 2 rows, gap 14px, margin-top 24px.
  - Card: border 1px #EDEBE7, radius 16px, padding 18px, flex column gap 10px, cursor pointer.
  - Hover: border-color #7033FF, bg #F7F4FF.
  - Icon tile: 40×40, radius 12px, bg #F5F4F2, 20px stroke icon (1.8 stroke, #171419).
  - Title: Inter 700 16px. Body: Inter 13.5px / 1.5, #4A4451. CTA: Inter 700 13px #7033FF, pinned to bottom (`margin-top:auto`).
- **Footer row** (margin-top 22px, space-between):
  - Left: checkbox 18×18, radius 5px, border 1.5px #CFCAC2 (checked: bg + border #7033FF, white ✓) + "Don't show this again" Inter 13px #57534E. Whole row is the click target.
  - Right: "Skip, just show me the map" Inter 600 13.5px #7C7588.

Card copy (exact):
| Title | Body | CTA |
|---|---|---|
| Assess an area | Click the map to see brands present and missing, catchment demographics and planning nearby. | Assess area → |
| Find gaps for a brand | Identify towns and retail centres where a brand trades, or doesn't yet. | Find gaps → |
| Sketch a site | Draw a site layout on the map, including parking. | SiteSketcher → |
| Watch planning | See planning alerts across the whole UK and in your patch. | Planning monitor → |
| Match brands to a site | See which brands might fit a given site, and who to call at each. | Brand matcher → |
| Look up a brand | Browse brands, their contacts, store estates, requirements and agents. | Directory → |

### B. App with labelled rail (`screenshots/03-app-rail-active-mode.png`)
- **Rail**: width 78px (was 58px), bg #FFF, right border 1px #EDEBE7, below 62px top bar. Flex column, items centred, padding 12px 0, gap 4px.
- **Rail item**: 66×58px, radius 12px, column, centred, gap 4px. Icon 20px. Label Inter 600 10.5px.
  - Default: transparent bg, #57534E.
  - Hover: bg #F1ECFF, colour #5421CC.
  - Active: bg #171419, colour #FFF.
- **Bottom of rail**: "?" button 36×36 circle, border 1.5px #7033FF, #7033FF 700 text — reopens the chooser. (Keep the existing user/avatar control too if present.)
- Left control panel shifts right by 20px to sit after the wider rail; otherwise unchanged.

### C. Hover card (`screenshots/04-app-rail-hover-card.png`)
- Appears to the right of the hovered rail item: left = rail width + 12px; top aligned ~8px above the item's top. Width 320px. bg #FFF, radius 16px, shadow `0 24px 60px -18px rgba(23,20,25,.45), 0 0 0 1px #EDEBE7`. Overlays the control panel and map (z above panel). `pointer-events:none`.
- **Preview area**: 110px tall, full width — looping clip/GIF of the mode (placeholder hatch in mock).
- **Body**: padding 16px 18px 18px. Row: mode name Inter 700 16px + shortcut key right-aligned (JetBrains Mono 11px #A8A29A). Description Inter 13.5px / 1.5 #4A4451, margin-top 6px.
- Show after ~300ms hover delay; hide immediately on leaving the rail. Not shown while the chooser is open. On keyboard focus of a rail item, show the same card.

Hover card copy:
| Mode | Key | Description |
|---|---|---|
| Assess area | A | Click the map to see brands present and missing, catchment demographics and planning applications nearby. |
| Find gaps | G | Quickly identify towns or retail centres where brands exist, or don't. |
| SiteSketcher | S | Quickly sketch out a site on the map, including parking. |
| Planning monitor | P | See planning alerts across the whole UK and in your patch. |
| Brand matcher | M | See which brands might be a good fit for a site, and who to call at each brand. |
| Directory | D | Brands, their contacts, store estates, and any linked requirements or agents acting for them. |

Shortcut keys are proposed — only display them if implemented (single-key, ignored while typing in inputs).

## Interactions & behaviour
- **On login / app load**: if `dontShowModeChooser !== true` → open chooser. Otherwise open straight into the last-used (or default Assess) mode.
- **Click a chooser card** → set active mode, close chooser.
- **Skip** → close chooser, keep current/default mode. Esc and backdrop click behave as Skip.
- **Checkbox** → toggles `dontShowModeChooser` and persists immediately (does not close the modal).
- **"?" in rail** → opens chooser regardless of the preference.
- **Rail item click** → switch mode (existing behaviour).
- Modal: focus-trap, initial focus on first card, `role="dialog"`, `aria-modal`, labelled by the title. Cards are buttons.

## State
- `activeMode: 0–5`
- `hoveredMode: number | null`
- `chooserOpen: boolean`
- `dontShowModeChooser: boolean` — persist per **user account** (server-side preference) so it follows them across devices; localStorage is acceptable as a fallback. The prototype uses localStorage key `sm-modenav-dontshow`.

## Design tokens
- Violet #7033FF · violet-dark #5421CC · violet-tint #F1ECFF · violet-wash #F7F4FF
- Ink #171419 · body #4A4451 · secondary #57534E · muted #7C7588 · faint #A8A29A
- Border #EDEBE7 · checkbox border #CFCAC2 · surface-alt #F5F4F2 · white #FFFFFF
- Backdrop rgba(14,12,22,.6)
- Fonts: Inter (400/600/700), JetBrains Mono (eyebrows, shortcuts)
- Radii: 5 (checkbox), 12 (rail item, icon tile), 16 (cards, hover card), 22 (modal)
- Shadows: modal `0 40px 100px -30px rgba(0,0,0,.6)`; hover card `0 24px 60px -18px rgba(23,20,25,.45)`

## Assets
- Icons: simple 24px stroke icons drawn inline (1.8 stroke, round caps) — replace with the codebase's icon set equivalents.
- Hover-card previews: not yet produced; one short loop per mode needed.

## Files
- `Mode Navigation.dc.html` — design reference. Section **2a** is the spec; turn 1 shows explored alternatives. Open in a browser alongside `support.js`.
- `screenshots/01–04` — 2a states. `screenshots/explored-*` — turn 1 references.
- `github.md` — source repo info.
