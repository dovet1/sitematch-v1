-- Phase 0 of the planning delivery plan: a refresh pass, and a pipeline you can look at.
--
-- Two reads the application layer should not assemble for itself. Both aggregate across the
-- whole store, so both are service_role only, like every other function in this schema.

-- 1. Which cohorts to re-check.
--
-- Discovery searches a received-date window and finds applications that are new to us. It
-- never revisits one whose decision arrives later, and a decision arriving is precisely the
-- event a monitoring product exists to catch. Refresh closes that gap by re-searching the
-- windows we already hold undecided records in, then upserting whatever comes back.
--
-- Cohorts are received-date months, not the authority-plus-window the original ingest plan
-- proposed. Plota's search is only proven here for nation, census filter and date range;
-- narrowing by authority would need a request parameter this codebase has never sent. Month
-- windows reuse the parameters discovery already runs every day, so refresh inherits its
-- pagination, checkpointing and coverage accounting unchanged. Narrow to authority later,
-- once that parameter is confirmed against the live API.
--
-- Ordering is by the least recently verified cohort. A run of any size then spends its
-- request budget on the stalest data rather than re-reading the newest, which matters most
-- when the budget is small enough to cover only part of the backlog.
--
-- Decided records are deliberately excluded. Once an application is approved, refused or
-- withdrawn there is nothing further to poll for, and continuing to pay for it would crowd
-- out the undecided records that can still change. The original plan's "one final refresh
-- after a decision, then stop" is not implemented: it needs a marker recording that the
-- final check happened, and re-reading every decided record forever is the failure it exists
-- to prevent.
CREATE OR REPLACE FUNCTION public.planning_refresh_cohorts(p_limit integer DEFAULT 3)
RETURNS TABLE (
  window_start      date,
  window_end        date,
  live_records      integer,
  oldest_checked_at timestamptz
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT
    date_trunc('month', a.date_received)::date AS window_start,
    LEAST(
      (date_trunc('month', a.date_received) + interval '1 month' - interval '1 day')::date,
      CURRENT_DATE
    ) AS window_end,
    count(*)::integer AS live_records,
    min(a.last_checked_at) AS oldest_checked_at
  FROM public.planning_applications a
  WHERE a.date_received IS NOT NULL
    AND (a.stage IS NULL OR a.stage IN ('pending', 'other'))
  GROUP BY 1, 2
  -- Stalest first; newest window breaks a tie, because a fresh cohort changes most often.
  ORDER BY min(a.last_checked_at) ASC, 1 DESC
  LIMIT GREATEST(COALESCE(p_limit, 3), 1);
$$;

COMMENT ON FUNCTION public.planning_refresh_cohorts(integer) IS
  'Received-date month windows holding undecided applications, least recently checked first. Drives kind=refresh ingestion.';

-- The refresh cohort query walks undecided records by their received date and last check.
CREATE INDEX IF NOT EXISTS planning_applications_refresh_cohort_idx
  ON public.planning_applications (date_received, last_checked_at)
  WHERE date_received IS NOT NULL
    AND (stage IS NULL OR stage IN ('pending', 'other'));

-- 2. What the pipeline is doing.
--
-- Queue depth and data freshness were unobservable: the counts live in four tables and
-- nothing joined them. Without this, a classification queue that stops draining, or an
-- ingest that has not run for a week, both look exactly like a quiet week.
--
-- This returns one document rather than a row set so the admin route and any later status
-- surface read the same shape, and so adding a measure does not change a column list.
CREATE OR REPLACE FUNCTION public.planning_pipeline_status()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'generated_at', now(),
    -- Classification depth over the intelligence tier only. Records outside the tier are
    -- 'not_eligible' by definition and would swamp the states that mean something.
    'classification', COALESCE((
      SELECT jsonb_object_agg(state, n)
      FROM (
        SELECT a.classification_state AS state, count(*)::integer AS n
        FROM public.planning_applications a
        WHERE a.intelligence_tier
        GROUP BY 1
      ) s
    ), '{}'::jsonb),
    'research', COALESCE((
      SELECT jsonb_object_agg(state, n)
      FROM (
        SELECT d.research_state AS state, count(*)::integer AS n
        FROM public.developments d
        WHERE d.escalate_for_research
        GROUP BY 1
      ) s
    ), '{}'::jsonb),
    -- The most recent run of each kind, whatever its status. A failed run is the thing you
    -- most need to see, so this deliberately does not filter to successful ones.
    'last_runs', COALESCE((
      SELECT jsonb_object_agg(kind, detail)
      FROM (
        SELECT DISTINCT ON (r.kind)
          r.kind,
          jsonb_build_object(
            'status', r.status,
            'started_at', r.started_at,
            'finished_at', r.finished_at,
            'requests_made', r.requests_made,
            'records_upserted', r.records_upserted,
            'error', r.error
          ) AS detail
        FROM public.planning_ingest_runs r
        ORDER BY r.kind, r.started_at DESC
      ) s
    ), '{}'::jsonb),
    'freshness', (
      SELECT jsonb_build_object(
        'latest_application_date', max(a.date_received),
        'stored_records', count(*)::integer,
        'live_records', count(*) FILTER (
          WHERE a.stage IS NULL OR a.stage IN ('pending', 'other')
        )::integer,
        -- The oldest verification of a record that can still change. This, not the last run
        -- time, is what says how out of date the answer might be.
        'oldest_live_checked_at', min(a.last_checked_at) FILTER (
          WHERE a.stage IS NULL OR a.stage IN ('pending', 'other')
        )
      )
      FROM public.planning_applications a
    ),
    'coverage', (
      SELECT jsonb_build_object(
        'authorities', count(*)::integer,
        'last_discovery_at', max(c.last_discovery_at),
        'last_refresh_at', max(c.last_refresh_at),
        'errored', count(*) FILTER (WHERE c.freshness_state = 'error')::integer
      )
      FROM public.planning_authority_coverage c
    ),
    -- Remaining monthly allowance as the provider last reported it. A refresh schedule that
    -- quietly exhausts the month is the most expensive way to discover a cadence is wrong.
    'provider', (
      SELECT jsonb_build_object(
        'monthly_limit', u.monthly_limit,
        'monthly_remaining', u.monthly_remaining,
        'observed_at', u.occurred_at
      )
      FROM public.planning_provider_usage u
      WHERE u.monthly_remaining IS NOT NULL
      ORDER BY u.occurred_at DESC
      LIMIT 1
    )
  );
$$;

COMMENT ON FUNCTION public.planning_pipeline_status() IS
  'Queue depth, ingest recency, store freshness and remaining provider allowance in one document.';

REVOKE ALL ON FUNCTION public.planning_refresh_cohorts(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.planning_pipeline_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.planning_refresh_cohorts(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.planning_pipeline_status() TO service_role;
