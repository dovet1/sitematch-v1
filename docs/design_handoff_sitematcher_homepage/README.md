# Handoff: SiteMatcher Homepage Redesign

## Overview
A full marketing homepage for **SiteMatcher** — a UK commercial property platform — covering hero, "Trusted by", four-feature deep-dive, testimonial, pricing (with monthly/annual toggle), FAQ, and footer. The design includes both logged-out and logged-in nav states, and adapts from desktop (1440) down to mobile (~390).

## About the Design Files
The files in `source/` are **design references created in HTML/React-via-Babel** — prototypes that demonstrate the intended look, layout, and interaction patterns. They are **not production code to copy directly**.

Your task is to **recreate these designs in the SiteMatcher codebase's existing environment**, using its established framework, component library, styling system, and routing conventions. If no codebase exists yet, pick the most appropriate stack for a marketing site (Next.js + Tailwind is a sensible default) and build it cleanly there.

Specifically, **do not** ship the Babel-in-browser approach, the inline `<style>` template-string CSS, or the `DesignCanvas`/artboard wrapper — those exist purely to render the mocks side-by-side in the design tool.

## Fidelity
**High-fidelity.** Colors, type scale, spacing, radii, copy, and interaction states are all final and should be matched closely. The only intentionally rough elements are:
- **Video placeholders** (`VideoSlot` component) — striped SVG placeholders. Real product videos need to be supplied by the SiteMatcher team and dropped in.
- **"Trusted by" logo cells** — currently rendered as text labels (`GreyHart Ltd`, `Northfield`, etc.). Replace with real customer logo SVGs/PNGs.
- **Testimonial avatar** — a flat grey circle; swap for a real headshot.

## File Map
```
source/
├── SiteMatcher Homepage.html   ← entry point; mounts <DirectionA /> 4× in a design canvas
├── direction-a.jsx             ← the actual page (nav, hero, features, pricing, FAQ, footer)
├── shared.jsx                  ← VideoSlot, Check/Dash icons, PRICING, FAQS, LOGOS data
├── design-canvas.jsx           ← design-tool scaffolding — IGNORE when implementing
├── logo-full.svg               ← SiteMatcher wordmark + icon
└── logo-icon.svg               ← Icon-only mark
```
The page lives in `direction-a.jsx`. Read `shared.jsx` for pricing/FAQ data structures. Ignore `design-canvas.jsx` — it's the surrounding artboard chrome.


## Design Tokens

### Colors
```
bg              #FBFAF7   page background (warm off-white)
surface         #FFFFFF   cards, menus, testimonial band
ink             #171419   primary text, dark CTAs, footer bg
ink2            #4A4451   secondary text
ink3            #7C7588   tertiary text, monospace eyebrows
border          #E8E4DC   card / nav borders
borderSoft      #EFEBE2   section dividers, faint rules
violet          #7033FF   brand primary (CTAs, accents)
violetDeep      #5421CC   italic emphasis, eyebrow accents
violetTint      #EEE9FF   "Post Requirement" pill bg, sale chip
violetTintSoft  #F5F1FF   menu item hover
orange          #F26B1F   "(Free!)" emphasis text in pill
```

**Status / utility colors** (used as literals, not tokens):
- Success green: bg `#DCFCE7`, text `#15803D`, star `#16A34A` (account tier pill)
- Danger red: text `#DC2626`, border `#FECACA`, bg `#FEF2F2` (sign-out / log-out items)
- Footer logo violet: `#9B6BFF` (lighter violet, only on dark footer bg)

### Typography
- **Primary:** Inter (400, 500, 600, 700)
- **Mono / eyebrow:** JetBrains Mono (400, 500)

Type scale (all Inter unless noted):
```
hero h1           clamp(38px, 6.6cqi, 88px) / 0.98 / -0.04em / 600
  hero h1 em      italic, weight 500, color violetDeep
hero subtitle     clamp(16px, 1.6cqi, 20px) / 1.45 / 400 / ink2
section h2        clamp(32px, 4.4cqi, 56px) / 1.02 / -0.035em / 600
faq h2            clamp(30px, 3.8cqi, 48px) / 1.04 / -0.035em / 600
feature title     clamp(28px, 3.4cqi, 44px) / 1.04 / -0.04em / 600
feature body      clamp(15px, 1.4cqi, 17px) / 1.55 / 400 / ink2
testimonial quote clamp(22px, 3cqi, 36px) / 1.25 / -0.025em / 500
nav link          15px / 500 / ink
body / bullets    15px / 1.5 / 400 / ink
small / meta      13px–14px / ink2 or ink3
eyebrow (mono)    11px / 1.4px tracking / UPPERCASE / ink3 (JetBrains Mono)
feature kicker    12px / 1px tracking / UPPERCASE / ink3 (JetBrains Mono)
price             46px / 600 / -0.035em
```
Note: `cqi` units are **container query units**, scaling against `.sm-page` which uses `container-type: inline-size`. In the production app, just use viewport-based clamps (`vw`) or a tailwind responsive scale — the `cqi` is only needed because the mocks are rendered at different artboard widths in the design canvas.

