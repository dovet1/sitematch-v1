-- A durable, independently budgeted queue for the operator research pass.

ALTER TABLE public.developments
  ADD COLUMN research_state text NOT NULL DEFAULT 'not_eligible',
  ADD COLUMN research_started_at timestamptz;

ALTER TABLE public.developments
  ADD CONSTRAINT developments_research_state CHECK (
    research_state IN ('not_eligible', 'queued', 'processing', 'complete', 'failed', 'deferred_budget')
  );

UPDATE public.developments
SET research_state = 'queued'
WHERE escalate_for_research;

COMMENT ON COLUMN public.developments.research_state IS
  'Durable state for the paid document and web research pass. Complete includes a grounded no-operator result.';

CREATE INDEX developments_research_queue_idx
  ON public.developments (research_state, research_started_at, last_seen_at DESC)
  WHERE escalate_for_research
    AND research_state IN ('queued', 'processing', 'failed', 'deferred_budget');

CREATE OR REPLACE FUNCTION public.claim_next_planning_research(
  p_stale_before timestamptz
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_development public.developments%ROWTYPE;
  v_application public.planning_applications%ROWTYPE;
BEGIN
  SELECT d.*
  INTO v_development
  FROM public.developments d
  WHERE d.escalate_for_research
    AND (
      d.research_state IN ('queued', 'failed', 'deferred_budget')
      OR (
        d.research_state = 'processing'
        AND (d.research_started_at IS NULL OR d.research_started_at < p_stale_before)
      )
    )
  ORDER BY d.last_seen_at DESC, d.id
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_development.id IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_development.research_state = 'processing' THEN
    -- As with initial classification, an expired lease may represent a provider call that
    -- completed remotely. Preserve and conservatively charge its reservation.
    UPDATE public.planning_ai_usage u
    SET status = 'complete', actual_usd = u.reserved_usd
    WHERE u.classification_run_id IN (
      SELECT r.id FROM public.planning_classification_runs r
      WHERE r.development_id = v_development.id AND r.stage IN ('document', 'web')
    ) AND u.status = 'reserved';

    UPDATE public.planning_classification_runs r
    SET status = 'failed',
        error = 'Research lease expired; the attempt was reclaimed by a later worker',
        cost_usd = COALESCE(
          r.cost_usd,
          (SELECT sum(u.actual_usd) FROM public.planning_ai_usage u
           WHERE u.classification_run_id = r.id AND u.status = 'complete')
        ),
        finished_at = now()
    WHERE r.development_id = v_development.id
      AND r.stage IN ('document', 'web')
      AND r.status = 'running';
  END IF;

  UPDATE public.developments d
  SET research_state = 'processing', research_started_at = now(), updated_at = now()
  WHERE d.id = v_development.id;

  SELECT pa.*
  INTO v_application
  FROM public.development_applications da
  JOIN public.planning_applications pa ON pa.id = da.planning_application_id
  WHERE da.development_id = v_development.id
  ORDER BY CASE da.role WHEN 'primary' THEN 0 WHEN 'principal' THEN 1 ELSE 2 END,
           pa.date_received DESC NULLS LAST
  LIMIT 1;

  IF v_application.id IS NULL THEN
    RAISE EXCEPTION 'Research development % has no planning application', v_development.id;
  END IF;

  RETURN jsonb_build_object(
    'development_id', v_development.id,
    'planning_application_id', v_application.id,
    'input_hash', v_application.input_hash,
    'raw', v_application.raw
  );
END $$;

REVOKE ALL ON FUNCTION public.claim_next_planning_research(timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_planning_research(timestamptz)
  TO service_role;
