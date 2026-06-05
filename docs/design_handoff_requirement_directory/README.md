# Handoff: Requirement Directory

> **These files are HTML design references** — high-fidelity prototypes showing intended look and behaviour. The task is to recreate these designs inside the SiteMatcher codebase using its existing framework, routing, and component patterns. Do not ship the HTML directly.

---

## Overview

The **Requirement Directory** is a searchable, filterable catalogue of verified live commercial property requirements in the UK. Each listing represents a brand actively seeking premises. The feature sits under `/directory` (or equivalent) and is accessible from the main nav under "Browse Requirements".

The design is built to the same visual vocabulary as the SiteMatcher homepage: warm cream background, Inter + JetBrains Mono type pairing, hairline borders, violet as the sole accent.

---

## Fidelity

**High-fidelity.** All colours, spacing, typography, component states, and copy are final or near-final. Implement pixel-accurately, using the design tokens below, within the existing codebase's component and styling system.

---

## Screens / Views

### 1. List View — `/directory`

The default view. Shows a sticky toolbar at the top, a header strip, active filter chips, then a 4-column card grid.

**Layout**
- Full-width page, `background: #FBFAF7`
- Nav sits at top (shared `<A_Nav>` component, see `direction-a.jsx`)
- Sticky toolbar below nav at `top: 64px`, `z-index: 40`, `padding: 20px 40px`, `border-bottom: 1px solid #EFEBE2`
- Header strip: `padding: 40px 40px 24px`, flex row, space-between
- Active filter chip row: `padding: 0 40px 24px`, flex wrap, `border-bottom: 1px solid #EFEBE2`
- Card grid: `display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; padding: 28px 40px 80px`

**Toolbar**
- Search input: `flex: 1`, `height: 48px`, `border-radius: 10px`, `border: 1px solid #E8E4DC`, white bg
  - Placeholder: "Search location, brand or sector"
  - Right side: keyboard shortcut badge `⌘ K` in JetBrains Mono 11px
- Filter button: `height: 48px`, `border-radius: 10px`, same border as search
  - Active filter count badge: violet bg `#7033FF`, white text, JetBrains Mono 11px, `border-radius: 999px`
- View toggle (List / Map): inner pill switcher, `height: 48px`, `border-radius: 10px`
  - Active tab: `background: #171419`, white text; inactive: transparent, `color: #4A4451`
  - Inner buttons have `border-radius: 7px`

**Header strip**
- Left: mono eyebrow "DIRECTORY · UPDATED DAILY" in `#7C7588`, 11px, `letter-spacing: 1.2px`
- `<h1>`: Inter 44px, weight 600, `letter-spacing: -0.035em`; italic portion in `color: #5421CC`, weight 500
  - Copy: "Live requirements — *verified, current.*"
- Lede paragraph: Inter 16px, `color: #4A4451`, `max-width: 580px`
- Right: live count + last sync in same mono style as eyebrow

**Active filter chips**
- Each chip: `padding: 6px 10px 6px 12px`, `border-radius: 999px`, white bg, `border: 1px solid #E8E4DC`
  - Key label: JetBrains Mono 11px uppercase `color: #7C7588`
  - Value: Inter 13px
  - × dismiss: `color: #A39CAD`
- "+ Add filter" button: dashed border variant
- Sort button: transparent, dropdown chevron
- "Clear all" link: `text-decoration: underline`, `color: #7C7588`, margin-left auto

**Card**
- `background: white`, `border: 1px solid #E8E4DC`, `border-radius: 14px`, `padding: 22px`
- Hover: `border-color: #7C7588`, `box-shadow: 0 8px 24px -12px rgba(20,10,40,0.12)`
- Logo mark: 52×52px, `border-radius: 10px`, brand bg colour, white initials, Inter 18px weight 700
- Brand name: Inter 17px, weight 600, `letter-spacing: -0.3px`
- Sector: JetBrains Mono 11px, `letter-spacing: 1.2px`, uppercase, `color: #5421CC`
- Data rows: `display: grid; grid-template-columns: 64px 1fr; gap: 12px`
  - Key: JetBrains Mono 10px, uppercase, `color: #7C7588`
  - Value: Inter 14px, `color: #171419`
