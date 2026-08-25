# Handoff: Brand Info Modal (no active requirement)

## Overview
A modal shown for brands that do **not** have an active site requirement listed. Where the Requirement Modal surfaces what a brand is *looking for*, this modal is purely informational: it shows the brand's identity, category, existing store estate on a map, and the brand's in-house property contacts so a user can reach out directly.

## About the Design Files
The file in this bundle (`Brand Info Modal.html`) is a **design reference created in HTML** — a working prototype showing the intended look and behavior. It is **not production code to copy directly**. The task is to **recreate this design in the target codebase's existing environment** (React, Vue, etc.) using its established components, tokens, and patterns. If no frontend environment exists yet, choose the most appropriate framework and implement it there.

This modal is a sibling of the existing **Requirement Modal** (`Requirement Modal - States.html`) and deliberately shares its visual language (same two-column shell, estate panel, contact cards, and contact chooser popover). Reuse the same components — this is the "no requirement" variant of the same modal family, not a separate design system.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, and interactions are all specified. Recreate pixel-perfectly using the codebase's existing libraries/patterns.

## Layout — single view

The modal is a fixed-size dialog: **960 × 632px**, `border-radius: 22px`, on a dark scrim. Two-column CSS grid: **`grid-template-columns: 372px 1fr`**, `overflow: hidden`.

