-- Migration: store_floor_areas — floor areas matched to stores from the EPC registers.
--
-- Why this exists
-- ---------------
-- Nothing in the product carries a numeric store size. `stores.size_band` is a coarse
-- text band and is null on 58% of rows, and `requirements.size_seen_sqft` is typed in by
-- hand because, as the code comment there says, "stores has no numeric sq ft ... there is
-- nothing to derive it from". The non-domestic EPC registers publish a gross internal
-- floor area for most commercial premises in Great Britain. This table is where a store
-- is joined to the certificate that measures it.
--
-- The hard part is not finding a certificate — one comes back for ~92% of stores. It is
-- knowing whether it describes *our* unit or the shop next door. Matching on postcode
-- alone returns a real certificate, with a real floor area, for the wrong building about
-- half the time, and fails silently. Every column below exists to let a reader decide
-- whether to believe a row, rather than trusting the number on its own.
--
-- What "confidence" means
-- ----------------------
--   high    the certificate agrees on unit or house number, or names the brand, and no
--           rival operator is named on it; or its UPRN sits within 25m of the store
--   medium  street name matched and it was the only retail candidate on that street
--   low     a certificate was found but the evidence does not identify the premises
--   none    no admissible certificate at the postcode
--
-- Only `high` should reach a user. In assessment, `low` rows were the wrong premises
-- roughly half the time. They are stored rather than discarded because they are the
-- input to any future improvement, and because deleting them would hide the failure mode.
--
-- What the numbers are NOT
-- ------------------------
-- EPC floor_area is GROSS INTERNAL AREA: the whole envelope, not the sales area a retail
-- agent means by "size". It runs materially larger. Anything that displays this next to a
-- stated occupier requirement must say which measurement it is showing, or it will invite
-- a comparison that is wrong in the brand's favour.
--
-- Accuracy is also unproven. The assessment measured a ~3% "proxy-detected mismatch rate"
-- for high-confidence rows, using size_band as an independent check. That proxy is
-- one-sided — it detects a match that is too small, not a same-size neighbour — so true
-- error is higher and currently unquantified. `confidence` is an ordering, not a
-- probability. No figure derived from this table should be published as a precision
-- claim until a manually labelled sample exists.
--
-- Licensing
-- ---------
-- EPC address and postcode fields are not Open Government Licence: they derive from
-- Ordnance Survey and Royal Mail data and carry use restrictions. Every field in this
-- table other than `certificate_address` is OGL. `certificate_address` is retained only
-- so a human can audit a match, is service_role-only like the rest of the table, and
-- should be dropped if the licensing position requires it — nothing computes from it.

-- =============================================================================
-- 1. Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.store_floor_areas (
  store_id              uuid        PRIMARY KEY
                                    REFERENCES public.stores(id) ON DELETE CASCADE,

  -- The measurement.
  floor_area_m2         numeric,
  floor_area_sqft       numeric     GENERATED ALWAYS AS (round(floor_area_m2 * 10.7639, 0)) STORED,
  measurement_basis     text        NOT NULL DEFAULT 'gross_internal_area',

  -- Which certificate it came from. Certificate numbers are only unique within a
  -- register, so `source` is part of the identity. No FK: certificates are withdrawn
  -- from the register over time and a match should not vanish when that happens.
  source                text,
  certificate_number    text,
  certificate_date      date,
  certificate_address   text,
  property_type         text,
  property_class        text,
  uprn                  bigint,

  -- How the match was made, and what stands behind it.
  confidence            text        NOT NULL,
  match_method          text        NOT NULL,
  address_corroboration text,
  brand_on_certificate  boolean,
  foreign_operator      text,
  spatial_distance_m    numeric,
  size_plausibility     text,
  candidate_count       integer,
  certs_at_address      integer,

  -- Provenance. matcher_version is what makes a rerun explicable: the matcher changed
  -- four times during assessment and each change moved rows between tiers. Without it,
  -- a changed row is indistinguishable from a changed register.
  matcher_version       text        NOT NULL,
  computed_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT store_floor_areas_confidence_valid
    CHECK (confidence IN ('high', 'medium', 'low', 'none')),
  CONSTRAINT store_floor_areas_method_valid
    CHECK (match_method IN ('address', 'brand', 'spatial',
                            'postcode-single', 'postcode-ambiguous', 'none')),
  CONSTRAINT store_floor_areas_source_valid
    CHECK (source IS NULL OR source IN ('epc_ew', 'epc_scotland')),
  CONSTRAINT store_floor_areas_corroboration_valid
    CHECK (address_corroboration IS NULL
       OR address_corroboration IN ('unit', 'number', 'spatial', 'street-name-only')),
  CONSTRAINT store_floor_areas_area_positive
    CHECK (floor_area_m2 IS NULL OR floor_area_m2 > 0),
  -- A row that claims a measurement must say where it came from.
  CONSTRAINT store_floor_areas_measured_rows_cite_a_certificate
    CHECK (floor_area_m2 IS NULL
       OR (certificate_number IS NOT NULL AND source IS NOT NULL)),
  -- 'none' means no certificate was found, so it cannot carry one.
  CONSTRAINT store_floor_areas_none_has_no_certificate
    CHECK (match_method <> 'none' OR certificate_number IS NULL)
);

COMMENT ON TABLE public.store_floor_areas IS
  'Floor areas matched to stores from the EPC registers, one row per store. Only confidence=''high'' is fit to show a user; ''low'' rows were the wrong premises ~50% of the time in assessment and are kept as evidence, not as data.';
COMMENT ON COLUMN public.store_floor_areas.floor_area_m2 IS
  'Gross internal area from the certificate — the whole envelope, not sales area. Larger than the figure a retail agent means by "size".';