- Footer: flex, space-between
  - Verified badge: 6px green dot + "Verified X ago", Inter 12px weight 500, `color: #15803D`
  - "View →" link: Inter 14px weight 500; arrow shifts +3px on card hover

**Responsive (≤760px container)**
- Toolbar wraps, `padding: 12px 16px`
- Grid: `grid-template-columns: 1fr`, `padding: 20px 20px 60px`
- H1 drops to 32px

---

### 2. Map View — `/directory?view=map`

Same toolbar and header, but the card grid is replaced by a full-width map area.

**Map container**
- `height: 920px`, `border-top: 1px solid #EFEBE2`
- Background: abstract grid lines + radial gradients (`#ECE6F6`, `#F0EBE2`) over `#F4F1EA` — represents a placeholder for a real map embed (Mapbox / Google Maps)
- In production: swap this background for a real map SDK iframe/canvas

**Map pins**
- Standard: 28×28px, `border-radius: 999px`, `background: #7033FF`, white text (count), `border: 2px solid white`, `box-shadow: 0 4px 12px rgba(20,10,40,0.2)`
- Large variant (`.lg`): 44×44px, same style
- Small dot (`.sm`): 14×14px, no label

**Map popover card** (appears on pin click)
- 340px wide, `border-radius: 14px`, white bg, `border: 1px solid #E8E4DC`
- `box-shadow: 0 16px 40px -12px rgba(20,10,40,0.18)`
- Lists up to 3 brands with mini logo, name, sector, and external link icon

**Map footer overlay (bottom-left)**
- Count of properties in view
- Semi-transparent white pill, JetBrains Mono 11px uppercase

---

### 3. Filter Drawer — overlay on list/map views

Opens from the "Filters" button. A left-side drawer overlaid on the dimmed page content.

**Overlay**
- `position: absolute; inset: 0`, `background: rgba(23,20,25,0.4)`, `z-index: 70`

**Drawer**
- `width: 420px`, `top/left/bottom: 0`, `background: #FBFAF7`, `border-right: 1px solid #E8E4DC`, `z-index: 71`
- Header: `padding: 24px 28px`; mono kicker "FILTER RESULTS" in `#5421CC`; title "Refine your search" Inter 22px weight 600; × close button 36×36px
- Body: scrollable; `padding: 8px 0`
- Footer: `padding: 16px 28px`, flex row: "Reset" ghost button + "Apply filters" primary button with result count badge

**Filter groups** (accordion rows, `border-bottom: 1px solid #EFEBE2`)
Each group has a label (Inter 15px weight 600) + chevron toggle + meta count hint (JetBrains Mono 10px).

Groups:
1. **Company name** — text input
2. **Sectors** — checkbox list with counts (Food & Bev, Retail, Commercial, Leisure, Health & Beauty, Automotive)
3. **Planning use class** — pill multi-select (E Commercial, F Local Community, Sui Generis, C1 Hotel, B8 Storage)
4. **Listing type** — placeholder
5. **Site size (sq ft)** — dual-handle range slider, JetBrains Mono value labels
6. **Site size (acres)** — placeholder
7. **Dwelling count** — placeholder

**Checkbox**
- 18×18px, `border-radius: 5px`, `border: 1.5px solid #E8E4DC`
- Checked: `background: #7033FF`, white checkmark SVG

**Range slider**
- Track: 4px tall, `background: #EFEBE2`, `border-radius: 999px`
- Fill: `background: #171419`
- Handles: 16×16px circle, white bg, `border: 2px solid #171419`

**Pill toggle**
- Default: white bg, `border: 1px solid #E8E4DC`
- Active: `background: #171419`, white text

