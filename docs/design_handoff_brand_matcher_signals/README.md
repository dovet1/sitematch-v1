# Handoff: Brand Matcher signal detail panels + collapsed row indicators

## Overview
SiteMatcher's Brand Matcher mode ranks retail brands against a user's site. Each brand shows up as a collapsed row in a list. Expanding a row opens a card with a score breakdown on the left (one row per signal) and a detail panel on the right for whichever signal is selected.

This handoff covers two things:
1. **Signal detail panels**: the right-hand panel content for each scored signal (Size fit, Use class, Acquisitive, Demographics, Nearest store), plus the empty state for Size fit.
2. **Collapsed row indicators** (option **3d**): each signal cell gets a status glyph (tick / caution / cross / dash) next to its value, so status can be read without relying on colour.

The Financials and Contacts panels are unchanged from the previous handoff (see `#2bfin` and `#2bcontacts` in the design file).

## About the design files
`SiteMatcher Modes.dc.html` is a **design reference built in HTML**. It's a prototype showing the intended look and content, not production code. Rebuild these designs in the target codebase using its existing components, patterns and libraries. To view it, open the file in a browser with `support.js` alongside it. It's a pan/zoom canvas, and the relevant boards are at the top under "TURN 3".

Relevant anchors in the file:
- `#3d`: collapsed rows (chosen option)
- `#3size`, `#3sizeempty`, `#3use`, `#3acq`, `#3demo`, `#3near`: detail panels
- `#2b`: the full expanded card the panels sit inside
- `#2bsparse`, `#2bempty`: existing empty states for the other signals

`#3a`–`#3c` are rejected alternatives. Ignore them.

## Fidelity
**High fidelity.** Colours, type, spacing and copy are final. All data values (store counts, sizes, percentiles, distances, place names) are **placeholders** and must come from real data.

---

## 1. Collapsed row: status glyphs (3d)

### Layout
- The row is a card: `background #FFFFFF`, `border 1px solid #E4E0F0`, `border-radius 16px`, `padding 16px 22px`.
- The row is a grid: `44px 160px minmax(0,1fr) 70px 64px 110px`, `gap 14px`, `align-items center`.
  Columns: logo · brand name + subline · **signals** · turnover · fit score · contacts button.
- The signals column is a nested grid, `repeat(5, minmax(0,1fr))`, `gap 10px`, ordered: Unit size, Use class, Acquisitive, Demographics, Nearest store.
- A column header row sits above the list. It uses the same grid with `padding 0 22px`, text `11px / 700`, `letter-spacing .02em`, `#8A8895`, uppercase, nowrap. Headers: `BRAND`, `UNIT SIZE`, `USE CLASS`, `ACQUISITIVE`, `DEMOGRAPHICS`, `NEAREST STORE`, `TURNOVER`, `FIT / 100` (right-aligned).
- Rows are stacked with a `10px` gap.

### Signal cell
`display flex; align-items center; gap 7px`. The value text is Figtree `13.5px / 600`, `#2A2833`.

The glyph is an `18×18` circle, `border-radius 50%`, centred character, `font-weight 800`:

| Status | Glyph | Circle bg | Glyph colour | Glyph size | Value text |
|---|---|---|---|---|---|
| Good | ✓ | `#E3F3EA` | `#1E8A56` | 11px | `#2A2833`, 600 |
| Caution | ! | `#FDF3DC` | `#8A5F06` | 11px | `#2A2833`, 600 |
| Poor | ✕ | `#FBE7E6` | `#A33A35` | 10px | `#A33A35`, 600 |
| No data | – | `#F4F3F9` | `#B7B5C2` | 12px | `No data`, `#A9A6B5`, 500 |

Use an icon component in production rather than text characters if the codebase has one. Keep the shapes distinct.

Example values: `Fits`, `Upper end`, `Above range`, `Class E`, `High`, `Medium`, `Strong`, `Good`, `11 mi`, `0.6 mi`.

