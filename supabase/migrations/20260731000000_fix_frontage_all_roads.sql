-- Migration: fix M6 frontage to measure against ALL associated roads, not just the
-- single nearest-overall link. "Find Sites" M6 follow-up.
--
-- The original associate_candidate_site_geometry() (20260730000000) measured frontage
-- only against the `is_nearest_overall` road. That produced FALSE ZEROS: when the
-- nearest-overall link touches a parcel at a corner or crosses it (distance ~0) but
-- does not run along the boundary, the frontage came out ~0 even though a DIFFERENT
-- associated road — frequently an A/B road a few metres away — runs right along the
-- frontage. Diagnosed on real Canterbury data (e.g. a parcel measured against a 0 m
-- corner link while it fronts the A28 at 4.2 m).
--
-- Fix: frontage_m is now the parcel boundary within the buffer of the UNION of ALL the
-- site's associated roads (the true total road-facing boundary, no double counting at
-- corners), and frontage_road_* is denormalised to the road that CONTRIBUTES THE MOST
-- frontage (not merely the nearest), so the debug map highlights the correct road.
-- primary_frontage_* likewise becomes the best-by-frontage classified (A/B/Motorway)
-- road. `unknown` (no associated road) still stays NULL, never a fabricated zero.
--
-- Also adds debug_candidate_frontage_by_road() — a per-road frontage breakdown for a
-- set of sites, so any plot can be inspected: every associated road, its distance, and
-- how much frontage it individually contributes.

-- =============================================================================
-- associate_candidate_site_geometry() — REPLACED: frontage over all associated roads.
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
  v_deg   numeric := (p_junction_radius_m / 111320.0) * 2.0;
  v_count integer := 0;