---

### 4. Listing Modal — 4 tabs

Opens when a card is clicked. Full-screen two-column layout overlaid on the (blurred/dimmed) directory.

**Shell**
- `position: absolute; inset: 0`, `background: #FBFAF7`, `z-index: 80`
- `display: grid; grid-template-columns: 1fr 1.05fr` (map left, content right)
- Close button: 40×40px, `border-radius: 10px`, top-left corner

**Left column — map**
- Abstract map background (same treatment as map view — replace with real map in production)
- Location badge (top-left): "6 locations · London", dark pill with violet dot
- Map scale (bottom-right): JetBrains Mono 11px + 60px bar
- Purple map pins scatter-placed at brand target locations

**Right column — side panel**
- `padding: 24px 40px 80px`, `overflow-y: auto`
- Eyebrow: JetBrains Mono 11px, `color: #5421CC`, "Live requirement · verified DD MMM YYYY"
- Title row: large logo mark (64×64px, `border-radius: 14px`) + brand name (Inter 36px weight 600)
- Stats bar: 3-column grid (Locations / Size / Use class), `border-top` and `border-bottom: 1px solid #EFEBE2`
  - Key: JetBrains Mono 10px, uppercase, `color: #7C7588`
  - Value: Inter 17px, weight 500

**Tab bar** (4 tabs)
- `border-bottom: 1px solid #EFEBE2`
- Tab: Inter 15px weight 500, `color: #7C7588`; active: `color: #171419` + 2px underline (full-bleed bottom)
- Tab labels: "From {Brand}", "Requirements", "Target locations", "Contact"

**Tab content:**

#### Overview tab
- Section heading: JetBrains Mono 13px, uppercase, `color: #7C7588`
- **Brochure card**: flex row, `border-radius: 12px`, `border: 1px solid #E8E4DC`, white bg
  - Left: 44×44px violet tint icon box; doc SVG icon in `#7033FF`
  - Middle: title (Inter 15px weight 500) + sub (JetBrains Mono 11px, file size + date)
  - Right: "Download" button with download SVG icon
- **Verified card**: green tint bg `#E7F5EC`, `border: 1px solid #E7F5EC`, `border-radius: 12px`
  - Circle icon with green checkmark
  - "Verified listing" Inter 14px weight 600, `color: #15803D`
  - Sub: JetBrains Mono 11px, `color: #15803D`, date + next check
- Brief summary paragraph: Inter 15px, `line-height: 1.6`, `color: #4A4451`

#### Requirements tab
- Stacked requirement cards, `border-radius: 12px`, white bg, `border: 1px solid #E8E4DC`
  - Label: JetBrains Mono 10px uppercase, `color: #7C7588`
  - Value: Inter 22px weight 500, `letter-spacing: -0.4px` (or 16px for longer text)
  - Tag rows: flex wrap
    - Violet tag: `background: #F5F1FF`, `color: #5421CC`, `border-radius: 6px`
    - Green tag (use class): `background: #E7F5EC`, `color: #15803D`

Fields shown: Site size, Sectors, Planning use classes, Tenure preference, Frontage minimum

#### Target locations tab
- Numbered list cards, `border-radius: 10px`, white bg, `border: 1px solid #E8E4DC`
  - Number badge: 26×26px, `border-radius: 6px`, violet tint bg, JetBrains Mono 12px `color: #5421CC`
  - Location text: Inter 15px
  - Pin icon: `color: #A39CAD`

#### Contact tab
- **Contact card**: `border-radius: 14px`, white bg, `border: 1px solid #E8E4DC`, `padding: 24px`
  - Header: avatar circle (52×52px, `background: #7033FF`, white initial) + name (Inter 18px weight 600) + role (JetBrains Mono 11px uppercase, `color: #7C7588`)
  - Fields grid: `grid-template-columns: 64px 1fr auto`
    - Key: JetBrains Mono 10px, uppercase, `color: #7C7588`
    - Value: Inter 15px weight 500
    - Copy/Open button: small, `border-radius: 6px`, ghost style
