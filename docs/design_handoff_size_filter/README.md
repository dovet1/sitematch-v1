# Handoff: Size filter for the Missing / Present Brands panel (SiteMatcher)

## Overview
SiteMatcher's Assess-Area workspace shows a right-hand panel listing brands relative to a
dropped pin's catchment — a **Missing Brands** tab ("The gap · brands missing here") and a
**Present Brands** tab ("Already trading here"). This handoff adds a **Size** filter so a user
holding a vacant unit of a given size gets a shortlist of brands worth phoning about it.

The job to be done: deciding which brands to call about a specific vacant unit. Two questions
drive that call — (1) will my unit physically fit their format? and (2) are they actually
expanding? New EPC-derived floor-area data now answers (1) for most brands, and this feature
makes it filterable and readable without breaking the existing requirement-first list.

## About the design files
The file in this bundle — `Size Filter Panel.dc.html` — is a **design reference created in HTML**.
It is a working prototype showing intended look and behaviour, **not production code to copy
directly**. It is authored as a "Design Component" (a streaming-HTML format used by our design
tool); do not try to reuse that runtime. The task is to **recreate this design in the target
SiteMatcher codebase** using its existing environment, component library, patterns, and state
management (React/Vue/etc.). If no environment exists yet, choose the most appropriate framework
and implement there.

The prototype is self-contained: open it in a browser to interact with every state (switch tabs,
open the Size popover, pick a band, expand the grouped sections). All logic — fit matching, sort
order, band counts, distribution-bar geometry — lives in the `<script>` logic class inside the file
and is the source of truth for behaviour.

## Fidelity
**High-fidelity.** Final colours, typography, spacing, radii, and interactions. Recreate the UI
faithfully using the codebase's existing libraries and patterns. The surrounding panel chrome
(coords, title, population/affluence chips, tab bar, Category/Brand dropdowns) already exists in
the product and is reproduced here only for context — **build only the new parts**: the Size
control + popover, the requirement-vs-size explainer, the new card content (observed size), and
the grouped "Size not on record" / "Outside this size" sections.

---

## The data

Two new datasets back this feature (populated from the England & Wales and Scottish EPC registers):

- **`store_floor_areas`** — one row per store (~43k rows), `floor_area_sqft` + a `confidence`
  grade. **Only `confidence = 'high'` is fit to show a user** (~19k stores).
- **`brand_floor_area_profiles`** — one row per brand and, where it matters, **per fascia**
  (330 rows). Each carries `p25 / median / p75 / min / max` (stored in **m²** — convert to sq ft
  for display), `sample_count`, and `coefficient_of_variation` (CoV).

Coverage: **157 of 226 brands (69%) have a profile; 69 brands have none.** Sample sizes range
5–1,400 (median 42); 116 of 330 profiles rest on fewer than 20 stores. **11 brands have multiple
fascia profiles that differ enormously.**

### Five rules that make or break this feature
1. **Fascia, not brand.** Tesco's brand-level range (3,722–45,260 sq ft) is useless. Split by
   fascia it is Tesco Extra ~105,000, Superstore ~47,800, Express ~3,950 (IQR 3,270–4,610).
   For multi-fascia brands, **never label or filter at brand level** — surface the matching fascia.
2. **Requirement ≠ observed size.** A *requirement* is what the occupier says it wants — current,
   authoritative, the stronger signal. An *observed size* is measured from its existing shops —
   available for far more brands but historic and inferred. **Never merge them into one number or
   one visual treatment.** Where both exist, the requirement leads, and requirement-first sort
   order must survive.
3. **The measurement is Gross Internal Area (GIA), not sales area.** GIA covers the whole envelope
   incl. storage and back-of-house, so it reads larger than the sales-area figure an agent has in
   mind. The **`GIA` basis must be legible without a tooltip**, and a GIA figure must never sit
   where it invites direct comparison with a stated requirement.
4. **Show a range, and show what it rests on.** These are distributions, not measurements. Show
   the IQR range + a quiet sample count. **Do not show a confidence score or percentage** (a number
   with a caveat gets quoted without the caveat). Spread is conveyed by the distribution bar and a
   qualitative word ("tight" / "wide spread"), never a CoV number.
5. **Near misses are where the deals are; absence is not a no.** A brand needing 2,000–3,000 when
   the user has 1,900 is a conversation, not an exclusion — **do not hard-filter**. And the 69
   brands with no size data **must not silently vanish** when a filter is applied: "we don't know"
   and "doesn't fit" are different answers.