### LEFT column — Store estate (`.estate`, 372px)
Background `--bg` (#FBFAF7), right border `1px --border-soft`. Vertical flex, three stacked blocks:

1. **Header** (`padding: 26px 26px 18px`)
   - Brand row: 52×52 rounded logo tile (`--violet-tint` bg, `--violet-deep` initials, radius 13px) + brand name (22px/700, letter-spacing -.5px) with a sub-line beneath: **category** as a mono kicker (10.5px, letter-spacing 1.4px, uppercase, `--ink3`) — e.g. `FOOD & BEVERAGE · COFFEE`.
   - "Store estate" label: small storefront icon + mono kicker in `--violet-deep`, `margin-top: 22px`.
2. **Stats grid** (`padding: 16px 26px 18px`, `grid-template-columns: auto 1fr`)
   - `UK stores` → big value (17px/600). e.g. **27**
   - `Latest store` → name (14.5px/500, truncates with ellipsis, max-width 200px) + mono sub-line `Opened 6 May 2026`.
3. **Map** (`.map-wrap`, `flex: 1`) — a stand-in for a Mapbox GL map. In production, replace the inline SVG landmass + absolutely-positioned pins with a real Mapbox GL JS instance plotting the store locations. Overlays to keep: a **store-count chip** top-right (white pill, mono, violet dot) and a bottom-left `mapbox` attribution.

### RIGHT column — Brand detail (`.detail`, `1fr`)
Vertical flex: a scrollable body (`.detail-scroll`, `flex:1; overflow:auto; padding:26px 30px 20px; display:flex; flex-direction:column`) above a fixed footer.

- **Close button**: absolute top-right, 34×34 round, white with `--border`.
- **Body** contains only the **in-house contacts** section (`#contactSection`). Store count, latest opening, and category are intentionally shown **only on the left** — do not duplicate them here.
- **Footer** (`.footer`, `padding:16px 30px`, top border): a single full-width primary **Contact** button.

## Contacts — variable count (0 to 20)

This is the core behavior. The right panel must feel balanced whether there are 0, 1, or 20 contacts.

- **Section header** (`.contacts-head`): mono kicker `IN-HOUSE CONTACT` / `IN-HOUSE CONTACTS` (singular when 1) + a **count pill** (mono, `--bg` bg, `--border-soft`). Always shown when ≥1 contact.
- **Contact card** (`.contact`): flex row, `padding:14px 15px`, radius 14px, `--bg` bg, `1px --border-soft`. Contains:
  - 42×42 round **avatar** (`--violet` bg, white initials, 16px/600).
  - Name (14.5px/600) + a mono `IN-HOUSE` **label chip**.
  - Role · Org (12.5px, `--ink3`).
  - Email (mono 11px, `--ink2`) and Phone (mono 11px, `--ink3`), each on its own line.
  - **Copy** button, right-aligned (white, `--border`, radius 8px).
- Cards stacked in `.contacts-wrap` with `gap: 10px`.

### Balancing rule (important)
`.detail-scroll` is a flex column. After render, measure: if content does **not** overflow (`scrollHeight <= clientHeight`), add class `.center` (`justify-content: center`) so a short list (1–3 contacts) sits vertically centered and balances the dense left column. If it **does** overflow (roughly 8+ contacts), stay top-aligned and let it scroll. Re-run this check on every re-render (use `requestAnimationFrame`).

### Empty state (0 contacts)
Replace the list with a centered `.empty` block: 52×52 muted icon tile, title **"No contacts listed"**, sub **"This brand hasn't shared in-house property contacts yet."** Force `.center` on. **Disable** the footer Contact button (`.btn.primary:disabled` — `--border` bg, `--ink4` text, `not-allowed` cursor) and set its label to **"No contacts"**.

## Interactions & Behavior
- **Contact button** (when enabled): toggles a **contact chooser popover** (`.contact-menu`, absolute, `right:30px; bottom:84px`, width 360px) anchored above the footer. Closes on outside-click and on `Escape`. Do not open when disabled.
  - Popover header: `Get in touch` (1 contact) or `Who would you like to contact?` (multiple).
  - Each row: name + role/org, and two actions — **Email** (`mailto:`, violet-tinted) and **Call** (`tel:` with spaces stripped).
- **Footer button label**: `Contact` for 1, `Contact (N)` for multiple, `No contacts` (disabled) for 0.
- **Copy** button on each card: copy the contact's details to clipboard (wire to `navigator.clipboard` in production; not implemented in the prototype).
- The segmented `0 / 1 / 3 / 8 / 20` control at the top of the prototype is a **review harness only** — it is not part of the modal. It exists to preview the variable-contact states. Do not ship it.

## State Management
- `contacts: Contact[]` — the only real input. Everything derives from its length:
  - `0` → empty state + disabled CTA.
  - `1` → centered single card, `Contact`.
  - `≥2` → count pill, `Contact (N)`, chooser popover lists all.
  - overflow → scroll, top-aligned.
- `menuOpen: boolean` — chooser popover visibility.
- Contact shape: `{ name, role, org, email, phone, initials, label }` (`initials` derivable from `name`).
- Brand shape: `{ name, initials, category, storeCount, latestStore: { name, openedDate }, locations: [...] }`.

## Design Tokens
Colors:
- `--bg: #FBFAF7`  `--surface: #FFFFFF`
- `--ink: #171419`  `--ink2: #4A4451`  `--ink3: #7C7588`  `--ink4: #B5AEC0`
- `--border: #E8E4DC`  `--border-soft: #EFEBE2`  `--border-hard: #D8D2C5`
- `--violet: #7033FF`  `--violet-deep: #5421CC`  `--violet-tint: #EEE9FF`  `--violet-tint-soft: #F5F1FF`

Typography:
- UI/text: **Inter** (400/500/600/700).
- Mono kickers, emails, phones, chips: **JetBrains Mono** (400/500).
- Kicker style: 10.5px, weight 500, letter-spacing 1.4px, uppercase, `--ink3`.

Radii: cards 14px · modal 22px · logo tile 13px · buttons 13px (footer) / 8px (copy) · pills 999px.
Shadows: modal `0 40px 120px -30px rgba(20,10,40,.65)`; popover `0 26px 64px -22px rgba(20,10,40,.55)`.
Footer button height: 50px.

## Assets
- **Map**: currently an inline SVG placeholder + SVG pins. Replace with **Mapbox GL JS** plotting real store coordinates.
- **Icons**: inline SVGs (storefront, close, contact/person, mail, phone, empty-state person+). Swap for the codebase's existing icon set.
- **Fonts**: Inter + JetBrains Mono (Google Fonts in the prototype; use the app's font pipeline).
- No raster image assets.

## Files
- `Brand Info Modal.html` — this design (included in bundle).
- `Requirement Modal - States.html` — the sibling "has a requirement" modal (in project root; reference for shared components, not in this bundle).
