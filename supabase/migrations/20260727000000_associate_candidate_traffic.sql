-- Migration: candidate_site -> DfT AADF traffic association for "Find Sites" M4.
--
-- M4 ENRICHMENT step: attach real traffic (DfT AADF count points) to every candidate
-- site in the enrichment universe (HMLR polygons >= 0.3 ac). OCCUPIER-AGNOSTIC: we store
-- the raw count-point link with full provenance and estimation method; no invented
-- High/Med/Low. The occupier search funnel decides what AADF it wants later.
--
-- THE M4 GATE QUESTION — how do you link a parcel to a traffic figure? A count point is a
-- POINT; the parcel is a polygon set back from the road. Snapping the site to its nearest
-- count point can pick a point on a minor service road while the site actually FRONTS a
-- busy A road whose count point is a little further. So we compute TWO methods per site so
-- they can be COMPARED on real Canterbury layouts (never assume one):
--
--   * method 'count_point_direct' — nearest DfT count point(s) to the site polygon within
--     radius, by raw geometry proximity. Simple; but can attach the wrong (minor) road.
--   * method 'via_road' — the count point(s) snapped (within a tight tolerance) to the
--     site's ALREADY-ASSOCIATED road link(s) from M3 (candidate_site_roads). This routes
--     traffic through the road the site actually relates to, and — because M3 retained the
--     nearest link of each primary class — it can attribute an A-road AADF to a site that
--     fronts that A road even when a minor road (and its count point) is physically nearer.
--
-- Because road_links is source-agnostic, the SAME via_road method also serves the
-- "DfT Major Roads geometry" comparison arm: import the DfT Major Road Network link
-- geometry into road_links with source='dft_major_roads', re-run the M3 road association
-- with --road-source dft_major_roads, then run this with --road-source dft_major_roads.
-- OS-Open-Roads-mediated vs DfT-Major-Roads-geometry-mediated then differ only by which
-- road network mediated the snap — a like-for-like comparison.
--
-- The representative pick per method (is_best_for_method): for direct = nearest count
-- point; for via_road = the count point on the site's nearest PRIMARY-class road if any,
-- else its nearest-overall road (deterministic, occupier-agnostic — mirrors M3). The
-- coverage RPC reports where the two methods AGREE vs DISAGREE, so the gate is evidenced.

-- =============================================================================
-- candidate_site_traffic — one row per (candidate_site, traffic_count, method)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.candidate_site_traffic (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_site_id        uuid NOT NULL REFERENCES public.candidate_sites(id) ON DELETE CASCADE,
  traffic_count_id         uuid NOT NULL REFERENCES public.traffic_counts(id) ON DELETE CASCADE,
  method                   text NOT NULL,      -- 'count_point_direct' | 'via_road'
  via_road_link_id         uuid REFERENCES public.road_links(id) ON DELETE SET NULL, -- the road the point was snapped to (via_road only)
  site_to_count_m          numeric,            -- site polygon edge -> count point (geography m)
  road_to_count_m          numeric,            -- associated road link -> count point (geography m); NULL for direct
  -- Denormalised DfT attributes (snapshot at association time), so the engine + debug map
  -- + provenance need no join and survive re-imports.
  aadf_all_motor_vehicles  numeric,
  aadf_year                integer,
  estimation_method        text,               -- 'Counted' | 'Estimated' — carried so it can never be lost behind a score
  road_number              text,
  road_category            text,
  is_best_for_method       boolean NOT NULL DEFAULT false, -- representative count point for the site under this method
  max_distance_m           numeric,            -- search radius / snap tolerance used
  provenance               jsonb NOT NULL DEFAULT '{}'::jsonb, -- {method, traffic_source, road_source, year_mode, computed_at}
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_site_id, traffic_count_id, method)
);

