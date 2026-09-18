# Contact Brands — build handoff

Mode 02 of the SiteMatcher unified app: *"Who should I call about my empty site?"*
User enters a unit's size, use class and postcode; we return brands ranked on five signals, each with its evidence and a contact.

Design source: `SiteMatcher Modes.dc.html` (option `1c` block). Repo target: `dovet1/sitematch-v1`, `apps/web/src` (see `github.md`).

## Screens

| File | Screen | State |
| --- | --- | --- |
| `01-hero.png` | Entry | Empty form + "how we rank" explainer |
| `02-matching.png` | Matching | Loading, signal-by-signal progress |
| `03-results.png` | Results | Ranked list, first card expanded (rich brand) |
| `04-sparse-brand.png` | Results | Expanded card for a brand with no acquisition evidence |

All frames are 1440px wide at the app's fixed shell width; the icon rail is 72px, content starts at x=72.

## Design tokens

Use the repo's existing tokens. The mock uses the marketing-site palette; map as follows when building in-app:

| Mock | Use in app |
| --- | --- |
| `#6C47FF` primary | `sm-violet` (`#7033FF`) |
| `#4B23C9` primary-dark text/links | violet-700 equivalent |
| `#1C1B22` ink | `sm-ink` (`#171419`) |
| `#EEECF5` / `#EAE6F5` borders | `sm-border` (`#E8E4DC`) |
| `#F4F3FA` app background | existing app canvas grey |
| Space Grotesk display | Inter (app already loads Inter + JetBrains Mono) |

Signal-pill semantics — these colours carry meaning, keep them:
- green `#177E4E` on `#EAF8F1` — criterion met / positive count
- amber `#B7860B` on `#FBF7EE` — partial or approximate fit
- red `#C0453F` on `#FDF3F3` — likely blocker (e.g. existing store 0.6 mi away)
- neutral grey `#5B6472` on `#F5F6FA` — **factual, non-judgemental** (turnover, distance). Never colour a trading fact green or red.

## The five signals

1. **Site-size fit** — brand's typical unit size vs the user's sq ft.
2. **Acquisitive signals** — blended from open requirements, news mentions and planning activity.
3. **Published trading facts** — turnover, net assets, status, filing dates from Companies House.
4. **Already trades in your type of location** — count of same-format centres nearby (the user's site is classified, e.g. edge-of-town retail park).
5. **Distance to nearest store** — closest existing branch.

### Compliance requirement (non-negotiable)

We are not permitted to characterise a company's financial standing. Therefore:

- **No covenant rating anywhere** — no "Strong", "Weak", "A1", no score, no traffic-light colour on financial data.
- The pill is labelled `TURNOVER` and shows the filed figure (`£17.9bn`), styled neutral grey.
- The evidence column is headed *"Companies House — trading facts"*, lists figures as filed, links out to the filing, and carries the disclaimer: *"Figures as filed at Companies House, unedited. SiteMatcher does not rate, score or comment on a company's financial standing — including covenant strength. Any view on that is yours to form."*
- Where a small company has not filed turnover, show `Not disclosed` plus the explanatory note that a blank means nothing is published, not that figures are poor.

Copy in the mock is legal-reviewed wording — do not paraphrase it in code.

## Multiple contacts (`03-results.png`, right column)

Brands commonly have several property contacts. Panel structure:

1. Header with a count chip (`3 on file`).
2. **Primary contact** — badged `COVERS YOUR REGION`, the contact whose territory contains the user's postcode. Card is violet-tinted with a 1.5px violet border. Shows name, role with region, email, phone.
3. **Secondary contacts** — compact rows (avatar, name, role, `Details`), ordered national → generic. A team inbox or registered-office entry is a valid row.
4. Primary CTA names the person: `Contact Rebecca Hale`.
5. Secondary action: *"Or email all three at once"* — composes to all listed addresses.

Rules:
- If no contact has a region matching the site, promote the national contact and drop the region badge.
- If >3 contacts, show primary + two, and make the count chip open a full list.
- With zero verified contacts, use the empty treatment in `04-sparse-brand.png`: dashed box, *"No named acquisitions contact"*, the note that we only list verified contacts, the switchboard and registered office, and a `Request a contact` secondary button.

## Sparse brands — show nothing rather than nothing-found (`04-sparse-brand.png`)

When we hold no requirements, news or planning activity for a brand, **do not render empty evidence rows or "No data" pills.** The card shows only what we can verify:

- Pills reduce to the facts we have: `SIZE FIT`, `USE CLASS`, `RETAIL PARKS`, `NEAREST`. Drop the `ACQUISITIVE` pill entirely (it is derived from the three missing sources).
- Band 1 states the basis of the match: *"Matched on size, use class and location. …"*
- Band 2 is the one absence we do acknowledge, because it invites a correction:
  > We could not find any evidence that {Brand} is acquiring at the moment. If you represent the brand, please contact rob@sitematcher.co.uk to update our details
- The evidence grid drops to two columns (Companies House + contacts).
- Match score renders in grey, not violet, when no acquisitive signal contributed.
- End of list gets its own card: *"That's every brand that fits your unit"* with `Alert me on new matches` and `Widen criteria`.

## Behaviour notes

- Results header: match count, criteria chips (sq ft, use class, postcode, detected centre), `Edit site`, sort dropdown (`Best match` default), `Export list`.
- One card expanded at a time; `Contact` on a collapsed card expands it and scrolls the contact panel into view.
- Matching screen runs signal-by-signal: completed signals get a green tick, the active one a spinner, pending ones stay dim. Sequence is site-size fit → acquisitive → trading facts → same location type → nearest store.
- Ranking must stay explainable: every score has to be attributable to the five pills shown on the card.
- Score arc: violet `conic-gradient` at the percentage; grey when the brand has no acquisitive evidence.

## Open questions for the team

- Small-company "not filed" wording needs a legal check.
- `Request a contact` destination — form, or a mail to rob@?
- Whether "email all three" should be gated behind a subscription tier.
