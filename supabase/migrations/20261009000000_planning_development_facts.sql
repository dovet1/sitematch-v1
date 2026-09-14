-- Pilot completion plan, steps 2, 4 and 5: the completeness checklist, research that always ends in
-- a known state, and admin completion. See docs/planning-pilot-completion-plan.md.
--
-- One row per Development and fact. Findings from every source accumulate in `findings` and are
-- never erased; `state` and `value` are recomputed from them by the research worker, unless an admin
-- has decided the fact, in which case machine writes only attach findings and attempts.

CREATE TABLE IF NOT EXISTS public.development_facts (
  development_id uuid NOT NULL REFERENCES public.developments(id) ON DELETE CASCADE,
  fact           text NOT NULL,
  state          text NOT NULL DEFAULT 'not_checked',
  reason         text,
  value          jsonb,
  findings       jsonb NOT NULL DEFAULT '[]'::jsonb,
  attempts       jsonb NOT NULL DEFAULT '[]'::jsonb,
  decided_by     text,
  decided_at     timestamptz,
  admin_note     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (development_id, fact),
  CONSTRAINT development_facts_fact CHECK (fact IN (
    'operator', 'existing_use_class', 'proposed_use_class', 'existing_floorspace',
    'proposed_floorspace', 'net_floorspace', 'site_area'
  )),
  CONSTRAINT development_facts_state CHECK (state IN (
    'not_checked', 'found', 'not_found_after_research', 'conflicting', 'unavailable', 'not_applicable'
  )),
  CONSTRAINT development_facts_reason CHECK (reason IS NULL OR reason IN (
    'documents_inaccessible', 'documents_silent', 'provider_failure', 'attempt_limit'
  )),
  CONSTRAINT development_facts_decision CHECK ((decided_by IS NULL) = (decided_at IS NULL))
);

-- The admin completion queue: open facts no admin has decided.
CREATE INDEX IF NOT EXISTS development_facts_open_idx
  ON public.development_facts (updated_at DESC)
  WHERE state IN ('not_found_after_research', 'conflicting') AND decided_by IS NULL;

CREATE TABLE IF NOT EXISTS public.development_fact_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id uuid NOT NULL REFERENCES public.developments(id) ON DELETE CASCADE,
  fact           text NOT NULL,
  action         text NOT NULL,
  reviewer_id    text NOT NULL,
  before_row     jsonb,
  after_row      jsonb,
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT development_fact_events_action CHECK (action IN ('add', 'choose', 'unavailable', 'not_applicable', 'reopen'))
);
CREATE INDEX IF NOT EXISTS development_fact_events_development_idx
  ON public.development_fact_events (development_id, created_at DESC);

-- Research attempts are counted when claimed, so a crashed worker still uses one up.
ALTER TABLE public.developments
  ADD COLUMN IF NOT EXISTS research_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS research_outcome text,
  ADD COLUMN IF NOT EXISTS research_finished_at timestamptz;

ALTER TABLE public.developments DROP CONSTRAINT IF EXISTS developments_research_outcome;
ALTER TABLE public.developments ADD CONSTRAINT developments_research_outcome CHECK (
  research_outcome IS NULL OR research_outcome IN ('all_found', 'facts_unresolved', 'attempt_limit')
);