### Spacing
Component-level spacing is hand-tuned rather than tokenized. Section padding uses `clamp(72px, 9cqi, 120px)` vertical / `clamp(20px, 5cqi, 80px)` horizontal. Generally:
- Nav: 16px / 40px (mobile 14px / 18px)
- Hero top: 80px (mobile 48px)
- Feature row: 72px vertical, 80px column gap (mobile 52px vertical, 28px stack gap)
- Card padding: 32px (mobile 26px)
- Button padding: 13px 20px (primary), 9px 16px (compact create-account), 14px 16px (full-width mobile)

### Border radius
```
buttons (standard)     10px
buttons (compact)      8px
buttons (mobile full)  12px
chips / tags           4–8px
pill / round chip      999px
cards (price, FAQ)     18px / 14px
menus (tools, account) 14px
```

### Shadows
- Tools menu / account menu: `0 18px 40px -16px rgba(20,10,40,0.15)` (account uses 0.18)
- Mobile menu overlay: `0 24px 40px -20px rgba(20,10,40,0.15)`
- Nav: no shadow, uses `backdrop-filter: saturate(140%) blur(8px)` over a sticky bg

### Motion
- Scroll reveal: every section with `data-reveal` starts at `opacity: 0; transform: translateY(16px)` and animates to `opacity: 1; transform: none` over `600ms ease` (opacity) + `700ms cubic-bezier(0.22, 1, 0.36, 1)` (transform) when 8% intersects the viewport. Trigger via IntersectionObserver on mount.
- Hover transitions: `background .12s` on menu items, `background .15s, transform .15s` on the Post Requirement pill, `transform .18s` on the chevron rotation.


## Buttons (reusable)

Three styles, shared base. Base: `font-family: Inter; font-size: 15px; font-weight: 500; padding: 13px 20px; border-radius: 10px; border: 1px solid transparent; letter-spacing: -0.1px;`

| Class           | Background     | Text   | Border         | Use                                                |
|-----------------|----------------|--------|----------------|----------------------------------------------------|
| `.btn-violet`   | `#7033FF`      | white  | `#7033FF`      | **Primary brand CTA** — "Create account", "Start trial", per-feature CTAs |
| `.btn-primary`  | `#171419` ink  | white  | `#171419`      | Secondary dark CTA — used on the featured (dark) pricing card's plan switcher pill background; **not** for the main Create account button |
| `.btn-ghost`    | transparent    | ink    | `#E8E4DC`      | Tertiary — "See it in action", "Post For Free (Forever!)", Sign in (mobile) |

**Post Requirement pill** is its own treatment: `.sm-post-pill` — rounded 999px, `#EEE9FF` bg, violet text, with the word "(Free!)" in orange `#F26B1F`. Hover bg `#E4DBFF`.

## Sections & Components

### 1. Nav (`A_Nav`)
Sticky top nav with backdrop blur.

**Logged out (desktop):**
- Left: SiteMatcher logo (icon + wordmark, 26px height)
- Center: `Browse Requirements` · `Free Tools ▾` · `Articles` (Inter 15px / 500)
- Right: `Post Requirement (Free!)` pill · `Sign in` link · `Create account` button (**violet**)

**Logged in (desktop):**
- Same left + center
- Right: Post Requirement pill · avatar + email + chevron trigger (opens account menu)

**Free Tools dropdown** — opens on hover. 320px wide, white, 14px radius, contains four items (GapFinder, Requirement Directory, SiteAnalyser, SiteSketcher), each with name (14px / 600) and description (13px / ink3). Hover row bg: `#F5F1FF`.

**Account dropdown** — opens on hover. 260px wide, contains:
- Header with email (14px / 600) and green tier pill ("Pro Member" with star icon, `#DCFCE7` bg / `#15803D` text)
- Divider
- Dashboard / Admin / Manage Subscription (each with stroked SVG icon)
- Divider
- Log out all devices (ink)
- Sign out (red `#DC2626`)

