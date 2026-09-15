# A brand-centric data model: sketch

Status: **sketch, nothing built.** Written 11 September 2026 in response to Codex's
brand-centric blueprint. This records the table shapes that blueprint implies for our
schema, what is already built, what would have to change, and what is deliberately left
alone. It is not a delivery plan and nothing here is scheduled.

## The rule, and its guard

> A brand is the commercial hub, but not the parent of every record. Brand relationships
> are evidence-based links that can be uncertain, reviewed and time-bound.

The guard matters as much as the rule. Candidate sites, retail centres, built-up areas,
LSOAs and the majority of planning applications have no brand and never will. A model
that makes the brand the parent turns the map into a subset of our brand coverage. Every
link table below therefore has a nullable `brand_id`, and every geographic record stays
readable and mappable with no brand attached.

## What already exists

The rule is not new here. `development_brand_signals`, from
`20260915000000_create_plota_development_intelligence.sql`, is already exactly this shape:
a nullable brand link, the name as observed, a role, an evidence source and excerpt, a
confidence, a review state, and first and latest observed timestamps. The development
stands on its own geography whether or not a brand is ever attached. This sketch mostly
generalises that one table's contract.

The identity resolver also half-exists, in `apps/web/src/lib/epc/aliases.ts`. It derives
an alias set per brand from the brand name plus its fascia trading names, builds an owner
map from alias phrase to every brand claiming it, and carries a curated list of aliases
too ambiguous to carry a match alone. The EPC matcher and the planning eligibility gate
both use it. What it lacks is storage: nothing is written down, so nothing can be
corrected, audited, or queued for review.

Today's `brands` row is thin. It holds a name, a bare `domain` for logo lookup, a
`logo_url`, a `website_url`, a `store_locator_url`, and three admin overrides for the
latest store. There is no alias, no external identifier, no status, and no provenance.
`fascias` holds a name, a `brand_id` and a `definition`.

The store importer resolves a brand with a case-insensitive name match and creates one on
a miss. A near-miss in a CSV silently forks the brand, and the estate, the floor-area
profile, the monthly snapshots, the directory card and any alert subscription fork with
it. This is the single most damaging gap in the current model, and the cheapest to close.

## Layer 1 — Brand identity

The point of this layer is that every pipeline asks the same question of the same service,
and that a wrong answer can be corrected once rather than in five places.

```sql
-- Aliases become data rather than a runtime derivation. The derived set (brand name +
-- fascia trading names) is still the default and is regenerated on every brand or fascia
-- change; admin-entered aliases and observed misspellings sit alongside it.
CREATE TABLE public.brand_aliases (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id           uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  -- A fascia-level alias resolves to the format, not just the owner. See "Grain" below.
  fascia_id          uuid REFERENCES public.fascias(id) ON DELETE CASCADE,

  alias              text NOT NULL,   -- as written, for display and audit
  alias_key          text NOT NULL,   -- normalised pipe-joined tokens: normAlias() output

  kind               text NOT NULL CHECK (kind IN (
                       'brand_name','fascia_name','legal_name','trading_as',
                       'abbreviation','misspelling','manual')),
  source             text NOT NULL CHECK (source IN (
                       'derived','admin','store_import','epc','planning','companies_house')),

  -- An ambiguous alias may corroborate a match but may never carry one alone. Today this
  -- is a hand-curated Set in aliases.ts; here it is a column, still curated, now visible
  -- to the review UI and to whoever has to explain a bad match.
  is_ambiguous       boolean NOT NULL DEFAULT false,
  may_carry_match    boolean NOT NULL DEFAULT true,

  -- alias_key is only comparable to text normalised by the SAME function version. The
  -- 2026-09-07 normalisation change silently killed nine aliases and stranded four brands
  -- with none. A version column plus a health check that counts stale rows makes the next
  -- such change loud instead of silent. Mirrors matcher_version on store_floor_areas.
  normaliser_version text NOT NULL,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, alias_key)
);
CREATE INDEX brand_aliases_key_idx ON public.brand_aliases (alias_key);
CREATE INDEX brand_aliases_stale_idx ON public.brand_aliases (normaliser_version);
```

