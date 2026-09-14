-- Replace planning_tab_applications_v3 with a version that avoids per-row geodesic distance for
-- most candidates. v2 remains the tab's read until v3 is measured, so this changes nothing live.
--
-- EXPLAIN (ANALYZE, BUFFERS) on the 14 x 12 km Wandsworth box, 14 Sep 2026: the geography index
-- returned 30,949 candidates in 1.1 s, then two spheroid ST_DWithin calls per candidate (the
-- constant 1,500 m bound is re-evaluated as a filter, then the per-row allowance) took ~6 s.
-- Relevance joins took ~0.3 s and the top-N sort under 0.1 s.
--
-- v3 now:
--   1. finds candidates through a planar box on a geometry index, expanded by 1,500 m converted
--      to degrees at the boundary's highest latitude, with a 2% margin so it never under-covers;
--   2. admits a point inside the drawn polygon with a cheap planar test, whatever its provenance;
--   3. runs a distance test only for points outside the polygon with a positive allowance,
--      on the sphere rather than the spheroid (under 0.5% difference, ~7 m at 1,500 m).
--
-- Deliberate difference from v2: "inside" is now the planar test for inclusion as well as for
-- inside_boundary. v2 included exact points by a geodesic test but flagged them with a planar
-- one, so a point a few metres from a long edge could be included yet flagged outside. Only
-- points within metres of the drawn line can change.
--
-- The index build takes a SHARE lock that briefly holds ingestion writes; workers retry later.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '10min';

CREATE INDEX IF NOT EXISTS planning_applications_location_geom_idx
  ON public.planning_applications USING gist ((location::geometry))
  WHERE location IS NOT NULL;

CREATE OR REPLACE FUNCTION public.planning_tab_applications_v3(
  p_boundary jsonb,
  p_limit integer DEFAULT 2000
)
RETURNS TABLE (
  sort_rank               bigint,
  id                      uuid,
  provider_id             text,
  authority_name          text,
  reference               text,
  address                 text,
  status                  text,
  stage                   text,
  planning_route          text,
  procedure               text,
  commercial_work         text,
  stated_floorspace_sqm   numeric,
  description             text,
  links                   jsonb,
  longitude               double precision,
  latitude                double precision,
  location_provenance     text,
  location_uncertainty_m  double precision,
  inside_boundary         boolean,
  date_received           date,
  date_decided            date,
  date_validated          date,
  stated_dwelling_count   integer,
  intelligence_tier       boolean,
  development_id          uuid,
  relevance               text,
  summary                 text,
  model_dwelling_count    integer,
  creates_commercial_space text,
  model_dwelling_basis text
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH boundary AS (
    SELECT
      g.geom,
      g.geom::geography AS geog,
      -- The largest supported allowance (currently 1,500 m), as degrees. Longitude degrees
      -- shrink towards the poles, so convert at the boundary's highest absolute latitude.
      ST_Expand(
        g.geom,
        1.02 * m.max_allowance / (111320 * cos(radians(LEAST(89, GREATEST(abs(ST_YMin(g.geom)), abs(ST_YMax(g.geom))))))),
        1.02 * m.max_allowance / 110574
      ) AS search_box
    FROM (SELECT ST_SetSRID(ST_GeomFromGeoJSON(p_boundary::text), 4326) AS geom) g
    CROSS JOIN (
      SELECT GREATEST(
        public.planning_location_uncertainty_m('source_exact'),
        public.planning_location_uncertainty_m('source_centroid'),
        public.planning_location_uncertainty_m('postcode_centroid'),
        public.planning_location_uncertainty_m('missing')
      ) AS max_allowance
    ) m
  ),
  candidates AS (
    SELECT
      a.id,
      a.date_received,
      ST_Intersects(a.location::geometry, b.geom) AS inside,
      public.planning_location_uncertainty_m(a.location_provenance) AS allowance,
      a.location
    FROM public.planning_applications a
    CROSS JOIN boundary b
    WHERE a.location IS NOT NULL
      AND a.location::geometry && b.search_box
  ),
  kept AS (
    SELECT
      c.id,
      c.date_received,
      c.inside,
      c.allowance,
      da.development_id,
      CASE d.relevance
        WHEN 'high'   THEN 0
        WHEN 'medium' THEN 1
        WHEN 'low'    THEN 2
        ELSE 3
      END AS band
    FROM candidates c
    CROSS JOIN boundary b
    LEFT JOIN public.development_applications da ON da.planning_application_id = c.id
    LEFT JOIN public.developments d ON d.id = da.development_id AND d.review_state <> 'rejected'
    WHERE c.inside
      OR (c.allowance > 0 AND ST_DWithin(c.location, b.geog, c.allowance, false))
    -- Identical ordering to v2: band, newest first, id last for a total order.
    ORDER BY band, c.date_received DESC NULLS LAST, c.id
    LIMIT GREATEST(COALESCE(p_limit, 2000), 1)
  )
  SELECT
    row_number() OVER (ORDER BY k.band, k.date_received DESC NULLS LAST, k.id) AS sort_rank,
    a.id,
    a.provider_id,
    a.authority_name,
    a.reference,
    a.address,
    a.status,
    a.stage,
    a.planning_route,
    a.procedure,
    a.commercial_work,
    a.stated_floorspace_sqm,
    a.description,
    a.links,
    ST_X(a.location::geometry)::double precision AS longitude,
    ST_Y(a.location::geometry)::double precision AS latitude,
    a.location_provenance,
    k.allowance AS location_uncertainty_m,
    k.inside AS inside_boundary,
    a.date_received,
    a.date_decided,
    a.date_validated,
    a.stated_dwelling_count,
    a.intelligence_tier,
    k.development_id,
    d.relevance,
    d.summary,
    d.model_dwelling_count,
    d.creates_commercial_space,
    d.model_dwelling_basis
  FROM kept k
  JOIN public.planning_applications a ON a.id = k.id
  LEFT JOIN public.developments d ON d.id = k.development_id AND d.review_state <> 'rejected'
  ORDER BY sort_rank;
$$;

COMMENT ON FUNCTION public.planning_tab_applications_v3(jsonb, integer) IS
  'Planning tab ranked read: v2 inclusion rules and order, with a planar inside test and distance checks only for uncertain points outside the boundary.';

REVOKE ALL ON FUNCTION public.planning_tab_applications_v3(jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.planning_tab_applications_v3(jsonb, integer) TO service_role;

COMMIT;
