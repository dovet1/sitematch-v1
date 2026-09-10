-- Phase 1 of the planning delivery plan: the ranked planning tab.
--
-- Three things the tab needs that the existing boundary read cannot give it, and which have
-- to happen in one query rather than three.

-- 1. How wrong a stored position can be.
--
-- Plota reports a `precision` on every coordinate and, in the sample we hold, has never once
-- said "exact" -- 71 of 164 positions are ward or parish centres. The tab decides what to
-- show by asking whether the stored point falls inside the drawn area, which for those
-- records asks about the wrong point: a real site inside the area is hidden when its ward
-- centre falls outside it.
--
-- These radii are assumptions, stated here so there is one place to correct them, and they
-- are deliberately generous. Under-claiming precision loses nothing but shows a little more;
-- over-claiming it hides real sites silently, which is the failure that motivated this.
--
--   source_exact       0 m -- the provider says this is the site
--   source_centroid  1500 m -- a ward or parish centre; English wards run 1-3 km across
--   postcode_centroid 200 m -- a unit postcode covers roughly fifteen addresses
--
-- Revisit these against measured error the moment we can compare a stored point with a known
-- site address. Nothing here should be read as a measurement.
CREATE OR REPLACE FUNCTION public.planning_location_uncertainty_m(p_provenance text)
RETURNS double precision
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE p_provenance
    WHEN 'source_exact'      THEN 0
    WHEN 'source_centroid'   THEN 1500
    WHEN 'postcode_centroid' THEN 200
    ELSE 0
  END::double precision;
$$;

COMMENT ON FUNCTION public.planning_location_uncertainty_m(text) IS
  'Assumed positional error for a stored planning coordinate, in metres. Assumptions, not measurements; see the migration that defines it.';

-- 2. The tab's read: ranked, classified, and inclusive of approximate positions.
--
-- Ordering happens here, in the query, and not in the application. The tab keeps the newest
-- 2,000 records and would otherwise sort only what survived that cut -- permanently losing a
-- high-relevance application that never made the first 2,000 by date. Rank first, cap second.
--
-- `sort_rank` is returned rather than left implicit because the caller pages this result
-- through PostgREST, and a function's row order is not a contract once a LIMIT and OFFSET are
-- wrapped around it. The caller orders by this column; the ordering itself stays here.
--
-- Relevance is read from `developments`, which is where the admin review writes a human
-- correction. So a corrected relevance ranks the row, and the model's original value is not
-- consulted again -- the precedence the review section of the plan asks to be written down.
CREATE OR REPLACE FUNCTION public.planning_tab_applications(
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
  creates_commercial_space text
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH boundary AS (
    SELECT
      ST_SetSRID(ST_GeomFromGeoJSON(p_boundary::text), 4326) AS geom,
      ST_SetSRID(ST_GeomFromGeoJSON(p_boundary::text), 4326)::geography AS geog
  ),
  matched AS (
    SELECT
      a.*,
      public.planning_location_uncertainty_m(a.location_provenance) AS uncertainty_m,
      ST_Intersects(a.location::geometry, b.geom) AS exactly_inside
    FROM public.planning_applications a
    CROSS JOIN boundary b
    WHERE a.location IS NOT NULL
      -- One predicate covers both cases: at zero uncertainty ST_DWithin is exactly
      -- ST_Intersects, so an exact point still has to fall inside the drawn area.
      AND ST_DWithin(
        a.location,
        b.geog,
        public.planning_location_uncertainty_m(a.location_provenance)
      )
  )
  SELECT
    row_number() OVER (
      ORDER BY
        CASE d.relevance
          WHEN 'high'   THEN 0
          WHEN 'medium' THEN 1
          WHEN 'low'    THEN 2
          ELSE 3
        END,
        -- Within a band, newest first; id last so the order is total and a page boundary
        -- cannot show the same record twice or skip one.
        m.date_received DESC NULLS LAST,
        m.id
    ) AS sort_rank,
    m.id,
    m.provider_id,
    m.authority_name,
    m.reference,
    m.address,
    m.status,
    m.stage,
    m.planning_route,
    m.procedure,
    m.commercial_work,
    m.stated_floorspace_sqm,
    m.description,
    m.links,
    ST_X(m.location::geometry)::double precision AS longitude,
    ST_Y(m.location::geometry)::double precision AS latitude,
    m.location_provenance,
    m.uncertainty_m AS location_uncertainty_m,
    m.exactly_inside AS inside_boundary,
    m.date_received,
    m.date_decided,
    m.date_validated,
    m.stated_dwelling_count,
    m.intelligence_tier,
    da.development_id,
    d.relevance,
    d.summary,
    d.model_dwelling_count,
    d.creates_commercial_space
  FROM matched m
  LEFT JOIN public.development_applications da ON da.planning_application_id = m.id
  LEFT JOIN public.developments d ON d.id = da.development_id
  ORDER BY sort_rank
  LIMIT GREATEST(COALESCE(p_limit, 2000), 1);
$$;

COMMENT ON FUNCTION public.planning_tab_applications(jsonb, integer) IS
  'Planning tab read: applications in or near a boundary, joined to their Development classification and ranked by relevance before the record cap.';

REVOKE ALL ON FUNCTION public.planning_location_uncertainty_m(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.planning_tab_applications(jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.planning_location_uncertainty_m(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.planning_tab_applications(jsonb, integer) TO service_role;