```sql
-- External identifiers. The only unambiguous joins we will ever get.
CREATE TABLE public.brand_identifiers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id      uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  scheme        text NOT NULL CHECK (scheme IN (
                  'companies_house','domain','wikidata','os_open_names',
                  'plota_applicant','google_place','internal_legacy')),
  value         text NOT NULL,
  value_key     text GENERATED ALWAYS AS (lower(btrim(value))) STORED,

  is_primary    boolean NOT NULL DEFAULT false,
  evidence_url  text,
  review_state  text NOT NULL DEFAULT 'pending'
                CHECK (review_state IN ('pending','approved','corrected','rejected')),
  valid_from    date,
  valid_to      date,           -- a domain or a company number can change hands
  created_at    timestamptz NOT NULL DEFAULT now()
);
-- Current identifiers are unique within a scheme; retired ones are kept for history.
CREATE UNIQUE INDEX brand_identifiers_current_uq
  ON public.brand_identifiers (scheme, value_key) WHERE valid_to IS NULL;
```

```sql
-- Every name we have seen and not yet resolved, with how often and from where. This is
-- the queue that replaces "create a brand on a name miss". The importer stops inventing
-- brands; it parks the name here and an admin decides.
CREATE TABLE public.brand_name_observations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observed_name     text NOT NULL,
  observed_key      text NOT NULL,
  context           text NOT NULL CHECK (context IN (
                      'store_import','epc_certificate','planning_application',
                      'requirement','companies_house','news','manual')),
  source_record_id  text,         -- the provenance row that produced it, see Layer 3

  first_seen_at     timestamptz NOT NULL DEFAULT now(),
  last_seen_at      timestamptz NOT NULL DEFAULT now(),
  occurrence_count  integer NOT NULL DEFAULT 1,

  -- A pg_trgm similarity against existing aliases. A measured number from a deterministic
  -- function, not a model's self-report, so it can legitimately be thresholded.
  suggested_brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  suggestion_score   numeric CHECK (suggestion_score IS NULL
                       OR (suggestion_score >= 0 AND suggestion_score <= 1)),

  state             text NOT NULL DEFAULT 'pending'
                    CHECK (state IN ('pending','linked','new_brand','ambiguous','rejected')),
  resolved_brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  resolved_by       uuid REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at       timestamptz,
  UNIQUE (observed_key, context)
);
```

```sql
-- Merging duplicates. brand_id is cascade-referenced by stores, requirements, contacts,
-- snapshots, floor-area profiles and alert subscriptions, so a hard delete of the losing
-- brand destroys an estate. Repoint the children, then tombstone the row: any brand_id
-- already sitting in a saved search or a bookmarked URL still resolves.
ALTER TABLE public.brands
  ADD COLUMN canonical_name_key text,
  ADD COLUMN status text NOT NULL DEFAULT 'active'
      CHECK (status IN ('active','dormant','superseded')),
  ADD COLUMN superseded_by uuid REFERENCES public.brands(id) ON DELETE SET NULL;

CREATE TABLE public.brand_merges (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merged_brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE RESTRICT,
  surviving_brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE RESTRICT,
  reason             text,
  moved_row_counts   jsonb NOT NULL DEFAULT '{}'::jsonb,  -- {stores: 214, requirements: 1}
  merged_by          uuid REFERENCES public.users(id) ON DELETE SET NULL,
  merged_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (merged_brand_id <> surviving_brand_id)
);
```

One resolution function, used by the store importer, the EPC matcher, the planning
eligibility gate and any future feed:

```
resolve_brand(observed_name, context, hints) ->
  { brand_id, fascia_id, basis, matched_alias_id, ambiguous_candidates[] } | unresolved
```

`basis` is one of `identifier`, `exact_alias`, `fuzzy_alias`, `unresolved`. It is recorded
on the resulting link so any match can be explained after the fact.