### Other row cells
- Logo: `44×44`, `border-radius 11px`, brand colour bg, white Space Grotesk `16px / 700` initials.
- Brand name: Space Grotesk `17px / 700`. Subline: Figtree `13px`, `#8A8895`, `margin-top 2px` (e.g. "Food-to-go · 2,500 UK stores").
- Turnover: `13.5px / 600`, `#2A2833`. If no turnover is filed, show `—` in `#8A8895`.
- Fit: the score in Space Grotesk `24px / 700` `#4B23C9`, followed by `/100` in `12px / 600` `#8A8895`, right-aligned.
- Contacts button: `bg #F1EEFA`, `color #4B23C9`, `13px / 700`, `padding 9px 14px`, `radius 10px` (e.g. "3 contacts"). If there's no named contact, use an outlined `Switchboard` button: `border 1px solid #E1DEEC`, `color #6B6B78`, `padding 8px 13px`.

---

## 2. Signal detail panels

### Shared panel shell
- This is the right-hand column of the expanded card (`#2b`). The card grid is `380px minmax(0,1fr)` at 1080px total, so the panel is about 700px wide.
- Panel padding: `22px 28px`. Content is stacked in a flex column with `gap 16–18px`.
- **Title:** Space Grotesk `18px / 700`, `#1C1B22`, in the format `"<Signal>: <verdict>"`.
- **Summary:** Figtree `14.5px`, `line-height 1.5`, `#6B6B78`, `margin-top 4px`, `text-wrap pretty`. One or two sentences.
- **Key/value rows:** grid `170px minmax(0,1fr)`, `gap 14px`, `padding 12px 0`, `border-top 1px solid #F2F0F7`. The last row also gets `border-bottom`. Label `#8A8895`, value `14px / 600 #1C1B22`. Unknown values are `#8A8895` at regular weight.
- **Footnote:** `12.5px`, `line-height 1.5`, `#8A8895`.
- **Links:** `13.5px / 600`, `#6C47FF`, hover `#4B23C9`.

### 2a. Size fit (`#3size`)
- Title: `Size fit: fits`
- Summary: `Your 14,000 sq ft sits inside the size range of Aldi's existing stores and its live requirement.`
- **Range bar.** The container is 34px tall and the scale runs 0–30k sq ft, mapped linearly to width.
  - Track: `6px` tall at `top 14px`, `#EEECF5`, radius 3.
  - Live requirement band: `6px` tall at `top 14px`, `#B9A8FF`.
  - Typical store band: `10px` tall at `top 12px`, `#6C47FF`, drawn above the requirement band.
  - Site marker: `2×26px` at `top 4px`, `#1C1B22`, centred on the value.
  - Axis labels below: `0 · 10k · 20k · 30k sq ft`, `12px #8A8895`, spread with `space-between`.
  - Legend: `12.5px #4B4A55`, `gap 18px`. The swatches are `14×6` (`#6C47FF`, `#B9A8FF`) and a `2×12` bar (`#1C1B22`). Labels: `Typical store 14–20k`, `Live requirement 10–18k`, `Your site 14,000`.
- **Rows** (third column `auto` for the date):
  - `Your site` → `14,000 sq ft GIA`
  - `Typical Aldi store` → `14–20k sq ft`
  - `Live requirement` → `10–18k sq ft` with the posted date (`3 Oct`, `13px #8A8895`)
- **Data rules:**
  - A brand has **at most one** live requirement.
  - If there's no requirement, omit its band and legend item, and show the row as `None listed with us` (muted).
  - If there's no typical size, omit its band and legend item, and show the row as `Not known` (muted).

### 2b. Size fit: no brand data (`#3sizeempty`)
This shows when neither a typical store size nor a live requirement exists.
- Title: `Size fit: not enough data`
- Summary: `We don't hold a typical store size or a live requirement for <Brand>, so we can't say whether <size> sq ft fits. This signal is left out of the score.`
- Bar: a dashed track only (`border-top 2px dashed #DEDAEC` at `top 16px`), plus the site marker. Legend shows `Your site 14,000` only.
- Rows: `Your site` → `14,000 sq ft GIA`; `Typical store` → `Not known`; `Live requirement` → `None listed with us`.
- In the breakdown and the collapsed row, this signal shows the No data state (dashed track / dash glyph).

