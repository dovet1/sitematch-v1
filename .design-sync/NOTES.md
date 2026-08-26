# design-sync notes — commercial_directory / SiteMatcher

## Repo shape

This repo has no Storybook and no pre-existing design-system package — `apps/web`
is a Next.js 15 / React 19 app. The design system synced here is a **new**
buildable package, `packages/design-system`, created specifically for this sync.
It does not reimplement anything: it re-exports the app's real component source
via TypeScript path aliases (`@/*` → `../../apps/web/src/*`) and compiles it with
tsup + the app's own Tailwind config/tokens. Source of truth stays in `apps/web`;
`packages/design-system` is a thin buildable wrapper around it.

## Scope decision (confirmed with user)

- **UI primitives**: all of `apps/web/src/components/ui/**` (shadcn/radix based).
- **Homepage sections**: only the components that make up the **current**
  homepage (`apps/web/src/app/page.tsx`): `components/homepage-new/**` and
  `components/homepage2/Footer.tsx`. The older `components/homepage/**` and the
  rest of `components/homepage2/**` (Hero, Pricing, Partners, FeaturedListings,
  etc.) are NOT synced — they're unused variants, several of which fetch live
  Supabase data and would need heavy mocking for no benefit since they aren't
  what's actually live.
- Explicitly OUT of scope: `sitematcher-unified` (the "unified workspace") —
  it's map/Zustand/Mapbox-state-heavy, not presentational, and was used only as
  a visual/style reference, never pulled in as buildable components.

## Build setup gotchas

- **`npm install` needs `--legacy-peer-deps`** at the repo root. `lucide-react@0.294.0`'s
  peerDependencies cap at React 18, but the repo runs React 19 (root `overrides`
  force this everywhere). Re-syncs must reinstall with this flag or a plain
  `npm install` throws ERESOLVE.
- **styled-jsx types**: `TrustedBy.tsx` uses `<style jsx>` (Next.js's styled-jsx,
  not a design-system concept). `packages/design-system/tsconfig.json` adds
  `"types": ["node", "styled-jsx/global"]` to pick up the `jsx`/`global` prop
  augmentation on `<style>` — without it, `tsup`'s dts build fails on that file.
  At runtime (outside Next's compiler) the `jsx` attribute is just an inert
  DOM attribute; the CSS still applies, just unscoped/global rather than
  component-scoped. Harmless for a preview card.
- **Next.js shims** (`packages/design-system/src/shims/`): `next/image` → plain
  `<img>`, `next/link` → plain `<a>`, `next/navigation` → no-op `useRouter`/
  `usePathname`/`useSearchParams`. Wired via `tsconfig.json` `paths` overrides
  (exact-specifier entries win over the `@/*` wildcard).
- **Auth/subscription shim**: `@/contexts/auth-context` is shimmed
  (`src/shims/auth-context.tsx`) to a logged-out, no-op `useAuth()` — this
  keeps `Hero.tsx`/`FeatureRow.tsx` (which gate CTAs on `useAuth()` +
  `useSubscriptionTier()`) deterministic and free of any real Supabase network
  call. `useSubscriptionTier.ts` itself is the REAL app hook (not shimmed) —
  it imports `@/contexts/auth-context`, which resolves to the shim, so it
  naturally settles to the free tier with no backend involved.
- **CSS tokens**: `packages/design-system/src/tailwind-entry.css` is a hand
  copy of the relevant `:root` custom properties from `apps/web/src/app/globals.css`
  (Violet Bloom design tokens) plus the homepage's `sm-*` Tailwind color/radius/
  font-size scale from `apps/web/tailwind.config.js`. If the app's tokens change,
  this file needs updating by hand — it is NOT generated from `globals.css`.
- **Fonts**: Inter + JetBrains Mono are loaded in the app via `next/font/google`
  (self-hosted, no `@font-face` to scrape). The design-system CSS instead loads
  them via a plain Google Fonts `@import` in `tailwind-entry.css` — validate
  reports this as `[FONT_REMOTE]`, informational, no action needed. `Plus Jakarta
  Sans`/`Lora`/`IBM Plex Mono` are fallback-stack names only, never actually
  loaded in the app either — left as-is.

## Preview authoring scope (confirmed with user)

Core set (~40 components): all top-level UI primitives (Button, Badge, Alert,
AlertDialog, Accordion, Card, Checkbox, CheckboxMultiSelect, Collapsible,
Command, Dialog, DropdownMenu, ImageUpload, Input, Label, MultiSelectDropdown,
Popover, Progress, RadioGroup, RangeSlider, SearchableDropdown, Select,
Separator, Slider, Switch, Table, Tabs, Textarea, Toast/Toaster, Tooltip) plus
the current-homepage sections (Hero, Features, FeatureRow, Pricing, PricingCard,
FAQ, FAQItem, Testimonial, TrustedBy, VideoSlot, RevealWrapper, Check, Dash,
Footer). The other ~87 discovered exports are sub-parts (AccordionItem,
CardHeader, DialogTrigger, etc.) composed inside their parent's authored story
rather than getting standalone cards — they ship as floor cards, which is
correct/expected, not a gap.

## Known render warns

(none yet — the first validate run had 7 `[RENDER_BLANK]` warnings on Check,
Checkbox, Dash, Input, Progress, Slider, Textarea; inspected the screenshots —
these are real, correctly-styled floor-card renders of components whose default
empty state is just visually sparse (an empty input box, an unchecked checkbox,
a 16px icon), not actually broken. Resolved by authoring real previews with
content for all of them as part of the core-40 set.)

## Re-sync risks

- `tailwind-entry.css`'s copied tokens will silently drift if `globals.css` or
  `tailwind.config.js` change in the app — there's no automated check tying
  them together. Re-syncs should diff those two files against this one and
  update by hand if the design tokens/scale changed.
- The homepage-scope decision (`homepage-new` + `homepage2/Footer` only) is
  tied to what `apps/web/src/app/page.tsx` actually imports today. If the app
  switches to a different homepage variant, `packages/design-system/src/index.ts`
  and this scope note need updating together.
- `useSubscriptionTier`/`useAuth` shim assumes the real hook's shape hasn't
  changed. If `apps/web/src/hooks/useSubscriptionTier.ts` changes what it reads
  off `useAuth()`, the shim in `src/shims/auth-context.tsx` may need new fields.
