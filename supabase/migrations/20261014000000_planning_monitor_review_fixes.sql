-- Planning Monitor: fixes from the review of 20261012.
--
-- 1. Weekly briefings are scheduled for every active patch, not only those with email on. Email is
--    a delivery preference; the in-app weekly report does not depend on it. The delivery step still
--    checks email_enabled and unsubscribed_at before creating or sending an email.
-- 2. planning_monitor_finish_run saves a generated report and creates its delivery in one
--    transaction, so a crash between the two can no longer leave a report without its email.
-- 3. Claiming a delivery always moves it to 'sending' under a lease. A retried 'ambiguous' delivery
--    used to stay ambiguous, so a second worker could claim it again before the first finished.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.planning_monitor_enqueue_due(p_now timestamptz DEFAULT now(), p_limit integer DEFAULT 100)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_count integer := 0;
  r record;
  v_end timestamptz;
  v_start timestamptz;
BEGIN
  FOR r IN
    SELECT s.id, s.patch_id, s.next_due_at, s.timezone, p.current_revision_id
    FROM public.planning_monitor_subscriptions s
    JOIN public.planning_monitor_patches p ON p.id = s.patch_id
    -- No email condition: the weekly report is generated for everyone; delivery decides on email.
    WHERE s.next_due_at <= p_now
      AND p.is_active AND p.archived_at IS NULL AND p.needs_attention IS NULL AND p.current_revision_id IS NOT NULL
    ORDER BY s.next_due_at
    LIMIT LEAST(GREATEST(p_limit, 1), 1000)
    FOR UPDATE OF s SKIP LOCKED
  LOOP
    v_end := date_trunc('week', r.next_due_at AT TIME ZONE r.timezone) AT TIME ZONE r.timezone;
    v_start := (date_trunc('week', r.next_due_at AT TIME ZONE r.timezone) - interval '7 days') AT TIME ZONE r.timezone;
    -- The revision is snapshotted here, so an edit made while the run waits cannot create a second email.
    INSERT INTO public.planning_monitor_digest_runs
      (patch_id, revision_id, subscription_id, kind, period_start, period_end, period_label)
    VALUES (r.patch_id, r.current_revision_id, r.id, 'scheduled', v_start, v_end,
      to_char(v_start AT TIME ZONE r.timezone, 'FMDD Mon') || ' – ' || to_char((v_end - interval '1 second') AT TIME ZONE r.timezone, 'FMDD Mon YYYY'))
    ON CONFLICT (subscription_id, period_start, period_end) WHERE kind = 'scheduled' DO NOTHING;
    IF FOUND THEN v_count := v_count + 1; END IF;
    UPDATE public.planning_monitor_subscriptions
    SET next_due_at = public.planning_monitor_next_weekly_due(GREATEST(r.next_due_at, p_now), r.timezone), updated_at = now()
    WHERE id = r.id;
  END LOOP;
  RETURN v_count;
END $$;

-- Save a claimed run's report and, when owed, its one delivery. Returns false when the lease was lost
-- (the run is no longer running under this worker), in which case nothing is written.
CREATE OR REPLACE FUNCTION public.planning_monitor_finish_run(
  p_run_id uuid,
  p_lease_owner text,
  p_result jsonb,
  p_delivery jsonb DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  UPDATE public.planning_monitor_digest_runs SET
    status = 'generated',
    report = p_result->'report',
    input_snapshot = p_result->'input_snapshot',
    summary_kind = p_result->>'summary_kind',
    coverage = p_result->'coverage',
    source_cutoff = (p_result->>'source_cutoff')::timestamptz,
    model = p_result->>'model',
    prompt_version = p_result->>'prompt_version',
    usage = CASE WHEN jsonb_typeof(p_result->'usage') = 'null' THEN NULL ELSE p_result->'usage' END,
    latency_ms = (p_result->>'latency_ms')::integer,
    generated_at = now(),
    lease_owner = NULL,
    lease_expires_at = NULL,
    error = NULL
  WHERE id = p_run_id AND status = 'running' AND lease_owner IS NOT DISTINCT FROM p_lease_owner;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF p_delivery IS NOT NULL AND jsonb_typeof(p_delivery) = 'object' THEN
    INSERT INTO public.planning_monitor_deliveries (run_id, subscription_id, user_id, email, delivery_key)
    VALUES (p_run_id, (p_delivery->>'subscription_id')::uuid, (p_delivery->>'user_id')::uuid,
            p_delivery->>'email', p_delivery->>'delivery_key')
    ON CONFLICT (delivery_key) DO NOTHING;
  END IF;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.planning_monitor_claim_delivery(p_lease interval DEFAULT interval '5 minutes', p_max_attempts integer DEFAULT 5)
RETURNS SETOF public.planning_monitor_deliveries
LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  UPDATE public.planning_monitor_deliveries d SET
    -- A retry of an ambiguous send is in flight like any other, so it is leased like any other.
    state = 'sending',
    attempts = d.attempts + 1,
    lease_expires_at = now() + p_lease,
    sending_started_at = COALESCE(d.sending_started_at, now()),
    updated_at = now()
  WHERE d.id = (
    SELECT id FROM public.planning_monitor_deliveries
    WHERE next_attempt_at <= now() AND attempts < p_max_attempts
      AND (state IN ('pending', 'ambiguous') OR (state = 'sending' AND lease_expires_at < now()))
    ORDER BY next_attempt_at
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING d.*;
$$;

REVOKE ALL ON FUNCTION public.planning_monitor_finish_run(uuid, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.planning_monitor_finish_run(uuid, text, jsonb, jsonb) TO service_role;
-- CREATE OR REPLACE keeps the existing grants on the two replaced functions.

COMMIT;