### 2c. Use class (`#3use`)
- Title: `Use class: Class E`
- Summary: `Aldi typically trades under Class E, the same as your site.`
- Rows: `Your site` → `Class E`; `Aldi typical use class` → `Class E`.
- The only brand-side data is the brand's typical use class. There are no requirement counts, conditions or store percentages.
- Empty state is already designed in `#2bempty`: `Use class not confirmed`.

### 2d. Acquisitive (`#3acq`)
Unchanged from `#2b`. This panel is included for completeness.
- Title: `Acquisitive: high`
- Summary: `12 requirements listed with SiteMatcher and 3 news articles in the last 90 days point to an active opening programme.`
- Evidence rows: grid `110px minmax(0,1fr) 60px`. Type label (`Requirement` / `News`) in `#8A8895`, description (news items are links ending in ↗), and the date right-aligned in `#8A8895`.
- Footer link: `Show all <n> sources`.

### 2e. Demographics (`#3demo`)
**Method:** compare the **built-up area (BUA)** the site is in with the BUAs of the brand's existing stores. Each BUA is benchmarked against BUAs of a similar size. **Only show the measures where the brand's BUAs differ from the norm.** The number of measures varies by brand. Never pad the list with generic measures.

- Title: `Demographics: <strong | partial | weak>`
- Summary: `<BUA> looks like the kind of built-up area <Brand> opens in. Compared with built-up areas of a similar size, <Brand>'s stand out on <n> measures, and <BUA> matches <m> of them.` Adjust the first clause for partial or weak results.
- **Legend** (`12.5px #4B4A55`, `gap 18px`): a `10px` dot `#1C1B22` labelled `<BUA>`; a `14×6` swatch `#9C85FF` labelled `Half of <Brand>'s areas`; a `14×6` swatch `#E4DEF8` labelled `8 in 10 of <Brand>'s areas`.
- **One block per measure.** Stacked flex column, `gap 10px`, `padding 16px 0`, `border-top 1px solid #F2F0F7` (the last block also gets a bottom border).
  1. Header row (`space-between`): the measure name in `14.5px / 700`, and the verdict in `13px / 700`. Verdicts: `Matches` in `#1E8A56`; `Close` in `#1E8A56`; `Doesn't match` in `#8A5F06`.
  2. Percentile strip: `12px` tall container, 0–100 mapped to width.
     - Track: `6px` at `top 3px`, `#F4F3F9`, radius 3.
     - 10th–90th percentile band of the brand's BUAs: `#E4DEF8`.
     - 25th–75th percentile band: `#9C85FF`.
     - Site dot: `12×12`, `border 2px solid #FFFFFF`, centred on the value. Fill `#1C1B22` when it falls inside the 8-in-10 band, `#D49A12` when it falls outside.
  3. Axis labels: `12px #8A8895`, low and high ends (e.g. `Less affluent` / `More affluent`).
  4. Sentence: `13.5px #4B4A55`, `line-height 1.45`. Pattern: `<Brand>'s areas are usually <direction> than others their size. <BUA> is <direction> than <p> in 100.` For a mismatch: `… <BUA> has fewer than 9 in 10 of them.`
