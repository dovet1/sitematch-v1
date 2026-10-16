-- Brand Matcher demographic fit: judge towns against towns of a similar size.
--
-- 20261023000000 ranked each brand's towns against every town with a store. Most of those are
-- villages, so for every brand the loudest trait was "bigger towns than usual", followed by what
-- comes with size (more walkable, more transient, fewer retirees); Waitrose's affluence barely
-- registered. Town size is easy to judge for yourself and would have made the score little more
-- than a size check.
--
-- Now every England and Wales town is placed in a size band of about 200 towns of similar
-- population, and each demographic signal is ranked within its band: "affluent" means affluent
-- for a town of its size. Population itself is still ranked across all towns, so size stays
-- available as a separate fact. Profiles carry the spread of those ranks, and the site lookup
-- returns the site's town ranks, so the fit compares like with like.
--
-- The ranks live in bua_demographic_ranks, rebuilt by rebuild_bua_demographic_ranks() — run it
-- after rebuild_all_demographics() and before rebuild_brand_demographic_profiles().

-- ---------------------------------------------------------------------------
-- 1. bua_demographic_ranks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bua_demographic_ranks (
  bua_gsscode     text        NOT NULL REFERENCES public.built_up_areas(gsscode) ON DELETE CASCADE,
  signal_name     text        NOT NULL,
  signal_category text        NOT NULL,
  value           double precision NOT NULL,
  -- 1 = smallest towns. Bands hold about the same number of towns.
  size_band       integer     NOT NULL,
  -- Mid-rank in 0..1: share of comparable towns below this value plus half of those tied with it.
  -- Comparable = same size band, except for 'population', which is ranked across all towns.
  rank            double precision NOT NULL CHECK (rank BETWEEN 0 AND 1),
  PRIMARY KEY (bua_gsscode, signal_name)
);

CREATE INDEX IF NOT EXISTS idx_bua_demographic_ranks_signal ON public.bua_demographic_ranks(signal_name);

ALTER TABLE public.bua_demographic_ranks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bua_demographic_ranks FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bua_demographic_ranks TO service_role;

COMMENT ON TABLE public.bua_demographic_ranks IS
  'Brand Matcher: each England and Wales town''s demographic signals ranked against towns of a similar size (population ranked against all towns). Rebuilt by rebuild_bua_demographic_ranks().';

