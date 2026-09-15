-- The Assess Area / Find Gaps Planning tab is an opportunities view, not the full planning
-- census. Keep commercial schemes and housing schemes with a confirmed count of at least 15
-- homes. Apply the rule before relevance ranking and the 2,000-row cap so hidden household and
-- minor residential applications cannot crowd qualifying schemes out of a dense-area result.
--
-- Commercial eligibility uses the deterministic ingestion limbs as well as the classifier's
-- answer. That retains archive descriptions classified as commercial and commercial losses,
-- while excluding brand-only and uncounted-housing eligibility. For housing, a human correction
-- is authoritative (including null); otherwise use Plota's stated count, falling back to the
-- classifier only when Plota supplied no count.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '10min';

-- The return row gains eligibility_limbs so the application can enforce the same rule during a
-- rolling deployment. PostgreSQL cannot replace a function while changing its return type.
DROP FUNCTION IF EXISTS public.planning_tab_applications_v3(jsonb, integer);

CREATE FUNCTION public.planning_tab_applications_v3(
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
  eligibility_limbs       text[],
  intelligence_tier       boolean,
  development_id          uuid,
  relevance               text,
  summary                 text,
  model_dwelling_count    integer,
  creates_commercial_space text,
  model_dwelling_basis    text
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH boundary AS (
    SELECT
      g.geom,
      g.geom::geography AS geog,
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
      a.commercial_work,
      a.stated_dwelling_count,
      a.eligibility_limbs,
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
    WHERE (
        c.inside
        OR (c.allowance > 0 AND ST_DWithin(c.location, b.geog, c.allowance, false))
      )
      AND (
        c.eligibility_limbs && ARRAY['A', 'A-described', 'D', 'D-described']::text[]
        OR d.creates_commercial_space = 'yes'
        OR CASE
          WHEN d.model_dwelling_basis = 'human_review' THEN d.model_dwelling_count
          ELSE COALESCE(c.stated_dwelling_count, d.model_dwelling_count)
        END >= 15
      )
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
    a.eligibility_limbs,
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
  'Planning tab ranked read: commercial schemes or housing schemes with a confirmed count of at least 15 homes, in or plausibly near the boundary.';

REVOKE ALL ON FUNCTION public.planning_tab_applications_v3(jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.planning_tab_applications_v3(jsonb, integer) TO service_role;

COMMIT;
