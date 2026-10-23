-- Scotland's Census 2022 alongside the England and Wales Census 2021.
--
-- Until now every demographic read stopped at the border: lsoa_boundaries, lsoa_metrics and
-- lsoa_affluence_scores held England and Wales LSOAs only, and Scottish searches got "Scotland
-- coming soon". Scotland is published on 2022 data zones (7,392 of them, ~700 people each, codes
-- S01013482..S01020873), which play the same part as LSOAs. This migration puts them in the same
-- tables, so the site demographer, the catchment and town signals and Brand Matcher all read
-- Great Britain without knowing which census a row came from.
--
--   1. lsoa_metrics          — Scottish rows, edition '2022', loaded by
--                              `npm run import:scotland-census` (apps/web/scripts/import-scotland-census.ts),
--                              which maps the NRS tables onto the E&W component ids. Run it first.
--   2. lsoa_boundaries       — data zone polygons, from data_zone_boundaries_clean (the 2022 data zone
--                              boundaries, generalised; areas agree with the NRS shapefile to 0.1%).
--   3. lsoa_affluence_scores — the Scottish affluence scores in data_zone_affluence_scores are on the
--                              2011 data zones; each 2022 zone takes the area-weighted mean of the
--                              2011 zones it overlaps. Like the E&W scores they are scaled within
--                              their own nation (50 = the Scottish median) and Scotland has no
--                              income component.
--   4. lsoa_neighbors        — from data_zone_neighbors (already on 2022 codes).
--   5. lsoa_catchments       — a row per data zone, ready for rebuild_lsoa_catchments().
--   6. Functions that read edition '2021' only now read '2021' and '2022'; town signals include
--      Scottish built-up areas; a data zone's name ("Culter - 01") is trimmed like an LSOA's
--      ("Adur 001A") for place names.
--
-- National averages (metric_averages) stay England and Wales figures, so an index of 100 still
-- means the E&W average everywhere and existing scores don't move.
--
-- After applying:
--   select * from rebuild_bua_lsoa_weights_for_lsoas('S', 'T');   -- Scottish data zones in towns
--   select * from rebuild_bua_demographics_raw();
--   select * from rebuild_bua_demographic_signals();
--   select * from rebuild_bua_demographic_tags();
--   select rebuild_bua_demographic_ranks();
--   select rebuild_lsoa_catchments('S', 'T');                      -- Scotland
--   select rebuild_lsoa_catchment_ranks();
-- then the "Refresh Brand Matcher demographics" button on /admin/stores/import.
-- (English LSOAs within 5km of the border gain Scottish neighbours. Re-running
-- rebuild_lsoa_catchments over England picks them up; it is a few dozen rural LSOAs.)

-- ---------------------------------------------------------------------------
-- 2. lsoa_boundaries
-- ---------------------------------------------------------------------------
INSERT INTO public.lsoa_boundaries (lsoa_code, lsoa_name, lat, lng, geometry)
SELECT d.dz_code,
       d.dz_name,
       ST_Y(ST_PointOnSurface(d.geometry))::numeric,
       ST_X(ST_PointOnSurface(d.geometry))::numeric,
       ST_Multi(d.geometry)
FROM public.data_zone_boundaries_clean d
WHERE d.dz_code >= 'S01013482' AND d.dz_code <= 'S01020873'
ON CONFLICT (lsoa_code) DO UPDATE
  SET lsoa_name = EXCLUDED.lsoa_name,
      lat = EXCLUDED.lat,
      lng = EXCLUDED.lng,
      geometry = EXCLUDED.geometry;

-- ---------------------------------------------------------------------------
-- 3. lsoa_affluence_scores
-- ---------------------------------------------------------------------------
DELETE FROM public.lsoa_affluence_scores WHERE geo_code LIKE 'S%';

INSERT INTO public.lsoa_affluence_scores
  (geo_code, geo_name, raw_score, category, affluence_score_100, affluence_score_with_income)
