-- Durable, resumable PlanNexus harvesting.
-- Each outward code is an independent work item. Completed work survives a
-- stopped browser request or server restart, and the run digest is updated
-- after every prefix so the web report can show partial results.

ALTER TABLE public.planning_alert_runs
  DROP CONSTRAINT IF EXISTS planning_alert_runs_status_check;
ALTER TABLE public.planning_alert_runs
  ADD CONSTRAINT planning_alert_runs_status_check
  CHECK (status IN ('processing', 'generated', 'sent', 'failed'));

ALTER TABLE public.planning_alert_runs
  ADD COLUMN IF NOT EXISTS processed_prefix_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_prefix_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_progress_at timestamptz;

CREATE TABLE IF NOT EXISTS public.planning_alert_run_prefixes (
  run_id uuid NOT NULL REFERENCES public.planning_alert_runs(id) ON DELETE CASCADE,
  postcode_prefix text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  application_count integer NOT NULL DEFAULT 0,
  claimed_at timestamptz,
  completed_at timestamptz,
  error_message text,
  PRIMARY KEY (run_id, postcode_prefix)
);

CREATE INDEX IF NOT EXISTS idx_planning_alert_run_prefixes_work
  ON public.planning_alert_run_prefixes (run_id, status, postcode_prefix);

ALTER TABLE public.planning_alert_run_prefixes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.planning_alert_run_prefixes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.planning_alert_run_prefixes TO service_role;

-- Atomically leases one prefix. A lease abandoned by a killed request becomes
-- available again after five minutes. Reprocessing is safe because digest
-- application lists are merged by PlanNexus application id.
CREATE OR REPLACE FUNCTION public.claim_planning_alert_run_prefix(p_run_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
BEGIN
  UPDATE public.planning_alert_run_prefixes
  SET status = 'pending', claimed_at = NULL
  WHERE run_id = p_run_id
    AND status = 'processing'
    AND claimed_at < timezone('utc'::text, now()) - interval '5 minutes';

  WITH candidate AS (
    SELECT run_id, postcode_prefix
    FROM public.planning_alert_run_prefixes
    WHERE run_id = p_run_id
      AND status = 'pending'
      AND attempts < 3
    ORDER BY postcode_prefix
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE public.planning_alert_run_prefixes AS work
  SET status = 'processing',
      claimed_at = timezone('utc'::text, now()),
      attempts = work.attempts + 1,
      error_message = NULL
  FROM candidate
  WHERE work.run_id = candidate.run_id
    AND work.postcode_prefix = candidate.postcode_prefix
  RETURNING work.postcode_prefix INTO v_prefix;

  RETURN v_prefix;
END;
$$;

-- Saves a prefix and the newly merged partial digest in one transaction.
CREATE OR REPLACE FUNCTION public.complete_planning_alert_run_prefix(
  p_run_id uuid,
  p_postcode_prefix text,
  p_application_count integer,
  p_digest_payload jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_processed integer;
  v_total integer;
  v_source_count integer;
  v_updated integer;
BEGIN
  UPDATE public.planning_alert_run_prefixes
  SET status = 'completed',
      application_count = p_application_count,
      completed_at = timezone('utc'::text, now()),
      error_message = NULL
  WHERE run_id = p_run_id
    AND postcode_prefix = p_postcode_prefix
    AND status = 'processing';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN RETURN false; END IF;

  SELECT
    count(*) FILTER (WHERE status = 'completed'),
    count(*),
    COALESCE(sum(application_count) FILTER (WHERE status = 'completed'), 0)
  INTO v_processed, v_total, v_source_count
  FROM public.planning_alert_run_prefixes
  WHERE run_id = p_run_id;

  UPDATE public.planning_alert_runs
  SET digest_payload = p_digest_payload,
      source_application_count = v_source_count,
      processed_prefix_count = v_processed,
      total_prefix_count = v_total,
      status = CASE WHEN v_processed = v_total THEN 'generated' ELSE 'processing' END,
      generated_at = CASE
        WHEN v_processed = v_total THEN timezone('utc'::text, now())
        ELSE generated_at
      END,
      last_progress_at = timezone('utc'::text, now()),
      error_message = NULL
  WHERE id = p_run_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_planning_alert_run_prefix(
  p_run_id uuid,
  p_postcode_prefix text,
  p_error_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempts integer;
BEGIN
  SELECT attempts INTO v_attempts
  FROM public.planning_alert_run_prefixes
  WHERE run_id = p_run_id AND postcode_prefix = p_postcode_prefix;

  UPDATE public.planning_alert_run_prefixes
  SET status = CASE WHEN COALESCE(v_attempts, 0) >= 3 THEN 'failed' ELSE 'pending' END,
      claimed_at = NULL,
      error_message = left(p_error_message, 1000)
  WHERE run_id = p_run_id AND postcode_prefix = p_postcode_prefix;

  UPDATE public.planning_alert_runs
  SET status = CASE WHEN COALESCE(v_attempts, 0) >= 3 THEN 'failed' ELSE 'processing' END,
      error_message = left(p_error_message, 1000),
      last_progress_at = timezone('utc'::text, now())
  WHERE id = p_run_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_planning_alert_run_prefix(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_planning_alert_run_prefix(uuid, text, integer, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_planning_alert_run_prefix(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_planning_alert_run_prefix(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_planning_alert_run_prefix(uuid, text, integer, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_planning_alert_run_prefix(uuid, text, text) TO service_role;
