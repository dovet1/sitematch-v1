# Handoff: Sign In / Create Account

## Overview

Authentication entry-point for SiteMatcher — a single page that toggles between a **Sign in** flow and a **Create account** flow. The visual language matches the new SiteMatcher homepage ("Direction A — Editorial Restraint"): warm off-white background, Inter + JetBrains Mono pairing, a single violet accent, and ample whitespace.

The Create account flow captures the data needed to provision a SiteMatcher account: email, password (with live strength validation) and an optional marketing opt-in. A standard Terms / Privacy disclaimer sits beneath the primary CTA.

## About the Design Files

The files bundled in this handoff are **design references created in HTML** — React prototypes (mounted via in-browser Babel) showing the intended look and behaviour. They are NOT production code to copy directly.

The task is to **recreate these designs in the target codebase's existing environment** (e.g. Next.js + Tailwind, Vue, etc.) using that codebase's established patterns and libraries — its form primitives, validation utilities, auth hooks, routing, and design tokens. If no front-end environment exists yet, pick the most appropriate framework for the project and implement against it.

Treat the HTML as a high-fidelity specification of layout, copy, spacing, colour and behaviour — not as the implementation.

## Fidelity

**High-fidelity (hifi).** Final colours, typography, spacing, interactions, copy, and field-level validation rules. Build pixel-accurately against the tokens documented below, using the codebase's existing primitives where they map cleanly.

## Screens / Views

The page is a single route (e.g. `/sign-in` or `/auth`) that hosts two modes. A segmented tab control at the top of the form switches between them; deep-linking to a specific mode (e.g. `?mode=signup`) should also work.

### Shared shell (both modes)

- **Top nav** (sticky): SiteMatcher logo (left), nav links `Browse Requirements`, `Free Tools` (dropdown), `Articles` (centre/left of right cluster), `Post Requirement (Free!)` pill, `Sign in` text link, `Create account` violet button. Identical to homepage nav — reuse the existing nav component.
- **Two-column main area** below the nav:
  - **Left column** (editorial rail): copy block + customer quote. Hidden on viewports ≤ 860px.
  - **Right column** (form column): white surface, contains the tab switcher and the active form.
- Both columns share equal width on desktop (`grid-template-columns: 1fr 1fr`). Min-height fills viewport minus nav.

### Left rail — Sign in mode

- Eyebrow: violet dot + `WELCOME BACK` (JetBrains Mono, 11px, 1.4px tracking, uppercase, `#7C7588`).
- H1: "Pick up *right where you left off.*" — Inter, weight 600, clamp(36px, 4.6cqi, 56px), line-height 1.0, letter-spacing −0.04em, colour `#171419`. The italicised phrase uses weight 500 and colour `#5421CC`.
- Subhead: "Your shortlists, saved searches and reports — all waiting on the other side of one quick sign in." — Inter 16/1.5, `#4A4451`, max-width 420px.
- Customer quote at bottom, separated by a 1px top border (`#EFEBE2`). Quote in Inter 16/1.5 ink; attribution row below with 28×28 avatar swatch (`#D9D2E4`) and name + role in 13px, ink3.

### Left rail — Create account mode

- Eyebrow: `CREATE YOUR ACCOUNT`.
- H1: "The clearest view of UK property — *starts free.*"
- Subhead: "Create an account in under a minute. No card required. Cancel any time."
- Feature list (three items, 14px gap), each: a small violet check medallion (16×16, `#EEE9FF` background, `#5421CC` tick) + bold label + muted continuation.
  1. **Full database access** — every verified live requirement, refreshed daily.
  2. **Free tools forever** — GapFinder, SiteAnalyser and SiteSketcher, no time limit.
  3. **30-day trial of Pro** — direct contacts, branded PDFs and CSV exports.
- Same customer quote block at bottom.

### Right column — tab switcher

- Pill container: 4px padding, 1px border `#E8E4DC`, radius 999px, background `#FBFAF7`.
- Two tabs: `Sign in`, `Create account`. Active tab: violet background `#7033FF`, white text, radius 999px. Inactive: transparent background, ink2 text. Tab buttons: 8px × 18px padding, Inter 14/500.

### Right column — Sign in form

Form gap 18px. Field labels are Inter 13/500 ink, 7px above input.

| Field | Type | Placeholder | Notes |
|---|---|---|---|
| Email address | `email` | `you@company.co.uk` | `autocomplete="email"` |
| Password | `password` | `Enter your password` | `autocomplete="current-password"`; eye toggle to reveal |

Below password:
- A row split between **Remember me for 30 days** (checkbox, default checked) on the left and **Forgot password?** (violet text link) on the right.

Primary CTA: **Sign in** — full-width, 50px tall, radius 10px, background `#7033FF`, white text, Inter 15/600. Disabled (grey) until both fields are non-empty. Hover deepens to `#5421CC`.

Divider: `OR CONTINUE WITH` (JetBrains Mono 11/1.2px tracking, ink3) with 1px borderSoft rules either side.

