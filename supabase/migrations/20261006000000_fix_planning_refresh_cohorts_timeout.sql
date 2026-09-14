-- Refresh has not run since 12 September 2026 06:30 UTC.
--
-- planning_refresh_cohorts grouped every undecided application in the store by received month
-- to find the stalest windows. On the national store (~614,000 applications) that exceeds the
-- statement timeout (measured 8.2 s, SQLSTATE 57014), so every six-hourly refresh call fails
-- before it records a run, and decisions on stored applications stop being picked up. Nothing
-- is visible except the absence of refresh rows in planning_ingest_runs.
--
-- The replacement looks at the last 24 received-date months one at a time:
--   * a month is a cohort when any undecided application exists in it -- an index range probe on
--     planning_applications_refresh_cohort_idx that stops at the first row (about 60 ms);
--   * staleness comes from when refresh last started on that window, read from the small
--     planning_ingest_runs table, instead of the minimum last_checked_at over every row.
-- Never-refreshed months come first, newest first, then the least recently refreshed.
--
-- live_records is no longer counted: counting undecided records per month is what timed out.
-- The column stays, returned as NULL, so callers keep working (the worker reads it as 0 and
-- uses it only for reporting). The 24-month bound is deliberate: the census covers twelve
-- months, and a handful of mis-dated records (the earliest reads 1962) are not refresh cohorts.

CREATE OR REPLACE FUNCTION public.planning_refresh_cohorts(p_limit integer DEFAULT 3)
RETURNS TABLE (
  window_start      date,
  window_end        date,
  live_records      integer,
  oldest_checked_at timestamptz
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH months AS (
    SELECT m::date AS window_start,
           LEAST((m + interval '1 month' - interval '1 day')::date, CURRENT_DATE) AS window_end
    FROM generate_series(
      date_trunc('month', CURRENT_DATE - interval '23 months'),
      date_trunc('month', CURRENT_DATE),
      interval '1 month'
    ) AS m
  )
  SELECT
    months.window_start,
    months.window_end,
    NULL::integer AS live_records,
    last_refresh.started_at AS oldest_checked_at
  FROM months
  LEFT JOIN LATERAL (
    SELECT max(r.started_at) AS started_at
    FROM public.planning_ingest_runs r
    WHERE r.kind = 'refresh'
      AND r.date_from = months.window_start
  ) AS last_refresh ON true
  WHERE EXISTS (
    SELECT 1
    FROM public.planning_applications a
    WHERE a.date_received BETWEEN months.window_start AND months.window_end
      AND (a.stage IS NULL OR a.stage IN ('pending', 'other'))
  )
  ORDER BY last_refresh.started_at ASC NULLS FIRST, months.window_start DESC
  LIMIT GREATEST(COALESCE(p_limit, 3), 1);
$$;

COMMENT ON FUNCTION public.planning_refresh_cohorts(integer) IS
  'Received-date month windows (last 24 months) holding undecided applications, least recently refreshed first; live_records is not counted and is NULL. Drives kind=refresh ingestion.';

-- Runs are looked up by kind and window start for every candidate month.
CREATE INDEX IF NOT EXISTS planning_ingest_runs_kind_window_idx
  ON public.planning_ingest_runs (kind, date_from, started_at DESC);