## Layer 2 — Brand relationships

Codex implies one generic edge. Two shapes are possible and the choice matters.

**Option A, one polymorphic `brand_links` table** with `subject_type` and `subject_id`.
One review queue, one confidence discipline, one RPC. It gives up referential integrity,
which this schema uses heavily, and it makes row-level security awkward because the
subject's own policy cannot be reached through the edge.

**Option B, per-domain link tables sharing a written column contract**, plus a view that
unions them for review. Keeps foreign keys and cascade behaviour. Costs some repetition.

**Recommendation: Option B.** `development_brand_signals` already is one of these tables
and would not have to move. The contract every brand link implements:

```sql
-- Contract (illustrated on a new store-level link; the same columns appear on the
-- existing development_brand_signals and on any future article or company link).
CREATE TABLE public.store_brand_links (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,

  brand_id          uuid REFERENCES public.brands(id) ON DELETE SET NULL,  -- nullable
  fascia_id         uuid REFERENCES public.fascias(id) ON DELETE SET NULL,
  observed_name     text NOT NULL,        -- what the source actually said
  role              text NOT NULL,        -- domain-specific CHECK list

  evidence_source   text NOT NULL,
  evidence_excerpt  text,
  evidence_url      text,

  -- Two fields, not one. The band is what anything may branch on. The raw score is kept
  -- for analysis and is explicitly NOT a threshold: an LLM self-reported confidence is
  -- not calibrated, and we have measured one model flipping a third of its answers
  -- between identical runs. Where the score comes from a deterministic function, say so
  -- in match_basis and the band can be derived from it.
  confidence_band   text NOT NULL DEFAULT 'low'
                    CHECK (confidence_band IN ('high','medium','low')),
  raw_score         numeric CHECK (raw_score IS NULL OR (raw_score >= 0 AND raw_score <= 1)),
  match_basis       text CHECK (match_basis IN (
                      'identifier','exact_alias','fuzzy_alias','model','manual')),

  review_state      text NOT NULL DEFAULT 'pending'
                    CHECK (review_state IN ('pending','approved','corrected','rejected')),
  reviewed_by       uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at       timestamptz,

  first_observed_at timestamptz NOT NULL DEFAULT now(),
  latest_observed_at timestamptz NOT NULL DEFAULT now(),
  valid_from        date,
  valid_to          date,
  retirement_reason text
);
```

```sql
-- One queue over every domain, so review is a single surface rather than one per feed.
CREATE VIEW public.brand_link_review_queue AS
  SELECT 'development' AS subject_type, development_id AS subject_id, id, brand_id,
         observed_name, role, confidence_band, review_state, latest_observed_at
  FROM public.development_brand_signals
  UNION ALL
  SELECT 'store', store_id, id, brand_id, observed_name, role,
         confidence_band, review_state, latest_observed_at
  FROM public.store_brand_links;
```

Validity dates are on the contract but are only meaningful on some edges. They earn their
place on fascia ownership, on contact roles and on the brand-to-company link, because all
three genuinely change hands and a stale one is what a customer complains about. They do
not belong on spatial membership, which is derived and recomputable from a boundary
vintage.

### Fascia ownership over time

The one existing relationship that needs time-bounding today. `fascias.brand_id` is a
plain column, so an acquisition rewrites history.

```sql
CREATE TABLE public.fascia_ownership (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fascia_id   uuid NOT NULL REFERENCES public.fascias(id) ON DELETE CASCADE,
  brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  valid_from  date NOT NULL,
  valid_to    date,
  evidence_url text,
  CHECK (valid_to IS NULL OR valid_to > valid_from),
  EXCLUDE USING gist (fascia_id WITH =, daterange(valid_from, valid_to) WITH &&)
);
```

### Legal companies, sketched but deferred

The launch plan commits to publishing Companies House *indicators* and never a covenant
score. The shape, for when it is wanted:

```sql
CREATE TABLE public.companies (
  company_number text PRIMARY KEY,
  name           text NOT NULL,
  status         text,
  incorporated_on date,
  dissolved_on   date,
  registered_address jsonb,
  snapshot_run_id uuid REFERENCES public.import_runs(id),
  last_seen_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.brand_companies (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id       uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  company_number text NOT NULL REFERENCES public.companies(company_number),
  role           text NOT NULL CHECK (role IN ('owner','operator','franchisee','holding')),
  -- plus the full evidence contract above
  valid_from     date, valid_to date,
  UNIQUE (brand_id, company_number, role, valid_from)
);
```

## Layer 3 — Provenance

Candidate sites carry `source`, `source_reference` and a provenance blob. Retail centres
carry a source version and vintage. Stores, brands and fascias carry nothing, and
`store_import_logs` records the import without linking to the rows it created. No store
can answer where it came from.

```sql
CREATE TABLE public.import_runs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline            text NOT NULL,   -- 'store_csv','epc_bulk','plota_sync','traffic',...
  source              text NOT NULL,
  source_url          text,
  source_published_at timestamptz,
  dataset_vintage     text,            -- 'LSOA 2021', 'GeoDS v4.0', 'EPC 2026-08'
  licence             text,
  payload_checksum    text,
  started_at          timestamptz NOT NULL DEFAULT now(),
  finished_at         timestamptz,
  status              text NOT NULL DEFAULT 'running'
                      CHECK (status IN ('running','succeeded','failed','partial')),
  row_counts          jsonb NOT NULL DEFAULT '{}'::jsonb,
  triggered_by        uuid REFERENCES public.users(id) ON DELETE SET NULL
);

-- Rows that failed the quality gate, kept rather than dropped, so a failed import is a
-- work queue instead of a line in a log.
CREATE TABLE public.import_quarantine (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_run_id uuid NOT NULL REFERENCES public.import_runs(id) ON DELETE CASCADE,
  row_number    integer,
  payload       jsonb NOT NULL,
  issues        jsonb NOT NULL,
  state         text NOT NULL DEFAULT 'pending'
                CHECK (state IN ('pending','corrected','rejected')),
  resolved_by   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at   timestamptz
);
```

Added to every ingested entity table, starting with stores:

Stores also have no `updated_at`. The admin edit route writes the changed fields and
nothing else, so an edited row is indistinguishable from an untouched one. The column
belongs in the same change.

```sql
ALTER TABLE public.stores
  ADD COLUMN updated_at       timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN import_run_id    uuid REFERENCES public.import_runs(id) ON DELETE SET NULL,
  ADD COLUMN source           text,
  ADD COLUMN source_record_id text,
  -- Retire, never delete. A store missing from this month's locator feed is a suspected
  -- closure worth showing, not an absence. Deleting it also destroys the snapshot history
  -- that makes "is this brand opening or closing?" answerable.
  ADD COLUMN retired_at       timestamptz,
  ADD COLUMN retirement_reason text;
```

Note that retiring rather than deleting changes every existing store count. Each one would
need a `retired_at IS NULL` predicate, including the summary rebuild functions and the
directory card aggregates. That is the expensive part of this layer, not the columns.

## Layer 4 — Targeted recalculation

`cache_rebuild_queue` carries a reason and no subject, and a partial unique index allows
exactly one pending row, so every store edit enqueues one global rebuild under an advisory
lock. Per-brand and per-area recalculation needs the queue to name what changed.

```sql
ALTER TABLE public.cache_rebuild_queue
  ADD COLUMN subject_type text CHECK (subject_type IN ('brand','bua','retail_centre','global')),
  ADD COLUMN subject_id   uuid;

-- HAZARD: idx_cache_rebuild_queue_unique_pending is currently UNIQUE on
-- ((processed_at IS NULL)) WHERE processed_at IS NULL, which permits one pending row in
-- the entire table. It must be replaced, or every subject-scoped enqueue after the first
-- is silently swallowed by ON CONFLICT DO NOTHING.
DROP INDEX idx_cache_rebuild_queue_unique_pending;
CREATE UNIQUE INDEX cache_rebuild_queue_unique_pending
  ON public.cache_rebuild_queue (subject_type, coalesce(subject_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE processed_at IS NULL;
```