**Mobile (<760px container width):**
- Burger button appears on the right; center nav links hide
- Tapping burger opens a full-width overlay (absolute, top: 64px) containing: account block (if logged in), Browse Requirements link, "FREE TOOLS" mono group label + 4 tool items, Articles link, "ACCOUNT" group label + account items (if logged in), then a footer with the Post Requirement pill (full width) and either `[Sign in | Create account]` side-by-side (logged out) or a red Sign out button (logged in).
- Mobile links: Inter 20px / 500 / -0.3px tracking, with `borderSoft` bottom rules.

### 2. Hero (`A_Hero`)
- Centered. Eyebrow: `FOR COMMERCIAL PROPERTY PROFESSIONALS` (mono, with violet dot).
- H1 (2 lines via `<br/>`): `The clearest view of UK commercial property — in one place.` — final phrase italicized in `violetDeep`.
- Subtitle: `Find requirements, map brand presence, analyse catchments and mock up sites — without the spreadsheet trail.`
- CTAs (centered, 10px gap, wrap on mobile): `Start 30-day free trial` (violet) · `See it in action ↓` (ghost)
- Then a 16:9 `VideoSlot` labeled "Full product overview", max-width 1180px, 64px top margin.

### 3. Trusted by (`A_TrustedBy`)
- Uppercase mono eyebrow: `TRUSTED BY THE BIGGEST NAMES IN UK COMMERCIAL PROPERTY` (centered, ink3).
- 8-column grid of logo cells, with hairline borders top & bottom and 1px vertical rules between cells. Each cell is 26px padded, Inter 15px / 500 / ink3.
- Mobile: collapses to 2 columns; vertical rule between the pair, horizontal rules between rows.

### 4. Features (`A_Features` → `A_FeatureRow` × 4)
Section header: eyebrow `HOW IT WORKS` + h2 `Four tools. One workflow. From shortlist to signed.`

Then four alternating rows. Each row is a 2-column grid (`1fr 1fr`, 80px gap, 72px vertical padding). Rows 2 and 4 use the `.reverse` modifier so the video sits on the left.

Each `A_FeatureRow` contains:
- **Copy column:** mono kicker `0{n} / {kicker}` (e.g. `01 / Map brand presence`); h3 with the tool name and a subdued `— headline`; body paragraph; bulleted list (5px violet/ink dot bullets); CTA buttons.
- **Video column:** 4:3 `VideoSlot`.

The four features, in order:
1. **GapFinder** — "see where every brand isn't yet." — CTA: `Find Gaps Now` (violet)
2. **Requirement Directory** — "only the live ones, only the real ones." — reverse — CTAs: `Browse Requirements Now` (violet) + `Post For Free (Forever!)` (ghost)
3. **SiteAnalyser** — "instant demographics for any UK postcode." — CTA: `Try For Free` (violet)
4. **SiteSketcher** — "sketch a feasibility in a coffee break." — reverse — CTA: `Try For Free` (violet)

(Full body copy + bullets are in `direction-a.jsx` lines ~520–600. Copy them verbatim.)

Mobile: rows collapse to 1 column, **video stacks on top of copy** for every row, 28px gap, 52px vertical padding.

### 5. Testimonial (`A_Testimonial`)
- Full-width band with `#FFFFFF` bg and hairline top/bottom borders.
- Centered, max-width 980px. Quote-mark SVG (32×24, ink at 25% opacity) on top.
- Quote text (see `direction-a.jsx` — long-form quote from Kerry Northfield).
- Below: 40×40 flat grey avatar circle (`#D9D2E4`) + name "Kerry Northfield" (600) + role "Director Advisor · Voicemagic Shopworthy" (ink3) — left-aligned within the centered group.

### 6. Pricing (`A_Pricing` → `A_PricingCard` × 3)
- Centered. Eyebrow `PRICING`. H2 `Simple, transparent pricing.` Subtitle about the free trial.
- **Period toggle**: pill segmented control with two options: `Monthly` / `Annual · save 17%`. Active state: ink bg, white text. Inactive: transparent, ink2.
- **Sale chip**: `Summer Sale — 50% off, ends 31 August` — violet-tinted chip with violet dot, sits between the toggle and the cards.
- **3 cards**, 18px gap, equal width:
  - **Free** — white, ghost CTA `Get started`. £0/forever.
  - **Pro** — white, outline CTA `Start 30-day free trial`. Strike-through `£79` + `50% off` chip + price. Audience: "For agents & landlords". Includes feature list with one disabled (GapFinder, struck through).
  - **Plus** — **dark featured card** (ink bg, white text), violet CTA `Start 30-day free trial`. `Most popular` violet badge floating at top-left. Audience: "For deal-led teams". Includes a `GapFinder included` callout box (violet-tinted on dark).