-- Machine write. Findings are unioned by key with the stored row winning, so an admin's rejection
-- of a finding survives. State, reason and value change only on rows no admin has decided.
CREATE OR REPLACE FUNCTION public.planning_record_development_facts(p_development_id uuid, p_rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_row jsonb;
  v_count integer := 0;
BEGIN
  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    INSERT INTO public.development_facts AS f (development_id, fact, state, reason, value, findings, attempts)
    VALUES (
      p_development_id, v_row->>'fact', v_row->>'state', v_row->>'reason', v_row->'value',
      coalesce(v_row->'findings', '[]'::jsonb), coalesce(v_row->'attempts', '[]'::jsonb)
    )
    ON CONFLICT (development_id, fact) DO UPDATE SET
      findings = (
        SELECT coalesce(jsonb_agg(item ORDER BY item->>'observedAt', item->>'key'), '[]'::jsonb)
        FROM (
          SELECT DISTINCT ON (item->>'key') item
          FROM (
            SELECT item, 0 AS rank FROM jsonb_array_elements(f.findings) item
            UNION ALL
            SELECT item, 1 AS rank FROM jsonb_array_elements(EXCLUDED.findings) item
          ) candidates
          ORDER BY item->>'key', rank
        ) merged
      ),
      attempts = EXCLUDED.attempts,
      state = CASE WHEN f.decided_by IS NULL THEN EXCLUDED.state ELSE f.state END,
      reason = CASE WHEN f.decided_by IS NULL THEN EXCLUDED.reason ELSE f.reason END,
      value = CASE WHEN f.decided_by IS NULL THEN EXCLUDED.value ELSE f.value END,
      updated_at = now();
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

-- Admin write, one transaction with an audit event.
--   add:            append p_finding (origin admin) and set the value; state found.
--   choose:         set the value from the conflicting findings, marking p_reject_keys rejected.
--   unavailable:    close the task without a value; never shown as found.
--   not_applicable: the fact does not apply to this scheme.
--   reopen:         undo a decision; the row returns to machine control and the worker's next write.
CREATE OR REPLACE FUNCTION public.planning_complete_development_fact(
  p_development_id uuid,
  p_fact text,
  p_action text,
  p_reviewer_id text,
  p_value jsonb DEFAULT NULL,
  p_finding jsonb DEFAULT NULL,
  p_reject_keys text[] DEFAULT '{}',
  p_note text DEFAULT NULL,
  p_expected_updated_at timestamptz DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_before public.development_facts%ROWTYPE;
  v_after  public.development_facts%ROWTYPE;
BEGIN
  IF p_action NOT IN ('add', 'choose', 'unavailable', 'not_applicable', 'reopen') THEN
    RAISE EXCEPTION 'Unknown fact action %', p_action USING ERRCODE = '22023';
  END IF;
  IF p_action IN ('add', 'choose') AND p_value IS NULL THEN
    RAISE EXCEPTION 'A value is required to % a fact', p_action USING ERRCODE = '22023';
  END IF;
  IF p_action = 'add' AND (p_finding IS NULL OR p_finding->>'key' IS NULL) THEN
    RAISE EXCEPTION 'Adding a fact requires its evidence' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.development_facts (development_id, fact)
  VALUES (p_development_id, p_fact)
  ON CONFLICT (development_id, fact) DO NOTHING;

  SELECT * INTO v_before FROM public.development_facts
  WHERE development_id = p_development_id AND fact = p_fact FOR UPDATE;

  IF p_expected_updated_at IS NOT NULL AND v_before.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'This fact changed. Reload before saving.' USING ERRCODE = 'PT409';
  END IF;

  UPDATE public.development_facts f SET
    findings = CASE
      WHEN p_action = 'add' THEN f.findings || jsonb_build_array(p_finding)
      WHEN p_action = 'choose' THEN (
        SELECT coalesce(jsonb_agg(CASE WHEN item->>'key' = ANY(p_reject_keys)
          THEN item || '{"rejected": true}'::jsonb ELSE item END), '[]'::jsonb)
        FROM jsonb_array_elements(f.findings) item
      )
      ELSE f.findings
    END,
    state = CASE p_action
      WHEN 'add' THEN 'found' WHEN 'choose' THEN 'found'
      WHEN 'unavailable' THEN 'unavailable' WHEN 'not_applicable' THEN 'not_applicable'
      ELSE 'not_checked' END,
    value = CASE WHEN p_action IN ('add', 'choose') THEN p_value ELSE NULL END,
    reason = CASE WHEN p_action = 'reopen' THEN f.reason ELSE NULL END,
    decided_by = CASE WHEN p_action = 'reopen' THEN NULL ELSE p_reviewer_id END,
    decided_at = CASE WHEN p_action = 'reopen' THEN NULL ELSE now() END,
    admin_note = coalesce(p_note, f.admin_note),
    updated_at = now()
  WHERE f.development_id = p_development_id AND f.fact = p_fact
  RETURNING * INTO v_after;

  INSERT INTO public.development_fact_events (development_id, fact, action, reviewer_id, before_row, after_row, note)
  VALUES (p_development_id, p_fact, p_action, p_reviewer_id, to_jsonb(v_before), to_jsonb(v_after), p_note);

  RETURN to_jsonb(v_after);
END $$;

-- The research claim, now with an attempt limit. Attempts are counted at claim time. An expired
-- lease that has used its last attempt is finished here rather than reclaimed: the development
-- ends as 'attempt_limit' and every fact still unanswered is handed to the admin queue, so no
-- scheme can sit in a retry loop outside it.
CREATE OR REPLACE FUNCTION public.claim_next_planning_research(
  p_stale_before timestamptz,
  p_attempt_limit integer,
  -- A pilot names its schemes; NULL claims from the whole queue.
  p_development_ids uuid[]
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_development public.developments%ROWTYPE;
  v_application public.planning_applications%ROWTYPE;
  v_exhausted uuid[];
BEGIN
  WITH exhausted AS (
    UPDATE public.developments d
    SET research_state = 'complete', research_outcome = 'attempt_limit',
        research_started_at = NULL, research_finished_at = now(), updated_at = now()
    WHERE d.escalate_for_research
      AND (p_development_ids IS NULL OR d.id = ANY(p_development_ids))
      AND d.research_attempts >= p_attempt_limit
      AND (
        d.research_state = 'failed'
        OR (d.research_state = 'processing' AND (d.research_started_at IS NULL OR d.research_started_at < p_stale_before))
      )
    RETURNING d.id
  )
  SELECT array_agg(id) INTO v_exhausted FROM exhausted;

  IF v_exhausted IS NOT NULL THEN
    INSERT INTO public.development_facts AS f (development_id, fact, state, reason)
    SELECT id, fact, 'not_found_after_research', 'attempt_limit'
    FROM unnest(v_exhausted) id
    CROSS JOIN unnest(ARRAY['operator', 'existing_use_class', 'proposed_use_class', 'existing_floorspace',
      'proposed_floorspace', 'net_floorspace', 'site_area']) fact
    ON CONFLICT (development_id, fact) DO UPDATE SET
      state = 'not_found_after_research', reason = 'attempt_limit', updated_at = now()
    WHERE f.decided_by IS NULL AND f.state IN ('not_checked', 'not_found_after_research');

    UPDATE public.planning_classification_runs r
    SET status = 'failed', error = 'Research lease expired on its last attempt', finished_at = now()
    WHERE r.development_id = ANY(v_exhausted) AND r.stage IN ('document', 'web') AND r.status = 'running';

    UPDATE public.planning_ai_usage u
    SET status = 'complete', actual_usd = u.reserved_usd
    WHERE u.status = 'reserved' AND u.classification_run_id IN (
      SELECT r.id FROM public.planning_classification_runs r
      WHERE r.development_id = ANY(v_exhausted) AND r.stage IN ('document', 'web')
    );
  END IF;

  SELECT d.*
  INTO v_development
  FROM public.developments d
  WHERE d.escalate_for_research
    AND (p_development_ids IS NULL OR d.id = ANY(p_development_ids))
    AND d.research_attempts < p_attempt_limit
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

  -- A budget deferral did not spend an attempt, so it does not count one.
  UPDATE public.developments d
  SET research_state = 'processing', research_started_at = now(), updated_at = now(),
      research_attempts = d.research_attempts + CASE WHEN d.research_state = 'deferred_budget' THEN 0 ELSE 1 END
  WHERE d.id = v_development.id
  RETURNING d.* INTO v_development;

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
    'raw', v_application.raw,
    'attempt', v_development.research_attempts,
    'attempt_limit', p_attempt_limit
  );
END $$;

-- The one-argument version stays callable by deployed workers until they are redeployed. No default
-- on the two-argument version, so a one-argument call is never ambiguous.
CREATE OR REPLACE FUNCTION public.claim_next_planning_research(p_stale_before timestamptz)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public.claim_next_planning_research(p_stale_before, 2, NULL::uuid[]);
$$;

ALTER TABLE public.development_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.development_fact_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.development_facts, public.development_fact_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.development_facts TO service_role;
GRANT SELECT, INSERT ON public.development_fact_events TO service_role;
REVOKE ALL ON FUNCTION public.planning_record_development_facts(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.planning_record_development_facts(uuid, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.planning_complete_development_fact(uuid, text, text, text, jsonb, jsonb, text[], text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.planning_complete_development_fact(uuid, text, text, text, jsonb, jsonb, text[], text, timestamptz) TO service_role;
REVOKE ALL ON FUNCTION public.claim_next_planning_research(timestamptz, integer, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_planning_research(timestamptz, integer, uuid[]) TO service_role;
REVOKE ALL ON FUNCTION public.claim_next_planning_research(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_planning_research(timestamptz) TO service_role;
