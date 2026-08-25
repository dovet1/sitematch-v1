-- Migration: candidate_site derived geometry (frontage + junction proximity) — "Find Sites" M6.
--
-- M6 adds two DERIVED screening measurements to every candidate site in the
-- enrichment universe (HMLR polygons >= 0.3 ac), on top of the cheap shape
-- diagnostics already computed at M2 (area/perimeter/compactness/bbox/min-rect):
--
--   1. Approximate ROAD FRONTAGE — the length of the parcel boundary that runs
--      alongside its associated road, within a frontage buffer. Measured against BOTH
--      the site's nearest-overall road and its nearest classified (A/B/Motorway) road
--      (from the M3 candidate_site_roads associations), so a parcel that fronts an A
--      road amid minor access roads still records that classified frontage.
--   2. Nearest significant JUNCTION / ROUNDABOUT distance — the distance to the
--      nearest OS RoadNode whose formOfRoadNode is a real junction or roundabout
--      (road ends / pseudo nodes excluded), with the roundabout distance surfaced
--      separately (roundabouts matter for turning-in / visibility screening).
--
-- These are DOCUMENTED APPROXIMATIONS from open centreline data, computed in a metric
-- CRS (British National Grid, 27700). They are SCREENING SIGNALS a human reviews —
-- never a surveyed frontage, an engineering measurement, or a highways/access verdict.
-- The pure interpretation (bands, and the load-bearing unknown != zero rule) lives in
-- apps/web/src/lib/site-matching/geometry-screening.ts (Jest-tested), NOT in SQL.
--
-- Occupier-agnostic, like M3/M4/M5: we enrich the reusable dataset once; occupier
-- frontage/junction criteria apply later at search time. Idempotent per site.

-- =============================================================================
-- candidate_site_geometry — one row per candidate site (derived M6 geometry)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.candidate_site_geometry (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_site_id           uuid NOT NULL REFERENCES public.candidate_sites(id) ON DELETE CASCADE,
  -- Did M3 associate ANY road within its search radius? Distinguishes a *measured*
  -- zero frontage (road nearby, no abutting edge) from an *unknown* one (no road).
  has_associated_road         boolean NOT NULL DEFAULT false,
  -- Frontage onto the site's nearest-OVERALL associated road.
  frontage_m                  numeric,             -- NULL = no road associated (unknown, NOT zero)
  frontage_road_link_id       uuid REFERENCES public.road_links(id) ON DELETE SET NULL,
  frontage_road_classification text,
  frontage_road_number        text,
  frontage_road_name          text,
  frontage_road_distance_m    numeric,             -- polygon edge -> that road centreline (from M3)
  -- Frontage onto the nearest CLASSIFIED (A/B/Motorway) associated road, if any.
  primary_frontage_m          numeric,
  primary_frontage_road_link_id uuid REFERENCES public.road_links(id) ON DELETE SET NULL,
  primary_frontage_road_classification text,
  primary_frontage_road_number text,
  primary_frontage_road_name  text,
  primary_frontage_road_distance_m numeric,
  -- Nearest significant node (junction OR roundabout) and nearest roundabout.
  nearest_junction_m          numeric,             -- NULL = none within radius
  nearest_junction_form       text,                -- OS formOfRoadNode of that node
  nearest_roundabout_m        numeric,             -- NULL = none within radius
  -- Parameters used, so the measurement is reproducible + tunable on the debug map.
  frontage_buffer_m           numeric,
  junction_radius_m           numeric,
  method                      text,
  provenance                  jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_site_id)
);

COMMENT ON TABLE public.candidate_site_geometry IS 'M6 derived geometry per candidate site: approximate road frontage (nearest-overall + nearest classified road) and nearest junction/roundabout distance. Screening signals with provenance; never a surveyed frontage or highways/access claim.';
COMMENT ON COLUMN public.candidate_site_geometry.frontage_m IS 'Approx length (m) of parcel boundary within frontage_buffer_m of its nearest-overall road. NULL = no road associated (unknown); 0 = road nearby but no abutting edge (a real measured zero).';
COMMENT ON COLUMN public.candidate_site_geometry.has_associated_road IS 'True when M3 associated any road within its radius — the flag that keeps unknown frontage (no road) distinct from measured-zero frontage.';

CREATE INDEX IF NOT EXISTS idx_csg_site ON public.candidate_site_geometry (candidate_site_id);
CREATE INDEX IF NOT EXISTS idx_csg_frontage ON public.candidate_site_geometry (frontage_m);
CREATE INDEX IF NOT EXISTS idx_csg_junction ON public.candidate_site_geometry (nearest_junction_m);