Two SSO buttons in a 2-column grid: **Google** and **Microsoft**. White surface, 1px border `#E8E4DC`, 46px tall, 10px radius, Inter 14/500, brand mark + label.

Below the form, centered: "New to SiteMatcher? **Create an account**" — the button portion switches modes.

### Right column — Create account form

Fields, in order:

| Field | Type | Placeholder / Options | Validation |
|---|---|---|---|
| Email address | `email` | `you@company.co.uk` | Required; basic email format |
| Password | `password` (toggleable) | `Create a password` | See password rules below |

**Password rules** — render as a 2-column grid of indicators directly below the password input. Each rule shows a 14×14 round tick (empty bordered circle when unmet → soft green `#DCFCE7` fill with green `#15803D` tick when met). Text colour transitions from ink3 (unmet) to `#15803D` (met).

1. `8+ characters`
2. `Uppercase letter`
3. `Lowercase letter`
4. `A number`

Password is valid only when all four rules pass.

**Marketing opt-in** (checkbox, defaults to **unchecked**):

> **Keep me in the loop.** Send me product updates, market insights and the occasional newsletter. You can unsubscribe anytime.

Bolded lead-in is Inter 13/500 ink; the rest is Inter 13/normal ink2.

**Primary CTA**: **Create account** — same styling as Sign in CTA. Disabled until: email non-empty and all four password rules pass.

**Terms disclaimer** (directly below CTA, centered, Inter 12/1.55 ink3):

