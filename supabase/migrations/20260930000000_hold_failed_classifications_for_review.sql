-- Each classification already gets three provider attempts. Leave exhausted items
-- in failed for review/manual requeue instead of paying to retry them every batch.
-- Healthy queued work and stale processing leases remain eligible. No rows are deleted.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE OR REPLACE FUNCTION public.claim_next_planning_classification(
  p_stale_before timestamptz
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_application public.planning_applications%ROWTYPE;
  v_reclaimed boolean;
BEGIN
  SELECT pa.*
  INTO v_application
  FROM public.planning_applications pa
  WHERE pa.intelligence_tier
    AND pa.classification_state IN ('queued', 'failed', 'deferred_budget', 'processing')
    AND (
      pa.classification_state IN ('queued', 'deferred_budget')
      OR (
        pa.classification_state = 'processing'
        AND (
          pa.classification_started_at IS NULL
          OR pa.classification_started_at < p_stale_before
        )
      )
    )
  ORDER BY pa.date_received DESC NULLS LAST, pa.id
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_application.id IS NULL THEN
    RETURN NULL;
  END IF;

  v_reclaimed := v_application.classification_state = 'processing';

  IF v_reclaimed THEN
    -- Once processing begins the provider may already have billed us, even if no answer
    -- reached the worker. Conservatively charge abandoned reservations in full rather than
    -- releasing them and allowing retries to exceed the hard monthly ceiling.
    UPDATE public.planning_ai_usage u
    SET status = 'complete', actual_usd = u.reserved_usd
    WHERE u.planning_application_id = v_application.id
      AND u.status = 'reserved';

    UPDATE public.planning_classification_runs r
    SET status = 'failed',
        error = 'Classification lease expired; the attempt was reclaimed by a later worker',
        cost_usd = COALESCE(
          r.cost_usd,
          (SELECT sum(u.actual_usd)
           FROM public.planning_ai_usage u
           WHERE u.classification_run_id = r.id AND u.status = 'complete')
        ),
        finished_at = now()
    WHERE r.planning_application_id = v_application.id
      AND r.status = 'running';
  END IF;

  UPDATE public.planning_applications pa
  SET classification_state = 'processing',
      classification_started_at = now(),
      updated_at = now()
  WHERE pa.id = v_application.id;

  RETURN jsonb_build_object(
    'id', v_application.id,
    'provider_id', v_application.provider_id,
    'input_hash', v_application.input_hash,
    'raw', v_application.raw,
    'reclaimed', v_reclaimed
  );
END $$;

REVOKE ALL ON FUNCTION public.claim_next_planning_classification(timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_planning_classification(timestamptz)
  TO service_role;



COMMIT;
