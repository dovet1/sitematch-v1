-- Migration: epc_certificates — the EPC registers, held in the database rather than a
-- laptop, so a single newly imported store can be matched without reproducing a
-- workstation.
--
-- Why this exists
-- ---------------
-- `store_floor_areas` is populated by a Python pipeline (`scripts/epc/`) that reads
-- ~1.4M certificates from files in a Downloads folder. That is fine for a quarterly run
-- over the whole estate and useless for the case that actually matters day to day: a
-- store imported this morning, which currently gets no floor area at all until somebody
-- remembers to re-run the pipeline by hand. Once the register is a table, matching one
-- store is a postcode lookup over a few hundred rows.
--
-- The whole register is loaded, not just certificates near an existing store. Filtering
-- to store postcodes is what `index_all_brands.py` does and it is right for a full run
-- over a known estate — but newly imported stores arrive in postcodes we have never
-- held, and a filtered table returns nothing for precisely the stores this exists to
-- serve.
--
-- No address text is stored
-- -------------------------
-- The obvious design keeps a normalised address string. Two reasons this does not:
--
-- 1. LICENSING. EPC address and postcode fields are not Open Government Licence; they
--    derive from Ordnance Survey and Royal Mail data and carry use restrictions (see
--    `docs/epc-licensing-brief.md`). Holding 1.4M of them is a materially worse position
--    than holding the few thousand already in `store_floor_areas.certificate_address`.
--
-- 2. CORRECTNESS. The matcher does not consume an address as one string. `matchlib`
--    extracts four different things from it, and they disagree about what may be thrown
--    away: `corroboration()` and `house_numbers()` split on commas and care whether a
--    digit leads a component or follows UNIT/NO/BLOCK, while `norm_tokens()` strips all
--    punctuation and discards UNIT as a noise word. Storing a single normalised string
--    would serve one and break the other — and the one it breaks is the unit/number
--    distinction that separates `high` confidence from `low`.
--
-- So the loader runs the matchlib extractors once, at load time, and stores their output:
--
--   tokens         norm_tokens()    -> addr_score(), and alias detection
--   units          units()          -> compatible(), corroboration()
--   numbers        numbers()        -> compatible()
--   house_numbers  house_numbers()  -> corroboration()
--
-- Every matching rule is served, the expensive parsing happens once rather than per
-- match, and both matchers are forced through the same normalisation so they cannot
-- drift apart on it.
--
-- This is a reduction, not an elimination: a token array still describes an address and
-- is still derived data. `postcode_norm` is retained in full because it is the lookup
-- key and there is no way to index the register without it. Neither column is readable
-- outside `service_role`.
--
-- Auditing a match still works: `certificate_number` identifies the certificate in the
-- register, and `store_floor_areas.certificate_address` keeps the readable copy for the
-- handful of certificates actually matched to a store.

-- =============================================================================
-- 1. Load provenance
--
-- A load replaces its source wholesale rather than merging deltas. The register's
-- delta endpoint reports removals and UPRN changes but not new certificates, so
-- incremental refresh needs a second mechanism to be correct at all; a quarterly full
-- replace is one moving part instead of four. Cost of that choice: a load that fails
-- part-way leaves its source short, which is why `status` exists and why the admin
-- health page reads it.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.epc_load_runs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source        text        NOT NULL,
  -- Which published extract this was: file name, or the quarter for Scotland. Enough
  -- for a reader to tell "the register changed" from "we reloaded the same file".
  snapshot_ref  text        NOT NULL,
  row_count     integer,
  status        text        NOT NULL DEFAULT 'running',
  error         text,
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,

  CONSTRAINT epc_load_runs_source_valid
    CHECK (source IN ('epc_ew', 'epc_scotland')),
  CONSTRAINT epc_load_runs_status_valid
    CHECK (status IN ('running', 'complete', 'failed'))
);

COMMENT ON TABLE public.epc_load_runs IS
  'One row per attempt to load a register into epc_certificates. A source with no complete run is a source the matcher cannot speak for.';

CREATE INDEX IF NOT EXISTS idx_epc_load_runs_source_finished
  ON public.epc_load_runs (source, finished_at DESC);