- **Info note** (below card): violet tint bg `#F5F1FF`, `border: 1px solid #EEE9FF`, `border-radius: 12px`
  - Info icon in `#5421CC`
  - "Mention SiteMatcher when you reach out." — Inter 13px `color: #5421CC`

**Upgrade CTA** (bottom of every modal tab — gated state)
- `background: #171419`, `border-radius: 18px`, `padding: 32px`, `text-align: center`
- Eyebrow: JetBrains Mono 11px, `color: #7033FF`
- Heading: Inter 24px weight 600; italic in `color: #B79DFF`
- Body: Inter 14px, `line-height: 1.5`, `color: rgba(255,255,255,0.7)`
- CTA button: `background: #7033FF`, `border-radius: 10px`, `padding: 13px 22px`
- Sub-note: JetBrains Mono 11px, `color: rgba(255,255,255,0.5)`, "30-day free trial · Cancel anytime"

**Responsive (≤760px)**
- Grid becomes single column, map sits at top `height: 280px`
- Side panel `padding: 20px`
- H2 drops to 28px
- Tab bar scrolls horizontally

---

## Interactions & Behaviour

| Trigger | Action |
|---|---|
| Click card | Open listing modal (overlay) |
| Click close (modal) | Dismiss modal, return to directory |
| Click "Filters" button | Open filter drawer from left edge |
| Click overlay (filter drawer) | Close filter drawer |
| Click "Apply filters" | Close drawer, reload results with params |
| Click "Reset" (drawer) | Clear all filter state |
| Click "List" / "Map" toggle | Switch view, update URL (`?view=list` / `?view=map`) |
| Click tab (modal) | Switch tab panel content |
| Click chip × | Remove that filter, re-run query |
| Click "Clear all" | Remove all active filters |
| Card hover | Elevate card (border + shadow), arrow nudges right +3px (CSS transition 150ms) |
| Filters button shows count badge | Badge appears when ≥1 filter is active; hidden otherwise |
| Modal — contact tab (gated) | Contact details hidden behind upgrade CTA for non-Pro users; show full details for Pro+ |

**URL / state patterns:**
- Active view: `?view=list` (default) or `?view=map`
- Active filters: query params e.g. `?sector=food-beverage&size_min=1000&size_max=5000`
- Open modal: `?listing=allpress-espresso` (or slug)
- Active modal tab: `?listing=allpress-espresso&tab=requirements`

**Scroll behaviour:**
- Toolbar sticks at `top: 64px` (below the global nav)
- Modal panel right-column scrolls independently

---

## State Management

```
DirectoryPage
  view: "list" | "map"
  filtersOpen: boolean
  activeListing: Listing | null
  activeTab: "overview" | "requirements" | "locations" | "contact"
  filters: {
    query: string
    sectors: string[]
    useClass: string[]
    sizeSqFtMin: number | null
    sizeSqFtMax: number | null
    sizeAcresMin: number | null
    sizeAcresMax: number | null
  }
  sort: "recently-verified" | "alphabetical" | "size-asc" | "size-desc"
  page: number
  results: Listing[]
  totalCount: number
  loading: boolean
```

---

## Design Tokens

### Colours
| Token | Hex | Usage |
|---|---|---|
| `bg` | `#FBFAF7` | Page background |
| `bgAlt` | `#F5F1E8` | Section alternate bg |
| `surface` | `#FFFFFF` | Cards, inputs |
| `ink` | `#171419` | Primary text, dark buttons |
| `ink2` | `#4A4451` | Secondary text |
| `ink3` | `#7C7588` | Tertiary text, meta |
| `ink4` | `#A39CAD` | Placeholder, disabled |
| `border` | `#E8E4DC` | Card / input borders |
| `borderSoft` | `#EFEBE2` | Section dividers |
| `violet` | `#7033FF` | Primary CTA, verified badges, pins |
| `violetDeep` | `#5421CC` | Sector labels, eyebrows |
| `violetTint` | `#EEE9FF` | Violet bg tints |
| `violetTintSoft` | `#F5F1FF` | Softer violet bg |
| `orange` | `#F26B1F` | "Free!" accent |
| `green` | `#15803D` | Verified state |
| `greenTint` | `#E7F5EC` | Verified card bg |