COMMENT ON TABLE public.candidate_site_traffic IS 'M4 enrichment: candidate_site -> DfT AADF count-point associations under two comparable linking methods (count_point_direct vs via_road). Occupier-agnostic screening data with full provenance + estimation method; never a suitability/traffic-adequacy claim.';
COMMENT ON COLUMN public.candidate_site_traffic.method IS 'count_point_direct = nearest count point by raw proximity; via_road = count point snapped to the site''s associated road link (routes traffic through the road the site relates to).';
COMMENT ON COLUMN public.candidate_site_traffic.is_best_for_method IS 'The representative count point for this site under this method. direct = nearest; via_road = on the nearest primary-class road else nearest-overall road. Deterministic + occupier-agnostic.';

CREATE INDEX IF NOT EXISTS idx_cst_site ON public.candidate_site_traffic (candidate_site_id);
CREATE INDEX IF NOT EXISTS idx_cst_traffic ON public.candidate_site_traffic (traffic_count_id);
CREATE INDEX IF NOT EXISTS idx_cst_method ON public.candidate_site_traffic (method);
CREATE INDEX IF NOT EXISTS idx_cst_best ON public.candidate_site_traffic (candidate_site_id, method) WHERE is_best_for_method;

DROP TRIGGER IF EXISTS update_candidate_site_traffic_updated_at ON public.candidate_site_traffic;
CREATE TRIGGER update_candidate_site_traffic_updated_at
  BEFORE UPDATE ON public.candidate_site_traffic
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- RLS: public SELECT, admin manage; bulk writes via the service-role RPC below.
-- =============================================================================
ALTER TABLE public.candidate_site_traffic ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view candidate site traffic" ON public.candidate_site_traffic;
CREATE POLICY "Public can view candidate site traffic" ON public.candidate_site_traffic
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage candidate site traffic" ON public.candidate_site_traffic;
CREATE POLICY "Admins can manage candidate site traffic" ON public.candidate_site_traffic
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'));

