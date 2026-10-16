-- Brand Matcher demographic fit, phase 1 (data only — nothing in the product reads this yet).
--
-- The question: does the town a site sits in look like the towns a brand already trades in?
-- "Town" is the ONS built-up area (BUA). A brand's demographic profile is the spread of each
-- BUA demographic signal across the BUAs its stores are in; the site is placed in its own BUA
-- and compared against that spread. Comparing a town with towns keeps both sides measured the
-- same way (a catchment around the site would need catchments around every store too).
--
-- Four pieces:
--   1. brand_matcher_bua_signals  — one row per (BUA, signal): the existing demographic index
--      scores plus BUA population, which is read as a signal of its own because town size is
--      likely the biggest single difference between brands.
--   2. brand_bua_presence()       — which BUAs each brand/fascia has a store in. The one
--      definition of presence, read by the rebuild and by the backtest script.
--   3. brand_demographic_profiles + rebuild_brand_demographic_profiles()
--   4. brand_matcher_site_bua()   — places a site in a BUA and returns its signals.
--
-- Profiles are BUA-weighted: each town counts once however many stores the brand has in it, so
-- a brand's London estate does not drown out the rest of its towns. bua_store_presence is not
-- reused: it carries one row per fascia *category*, and only for fascias that have a category.
--
-- Scotland and Northern Ireland have no BUA demographic signals (the source is the England and
-- Wales census), so stores there do not contribute and sites there get no profile comparison.
-- That is a gap, not a "poor fit", and the scoring must treat it as one.

-- ---------------------------------------------------------------------------
-- 1. brand_matcher_bua_signals
-- ---------------------------------------------------------------------------
--    England and Wales towns only (E/W codes). A Scottish town on the border can overlap a sliver
--    of an English census area and so receive "demographics" that describe only that sliver.
CREATE OR REPLACE VIEW public.brand_matcher_bua_signals
WITH (security_invoker = true) AS
  SELECT s.bua_gsscode,
         s.signal_name,
         m.signal_category,
         s.index_score::double precision AS value
  FROM public.bua_demographic_signals s
  JOIN public.demographic_signal_mappings m ON m.signal_name = s.signal_name
  WHERE s.index_score IS NOT NULL
    AND left(s.bua_gsscode, 1) IN ('E', 'W')
  UNION ALL
  -- Population only for BUAs that also carry demographics, so every signal is measured over
  -- the same set of towns.
  SELECT b.gsscode, 'population', 'population', b.pop_final::double precision
  FROM public.built_up_areas b
  WHERE b.pop_final IS NOT NULL
    AND left(b.gsscode, 1) IN ('E', 'W')
    AND EXISTS (
      SELECT 1 FROM public.bua_demographic_signals s
      WHERE s.bua_gsscode = b.gsscode AND s.index_score IS NOT NULL
    );

REVOKE ALL ON public.brand_matcher_bua_signals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.brand_matcher_bua_signals TO service_role;

COMMENT ON VIEW public.brand_matcher_bua_signals IS
  'Brand Matcher: demographic index scores per BUA (100 = national average) plus BUA population as the "population" signal.';

-- ---------------------------------------------------------------------------
-- 2. brand_bua_presence
--    One row per (brand, fascia, BUA) with a located store inside the BUA polygon. fascia_id is
--    NULL for stores with no fascia; those still count towards the brand-level profile.
--    Stores outside every BUA (many retail parks sit just beyond a boundary) are not counted.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.brand_bua_presence()
RETURNS TABLE (brand_id uuid, fascia_id uuid, bua_gsscode text, store_count bigint)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT s.brand_id, s.fascia_id, g.gsscode, count(*)
  FROM public.stores s
  JOIN public.built_up_area_geometries g ON ST_Covers(g.geom, s.location::geometry)
  WHERE s.brand_id IS NOT NULL
    AND s.location IS NOT NULL
  GROUP BY s.brand_id, s.fascia_id, g.gsscode;
$$;

REVOKE EXECUTE ON FUNCTION public.brand_bua_presence() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.brand_bua_presence() TO service_role;