### Typography
| Use | Font | Size | Weight | Notes |
|---|---|---|---|---|
| Page H1 | Inter | 44px | 600 | `letter-spacing: -0.035em` |
| Modal H2 | Inter | 36px | 600 | `letter-spacing: -0.035em` |
| Card name | Inter | 17px | 600 | `letter-spacing: -0.3px` |
| Body copy | Inter | 15–16px | 400 | `line-height: 1.55–1.6` |
| Nav links | Inter | 15px | 500 | — |
| Button | Inter | 14–15px | 500 | `letter-spacing: -0.1px` |
| Sector/eyebrow | JetBrains Mono | 11px | — | `letter-spacing: 1.2–1.4px`, uppercase |
| Data row key | JetBrains Mono | 10px | — | `letter-spacing: 1px`, uppercase |
| Keyboard hints | JetBrains Mono | 11px | — | — |
| Stat value | Inter | 17px | 500 | `letter-spacing: -0.2px` |
| Req value | Inter | 22px | 500 | `letter-spacing: -0.4px` |

### Spacing
- Page horizontal padding (desktop): `40px`
- Page horizontal padding (mobile): `20px`
- Card padding: `22px`
- Modal side panel padding: `24px 40px 80px`
- Drawer padding: `24px 28px` (header/footer), `18px 28px` (filter groups)

### Border radius
| Element | Radius |
|---|---|
| Cards, modal | `14px` |
| Inputs, buttons (standard) | `10px` |
| Small buttons | `8px` |
| Tags / chips | `6px` |
| Pills / badges | `999px` |
| Logo marks (card) | `10px` |
| Logo marks (modal) | `14px` |

### Shadows
| Element | Shadow |
|---|---|
| Card hover | `0 8px 24px -12px rgba(20,10,40,0.12)` |
| Map popover | `0 16px 40px -12px rgba(20,10,40,0.18)` |
| Dropdown menus | `0 18px 40px -16px rgba(20,10,40,0.15)` |

---

## Data Model (Listing)

```typescript
interface Listing {
  id: string
  slug: string
  name: string           // "Allpress Espresso"
  initials: string       // "AE"
  logoColor: string      // brand hex, e.g. "#6F4A2E"
  sector: string         // "Food & Beverage"
  verified: boolean
  verifiedAt: Date
  nextCheckAt: Date
  locations: string[]    // array of location strings
  primaryLocation: string // "London Bridge + 5 more"
  sizeSqFtMin: number
  sizeSqFtMax: number
  useClasses: string[]   // ["E (Commercial)", "Sui Generis"]
  targetCities: number   // count
  tenurePreference?: string
  frontageMin?: string
  summary?: string       // brand's own brief
  brochureUrl?: string
  contact?: {            // only visible to Pro+ subscribers
    name: string
    role: string
    email: string
    phone: string
    website: string
  }
  targetLocations: string[]  // full list for the locations tab
  tags: string[]         // additional sector tags
}
```

---

## Gating / Access Control

| Content | Free | Pro | Plus |
|---|---|---|---|
| Browse listings (names, sectors, sizes) | ✓ | ✓ | ✓ |
| Active filter chips + sort | ✓ | ✓ | ✓ |
| Overview tab (brochure + summary) | ✓ | ✓ | ✓ |
| Requirements tab | ✓ | ✓ | ✓ |
| Target locations tab | Locked (upgrade CTA) | ✓ | ✓ |
| Contact tab (direct contact) | Locked (upgrade CTA) | ✓ | ✓ |

