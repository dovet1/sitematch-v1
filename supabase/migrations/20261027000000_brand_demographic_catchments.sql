-- Brand Matcher demographics: local catchments instead of built-up areas, and estates split by
-- site type.
--
-- Town profiles (20261023*) measured each store by its whole built-up area, so a city brand such
-- as Leon (81 stores in 34 towns) looked like "London, Manchester, Birmingham" and nothing more.
-- Now each store is measured by the neighbourhood around it, and each neighbourhood is ranked
-- against neighbourhoods of a similar density. The 19 Oct experiment (scripts/experiments/
-- catchment-demographics) raised the brands that clear the 0.65 backtest bar from 48 to 83.
--
-- It also found that estates mixing city-centre and roadside sites (Leon: 0.57 as one estate,
-- 0.83 for its city sites alone) need a profile per kind of site. So every estate with enough
-- sites of each kind gets three profiles: all its sites, its dense sites and its sparse sites, and
-- a site is judged against the part of the estate that matches its own density.
--
--   1. lsoa_catchments        — one row per England and Wales LSOA: its centroid, the people within
--                               1km, the catchment radius and whether it is dense or sparse.
--   2. lsoa_catchment_ranks   — each LSOA's catchment measures, ranked within its density band.
--      rebuild_lsoa_catchments(from, to) and rebuild_lsoa_catchment_ranks() fill both. Census
--      data only, so they run once (and again only if the census tables change).
--   3. brand_lsoa_presence_snapshot + brand_catchment_profiles, rebuilt per brand by
--      rebuild_brand_catchment_profiles() — the admin refresh calls it after store imports.
--   4. brand_catchment_backtest() + brand_catchment_backtest_results, recorded by
--      record_brand_catchment_backtest().
--   5. brand_matcher_site_catchment() — a site's catchment measures, for the card.
--
-- The town tables and functions are left in place, unused, until this has settled.
--
-- After applying:
--   select rebuild_lsoa_catchments('E', 'E01012000');
--   select rebuild_lsoa_catchments('E01012000', 'E01025000');
--   select rebuild_lsoa_catchments('E01025000', 'F');
--   select rebuild_lsoa_catchments('W', 'X');                    -- Wales
--   select rebuild_lsoa_catchment_ranks();
-- then the "Refresh Brand Matcher demographics" button on /admin/stores/import.

-- A neighbourhood is dense when at least this many people live within 1km of its centre; its
-- catchment is then 1km. Otherwise the catchment widens to 3km, or 5km where 3km still has fewer.
-- Kept in step with DENSE_POPULATION_1KM in brand-matcher-demographics.ts.
-- (5,000 within 1km is about 1,600 people per km², roughly where suburbs give way to countryside.)

