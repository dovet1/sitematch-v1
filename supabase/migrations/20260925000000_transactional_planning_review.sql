-- Make a planning review atomic, audited, and authoritative over the research queue.
--
-- Three faults, all reproduced against the live handler before this was written.
--
-- 1. A correction did not stop paid work. The review endpoint never touched
--    `escalate_for_research` or `research_state`, and `claim_next_planning_research` selects
--    on exactly those. Correcting a record from high to low returned 200, changed relevance,
--    and left the record queued for a research pass costing roughly 200x a classification.
--
-- 2. Nothing recorded that a review happened. The reviewer's verdict overwrote the model's in
--    place, so afterwards there was no way to say "the model said high and a person said low"
--    without reconstructing it from run history. Those corrections are the only labels the
--    product generates for free, and they were being destroyed as they were made.
--
-- 3. The handler issued five or more separate writes with no transaction, so a failure part
--    way through left the projection inconsistent with the applications and the queue.
--
-- The whole review now happens inside one function, under a row lock on the development, so
-- it cannot interleave with a worker claiming that same row.

CREATE TABLE public.planning_review_events (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id       uuid NOT NULL REFERENCES public.developments(id) ON DELETE CASCADE,
  reviewer_id          text NOT NULL,
  decision             text NOT NULL,
  -- Before and after are both stored because the pair IS the training signal. A corrected
  -- row alone says what is true; only the pair says what the model got wrong.
  relevance_before     text,
  relevance_after      text,
  review_state_before  text,
  review_state_after   text,
  research_state_before text,
  research_state_after  text,
  -- Provenance, so a correction can later be tied to the exact model output it corrected.
  prompt_version       text,
  model                text,
  input_hash           text,
  summary_changed      boolean NOT NULL DEFAULT false,
  reviewed_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT planning_review_events_decision CHECK (
    decision IN ('approved', 'corrected', 'rejected')
  )
);

CREATE INDEX planning_review_events_development_idx
  ON public.planning_review_events (development_id, reviewed_at DESC);

-- Corrections are the raw material for error analysis and for worked examples, so reading
-- them back by what changed has to be cheap.
CREATE INDEX planning_review_events_corrections_idx
  ON public.planning_review_events (relevance_before, relevance_after)
  WHERE relevance_before IS DISTINCT FROM relevance_after;

ALTER TABLE public.planning_review_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.planning_review_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.planning_review_events TO service_role;

