-- A faster ranked read for the planning tab, added beside planning_tab_applications_v2 so the
-- two can be timed and compared on live data before the tab switches. Nothing changes until
-- stored.ts calls v3.
--
-- Measured on 14 Sep 2026 after the national backfill (~630,000 applications): v2 took
-- 3.6-9.1 s for dense areas and hit the 8 s statement timeout on a 14 x 12 km Wandsworth box.
-- v2 sorts every candidate with every wide column attached (description, links, address...)
-- and tests the exact boundary on all of them, then keeps 2,001.
--
-- v3 returns the same rows in the same order, but:
--   1. ranks candidates on narrow columns only (id, band, date), using ORDER BY ... LIMIT so
--      Postgres keeps a bounded top-N heap instead of sorting the whole match set;
--   2. fetches wide columns and runs the exact-inside test for the kept rows only.
-- Candidate selection, inclusion rules, rejected-review handling and tie-breaking are
-- unchanged, so sort_rank is identical row for row.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

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
      ST_SetSRID(ST_GeomFromGeoJSON(p_boundary::text), 4326) AS geom,
      ST_SetSRID(ST_GeomFromGeoJSON(p_boundary::text), 4326)::geography AS geog
  ),
  kept AS (
    SELECT
      a.id,
      a.date_received,
      da.development_id,
      CASE d.relevance
        WHEN 'high'   THEN 0
        WHEN 'medium' THEN 1
        WHEN 'low'    THEN 2
        ELSE 3
      END AS band
    FROM public.planning_applications a
    CROSS JOIN boundary b
    LEFT JOIN public.development_applications da ON da.planning_application_id = a.id
    LEFT JOIN public.developments d ON d.id = da.development_id AND d.review_state <> 'rejected'
    WHERE a.location IS NOT NULL
      -- Same two-step test as v2: a constant bound the geography index can use (currently
      -- 1500 metres), then the exact per-row uncertainty.
      AND ST_DWithin(a.location, b.geog, GREATEST(
        public.planning_location_uncertainty_m('source_exact'),
        public.planning_location_uncertainty_m('source_centroid'),
        public.planning_location_uncertainty_m('postcode_centroid'),
        public.planning_location_uncertainty_m('missing')
      ))
      AND ST_DWithin(
        a.location,
        b.geog,
        public.planning_location_uncertainty_m(a.location_provenance)
      )
    -- Identical ordering to v2's row_number(): band, newest first, id last for a total order.
    ORDER BY band, a.date_received DESC NULLS LAST, a.id
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
    public.planning_location_uncertainty_m(a.location_provenance) AS location_uncertainty_m,
    ST_Intersects(a.location::geometry, b.geom) AS inside_boundary,
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
  CROSS JOIN boundary b
  LEFT JOIN public.developments d ON d.id = k.development_id AND d.review_state <> 'rejected'
  ORDER BY sort_rank;
$$;

COMMENT ON FUNCTION public.planning_tab_applications_v3(jsonb, integer) IS
  'Planning tab ranked read: same rows and order as planning_tab_applications_v2, ranking narrow columns first and fetching wide columns only for kept rows.';

REVOKE ALL ON FUNCTION public.planning_tab_applications_v3(jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.planning_tab_applications_v3(jsonb, integer) TO service_role;

COMMIT;