-- ---------------------------------------------------------------------------
-- 1. lsoa_catchments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lsoa_catchments (
  lsoa_code    text PRIMARY KEY,
  centroid     geography(Point, 4326) NOT NULL,
  population   double precision NOT NULL,
  -- People in LSOAs whose centroid is within 1km: the density measure, and the "population" signal.
  pop_1km      double precision,
  radius_m     integer CHECK (radius_m IN (1000, 3000, 5000)),
  site_type    text CHECK (site_type IN ('dense', 'sparse')),
  -- 1 = least dense. Bands of about 200 neighbourhoods; measures are ranked within a band.
  density_band integer,
  computed_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_lsoa_catchments_centroid ON public.lsoa_catchments USING gist (centroid);

INSERT INTO public.lsoa_catchments (lsoa_code, centroid, population)
SELECT b.lsoa_code,
       ST_SetSRID(ST_MakePoint(b.lng::double precision, b.lat::double precision), 4326)::geography,
       coalesce(m.numerator, 0)::double precision
FROM public.lsoa_boundaries b
LEFT JOIN public.lsoa_metrics m
  ON m.geo_code = b.lsoa_code AND m.component_id = 'population_total' AND m.edition = '2021'
WHERE left(b.lsoa_code, 1) IN ('E', 'W')
ON CONFLICT (lsoa_code) DO UPDATE SET centroid = EXCLUDED.centroid, population = EXCLUDED.population;

ALTER TABLE public.lsoa_catchments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lsoa_catchments FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lsoa_catchments TO service_role;

COMMENT ON TABLE public.lsoa_catchments IS
  'Brand Matcher: each England and Wales LSOA''s catchment (1km where 5,000+ people live within 1km, else 3km or 5km) and density.';

-- ---------------------------------------------------------------------------
-- 2. lsoa_catchment_ranks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lsoa_catchment_ranks (
  lsoa_code       text NOT NULL REFERENCES public.lsoa_catchments(lsoa_code) ON DELETE CASCADE,
  signal_name     text NOT NULL,
  signal_category text NOT NULL,
  -- Index score (100 = national average) over the catchment, or people within 1km for population.
  value           double precision NOT NULL,
  -- Mid-rank in 0..1 within the density band ('population' across all neighbourhoods). NULL until
  -- rebuild_lsoa_catchment_ranks() has run over the new values.
  rank            double precision CHECK (rank BETWEEN 0 AND 1),
  PRIMARY KEY (lsoa_code, signal_name)
);

CREATE INDEX IF NOT EXISTS idx_lsoa_catchment_ranks_signal ON public.lsoa_catchment_ranks(signal_name);

ALTER TABLE public.lsoa_catchment_ranks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lsoa_catchment_ranks FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lsoa_catchment_ranks TO service_role;

COMMENT ON TABLE public.lsoa_catchment_ranks IS
  'Brand Matcher: each LSOA catchment''s demographic index scores, ranked against catchments of a similar density.';

-- Catchments and their measures for LSOAs with codes in [p_from, p_to). The census sums use the
-- same components and formulas as calculate_demographic_index(); applied to bua_demographics_raw
-- this reproduces the stored town scores to within their rounding.
CREATE OR REPLACE FUNCTION public.rebuild_lsoa_catchments(p_from text, p_to text)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rows integer;
BEGIN
  -- Neighbours within 1km of every LSOA in the range, and within 5km only of those with fewer
  -- than 5,000 people within 1km (5km around a city LSOA would reach a thousand neighbours).
  CREATE TEMP TABLE pg_temp.lc_near ON COMMIT DROP AS
    SELECT c.lsoa_code AS src, n.lsoa_code AS dst, n.population AS pop,
           ST_Distance(c.centroid, n.centroid) AS d
    FROM public.lsoa_catchments c
    JOIN public.lsoa_catchments n ON ST_DWithin(n.centroid, c.centroid, 1000)
    WHERE c.lsoa_code >= p_from AND c.lsoa_code < p_to;

  INSERT INTO pg_temp.lc_near
    SELECT c.lsoa_code, n.lsoa_code, n.population, ST_Distance(c.centroid, n.centroid)
    FROM public.lsoa_catchments c
    JOIN public.lsoa_catchments n
      ON ST_DWithin(n.centroid, c.centroid, 5000) AND NOT ST_DWithin(n.centroid, c.centroid, 1000)
    WHERE c.lsoa_code IN (SELECT src FROM pg_temp.lc_near GROUP BY src HAVING sum(pop) < 5000);

  CREATE TEMP TABLE pg_temp.lc_radius ON COMMIT DROP AS
    SELECT src,
           sum(pop) FILTER (WHERE d <= 1000) AS pop_1km,
           CASE WHEN sum(pop) FILTER (WHERE d <= 1000) >= 5000 THEN 1000
                WHEN sum(pop) FILTER (WHERE d <= 3000) >= 5000 THEN 3000
                ELSE 5000 END AS radius_m
    FROM pg_temp.lc_near
    GROUP BY src;

  UPDATE public.lsoa_catchments c
  SET pop_1km = r.pop_1km,
      radius_m = r.radius_m,
      site_type = CASE WHEN r.pop_1km >= 5000 THEN 'dense' ELSE 'sparse' END,
      computed_at = now()
  FROM pg_temp.lc_radius r
  WHERE r.src = c.lsoa_code;

  DELETE FROM public.lsoa_catchment_ranks WHERE lsoa_code >= p_from AND lsoa_code < p_to;

  INSERT INTO public.lsoa_catchment_ranks (lsoa_code, signal_name, signal_category, value)
  WITH members AS (
    SELECT n.src, n.dst FROM pg_temp.lc_near n JOIN pg_temp.lc_radius r ON r.src = n.src AND n.d <= r.radius_m
  ),
  weights AS (
    SELECT m.signal_name, m.signal_category, g.grp, j.key AS component_id, (j.value->>'weight')::double precision AS weight
    FROM public.demographic_signal_mappings m,
    LATERAL (VALUES ('components'), ('stable_components'), ('transient_components'), ('walkable_components'), ('car_components')) g(grp),
    LATERAL jsonb_each(coalesce(m.calculation_rules->g.grp, '{}')) j
  ),
  raw AS (
    SELECT mb.src, lm.component_id,
           sum(lm.numerator)::double precision / nullif(sum(lm.denominator), 0) * 100 AS value_pct
    FROM members mb
    JOIN public.lsoa_metrics lm ON lm.geo_code = mb.dst
    WHERE lm.edition = '2021'
      AND lm.numerator IS NOT NULL
      AND lm.denominator IS NOT NULL
      AND lm.component_id IN (SELECT DISTINCT component_id FROM weights)
    GROUP BY mb.src, lm.component_id
  ),
  nat AS (
    SELECT component_id, avg_pct::double precision AS avg_pct
    FROM public.metric_averages
    WHERE geography_level = 'national' AND geography_code IS NULL AND avg_pct > 0
  )
  SELECT r.src, w.signal_name, w.signal_category,
         CASE WHEN bool_or(w.grp IN ('stable_components', 'walkable_components'))
              -- Differential signals (stability, car dependency): positive side minus negative.
              THEN (sum(r.value_pct / n.avg_pct * 100 * w.weight) FILTER (WHERE w.grp IN ('stable_components', 'walkable_components'))
                    - coalesce(sum(r.value_pct / n.avg_pct * 100 * w.weight) FILTER (WHERE w.grp IN ('transient_components', 'car_components')), 0))
                   / sum(w.weight) + 100
              ELSE sum(r.value_pct / n.avg_pct * 100 * w.weight) / sum(w.weight) END
  FROM raw r
  JOIN weights w ON w.component_id = r.component_id
  JOIN nat n ON n.component_id = r.component_id
  WHERE r.value_pct IS NOT NULL
  GROUP BY r.src, w.signal_name, w.signal_category
  UNION ALL
  SELECT r.src, 'population', 'population', r.pop_1km FROM pg_temp.lc_radius r;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  DROP TABLE pg_temp.lc_near;
  DROP TABLE pg_temp.lc_radius;
  RETURN v_rows;
END;
$$;

-- Density bands of about p_band_size neighbourhoods, and every measure's rank within its band.
CREATE OR REPLACE FUNCTION public.rebuild_lsoa_catchment_ranks(p_band_size integer DEFAULT 200)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rows integer;
BEGIN
  UPDATE public.lsoa_catchments c
  SET density_band = b.band
  FROM (
    SELECT lsoa_code,
           ntile(greatest(1, round((SELECT count(*) FROM public.lsoa_catchments WHERE pop_1km IS NOT NULL)::numeric / p_band_size))::integer)
             OVER (ORDER BY pop_1km, lsoa_code) AS band
    FROM public.lsoa_catchments
    WHERE pop_1km IS NOT NULL
  ) b
  WHERE b.lsoa_code = c.lsoa_code;

  UPDATE public.lsoa_catchment_ranks r
  SET rank = x.rank
  FROM (
    SELECT r2.lsoa_code, r2.signal_name,
           cume_dist() OVER w - (count(*) OVER (PARTITION BY r2.signal_name, g.peer_group, r2.value))::double precision
                                / (2 * count(*) OVER (PARTITION BY r2.signal_name, g.peer_group)) AS rank
    FROM public.lsoa_catchment_ranks r2
    JOIN public.lsoa_catchments c ON c.lsoa_code = r2.lsoa_code
    CROSS JOIN LATERAL (
      SELECT CASE WHEN r2.signal_name = 'population' THEN 0 ELSE c.density_band END AS peer_group
    ) g
    WINDOW w AS (PARTITION BY r2.signal_name, g.peer_group ORDER BY r2.value)
  ) x
  WHERE x.lsoa_code = r.lsoa_code AND x.signal_name = r.signal_name;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rebuild_lsoa_catchments(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_lsoa_catchments(text, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.rebuild_lsoa_catchment_ranks(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_lsoa_catchment_ranks(integer) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Presence and profiles
-- ---------------------------------------------------------------------------
-- Which LSOAs each brand/fascia has a located store in, and whether each is dense or sparse.
CREATE TABLE IF NOT EXISTS public.brand_lsoa_presence_snapshot (
  brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  fascia_id   uuid REFERENCES public.fascias(id) ON DELETE CASCADE,
  lsoa_code   text NOT NULL REFERENCES public.lsoa_catchments(lsoa_code) ON DELETE CASCADE,
  site_type   text NOT NULL CHECK (site_type IN ('dense', 'sparse')),
  store_count integer NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_brand_lsoa_presence_brand ON public.brand_lsoa_presence_snapshot(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_lsoa_presence_lsoa ON public.brand_lsoa_presence_snapshot(lsoa_code);

ALTER TABLE public.brand_lsoa_presence_snapshot ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.brand_lsoa_presence_snapshot FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_lsoa_presence_snapshot TO service_role;

CREATE TABLE IF NOT EXISTS public.brand_catchment_profiles (
  brand_id        uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  -- NULL = the brand as a whole, across its fascias.
  fascia_id       uuid REFERENCES public.fascias(id) ON DELETE CASCADE,
  -- 'all' = every site; 'dense' / 'sparse' = only that kind of site, built only when the estate has
  -- enough of both kinds to profile each.
  site_type       text NOT NULL CHECK (site_type IN ('all', 'dense', 'sparse')),
  signal_name     text NOT NULL,
  signal_category text NOT NULL,
  -- Distinct neighbourhoods (LSOAs) with a store, and the stores in them.
  site_count      integer NOT NULL,
  store_count     integer NOT NULL,
  p10             double precision NOT NULL,
  p25             double precision NOT NULL,
  median          double precision NOT NULL,
  p75             double precision NOT NULL,
  p90             double precision NOT NULL,
  rank_p10        double precision NOT NULL,
  rank_p25        double precision NOT NULL,
  median_rank     double precision NOT NULL,
  rank_p75        double precision NOT NULL,
  rank_p90        double precision NOT NULL,
  distinctiveness double precision NOT NULL,
  generated_at    timestamptz NOT NULL DEFAULT now(),
  fascia_key      uuid GENERATED ALWAYS AS (coalesce(fascia_id, '00000000-0000-0000-0000-000000000000'::uuid)) STORED,
  PRIMARY KEY (brand_id, fascia_key, site_type, signal_name),
  -- Kept in step with MIN_PROFILE_SITES in brand-matcher-demographics.ts.
  CONSTRAINT brand_catchment_profiles_min_sites CHECK (site_count >= 5)
);

ALTER TABLE public.brand_catchment_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.brand_catchment_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_catchment_profiles TO service_role;

COMMENT ON TABLE public.brand_catchment_profiles IS
  'Brand Matcher: spread of each catchment measure across the neighbourhoods a brand/fascia trades in, for all its sites and, where it has enough of each, its dense and sparse sites separately.';

CREATE OR REPLACE FUNCTION public.rebuild_brand_catchment_profiles(p_brand_ids uuid[] DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rows integer;
BEGIN
  DELETE FROM public.brand_lsoa_presence_snapshot s
  WHERE p_brand_ids IS NULL OR s.brand_id = ANY(p_brand_ids);

  INSERT INTO public.brand_lsoa_presence_snapshot (brand_id, fascia_id, lsoa_code, site_type, store_count)
  SELECT s.brand_id, s.fascia_id, b.lsoa_code, c.site_type, count(*)
  FROM public.stores s
  JOIN public.lsoa_boundaries b ON ST_Covers(b.geometry, s.location::geometry)
  JOIN public.lsoa_catchments c ON c.lsoa_code = b.lsoa_code AND c.site_type IS NOT NULL
  WHERE s.brand_id IS NOT NULL
    AND s.location IS NOT NULL
    AND (p_brand_ids IS NULL OR s.brand_id = ANY(p_brand_ids))
  GROUP BY s.brand_id, s.fascia_id, b.lsoa_code, c.site_type;

  DELETE FROM public.brand_catchment_profiles d
  WHERE p_brand_ids IS NULL OR d.brand_id = ANY(p_brand_ids);

  INSERT INTO public.brand_catchment_profiles (
    brand_id, fascia_id, site_type, signal_name, signal_category, site_count, store_count,
    p10, p25, median, p75, p90, rank_p10, rank_p25, median_rank, rank_p75, rank_p90, distinctiveness
  )
  WITH estate AS (
    -- Each fascia, and the brand as a whole (a neighbourhood it trades in under two fascias counts
    -- once for the brand).
    SELECT p.brand_id, p.fascia_id, p.lsoa_code, p.site_type, p.store_count
    FROM public.brand_lsoa_presence_snapshot p
    WHERE p.fascia_id IS NOT NULL AND (p_brand_ids IS NULL OR p.brand_id = ANY(p_brand_ids))
    UNION ALL
    SELECT p.brand_id, NULL::uuid, p.lsoa_code, min(p.site_type), sum(p.store_count)::integer
    FROM public.brand_lsoa_presence_snapshot p
    WHERE p_brand_ids IS NULL OR p.brand_id = ANY(p_brand_ids)
    GROUP BY p.brand_id, p.lsoa_code
  ),
  -- Split an estate only when both kinds of site have enough neighbourhoods to profile.
  splittable AS (
    SELECT e.brand_id, e.fascia_id
    FROM estate e
    GROUP BY e.brand_id, e.fascia_id
    HAVING count(*) FILTER (WHERE e.site_type = 'dense') >= 5
       AND count(*) FILTER (WHERE e.site_type = 'sparse') >= 5
  ),
  units AS (
    SELECT e.brand_id, e.fascia_id, 'all'::text AS site_type, e.lsoa_code, e.store_count FROM estate e
    UNION ALL
    SELECT e.brand_id, e.fascia_id, e.site_type, e.lsoa_code, e.store_count
    FROM estate e
    JOIN splittable s ON s.brand_id = e.brand_id AND s.fascia_id IS NOT DISTINCT FROM e.fascia_id
  )
  SELECT u.brand_id, u.fascia_id, u.site_type, r.signal_name, r.signal_category,
         count(*)::integer, sum(u.store_count)::integer,
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
  JOIN public.lsoa_catchment_ranks r ON r.lsoa_code = u.lsoa_code AND r.rank IS NOT NULL
  GROUP BY u.brand_id, u.fascia_id, u.site_type, r.signal_name, r.signal_category
  HAVING count(*) >= 5;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rebuild_brand_catchment_profiles(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_brand_catchment_profiles(uuid[]) TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Backtest
--    Five folds, as brand_demographic_backtest() (20261023060000), per profile: (brand or fascia)
--    x (all, dense, sparse). Differences, all to keep it honest with overlapping catchments:
--      * folds are dealt by ~5km grid cell, so a profile never sees a neighbour of a test site;
--      * negatives are other neighbourhoods with a store, from the test site's density band;
--      * no negative lies within 1km of the unit's own stores (a gap between two of its stores
--        is not evidence it would not trade there).
--    "size" is density alone (people within 1km) against neighbourhoods of any density.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.brand_catchment_backtest(
  p_unit_from integer DEFAULT 1,
  p_unit_to integer DEFAULT 1000000,
  p_folds integer DEFAULT 5,
  p_negatives integer DEFAULT 300,
  p_min_sites integer DEFAULT 6,
  p_level text DEFAULT 'fascia'
)
RETURNS TABLE (
  unit_no bigint, brand_id uuid, fascia_id uuid, site_type text, brand_name text, fascia_name text,
  sites bigint, held_out bigint, broad boolean,
  auc_demographics double precision, auc_size double precision, top_signals text[],
  held_out_good bigint, held_out_partial bigint, held_out_weak bigint,
  other_good bigint, other_partial bigint, other_weak bigint
)
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Dynamic so each call is planned with its own unit range: as a plain SQL function the generic
  -- plan took 12 seconds for one unit that the same query runs in 2.
  RETURN QUERY EXECUTE $bt$
  WITH town AS (
    -- Every neighbourhood with a store: the pool negatives are drawn from.
    SELECT DISTINCT p.lsoa_code, c.density_band AS size_band
    FROM public.brand_lsoa_presence_snapshot p
    JOIN public.lsoa_catchments c ON c.lsoa_code = p.lsoa_code
    WHERE c.density_band IS NOT NULL
  ),
  estate AS (
    SELECT p.brand_id,
           CASE WHEN $6 = 'brand' THEN NULL ELSE p.fascia_id END AS fascia_id,
           p.lsoa_code, min(p.site_type) AS site_type
    FROM public.brand_lsoa_presence_snapshot p
    JOIN town t ON t.lsoa_code = p.lsoa_code
    WHERE $6 = 'brand' OR p.fascia_id IS NOT NULL
    GROUP BY 1, 2, 3
  ),
  -- The same rule as rebuild_brand_catchment_profiles(): split only when both kinds can be profiled.
  splittable AS (
    SELECT e.brand_id, e.fascia_id FROM estate e GROUP BY e.brand_id, e.fascia_id
    HAVING count(*) FILTER (WHERE e.site_type = 'dense') >= 5
       AND count(*) FILTER (WHERE e.site_type = 'sparse') >= 5
  ),
  typed AS (
    SELECT e.brand_id, e.fascia_id, 'all'::text AS site_type, e.lsoa_code FROM estate e
    UNION ALL
    SELECT e.brand_id, e.fascia_id, e.site_type, e.lsoa_code
    FROM estate e JOIN splittable s ON s.brand_id = e.brand_id AND s.fascia_id IS NOT DISTINCT FROM e.fascia_id
  ),
  member AS (
    SELECT t.brand_id, t.fascia_id, t.site_type, x.ukey, t.lsoa_code,
           floor(brand_matcher_hash01(x.ukey || '|' || floor(b.lat / 0.05)::text || ':' || floor(b.lng / 0.05)::text) * $3)::integer AS fold
    FROM typed t
    JOIN public.lsoa_boundaries b ON b.lsoa_code = t.lsoa_code
    CROSS JOIN LATERAL (
      SELECT t.brand_id::text || coalesce('/' || t.fascia_id::text, '') || '#' || t.site_type AS ukey
    ) x
  ),
  candidate AS (
    SELECT m.ukey, m.brand_id, m.fascia_id, m.site_type, count(*) AS sites
    FROM member m
    GROUP BY m.ukey, m.brand_id, m.fascia_id, m.site_type
    HAVING count(*) >= $5
  ),
  fold_all AS (
    SELECT c.ukey, f.k
    FROM candidate c
    CROSS JOIN generate_series(0, $3 - 1) AS f(k)
    JOIN member m ON m.ukey = c.ukey
    GROUP BY c.ukey, f.k
    HAVING count(*) FILTER (WHERE m.fold = f.k) >= 1
       AND count(*) FILTER (WHERE m.fold <> f.k) >= 5
  ),
  unit AS (
    SELECT c.*, row_number() OVER (ORDER BY c.ukey COLLATE "C") AS unit_no
    FROM candidate c
    WHERE EXISTS (SELECT 1 FROM fold_all fa WHERE fa.ukey = c.ukey)
  ),
  batch AS (
    SELECT * FROM unit u WHERE u.unit_no BETWEEN $1 AND $2
  ),
  fold AS (
    SELECT fa.* FROM fold_all fa JOIN batch b ON b.ukey = fa.ukey
  ),
  excluded AS (
    SELECT DISTINCT m.ukey, n.lsoa_code
    FROM member m
    JOIN batch b ON b.ukey = m.ukey
    JOIN public.lsoa_catchments c ON c.lsoa_code = m.lsoa_code
    JOIN public.lsoa_catchments n ON ST_DWithin(n.centroid, c.centroid, 1000)
  ),
  train AS (
    SELECT fo.ukey, fo.k, r.signal_name, r.signal_category,
           percentile_cont(0.10) WITHIN GROUP (ORDER BY r.rank) AS p10,
           percentile_cont(0.25) WITHIN GROUP (ORDER BY r.rank) AS p25,
           percentile_cont(0.50) WITHIN GROUP (ORDER BY r.rank) AS median_rank,
           percentile_cont(0.75) WITHIN GROUP (ORDER BY r.rank) AS p75,
           percentile_cont(0.90) WITHIN GROUP (ORDER BY r.rank) AS p90
    FROM fold fo
    JOIN member m ON m.ukey = fo.ukey AND m.fold <> fo.k
    JOIN public.lsoa_catchment_ranks r ON r.lsoa_code = m.lsoa_code AND r.rank IS NOT NULL
    GROUP BY fo.ukey, fo.k, r.signal_name, r.signal_category
    HAVING count(*) >= 5
  ),
  train_d AS (
    SELECT t.*, least(1, abs(t.median_rank - 0.5) * 2) AS dist FROM train t
  ),
  best AS (
    SELECT DISTINCT ON (d.ukey, d.k, d.signal_category) d.*
    FROM train_d d
    WHERE d.signal_name <> 'population'
    ORDER BY d.ukey, d.k, d.signal_category, d.dist DESC, d.signal_name COLLATE "C"
  ),
  chosen AS (
    SELECT * FROM (
      SELECT b.*, row_number() OVER (PARTITION BY b.ukey, b.k ORDER BY b.dist DESC, b.signal_name COLLATE "C") AS rk
      FROM best b
      WHERE b.dist >= 0.3
    ) x
    WHERE x.rk <= 4
  ),
  test_town AS (
    SELECT fo.ukey, fo.k, m.lsoa_code, t.size_band
    FROM fold fo
    JOIN member m ON m.ukey = fo.ukey AND m.fold = fo.k
    JOIN town t ON t.lsoa_code = m.lsoa_code
  ),
  per_town AS (
    SELECT tt.ukey, ceil($4::numeric / count(*))::integer AS n
    FROM test_town tt
    GROUP BY tt.ukey
  ),
  matched AS (
    SELECT DISTINCT x.ukey, x.k, x.lsoa_code
    FROM (
      SELECT tt.ukey, tt.k, t2.lsoa_code,
             row_number() OVER (
               PARTITION BY tt.ukey, tt.k, tt.lsoa_code
               ORDER BY brand_matcher_hash01(tt.ukey || '|neg|' || tt.lsoa_code || '|' || t2.lsoa_code)
             ) AS rn
      FROM test_town tt
      JOIN town t2 ON t2.size_band = tt.size_band
      WHERE EXISTS (SELECT 1 FROM chosen c WHERE c.ukey = tt.ukey AND c.k = tt.k)
        AND NOT EXISTS (SELECT 1 FROM excluded e WHERE e.ukey = tt.ukey AND e.lsoa_code = t2.lsoa_code)
    ) x
    JOIN per_town p ON p.ukey = x.ukey
    WHERE x.rn <= p.n
  ),
  any_size AS (
    SELECT x.ukey, x.lsoa_code
    FROM (
      SELECT b.ukey, t.lsoa_code,
             row_number() OVER (PARTITION BY b.ukey ORDER BY brand_matcher_hash01(b.ukey || '|any|' || t.lsoa_code)) AS rn
      FROM batch b
      CROSS JOIN town t
      WHERE NOT EXISTS (SELECT 1 FROM excluded e WHERE e.ukey = b.ukey AND e.lsoa_code = t.lsoa_code)
    ) x
    WHERE x.rn <= $4
  ),
  demo_scored AS (
    SELECT s.ukey, s.k, s.lsoa_code, s.role,
           sum(c.dist * brand_matcher_signal_fit(r.rank, c.p10, c.p25, c.p75, c.p90)) / sum(c.dist) AS score
    FROM (
      SELECT tt.ukey, tt.k, tt.lsoa_code, 'pos'::text AS role FROM test_town tt
      UNION ALL
      SELECT mt.ukey, mt.k, mt.lsoa_code, 'neg' FROM matched mt
    ) s
    JOIN chosen c ON c.ukey = s.ukey AND c.k = s.k
    JOIN public.lsoa_catchment_ranks r ON r.lsoa_code = s.lsoa_code AND r.signal_name = c.signal_name
    GROUP BY s.ukey, s.k, s.lsoa_code, s.role
  ),
  demo_auc AS (
    SELECT p.ukey,
           avg(CASE WHEN n.score < p.score THEN 1.0 WHEN n.score = p.score THEN 0.5 ELSE 0.0 END)::double precision AS auc
    FROM demo_scored p
    JOIN demo_scored n ON n.ukey = p.ukey AND n.k = p.k AND n.role = 'neg'
    WHERE p.role = 'pos'
    GROUP BY p.ukey
  ),
  demo_bands AS (
    SELECT d.ukey,
           count(*) FILTER (WHERE d.role = 'pos' AND d.score >= 0.75) AS pos_good,
           count(*) FILTER (WHERE d.role = 'pos' AND d.score >= 0.5 AND d.score < 0.75) AS pos_partial,
           count(*) FILTER (WHERE d.role = 'pos' AND d.score < 0.5) AS pos_weak,
           count(*) FILTER (WHERE d.role = 'neg' AND d.score >= 0.75) AS neg_good,
           count(*) FILTER (WHERE d.role = 'neg' AND d.score >= 0.5 AND d.score < 0.75) AS neg_partial,
           count(*) FILTER (WHERE d.role = 'neg' AND d.score < 0.5) AS neg_weak
    FROM demo_scored d
    GROUP BY d.ukey
  ),
  size_scored AS (
    SELECT s.ukey, s.k, s.role, brand_matcher_signal_fit(r.rank, sp.p10, sp.p25, sp.p75, sp.p90) AS score
    FROM (
      SELECT tt.ukey, tt.k, tt.lsoa_code, 'pos'::text AS role FROM test_town tt
      UNION ALL
      SELECT a.ukey, fo.k, a.lsoa_code, 'neg' FROM any_size a JOIN fold fo ON fo.ukey = a.ukey
    ) s
    JOIN train_d sp ON sp.ukey = s.ukey AND sp.k = s.k AND sp.signal_name = 'population'
    JOIN public.lsoa_catchment_ranks r ON r.lsoa_code = s.lsoa_code AND r.signal_name = 'population'
  ),
  size_auc AS (
    SELECT p.ukey,
           avg(CASE WHEN n.score < p.score THEN 1.0 WHEN n.score = p.score THEN 0.5 ELSE 0.0 END)::double precision AS auc
    FROM size_scored p
    JOIN size_scored n ON n.ukey = p.ukey AND n.k = p.k AND n.role = 'neg'
    WHERE p.role = 'pos'
    GROUP BY p.ukey
  )
  SELECT b.unit_no, b.brand_id, b.fascia_id, b.site_type, br.name, f.name, b.sites,
         (SELECT count(*) FROM test_town tt WHERE tt.ukey = b.ukey),
         NOT EXISTS (SELECT 1 FROM chosen c WHERE c.ukey = b.ukey),
         da.auc, sa.auc,
         (SELECT array_agg(c.signal_name ORDER BY c.rk) FROM chosen c
          WHERE c.ukey = b.ukey AND c.k = (SELECT min(c2.k) FROM chosen c2 WHERE c2.ukey = b.ukey)),
         coalesce(db.pos_good, 0), coalesce(db.pos_partial, 0), coalesce(db.pos_weak, 0),
         coalesce(db.neg_good, 0), coalesce(db.neg_partial, 0), coalesce(db.neg_weak, 0)
  FROM batch b
  JOIN brands br ON br.id = b.brand_id
  LEFT JOIN fascias f ON f.id = b.fascia_id
  LEFT JOIN demo_auc da ON da.ukey = b.ukey
  LEFT JOIN size_auc sa ON sa.ukey = b.ukey
  LEFT JOIN demo_bands db ON db.ukey = b.ukey
  ORDER BY b.unit_no
  $bt$ USING p_unit_from, p_unit_to, p_folds, p_negatives, p_min_sites, p_level;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.brand_catchment_backtest(integer, integer, integer, integer, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.brand_catchment_backtest(integer, integer, integer, integer, integer, text) TO service_role;

CREATE TABLE IF NOT EXISTS public.brand_catchment_backtest_results (
  brand_id         uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  fascia_id        uuid REFERENCES public.fascias(id) ON DELETE CASCADE,
  site_type        text NOT NULL CHECK (site_type IN ('all', 'dense', 'sparse')),
  sites            integer NOT NULL,
  held_out         integer NOT NULL,
  broad            boolean NOT NULL,
  auc_demographics double precision,
  auc_size         double precision,
  computed_at      timestamptz NOT NULL DEFAULT now(),
  fascia_key       uuid GENERATED ALWAYS AS (coalesce(fascia_id, '00000000-0000-0000-0000-000000000000'::uuid)) STORED,
  PRIMARY KEY (brand_id, fascia_key, site_type)
);

ALTER TABLE public.brand_catchment_backtest_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.brand_catchment_backtest_results FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_catchment_backtest_results TO service_role;

COMMENT ON TABLE public.brand_catchment_backtest_results IS
  'Brand Matcher: five-fold backtest AUC of each catchment profile. The card shows a fit only where auc_demographics >= MIN_VALIDATED_AUC.';

CREATE OR REPLACE FUNCTION public.record_brand_catchment_backtest(
  p_level text DEFAULT 'fascia',
  p_unit_from integer DEFAULT 1,
  p_unit_to integer DEFAULT 1000000
) RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rows integer;
BEGIN
  IF p_level NOT IN ('fascia', 'brand') THEN
    RAISE EXCEPTION 'p_level must be fascia or brand, not %', p_level;
  END IF;

  IF p_unit_from = 1 THEN
    DELETE FROM public.brand_catchment_backtest_results r
    WHERE (r.fascia_id IS NULL) = (p_level = 'brand');
  END IF;

  INSERT INTO public.brand_catchment_backtest_results
    (brand_id, fascia_id, site_type, sites, held_out, broad, auc_demographics, auc_size, computed_at)
  SELECT b.brand_id, b.fascia_id, b.site_type, b.sites, b.held_out, b.broad, b.auc_demographics, b.auc_size, now()
  FROM public.brand_catchment_backtest(p_unit_from, p_unit_to, 5, 300, 6, p_level) b
  ON CONFLICT (brand_id, fascia_key, site_type) DO UPDATE SET
    sites = EXCLUDED.sites,
    held_out = EXCLUDED.held_out,
    broad = EXCLUDED.broad,
    auc_demographics = EXCLUDED.auc_demographics,
    auc_size = EXCLUDED.auc_size,
    computed_at = EXCLUDED.computed_at;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_brand_catchment_backtest(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_brand_catchment_backtest(text, integer, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- 5. brand_matcher_site_catchment
--    The LSOA the site is in, its catchment measures and ranks, and a place name for the card:
--    the built-up area around it, else the local authority (the LSOA name less its code).
--    No row outside England and Wales.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.brand_matcher_site_catchment(p_lat double precision, p_lon double precision)
RETURNS TABLE (
  lsoa_code  text,
  place_name text,
  site_type  text,
  radius_m   integer,
  pop_1km    double precision,
  signals    jsonb,
  ranks      jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH site AS (
    SELECT ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326) AS geom
  ),
  lsoa AS (
    SELECT b.lsoa_code, b.lsoa_name
    FROM site JOIN public.lsoa_boundaries b ON ST_Covers(b.geometry, site.geom)
    LIMIT 1
  ),
  town AS (
    SELECT a.name
    FROM site
    JOIN public.built_up_area_geometries g ON ST_Covers(g.geom, site.geom)
    JOIN public.built_up_areas a ON a.gsscode = g.gsscode
    ORDER BY ST_Area(g.geom) ASC
    LIMIT 1
  )
  SELECT l.lsoa_code,
         coalesce((SELECT name FROM town), regexp_replace(l.lsoa_name, '\s+\d{3}[A-Z]$', '')),
         c.site_type,
         c.radius_m,
         c.pop_1km,
         (SELECT jsonb_object_agg(r.signal_name, r.value) FROM public.lsoa_catchment_ranks r
          WHERE r.lsoa_code = l.lsoa_code AND r.rank IS NOT NULL),
         (SELECT jsonb_object_agg(r.signal_name, r.rank) FROM public.lsoa_catchment_ranks r
          WHERE r.lsoa_code = l.lsoa_code AND r.rank IS NOT NULL)
  FROM lsoa l
  JOIN public.lsoa_catchments c ON c.lsoa_code = l.lsoa_code
  WHERE c.site_type IS NOT NULL;
$$;

REVOKE EXECUTE ON FUNCTION public.brand_matcher_site_catchment(double precision, double precision) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.brand_matcher_site_catchment(double precision, double precision) TO service_role;