-- ---------------------------------------------------------------------------
-- 3. brand_demographic_profiles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.brand_demographic_profiles (
  brand_id        uuid        NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  -- NULL = the brand-level profile across all its fascias (same convention as
  -- brand_floor_area_profiles).
  fascia_id       uuid        REFERENCES public.fascias(id) ON DELETE CASCADE,
  signal_name     text        NOT NULL,
  signal_category text        NOT NULL,

  -- Towns with a value for this signal, and the stores in them.
  bua_count       integer     NOT NULL,
  store_count     integer     NOT NULL,

  -- The spread of the signal across those towns, in the signal's own units (index score, or
  -- people for population).
  p10             double precision NOT NULL,
  p25             double precision NOT NULL,
  median          double precision NOT NULL,
  p75             double precision NOT NULL,
  p90             double precision NOT NULL,

  -- Where the brand's towns typically sit among all towns that have any store (0..1, 0.5 = a
  -- typical retail town), and how far that is from typical (0 = not distinctive, 1 = every
  -- one of its towns is at one extreme). Scoring weights signals by distinctiveness.
  median_rank     double precision NOT NULL,
  distinctiveness double precision NOT NULL,

  generated_at    timestamptz NOT NULL DEFAULT now(),

  fascia_key      uuid        GENERATED ALWAYS AS
                                (coalesce(fascia_id, '00000000-0000-0000-0000-000000000000'::uuid)) STORED,
  PRIMARY KEY (brand_id, fascia_key, signal_name),

  -- Below this a spread is a handful of anecdotes, not a profile. Kept in step with
  -- MIN_PROFILE_BUAS in brand-matcher-demographics.ts.
  CONSTRAINT brand_demographic_profiles_min_buas CHECK (bua_count >= 8),
  CONSTRAINT brand_demographic_profiles_ordered CHECK (p10 <= p25 AND p25 <= median AND median <= p75 AND p75 <= p90),
  CONSTRAINT brand_demographic_profiles_rank CHECK (median_rank BETWEEN 0 AND 1),
  CONSTRAINT brand_demographic_profiles_distinct CHECK (distinctiveness BETWEEN 0 AND 1)
);

CREATE INDEX IF NOT EXISTS idx_brand_demographic_profiles_fascia
  ON public.brand_demographic_profiles(fascia_id) WHERE fascia_id IS NOT NULL;

ALTER TABLE public.brand_demographic_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.brand_demographic_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_demographic_profiles TO service_role;

COMMENT ON TABLE public.brand_demographic_profiles IS
  'Brand Matcher: spread of each BUA demographic signal across the BUAs a brand/fascia trades in. Rebuilt by rebuild_brand_demographic_profiles().';

