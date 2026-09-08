-- Migration: epc_pipeline_health() — one call behind /admin/stores/floor-areas.
--
-- Why a function
-- --------------
-- The health page (docs/store-floor-areas-import-plan.md §6.1) asks six questions and
-- every one of them is an aggregate: certificates per register, stores per confidence
-- tier per matcher version, stores per geocode-quality bucket, and an anti-join for the
-- queue. PostgREST has no GROUP BY and no NOT EXISTS, so the alternative is a dozen
-- count-only requests plus a distinct-values request to know which counts to ask for —
-- and the page would still be wrong the moment a new matcher_version appeared, because
-- the set of buckets would be hardcoded in TypeScript. Grouping belongs in the database.
--
-- Read-only. It computes nothing that isn't already derivable from the tables; it exists
-- so the page is one round trip rather than fifteen, and so the definition of "awaiting
-- match" here stays the same definition epc_stores_awaiting_match() uses — same
-- p_max_attempts, same postcode requirement. If those two drift, the page will report a
-- queue the worker does not agree with.
--
-- Cost: a full scan of epc_certificates (1.3M rows) for the register counts. That is the
-- expensive part and it is deliberate — the load run's own row_count records what was
-- loaded, not what is in the table now, and the gap between those two is exactly what a
-- health page is for.
CREATE OR REPLACE FUNCTION public.epc_pipeline_health(
  p_max_attempts      integer DEFAULT 3,
  p_run_limit         integer DEFAULT 10,
  p_dead_letter_limit integer DEFAULT 25
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
WITH latest_load AS (
  -- One row per register: the most recent load attempt, complete or not. A failed load
  -- must stay visible, so this is the latest run rather than the latest *successful* one.
  SELECT DISTINCT ON (source)
         source, snapshot_ref, row_count, status, error, started_at, finished_at
  FROM public.epc_load_runs
  ORDER BY source, started_at DESC
),
certificate_counts AS (
  SELECT source,
         count(*)                                 AS certificates,
         count(*) FILTER (WHERE geom IS NOT NULL) AS with_geom,
         max(lodgement_date)                      AS newest_certificate
  FROM public.epc_certificates
  GROUP BY source
),
register AS (
  SELECT COALESCE(jsonb_agg(r ORDER BY r.source), '[]'::jsonb) AS sources
  FROM (
    -- FULL JOIN, not LEFT: a register with certificates but no load run (loaded before
    -- runs were tracked) and a load run that inserted nothing (failed) are both real
    -- states, and each is worth seeing.
    SELECT COALESCE(l.source, c.source) AS source,
           l.snapshot_ref,
           l.status,
           l.error,
           l.row_count                  AS rows_loaded,
           l.started_at                 AS load_started_at,
           l.finished_at                AS loaded_at,
           CASE WHEN l.finished_at IS NOT NULL
                THEN floor(EXTRACT(EPOCH FROM (now() - l.finished_at)) / 86400)::integer
           END                          AS days_since_load,
           COALESCE(c.certificates, 0)  AS certificates,
           COALESCE(c.with_geom, 0)     AS with_geom,
           c.newest_certificate
    FROM latest_load l
    FULL JOIN certificate_counts c ON c.source = l.source
  ) r
),
runs AS (
  SELECT COALESCE(jsonb_agg(x ORDER BY x.started_at DESC), '[]'::jsonb) AS recent
  FROM (
    SELECT id, kind, matcher_version, status, stores_considered,
           matched_high, matched_medium, matched_low, matched_none, errored,
           error, started_at, finished_at,
           CASE WHEN finished_at IS NOT NULL
                THEN round(EXTRACT(EPOCH FROM (finished_at - started_at))::numeric, 1)
           END AS duration_seconds
    FROM public.epc_match_runs
    ORDER BY started_at DESC
    LIMIT p_run_limit
  ) x
),
queue AS (
  -- The same three populations epc_stores_awaiting_match() sorts on, counted rather than
  -- returned: never attempted (no row at all), errored and still retryable, and errored
  -- past the attempt limit — which is what makes a row a dead letter and not a queue item.
  SELECT
    count(*) FILTER (WHERE s.has_postcode AND f.store_id IS NULL)                                       AS never_attempted,
    count(*) FILTER (WHERE s.has_postcode AND f.last_error IS NOT NULL
                       AND f.match_attempts <  p_max_attempts)                                          AS retryable,
    count(*) FILTER (WHERE s.has_postcode AND f.last_error IS NOT NULL
                       AND f.match_attempts >= p_max_attempts)                                          AS dead_letters,
    count(*) FILTER (WHERE NOT s.has_postcode)                                                          AS no_postcode,
    p_max_attempts                                                                                      AS max_attempts
  FROM (
    SELECT id, (postcode IS NOT NULL AND btrim(postcode) <> '') AS has_postcode
    FROM public.stores
  ) s
  LEFT JOIN public.store_floor_areas f ON f.store_id = s.id
),
dead_letters AS (
  SELECT COALESCE(jsonb_agg(d ORDER BY d.computed_at DESC), '[]'::jsonb) AS items
  FROM (
    SELECT f.store_id,
           s.name AS store_name,
           s.town,
           s.postcode,
           f.match_attempts,
           f.last_error,
           f.computed_at,
           (f.match_attempts < p_max_attempts) AS will_retry
    FROM public.store_floor_areas f
    JOIN public.stores s ON s.id = f.store_id
    WHERE f.last_error IS NOT NULL
    ORDER BY f.computed_at DESC
    LIMIT p_dead_letter_limit
  ) d
),
coverage_by_version AS (
  -- Grouped, not split into "full run" and "incremental" by name: the version string is
  -- the only honest key, there have been three of them already, and the point of the
  -- section is to see the incremental rate sitting below the full-run rate.
  SELECT COALESCE(jsonb_agg(v ORDER BY v.rows_total DESC), '[]'::jsonb) AS versions
  FROM (
    SELECT matcher_version,
           count(*)                                                 AS rows_total,
           count(*) FILTER (WHERE confidence = 'high')              AS high,
           count(*) FILTER (WHERE confidence = 'medium')            AS medium,
           count(*) FILTER (WHERE confidence = 'low')               AS low,
           count(*) FILTER (WHERE confidence = 'none')              AS none,
           count(*) FILTER (WHERE size_plausibility = 'implausible') AS demoted,
           min(computed_at)                                          AS first_computed_at,
           max(computed_at)                                          AS last_computed_at
    FROM public.store_floor_areas
    GROUP BY matcher_version
  ) v
),
coverage_totals AS (
  SELECT
    (SELECT count(*) FROM public.stores)                                     AS estate,
    (SELECT count(*) FROM public.stores
      WHERE postcode IS NOT NULL AND btrim(postcode) <> '')                  AS estate_with_postcode,
    count(*)                                                                 AS rows_total,
    count(*) FILTER (WHERE confidence = 'high')                              AS high,
    count(*) FILTER (WHERE confidence = 'medium')                            AS medium,
    count(*) FILTER (WHERE confidence = 'low')                               AS low,
    count(*) FILTER (WHERE confidence = 'none')                              AS none,
    count(*) FILTER (WHERE size_plausibility = 'implausible')                AS demoted
  FROM public.store_floor_areas
),
coordinate_buckets AS (
  SELECT COALESCE(jsonb_agg(b ORDER BY b.stores DESC), '[]'::jsonb) AS buckets
  FROM (
    SELECT pqi,
           (google_place_id IS NOT NULL AND btrim(google_place_id) <> '') AS has_place_id,
           count(*) AS stores
    FROM public.stores
    GROUP BY 1, 2
  ) b
),
spatial_eligibility AS (
  -- The two populations §4.5 measured separately, because they are not interchangeable:
  -- Rooftop is calibrated at 25m/25m and Google-validated at 10m/35m. A store with
  -- neither signal cannot be matched spatially under either calibration.
  SELECT
    count(*) FILTER (WHERE pqi = 'Rooftop')                     AS rooftop,
    count(*) FILTER (WHERE pqi IS DISTINCT FROM 'Rooftop'
                       AND google_place_id IS NOT NULL
                       AND btrim(google_place_id) <> '')        AS google_validated,
    count(*) FILTER (WHERE pqi IS DISTINCT FROM 'Rooftop'
                       AND (google_place_id IS NULL
                            OR btrim(google_place_id) = ''))    AS no_signal
  FROM public.stores
)
SELECT jsonb_build_object(
  'generated_at', now(),
  'register',     (SELECT sources  FROM register),
  'matching',     jsonb_build_object('recent', (SELECT recent FROM runs)),
  'queue',        (SELECT to_jsonb(q) FROM queue q),
  'dead_letters', (SELECT items FROM dead_letters),
  'coverage',     (SELECT to_jsonb(t) FROM coverage_totals t)
                  || jsonb_build_object('by_matcher_version', (SELECT versions FROM coverage_by_version)),
  'coordinates',  jsonb_build_object(
                    'buckets',   (SELECT buckets FROM coordinate_buckets),
                    'spatial',   (SELECT to_jsonb(e) FROM spatial_eligibility e)
                  )
);
$$;

COMMENT ON FUNCTION public.epc_pipeline_health(integer, integer, integer) IS
  'Everything /admin/stores/floor-areas displays, in one round trip: register freshness, recent match runs, queue depth, dead letters, coverage by matcher version, and the geocode-quality split that governs spatial eligibility. Read-only. p_max_attempts must match what the matcher passes to epc_stores_awaiting_match() or the queue shown will not be the queue worked.';

REVOKE ALL ON FUNCTION public.epc_pipeline_health(integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.epc_pipeline_health(integer, integer, integer) TO service_role;