COMMENT ON COLUMN public.store_floor_areas.floor_area_sqft IS
  'Generated, never written by hand. The one place m2 to sq ft conversion happens, because doing it in application code is how a 10.76x error ships.';
COMMENT ON COLUMN public.store_floor_areas.confidence IS
  'high|medium|low|none. An ordering of evidence strength, not a probability. See the migration header for what each tier required.';
COMMENT ON COLUMN public.store_floor_areas.brand_on_certificate IS
  'The certificate names our brand. The single strongest signal — but it evidences that the brand was there when the certificate was lodged, not that it is there now.';
COMMENT ON COLUMN public.store_floor_areas.foreign_operator IS
  'A different retailer named on the certificate. Usually means the certificate covers the host building and our unit is a concession inside it.';
COMMENT ON COLUMN public.store_floor_areas.spatial_distance_m IS
  'Metres between the store coordinate and the certificate UPRN. Calibrated on rooftop-quality geocodes only: <=25m measured ~4% mismatch, 25-50m ~24%.';
COMMENT ON COLUMN public.store_floor_areas.size_plausibility IS
  'Whether the area is credible for the brand/fascia format. Certificates can agree on address and still describe the host building.';
COMMENT ON COLUMN public.store_floor_areas.certificate_address IS
  'Audit trail only — nothing computes from it. EPC address fields carry Ordnance Survey and Royal Mail restrictions; drop this column if the licensing position requires it.';
COMMENT ON COLUMN public.store_floor_areas.matcher_version IS
  'Which matcher produced the row. Distinguishes "the register changed" from "we changed how we read it" on rerun.';

-- Reads are "give me the trustworthy areas for these stores", so confidence leads.
CREATE INDEX IF NOT EXISTS idx_store_floor_areas_confidence
  ON public.store_floor_areas (confidence) WHERE floor_area_m2 IS NOT NULL;

-- Rerun and audit paths walk by matcher version.
CREATE INDEX IF NOT EXISTS idx_store_floor_areas_matcher_version
  ON public.store_floor_areas (matcher_version);

-- =============================================================================
-- 2. RLS — service_role only, for two reasons.
--
-- First, licensing: the EPC address fields are OS/Royal Mail derived and restricted, and
-- this table must not be readable through the anon or authenticated PostgREST roles while
-- that position is unresolved.
--
-- Second, the same reason as brand_store_snapshots: a measured national store estate is
-- the product. Reads reach users through server-side code that can apply the confidence
-- filter and the measurement caveat, never by querying this table directly.
-- =============================================================================
ALTER TABLE public.store_floor_areas ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.store_floor_areas FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_floor_areas TO service_role;

-- =============================================================================
-- 3. brand_floor_area_profiles — the aggregate the product actually shows.
--
-- Kept separate from requirements on purpose. `requirements` records what an occupier
-- SAYS IT WANTS; this records what its estate MEASURES. Writing the second into the
-- first would destroy curated data and conflate two different claims that the brand
-- profile UI already renders side by side.
--
-- Grain is (brand_id, fascia_id) with a NULL fascia meaning brand-level, because size is
-- a property of the format, not the brand: a full-line M&S measured 6,882 m2 against
-- 1,455 for Simply Food. A single brand median is wrong for both.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.brand_floor_area_profiles (
  brand_id          uuid        NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  fascia_id         uuid        REFERENCES public.fascias(id) ON DELETE CASCADE,

  p25_m2            numeric     NOT NULL,
  median_m2         numeric     NOT NULL,
  p75_m2            numeric     NOT NULL,
  min_m2            numeric     NOT NULL,
  max_m2            numeric     NOT NULL,
  sample_count      integer     NOT NULL,
  coefficient_of_variation numeric,

  measurement_basis text        NOT NULL DEFAULT 'gross_internal_area',
  matcher_version   text        NOT NULL,
  generated_at      timestamptz NOT NULL DEFAULT now(),

  -- A NULL fascia_id is a real, distinct row (the brand-level profile), and NULLs are
  -- not comparable in a primary key, so uniqueness is enforced on a normalised key.
  fascia_key        uuid        GENERATED ALWAYS AS
                                (coalesce(fascia_id, '00000000-0000-0000-0000-000000000000'::uuid)) STORED,
  PRIMARY KEY (brand_id, fascia_key),

  CONSTRAINT brand_floor_area_profiles_quartiles_ordered
    CHECK (min_m2 <= p25_m2 AND p25_m2 <= median_m2
       AND median_m2 <= p75_m2 AND p75_m2 <= max_m2),
  -- Below this a median is an anecdote. The UI should have nothing to render rather
  -- than a confident-looking figure drawn from three stores.
  CONSTRAINT brand_floor_area_profiles_min_sample
    CHECK (sample_count >= 5)
);

COMMENT ON TABLE public.brand_floor_area_profiles IS
  'Observed floor-area distribution per brand and fascia, from confidence=''high'' matches only. Describes the estate as measured; it is NOT an occupier requirement and must not be written into requirements.size_seen_sqft.';
COMMENT ON COLUMN public.brand_floor_area_profiles.fascia_id IS
  'NULL means the brand-level profile. Multi-format brands must be read at fascia level: a full-line M&S is ~5x a Simply Food.';
COMMENT ON COLUMN public.brand_floor_area_profiles.coefficient_of_variation IS
  'Spread relative to mean. Above ~0.6 the median is a poor summary and usually signals mixed formats or contaminated matches rather than genuine variation.';
COMMENT ON COLUMN public.brand_floor_area_profiles.sample_count IS
  'High-confidence stores behind the figures. Constrained to >= 5; display should show it so a reader can weigh the number.';

ALTER TABLE public.brand_floor_area_profiles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.brand_floor_area_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_floor_area_profiles TO service_role;
