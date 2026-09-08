-- Migration: keep the health page off epc_certificates, and record the register's
-- snapshot facts where they are already known.
--
-- What went wrong
-- ---------------
-- 20260913000000 computed the register panel live: certificates, how many carry a
-- coordinate, and the newest lodgement date, grouped by source. Measured against the real
-- table on 2026-09-07, that call died on the 8s statement timeout every time. Timings
-- from the production instance, warm and cold:
--
--   count(*) over epc_certificates          0.2s warm, >8s cold
--   count(*) FILTER (geom IS NOT NULL)      2.5-3.3s, warm or not
--   count(*) WHERE source = 'epc_ew'        0.3s warm, >8s cold
--   every scan of stores / store_floor_areas ~0.12s warm
--
-- The rows are wide (four token arrays each), so anything that must reach the heap reads
-- gigabytes. Only the counts the primary key can answer on its own are ever cheap, and
-- even those are slow on a cold cache — which is the state a page visited twice a day
-- will usually find. So the register panel must not touch epc_certificates at all.
--
-- The fix
-- -------
-- Certificates, coordinates and newest date are properties of a *snapshot*. They cannot
-- change between reloads, so recomputing them per page view was never buying freshness —
-- it was buying a full scan to re-derive a constant. They belong on the load run that
-- established them, next to row_count, which was already recorded this way.
--
-- The loader (scripts/epc/load_certificates.py) counts both while it streams the file and
-- currently prints them and throws them away; it now writes them. The backfill below
-- covers the loads that already happened, and pays the expensive scan once, here, where
-- there is no statement timeout to hit.

-- =============================================================================
-- 1. The columns
-- =============================================================================
ALTER TABLE public.epc_load_runs
  ADD COLUMN IF NOT EXISTS with_geom          integer,
  ADD COLUMN IF NOT EXISTS newest_certificate date;

COMMENT ON COLUMN public.epc_load_runs.with_geom IS
  'Certificates in this snapshot that carry a coordinate. Recorded at load time because deriving it costs a full scan of a 1.3M-row table with four array columns; it cannot change until the next load.';
COMMENT ON COLUMN public.epc_load_runs.newest_certificate IS
  'Latest lodgement_date in this snapshot. Says how current the register data is, as against when the file happened to be loaded.';

-- =============================================================================
-- 2. Backfill the loads that already ran
-- =============================================================================
-- Restricted to the newest complete run per source: an older run described a snapshot
-- that is no longer in the table, and the current contents say nothing about it.
WITH latest AS (
  SELECT DISTINCT ON (source) id, source
  FROM public.epc_load_runs
  WHERE status = 'complete'
  ORDER BY source, started_at DESC
),
stats AS (
  SELECT source,
         count(*) FILTER (WHERE geom IS NOT NULL) AS with_geom,
         max(lodgement_date)                      AS newest_certificate
  FROM public.epc_certificates
  GROUP BY source
)
UPDATE public.epc_load_runs r
SET with_geom          = s.with_geom,
    newest_certificate = s.newest_certificate
FROM latest l
JOIN stats s ON s.source = l.source
WHERE r.id = l.id
  AND r.with_geom IS NULL;

