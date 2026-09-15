-- Development linking, step 5: one Development per family, with rules that protect it.
-- See docs/planning-development-linking-plan.md, "Step 5".
--
-- The planner in development-membership.ts decides what a family should look like. This migration
-- adds the columns that record it, the functions that apply and undo it atomically, the trigger
-- change that stops paperwork overwriting a scheme, a classification gate for the gap between
-- storing an application and linking it, and a tab read that knows each application's role.
--
-- Nothing here changes a Development by itself. Membership changes only when the planner's plan is
-- applied, by script or by ingestion with PLANNING_MEMBERSHIP_ENABLED on.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '10min';

-- 1. Developments record their principal, their family state and, once emptied, where they went.
ALTER TABLE public.developments
  ADD COLUMN IF NOT EXISTS principal_application_id uuid REFERENCES public.planning_applications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS latest_activity_at timestamptz,
  ADD COLUMN IF NOT EXISTS merged_into_development_id uuid REFERENCES public.developments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merged_at timestamptz,
  ADD COLUMN IF NOT EXISTS family_state text NOT NULL DEFAULT 'single';

ALTER TABLE public.developments DROP CONSTRAINT IF EXISTS developments_family_state;
ALTER TABLE public.developments ADD CONSTRAINT developments_family_state CHECK (
  family_state IN ('single', 'family', 'awaiting_original', 'held_for_review')
);

COMMENT ON COLUMN public.developments.principal_application_id IS
  'The application whose classification writes this Development''s description, relevance and figures. NULL on a single application (its primary member writes) and on a paperwork-only family awaiting its original.';
COMMENT ON COLUMN public.developments.merged_into_development_id IS
  'Set when every application moved into another Development. The row is kept so the move can be undone.';

