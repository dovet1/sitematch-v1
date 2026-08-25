-- Migration: candidate_site -> road association for "Find Sites" M3.
--
-- This is the M3 ENRICHMENT step: associate every candidate site in the enrichment
-- universe (HMLR polygons >= 0.3 ac, 8,226 for Canterbury) with its relevant road
-- link(s) from the road network, storing distance + class + number + form-of-way +
-- provenance. It is deliberately OCCUPIER-AGNOSTIC: we enrich the reusable dataset
-- once and never bake occupier area/road criteria (e.g. a drive-thru's A/B-road
-- preference) into it. The occupier search funnel applies those later, at search time.
--
-- Design against REAL road geometry (per the M3 gate) rather than a naive single
-- nearest road:
--   * Distance is measured POLYGON-EDGE to road CENTRELINE in metres (geography), so a
--     road crossing/touching a parcel is distance 0 and a nearby frontage road is its
--     true perpendicular-ish distance.
--   * We keep the TOP-K nearest links overall (K configurable) so parallel roads, dual
--     carriageways (two carriageway centrelines) and roundabout links are all visible
--     for inspection and for the engine's "nearest per relevant class" bundle.
--   * We ADDITIONALLY guarantee the nearest link of each PRIMARY class (A/B/Motorway)
--     is retained even if it falls outside top-K, so a site that fronts an A road but
--     sits amid many minor access roads still records that A road. This is the honest
--     way to handle "which road does this site actually relate to?" without asserting a
--     single answer — the debug map is used to judge it visually.
--
-- Two reporting RPCs are included (authoritative SQL counts, not paged pulls — the M2
-- lesson): candidate_road_coverage() for the coverage/funnel numbers, and
-- debug_site_road_map() to feed the debug map. NOTHING here claims a site is suitable
-- or has adequate access; distance/class are screening signals with full provenance.

-- =============================================================================
-- candidate_site_roads — one row per (candidate_site, relevant road_link)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.candidate_site_roads (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_site_id         uuid NOT NULL REFERENCES public.candidate_sites(id) ON DELETE CASCADE,
  road_link_id              uuid NOT NULL REFERENCES public.road_links(id) ON DELETE CASCADE,
  distance_m                numeric NOT NULL,   -- polygon edge -> road centreline, geography metres (0 = touches/crosses)
  -- Denormalised road attributes (snapshot at association time) so the matching
  -- engine + debug map + provenance do not need a join and survive road re-imports.
  road_classification       text,
  road_number               text,
  name                      text,
  form_of_way               text,
  primary_route             boolean,
  trunk_road                boolean,
  nearest_rank              integer,            -- 1 = nearest overall for this site (by distance)
  is_nearest_overall        boolean NOT NULL DEFAULT false,
  is_nearest_in_primary_class boolean NOT NULL DEFAULT false, -- nearest A/B/Motorway link for this site
  method                    text,               -- association method label
  max_distance_m            numeric,            -- search radius used
  provenance                jsonb NOT NULL DEFAULT '{}'::jsonb, -- {method, road_source, road_dataset_version, computed_at}
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_site_id, road_link_id)
);

COMMENT ON TABLE public.candidate_site_roads IS 'M3 enrichment: candidate_site -> relevant road_link associations (top-K nearest + nearest per primary class). Occupier-agnostic screening data with provenance; never a suitability/access claim.';
COMMENT ON COLUMN public.candidate_site_roads.distance_m IS 'Minimum distance polygon edge -> road centreline in metres (geography). 0 = road touches/crosses the parcel.';
COMMENT ON COLUMN public.candidate_site_roads.is_nearest_in_primary_class IS 'True for the nearest A Road / B Road / Motorway link for this site (retained even if beyond top-K), so frontage onto a classified road is never lost amid minor access roads.';

CREATE INDEX IF NOT EXISTS idx_csr_site ON public.candidate_site_roads (candidate_site_id);
CREATE INDEX IF NOT EXISTS idx_csr_road ON public.candidate_site_roads (road_link_id);
CREATE INDEX IF NOT EXISTS idx_csr_classification ON public.candidate_site_roads (road_classification);
CREATE INDEX IF NOT EXISTS idx_csr_nearest_overall ON public.candidate_site_roads (candidate_site_id) WHERE is_nearest_overall;
CREATE INDEX IF NOT EXISTS idx_csr_nearest_primary ON public.candidate_site_roads (candidate_site_id) WHERE is_nearest_in_primary_class;