---

## Screens / Views

There is one view (the right panel) with two tabs. Everything below refers to the region **below
the existing tab bar**.

### Filter row
- Layout: horizontal flex, `gap: 10px`, three equal children (`flex: 1`), each `height: 42px`.
- **Category** and **Brand** already exist — leave as-is (`border: 1px solid #E4E1EC`,
  `border-radius: 11px`, label `#7D7986` 14px/500, chevron-down right-aligned).
- **Size** is the new, third control, styled identically when inactive.
  - Inactive: label "Size", same border/colour as siblings.
  - Active (a band chosen): fill `#6C4CE0`, white text, label = band short form (e.g.
    "3,000–10,000"), chevron white.
  - Click toggles the Size popover.

### Size popover
- Anchored below the Size control, `width: 290px`, `background: #fff`,
  `border: 1px solid #E4E1EC`, `border-radius: 14px`, `box-shadow: 0 20px 44px -12px rgba(0,0,0,.19)`,
  `padding: 8px`, above the list (`z-index` above cards).
- Header row: caps label "MATCH MY UNIT SIZE" (10px/700, `letter-spacing: .14em`, `#A4A0AD`).
- Five band rows (`padding: 9px 10px`, `border-radius: 9px`, hover/selected bg `#F3EFFD`):
  - Under 1,000 sq ft `[0, 1000]`
  - 1,000 – 3,000 sq ft `[1000, 3000]`
  - 3,000 – 10,000 sq ft `[3000, 10000]`
  - 10,000 – 50,000 sq ft `[10000, 50000]`
  - 50,000 sq ft + `[50000, ∞]`
  - Each row: band label (14px/600) + sub-line "`N` brands fit" (11.5px `#A4A0AD`), where `N` is the
    live count of brands in the current tab whose effective range **overlaps** that band. Selected
    row shows a violet check (`#6C4CE0`).
- Footer row (border-top `#F0EEF4`): "`69` brands have no size on record" (11.5px `#A4A0AD`) +
  a violet **Clear** link (12px/700 `#6C4CE0`) that resets the band and closes the popover.

### Requirement-vs-size explainer (shown only when a band is active)
- A note directly under the filter row: `background: #FAF9FE`, `border: 1px solid #EEE9FB`,
  `border-radius: 11px`, `padding: 11px 13px`, an info glyph + 12px/1.45 copy `#6A6577`:
  > A **requirement** is what a brand says it wants — current. A **size** is measured from its
  > existing shops (gross internal area, historic). They are kept separate.
  ("requirement" bolded `#5537C9`, "size" bolded `#4A4655`.)

### List header
- Missing tab: H2 "The gap · missing here" (21px/800) + right-aligned count "177" (Space Mono 15px
  `#A4A0AD`); subtext (13px/1.5 `#8B8792`): "Occupiers with a live requirement show first, then
  established brands with no presence here. Set a size to match your unit."
- Present tab: H2 "Already trading here", count "57", subtext: "Brands with an established presence
  in this catchment. Set a size to see whose local format fits your unit."

### Card variants (the core deliverable)
All cards: `border-radius: 16px`, `padding: 15px 16px`, `margin-bottom: 10px`. Inner layout is a
flex row — 44px icon square, flexible text column, 18px chevron (`#C3C0CC`) pinned top-right. Icon
square: `border-radius: 12px`, category-colour background at ~13% alpha, initials in the category
colour, 14px/800. Tap target and anatomy unchanged from the existing card.

1. **Requirement + observed** (bg `#F5F2FD`, border `#ECE6FB`)
   - Top pill row: solid violet pill "REQUIREMENT" (10px/700, `letter-spacing: .1em`, `#6C4CE0` bg,
     white) + caps "WANTS TO OPEN HERE" (10px/700, `.13em`, `#9A95B4`).
   - Brand name (15.5px/700).
   - Requirement line (13.5px `#2A2733`): `Wants **1,200–2,500** sq ft` — grotesk, dark. This is the
     stronger claim and leads.
   - Observed block **below**, prefixed with caps label "ESTATE TODAY" so it reads as the other,
     weaker claim (see Observed block spec).