-- ---------------------------------------------------------------------------
-- rebuild_brand_demographic_profiles
--    Delete then insert, scoped by brand (the brand_floor_area_profiles shape): a profile that
--    no longer reaches the minimum is removed rather than left stale.
--    Ranks are always taken over every town with a store, whatever the scope, so a scoped
--    rebuild produces the same rows a full one would.
--    Run after rebuild_all_demographics() and after store imports.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rebuild_brand_demographic_profiles(
  p_brand_ids uuid[] DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rows integer;
BEGIN
  SET LOCAL statement_timeout = 0;

  CREATE TEMP TABLE pg_temp.bdp_presence ON COMMIT DROP AS
    SELECT * FROM public.brand_bua_presence();

  -- Every town with at least one store is the baseline the brand's towns are ranked against:
  -- comparing with all BUAs would mostly compare with villages that have no shops at all.
  -- Mid-rank: the share of towns below the value plus half the towns tied with it. Plain
  -- percent_rank() puts a tie at the bottom of its group, which makes a signal where many towns
  -- share a value look distinctive when it is not.
  CREATE TEMP TABLE pg_temp.bdp_ranked ON COMMIT DROP AS
    SELECT v.bua_gsscode, v.signal_name, v.signal_category, v.value,
           cume_dist() OVER (PARTITION BY v.signal_name ORDER BY v.value)
             - (count(*) OVER (PARTITION BY v.signal_name, v.value))::double precision
               / (2 * count(*) OVER (PARTITION BY v.signal_name)) AS pct_rank
    FROM public.brand_matcher_bua_signals v
    WHERE v.bua_gsscode IN (SELECT p.bua_gsscode FROM pg_temp.bdp_presence p);

  CREATE INDEX ON pg_temp.bdp_ranked (bua_gsscode);

  DELETE FROM public.brand_demographic_profiles d
  WHERE p_brand_ids IS NULL OR d.brand_id = ANY(p_brand_ids);

  INSERT INTO public.brand_demographic_profiles (
    brand_id, fascia_id, signal_name, signal_category,
    bua_count, store_count,
    p10, p25, median, p75, p90,
    median_rank, distinctiveness
  )
  WITH units AS (
    -- Each fascia, plus the brand as a whole. A town a brand trades in under two fascias is
    -- one town for the brand-level profile.
    SELECT p.brand_id, p.fascia_id, p.bua_gsscode, p.store_count
    FROM pg_temp.bdp_presence p
    WHERE p.fascia_id IS NOT NULL
    UNION ALL
    SELECT p.brand_id, NULL::uuid, p.bua_gsscode, sum(p.store_count)::bigint
    FROM pg_temp.bdp_presence p
    GROUP BY p.brand_id, p.bua_gsscode
  )
  SELECT u.brand_id,
         u.fascia_id,
         r.signal_name,
         r.signal_category,
         count(*)::integer,
         sum(u.store_count)::integer,
         percentile_cont(0.10) WITHIN GROUP (ORDER BY r.value),
         percentile_cont(0.25) WITHIN GROUP (ORDER BY r.value),
         percentile_cont(0.50) WITHIN GROUP (ORDER BY r.value),
         percentile_cont(0.75) WITHIN GROUP (ORDER BY r.value),
         percentile_cont(0.90) WITHIN GROUP (ORDER BY r.value),
         percentile_cont(0.50) WITHIN GROUP (ORDER BY r.pct_rank),
         least(1, abs(percentile_cont(0.50) WITHIN GROUP (ORDER BY r.pct_rank) - 0.5) * 2)
  FROM units u
  JOIN pg_temp.bdp_ranked r ON r.bua_gsscode = u.bua_gsscode
  WHERE p_brand_ids IS NULL OR u.brand_id = ANY(p_brand_ids)
  GROUP BY u.brand_id, u.fascia_id, r.signal_name, r.signal_category
  HAVING count(*) >= 8;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  DROP TABLE pg_temp.bdp_presence;
  DROP TABLE pg_temp.bdp_ranked;

  RETURN v_rows;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rebuild_brand_demographic_profiles(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_brand_demographic_profiles(uuid[]) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. brand_matcher_site_bua
--    The BUA containing the site; failing that the nearest within p_max_distance_m, because a
--    postcode centroid on an edge-of-town retail park often falls just outside the boundary.
--    No row when neither applies. signals is NULL when the BUA has no demographics (Scotland,
--    Northern Ireland) — the caller shows no comparison rather than a poor one.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.brand_matcher_site_bua(
  p_lat double precision,
  p_lon double precision,
  p_max_distance_m integer DEFAULT 2000
)
RETURNS TABLE (
  bua_gsscode text,
  bua_name    text,
  distance_m  double precision,
  signals     jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH site AS (
    SELECT ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326) AS geom
  ),
  containing AS (
    SELECT g.gsscode, 0::double precision AS d
    FROM site
    JOIN public.built_up_area_geometries g ON ST_Covers(g.geom, site.geom)
    ORDER BY ST_Area(g.geom) ASC
    LIMIT 1
  ),
  candidates AS (
    -- Index-ordered shortlist in degrees, then the true distance in metres: a degree of
    -- longitude is not a degree of latitude, so the planar order can be slightly off.
    SELECT g.gsscode, g.geom
    FROM site, public.built_up_area_geometries g
    ORDER BY g.geom <-> site.geom
    LIMIT 5
  ),
  nearest AS (
    SELECT c.gsscode, ST_Distance(c.geom::geography, site.geom::geography) AS d
    FROM candidates c, site
    WHERE NOT EXISTS (SELECT 1 FROM containing)
      AND ST_DWithin(c.geom::geography, site.geom::geography, p_max_distance_m)
    ORDER BY d
    LIMIT 1
  ),
  placed AS (
    SELECT * FROM containing
    UNION ALL
    SELECT * FROM nearest
  )
  SELECT p.gsscode,
         b.name,
         p.d,
         (SELECT jsonb_object_agg(v.signal_name, v.value)
          FROM public.brand_matcher_bua_signals v
          WHERE v.bua_gsscode = p.gsscode)
  FROM placed p
  JOIN public.built_up_areas b ON b.gsscode = p.gsscode;
$$;

REVOKE EXECUTE ON FUNCTION public.brand_matcher_site_bua(double precision, double precision, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.brand_matcher_site_bua(double precision, double precision, integer)
  TO service_role;