- Footer note: "All plans include the full SiteMatcher database. Cancel anytime. No card required for trial."

All pricing data lives in the `PRICING` object in `shared.jsx`. Use it as the source of truth for copy + prices.

Mobile: cards stack 1-column, 14px gap, 26px padding.

### 7. FAQ (`A_FAQ`)
- Eyebrow `FAQ`. H2 `Everything you need to know.`
- Single-column accordion, max-width 880px. Rows separated by 1px ink-border hairlines.
- Closed: question (Inter 18px / 500) + circular `+` toggle on the right (ghost).
- Open: `+` flips to `−`, toggle inverts to ink bg / white text. Answer expands below (Inter 16px / 1.6 / ink2, max-width 680px). Only one open at a time.
- Below the accordion, a "Still have questions?" CTA card linking to `hello@sitematcher.co.uk` (violet button).
- 5 questions defined in `shared.jsx` `FAQS` array — copy verbatim.

### 8. Footer (`A_Footer`)
- Dark band (ink `#171419`), white-ish text.
- 4-column grid (`1.4fr 1fr 1fr 1fr`):
  - Brand column: lighter violet (`#9B6BFF`) logo + wordmark, then tagline "The clearest view of UK commercial property. Built for occupiers, agents and landlords."
  - **Product:** GapFinder, Requirement Directory, SiteAnalyser, SiteSketcher
  - **Company:** About, Customers, Careers, Contact
  - **Legal:** Terms, Privacy, Cookies
- Meta row below a 1px white/10 divider: `© 2026 SiteMatcher Ltd` left, `hello@sitematcher.co.uk` right.
- Mobile: collapses to 2-column grid; meta stacks vertically left-aligned.


## Interactions & Behavior

| Interaction | Trigger | Result |
|---|---|---|
| Free Tools menu | Hover on nav item (desktop) | Dropdown opens, chevron rotates 180° |
| Account menu | Hover on avatar trigger (desktop) | Dropdown opens, chevron rotates |
| Mobile menu | Tap burger | Full-width overlay slides in; burger swaps to ×; tap again to close |
| Period toggle | Click Monthly / Annual | Pricing cards re-render with the other price set; active pill = ink bg / white text |
| FAQ row | Click question | Toggles open. Opening one closes the previous (single-open accordion). `openIdx` state defaults to `0` (first row open on load). |
| Section reveal | Scroll into viewport (8% threshold) | Element fades + slides up (see Motion above) |
| Button hover | Hover | Background shifts on the post-pill (`#EEE9FF` → `#E4DBFF`) and menu items (`#F5F1FF`); other buttons have no defined hover yet — please add a subtle darken (`color-mix` 6–8%) consistent with your stack. |

For desktop hover menus, consider also opening on focus/click for keyboard + touch users in the real implementation.

## State Management
Component-local state only. Nothing global is needed for the homepage itself.

- `A_Nav` — `mobileOpen: boolean`, `toolsOpen: boolean`, `acctOpen: boolean`
- `A_Pricing` — `period: "monthly" | "annual"` (default `"annual"`)
- `A_FAQ` — `openIdx: number` (default `0`, `-1` means none open)
- `DirectionA` — accepts an `isLoggedIn` prop; in production wire this to your auth context.

The `user` object passed to `A_Nav` is currently mocked as `{ email: "you@company.co.uk", initial: "D", tier: "Pro Member" }` — wire to your real session.

## Responsive Behavior
The mocks use **container queries** scoped to `.sm-page` (`container-type: inline-size`) so the same component can render at 1440 and 390 in the design canvas. In your production app, container queries are still appropriate if the page is ever embedded inside a constrained container, but standard viewport media queries are perfectly fine for a top-level marketing page.

Breakpoints used:
- `max-width: 760px` — primary mobile breakpoint (nav collapses, columns stack, type shrinks)
- `max-width: 480px` — minor: hero letter-spacing eases off slightly

There is no explicit tablet breakpoint between 760 and the desktop max; the layout is fluid via `clamp()` between those.

## Assets