2. **Observed only** (bg `#FFF`, border `#EEECF3`) — brand name + Observed block, no pill.
3. **No data** (bg `#FFF`, border `#EEECF3`) — brand name + caps meta line (category · nearest
   distance) + a quiet chip "Size not on record" (11.5px/600 `#8B8792` on `#F4F3F6`,
   `border-radius: 6px`). Never hidden.
4. **Near miss** — any of the above with border `#F0DEBE` and an inline amber tag: arrow glyph +
   "Near your size band" (11px/700 `#A3671A` on `#FBF1E1`). Applied when the brand's effective range
   does **not** overlap the selected band but comes within tolerance (see logic).
5. **Multi-fascia** — instead of one observed line, a caps heading + one sub-row per fascia
   (name 13px/700 + its own range/GIA tag/distribution bar). With no band: heading
   "TRADES ACROSS FORMATS · FILTER BY SIZE TO NARROW" and all fascias shown. With a band: only the
   matching fascia(s) shown, heading "MATCHING FORMAT".

#### Observed block spec (rule 3 & 4)
- Optional caps label ("ESTATE TODAY" on requirement cards; the store-count meta on Present cards).
- Value line: **range in Space Mono** 13.5px/700 `#4A4655` (e.g. `3,270–4,610`) + "sq ft" (12px
  `#8B8792`) + a **`GIA` tag** (9px/700, `.08em`, `#7A7684` on `#EEECF2`, `border-radius: 4px`).
  Mono + grey deliberately marks this as *measured/inferred*, visually distinct from the grotesk,
  darker requirement figure — never violet.
- Distribution bar (rule 4): 8px-tall track region containing
  - full-width min→max rail: 2px, `#E7E4EE`
  - IQR box (p25→p75): 6px, `#C4BFD2`, `border-radius: 3px`
  - median tick: 2px×10px, `#6B6774`
  Geometry as % of `(max − min)`: `boxLeft = (p25−min)/(max−min)`, `boxWidth = (p75−p25)/(max−min)`,
  `med = (median−min)/(max−min)`.
- Footnote (11px `#A4A0AD`): "`N` stores" + optional "· tight" (CoV ≤ 0.20) or "· wide spread"
  (CoV ≥ 0.38). **No numeric confidence/percentage.**

### Grouped sections (appear when a band is active)
- **"SIZE NOT ON RECORD · 69"** — collapsible (default open on Missing). Caps header + count (Space
  Mono) + chevron; sub-line "We don't know their format yet — that's different from not fitting.
  Still callable." Rows are simplified cards (icon + name + caps meta, no size). This group is the
  literal expression of rule 5: no-data brands never vanish.
- **"OUTSIDE <band> SQ FT · N"** — collapsible (default collapsed). Same simplified rows but at
  `opacity: .72`, each showing its observed range greyed. Known brands that clearly don't fit are
  demoted, never removed.

### Footnote (always visible, panel bottom)
11px/1.5 `#B4B0BD`: "Sizes are **gross internal area (GIA)** measured from each brand's shops — the
whole envelope including storage, so larger than the sales area an agent quotes. A stated
requirement is the stronger, current signal and always leads."

---

## Interactions & behaviour
- **Tabs** — clicking Missing / Present swaps the dataset; active tab gets a 2.5px `#6C4CE0`
  bottom border and `#16131F` text (idle tabs `#B4B0BD`).
- **Size control** — click toggles popover. Selecting a band sets it, closes the popover, collapses
  the "Outside" group. **Clear** resets to no band.
- **No band selected (empty state):** list = requirement brands first, then established brands, in
  the existing order. Observed sizes still show, quietly. No grouped sections; no-data brands appear
  inline as normal established rows.
- **Band selected (active state):** the list re-sorts and splits:
  - **Main list** = brands whose effective range **fits** or is a **near miss**, sorted by
    `fitRank (fit=0, near=1)`, then `hasRequirement desc`, then `sample_count desc`. Requirement-first
    order survives *within* each fit tier (rule 2).
  - **Size-not-on-record group** = no-data brands.
  - **Outside group** = known brands that clearly don't fit.
