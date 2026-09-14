-- Audited review fields and optimistic locking. Run before using the new review screen.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public.developments DROP CONSTRAINT developments_model_dwelling_basis;
ALTER TABLE public.developments ADD CONSTRAINT developments_model_dwelling_basis CHECK (model_dwelling_basis IS NULL OR model_dwelling_basis IN ('stated', 'counted_from_description', 'not_stated', 'human_review'));
ALTER TABLE public.planning_review_events ADD COLUMN before_snapshot jsonb, ADD COLUMN after_snapshot jsonb;

CREATE INDEX developments_review_confidence_idx ON public.developments (confidence ASC NULLS FIRST, last_seen_at DESC, id) WHERE review_state = 'pending' AND relevance IS NOT NULL;

CREATE OR REPLACE FUNCTION public.apply_planning_review_v2(
  p_development_id uuid,
  p_reviewer_id    text,
  p_decision       text,
  p_relevance      text DEFAULT NULL,
  p_summary        text DEFAULT NULL,
  p_brand_signals  jsonb DEFAULT '[]'::jsonb,
  p_observations   jsonb DEFAULT '[]'::jsonb,
  p_fields jsonb DEFAULT '{}'::jsonb,
  p_expected_updated_at timestamptz DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dev              public.developments%ROWTYPE;
  v_before jsonb;
  v_event_id uuid;
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

  IF p_expected_updated_at IS NOT NULL AND v_dev.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'This development changed. Reload before saving.' USING ERRCODE = '40001';
  END IF;
  v_before := jsonb_build_object('development', to_jsonb(v_dev),
    'brandSignals', (SELECT coalesce(jsonb_agg(to_jsonb(s)), '[]') FROM public.development_brand_signals s WHERE development_id = p_development_id),
    'observations', (SELECT coalesce(jsonb_agg(to_jsonb(o)), '[]') FROM public.development_observations o WHERE development_id = p_development_id));
  -- Validate child ownership before any write; never silently ignore another record's ID.
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_brand_signals) j WHERE NOT EXISTS (
    SELECT 1 FROM public.development_brand_signals s WHERE s.id = (j->>'id')::uuid AND s.development_id = p_development_id))
    OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_observations) j WHERE NOT EXISTS (
    SELECT 1 FROM public.development_observations o WHERE o.id = (j->>'id')::uuid AND o.development_id = p_development_id)) THEN
    RAISE EXCEPTION 'Evidence does not belong to this development' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_observations) j
    JOIN public.development_observations o ON o.id = (j->>'id')::uuid
    WHERE coalesce((j->>'value')::numeric, o.value) < 0 AND coalesce(j->>'scope', o.scope) <> 'net') THEN
    RAISE EXCEPTION 'Only a net observation can be negative' USING ERRCODE = '22023';
  END IF;
  -- Corrected commercial status must participate in research queue reconciliation below.
  v_dev.creates_commercial_space := coalesce(p_fields->>'createsCommercialSpace', v_dev.creates_commercial_space);
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
  ) RETURNING id INTO v_event_id;

  UPDATE public.developments
  SET review_state = p_decision,
      relevance = v_relevance_after,
      creates_commercial_space = v_dev.creates_commercial_space,
      model_dwelling_count = CASE WHEN p_fields ? 'dwellingCount' THEN (p_fields->>'dwellingCount')::integer ELSE model_dwelling_count END,
      model_dwelling_basis = CASE WHEN p_fields ? 'dwellingCount' THEN 'human_review' ELSE model_dwelling_basis END,
      commercial_use_classes = CASE WHEN p_fields ? 'commercialUseClasses' THEN ARRAY(SELECT jsonb_array_elements_text(p_fields->'commercialUseClasses')) ELSE commercial_use_classes END,
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

  UPDATE public.planning_review_events SET
    before_snapshot = v_before,
    after_snapshot = jsonb_build_object(
      'development', (SELECT to_jsonb(d) FROM public.developments d WHERE id = p_development_id),
      'brandSignals', (SELECT coalesce(jsonb_agg(to_jsonb(s)), '[]') FROM public.development_brand_signals s WHERE development_id = p_development_id),
      'observations', (SELECT coalesce(jsonb_agg(to_jsonb(o)), '[]') FROM public.development_observations o WHERE development_id = p_development_id))
  WHERE id = v_event_id;

  RETURN jsonb_build_object('review_event_id', v_event_id,
    'development_id', p_development_id,
    'relevance', v_relevance_after,
    'review_state', p_decision,
    'research_state', v_research_after,
    'escalate_for_research', v_escalate_after,
    'research_state_before', v_dev.research_state
  );