- Placeholder measures in the mock: Affluence (Matches), Families with children (Matches), Car ownership (Doesn't match).
- Footnote: `Each <Brand> store's built-up area is compared with built-up areas of a similar size, so this reflects the kind of place rather than its size. Only measures where <Brand>'s areas differ from the norm are shown.`
- Empty state is already designed in `#2bempty`: `Too few stores to profile` (threshold is currently 25 stores, which still needs confirming).

### 2f. Nearest store (`#3near`)
- Title: `Nearest store: <distance>`
- Summary: `Far enough from existing <Brand> stores to avoid cannibalising them. <Brand> urban stores are usually at least 2 mi apart.` Change the wording when the store is too close.
- Table: grid `minmax(0,1fr) 80px 80px`, `gap 14px`.
  - Header: `11px / 700`, `letter-spacing .04em`, `#8A8895`: `STORE`, `DISTANCE` and `DRIVE` (the last two right-aligned).
  - Rows: `12px 0` padding with a top border. Store name `600`, distance `600` right-aligned, drive time `#4B4A55` right-aligned.
  - Show the three nearest stores.
- There is **no catchment overlap column**.
- Footer link: `Show on map`.
- Empty state is already designed in `#2bempty`: `No UK stores yet`.

---

## Interactions & behaviour
- Clicking a collapsed row expands it to the full card (`#2b`). Clicking the header's `Collapse ▴` collapses it again.
- In the expanded card, clicking a breakdown row selects that signal. The row gets a highlight (`bg #F4F1FF`, `box-shadow inset 0 0 0 1.5px #D9CFFA`, label `#4B23C9` 700), and the right panel swaps to that signal's content. The default selection is the first signal that isn't "good", falling back to Acquisitive.
- Clicking the `+N more` contacts link swaps the right panel to the contacts list (`#2bcontacts`), and the breakdown dims to 55% opacity.
- **Missing signals are left out of the score**, not counted against it. The score subline then reads `Based on <n> of 5 signals`. (This rule is still waiting for product confirmation.)
- No animations are specified. A simple crossfade of under 150ms on panel swap is fine.

## State
- `expandedBrandId`: which row is open (one at a time, or several if the product prefers).
- `selectedSignal`: one of `size | useClass | acquisitive | demographics | nearest | financials | contacts`.
- Each signal needs `status` (`good | caution | poor | none`), a short value label, and its panel payload:
  - `size`: `{ siteSqFt, typicalRange?: [min,max], requirement?: { range:[min,max], postedAt } }`
  - `useClass`: `{ site, brandTypical? }`
  - `acquisitive`: `{ requirements[], news[], totalSources }`
  - `demographics`: `{ buaName, measures: [{ key, label, lowLabel, highLabel, brandDirection, p10, p25, p75, p90, siteValue, verdict }] }`
  - `nearest`: `{ stores: [{ name, distanceMi, driveMin }] }` (top 3)

## Design tokens
Fonts: **Space Grotesk** (400–700) for headings, scores and badges. **Figtree** (400–800) for UI and body text. Both are on Google Fonts.

Colours:
- Ink `#1C1B22`, `#2A2833`; secondary `#4B4A55`, `#6B6B78`; muted `#8A8895`, `#A9A6B5`, `#B7B5C2`
- Primary `#6C47FF`, deep `#4B23C9`; tints `#9C85FF`, `#B9A8FF`, `#D9CFFA`, `#E4DEF8`, `#EDE7FF`, `#F1EEFA`, `#F4F1FF`
- Lines and surfaces: `#E4E0F0` (card border), `#EEECF5`, `#F2F0F7` (row dividers), `#F4F3F9`, `#DEDAEC` (dashed), `#E1DEEC`, `#FBFAFE`; page bg `#EEECF6`
- Good `#1E8A56` on `#E3F3EA`; caution `#D49A12` (fill) / `#8A5F06` (text) on `#FDF3DC`; poor `#C0453F` (fill) / `#A33A35` (text) on `#FBE7E6`

Radii: 999 (pills), 18 (expanded card), 16 (row cards), 13 / 11 (logos), 10–11 (buttons), 3 (bars).
Shadow (expanded card): `0 16px 40px -24px rgba(76,35,201,.35)`.
Spacing used: 4, 6, 7, 8, 10, 12, 14, 16, 18, 22, 26, 28.

## Assets
None. Brand logos are placeholder initials on brand-colour tiles; use real logos in production.

## Files
- `SiteMatcher Modes.dc.html`: the design canvas (see the anchors above)
- `support.js`: runtime needed to open the design file locally (not for production)
- `screenshots/`: 2x captures, one per screen:
  - `01-collapsed-rows-3d.png`
  - `02-size-fit.png`
  - `03-size-fit-no-data.png`
  - `04-use-class.png`
  - `05-acquisitive.png`
  - `06-demographics.png`
  - `07-nearest-store.png`
  - `08-expanded-card-context.png`
  - `09-empty-states.png`