-- =============================================================================
-- associate_candidate_site_traffic() — compute + upsert traffic associations for a
-- batch of candidate sites under BOTH methods. Idempotent per site. service_role only.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.associate_candidate_site_traffic(
  p_site_ids       uuid[],
  p_max_distance_m numeric DEFAULT 300,   -- direct: site polygon -> count point radius
  p_road_snap_m    numeric DEFAULT 30,    -- via_road: count point -> associated road link tolerance
  p_traffic_source text    DEFAULT 'dft_aadf',
  p_road_source    text    DEFAULT 'os_open_roads',
  p_year           integer DEFAULT NULL,  -- NULL = latest year per count point
  p_provenance     jsonb   DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deg_direct numeric := (p_max_distance_m / 111320.0) * 2.0; -- planar-degree prefilter (indexed), exact geography filters after
  v_deg_snap   numeric := (p_road_snap_m   / 111320.0) * 2.0;
  v_count integer := 0;
BEGIN
  -- Idempotent: clear existing associations (both methods) for these sites, recompute.
  DELETE FROM public.candidate_site_traffic WHERE candidate_site_id = ANY(p_site_ids);

  WITH sites AS (
    SELECT id, geom FROM public.candidate_sites WHERE id = ANY(p_site_ids)
  ),
  -- One row per count point: the requested year, else the latest available.
  tc AS (
    SELECT DISTINCT ON (count_point_id)
      id, geom, year, road_number, road_category, road_type,
      estimation_method, aadf_all_motor_vehicles
    FROM public.traffic_counts
    WHERE source = p_traffic_source
      AND count_point_id IS NOT NULL
      AND (p_year IS NULL OR year = p_year)
    ORDER BY count_point_id, year DESC
  ),
  -- METHOD 1: nearest count point(s) to the site polygon within radius (raw proximity).
  direct AS (
    SELECT s.id AS site_id, t.id AS traffic_count_id,
           'count_point_direct'::text AS method, NULL::uuid AS via_road_link_id,
           ST_Distance(s.geom::geography, t.geom::geography) AS site_to_count_m,
           NULL::numeric AS road_to_count_m,
           t.aadf_all_motor_vehicles, t.year AS aadf_year, t.estimation_method,
           t.road_number, t.road_category
    FROM sites s
    JOIN tc t ON ST_DWithin(t.geom, s.geom, v_deg_direct)
    WHERE ST_Distance(s.geom::geography, t.geom::geography) <= p_max_distance_m
  ),
  direct_ranked AS (
    SELECT *, row_number() OVER (PARTITION BY site_id ORDER BY site_to_count_m, traffic_count_id) AS rnk
    FROM direct
  ),
  -- METHOD 2: count point(s) snapped to the site's associated road link(s) from M3.
  via_raw AS (
    SELECT s.id AS site_id, t.id AS traffic_count_id, rl.id AS via_road_link_id,
           ST_Distance(s.geom::geography, t.geom::geography) AS site_to_count_m,
           ST_Distance(rl.geom::geography, t.geom::geography) AS road_to_count_m,
           t.aadf_all_motor_vehicles, t.year AS aadf_year, t.estimation_method,
           t.road_number, t.road_category,
           csr.is_nearest_overall, csr.is_nearest_in_primary_class, csr.distance_m AS road_distance_m
    FROM sites s
    JOIN public.candidate_site_roads csr ON csr.candidate_site_id = s.id
    JOIN public.road_links rl ON rl.id = csr.road_link_id AND rl.source = p_road_source
    JOIN tc t ON ST_DWithin(t.geom, rl.geom, v_deg_snap)
    WHERE ST_Distance(rl.geom::geography, t.geom::geography) <= p_road_snap_m
  ),
  -- A count point can snap to several of a site's links (both carriageways, etc.); keep
  -- one row per (site, count point), on the best-relating road (primary class > overall).
  via_dedup AS (
    SELECT DISTINCT ON (site_id, traffic_count_id)
      site_id, traffic_count_id, 'via_road'::text AS method, via_road_link_id,
      site_to_count_m, road_to_count_m, aadf_all_motor_vehicles, aadf_year,
      estimation_method, road_number, road_category,
      is_nearest_overall, is_nearest_in_primary_class, road_distance_m
    FROM via_raw
    ORDER BY site_id, traffic_count_id,
             is_nearest_in_primary_class DESC, is_nearest_overall DESC,
             road_distance_m ASC, road_to_count_m ASC
  ),
  via_ranked AS (
    SELECT *, row_number() OVER (
      PARTITION BY site_id
      ORDER BY is_nearest_in_primary_class DESC, is_nearest_overall DESC,
               road_distance_m ASC, road_to_count_m ASC, traffic_count_id
    ) AS rnk
    FROM via_dedup
  ),
  unioned AS (
    SELECT site_id, traffic_count_id, method, via_road_link_id, site_to_count_m,
           road_to_count_m, aadf_all_motor_vehicles, aadf_year, estimation_method,
           road_number, road_category, (rnk = 1) AS is_best, p_max_distance_m AS radius
    FROM direct_ranked
    UNION ALL
    SELECT site_id, traffic_count_id, method, via_road_link_id, site_to_count_m,
           road_to_count_m, aadf_all_motor_vehicles, aadf_year, estimation_method,
           road_number, road_category, (rnk = 1) AS is_best, p_road_snap_m AS radius
    FROM via_ranked
  )
  INSERT INTO public.candidate_site_traffic (
    candidate_site_id, traffic_count_id, method, via_road_link_id, site_to_count_m,
    road_to_count_m, aadf_all_motor_vehicles, aadf_year, estimation_method,
    road_number, road_category, is_best_for_method, max_distance_m, provenance
  )
  SELECT site_id, traffic_count_id, method, via_road_link_id, site_to_count_m,
         road_to_count_m, aadf_all_motor_vehicles, aadf_year, estimation_method,
         road_number, road_category, is_best, radius, p_provenance
  FROM unioned;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.associate_candidate_site_traffic(uuid[], numeric, numeric, text, text, integer, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.associate_candidate_site_traffic(uuid[], numeric, numeric, text, text, integer, jsonb) TO service_role;

COMMENT ON FUNCTION public.associate_candidate_site_traffic(uuid[], numeric, numeric, text, text, integer, jsonb) IS 'M4: associate a batch of candidate sites with DfT AADF count points under two comparable methods (direct proximity + via associated road link). Idempotent per site; service_role only.';

-- =============================================================================
-- candidate_traffic_coverage() — authoritative coverage + METHOD-COMPARISON numbers
-- for a candidate-site area band. Called once per band (universe + drive-thru subset),
-- reported SEPARATELY (two-funnel rule). Read-only.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.candidate_traffic_coverage(
  p_min_acres   numeric DEFAULT 0.3,
  p_max_acres   numeric DEFAULT NULL,
  p_min_aadf    numeric DEFAULT NULL,   -- optional occupier signal: best via_road AADF >= this
  p_site_source text    DEFAULT 'hmlr_inspire'
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
WITH universe AS (
  SELECT cs.id
  FROM public.candidate_sites cs
  WHERE cs.source = p_site_source
    AND cs.area_acres >= p_min_acres
    AND (p_max_acres IS NULL OR cs.area_acres < p_max_acres)
),
best_direct AS (
  SELECT r.candidate_site_id, r.traffic_count_id, r.aadf_all_motor_vehicles AS aadf,
         r.estimation_method, r.aadf_year
  FROM public.candidate_site_traffic r
  JOIN universe u ON u.id = r.candidate_site_id
  WHERE r.method = 'count_point_direct' AND r.is_best_for_method
),
best_via AS (
  SELECT r.candidate_site_id, r.traffic_count_id, r.aadf_all_motor_vehicles AS aadf,
         r.estimation_method, r.aadf_year, r.road_category, r.site_to_count_m, r.road_to_count_m
  FROM public.candidate_site_traffic r
  JOIN universe u ON u.id = r.candidate_site_id
  WHERE r.method = 'via_road' AND r.is_best_for_method
),
both_methods AS (
  SELECT d.candidate_site_id,
         d.traffic_count_id AS direct_cp, v.traffic_count_id AS via_cp,
         d.aadf AS direct_aadf, v.aadf AS via_aadf
  FROM best_direct d JOIN best_via v ON v.candidate_site_id = d.candidate_site_id
)
SELECT jsonb_build_object(
  'site_source', p_site_source,
  'min_acres', p_min_acres,
  'max_acres', p_max_acres,
  'universe', (SELECT count(*) FROM universe),
  'with_traffic_direct', (SELECT count(*) FROM best_direct),
  'with_traffic_via_road', (SELECT count(*) FROM best_via),
  'with_traffic_any', (
    SELECT count(DISTINCT sid) FROM (
      SELECT candidate_site_id AS sid FROM best_direct
      UNION SELECT candidate_site_id FROM best_via
    ) x
  ),
  -- AADF distribution of the representative pick, per method (screening signal only).
  'via_aadf_p50', (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY aadf) FROM best_via WHERE aadf IS NOT NULL),
  'via_aadf_p90', (SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY aadf) FROM best_via WHERE aadf IS NOT NULL),
  'direct_aadf_p50', (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY aadf) FROM best_direct WHERE aadf IS NOT NULL),
  'direct_aadf_p90', (SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY aadf) FROM best_direct WHERE aadf IS NOT NULL),
  -- Honesty: how much of the representative traffic is COUNTED vs modelled (Estimated).
  'via_estimation_counts', (
    SELECT coalesce(jsonb_object_agg(coalesce(estimation_method,'(null)'), c), '{}'::jsonb)
    FROM (SELECT estimation_method, count(*) c FROM best_via GROUP BY estimation_method) t
  ),
  'via_road_category_counts', (
    SELECT coalesce(jsonb_object_agg(coalesce(road_category,'(null)'), c), '{}'::jsonb)
    FROM (SELECT road_category, count(*) c FROM best_via GROUP BY road_category) t
  ),
  -- THE GATE: where do the two linking methods agree vs disagree?
  'method_comparison', jsonb_build_object(
    'both_methods', (SELECT count(*) FROM both_methods),
    'same_count_point', (SELECT count(*) FROM both_methods WHERE direct_cp = via_cp),
    'different_count_point', (SELECT count(*) FROM both_methods WHERE direct_cp <> via_cp),
    'via_higher_aadf', (SELECT count(*) FROM both_methods WHERE via_aadf > direct_aadf),
    'direct_higher_aadf', (SELECT count(*) FROM both_methods WHERE direct_aadf > via_aadf),
    'median_abs_aadf_diff', (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY abs(via_aadf - direct_aadf)) FROM both_methods WHERE via_aadf IS NOT NULL AND direct_aadf IS NOT NULL)
  ),
  -- Optional occupier signal (kept separate from the reusable dataset).
  'min_aadf', p_min_aadf,
  'qualifying_aadf', (SELECT count(*) FROM best_via WHERE p_min_aadf IS NOT NULL AND aadf >= p_min_aadf)
)
$$;