- **No-results state:** if a band yields zero fitting/near known brands, show a dashed panel
  ("No known-size brands fit <band> sq ft" + "Absence isn't a no — the near-miss and no-size brands
  below are still worth a call") **above** the still-present grouped sections — never a dead end.
- **Collapsible groups** — header click toggles; chevron rotates −90° when collapsed
  (`transition: transform .2s`).
- Present tab behaves identically; cards carry a store-count meta ("2 stores · Luton") instead of a
  requirement pill, and the observed block confirms which local format fits.

### Fit / near-miss / multi-fascia logic (authoritative — see the file's logic class)
- **Effective range** for matching: requirement `[lo,hi]` if present; else observed IQR `[p25,p75]`;
  for multi-fascia, the set of each fascia's `[p25,p75]`.
- **overlaps(lo,hi,band)** = `lo ≤ band.hi && hi ≥ band.lo` → **fit**.
- **near(lo,hi,band)** (only when not overlapping): above the band → `band.hi ≠ ∞ && lo ≤ band.hi*1.25`;
  below the band → `hi ≥ band.lo*0.75` → **near miss**.
- No profile → **unknown** (always the size-not-on-record group).
- Otherwise → **outside**.
- Multi-fascia: fit = any fascia overlaps; when a band is active, display only fascias that
  overlap or near the band.

## State management
- `tab`: `'missing' | 'present'`.
- `band`: band id or `null`.
- `sizeOpen`: popover visibility.
- `unknownOpen` (default true), `outsideOpen` (default false): group collapse state.
- Derived per render: the mapped/sorted/split lists, per-band fit counts, distribution-bar %s,
  formatted range strings. No async in the prototype; in production these come from
  `brand_floor_area_profiles` filtered to the catchment's brand set, with m²→sq ft conversion and
  the `confidence = 'high'` gate applied upstream.

## Design tokens
**Colours**
- Violet primary / requirement: `#6C4CE0`; bold-text violet `#5537C9`
- Requirement card bg `#F5F2FD`, border `#ECE6FB`; explainer bg `#FAF9FE`, border `#EEE9FB`
- Ink `#16131F`; secondary text `#2A2733` / `#4A4655`; muted `#8B8792`; faint `#A4A0AD` / `#B4B0BD`
- Card border `#EEECF3` / `#F0EEF4`; control border `#E4E1EC`
- Population chip bg `#F1EDFB` (label `#8B83B8`); affluence chip bg `#E9F4EC` (label `#5A9A72`)
- Distribution bar: rail `#E7E4EE`, IQR box `#C4BFD2`, median tick `#6B6774`
- GIA tag: text `#7A7684` on `#EEECF2`
- Near miss: text `#A3671A`/`#B9761F` on `#FBF1E1`, border `#F0DEBE`
- Category icon colours: Grocery `#2E7D4F`, Food & Beverage `#C0413B`, Pet `#C6408A`,
  Discount `#2563C9`, Health & Fitness `#0E8C8C`, Self Storage `#B9761F` (backgrounds at ~13% alpha)

**Typography**
- UI / body: **Hanken Grotesk** (400/500/600/700/800)
- Numerics that are *measured data* — coordinates and observed size ranges: **Space Mono** (400/700).
  This mono treatment is semantic (measured/inferred), not decorative; keep requirement figures and
  population/affluence in the grotesk.
- Caps labels: 9.5–11px, 600–700 weight, `letter-spacing` .11–.14em, uppercase.

**Radii** — controls/explainer 11px, cards 16px, panel 16px, pills/tags 4–6px, popover 14px.
**Shadows** — popover `0 20px 44px -12px rgba(0,0,0,.19)`; panel `0 30px 80px -20px rgba(0,0,0,.38)`.

**Number formatting** — round sensibly, never imply precision: <1,000 → nearest 10; 1,000–10,000 →
nearest 50; 10,000–100,000 → nearest 500; ≥100,000 → nearest 1,000. Thousands separators; en-dash
between range bounds. Convert m²→sq ft (×10.7639) before rounding.

## Assets
None external. Icons are inline SVG (chevrons, close, info, arrow, check). Brand logos in the real
product replace the initials squares — use the codebase's existing brand-logo component; the
initials square is the fallback.

## Files
- `Size Filter Panel.dc.html` — the full interactive prototype (open in a browser). Its inline
  `<script>` logic class is the behavioural source of truth: data shapes, `fitFor` / `overlaps` /
  `near`, sort order, band counts, distribution geometry, and number formatting.
- `screenshots/01-empty-missing.png` — Missing tab, no band set (default requirement-first list).
- `screenshots/02-size-popover.png` — Size popover open with per-band fit counts.
- `screenshots/03-band-active-explainer.png` — a band selected: violet trigger + requirement-vs-size
  explainer.
- `screenshots/04-cards-fits.png` — panel with a band active.