| Asset | Where | Action for dev |
|---|---|---|
| Logo (icon + wordmark) | Inline SVG in `direction-a.jsx` and also as `logo-full.svg` / `logo-icon.svg` | Use the SVGs in `source/`. Wordmark is Inter 600, letter-spacing -0.4, sized at 0.75× icon height. |
| Customer logos | Text labels in `shared.jsx` `LOGOS` array | **Need real assets** — request real customer logo SVGs from the SiteMatcher team |
| Product videos | `VideoSlot` placeholders (5 of them: hero + 4 features) | **Need real assets** — capture 60s product walkthroughs |
| Testimonial avatar | Flat grey circle | **Need real asset** — request headshot of Karry Northfield |
| Fonts | Inter + JetBrains Mono via Google Fonts | Use whatever font-loading strategy your stack prefers (next/font, fontsource, self-hosted, etc.) |

## Implementation Notes

1. **Strip the design canvas wrappers** — `SiteMatcher Homepage.html` mounts `DirectionA` inside `<DCArtboard>` x 4 (desktop logged-out/in, mobile logged-out/in). In production this is just one page rendered at the user's viewport.
2. **Componentize properly** — break `direction-a.jsx` into your codebase's conventional file structure (e.g. `components/marketing/Nav.tsx`, `Hero.tsx`, `FeatureRow.tsx`, `PricingCard.tsx`, `FaqAccordion.tsx`, `Footer.tsx`).
3. **Replace the template-string CSS** — `A_CSS` is a giant tagged template injected via `<style>{A_CSS}</style>`. Move to CSS modules / Tailwind / styled-components / whatever your codebase uses. Tokens listed above map cleanly to a Tailwind theme extension.
4. **Drop the `data-reveal` IntersectionObserver wiring from `SiteMatcher Homepage.html`** — port the same effect into a small `<Reveal>` wrapper component or a Tailwind `@starting-style` / Framer Motion solution.
5. **Accessibility** — please add:
   - `<button>` semantics with proper `aria-expanded` on the FAQ toggles, Free Tools dropdown, account menu, and burger
   - Focus styles on all interactive elements (currently none defined)
   - `<nav>`, `<main>`, `<section>` landmarks (the mocks use `<nav>` and `<section>` already; verify they survive your refactor)
   - Keyboard support for the hover menus (open on focus, close on Escape, trap focus while open)
   - Skip-to-content link
6. **Data sources** — `PRICING`, `FAQS`, `LOGOS`, `FREE_TOOLS`, `ACCOUNT_MENU` are all defined as plain JS objects/arrays. Move them to your CMS / config of choice.
7. **SEO / meta** — not represented in the mocks. Add title, description, OG image, structured data for the FAQ section.
8. **Email link** — the FAQ "Still have questions?" button shows `hello@sitematcher.co.uk` and should be a `mailto:` link.
9. **Routes / links** — every nav and CTA is currently a button with no destination. Wire to real routes (`/requirements`, `/tools/gapfinder`, `/articles`, `/signup`, `/login`, etc.).

## Open Questions for the SiteMatcher Team
- Final copy for the hero subtitle and feature bodies — confirm or revise.
- Real customer logos (8 needed) + permission to use them.
- Real product walkthrough videos (1 hero + 4 feature).
- Real testimonial author photo + final approved quote text.
- Confirm pricing: £0 / £33–£39.50 / £41–£49.50 (with 50% summer sale strike-throughs) and the "ends 31 August" sale deadline.
- Trial flow: 30-day free trial with no card required — confirm with billing.
- Logged-in state: confirm the account-menu items (Dashboard / Admin / Manage Subscription) match the app's actual top-level routes.


## Screenshots

Reference renders of all four artboards (sans-serif fallback was used in capture; production should load Inter from Google Fonts as shown in the source files):

### Desktop · Logged out (1440 wide, scaled to fit)
- `screenshots/01-desktop-loggedout.png` — Nav + hero
- `screenshots/02-desktop-loggedout.png` — Trusted by + start of Features
- `screenshots/03-desktop-loggedout.png` — SiteAnalyser + SiteSketcher features
- `screenshots/04-desktop-loggedout.png` — Pricing + FAQ + footer

### Desktop · Logged in (1440 wide)
- `screenshots/01-desktop-loggedin.png` — Nav with avatar + email trigger replacing Sign in / Create account

### Mobile · Logged out (390 wide)
- `screenshots/01-mobile-loggedout.png` — Collapsed nav + hero
- `screenshots/02-mobile-loggedout.png` — Feature row (video stacks above copy)
- `screenshots/03-mobile-loggedout.png` — Stacked pricing cards

### Mobile · Logged in (390 wide)
- `screenshots/01-mobile-loggedin.png` — Collapsed nav (burger only)
- `screenshots/02-mobile-loggedin.png` — Mobile menu **open** with logged-in account block, Free Tools group, etc.