And the thing that makes a brand page honest:

```sql
-- Per brand, when each contributing fact was last refreshed. The brand profile can then
-- date every claim it makes instead of presenting a 2024 estate beside a live requirement.
CREATE VIEW public.brand_freshness AS
  SELECT b.id AS brand_id,
         -- created_at, not updated_at: stores has no updated_at column and the admin edit
         -- route writes no audit field, so "when did this store row last change?" is
         -- currently unanswerable. Layer 3 is what fixes that.
         (SELECT max(s.created_at) FROM stores s WHERE s.brand_id = b.id) AS estate_loaded_at,
         (SELECT max(p.generated_at) FROM brand_floor_area_profiles p WHERE p.brand_id = b.id) AS floor_area_generated_at,
         (SELECT max(r.verified_at) FROM requirements r WHERE r.brand_id = b.id) AS requirement_verified_at,
         (SELECT max(l.latest_observed_at) FROM development_brand_signals l
           WHERE l.brand_id = b.id AND l.review_state = 'approved') AS planning_signal_at
  FROM public.brands b;
```

## Grain: brand or fascia?

Codex's blueprint assumes the brand is the unit. Our own data says it is sometimes the
fascia. `brand_floor_area_profiles` is keyed on brand and fascia together precisely
because a full-line M&S measured 6,882 m2 against 1,455 for Simply Food, and a single
brand median is wrong for both. The estate and the requirement are brand-level; size and
format are fascia-level.

The sketch handles this by carrying a nullable `fascia_id` alongside `brand_id` on aliases
and on every link. A source that names a format resolves to the format. A source that
names the owner resolves to the owner. Nothing is forced to pick.

## What deliberately does not change

- **Requirements stay curated and stay separate.** `requirements.company_name` remains,
  because a requirement can exist before the brand does. The nullable `brand_id` is the
  join, and the resolution queue is what eventually fills it.
- **Developments stay geographic-first.** No brand is required for a development to appear
  on the map or in area analysis.
- **`development_brand_signals` is not rewritten.** It already implements the contract. It
  gains `confidence_band` and `match_basis`, nothing more.
- **Candidate sites, retail centres, boundaries, census and traffic keep their own shape.**
  They have no brand and need none.
- **Contact consolidation is not in this sketch.** Collapsing `brand_contacts`,
  `requirement_contacts`, `directory_agents` and the legacy agency tables into person,
  organisation and time-bounded role is the right end state, but it is a refactor of live
  curated data with a public read policy, and the launch plan defers deep refactors.
- **News ingestion is not in this sketch.** Deferred by the launch plan.

## Open questions

1. Does the importer stop creating brands entirely, or keep creating them behind a flag?
   Stopping is correct and will block imports on the day it ships unless the queue is
   staffed.
2. Who reviews the queues? Every layer here assumes an admin review surface exists. One
   partially does for planning. Nothing decides who works it.
3. Is `confidence_band` derived from `raw_score` per pipeline, or set independently? A
   derivation needs a calibration nobody has measured yet.
4. Does retiring stores rather than deleting them change any published figure? Store counts
   appear in the directory, the gap caches and the snapshots, and they must all move together.

## If this were sequenced

1. **Brand identity only.** Aliases, identifiers, the observation queue, one resolution
   function, the tombstone columns. Additive, touches no curated data, and removes the
   silent brand fork.
2. **Provenance envelope on stores.** Import runs, quarantine, the source columns. Retirement
   comes after, as its own change, because of the count predicates.
3. **The link contract.** `confidence_band` and `match_basis` onto the existing planning
   signals, the review queue view, then a second link domain when one is actually needed.
4. **Subject-scoped recalculation.** Only worth doing once something enqueues per brand.
5. **Companies, then contacts.** Both after the launch push.