BEGIN
  DELETE FROM public.candidate_site_geometry WHERE candidate_site_id = ANY(p_site_ids);

  WITH sites AS (
    SELECT cs.id,
           cs.geom                              AS geom4326,
           ST_Boundary(ST_Transform(cs.geom, 27700)) AS bnd27700
    FROM public.candidate_sites cs
    WHERE cs.id = ANY(p_site_ids)
  ),
  has_road AS (
    SELECT DISTINCT candidate_site_id FROM public.candidate_site_roads
    WHERE candidate_site_id = ANY(p_site_ids)
  ),
  -- Per (site, associated road): the frontage that ONE road contributes.
  assoc AS (
    SELECT r.candidate_site_id AS site_id, r.road_link_id,
           r.road_classification, r.road_number, r.name, r.distance_m,
           GREATEST(0, ST_Length(ST_Intersection(
             s.bnd27700, ST_Buffer(ST_Transform(rl.geom, 27700), p_frontage_buffer_m)
           ))) AS frontage_m
    FROM public.candidate_site_roads r
    JOIN sites s ON s.id = r.candidate_site_id
    JOIN public.road_links rl ON rl.id = r.road_link_id
  ),
  -- Total frontage: boundary within the buffer of the UNION of all associated roads
  -- (correct at corners where two roads' buffers overlap — no double counting).
  total AS (
    SELECT s.id AS site_id,
           GREATEST(0, ST_Length(ST_Intersection(s.bnd27700, u.union_buf))) AS frontage_m
    FROM sites s
    JOIN LATERAL (
      SELECT ST_Union(ST_Buffer(ST_Transform(rl.geom, 27700), p_frontage_buffer_m)) AS union_buf
      FROM public.candidate_site_roads r
      JOIN public.road_links rl ON rl.id = r.road_link_id
      WHERE r.candidate_site_id = s.id
    ) u ON u.union_buf IS NOT NULL
  ),
  -- The road that CONTRIBUTES THE MOST frontage (tie → the nearer one).
  best_road AS (
    SELECT DISTINCT ON (site_id) site_id, road_link_id, road_classification,
           road_number, name, distance_m
    FROM assoc
    ORDER BY site_id, frontage_m DESC, distance_m ASC
  ),
  -- Best-by-frontage classified (A/B/Motorway) road.
  best_primary AS (
    SELECT DISTINCT ON (site_id) site_id, road_link_id, road_classification,
           road_number, name, distance_m, frontage_m
    FROM assoc
    WHERE road_classification IN ('A Road','B Road','Motorway')
    ORDER BY site_id, frontage_m DESC, distance_m ASC
  ),
  nearest_junction AS (
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
  nearest_roundabout AS (
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
    t.frontage_m, br.road_link_id, br.road_classification, br.road_number, br.name, br.distance_m,
    bp.frontage_m, bp.road_link_id, bp.road_classification, bp.road_number, bp.name, bp.distance_m,
    nj.nearest_junction_m, nj.nearest_junction_form, rb.nearest_roundabout_m,
    p_frontage_buffer_m, p_junction_radius_m,
    'union_all_associated_roads_frontage_plus_nearest_significant_node', p_provenance
  FROM sites s
  LEFT JOIN has_road hr           ON hr.candidate_site_id = s.id
  LEFT JOIN total t               ON t.site_id = s.id
  LEFT JOIN best_road br          ON br.site_id = s.id
  LEFT JOIN best_primary bp       ON bp.site_id = s.id
  LEFT JOIN nearest_junction nj   ON nj.site_id = s.id
  LEFT JOIN nearest_roundabout rb ON rb.site_id = s.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.associate_candidate_site_geometry(uuid[], numeric, numeric, text[], text, text, jsonb) IS 'M6 (fixed): frontage = parcel boundary within the buffer of the UNION of ALL associated roads (total road-facing boundary); frontage_road_* = the road contributing the most frontage; primary = best classified road by frontage. Plus nearest junction/roundabout. Idempotent per site; service_role only.';

-- =============================================================================
-- debug_candidate_frontage_by_road() — per-road frontage breakdown for a set of sites.
-- For each site: every associated road, its distance, and how much frontage IT alone
-- contributes at the given buffer — so a "zero frontage" plot can be inspected to see
-- which road actually fronts it and which one was previously (mis)selected. Read-only.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.debug_candidate_frontage_by_road(
  p_site_ids          uuid[],
  p_frontage_buffer_m numeric DEFAULT 12
)
RETURNS TABLE (
  candidate_site_id   uuid,
  source_reference    text,
  road_link_id        uuid,
  road_classification text,
  road_number         text,
  name                text,
  form_of_way         text,
  distance_m          numeric,
  frontage_m          numeric,
  is_nearest_overall  boolean,
  is_nearest_in_primary_class boolean
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT r.candidate_site_id,
         cs.source_reference,
         r.road_link_id,
         r.road_classification,
         r.road_number,
         r.name,
         r.form_of_way,
         round(r.distance_m::numeric, 1) AS distance_m,
         round(GREATEST(0, ST_Length(ST_Intersection(
           ST_Boundary(ST_Transform(cs.geom, 27700)),
           ST_Buffer(ST_Transform(rl.geom, 27700), p_frontage_buffer_m)
         )))::numeric, 1) AS frontage_m,
         r.is_nearest_overall,
         r.is_nearest_in_primary_class
  FROM public.candidate_site_roads r
  JOIN public.candidate_sites cs ON cs.id = r.candidate_site_id
  JOIN public.road_links rl ON rl.id = r.road_link_id
  WHERE r.candidate_site_id = ANY(p_site_ids)
  ORDER BY r.candidate_site_id, frontage_m DESC, r.distance_m ASC
$$;

REVOKE EXECUTE ON FUNCTION public.debug_candidate_frontage_by_road(uuid[], numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.debug_candidate_frontage_by_road(uuid[], numeric) TO service_role, authenticated;

COMMENT ON FUNCTION public.debug_candidate_frontage_by_road(uuid[], numeric) IS 'M6 debug: per-road frontage breakdown for sites (every associated road + the frontage it individually contributes), to inspect false-zero frontage cases. Read-only.';

-- =============================================================================
-- debug_site_geometry_map() — REPLACED: draw the frontage segment as the boundary ∩
-- UNION of all associated road buffers (matching the fixed frontage_m), and draw every
-- associated road (not just nearest-overall + classified) so the fronting road is
-- always visible. properties.layer in {'context_road','node','frontage','frontage_road','site'}.
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
-- Every associated road (highlight the frontage-contributing one + the best classified).
assoc_road_features AS (
  SELECT jsonb_build_object(
    'type','Feature',
    'geometry', ST_AsGeoJSON(rl.geom, 6)::jsonb,
    'properties', jsonb_build_object(
      'layer','frontage_road', 'site_ref', s.source_reference,
      'relation', CASE WHEN rl.id = g.frontage_road_link_id THEN 'frontage'
                       WHEN rl.id = g.primary_frontage_road_link_id THEN 'classified'
                       ELSE 'associated' END,
      'road_classification', rl.road_classification, 'road_number', rl.road_number,
      'name', rl.name, 'distance_m', round(r.distance_m::numeric, 1)
    )
  ) AS f
  FROM public.candidate_site_roads r
  JOIN sites s ON s.id = r.candidate_site_id
  JOIN geo g ON g.candidate_site_id = r.candidate_site_id
  JOIN public.road_links rl ON rl.id = r.road_link_id
),
-- Frontage segment = boundary ∩ union of ALL associated road buffers (matches frontage_m).
frontage_segment_features AS (
  SELECT jsonb_build_object(
    'type','Feature',
    'geometry', ST_AsGeoJSON(ST_Transform(seg, 4326), 6)::jsonb,
    'properties', jsonb_build_object(
      'layer','frontage', 'site_ref', s.source_reference,
      'frontage_m', round(ST_Length(seg)::numeric, 1)
    )
  ) AS f
  FROM sites s
  CROSS JOIN LATERAL (
    SELECT ST_Intersection(
      ST_Boundary(ST_Transform(s.geom, 27700)),
      ST_Union(ST_Buffer(ST_Transform(rl.geom, 27700), p_frontage_buffer_m))
    ) AS seg
    FROM public.candidate_site_roads r
    JOIN public.road_links rl ON rl.id = r.road_link_id
    WHERE r.candidate_site_id = s.id
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
    coalesce((SELECT jsonb_agg(f) FROM assoc_road_features), '[]'::jsonb) ||
    coalesce((SELECT jsonb_agg(f) FROM frontage_segment_features), '[]'::jsonb) ||
    coalesce((SELECT jsonb_agg(f) FROM site_features), '[]'::jsonb)
)
$$;

COMMENT ON FUNCTION public.debug_site_geometry_map(uuid[], numeric, numeric) IS 'M6 debug map (fixed): site polygons + ALL associated roads (frontage road highlighted) + the frontage segment (boundary ∩ union of all road buffers) + junction/roundabout nodes. Read-only.';