-- =============================================================================
-- 2. The register
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.epc_certificates (
  -- Certificate numbers are unique only within a register, so source is part of the
  -- identity. 122 Scottish rows (0.1%) carry no reference number at all; the loader
  -- drops them, because a certificate that cannot be cited cannot be audited or
  -- reconciled against a later refresh.
  source             text    NOT NULL,
  certificate_number text    NOT NULL,
  load_run_id        uuid    NOT NULL REFERENCES public.epc_load_runs(id),

  -- Lookup key. Restricted (Royal Mail / OS derived), service_role only.
  postcode_norm      text    NOT NULL,

  -- Extracted address features. See the header: these replace address text, and each
  -- one serves a specific matchlib rule that the others cannot.
  tokens             text[]  NOT NULL DEFAULT '{}',
  units              text[]  NOT NULL DEFAULT '{}',
  numbers            text[]  NOT NULL DEFAULT '{}',
  house_numbers      text[]  NOT NULL DEFAULT '{}',

  property_type      text,
  -- Coarse class, mapped from property_type by the loader using the same rules as
  -- index_all_brands.py. Stored rather than derived so the mapping has one home.
  property_class     text,

  floor_area_m2      numeric NOT NULL,
  lodgement_date     date,

  uprn               bigint,
  -- Resolved from OS Open UPRN (OGL) at load time. Present for ~90% of E&W rows.
  -- Persisted so spatial matching can be switched on with a ST_DWithin clause rather
  -- than a reload; nothing reads it yet.
  geom               geography(Point, 4326),

  PRIMARY KEY (source, certificate_number),

  CONSTRAINT epc_certificates_source_valid
    CHECK (source IN ('epc_ew', 'epc_scotland')),
  CONSTRAINT epc_certificates_class_valid
    CHECK (property_class IS NULL OR property_class IN
           ('retail','food','warehouse','industrial','office',
            'hotel','leisure','institution','other')),
  -- A certificate with no floor area can never produce a match, so it is not loaded.
  -- Enforcing it here keeps the table honest about what it is for.
  CONSTRAINT epc_certificates_area_positive
    CHECK (floor_area_m2 > 0)
);

COMMENT ON TABLE public.epc_certificates IS
  'Non-domestic EPC certificates from the England & Wales and Scottish registers, reduced to the address features the matcher uses. No address text is stored — see the migration header for why.';
COMMENT ON COLUMN public.epc_certificates.tokens IS
  'norm_tokens() output: uppercased, suffix-normalised, noise words removed. Feeds addr_score() and brand alias detection.';
COMMENT ON COLUMN public.epc_certificates.house_numbers IS
  'house_numbers() output — digits that lead an address component or follow UNIT/NO/BLOCK. Distinct from `numbers`, which is every digit present: "Junction 1 Retail Park" carries a 1 that is part of a name, and treating it as a street number once matched a McDonald''s to a 9,672 m2 retail park.';
COMMENT ON COLUMN public.epc_certificates.geom IS
  'Certificate location from its UPRN via OS Open UPRN (OGL). Spatial matching is calibrated for pqi=Rooftop stores at 25m and, per docs/store-floor-areas-import-plan.md 4.5, Google-validated stores at 10m — it is not yet enabled here.';

-- The hot path is "every certificate at this store's postcode", so postcode leads.
-- floor_area is NOT NULL by constraint, so no partial predicate is needed.
CREATE INDEX IF NOT EXISTS idx_epc_certificates_postcode
  ON public.epc_certificates (postcode_norm);

-- For the spatial clause when it is enabled.
CREATE INDEX IF NOT EXISTS idx_epc_certificates_geom
  ON public.epc_certificates USING GIST (geom);

-- Load and audit paths walk by run.
CREATE INDEX IF NOT EXISTS idx_epc_certificates_load_run
  ON public.epc_certificates (load_run_id);

-- =============================================================================
-- 2b. Replacing a source, without a statement timeout
--
-- A reload deletes ~1.3M rows for its source. As a single statement over PostgREST that
-- is one long-running transaction against a per-role statement timeout, and if it trips
-- the load has already created its run row and cannot proceed. Deleting in bounded
-- chunks turns one statement that might time out into many that will not.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.epc_delete_source(
  p_source text,
  p_limit  integer DEFAULT 50000
) RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  WITH doomed AS (
    SELECT source, certificate_number
    FROM public.epc_certificates
    WHERE source = p_source
    LIMIT p_limit
  )
  DELETE FROM public.epc_certificates c
  USING doomed d
  WHERE c.source = d.source
    AND c.certificate_number = d.certificate_number;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

COMMENT ON FUNCTION public.epc_delete_source(text, integer) IS
  'Deletes up to p_limit certificates for one register. Callers loop until it returns 0. Chunked so a full-source replace cannot trip a statement timeout mid-load.';

REVOKE ALL ON FUNCTION public.epc_delete_source(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.epc_delete_source(text, integer) TO service_role;

-- =============================================================================
-- 3. RLS — service_role only, for the same two reasons as store_floor_areas.
--
-- Licensing: postcode and address-derived fields are OS/Royal Mail derived and
-- restricted, and must not be reachable through the anon or authenticated PostgREST
-- roles. Product: a measured national store estate is the thing being sold, and reads
-- reach users through server-side code that applies the confidence filter and the
-- measurement caveat — never by querying this table.
-- =============================================================================
ALTER TABLE public.epc_load_runs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.epc_certificates  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.epc_load_runs    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.epc_certificates FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.epc_load_runs    TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.epc_certificates TO service_role;