DROP TRIGGER IF EXISTS update_candidate_site_geometry_updated_at ON public.candidate_site_geometry;
CREATE TRIGGER update_candidate_site_geometry_updated_at
  BEFORE UPDATE ON public.candidate_site_geometry
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- RLS: public SELECT, admin manage; bulk writes via the service-role RPC below.
-- =============================================================================
ALTER TABLE public.candidate_site_geometry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view candidate site geometry" ON public.candidate_site_geometry;
CREATE POLICY "Public can view candidate site geometry" ON public.candidate_site_geometry
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage candidate site geometry" ON public.candidate_site_geometry;
CREATE POLICY "Admins can manage candidate site geometry" ON public.candidate_site_geometry
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'));

-- =============================================================================
-- associate_candidate_site_geometry() — compute + upsert derived geometry for a
-- batch of candidate sites. Reads the M3 associations (candidate_site_roads) for the
-- frontage roads and road_nodes for junctions. Idempotent per site. service_role only.
--
--   p_frontage_buffer_m: how far from the road centreline a parcel edge counts as
--     "fronting" it. Centrelines sit ~half a carriageway off the kerb, so ~12 m
--     captures frontage onto most roads without swallowing the next parcel. Tunable.
--   p_junction_radius_m: search radius for the nearest significant node.
--   p_significant_forms: OS formOfRoadNode values treated as real junctions.
--   p_road_source: which road network mediates frontage (M3 arm; OS by default).
--   p_node_source:  which node set to measure junctions against (OS by default).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.associate_candidate_site_geometry(
  p_site_ids           uuid[],
  p_frontage_buffer_m  numeric DEFAULT 12,
  p_junction_radius_m  numeric DEFAULT 500,
  p_significant_forms  text[]  DEFAULT ARRAY['junction','roundabout'],
  p_road_source        text    DEFAULT 'os_open_roads',
  p_node_source        text    DEFAULT 'os_open_roads',
  p_provenance         jsonb   DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  -- Generous planar-degree prefilter radius for the indexed ST_DWithin(geom,geom) node
  -- search (the factor covers longitude compression at UK latitudes). Exact geography
  -- distance filters afterwards.
  v_deg   numeric := (p_junction_radius_m / 111320.0) * 2.0;
  v_count integer := 0;
BEGIN
  -- Idempotent: clear existing derived geometry for these sites, then recompute.
  DELETE FROM public.candidate_site_geometry WHERE candidate_site_id = ANY(p_site_ids);

  WITH sites AS (
    SELECT cs.id,
           cs.geom                              AS geom4326,
           ST_Transform(cs.geom, 27700)         AS geom27700,
           ST_Boundary(ST_Transform(cs.geom, 27700)) AS bnd27700
    FROM public.candidate_sites cs
    WHERE cs.id = ANY(p_site_ids)
  ),
  has_road AS (
    SELECT DISTINCT candidate_site_id FROM public.candidate_site_roads
    WHERE candidate_site_id = ANY(p_site_ids)
  ),
  nearest_road AS (  -- the M3 nearest-overall road per site (unique, but DISTINCT ON is safe)
    SELECT DISTINCT ON (r.candidate_site_id)
           r.candidate_site_id AS site_id, r.road_link_id,
           r.road_classification, r.road_number, r.name, r.distance_m
    FROM public.candidate_site_roads r
    WHERE r.candidate_site_id = ANY(p_site_ids) AND r.is_nearest_overall
    ORDER BY r.candidate_site_id, r.distance_m
  ),
  primary_road AS (  -- nearest CLASSIFIED (A/B/Motorway) road per site
    SELECT DISTINCT ON (r.candidate_site_id)
           r.candidate_site_id AS site_id, r.road_link_id,
           r.road_classification, r.road_number, r.name, r.distance_m
    FROM public.candidate_site_roads r
    WHERE r.candidate_site_id = ANY(p_site_ids) AND r.is_nearest_in_primary_class
    ORDER BY r.candidate_site_id, r.distance_m
  ),
  frontage AS (  -- boundary length within the buffer of the nearest-overall road (BNG metres)
    SELECT s.id AS site_id,
           GREATEST(0, ST_Length(ST_Intersection(
             s.bnd27700,
             ST_Buffer(ST_Transform(rl.geom, 27700), p_frontage_buffer_m)
           ))) AS frontage_m
    FROM sites s
    JOIN nearest_road nr ON nr.site_id = s.id
    JOIN public.road_links rl ON rl.id = nr.road_link_id
  ),
  primary_frontage AS (
    SELECT s.id AS site_id,
           GREATEST(0, ST_Length(ST_Intersection(
             s.bnd27700,
             ST_Buffer(ST_Transform(rl.geom, 27700), p_frontage_buffer_m)
           ))) AS primary_frontage_m
    FROM sites s
    JOIN primary_road pr ON pr.site_id = s.id
    JOIN public.road_links rl ON rl.id = pr.road_link_id
  ),
  nearest_junction AS (  -- nearest significant node (junction OR roundabout)
    SELECT s.id AS site_id, n.dist AS nearest_junction_m, n.form AS nearest_junction_form
    FROM sites s
    LEFT JOIN LATERAL (
      SELECT ST_Distance(s.geom4326::geography, rn.geom::geography) AS dist,
             rn.form_of_road_node AS form
      FROM public.road_nodes rn
      WHERE rn.source = p_node_source
        AND rn.form_of_road_node = ANY(p_significant_forms)
        AND ST_DWithin(rn.geom, s.geom4326, v_deg)
        AND ST_Distance(rn.geom::geography, s.geom4326::geography) <= p_junction_radius_m
      ORDER BY ST_Distance(rn.geom::geography, s.geom4326::geography)
      LIMIT 1
    ) n ON true
  ),
  nearest_roundabout AS (  -- nearest roundabout node specifically
    SELECT s.id AS site_id, n.dist AS nearest_roundabout_m
    FROM sites s
    LEFT JOIN LATERAL (
      SELECT ST_Distance(s.geom4326::geography, rn.geom::geography) AS dist
      FROM public.road_nodes rn
      WHERE rn.source = p_node_source
        AND rn.form_of_road_node = 'roundabout'
        AND ST_DWithin(rn.geom, s.geom4326, v_deg)
        AND ST_Distance(rn.geom::geography, s.geom4326::geography) <= p_junction_radius_m
      ORDER BY ST_Distance(rn.geom::geography, s.geom4326::geography)
      LIMIT 1
    ) n ON true
  )
  INSERT INTO public.candidate_site_geometry (
    candidate_site_id, has_associated_road,
    frontage_m, frontage_road_link_id, frontage_road_classification, frontage_road_number,
    frontage_road_name, frontage_road_distance_m,
    primary_frontage_m, primary_frontage_road_link_id, primary_frontage_road_classification,
    primary_frontage_road_number, primary_frontage_road_name, primary_frontage_road_distance_m,
    nearest_junction_m, nearest_junction_form, nearest_roundabout_m,
    frontage_buffer_m, junction_radius_m, method, provenance
  )
  SELECT
    s.id,
    (hr.candidate_site_id IS NOT NULL),
    f.frontage_m, nr.road_link_id, nr.road_classification, nr.road_number, nr.name, nr.distance_m,
    pf.primary_frontage_m, pr.road_link_id, pr.road_classification, pr.road_number, pr.name, pr.distance_m,
    nj.nearest_junction_m, nj.nearest_junction_form, rb.nearest_roundabout_m,
    p_frontage_buffer_m, p_junction_radius_m,
    'buffer_boundary_frontage_plus_nearest_significant_node', p_provenance
  FROM sites s
  LEFT JOIN has_road hr          ON hr.candidate_site_id = s.id
  LEFT JOIN nearest_road nr      ON nr.site_id = s.id
  LEFT JOIN primary_road pr      ON pr.site_id = s.id
  LEFT JOIN frontage f           ON f.site_id = s.id
  LEFT JOIN primary_frontage pf  ON pf.site_id = s.id
  LEFT JOIN nearest_junction nj  ON nj.site_id = s.id
  LEFT JOIN nearest_roundabout rb ON rb.site_id = s.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.associate_candidate_site_geometry(uuid[], numeric, numeric, text[], text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.associate_candidate_site_geometry(uuid[], numeric, numeric, text[], text, text, jsonb) TO service_role;

COMMENT ON FUNCTION public.associate_candidate_site_geometry(uuid[], numeric, numeric, text[], text, text, jsonb) IS 'M6: compute + upsert approximate road frontage (nearest-overall + nearest classified road, from M3 associations) and nearest junction/roundabout distance for a batch of candidate sites. Idempotent per site; service_role only.';

-- =============================================================================
-- candidate_geometry_coverage() — authoritative coverage/funnel numbers for a site
-- band. Called once for the whole universe and once for the drive-thru subset (the
-- two funnels are reported SEPARATELY). Read-only.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.candidate_geometry_coverage(
  p_min_acres    numeric DEFAULT 0.3,
  p_max_acres    numeric DEFAULT NULL,
  p_frontage_min_m numeric DEFAULT 20,
  p_junction_max_m numeric DEFAULT 100,
  p_site_source  text    DEFAULT 'hmlr_inspire'
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
g AS (
  SELECT csg.*
  FROM public.candidate_site_geometry csg
  JOIN universe u ON u.id = csg.candidate_site_id
),
measured AS (  -- frontage was actually measured (a road was associated)
  SELECT * FROM g WHERE has_associated_road AND frontage_m IS NOT NULL
)
SELECT jsonb_build_object(
  'site_source', p_site_source,
  'min_acres', p_min_acres,
  'max_acres', p_max_acres,
  'frontage_min_m', p_frontage_min_m,
  'junction_max_m', p_junction_max_m,
  'universe', (SELECT count(*) FROM universe),
  'enriched', (SELECT count(*) FROM g),
  -- Frontage: unknown (no road) vs measured; of measured, the none/positive split.
  'frontage_unknown', (SELECT count(*) FROM g WHERE NOT has_associated_road OR frontage_m IS NULL),
  'frontage_measured', (SELECT count(*) FROM measured),
  'frontage_none', (SELECT count(*) FROM measured WHERE frontage_m <= 1),
  'frontage_ge_min', (SELECT count(*) FROM measured WHERE frontage_m >= p_frontage_min_m),
  'frontage_p50', (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY frontage_m) FROM measured WHERE frontage_m > 1),
  'frontage_p90', (SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY frontage_m) FROM measured WHERE frontage_m > 1),
  'frontage_bands', (
    SELECT jsonb_build_object(
      'none_le_1m',  count(*) FILTER (WHERE frontage_m <= 1),
      'narrow_lt_10m', count(*) FILTER (WHERE frontage_m > 1 AND frontage_m < 10),
      'moderate_10_40m', count(*) FILTER (WHERE frontage_m >= 10 AND frontage_m < 40),
      'wide_ge_40m', count(*) FILTER (WHERE frontage_m >= 40)
    ) FROM measured
  ),
  'primary_frontage_measured', (SELECT count(*) FROM g WHERE primary_frontage_m IS NOT NULL),
  'primary_frontage_ge_min', (SELECT count(*) FROM g WHERE primary_frontage_m >= p_frontage_min_m),
  -- Junction proximity.
  'with_junction', (SELECT count(*) FROM g WHERE nearest_junction_m IS NOT NULL),
  'junction_within_max', (SELECT count(*) FROM g WHERE nearest_junction_m <= p_junction_max_m),
  'junction_p50', (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY nearest_junction_m) FROM g WHERE nearest_junction_m IS NOT NULL),
  'junction_p90', (SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY nearest_junction_m) FROM g WHERE nearest_junction_m IS NOT NULL),
  'junction_bands', (
    SELECT jsonb_build_object(
      'at_le_25m', count(*) FILTER (WHERE nearest_junction_m <= 25),
      'near_le_100m', count(*) FILTER (WHERE nearest_junction_m > 25 AND nearest_junction_m <= 100),
      'moderate_le_300m', count(*) FILTER (WHERE nearest_junction_m > 100 AND nearest_junction_m <= 300),
      'far_gt_300m', count(*) FILTER (WHERE nearest_junction_m > 300)
    ) FROM g WHERE nearest_junction_m IS NOT NULL
  ),
  'with_roundabout', (SELECT count(*) FROM g WHERE nearest_roundabout_m IS NOT NULL)
)
$$;