-- =============================================================================
-- 3. The health function, reading only what is cheap
-- =============================================================================
-- Also fewer passes over stores and store_floor_areas than the first version: the estate
-- counts come from the queue's join rather than from their own scans, the coverage totals
-- are summed from the per-version rows rather than recounted, and the spatial-eligibility
-- split is folded out of the geocode buckets. Three scans, where there were eight.
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
WITH register AS (
  -- One row per register: its most recent load attempt, complete or not. A failed load
  -- must stay visible, so this is the latest run rather than the latest successful one —
  -- and its snapshot columns are null, which the page renders as "not recorded".
  SELECT COALESCE(jsonb_agg(r ORDER BY r.source), '[]'::jsonb) AS sources
  FROM (
    SELECT DISTINCT ON (source)
           source,
           snapshot_ref,
           status,
           error,
           row_count          AS certificates,
           with_geom,
           newest_certificate,
           started_at         AS load_started_at,
           finished_at        AS loaded_at,
           CASE WHEN finished_at IS NOT NULL
                THEN floor(EXTRACT(EPOCH FROM (now() - finished_at)) / 86400)::integer
           END                AS days_since_load
    FROM public.epc_load_runs
    ORDER BY source, started_at DESC
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
estate AS (
  -- One pass for both the estate size and the queue: the same three populations
  -- epc_stores_awaiting_match() sorts on, counted rather than returned. Never attempted
  -- (no row at all), errored and still retryable, and errored past the attempt limit —
  -- which is what makes a row a dead letter rather than a queue item.
  SELECT
    count(*)                                                        AS stores,
    count(*) FILTER (WHERE s.has_postcode)                          AS stores_with_postcode,
    count(*) FILTER (WHERE s.has_postcode AND f.store_id IS NULL)   AS never_attempted,
    count(*) FILTER (WHERE s.has_postcode AND f.last_error IS NOT NULL
                       AND f.match_attempts <  p_max_attempts)      AS retryable,
    count(*) FILTER (WHERE s.has_postcode AND f.last_error IS NOT NULL
                       AND f.match_attempts >= p_max_attempts)      AS dead_letters,
    count(*) FILTER (WHERE NOT s.has_postcode)                      AS no_postcode
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
by_version AS (
  -- Grouped, not split into "full run" and "incremental" by name: the version string is
  -- the only honest key, there have been three of them already, and the point of the
  -- section is to see the incremental rate sitting below the full-run rate.
  SELECT matcher_version,
         count(*)                                                  AS rows_total,
         count(*) FILTER (WHERE confidence = 'high')               AS high,
         count(*) FILTER (WHERE confidence = 'medium')             AS medium,
         count(*) FILTER (WHERE confidence = 'low')                AS low,
         count(*) FILTER (WHERE confidence = 'none')               AS none,
         count(*) FILTER (WHERE size_plausibility = 'implausible') AS demoted,
         min(computed_at)                                          AS first_computed_at,
         max(computed_at)                                          AS last_computed_at
  FROM public.store_floor_areas
  GROUP BY matcher_version
),
coverage AS (
  SELECT COALESCE(sum(v.rows_total), 0)::bigint AS rows_total,
         COALESCE(sum(v.high),       0)::bigint AS high,
         COALESCE(sum(v.medium),     0)::bigint AS medium,
         COALESCE(sum(v.low),        0)::bigint AS low,
         COALESCE(sum(v.none),       0)::bigint AS none,
         COALESCE(sum(v.demoted),    0)::bigint AS demoted,
         COALESCE(jsonb_agg(v ORDER BY v.rows_total DESC), '[]'::jsonb) AS by_matcher_version
  FROM by_version v
),
buckets AS (
  SELECT pqi,
         (google_place_id IS NOT NULL AND btrim(google_place_id) <> '') AS has_place_id,
         count(*) AS stores
  FROM public.stores
  GROUP BY 1, 2
),
coordinates AS (
  -- The two populations §4.5 measured separately, folded out of the same buckets rather
  -- than counted again: Rooftop is calibrated at 25m/25m and Google-validated at 10m/35m.
  -- A store with neither signal cannot be matched spatially under either calibration.
  SELECT
    COALESCE(jsonb_agg(b ORDER BY b.stores DESC), '[]'::jsonb) AS buckets,
    jsonb_build_object(
      'rooftop',
        COALESCE(sum(b.stores) FILTER (WHERE b.pqi = 'Rooftop'), 0)::bigint,
      'google_validated',
        COALESCE(sum(b.stores) FILTER (WHERE b.pqi IS DISTINCT FROM 'Rooftop'
                                         AND b.has_place_id), 0)::bigint,
      'no_signal',
        COALESCE(sum(b.stores) FILTER (WHERE b.pqi IS DISTINCT FROM 'Rooftop'
                                         AND NOT b.has_place_id), 0)::bigint
    ) AS spatial
  FROM buckets b
)
SELECT jsonb_build_object(
  'generated_at', now(),
  'register',     (SELECT sources FROM register),
  'matching',     jsonb_build_object('recent', (SELECT recent FROM runs)),
  'queue',        (SELECT jsonb_build_object(
                            'never_attempted', e.never_attempted,
                            'retryable',       e.retryable,
                            'dead_letters',    e.dead_letters,
                            'no_postcode',     e.no_postcode,
                            'max_attempts',    p_max_attempts)
                   FROM estate e),
  'dead_letters', (SELECT items FROM dead_letters),
  'coverage',     (SELECT to_jsonb(c) FROM coverage c)
                  || (SELECT jsonb_build_object('estate', e.stores,
                                                'estate_with_postcode', e.stores_with_postcode)
                      FROM estate e),
  'coordinates',  (SELECT jsonb_build_object('buckets', c.buckets, 'spatial', c.spatial)
                   FROM coordinates c)
);
$$;

COMMENT ON FUNCTION public.epc_pipeline_health(integer, integer, integer) IS
  'Everything /admin/stores/floor-areas displays, in one round trip: register freshness from the load run, recent match runs, queue depth, dead letters, coverage by matcher version, and the geocode-quality split that governs spatial eligibility. Reads no certificates — see migration 20260914000000 for the timings that forced that. p_max_attempts must match what the matcher passes to epc_stores_awaiting_match() or the queue shown will not be the queue worked.';
