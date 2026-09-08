# EPC floor-area matcher

Matches stores in `public.stores` to non-domestic Energy Performance Certificates
and writes the result to `public.store_floor_areas` and
`public.brand_floor_area_profiles` (migration `20260907000000`).

This is the code behind matcher run **`epc-2026.09.05-allbrands`**, which produced
the 19,111 high-confidence rows currently in the database. It is committed so the
figures can be reproduced, audited and re-run — not because it is a finished
service. There is no scheduler, no incremental refresh and no import hook yet; see
`docs/store-floor-areas-plan.md`.

---

## Licensing — read before running

EPC **address and postcode** fields are not Open Government Licence. They derive
from Ordnance Survey and Royal Mail data and are restricted to specified
energy-related purposes; other uses need an OS licence. Every other field
(`floor_area`, `property_type`, `lodgement_date`, `uprn`) is OGL.

Consequences for anyone working here:

- **Never commit register extracts, indexes, or any output containing
  `certificate_address`.** `.gitignore` in this directory blocks the known
  filenames, but it cannot know what you name a new file.
- `brand_profiles.csv` is committed because it holds aggregates only — no
  addresses.
- If the licensing position lands unfavourably, matching can fall back to UPRN and
  geometry alone, which is fully OGL. That was measured at **21% coverage**
  against 57% using address text, so it is a materially different product.

---

## The central problem

A certificate comes back for ~92% of stores. Knowing whether it describes *our*
unit rather than the shop next door is the entire difficulty. Matching on postcode
alone returns a real certificate, with a real floor area, for the wrong building
about half the time — and fails silently.

So the matcher grades evidence rather than returning a number:

| Confidence | Evidence | Fit for use |
|---|---|---|
| `high` | unit or house number agrees, or the certificate names the brand, or its UPRN is within 25 m — and no rival operator is named | yes |
| `medium` | street name only, sole candidate on that street | no — measured ~50% wrong |
| `low` | street name with rivals, or postcode-only fallback | no — ~60% wrong |
| `none` | no admissible certificate at the postcode | — |

Only `high` should reach a user. Lower tiers are stored, not discarded: they are
the input to any future improvement, and deleting them would hide the failure mode.

---

## Running it