The upgrade CTA block (dark bg, violet button) renders at the bottom of locked modal tabs for free users. It is always visible in the design reference even for Pro views — in production it should only appear when the user's tier is below the required level.

---

## Navigation Context

The directory is one of four "Free Tools" accessible from the main nav under the **Free Tools** dropdown:
- GapFinder
- **Requirement Directory** ← this feature
- SiteAnalyser
- SiteSketcher

The nav also has: Browse Requirements (links to the directory), Articles, Post Requirement (Free!), Sign in / Create account.

The `<A_Nav>` component in `direction-a.jsx` is the shared nav with hover-open tools dropdown and account menu — it should be the same nav used across all pages.

---

## Assets / Icons

All icons in the design are inline SVGs (no external icon library). The source is in `directory.jsx`. Key icons:

- **Search**: circle + diagonal line
- **Filters**: 3 horizontal lines, decreasing width
- **List / Map toggle**: lines vs. location pin
- **Arrow →**: right-pointing with arrowhead (used in card CTAs)
- **× Close**: cross / X
- **Download**: down-arrow to line
- **Verified checkmark**: circle + checkmark path (`stroke: #15803D`)
- **Info**: circle + dot + vertical bar
- **Pin**: teardrop + inner circle
- **Document**: rect + horizontal lines

**SiteMatcher logo**: SVG in `logo-icon.svg` and `logo-full.svg`. Also inlined in `direction-a.jsx` as `<SiteMatcherLogo>`. Use the SVG asset from the repo directly.

**Map**: In the prototype, the map is a CSS-gradient placeholder with a static UK coastline SVG approximation and a Thames silhouette. In production, replace with Mapbox GL JS or Google Maps at the same container dimensions.

---

## Files in This Bundle

| File | Purpose |
|---|---|
| `Requirement Directory.html` | Entry point — loads all JSX components via Babel |
| `directory.jsx` | All directory-specific components: toolbar, header, cards, list view, map view, filter drawer, modal (all 4 tabs) |
| `direction-a.jsx` | Shared nav (`<A_Nav>`), hero, homepage sections, and shared CSS (`A_CSS`, `A_COLORS`) |
| `shared.jsx` | Shared primitives: `VideoSlot`, `Check`, `Dash`, `PRICING`, `FAQS`, `LOGOS` |
| `design-canvas.jsx` | Design canvas wrapper (viewer only — not needed in production) |
| `logo-icon.svg` | SiteMatcher logo mark |
| `logo-full.svg` | SiteMatcher full logo |

> **Note:** The `.html` file uses React + Babel loaded from CDN for prototype purposes. In production, these components should be rewritten as proper React components (or whichever framework the codebase uses) with real data fetching, routing, and the codebase's own CSS/styling system.

---

## Implementation Notes

1. **The map** is a design placeholder. Replace with a real map SDK. The pin styles, cluster popovers, and scale bar should be reproduced as map overlays.

2. **Scroll reveal animations** (`[data-reveal]` + `IntersectionObserver`) are decorative. Reproduce if the codebase has a standard entrance animation pattern; omit if not.

3. **The toolbar should sticky** at the nav height. If the nav height changes from 64px, update `top` accordingly.

4. **The modal** is designed as a full-screen overlay (not a `<dialog>` but functionally equivalent). Use the existing modal/sheet pattern from the codebase.

5. **Responsive breakpoint** is at 760px container width (uses CSS `container-type: inline-size`). Translate to whatever responsive system the codebase uses.

6. **Contact details** (email, phone, website) should only be fetched/rendered for Pro+ subscribers. The upgrade CTA block takes their place for free users.

7. **Verification date** and "next check" date should come from the API — the design shows them as relative text ("verified 7 May 2026", "Next check in 23 days").