END $$;

REVOKE ALL ON FUNCTION public.apply_planning_review_v2(uuid, text, text, text, text, jsonb, jsonb, jsonb, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_planning_review_v2(uuid, text, text, text, text, jsonb, jsonb, jsonb, timestamptz)
  TO service_role;

-- Include human provenance so a corrected unknown/zero overrides the provider figure.
CREATE OR REPLACE FUNCTION public.planning_tab_applications_v2(
  p_boundary jsonb,
  p_limit integer DEFAULT 2000
)
RETURNS TABLE (
  sort_rank               bigint,
  id                      uuid,
  provider_id             text,
  authority_name          text,
  reference               text,
  address                 text,
  status                  text,
  stage                   text,
  planning_route          text,
  procedure               text,
  commercial_work         text,
  stated_floorspace_sqm   numeric,
  description             text,
  links                   jsonb,
  longitude               double precision,
  latitude                double precision,
  location_provenance     text,
  location_uncertainty_m  double precision,
  inside_boundary         boolean,
  date_received           date,
  date_decided            date,
  date_validated          date,
  stated_dwelling_count   integer,
  intelligence_tier       boolean,
  development_id          uuid,
  relevance               text,
  summary                 text,
  model_dwelling_count    integer,
  creates_commercial_space text,
  model_dwelling_basis text
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH boundary AS (
    SELECT
      ST_SetSRID(ST_GeomFromGeoJSON(p_boundary::text), 4326) AS geom,
      ST_SetSRID(ST_GeomFromGeoJSON(p_boundary::text), 4326)::geography AS geog
  ),
  matched AS (
    SELECT
      a.*,
      public.planning_location_uncertainty_m(a.location_provenance) AS uncertainty_m,
      ST_Intersects(a.location::geometry, b.geom) AS exactly_inside
    FROM public.planning_applications a
    CROSS JOIN boundary b
    WHERE a.location IS NOT NULL
      -- One predicate covers both cases: at zero uncertainty ST_DWithin is exactly
      -- ST_Intersects, so an exact point still has to fall inside the drawn area.
      AND ST_DWithin(
        a.location,
        b.geog,
        public.planning_location_uncertainty_m(a.location_provenance)
      )
  )
  SELECT
    row_number() OVER (
      ORDER BY
        CASE d.relevance
          WHEN 'high'   THEN 0
          WHEN 'medium' THEN 1
          WHEN 'low'    THEN 2
          ELSE 3
        END,
        -- Within a band, newest first; id last so the order is total and a page boundary
        -- cannot show the same record twice or skip one.
        m.date_received DESC NULLS LAST,
        m.id
    ) AS sort_rank,
    m.id,
    m.provider_id,
    m.authority_name,
    m.reference,
    m.address,
    m.status,
    m.stage,
    m.planning_route,
    m.procedure,
    m.commercial_work,
    m.stated_floorspace_sqm,
    m.description,
    m.links,
    ST_X(m.location::geometry)::double precision AS longitude,
    ST_Y(m.location::geometry)::double precision AS latitude,
    m.location_provenance,
    m.uncertainty_m AS location_uncertainty_m,
    m.exactly_inside AS inside_boundary,
    m.date_received,
    m.date_decided,
    m.date_validated,
    m.stated_dwelling_count,
    m.intelligence_tier,
    da.development_id,
    d.relevance,
    d.summary,
    d.model_dwelling_count,
    d.creates_commercial_space,
    d.model_dwelling_basis
  FROM matched m
  LEFT JOIN public.development_applications da ON da.planning_application_id = m.id
  LEFT JOIN public.developments d ON d.id = da.development_id AND d.review_state <> 'rejected'
  ORDER BY sort_rank
  LIMIT GREATEST(COALESCE(p_limit, 2000), 1);
$$;

COMMENT ON FUNCTION public.planning_tab_applications_v2(jsonb, integer) IS
  'Planning tab read: applications in or near a boundary, joined to their Development classification and ranked by relevance before the record cap.';

REVOKE ALL ON FUNCTION public.planning_location_uncertainty_m(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.planning_tab_applications_v2(jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.planning_location_uncertainty_m(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.planning_tab_applications_v2(jsonb, integer) TO service_role;

COMMIT;