Requires `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, plus three
external datasets (see below). Run in order from this directory:

```bash
python3 dump_all.py            # all stores + brand/fascia names          -> all_stores.csv
python3 build_config.py        # aliases, operator families, noise scores -> brand_config.json
python3 index_all_brands.py    # index both registers + resolve UPRNs     -> index_all.pkl, coords_all.pkl
python3 matchall.py            # two-pass match                           -> rows_all.pkl
python3 finalise_all.py        # size gate, validation, outputs           -> epc_all_brands.csv, brand_profiles.csv
python3 write_summary.py       # human-readable summary                   -> SUMMARY_ALL_BRANDS.md
python3 load_to_db.py          # dry run; add --apply to write
```

`index_all_brands.py` is the slow step (~15 min: it scans 1.3M certificates and
42M UPRNs). Everything else is minutes.

### External data

| Dataset | Source | Notes |
|---|---|---|
| Non-domestic EPC bulk CSV (England & Wales) | MHCLG, GOV.UK One Login | 1,321,580 certificates. Restricted — do not commit. |
| Non-domestic EPC extended historic extract (Scotland) | statistics.gov.scot, quarterly | 91,981 certificates. The register site prohibits automated access; this published extract is the sanctioned route. |
| OS Open UPRN | Ordnance Survey OpenData | 42M UPRN coordinates, OGL. |

Paths are currently hardcoded to `~/Downloads`. Parameterise before this runs
anywhere but a laptop.

---

## How it works

**`build_config.py`** derives brand aliases from data already curated in the
product: the brand name plus its fascia trading names. Two problems are solved
here rather than by hand:

- *Shared trading names.* Sixteen distinct co-operative societies all trade as
  "The Co-operative Food". Treating every other brand's alias as a rival would make
  them rivals of each other. Brands sharing a fascia name form an **operator
  family** and are never rivals within it.
- *Ambiguous aliases.* `Next`, `Cook`, `Three`, `The Range` are ordinary English
  that appears in address text. A dictionary test over-flags (Iceland, Subway and
  KFC are dictionary words but perfectly distinctive) and a frequency test
  conflates a common word with an incomplete store estate. 23 aliases are
  therefore **hand-listed**, as plain words, in `build_config.py` under `AMBIGUOUS_RAW`: they
  may corroborate a match but may not carry one alone. This is the one place
  automation was abandoned; it is deliberate and should be reviewed, not extended
  silently.

**`matchall.py`** runs two passes. Pass 1 matches against certificates of *any*
property type and keeps only those naming the brand — self-verifying anchors. The
property classes those anchors actually use are then admitted for that brand in
pass 2. This is what discovers, without being told, that Screwfix trade counters
are certificated as warehouses, Premier Inn as hotels, nine gym brands as leisure
and six self-storage brands as warehouses.

Pass 1 must see all property types or the learning is circular — it could never
find a warehouse if it only ever looked at retail.

**`finalise_all.py`** applies a size plausibility gate (a match outside 3× the
brand/fascia median from brand-named anchors is demoted) and validates against
`stores.size_band`, which is independent of the register.

### [2026-09-07] Aliases now use matchlib's normaliser

Aliases are normalised by `matchlib.norm_tokens`, the same function that normalises the
certificate text they are compared against. They previously used a local normaliser that
folded no street suffixes, so nine aliases could never match anything and four brands had
no working alias at all — Pets at Home, Dunnes Stores, Rocks Lane and Blank Street Coffee
were matching on address text alone, with no brand signal.

Two things about that fix are worth knowing before touching it again:

- **One token is trimmed from aliases beyond what matchlib removes: `GROUP`.** Without
  it, "The Co-operative Group" loses its bare `OPERATIVE` alias — 2,384 stores — to gain
  four brands totalling 56. The first version of the fix did exactly that, and it only
  surfaced because the store counts were checked afterwards.
- **`ambiguous_aliases` moved out of the generated JSON into the script.** It had only
  ever lived in `brand_config.json`, which `build_config.py` overwrites — so regenerating
  silently dropped it, and any change to normalisation silently invalidated every entry
  (`BLANK|STREET|COFFEE` became `BLANK|ST|COFFEE`). Held as words and re-normalised on
  each build, neither can happen again.

The change alters `brand_config.json` only. It reaches the data at the next full run;
the TypeScript matcher (`apps/web/src/lib/epc/aliases.ts`) already derives aliases under
the same rule.

---

## Calibrated constants, and what they rest on

| Constant | Value | Basis |
|---|---|---|
| Spatial radius | 25 m | Measured: ≤25 m is ~4% mismatch, 25–50 m ~24%, 50–100 m ~32%. Trusted matches sit a median of 8 m apart, unreliable ones 82 m. |
| Spatial margin | 25 m | The nearest candidate must be clearly nearest, or the match is declined. |
| Size gate | 3× | Anchored on brand-named certificates only. |
| Learned class threshold | ≥5 anchors and ≥20% share | |

The 25 m radius was calibrated **only on `pqi = 'Rooftop'` stores**, and
`matchall.py` refuses spatial acceptance for any other geocode quality. The store
import route writes `pqi = null`, so newly imported stores cannot be matched
spatially until geocode quality is recorded.

---

## What the numbers are, and are not

`floor_area` is **gross internal area** — the whole envelope, not the sales area a
retail agent means by "size". It runs materially larger. Showing it beside a stated
occupier requirement without saying so invites a comparison that is wrong in the
brand's favour.

Accuracy is **unproven**. Validation uses `stores.size_band`, which is a one-sided
proxy (it detects a match that is too small, not a same-size neighbour) and
measures a different thing (sales area vs GIA). On the most recent run the high
tier failed it for 40 of 3,605 testable rows, against 61% for the low tier — but
**56% of checkable rows cannot fail the test at all**, because the most common band
has a floor of zero. The tier *separation* is well evidenced; the absolute rate is
not. No precision figure from this pipeline should be published without a manually
labelled sample behind it.

Known gaps: EV charging networks (~1,440 stores) match at 0–10% because they are
not buildings; 5,813 stores have no certificate at all, since an EPC only exists
once a building is constructed, sold or let; Northern Ireland publishes no bulk
data (199 stores); the Channel Islands and Isle of Man have no register.

---

## Files

| File | |
|---|---|
| `matchlib.py` | Address normalisation and the two matching rules. Brand-agnostic. |
| `dump_all.py` | Pulls stores, brands, fascias. |
| `build_config.py` | Aliases, operator families, alias noise scores. |
| `index_all_brands.py` | Indexes both registers by store postcode; resolves UPRN coordinates. |
| `matchall.py` | The two-pass matcher. |
| `finalise_all.py` | Size gate, validation, CSV outputs, profiles. |
| `write_summary.py` | Generates the run summary. |
| `load_to_db.py` | Writes to Supabase. Dry run unless `--apply`. |
| `brand_config.json` | Generated config, committed for review. Ambiguous aliases are emitted here but authored in `build_config.py`. |
| `brand_profiles.csv` | Aggregate output of run `epc-2026.09.05-allbrands`. Aggregates only — no addresses. Superseded in the database by any later corrective migration. |