CREATE OR REPLACE FUNCTION public.rebuild_bua_demographic_ranks(
  p_band_size integer DEFAULT 200
) RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rows integer;
BEGIN
  DELETE FROM public.bua_demographic_ranks;

  INSERT INTO public.bua_demographic_ranks (bua_gsscode, signal_name, signal_category, value, size_band, rank)
  WITH towns AS (
    SELECT v.bua_gsscode, v.value AS population
    FROM public.brand_matcher_bua_signals v
    WHERE v.signal_name = 'population'
  ),
  bands AS (
    SELECT t.bua_gsscode,
           ntile(greatest(1, round((SELECT count(*) FROM towns)::numeric / p_band_size))::integer)
             OVER (ORDER BY t.population, t.bua_gsscode) AS size_band
    FROM towns t
  ),
  banded AS (
    SELECT v.bua_gsscode, v.signal_name, v.signal_category, v.value, b.size_band,
           CASE WHEN v.signal_name = 'population' THEN 0 ELSE b.size_band END AS peer_group
    FROM public.brand_matcher_bua_signals v
    JOIN bands b ON b.bua_gsscode = v.bua_gsscode
  )
  SELECT bua_gsscode, signal_name, signal_category, value, size_band,
         cume_dist() OVER (PARTITION BY signal_name, peer_group ORDER BY value)
           - (count(*) OVER (PARTITION BY signal_name, peer_group, value))::double precision
             / (2 * count(*) OVER (PARTITION BY signal_name, peer_group))
  FROM banded;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rebuild_bua_demographic_ranks(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_bua_demographic_ranks(integer) TO service_role;

-- ---------------------------------------------------------------------------
-- 2. brand_demographic_profiles: the spread of the brand's size-adjusted ranks
--    Emptied first: every row is rebuilt below and the new columns are required.
-- ---------------------------------------------------------------------------
DELETE FROM public.brand_demographic_profiles;

ALTER TABLE public.brand_demographic_profiles
  ADD COLUMN IF NOT EXISTS rank_p10 double precision NOT NULL,
  ADD COLUMN IF NOT EXISTS rank_p25 double precision NOT NULL,
  ADD COLUMN IF NOT EXISTS rank_p75 double precision NOT NULL,
  ADD COLUMN IF NOT EXISTS rank_p90 double precision NOT NULL;

ALTER TABLE public.brand_demographic_profiles
  DROP CONSTRAINT IF EXISTS brand_demographic_profiles_rank_ordered;
ALTER TABLE public.brand_demographic_profiles
  ADD CONSTRAINT brand_demographic_profiles_rank_ordered
  CHECK (rank_p10 <= rank_p25 AND rank_p25 <= median_rank AND median_rank <= rank_p75 AND rank_p75 <= rank_p90);

COMMENT ON COLUMN public.brand_demographic_profiles.median_rank IS
  'Median size-adjusted rank of the brand''s towns (0.5 = typical for towns of their size).';

-- ---------------------------------------------------------------------------
-- 3. rebuild_brand_demographic_profiles, now reading the size-adjusted ranks
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
    SELECT * FROM public.brand_bua_presence()
    WHERE p_brand_ids IS NULL OR brand_id = ANY(p_brand_ids);

  DELETE FROM public.brand_demographic_profiles d
  WHERE p_brand_ids IS NULL OR d.brand_id = ANY(p_brand_ids);

  INSERT INTO public.brand_demographic_profiles (
    brand_id, fascia_id, signal_name, signal_category,
    bua_count, store_count,
    p10, p25, median, p75, p90,
    rank_p10, rank_p25, median_rank, rank_p75, rank_p90,
    distinctiveness
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
         percentile_cont(0.10) WITHIN GROUP (ORDER BY r.rank),
         percentile_cont(0.25) WITHIN GROUP (ORDER BY r.rank),
         percentile_cont(0.50) WITHIN GROUP (ORDER BY r.rank),
         percentile_cont(0.75) WITHIN GROUP (ORDER BY r.rank),
         percentile_cont(0.90) WITHIN GROUP (ORDER BY r.rank),
         least(1, abs(percentile_cont(0.50) WITHIN GROUP (ORDER BY r.rank) - 0.5) * 2)
  FROM units u
  JOIN public.bua_demographic_ranks r ON r.bua_gsscode = u.bua_gsscode
  GROUP BY u.brand_id, u.fascia_id, r.signal_name, r.signal_category
  HAVING count(*) >= 8;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  DROP TABLE pg_temp.bdp_presence;

  RETURN v_rows;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rebuild_brand_demographic_profiles(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_brand_demographic_profiles(uuid[]) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. brand_matcher_site_bua: also return the site town's size-adjusted ranks
--    The result columns change, so the function is dropped and recreated.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.brand_matcher_site_bua(double precision, double precision, integer);

CREATE FUNCTION public.brand_matcher_site_bua(
  p_lat double precision,
  p_lon double precision,
  p_max_distance_m integer DEFAULT 2000
)
RETURNS TABLE (
  bua_gsscode text,
  bua_name    text,
  distance_m  double precision,
  signals     jsonb,
  ranks       jsonb
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
         (SELECT jsonb_object_agg(r.signal_name, r.value)
          FROM public.bua_demographic_ranks r WHERE r.bua_gsscode = p.gsscode),
         (SELECT jsonb_object_agg(r.signal_name, r.rank)
          FROM public.bua_demographic_ranks r WHERE r.bua_gsscode = p.gsscode)
  FROM placed p
  JOIN public.built_up_areas b ON b.gsscode = p.gsscode;
$$;

REVOKE EXECUTE ON FUNCTION public.brand_matcher_site_bua(double precision, double precision, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.brand_matcher_site_bua(double precision, double precision, integer)
  TO service_role;
