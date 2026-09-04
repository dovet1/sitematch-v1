-- Migration: stop snapshot_brand_stores() reconstructing months it never observed.
--
-- The cron refreshes the previous month as well as the current one, so that a month
-- settles at its real boundary instead of freezing at 03:00 on its final day. That is
-- correct while the month was already being captured daily — the refresh is just the
-- last of many writes.
--
-- It is wrong for a month with no rows at all. The very first run has exactly that
-- shape: brand_store_snapshots is empty, so the previous month gets computed from the
-- store table as it stands *today*, filtered to open_date < the month end. Any store
-- imported or deleted since is silently baked in, and the result looks like an
-- observation while being a reconstruction — the backfill the original migration
-- deliberately refused to do. Every cron outage longer than a month would do the same.
--
-- So an elapsed month is only rewritten if we were already watching it. p_force exists
-- for the SQL tests and for a deliberate, knowing capture of a historic month; the cron
-- never passes it.

DROP FUNCTION IF EXISTS public.snapshot_brand_stores(date);

CREATE OR REPLACE FUNCTION public.snapshot_brand_stores(
  p_month date    DEFAULT NULL,
  p_force boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_month date    := date_trunc('month', coalesce(p_month, current_date))::date;
  v_next  date    := (v_month + interval '1 month')::date;
  v_rows  integer;
BEGIN
  -- v_next <= current_date means the month has fully elapsed. Refresh it only if rows
  -- already exist, which is the signal that it was observed as it happened.
  IF NOT p_force
     AND v_next <= current_date
     AND NOT EXISTS (
       SELECT 1 FROM public.brand_store_snapshots WHERE snapshot_month = v_month
     )
  THEN
    RETURN 0;
  END IF;

  INSERT INTO public.brand_store_snapshots AS bss (
    snapshot_month, brand_id, county,
    store_count, opened_in_period, added_in_period, with_open_date, captured_at
  )
  SELECT
    v_month,
    s.brand_id,
    coalesce(nullif(btrim(s.county), ''), 'Unknown'),
    count(*)::integer,
    count(*) FILTER (WHERE s.open_date >= v_month AND s.open_date < v_next)::integer,
    count(*) FILTER (WHERE s.created_at >= v_month AND s.created_at < v_next)::integer,
    count(*) FILTER (WHERE s.open_date IS NOT NULL)::integer,
    now()
  FROM public.stores s
  WHERE s.brand_id IS NOT NULL
    -- A store known to open after the month being captured was not part of the estate
    -- then. Without this, importing a pipeline of future openings would retroactively
    -- inflate every historic month it touches.
    AND (s.open_date IS NULL OR s.open_date < v_next)
  GROUP BY s.brand_id, coalesce(nullif(btrim(s.county), ''), 'Unknown')
  ON CONFLICT (snapshot_month, brand_id, county) DO UPDATE SET
    store_count      = EXCLUDED.store_count,
    opened_in_period = EXCLUDED.opened_in_period,
    added_in_period  = EXCLUDED.added_in_period,
    with_open_date   = EXCLUDED.with_open_date,
    captured_at      = EXCLUDED.captured_at;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  -- A brand/county pair that has fallen to zero stores since the last run would otherwise
  -- keep its stale row forever, and an estate could never appear to shrink. Absence of a
  -- row means zero, which is also what makes SUM-across-counties correct.
  DELETE FROM public.brand_store_snapshots d
  WHERE d.snapshot_month = v_month
    AND NOT EXISTS (
      SELECT 1
      FROM public.stores s
      WHERE s.brand_id = d.brand_id
        AND coalesce(nullif(btrim(s.county), ''), 'Unknown') = d.county
        AND (s.open_date IS NULL OR s.open_date < v_next)
    );

  RETURN v_rows;
END;
$$;

COMMENT ON FUNCTION public.snapshot_brand_stores(date, boolean) IS
  'Captures every brand''s store estate for the given month (default: current), grained by county. Idempotent. An already-elapsed month is only rewritten if it was observed at the time — pass p_force to reconstruct one knowingly. Returns rows written, or 0 when the month was skipped.';

REVOKE EXECUTE ON FUNCTION public.snapshot_brand_stores(date, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.snapshot_brand_stores(date, boolean) TO service_role;