-- 2. Membership records why an application joined and where it came from.
ALTER TABLE public.development_applications
  ADD COLUMN IF NOT EXISTS phase text,
  ADD COLUMN IF NOT EXISTS joined_at timestamptz,
  ADD COLUMN IF NOT EXISTS previous_development_id uuid REFERENCES public.developments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS link_ids uuid[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS development_applications_development_idx
  ON public.development_applications (development_id);

-- 3. Every membership change, with enough before-state to undo it.
CREATE TABLE IF NOT EXISTS public.development_membership_events (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id          uuid NOT NULL REFERENCES public.developments(id) ON DELETE CASCADE,
  planning_application_id uuid REFERENCES public.planning_applications(id) ON DELETE SET NULL,
  action                  text NOT NULL,
  actor                   text NOT NULL,
  reason                  text,
  before_state            jsonb,
  after_state             jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT development_membership_events_action CHECK (
    action IN ('create', 'attach', 'move', 'role', 'merge_source', 'principal', 'detach', 'restore')
  )
);
CREATE INDEX IF NOT EXISTS development_membership_events_development_idx
  ON public.development_membership_events (development_id, created_at DESC);
CREATE INDEX IF NOT EXISTS development_membership_events_application_idx
  ON public.development_membership_events (planning_application_id, created_at DESC);

ALTER TABLE public.development_membership_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.development_membership_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.development_membership_events TO service_role;

-- 4. The gap between storing an application and linking it. Ingestion sets 'pending' when linking
-- is on; linking and membership clear it. Nullable with no default, so adding it does not rewrite
-- the 614k-row table.
ALTER TABLE public.planning_applications
  ADD COLUMN IF NOT EXISTS linking_state text;
ALTER TABLE public.planning_applications DROP CONSTRAINT IF EXISTS planning_applications_linking_state;
ALTER TABLE public.planning_applications ADD CONSTRAINT planning_applications_linking_state
  CHECK (linking_state IS NULL OR linking_state = 'pending') NOT VALID;
ALTER TABLE public.planning_applications VALIDATE CONSTRAINT planning_applications_linking_state;

-- 5. Guards, shared by apply and detach.
CREATE OR REPLACE FUNCTION public.planning_development_is_protected(p_development public.developments)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT p_development.review_state <> 'pending'
    OR p_development.research_state IN ('processing', 'complete')
    OR EXISTS (
      SELECT 1 FROM public.development_facts f
      WHERE f.development_id = p_development.id AND f.decided_by IS NOT NULL
    );
$$;

CREATE OR REPLACE FUNCTION public.planning_development_snapshot(p_development_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'relevance', d.relevance, 'confidence', d.confidence, 'summary', d.summary,
    'escalate_for_research', d.escalate_for_research, 'research_state', d.research_state,
    'family_state', d.family_state, 'principal_application_id', d.principal_application_id,
    'merged_into_development_id', d.merged_into_development_id
  )
  FROM public.developments d WHERE d.id = p_development_id;
$$;

CREATE OR REPLACE FUNCTION public.planning_create_development_for(p_application_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.developments (
    canonical_name, site_address, postcode, uprn, location, location_provenance,
    lifecycle_stage, first_seen_at, last_seen_at
  )
  SELECT
    COALESCE(NULLIF(a.address, ''), NULLIF(left(a.description, 160), ''), a.reference),
    a.address, a.postcode, a.uprn, a.location, a.location_provenance,
    a.stage, a.first_seen_at, a.last_seen_at
  FROM public.planning_applications a WHERE a.id = p_application_id
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'No planning application %', p_application_id;
  END IF;
  RETURN v_id;
END $$;

-- 6. Apply one family's plan atomically.
--
-- p_plan (from development-membership.ts):
--   targetDevelopmentId | null, headApplicationId, principalApplicationId | null, familyState,
--   members: [{ applicationId, role, linkIds }], clearMachineGrade, queueClassification: [],
--   admitByFamily: []
--
-- Every guard the planner applied is re-checked here under lock, so a plan computed from a stale
-- read fails rather than overriding a review that happened in between.
CREATE OR REPLACE FUNCTION public.planning_apply_family_plan(p_plan jsonb, p_actor text, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_target public.developments%ROWTYPE;
  v_target_id uuid := NULLIF(p_plan->>'targetDevelopmentId', '')::uuid;
  v_head uuid := (p_plan->>'headApplicationId')::uuid;
  v_principal uuid := NULLIF(p_plan->>'principalApplicationId', '')::uuid;
  v_family_state text := p_plan->>'familyState';
  v_member jsonb;
  v_application_id uuid;
  v_role text;
  v_link_ids uuid[];
  v_source text;
  v_membership public.development_applications%ROWTYPE;
  v_source_dev public.developments%ROWTYPE;
  v_involved uuid[];
  v_moved integer := 0;
  v_attached integer := 0;
  v_merged uuid[] := '{}';
  v_protected boolean;
BEGIN
  IF v_family_state NOT IN ('family', 'awaiting_original') THEN
    RAISE EXCEPTION 'Unknown family state %', v_family_state;
  END IF;
  IF p_actor IS NULL OR p_actor = '' THEN
    RAISE EXCEPTION 'An actor is required';
  END IF;

  -- Lock every Development involved in id order, so two families sharing one cannot deadlock.
  SELECT array_agg(DISTINCT development_id ORDER BY development_id) INTO v_involved
  FROM (
    SELECT da.development_id FROM public.development_applications da
    WHERE da.planning_application_id IN (
      SELECT (m->>'applicationId')::uuid FROM jsonb_array_elements(p_plan->'members') m
    )
    UNION SELECT v_target_id WHERE v_target_id IS NOT NULL
  ) involved;
  PERFORM 1 FROM public.developments WHERE id = ANY(COALESCE(v_involved, '{}')) ORDER BY id FOR UPDATE;

  IF v_target_id IS NULL THEN
    v_target_id := public.planning_create_development_for(COALESCE(v_principal, v_head));
    INSERT INTO public.development_membership_events (development_id, planning_application_id, action, actor, reason, after_state)
    VALUES (v_target_id, COALESCE(v_principal, v_head), 'create', p_actor, p_reason, public.planning_development_snapshot(v_target_id));
  END IF;
  SELECT * INTO v_target FROM public.developments WHERE id = v_target_id FOR UPDATE;
  IF v_target.id IS NULL THEN
    RAISE EXCEPTION 'Target Development % does not exist', v_target_id;
  END IF;
  IF v_target.merged_into_development_id IS NOT NULL THEN
    RAISE EXCEPTION 'Target Development % was merged into %', v_target_id, v_target.merged_into_development_id;
  END IF;
  v_protected := public.planning_development_is_protected(v_target);

  IF v_protected AND v_principal IS DISTINCT FROM COALESCE(v_target.principal_application_id, (
    SELECT da.planning_application_id FROM public.development_applications da
    WHERE da.development_id = v_target_id AND da.role IN ('primary', 'principal')
    ORDER BY da.created_at LIMIT 1
  )) THEN
    RAISE EXCEPTION 'Development % has been reviewed or researched; its principal cannot change automatically', v_target_id;
  END IF;

  FOR v_member IN SELECT * FROM jsonb_array_elements(p_plan->'members') LOOP
    v_application_id := (v_member->>'applicationId')::uuid;
    v_role := v_member->>'role';
    IF v_role NOT IN ('principal', 'amendment', 'member', 'condition', 'related') THEN
      RAISE EXCEPTION 'Unknown membership role %', v_role;
    END IF;
    SELECT COALESCE(array_agg(value::uuid), '{}') INTO v_link_ids
    FROM jsonb_array_elements_text(COALESCE(v_member->'linkIds', '[]'::jsonb));
    SELECT CASE WHEN bool_or(l.source = 'plota_associated') THEN 'plota_associated'
                WHEN bool_or(l.source = 'manual') THEN 'manual'
                ELSE 'cited_reference' END
    INTO v_source
    FROM public.planning_application_links l WHERE l.id = ANY(v_link_ids);
    v_source := COALESCE(v_source, 'cited_reference');

    SELECT * INTO v_membership FROM public.development_applications
    WHERE planning_application_id = v_application_id FOR UPDATE;

    IF v_membership.development_id = v_target_id THEN
      IF v_membership.role IS DISTINCT FROM v_role THEN
        UPDATE public.development_applications
        SET role = v_role, link_ids = v_link_ids
        WHERE planning_application_id = v_application_id;
        INSERT INTO public.development_membership_events (development_id, planning_application_id, action, actor, reason, before_state, after_state)
        VALUES (v_target_id, v_application_id, 'role', p_actor, p_reason,
          jsonb_build_object('role', v_membership.role), jsonb_build_object('role', v_role));
      END IF;
      CONTINUE;
    END IF;

    IF v_protected AND v_role NOT IN ('condition', 'related') THEN
      RAISE EXCEPTION 'Only paperwork may join Development %, which has been reviewed or researched', v_target_id;
    END IF;

    IF v_membership.development_id IS NULL THEN
      INSERT INTO public.development_applications (
        development_id, planning_application_id, role, relationship_source, confidence, joined_at, link_ids
      ) VALUES (v_target_id, v_application_id, v_role, v_source, 0.9, now(), v_link_ids);
      INSERT INTO public.development_membership_events (development_id, planning_application_id, action, actor, reason, after_state)
      VALUES (v_target_id, v_application_id, 'attach', p_actor, p_reason, jsonb_build_object('role', v_role, 'link_ids', v_link_ids));
      v_attached := v_attached + 1;
      CONTINUE;
    END IF;

    SELECT * INTO v_source_dev FROM public.developments WHERE id = v_membership.development_id;
    IF public.planning_development_is_protected(v_source_dev) THEN
      RAISE EXCEPTION 'Application % belongs to Development %, which has been reviewed or researched', v_application_id, v_source_dev.id;
    END IF;

    INSERT INTO public.development_membership_events (development_id, planning_application_id, action, actor, reason, before_state, after_state)
    VALUES (v_target_id, v_application_id, 'move', p_actor, p_reason,
      jsonb_build_object(
        'development_id', v_source_dev.id, 'role', v_membership.role,
        'relationship_source', v_membership.relationship_source, 'confidence', v_membership.confidence,
        'development', public.planning_development_snapshot(v_source_dev.id)
      ),
      jsonb_build_object('role', v_role, 'link_ids', v_link_ids));

    UPDATE public.development_applications
    SET development_id = v_target_id, role = v_role, relationship_source = v_source, confidence = 0.9,
        joined_at = now(), previous_development_id = v_source_dev.id, link_ids = v_link_ids
    WHERE planning_application_id = v_application_id;
    UPDATE public.development_observations SET development_id = v_target_id
    WHERE planning_application_id = v_application_id AND development_id = v_source_dev.id;
    UPDATE public.development_brand_signals SET development_id = v_target_id
    WHERE planning_application_id = v_application_id AND development_id = v_source_dev.id;
    v_moved := v_moved + 1;

    IF NOT EXISTS (SELECT 1 FROM public.development_applications WHERE development_id = v_source_dev.id) THEN
      -- Kept, not deleted: its classification runs and the move's before-state make it undoable.
      UPDATE public.developments
      SET merged_into_development_id = v_target_id, merged_at = now(), relevance = NULL,
          escalate_for_research = false, research_state = 'not_eligible', updated_at = now()
      WHERE id = v_source_dev.id;
      INSERT INTO public.development_membership_events (development_id, planning_application_id, action, actor, reason, before_state)
      VALUES (v_source_dev.id, v_application_id, 'merge_source', p_actor, p_reason,
        jsonb_build_object('merged_into_development_id', v_target_id));
      v_merged := v_merged || v_source_dev.id;
    END IF;
  END LOOP;

  -- The principal describes the scheme. Paperwork never does.
  INSERT INTO public.development_membership_events (development_id, planning_application_id, action, actor, reason, before_state)
  VALUES (v_target_id, v_principal, 'principal', p_actor, p_reason, public.planning_development_snapshot(v_target_id));

  UPDATE public.developments d SET
    principal_application_id = v_principal,
    family_state = v_family_state,
    canonical_name = COALESCE(NULLIF(p.address, ''), d.canonical_name),
    site_address = COALESCE(p.address, d.site_address),
    postcode = COALESCE(p.postcode, d.postcode),
    lifecycle_stage = COALESCE(p.stage, d.lifecycle_stage),
    latest_activity_at = (
      SELECT max(COALESCE(a.date_decided, a.date_validated, a.date_received))::timestamptz
      FROM public.development_applications da
      JOIN public.planning_applications a ON a.id = da.planning_application_id
      WHERE da.development_id = v_target_id
    ),
    updated_at = now()
  FROM (SELECT NULL::int AS _) anchor
  LEFT JOIN public.planning_applications p ON p.id = v_principal
  WHERE d.id = v_target_id;

  IF COALESCE((p_plan->>'clearMachineGrade')::boolean, false) AND NOT v_protected THEN
    UPDATE public.developments
    SET relevance = NULL, confidence = NULL, summary = NULL,
        escalate_for_research = false, research_state = 'not_eligible', updated_at = now()
    WHERE id = v_target_id AND review_state = 'pending';
  END IF;

  -- A principal outside the tier joins it because its family qualifies.
  UPDATE public.planning_applications
  SET intelligence_tier = true,
      eligibility_limbs = CASE WHEN 'F' = ANY(eligibility_limbs) THEN eligibility_limbs ELSE array_append(eligibility_limbs, 'F') END,
      classification_state = 'queued', classification_started_at = NULL, updated_at = now()
  WHERE id IN (SELECT value::uuid FROM jsonb_array_elements_text(COALESCE(p_plan->'admitByFamily', '[]'::jsonb)))
    AND id = v_principal;

  UPDATE public.planning_applications
  SET classification_state = 'queued', classification_started_at = NULL, updated_at = now()
  WHERE id IN (SELECT value::uuid FROM jsonb_array_elements_text(COALESCE(p_plan->'queueClassification', '[]'::jsonb)))
    AND id = v_principal
    AND intelligence_tier
    AND classification_state <> 'processing';

  RETURN jsonb_build_object(
    'development_id', v_target_id, 'moved', v_moved, 'attached', v_attached, 'merged', to_jsonb(v_merged)
  );
END $$;

-- 7. Undo one application's membership. The links that joined it are marked removed, so neither the
-- linker nor a later Plota family puts it back.
CREATE OR REPLACE FUNCTION public.planning_detach_application(p_application_id uuid, p_actor text, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_membership public.development_applications%ROWTYPE;
  v_development public.developments%ROWTYPE;
  v_previous public.developments%ROWTYPE;
  v_move_before jsonb;
  v_new uuid;
  v_removed integer;
  v_tier boolean;
BEGIN
  IF p_actor IS NULL OR p_actor = '' OR p_reason IS NULL OR p_reason = '' THEN
    RAISE EXCEPTION 'An actor and a reason are required to detach';
  END IF;
  SELECT * INTO v_membership FROM public.development_applications
  WHERE planning_application_id = p_application_id FOR UPDATE;
  IF v_membership.development_id IS NULL THEN
    RAISE EXCEPTION 'Application % belongs to no Development', p_application_id;
  END IF;
  SELECT * INTO v_development FROM public.developments WHERE id = v_membership.development_id FOR UPDATE;
  IF v_development.principal_application_id = p_application_id
     OR (v_development.principal_application_id IS NULL AND v_membership.role IN ('primary', 'principal')) THEN
    RAISE EXCEPTION 'Application % describes Development %; detach its members instead', p_application_id, v_development.id;
  END IF;

  UPDATE public.planning_application_links l
  SET removed_at = now(), removed_by = p_actor, removed_reason = 'detached: ' || p_reason, updated_at = now()
  WHERE l.removed_at IS NULL
    AND (
      l.id = ANY(v_membership.link_ids)
      OR (l.child_application_id = p_application_id AND l.parent_application_id IN (
        SELECT planning_application_id FROM public.development_applications WHERE development_id = v_development.id
      ))
    );
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  INSERT INTO public.development_membership_events (development_id, planning_application_id, action, actor, reason, before_state)
  VALUES (v_development.id, p_application_id, 'detach', p_actor, p_reason,
    jsonb_build_object('role', v_membership.role, 'link_ids', v_membership.link_ids, 'links_removed', v_removed));

  IF v_membership.previous_development_id IS NOT NULL THEN
    SELECT * INTO v_previous FROM public.developments WHERE id = v_membership.previous_development_id FOR UPDATE;
  END IF;

  IF v_previous.id IS NOT NULL AND v_previous.merged_into_development_id = v_development.id THEN
    SELECT e.before_state INTO v_move_before
    FROM public.development_membership_events e
    WHERE e.planning_application_id = p_application_id AND e.action = 'move'
      AND e.development_id = v_development.id AND (e.before_state->>'development_id')::uuid = v_previous.id
    ORDER BY e.created_at DESC LIMIT 1;

    UPDATE public.development_applications
    SET development_id = v_previous.id,
        role = COALESCE(v_move_before->>'role', 'primary'),
        relationship_source = COALESCE(v_move_before->>'relationship_source', 'initial'),
        confidence = COALESCE((v_move_before->>'confidence')::numeric, 1),
        previous_development_id = NULL, link_ids = '{}', joined_at = now()
    WHERE planning_application_id = p_application_id;
    UPDATE public.development_observations SET development_id = v_previous.id
    WHERE planning_application_id = p_application_id AND development_id = v_development.id;
    UPDATE public.development_brand_signals SET development_id = v_previous.id
    WHERE planning_application_id = p_application_id AND development_id = v_development.id;
    UPDATE public.developments SET
      merged_into_development_id = NULL, merged_at = NULL,
      relevance = v_move_before->'development'->>'relevance',
      escalate_for_research = COALESCE((v_move_before->'development'->>'escalate_for_research')::boolean, false),
      research_state = COALESCE(v_move_before->'development'->>'research_state', 'not_eligible'),
      family_state = COALESCE(v_move_before->'development'->>'family_state', 'single'),
      updated_at = now()
    WHERE id = v_previous.id;
    INSERT INTO public.development_membership_events (development_id, planning_application_id, action, actor, reason, after_state)
    VALUES (v_previous.id, p_application_id, 'restore', p_actor, p_reason, public.planning_development_snapshot(v_previous.id));
    RETURN jsonb_build_object('development_id', v_previous.id, 'restored', true, 'links_removed', v_removed);
  END IF;

  SELECT intelligence_tier INTO v_tier FROM public.planning_applications WHERE id = p_application_id;
  IF NOT v_tier THEN
    DELETE FROM public.development_applications WHERE planning_application_id = p_application_id;
    RETURN jsonb_build_object('development_id', NULL, 'restored', false, 'links_removed', v_removed);
  END IF;

  v_new := public.planning_create_development_for(p_application_id);
  UPDATE public.development_applications
  SET development_id = v_new, role = 'primary', relationship_source = 'initial', confidence = 1,
      previous_development_id = NULL, link_ids = '{}', joined_at = now()
  WHERE planning_application_id = p_application_id;
  UPDATE public.development_observations SET development_id = v_new
  WHERE planning_application_id = p_application_id AND development_id = v_development.id;
  UPDATE public.development_brand_signals SET development_id = v_new
  WHERE planning_application_id = p_application_id AND development_id = v_development.id;
  -- Its earlier reading was never written to a Development of its own, so it is read again.
  UPDATE public.planning_applications
  SET classification_state = 'queued', classification_started_at = NULL, updated_at = now()
  WHERE id = p_application_id AND classification_state <> 'processing';
  INSERT INTO public.development_membership_events (development_id, planning_application_id, action, actor, reason, after_state)
  VALUES (v_new, p_application_id, 'create', p_actor, p_reason, public.planning_development_snapshot(v_new));
  RETURN jsonb_build_object('development_id', v_new, 'restored', false, 'links_removed', v_removed);
END $$;

REVOKE ALL ON FUNCTION public.planning_development_is_protected(public.developments) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.planning_development_snapshot(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.planning_create_development_for(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.planning_apply_family_plan(jsonb, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.planning_detach_application(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.planning_development_is_protected(public.developments) TO service_role;
GRANT EXECUTE ON FUNCTION public.planning_development_snapshot(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.planning_create_development_for(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.planning_apply_family_plan(jsonb, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.planning_detach_application(uuid, text, text) TO service_role;

-- 8. Only the principal (or a single application) describes its Development. Any member may still
-- improve the location, and every tier member advances the latest activity.
CREATE OR REPLACE FUNCTION public.ensure_development_for_planning_application()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_development_id uuid;
  v_role text;
  v_principal uuid;
  v_describes boolean;
BEGIN
  IF NEW.intelligence_tier IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT da.development_id, da.role, d.principal_application_id
  INTO v_development_id, v_role, v_principal
  FROM public.development_applications da
  JOIN public.developments d ON d.id = da.development_id
  WHERE da.planning_application_id = NEW.id;

  IF v_development_id IS NULL THEN
    INSERT INTO public.developments (
      canonical_name, site_address, postcode, uprn, location, location_provenance,
      lifecycle_stage, first_seen_at, last_seen_at, latest_activity_at
    ) VALUES (
      COALESCE(NULLIF(NEW.address, ''), NULLIF(left(NEW.description, 160), ''), NEW.reference),
      NEW.address, NEW.postcode, NEW.uprn, NEW.location, NEW.location_provenance,
      NEW.stage, NEW.first_seen_at, NEW.last_seen_at,
      COALESCE(NEW.date_decided, NEW.date_validated, NEW.date_received)::timestamptz
    ) RETURNING id INTO v_development_id;

    INSERT INTO public.development_applications (
      development_id, planning_application_id, role, relationship_source, confidence, joined_at
    ) VALUES (v_development_id, NEW.id, 'primary', 'initial', 1, now());
  ELSE
    v_describes := v_principal = NEW.id OR (v_principal IS NULL AND v_role IN ('primary', 'principal'));
    UPDATE public.developments SET
      site_address = CASE WHEN v_describes THEN COALESCE(NEW.address, site_address) ELSE site_address END,
      postcode = CASE WHEN v_describes THEN COALESCE(NEW.postcode, postcode) ELSE postcode END,
      uprn = CASE WHEN v_describes THEN COALESCE(NEW.uprn, uprn) ELSE uprn END,
      -- Take the incoming point only when it is genuinely better evidence.
      location = CASE
        WHEN NEW.location IS NOT NULL
         AND public.location_provenance_rank(NEW.location_provenance)
             > public.location_provenance_rank(location_provenance)
        THEN NEW.location
        WHEN v_describes AND NEW.location IS NOT NULL
         AND public.location_provenance_rank(NEW.location_provenance)
             = public.location_provenance_rank(location_provenance)
        THEN NEW.location
        ELSE location END,
      location_provenance = CASE
        WHEN NEW.location IS NOT NULL
         AND (public.location_provenance_rank(NEW.location_provenance)
              > public.location_provenance_rank(location_provenance)
           OR (v_describes AND public.location_provenance_rank(NEW.location_provenance)
              = public.location_provenance_rank(location_provenance)))
        THEN NEW.location_provenance ELSE location_provenance END,
      lifecycle_stage = CASE WHEN v_describes THEN COALESCE(NEW.stage, lifecycle_stage) ELSE lifecycle_stage END,
      latest_activity_at = GREATEST(latest_activity_at, COALESCE(NEW.date_decided, NEW.date_validated, NEW.date_received)::timestamptz),
      last_seen_at = GREATEST(last_seen_at, NEW.last_seen_at),
      updated_at = now()
    WHERE id = v_development_id;
  END IF;

  RETURN NEW;
END $$;

-- 9. The classifier waits while an application is between storage and linking. A pending mark older
-- than an hour is ignored, so a linking failure delays classification rather than stopping it.
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
    AND (pa.linking_state IS NULL OR pa.updated_at < now() - interval '1 hour')
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

-- 10. The tab read, with each application's role in its Development and the family's state.
-- Same rows as v3. Paperwork ranks after every scheme, so it can never crowd a scheme out of the
-- record cap; the tab shows it inside its development, not as an opportunity of its own.
CREATE OR REPLACE FUNCTION public.planning_tab_applications_v4(
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
  eligibility_limbs       text[],
  intelligence_tier       boolean,
  development_id          uuid,
  development_role        text,
  family_state            text,
  relevance               text,
  summary                 text,
  model_dwelling_count    integer,
  creates_commercial_space text,
  model_dwelling_basis    text
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH boundary AS (
    SELECT
      g.geom,
      g.geom::geography AS geog,
      ST_Expand(
        g.geom,
        1.02 * m.max_allowance / (111320 * cos(radians(LEAST(89, GREATEST(abs(ST_YMin(g.geom)), abs(ST_YMax(g.geom))))))),
        1.02 * m.max_allowance / 110574
      ) AS search_box
    FROM (SELECT ST_SetSRID(ST_GeomFromGeoJSON(p_boundary::text), 4326) AS geom) g
    CROSS JOIN (
      SELECT GREATEST(
        public.planning_location_uncertainty_m('source_exact'),
        public.planning_location_uncertainty_m('source_centroid'),
        public.planning_location_uncertainty_m('postcode_centroid'),
        public.planning_location_uncertainty_m('missing')
      ) AS max_allowance
    ) m
  ),
  candidates AS (
    SELECT
      a.id,
      a.date_received,
      a.commercial_work,
      a.stated_dwelling_count,
      a.eligibility_limbs,
      ST_Intersects(a.location::geometry, b.geom) AS inside,
      public.planning_location_uncertainty_m(a.location_provenance) AS allowance,
      a.location
    FROM public.planning_applications a
    CROSS JOIN boundary b
    WHERE a.location IS NOT NULL
      AND a.location::geometry && b.search_box
  ),
  kept AS (
    SELECT
      c.id,
      c.date_received,
      c.inside,
      c.allowance,
      da.development_id,
      da.role,
      CASE
        WHEN da.role IN ('condition', 'related') THEN 4
        WHEN d.relevance = 'high' THEN 0
        WHEN d.relevance = 'medium' THEN 1
        WHEN d.relevance = 'low' THEN 2
        ELSE 3
      END AS band
    FROM candidates c
    CROSS JOIN boundary b
    LEFT JOIN public.development_applications da ON da.planning_application_id = c.id
    LEFT JOIN public.developments d ON d.id = da.development_id AND d.review_state <> 'rejected'
    WHERE (
        c.inside
        OR (c.allowance > 0 AND ST_DWithin(c.location, b.geog, c.allowance, false))
      )
      AND (
        c.eligibility_limbs && ARRAY['A', 'A-described', 'D', 'D-described']::text[]
        OR d.creates_commercial_space = 'yes'
        OR CASE
          WHEN d.model_dwelling_basis = 'human_review' THEN d.model_dwelling_count
          ELSE COALESCE(c.stated_dwelling_count, d.model_dwelling_count)
        END >= 15
      )
    ORDER BY band, c.date_received DESC NULLS LAST, c.id
    LIMIT GREATEST(COALESCE(p_limit, 2000), 1)
  )
  SELECT
    row_number() OVER (ORDER BY k.band, k.date_received DESC NULLS LAST, k.id) AS sort_rank,
    a.id,
    a.provider_id,
    a.authority_name,
    a.reference,
    a.address,
    a.status,
    a.stage,
    a.planning_route,
    a.procedure,
    a.commercial_work,
    a.stated_floorspace_sqm,
    a.description,
    a.links,
    ST_X(a.location::geometry)::double precision AS longitude,
    ST_Y(a.location::geometry)::double precision AS latitude,
    a.location_provenance,
    k.allowance AS location_uncertainty_m,
    k.inside AS inside_boundary,
    a.date_received,
    a.date_decided,
    a.date_validated,
    a.stated_dwelling_count,
    a.eligibility_limbs,
    a.intelligence_tier,
    k.development_id,
    k.role AS development_role,
    d.family_state,
    d.relevance,
    d.summary,
    d.model_dwelling_count,
    d.creates_commercial_space,
    d.model_dwelling_basis
  FROM kept k
  JOIN public.planning_applications a ON a.id = k.id
  LEFT JOIN public.developments d ON d.id = k.development_id AND d.review_state <> 'rejected'
  ORDER BY sort_rank;
$$;

COMMENT ON FUNCTION public.planning_tab_applications_v4(jsonb, integer) IS
  'Planning tab ranked read: v3''s rows plus each application''s role in its Development and the family state; paperwork ranks after every scheme.';

REVOKE ALL ON FUNCTION public.planning_tab_applications_v4(jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.planning_tab_applications_v4(jsonb, integer) TO service_role;

COMMIT;