CREATE OR REPLACE FUNCTION public.apply_planning_review(
  p_development_id uuid,
  p_reviewer_id    text,
  p_decision       text,
  p_relevance      text DEFAULT NULL,
  p_summary        text DEFAULT NULL,
  p_brand_signals  jsonb DEFAULT '[]'::jsonb,
  p_observations   jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dev              public.developments%ROWTYPE;
  v_relevance_after  text;
  v_research_after   text;
  v_escalate_after   boolean;
  v_wanted           boolean;
  v_run              record;
  v_signal           jsonb;
  v_observation      jsonb;
BEGIN
  -- The lock is the point. `claim_next_planning_research` takes FOR UPDATE SKIP LOCKED on
  -- this same row, so whichever arrives first wins cleanly and the loser sees the result
  -- rather than a half-applied state.
  SELECT * INTO v_dev FROM public.developments WHERE id = p_development_id FOR UPDATE;
  IF v_dev.id IS NULL THEN
    RAISE EXCEPTION 'Development % does not exist', p_development_id;
  END IF;

  v_relevance_after := COALESCE(p_relevance, v_dev.relevance);

  -- Is this record still wanted for paid research after the review?
  v_wanted := p_decision <> 'rejected'
              AND v_relevance_after = 'high'
              AND v_dev.creates_commercial_space = 'yes';

  -- Reconciliation. The rule everywhere below is that money already committed is never
  -- discarded and never spent twice.
  IF v_wanted THEN
    v_escalate_after := true;
    v_research_after := CASE
      -- Already paid for, or being paid for: leave it. Re-queueing a completed research pass
      -- because someone corrected the relevance upward would buy the same answer again.
      WHEN v_dev.research_state IN ('processing', 'complete') THEN v_dev.research_state
      -- Never ran, and now wanted.
      WHEN v_dev.research_state IN ('not_eligible', 'queued', 'failed', 'deferred_budget')
        THEN 'queued'
      ELSE v_dev.research_state
    END;
  ELSE
    -- No longer wanted. Clearing the flag is what actually stops the worker, because the
    -- claim query filters on it.
    v_escalate_after := false;
    v_research_after := CASE
      -- Nothing has been spent on these, so they can simply leave the queue.
      WHEN v_dev.research_state IN ('queued', 'deferred_budget', 'not_eligible') THEN 'not_eligible'
      -- In flight. A remote call may already be billing, and it cannot be recalled: let it
      -- land and keep its history. Clearing escalate stops it being claimed again.
      WHEN v_dev.research_state = 'processing' THEN 'processing'
      -- Finished, one way or the other. The spend and the result are real history.
      ELSE v_dev.research_state
    END;
  END IF;

  -- Provenance of the output being corrected, taken from the newest completed initial run.
  SELECT r.prompt_version, r.model, r.input_hash
  INTO v_run
  FROM public.planning_classification_runs r
  WHERE r.development_id = p_development_id AND r.stage = 'initial' AND r.status = 'complete'
  ORDER BY r.finished_at DESC NULLS LAST
  LIMIT 1;

  INSERT INTO public.planning_review_events (
    development_id, reviewer_id, decision,
    relevance_before, relevance_after,
    review_state_before, review_state_after,
    research_state_before, research_state_after,
    prompt_version, model, input_hash, summary_changed
  ) VALUES (
    p_development_id, p_reviewer_id, p_decision,
    v_dev.relevance, v_relevance_after,
    v_dev.review_state, p_decision,
    v_dev.research_state, v_research_after,
    v_run.prompt_version, v_run.model, v_run.input_hash,
    p_summary IS NOT NULL AND p_summary IS DISTINCT FROM v_dev.summary
  );

  UPDATE public.developments
  SET review_state = p_decision,
      relevance = v_relevance_after,
      summary = COALESCE(p_summary, summary),
      escalate_for_research = v_escalate_after,
      research_state = v_research_after,
      updated_at = now()
  WHERE id = p_development_id;

  FOR v_signal IN SELECT * FROM jsonb_array_elements(p_brand_signals) LOOP
    UPDATE public.development_brand_signals
    SET review_state = v_signal->>'reviewState',
        brand_id = CASE WHEN v_signal ? 'brandId'
                        THEN NULLIF(v_signal->>'brandId', '')::uuid ELSE brand_id END,
        role = COALESCE(v_signal->>'role', role),
        updated_at = now()
    WHERE id = (v_signal->>'id')::uuid AND development_id = p_development_id;
  END LOOP;

  FOR v_observation IN SELECT * FROM jsonb_array_elements(p_observations) LOOP
    UPDATE public.development_observations
    SET review_state = v_observation->>'reviewState',
        scope = COALESCE(v_observation->>'scope', scope),
        value = COALESCE((v_observation->>'value')::numeric, value),
        confidence = COALESCE((v_observation->>'confidence')::numeric, confidence)
    WHERE id = (v_observation->>'id')::uuid AND development_id = p_development_id;
  END LOOP;

  -- Mirrors the decision onto the applications so a reviewed item does not return to the
  -- review queue.
  UPDATE public.planning_applications pa
  SET review_state = p_decision, updated_at = now()
  FROM public.development_applications da
  WHERE da.development_id = p_development_id AND pa.id = da.planning_application_id;

  RETURN jsonb_build_object(
    'development_id', p_development_id,
    'relevance', v_relevance_after,
    'review_state', p_decision,
    'research_state', v_research_after,
    'escalate_for_research', v_escalate_after,
    'research_state_before', v_dev.research_state
  );
END $$;

REVOKE ALL ON FUNCTION public.apply_planning_review(uuid, text, text, text, text, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_planning_review(uuid, text, text, text, text, jsonb, jsonb)
  TO service_role;
