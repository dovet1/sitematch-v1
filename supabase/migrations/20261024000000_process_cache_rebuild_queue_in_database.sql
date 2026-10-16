-- Drain cache_rebuild_queue inside the database with pg_cron.
--
-- The queue was drained by a Vercel cron calling rebuild_all_bua_summaries through
-- PostgREST. That cannot work:
--   * PostgREST connects as `authenticator`, whose role setting statement_timeout=8s
--     arms the timer for the calling statement. The function-level
--     `SET statement_timeout = 0` only changes the GUC; it does not disarm a timer that
--     is already running, so the 5-10 minute rebuild is always cancelled at 8s.
--   * Even without that, a Vercel function is capped at 300s, and when the HTTP client
--     goes away mid-call the backend aborts and rolls the rebuild back.
--
-- pg_cron (libpq mode) sends the job command as one simple-query message. Postgres arms
-- statement_timeout per statement within such a message, and an explicit COMMIT in the
-- message commits the work before it. So the job:
--   1. claims the oldest pending row and COMMITs, so the claim is visible and stores
--      changed during the rebuild can enqueue a fresh pending row (the partial unique
--      index only allows one row with processed_at IS NULL);
--   2. sets statement_timeout = 0 as its own statement, so the next statement runs
--      without a timer;
--   3. runs the rebuild and records completion or the error.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Step 1: claim the oldest pending request, unless a claimed one is still outstanding.
CREATE OR REPLACE FUNCTION public.claim_cache_rebuild()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.cache_rebuild_queue
    WHERE rebuild_started_at IS NOT NULL
      AND rebuild_completed_at IS NULL
      AND error IS NULL
  ) THEN
    RETURN NULL;
  END IF;

  UPDATE public.cache_rebuild_queue AS q
  SET processed_at = now(),
      rebuild_started_at = now()
  WHERE q.id = (
    SELECT id
    FROM public.cache_rebuild_queue
    WHERE processed_at IS NULL
    ORDER BY created_at
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING q.id INTO v_id;

  RETURN v_id;
END;
$$;

-- Step 3: run the rebuild for the claimed request. A row left claimed by a crashed run
-- is retried on the next tick; one claimed more than 6 hours ago is given up on.
CREATE OR REPLACE FUNCTION public.run_claimed_cache_rebuild()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_id uuid;
  v_progress text[];
  v_last text;
BEGIN
  UPDATE public.cache_rebuild_queue
  SET error = 'Abandoned: rebuild was claimed but never reported completion'
  WHERE rebuild_started_at < now() - interval '6 hours'
    AND rebuild_completed_at IS NULL
    AND error IS NULL;

  SELECT id
  INTO v_id
  FROM public.cache_rebuild_queue
  WHERE rebuild_started_at IS NOT NULL
    AND rebuild_completed_at IS NULL
    AND error IS NULL
  ORDER BY rebuild_started_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_id IS NULL THEN
    RETURN 'No claimed rebuild';
  END IF;

  BEGIN
    SELECT array_agg(r.progress)
    INTO v_progress
    FROM public.rebuild_all_bua_summaries(NULL) AS r;
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.cache_rebuild_queue
    SET error = SQLERRM
    WHERE id = v_id;
    RETURN 'Rebuild failed: ' || SQLERRM;
  END;

  v_last := v_progress[array_upper(v_progress, 1)];

  -- Someone else holds the rebuild lock (e.g. a manual run). Leave the row claimed so
  -- the next tick retries it.
  IF v_last IS DISTINCT FROM 'Rebuild complete!' THEN
    RETURN coalesce(v_last, 'Rebuild returned no progress');
  END IF;

  UPDATE public.cache_rebuild_queue
  SET rebuild_completed_at = clock_timestamp()
  WHERE id = v_id;

  RETURN v_last;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_cache_rebuild() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.run_claimed_cache_rebuild() FROM PUBLIC, anon, authenticated;

-- The queue is written by SECURITY DEFINER triggers (owned by the table owner) and the
-- service-role client, both of which bypass RLS. It had RLS off with table grants to
-- anon, so anyone holding the anon key could read, alter or delete queue rows.
ALTER TABLE public.cache_rebuild_queue ENABLE ROW LEVEL SECURITY;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'process-cache-rebuild-queue';

SELECT cron.schedule(
  'process-cache-rebuild-queue',
  '*/5 * * * *',
  $job$
    SELECT public.claim_cache_rebuild();
    COMMIT;
    SET statement_timeout = 0;
    SELECT public.run_claimed_cache_rebuild();
  $job$
);

COMMENT ON TABLE public.cache_rebuild_queue IS
  'Queue for pending BUA summary (GapFinder) rebuilds. Drained every 5 minutes by the pg_cron job process-cache-rebuild-queue.';
