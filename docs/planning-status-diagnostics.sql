-- Read-only: measure the actual work done by the full planning status query.
-- Run the whole file in Supabase SQL Editor. Share the single QUERY PLAN result.
-- This executes SELECTs only; it does not alter data or schema.
-- Local role and timeout changes end with the transaction.
-- If it times out or errors, run ROLLBACK; and share the error instead.
BEGIN READ ONLY;
SET LOCAL ROLE service_role;
SET LOCAL statement_timeout = '30s';
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
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
    -- Keep separate scalar reads so max/min can stop at an index endpoint,
    -- and exact counts can scan narrow indexes instead of the wide raw-record heap.
    -- The partial index includes live applications with NULL received dates too.
    'freshness', jsonb_build_object(
      'latest_application_date', (SELECT max(date_received) FROM public.planning_applications),
      'stored_records', (SELECT count(*)::integer FROM public.planning_applications),
      'live_records', (
        SELECT count(*)::integer FROM public.planning_applications
        WHERE stage IS NULL OR stage IN ('pending', 'other')
      ),
      'oldest_live_checked_at', (
        SELECT min(last_checked_at) FROM public.planning_applications
        WHERE stage IS NULL OR stage IN ('pending', 'other')
      )
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
COMMIT;