REVOKE EXECUTE ON FUNCTION public.candidate_traffic_coverage(numeric, numeric, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.candidate_traffic_coverage(numeric, numeric, numeric, text) TO service_role, authenticated;

COMMENT ON FUNCTION public.candidate_traffic_coverage(numeric, numeric, numeric, text) IS 'M4 reporting: authoritative traffic-association coverage + method-comparison (direct vs via_road) for a candidate-site band. Read-only.';

-- =============================================================================
-- debug_site_traffic_map() — GeoJSON FeatureCollection for the M4 debug map: site
-- polygons + their associated roads + all count points within a radius + connector
-- lines from the site to its best-direct and best-via count points, so the DIVERGENCE
-- between the two linking methods can be eyeballed on 20-30 real sites. Read-only.
-- Features carry properties.layer in {'context_road','assoc_road','traffic','link_direct','link_via','site'}.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.debug_site_traffic_map(
  p_site_ids uuid[],
  p_radius_m numeric DEFAULT 400
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
WITH sites AS (
  SELECT cs.id, cs.geom, ST_Centroid(cs.geom) AS centroid, cs.source_reference, cs.area_acres
  FROM public.candidate_sites cs WHERE cs.id = ANY(p_site_ids)
),
v AS (SELECT (p_radius_m / 111320.0) * 2.0 AS deg),
site_features AS (
  SELECT jsonb_build_object(
    'type','Feature', 'geometry', ST_AsGeoJSON(geom, 6)::jsonb,
    'properties', jsonb_build_object(
      'layer','site', 'id', id, 'source_reference', source_reference,
      'area_acres', round(area_acres::numeric, 3))
  ) AS f FROM sites
),
-- The site's associated roads (context for which road via_road used).
assoc_roads AS (
  SELECT DISTINCT rl.geom, r.road_classification, r.road_number, r.name,
         r.is_nearest_overall, r.is_nearest_in_primary_class
  FROM public.candidate_site_roads r
  JOIN sites s ON s.id = r.candidate_site_id
  JOIN public.road_links rl ON rl.id = r.road_link_id
),
assoc_road_features AS (
  SELECT jsonb_build_object(
    'type','Feature', 'geometry', ST_AsGeoJSON(geom, 6)::jsonb,
    'properties', jsonb_build_object(
      'layer','assoc_road',
      'relation', CASE WHEN is_nearest_overall THEN 'nearest_overall'
                       WHEN is_nearest_in_primary_class THEN 'nearest_primary_class'
                       ELSE 'associated' END,
      'road_classification', road_classification, 'road_number', road_number, 'name', name)
  ) AS f FROM assoc_roads
),
context AS (
  SELECT DISTINCT rl.geom, rl.road_classification, rl.road_number, rl.name
  FROM public.road_links rl
  JOIN sites s ON ST_DWithin(rl.geom, s.geom, (SELECT deg FROM v))
  WHERE ST_Distance(rl.geom::geography, s.geom::geography) <= p_radius_m
),
context_features AS (
  SELECT jsonb_build_object(
    'type','Feature', 'geometry', ST_AsGeoJSON(geom, 6)::jsonb,
    'properties', jsonb_build_object(
      'layer','context_road', 'road_classification', road_classification,
      'road_number', road_number, 'name', name)
  ) AS f FROM context
),
-- Count points within radius of any site in the sample, tagged with whether they are the
-- best-direct / best-via pick for a nearby site (join via candidate_site_traffic).
traffic AS (
  SELECT DISTINCT tc.id, tc.geom, tc.count_point_id, tc.year, tc.road_number, tc.road_category,
         tc.road_type, tc.estimation_method, tc.aadf_all_motor_vehicles,
         bool_or(cst.method = 'count_point_direct' AND cst.is_best_for_method) AS is_best_direct,
         bool_or(cst.method = 'via_road' AND cst.is_best_for_method) AS is_best_via
  FROM public.traffic_counts tc
  JOIN sites s ON ST_DWithin(tc.geom, s.geom, (SELECT deg FROM v))
  LEFT JOIN public.candidate_site_traffic cst
    ON cst.traffic_count_id = tc.id AND cst.candidate_site_id IN (SELECT id FROM sites)
  WHERE ST_Distance(tc.geom::geography, s.geom::geography) <= p_radius_m
  GROUP BY tc.id, tc.geom, tc.count_point_id, tc.year, tc.road_number, tc.road_category,
           tc.road_type, tc.estimation_method, tc.aadf_all_motor_vehicles
),
traffic_features AS (
  SELECT jsonb_build_object(
    'type','Feature', 'geometry', ST_AsGeoJSON(geom, 6)::jsonb,
    'properties', jsonb_build_object(
      'layer','traffic', 'count_point_id', count_point_id, 'year', year,
      'road_number', road_number, 'road_category', road_category, 'road_type', road_type,
      'estimation_method', estimation_method, 'aadf_all_motor_vehicles', aadf_all_motor_vehicles,
      'is_best_direct', coalesce(is_best_direct,false), 'is_best_via', coalesce(is_best_via,false))
  ) AS f FROM traffic
),
-- Connector lines site-centroid -> chosen count point, per method, so divergence is visible.
links AS (
  SELECT s.centroid AS site_pt, tc.geom AS cp, cst.method, cst.aadf_all_motor_vehicles,
         cst.site_to_count_m, s.source_reference
  FROM public.candidate_site_traffic cst
  JOIN sites s ON s.id = cst.candidate_site_id
  JOIN public.traffic_counts tc ON tc.id = cst.traffic_count_id
  WHERE cst.is_best_for_method
),
link_features AS (
  SELECT jsonb_build_object(
    'type','Feature',
    'geometry', ST_AsGeoJSON(ST_MakeLine(site_pt, cp), 6)::jsonb,
    'properties', jsonb_build_object(
      'layer', CASE WHEN method = 'count_point_direct' THEN 'link_direct' ELSE 'link_via' END,
      'site_ref', source_reference, 'method', method,
      'aadf_all_motor_vehicles', aadf_all_motor_vehicles,
      'site_to_count_m', round(site_to_count_m::numeric, 1))
  ) AS f FROM links
)
SELECT jsonb_build_object(
  'type','FeatureCollection',
  'features',
    coalesce((SELECT jsonb_agg(f) FROM context_features), '[]'::jsonb) ||
    coalesce((SELECT jsonb_agg(f) FROM assoc_road_features), '[]'::jsonb) ||
    coalesce((SELECT jsonb_agg(f) FROM link_features), '[]'::jsonb) ||
    coalesce((SELECT jsonb_agg(f) FROM traffic_features), '[]'::jsonb) ||
    coalesce((SELECT jsonb_agg(f) FROM site_features), '[]'::jsonb)
)
$$;

REVOKE EXECUTE ON FUNCTION public.debug_site_traffic_map(uuid[], numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.debug_site_traffic_map(uuid[], numeric) TO service_role, authenticated;

COMMENT ON FUNCTION public.debug_site_traffic_map(uuid[], numeric) IS 'M4 debug map: GeoJSON of site polygons + associated roads + count points within a radius + best-direct/best-via connector lines. Read-only.';