DROP TRIGGER IF EXISTS update_candidate_site_roads_updated_at ON public.candidate_site_roads;
CREATE TRIGGER update_candidate_site_roads_updated_at
  BEFORE UPDATE ON public.candidate_site_roads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- RLS: public SELECT, admin manage; bulk writes via the service-role RPC below.
-- =============================================================================
ALTER TABLE public.candidate_site_roads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view candidate site roads" ON public.candidate_site_roads;
CREATE POLICY "Public can view candidate site roads" ON public.candidate_site_roads
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage candidate site roads" ON public.candidate_site_roads;
CREATE POLICY "Admins can manage candidate site roads" ON public.candidate_site_roads
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'));

-- =============================================================================
-- associate_candidate_site_roads() — compute + upsert associations for a batch of
-- candidate sites (the caller batches over the universe). Idempotent per site.
-- service_role only.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.associate_candidate_site_roads(
  p_site_ids       uuid[],
  p_max_distance_m numeric DEFAULT 200,
  p_top_k          integer DEFAULT 8,
  p_road_source    text    DEFAULT 'os_open_roads',
  p_provenance     jsonb   DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  -- Generous planar-degree prefilter radius (indexed ST_DWithin(geom,geom)); the
  -- factor covers longitude compression at UK latitudes so the box never clips a road
  -- within p_max_distance_m E-W. The exact geography distance filters afterwards.
  v_deg   numeric := (p_max_distance_m / 111320.0) * 2.0;
  v_count integer := 0;
BEGIN
  -- Idempotent: clear existing associations for these sites, then recompute.
  DELETE FROM public.candidate_site_roads WHERE candidate_site_id = ANY(p_site_ids);

  WITH sites AS (
    SELECT id, geom FROM public.candidate_sites WHERE id = ANY(p_site_ids)
  ),
  cand AS (
    SELECT s.id AS site_id,
           rl.id AS road_link_id,
           rl.road_classification,
           rl.road_number,
           rl.name,
           rl.form_of_way,
           rl.primary_route,
           rl.trunk_road,
           ST_Distance(s.geom::geography, rl.geom::geography) AS distance_m
    FROM sites s
    JOIN public.road_links rl
      ON rl.source = p_road_source
     AND ST_DWithin(rl.geom, s.geom, v_deg)
  ),
  within AS (
    SELECT * FROM cand WHERE distance_m <= p_max_distance_m
  ),
  ranked AS (
    SELECT *,
           row_number() OVER (PARTITION BY site_id ORDER BY distance_m, road_link_id) AS rnk,
           row_number() OVER (PARTITION BY site_id, road_classification ORDER BY distance_m, road_link_id) AS class_rnk
    FROM within
  ),
  chosen AS (
    SELECT *,
           (class_rnk = 1 AND road_classification IN ('A Road','B Road','Motorway')) AS is_primary_nearest
    FROM ranked
    WHERE rnk <= p_top_k
       OR (class_rnk = 1 AND road_classification IN ('A Road','B Road','Motorway'))
  )
  INSERT INTO public.candidate_site_roads (
    candidate_site_id, road_link_id, distance_m, road_classification, road_number,
    name, form_of_way, primary_route, trunk_road, nearest_rank,
    is_nearest_overall, is_nearest_in_primary_class, method, max_distance_m, provenance
  )
  SELECT site_id, road_link_id, distance_m, road_classification, road_number,
         name, form_of_way, primary_route, trunk_road, rnk,
         (rnk = 1), is_primary_nearest,
         'nearest_topk_plus_primary_class_within_radius', p_max_distance_m, p_provenance
  FROM chosen;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.associate_candidate_site_roads(uuid[], numeric, integer, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.associate_candidate_site_roads(uuid[], numeric, integer, text, jsonb) TO service_role;

COMMENT ON FUNCTION public.associate_candidate_site_roads(uuid[], numeric, integer, text, jsonb) IS 'M3: associate a batch of candidate sites with their relevant road links (top-K nearest + nearest per primary class within radius). Idempotent per site; service_role only.';

-- =============================================================================
-- candidate_road_coverage() — authoritative coverage/funnel numbers for a site band.
-- Called once for the whole enrichment universe and once for the drive-thru subset
-- (the two funnels are reported SEPARATELY). Read-only.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.candidate_road_coverage(
  p_min_acres            numeric DEFAULT 0.3,
  p_max_acres            numeric DEFAULT NULL,
  p_qualifying_distance_m numeric DEFAULT 100,
  p_site_source          text    DEFAULT 'hmlr_inspire'
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
nearest AS (  -- the single nearest-overall road per site (what a naive proximity pick sees)
  SELECT r.candidate_site_id, coalesce(r.road_classification, '(unclassified)') AS road_classification, r.distance_m
  FROM public.candidate_site_roads r
  JOIN universe u ON u.id = r.candidate_site_id
  WHERE r.is_nearest_overall
),
any_road AS (
  SELECT DISTINCT r.candidate_site_id
  FROM public.candidate_site_roads r
  JOIN universe u ON u.id = r.candidate_site_id
),
ab AS (  -- sites with an A/B road within the qualifying distance (occupier funnel signal)
  SELECT DISTINCT r.candidate_site_id
  FROM public.candidate_site_roads r
  JOIN universe u ON u.id = r.candidate_site_id
  WHERE r.is_nearest_in_primary_class
    AND r.road_classification IN ('A Road','B Road')
    AND r.distance_m <= p_qualifying_distance_m
)
SELECT jsonb_build_object(
  'site_source', p_site_source,
  'min_acres', p_min_acres,
  'max_acres', p_max_acres,
  'qualifying_distance_m', p_qualifying_distance_m,
  'universe', (SELECT count(*) FROM universe),
  'with_any_road', (SELECT count(*) FROM any_road),
  'without_any_road', (SELECT count(*) FROM universe) - (SELECT count(*) FROM any_road),
  'nearest_distance_p50', (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY distance_m) FROM nearest),
  'nearest_distance_p90', (SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY distance_m) FROM nearest),
  'best_class_counts', (
    SELECT coalesce(jsonb_object_agg(road_classification, c), '{}'::jsonb)
    FROM (SELECT road_classification, count(*) AS c FROM nearest GROUP BY road_classification) t
  ),
  'nearest_within_bands', (
    SELECT jsonb_build_object(
      'le_10m',  count(*) FILTER (WHERE distance_m <= 10),
      'le_30m',  count(*) FILTER (WHERE distance_m <= 30),
      'le_50m',  count(*) FILTER (WHERE distance_m <= 50),
      'le_100m', count(*) FILTER (WHERE distance_m <= 100),
      'le_200m', count(*) FILTER (WHERE distance_m <= 200)
    ) FROM nearest
  ),
  'qualifying_ab_within', (SELECT count(*) FROM ab)
)
$$;

REVOKE EXECUTE ON FUNCTION public.candidate_road_coverage(numeric, numeric, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.candidate_road_coverage(numeric, numeric, numeric, text) TO service_role, authenticated;

COMMENT ON FUNCTION public.candidate_road_coverage(numeric, numeric, numeric, text) IS 'M3 reporting: authoritative road-association coverage for a candidate-site area band. Read-only.';

-- =============================================================================
-- debug_site_road_map() — GeoJSON FeatureCollection for the M3 debug map: site
-- polygons + their stored associations + all context roads/nodes within a radius,
-- so a geographically varied sample can be eyeballed for systematic association
-- errors (parallel roads, dual carriageways, roundabouts, shared numbers). Read-only.
-- Features carry properties.layer in {'context_road','node','association','site'}.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.debug_site_road_map(
  p_site_ids uuid[],
  p_radius_m numeric DEFAULT 250
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
WITH sites AS (
  SELECT cs.id, cs.geom, cs.source_reference, cs.area_acres, cs.compactness, cs.current_land_use
  FROM public.candidate_sites cs WHERE cs.id = ANY(p_site_ids)
),
v AS (SELECT (p_radius_m / 111320.0) * 2.0 AS deg),
site_features AS (
  SELECT jsonb_build_object(
    'type','Feature',
    'geometry', ST_AsGeoJSON(geom, 6)::jsonb,
    'properties', jsonb_build_object(
      'layer','site', 'id', id, 'source_reference', source_reference,
      'area_acres', round(area_acres::numeric, 3),
      'compactness', round(compactness::numeric, 2),
      'current_land_use', current_land_use
    )
  ) AS f FROM sites
),
assoc AS (
  SELECT r.is_nearest_overall, r.is_nearest_in_primary_class, r.distance_m,
         r.road_classification, r.road_number, r.name, r.form_of_way,
         s.source_reference AS site_ref, rl.geom AS road_geom
  FROM public.candidate_site_roads r
  JOIN sites s ON s.id = r.candidate_site_id
  JOIN public.road_links rl ON rl.id = r.road_link_id
),
assoc_features AS (
  SELECT jsonb_build_object(
    'type','Feature',
    'geometry', ST_AsGeoJSON(road_geom, 6)::jsonb,
    'properties', jsonb_build_object(
      'layer','association', 'site_ref', site_ref,
      'relation', CASE WHEN is_nearest_overall THEN 'nearest_overall'
                       WHEN is_nearest_in_primary_class THEN 'nearest_primary_class'
                       ELSE 'associated' END,
      'distance_m', round(distance_m::numeric, 1),
      'road_classification', road_classification, 'road_number', road_number,
      'name', name, 'form_of_way', form_of_way
    )
  ) AS f FROM assoc
),
context AS (
  SELECT DISTINCT rl.id, rl.geom, rl.road_classification, rl.road_number, rl.name, rl.form_of_way
  FROM public.road_links rl
  JOIN sites s ON ST_DWithin(rl.geom, s.geom, (SELECT deg FROM v))
  WHERE ST_Distance(rl.geom::geography, s.geom::geography) <= p_radius_m
),
context_features AS (
  SELECT jsonb_build_object(
    'type','Feature',
    'geometry', ST_AsGeoJSON(geom, 6)::jsonb,
    'properties', jsonb_build_object(
      'layer','context_road', 'road_classification', road_classification,
      'road_number', road_number, 'name', name, 'form_of_way', form_of_way
    )
  ) AS f FROM context
),
nodes AS (
  SELECT DISTINCT rn.id, rn.geom, rn.form_of_road_node
  FROM public.road_nodes rn
  JOIN sites s ON ST_DWithin(rn.geom, s.geom, (SELECT deg FROM v))
  WHERE ST_Distance(rn.geom::geography, s.geom::geography) <= p_radius_m
),
node_features AS (
  SELECT jsonb_build_object(
    'type','Feature',
    'geometry', ST_AsGeoJSON(geom, 6)::jsonb,
    'properties', jsonb_build_object('layer','node', 'form_of_road_node', form_of_road_node)
  ) AS f FROM nodes
)
SELECT jsonb_build_object(
  'type','FeatureCollection',
  'features',
    coalesce((SELECT jsonb_agg(f) FROM context_features), '[]'::jsonb) ||
    coalesce((SELECT jsonb_agg(f) FROM node_features), '[]'::jsonb) ||
    coalesce((SELECT jsonb_agg(f) FROM assoc_features), '[]'::jsonb) ||
    coalesce((SELECT jsonb_agg(f) FROM site_features), '[]'::jsonb)
)
$$;

REVOKE EXECUTE ON FUNCTION public.debug_site_road_map(uuid[], numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.debug_site_road_map(uuid[], numeric) TO service_role, authenticated;

COMMENT ON FUNCTION public.debug_site_road_map(uuid[], numeric) IS 'M3 debug map: GeoJSON of site polygons + their road associations + context roads/nodes within a radius. Read-only.';

-- =============================================================================
-- universe_site_centroids() — lightweight id + centroid lon/lat for a candidate-site
-- band, so the debug-map export can pick a GEOGRAPHICALLY VARIED sample (grid spread)
-- rather than a clustered random draw. Read-only.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.universe_site_centroids(
  p_site_source text    DEFAULT 'hmlr_inspire',
  p_min_acres   numeric DEFAULT 0.3,
  p_max_acres   numeric DEFAULT NULL
)
RETURNS TABLE (id uuid, lon double precision, lat double precision, area_acres numeric)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT cs.id,
         ST_X(cs.centroid::geometry) AS lon,
         ST_Y(cs.centroid::geometry) AS lat,
         cs.area_acres
  FROM public.candidate_sites cs
  WHERE cs.source = p_site_source
    AND cs.area_acres >= p_min_acres
    AND (p_max_acres IS NULL OR cs.area_acres < p_max_acres)
$$;

REVOKE EXECUTE ON FUNCTION public.universe_site_centroids(text, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.universe_site_centroids(text, numeric, numeric) TO service_role, authenticated;

COMMENT ON FUNCTION public.universe_site_centroids(text, numeric, numeric) IS 'M3: id + centroid lon/lat for a candidate-site area band, for geographically-varied debug sampling. Read-only.';