REVOKE EXECUTE ON FUNCTION public.candidate_geometry_coverage(numeric, numeric, numeric, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.candidate_geometry_coverage(numeric, numeric, numeric, numeric, text) TO service_role, authenticated;

COMMENT ON FUNCTION public.candidate_geometry_coverage(numeric, numeric, numeric, numeric, text) IS 'M6 reporting: authoritative derived-geometry coverage (frontage + junction proximity) for a candidate-site area band. Read-only.';

-- =============================================================================
-- debug_site_geometry_map() — GeoJSON FeatureCollection for the M6 debug map: site
-- polygons + their frontage road(s) + the computed frontage SEGMENT geometry (so the
-- measured edge is visible) + nearest junction/roundabout node + context roads/nodes.
-- Lets a geographically varied sample be eyeballed: is the frontage measured against
-- the edge the parcel actually presents to the road? Read-only.
-- properties.layer in {'context_road','node','frontage','frontage_road','site'}.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.debug_site_geometry_map(
  p_site_ids          uuid[],
  p_radius_m          numeric DEFAULT 250,
  p_frontage_buffer_m numeric DEFAULT 12
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
geo AS (SELECT * FROM public.candidate_site_geometry WHERE candidate_site_id = ANY(p_site_ids)),
site_features AS (
  SELECT jsonb_build_object(
    'type','Feature',
    'geometry', ST_AsGeoJSON(s.geom, 6)::jsonb,
    'properties', jsonb_build_object(
      'layer','site', 'id', s.id, 'source_reference', s.source_reference,
      'area_acres', round(s.area_acres::numeric, 3),
      'compactness', round(s.compactness::numeric, 2),
      'current_land_use', s.current_land_use,
      'frontage_m', round(g.frontage_m::numeric, 1),
      'primary_frontage_m', round(g.primary_frontage_m::numeric, 1),
      'frontage_road', coalesce(g.frontage_road_number, g.frontage_road_classification),
      'nearest_junction_m', round(g.nearest_junction_m::numeric, 1),
      'nearest_junction_form', g.nearest_junction_form,
      'nearest_roundabout_m', round(g.nearest_roundabout_m::numeric, 1),
      'has_associated_road', g.has_associated_road
    )
  ) AS f FROM sites s LEFT JOIN geo g ON g.candidate_site_id = s.id
),
-- The frontage roads (nearest-overall = red, nearest classified = amber).
frontage_road_features AS (
  SELECT jsonb_build_object(
    'type','Feature',
    'geometry', ST_AsGeoJSON(rl.geom, 6)::jsonb,
    'properties', jsonb_build_object(
      'layer','frontage_road', 'site_ref', s.source_reference,
      'relation', rel.relation,
      'road_classification', rl.road_classification, 'road_number', rl.road_number,
      'name', rl.name, 'frontage_m', round(rel.frontage_m::numeric, 1)
    )
  ) AS f
  FROM geo g
  JOIN sites s ON s.id = g.candidate_site_id
  CROSS JOIN LATERAL (
    VALUES ('nearest_overall', g.frontage_road_link_id, g.frontage_m),
           ('nearest_classified', g.primary_frontage_road_link_id, g.primary_frontage_m)
  ) AS rel(relation, link_id, frontage_m)
  JOIN public.road_links rl ON rl.id = rel.link_id
),
-- The measured frontage SEGMENT (parcel boundary ∩ road buffer), in 4326 for display.
frontage_segment_features AS (
  SELECT jsonb_build_object(
    'type','Feature',
    'geometry', ST_AsGeoJSON(ST_Transform(seg, 4326), 6)::jsonb,
    'properties', jsonb_build_object(
      'layer','frontage', 'site_ref', s.source_reference,
      'frontage_m', round(ST_Length(seg)::numeric, 1)
    )
  ) AS f
  FROM geo g
  JOIN sites s ON s.id = g.candidate_site_id
  JOIN public.road_links rl ON rl.id = g.frontage_road_link_id
  CROSS JOIN LATERAL (
    SELECT ST_Intersection(
      ST_Boundary(ST_Transform(s.geom, 27700)),
      ST_Buffer(ST_Transform(rl.geom, 27700), p_frontage_buffer_m)
    ) AS seg
  ) x
  WHERE seg IS NOT NULL AND NOT ST_IsEmpty(seg) AND ST_Length(seg) > 0
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
    coalesce((SELECT jsonb_agg(f) FROM frontage_road_features), '[]'::jsonb) ||
    coalesce((SELECT jsonb_agg(f) FROM frontage_segment_features), '[]'::jsonb) ||
    coalesce((SELECT jsonb_agg(f) FROM site_features), '[]'::jsonb)
)
$$;

REVOKE EXECUTE ON FUNCTION public.debug_site_geometry_map(uuid[], numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.debug_site_geometry_map(uuid[], numeric, numeric) TO service_role, authenticated;

COMMENT ON FUNCTION public.debug_site_geometry_map(uuid[], numeric, numeric) IS 'M6 debug map: GeoJSON of site polygons + their frontage road(s) + the measured frontage segment + junction/roundabout nodes + context roads. Read-only.';