WITH overlap AS (
  SELECT n.lsoa_code, n.lsoa_name, a.raw_score, a.category, a.affluence_score_100, a.affluence_score_with_income,
         ST_Area(ST_Intersection(ST_MakeValid(o.geometry), n.geometry)::geography) AS area
  FROM public.lsoa_boundaries n
  JOIN public.data_zone_boundaries o ON ST_Intersects(o.geometry, n.geometry)
  JOIN public.data_zone_affluence_scores a ON a.geo_code = o.dz_code
  WHERE n.lsoa_code LIKE 'S%'
),
weighted AS (
  SELECT lsoa_code, lsoa_name,
         sum(raw_score * area) / nullif(sum(area), 0) AS raw_score,
         sum(affluence_score_100 * area) / nullif(sum(area), 0) AS affluence_score_100,
         sum(affluence_score_with_income * area) / nullif(sum(area), 0) AS affluence_score_with_income,
         (array_agg(category ORDER BY area DESC))[1] AS category
  FROM overlap
  WHERE area > 0
  GROUP BY lsoa_code, lsoa_name
)
SELECT lsoa_code, lsoa_name, raw_score, category, affluence_score_100, affluence_score_with_income
FROM weighted
WHERE affluence_score_100 IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. lsoa_neighbors
-- ---------------------------------------------------------------------------
INSERT INTO public.lsoa_neighbors (lsoa_code, neighbor_code)
SELECT dz_code, neighbor_dz_code
FROM public.data_zone_neighbors
ON CONFLICT (lsoa_code, neighbor_code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. lsoa_catchments
-- ---------------------------------------------------------------------------
INSERT INTO public.lsoa_catchments (lsoa_code, centroid, population)
SELECT b.lsoa_code,
       ST_SetSRID(ST_MakePoint(b.lng::double precision, b.lat::double precision), 4326)::geography,
       coalesce(m.numerator, 0)::double precision
FROM public.lsoa_boundaries b
LEFT JOIN public.lsoa_metrics m
  ON m.geo_code = b.lsoa_code AND m.component_id = 'population_total' AND m.edition = '2022'
WHERE left(b.lsoa_code, 1) = 'S'
ON CONFLICT (lsoa_code) DO UPDATE SET centroid = EXCLUDED.centroid, population = EXCLUDED.population;

COMMENT ON TABLE public.lsoa_catchments IS
  'Brand Matcher: each LSOA''s (England and Wales) or 2022 data zone''s (Scotland) catchment (1km where 5,000+ people live within 1km, else 3km or 5km) and density.';

-- ---------------------------------------------------------------------------
-- 6. Functions
-- ---------------------------------------------------------------------------
-- Census editions read together: England and Wales 2021, Scotland 2022. Geo codes never overlap.
CREATE OR REPLACE FUNCTION public.get_lsoa_metrics_agg(selected_geo_codes text[])
RETURNS TABLE(component_id text, selected_avg_pct numeric, selected_total numeric, selected_denominator numeric, national_avg_pct numeric)
LANGUAGE sql
STABLE
AS $$
  SELECT
    m.component_id,
    AVG(m.value_pct::numeric)   AS selected_avg_pct,
    SUM(m.numerator::numeric)   AS selected_total,
    SUM(m.denominator::numeric) AS selected_denominator,
    ma.avg_pct                  AS national_avg_pct
  FROM lsoa_metrics m
  JOIN UNNEST(selected_geo_codes) AS s(geo_code)
    ON s.geo_code = m.geo_code
  LEFT JOIN metric_averages ma
    ON ma.component_id    = m.component_id
   AND ma.geography_level = 'national'
  WHERE m.edition IN ('2021', '2022')
  GROUP BY m.component_id, ma.avg_pct
$$;

CREATE OR REPLACE FUNCTION public.rebuild_bua_demographics_raw()
RETURNS TABLE(step_name text, message text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row_count INTEGER;
BEGIN
  SET statement_timeout = 0;

  RETURN QUERY SELECT 'init'::TEXT, 'Rebuilding bua_demographics_raw table...'::TEXT;

  -- Truncate existing data
  TRUNCATE TABLE bua_demographics_raw;
  RETURN QUERY SELECT 'truncate'::TEXT, 'Truncated existing demographics'::TEXT;

  -- Aggregate weighted metrics
  INSERT INTO bua_demographics_raw (bua_gsscode, component_id, ts_code, numerator, denominator, value_pct)
  SELECT
    w.bua_gsscode,
    m.component_id,
    m.ts_code,
    SUM(m.numerator * w.weight)::INTEGER AS numerator,
    SUM(m.denominator * w.weight)::INTEGER AS denominator,
    CASE
      WHEN SUM(m.denominator * w.weight) > 0
      THEN (SUM(m.numerator * w.weight) / SUM(m.denominator * w.weight) * 100)::NUMERIC(6,2)
      ELSE NULL
    END AS value_pct
  FROM bua_lsoa_weights w
  JOIN lsoa_metrics m ON m.geo_code = w.lsoa_code
  WHERE m.edition IN ('2021', '2022')
    AND m.numerator IS NOT NULL
    AND m.denominator IS NOT NULL
  GROUP BY w.bua_gsscode, m.component_id, m.ts_code;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN QUERY SELECT 'insert'::TEXT, ('Aggregated ' || v_row_count::TEXT || ' BUA demographic metrics')::TEXT;

  RETURN QUERY SELECT 'validation'::TEXT,
    ('Processed ' || COUNT(DISTINCT bua_gsscode)::TEXT || ' BUAs')::TEXT
  FROM bua_demographics_raw;

  RETURN QUERY SELECT 'complete'::TEXT, 'Demographics aggregation complete!'::TEXT;
END;
$$;

-- Catchment measures over England and Wales LSOAs and Scottish data zones alike.
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
    WHERE lm.edition IN ('2021', '2022')
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

-- A site outside any town is named after its LSOA ("Adur 001A" -> "Adur") or data zone
-- ("Culter - 01" -> "Culter").
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
         coalesce((SELECT name FROM town), regexp_replace(l.lsoa_name, '(\s+\d{3}[A-Z]|\s+-\s+\d+)$', '')),
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

-- BUA weights for the LSOAs / data zones with codes in [p_from, p_to), leaving the rest in place
-- (calculate_bua_lsoa_weights() recomputes every pair). Same rule: share of the zone's area inside
-- the town, pairs under 1,000 m² dropped. The geometries are stored in WGS84, so areas are taken in
-- British National Grid metres, and the join uses the raw geometries so the spatial indexes apply.
CREATE OR REPLACE FUNCTION public.rebuild_bua_lsoa_weights_for_lsoas(p_from text, p_to text)
RETURNS TABLE(step_name text, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row_count INTEGER;
BEGIN
  SET statement_timeout = 0;

  DELETE FROM bua_lsoa_weights WHERE lsoa_code >= p_from AND lsoa_code < p_to;

  INSERT INTO bua_lsoa_weights (bua_gsscode, lsoa_code, intersection_area_sqm, lsoa_total_area_sqm, weight)
  SELECT bg.gsscode, lb.lsoa_code, x.area, x.total, LEAST(x.area / NULLIF(x.total, 0), 1.0)
  FROM lsoa_boundaries lb
  JOIN built_up_area_geometries bg ON ST_Intersects(bg.geom, lb.geometry)
  CROSS JOIN LATERAL (
    SELECT ST_Area(ST_Transform(ST_Intersection(ST_Buffer(bg.geom, 0), ST_Buffer(lb.geometry, 0)), 27700)) AS area,
           ST_Area(ST_Transform(lb.geometry, 27700)) AS total
  ) x
  WHERE lb.lsoa_code >= p_from AND lb.lsoa_code < p_to
    AND x.area > 1000;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN QUERY SELECT 'insert'::TEXT, ('Calculated ' || v_row_count::TEXT || ' BUA-LSOA weight pairs')::TEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rebuild_bua_lsoa_weights_for_lsoas(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_bua_lsoa_weights_for_lsoas(text, text) TO service_role;

-- Town signals: Scottish built-up areas join England and Wales ones.
CREATE OR REPLACE VIEW public.brand_matcher_bua_signals AS
SELECT s.bua_gsscode,
       s.signal_name,
       m.signal_category,
       s.index_score::double precision AS value
FROM public.bua_demographic_signals s
JOIN public.demographic_signal_mappings m ON m.signal_name = s.signal_name
WHERE s.index_score IS NOT NULL
  AND left(s.bua_gsscode, 1) IN ('E', 'W', 'S')
UNION ALL
SELECT b.gsscode AS bua_gsscode,
       'population'::text AS signal_name,
       'population'::text AS signal_category,
       b.pop_final::double precision AS value
FROM public.built_up_areas b
WHERE b.pop_final IS NOT NULL
  AND left(b.gsscode, 1) IN ('E', 'W', 'S')
  AND EXISTS (
    SELECT 1 FROM public.bua_demographic_signals s
    WHERE s.bua_gsscode = b.gsscode AND s.index_score IS NOT NULL
  );

-- Outlines for the maps. The LSOA vector tileset (dovet.3xo625k3) is England and Wales only, so
-- the maps draw Scottish data zones from here, keyed like the tileset (LSOA21CD).
CREATE OR REPLACE FUNCTION public.get_lsoa_shapes_geojson(p_codes text[])
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(jsonb_agg(jsonb_build_object(
      'type', 'Feature',
      'properties', jsonb_build_object('LSOA21CD', b.lsoa_code),
      'geometry', ST_AsGeoJSON(ST_SimplifyPreserveTopology(b.geometry, 0.0001), 5)::jsonb
    )), '[]'::jsonb)
  )
  FROM public.lsoa_boundaries b
  WHERE b.lsoa_code = ANY(p_codes);
$$;

REVOKE EXECUTE ON FUNCTION public.get_lsoa_shapes_geojson(text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_lsoa_shapes_geojson(text[]) TO service_role;