> By creating an account, you agree to our [Terms](#) and [Privacy Policy](#).

Terms / Privacy are inline anchor links, violetDeep `#5421CC`, no underline by default, underline on hover. Use the codebase's router/Link component to point at the real legal pages.

Divider: `OR SIGN UP WITH` — same Google / Microsoft buttons as Sign in.

Below the form, centered: "Already have an account? **Sign in**".

## Interactions & Behavior

- **Mode toggle** — clicking either tab or the bottom switch link swaps the form WITHOUT a route change. URL query (`?mode=signin|signup`) should reflect the active mode so the page can be deep-linked and so the SSO callback can return to the right view.
- **Password reveal** — clicking the eye icon toggles the `type` between `password` and `text`. Icon swaps between "eye" and "eye-off" states (see SVGs in `auth.jsx`).
- **Live password validation** — each rule re-evaluates on every keystroke. Use the regexes already in `auth.jsx`:
  - len: `value.length >= 8`
  - upper: `/[A-Z]/.test(value)`
  - lower: `/[a-z]/.test(value)`
  - num: `/[0-9]/.test(value)`
- **Submit button enablement** — recompute on every state change; do not allow submission while disabled.
- **Submit handlers** — wire to the codebase's existing auth service. Form data on Create account:
  ```ts
  { email: string, password: string, marketingOptIn: boolean }
  ```
- **SSO** — Google and Microsoft buttons should kick off the corresponding OAuth flow. Same buttons appear on both modes; on success, route the user to the dashboard.
- **Forgot password** — opens the codebase's existing reset flow.
- **Remember me** — persists session for 30 days when checked (codebase default may already do this).
- **Focus styles** — every input gets a violet border + 3px violet-tinted box-shadow on focus (`border-color: #7033FF; box-shadow: 0 0 0 3px rgba(112,51,255,0.12)`).
- **Hover** — primary CTA: background `#7033FF` → `#5421CC`. SSO buttons: surface `#FFFFFF` → bg `#FBFAF7`. Tools-menu items and account-menu items get `#F5F1FF` background on hover.
- **No transitions on tab switch** — instant swap; existing form state for the inactive mode is reset on switch (treat it as a fresh form).

## Responsive Behavior

Designed at 1440 desktop and 390 mobile (verified in the design canvas).

- Container query on `.sm-page` so the nav and layout adapt regardless of where the component is embedded.
- **≤ 860px** (form column): the editorial left rail is hidden entirely (`display: none`). The form fills the column, padding drops to `32px 20px 64px`.
- **≤ 760px** (nav): nav links + Sign in + Create account buttons collapse into a burger-triggered overlay menu, identical to the homepage nav's mobile pattern.
- Password rules grid stays 2-column at mobile; if space is tight, collapse to 1 column under 380px.

## State Management

Local component state is sufficient — no global state needed here.

- `mode: "signin" | "signup"` — URL-driven, defaults to `signin`.
- Per-form: `email`, `password`, `showPassword` (bool), and for signup: `marketingOptIn` (bool). Plus `rememberMe` (bool) on signin.
- Derived: `passwordRuleStates` (array of `{id, label, met}`), `formValid` (bool).

No data fetching required to render. Submit fires the auth call.

## Design Tokens

All tokens are defined in `direction-a.jsx` as `A_COLORS`. The auth page reuses the same set — do not introduce new colours.

### Colours

| Token | Hex | Use |
|---|---|---|
| `bg` | `#FBFAF7` | Page background, off-form column |
| `surface` | `#FFFFFF` | Cards, inputs, form column, SSO buttons |
| `ink` | `#171419` | Primary text, active tab background |
| `ink2` | `#4A4451` | Secondary text, labels |
| `ink3` | `#7C7588` | Tertiary text, placeholders |
| `border` | `#E8E4DC` | Input + button borders |
| `borderSoft` | `#EFEBE2` | Dividers, subtle rules |
| `violet` | `#7033FF` | Primary CTA, focus ring, accent dot |
| `violetDeep` | `#5421CC` | Hover state, italic accents, links |
| `violetTint` | `#EEE9FF` | Feature-check medallion bg, post-pill bg |
| `violetTintSoft` | `#F5F1FF` | Menu-item hover |
| `orange` | `#F26B1F` | "(Free!)" callout in nav pill |
| Success green | `#15803D` (text), `#DCFCE7` (bg), `#BBF7D0` (border) | Met password rules |

### Typography

- **Body / UI**: Inter (400, 500, 600, 700). Loaded via Google Fonts.
- **Mono / eyebrows**: JetBrains Mono (400, 500). Loaded via Google Fonts.
- **Eyebrow**: JetBrains Mono 11px, 1.4px letter-spacing, uppercase, ink3.
- **H1 (rail)**: Inter 600, clamp(36px, 4.6cqi, 56px), line-height 1.0, letter-spacing −0.04em.
- **Form title**: Inter 600, 30px, line-height 1.1, letter-spacing −0.03em.
- **Form titlesub**: Inter 400, 15px, ink2.
- **Field label**: Inter 500, 13px, ink, −0.1px letter-spacing.
- **Input text**: Inter 400, 15px.
- **Helper / rule text**: Inter 12px.
- **Button (primary)**: Inter 600, 15px, −0.1px letter-spacing.
- **Button (secondary / SSO)**: Inter 500, 14px.

### Spacing & Sizing

- Form gap (between fields): 18px.
- Field label-to-input gap: 7px.
- Input height: 46px; pill submit height: 50px.
- Input padding: `0 14px` (add `padding-right: 44px` when a trailing button is present).
- Border radius: 10px (inputs, buttons), 999px (tabs, pills, post-requirement), 14px (cards / menus), 5px (checkbox).
- Auth shell padding (desktop): `80px 64px` on both columns.
- Card max-width: 460px.
- SSO button grid: 2 cols, 10px gap.

### Shadows

- Focus ring: `0 0 0 3px rgba(112,51,255,0.12)`.
- Floating menus (free tools, account): `0 18px 40px -16px rgba(20,10,40,0.15)`.
- Mobile menu overlay: `0 24px 40px -20px rgba(20,10,40,0.15)`.

## Assets

- **Logo** — SiteMatcher mark + wordmark. Inline SVG in `direction-a.jsx` (`SiteMatcherLogo` component). Mark fill: `#7033ff`. Wordmark: Inter 600, ink. Use the project's existing logo files (`logo-icon.svg`, `logo-full.svg`) in production.
- **Eye / EyeOff icons** — Inline SVG in `auth.jsx` (`EyeIcon`). Replace with the codebase's icon library equivalent (e.g. lucide `Eye` / `EyeOff`).
- **Check icon** — Inline SVG `CheckIcon` in `auth.jsx`. Replace with the codebase equivalent.
- **Google brand mark** — 4-colour Google "G" SVG inline in `auth.jsx`. Use the official Google Sign-In asset in production.
- **Microsoft brand mark** — 4-square Microsoft logo SVG inline in `auth.jsx`. Use the official Microsoft asset in production.
- **Customer avatar** — flat colour swatch (`#D9D2E4`) placeholder. Replace with the actual customer headshot when available, or remove the quote block if the customer hasn't approved usage.
- **Fonts** — Inter and JetBrains Mono from Google Fonts. If the codebase self-hosts fonts, mirror those weights (Inter 400/500/600/700, JetBrains Mono 400/500).

## Files

Files in this handoff folder:

- `Sign In _ Create Account.html` — entry HTML. Sets up React + Babel and mounts the AuthPage inside a DesignCanvas with four artboards (desktop sign-in, desktop create, mobile sign-in, mobile create).
- `auth.jsx` — the AuthPage React component plus `AUTH_CSS`. Contains `SignInForm`, `CreateAccountForm`, `AuthLeftRail`, the validation rules, role options, and SVG icons. Depends on `A_COLORS` and `A_Nav` from `direction-a.jsx`.
- `direction-a.jsx` — homepage "Direction A" components. Provides `A_COLORS`, `A_CSS`, `A_Nav`, `SiteMatcherLogo`, and shared visual primitives the auth page reuses.
- `shared.jsx` — VideoSlot placeholder + a few utilities. Imported by the homepage; the auth page itself doesn't depend on it but it's loaded by the host HTML.
- `design-canvas.jsx` — design canvas wrapper (panning, artboards, focus mode). Not part of the production component — strictly a presentation harness for the design.
- `logo-icon.svg`, `logo-full.svg` — production logo files.

When implementing, the only files that describe the actual UI to build are `auth.jsx` (forms) and the nav/colour section of `direction-a.jsx`. Everything else is presentation scaffolding.
