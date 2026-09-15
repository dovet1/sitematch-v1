-- Planning Monitor: saved patches, the shared match predicate behind the map, list, count and
-- weekly digest, a material-change ledger, and the weekly briefing/delivery ledgers.
-- Plan: docs/planning-monitor-implementation-plan.md (phases 2, 4 and 5).
--
-- Everything the Monitor reads is the core planning record. No enrichment table is required: a
-- qualifying application with no development, no classification and no researched facts still
-- matches, counts and appears.
--
-- Base eligibility is the Planning tab's contract (20261010): commercial schemes, or housing with a
-- confirmed count of at least 15 homes, where a human dwelling correction is authoritative
-- (including a correction to unknown), otherwise Plota's stated count, otherwise the classifier's.
-- It is applied inside every read, so no view can browse smaller residential applications.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15min';

-- ---------------------------------------------------------------------------------------------
-- 1. Indexes for the decided/validated date filters. Received already has one.
-- ---------------------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS planning_applications_decided_idx
  ON public.planning_applications (date_decided DESC) WHERE date_decided IS NOT NULL;
CREATE INDEX IF NOT EXISTS planning_applications_validated_idx
  ON public.planning_applications (date_validated DESC) WHERE date_validated IS NOT NULL;

-- ---------------------------------------------------------------------------------------------
-- 2. Saved patches and their immutable revisions.
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.planning_monitor_patches (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id             uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name                 text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  -- Exactly as supplied; matching always uses this.
  geometry             jsonb NOT NULL CHECK (geometry->>'type' IN ('Polygon', 'MultiPolygon')),
  geom                 geometry(Geometry, 4326) NOT NULL,
  -- A lighter outline for drawing only.
  display_geometry     jsonb NOT NULL,
  geometry_source      text NOT NULL CHECK (geometry_source IN ('drawn', 'uploaded', 'boundary', 'radius')),
  -- Human label for the geometry, e.g. "Leeds · 3.0 mi radius" or "Leeds (local authority)".
  geometry_label       text,
  geometry_ref         jsonb NOT NULL DEFAULT '{}'::jsonb,
  criteria             jsonb NOT NULL,
  criteria_version     integer NOT NULL,
  current_revision_id  uuid,
  current_revision     integer NOT NULL DEFAULT 0,
  is_active            boolean NOT NULL DEFAULT true,
  -- Set when a capability this patch relies on is withdrawn; scheduled reports pause until resolved.
  needs_attention      text,
  archived_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS planning_monitor_patches_owner_idx
  ON public.planning_monitor_patches (owner_id, updated_at DESC) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS public.planning_monitor_patch_revisions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patch_id             uuid NOT NULL REFERENCES public.planning_monitor_patches(id) ON DELETE CASCADE,
  revision             integer NOT NULL,
  name                 text NOT NULL,
  geometry             jsonb NOT NULL,
  geometry_source      text NOT NULL,
  geometry_label       text,
  criteria             jsonb NOT NULL,
  criteria_version     integer NOT NULL,
  criteria_hash        text NOT NULL,
  capability_version   integer NOT NULL,
  created_by           uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (patch_id, revision)
);

ALTER TABLE public.planning_monitor_patches DROP CONSTRAINT IF EXISTS planning_monitor_patches_current_revision_fk;
ALTER TABLE public.planning_monitor_patches ADD CONSTRAINT planning_monitor_patches_current_revision_fk
  FOREIGN KEY (current_revision_id) REFERENCES public.planning_monitor_patch_revisions(id) ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- ---------------------------------------------------------------------------------------------
-- 3. Weekly subscriptions (one per patch at launch) and watches.
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.planning_monitor_subscriptions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patch_id             uuid NOT NULL UNIQUE REFERENCES public.planning_monitor_patches(id) ON DELETE CASCADE,
  user_id              uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  cadence              text NOT NULL DEFAULT 'weekly' CHECK (cadence = 'weekly'),
  timezone             text NOT NULL DEFAULT 'Europe/London',
  email_enabled        boolean NOT NULL DEFAULT false,
  skip_quiet_weeks     boolean NOT NULL DEFAULT false,
  next_due_at          timestamptz,
  unsubscribed_at      timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS planning_monitor_subscriptions_due_idx
  ON public.planning_monitor_subscriptions (next_due_at) WHERE email_enabled AND unsubscribed_at IS NULL;

-- A watch follows the application the user chose. Its development is resolved at read time
-- through development_applications, so a later family merge carries the watch with it.
CREATE TABLE IF NOT EXISTS public.planning_monitor_watches (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  planning_application_id  uuid NOT NULL REFERENCES public.planning_applications(id) ON DELETE CASCADE,
  -- Where the watch was made, for the patch digest's watched section. Not a scope: a watched
  -- development appears in that section even when it no longer passes the patch's filters.
  patch_id                 uuid REFERENCES public.planning_monitor_patches(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, planning_application_id)
);

-- ---------------------------------------------------------------------------------------------
-- 4. Material-change ledger. Written by triggers in the same transaction as the change, so a
--    rolled-back ingest leaves no event, and re-polling an unchanged record writes nothing.
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.planning_change_events (
  id                       bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- Stable identity of this transition; a replay of the same change cannot insert twice.
  event_key                text NOT NULL UNIQUE,
  planning_application_id  uuid REFERENCES public.planning_applications(id) ON DELETE CASCADE,
  development_id           uuid REFERENCES public.developments(id) ON DELETE SET NULL,
  kind                     text NOT NULL CHECK (kind IN (
                             'observed', 'stage_changed', 'status_changed', 'decided',
                             'description_changed', 'dwellings_changed', 'dwellings_reviewed',
                             'location_changed')),
  before                   jsonb,
  after                    jsonb,
  provider_changed_at      timestamptz,
  observed_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT planning_change_events_subject CHECK (planning_application_id IS NOT NULL OR development_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS planning_change_events_observed_idx ON public.planning_change_events (observed_at);
CREATE INDEX IF NOT EXISTS planning_change_events_application_idx
  ON public.planning_change_events (planning_application_id, observed_at);
CREATE INDEX IF NOT EXISTS planning_change_events_development_idx
  ON public.planning_change_events (development_id, observed_at) WHERE development_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.planning_record_change_event(
  p_application_id uuid, p_development_id uuid, p_kind text, p_before jsonb, p_after jsonb, p_provider_changed_at timestamptz
) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.planning_change_events
    (event_key, planning_application_id, development_id, kind, before, after, provider_changed_at)
  VALUES (
    md5(concat_ws('|', p_application_id, p_development_id, p_kind, p_before::text, p_after::text, p_provider_changed_at)),
    p_application_id, p_development_id, p_kind, p_before, p_after, p_provider_changed_at
  )
  ON CONFLICT (event_key) DO NOTHING;
$$;

CREATE OR REPLACE FUNCTION public.planning_application_change_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.planning_record_change_event(NEW.id, NULL, 'observed', NULL,
      jsonb_build_object('stage', NEW.stage, 'status', NEW.status, 'date_received', NEW.date_received,
                         'date_decided', NEW.date_decided, 'stated_dwelling_count', NEW.stated_dwelling_count),
      NEW.source_changed_at);
    RETURN NULL;
  END IF;

  IF NEW.stage IS DISTINCT FROM OLD.stage THEN
    PERFORM public.planning_record_change_event(NEW.id, NULL, 'stage_changed',
      jsonb_build_object('stage', OLD.stage), jsonb_build_object('stage', NEW.stage), NEW.source_changed_at);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Council wording changes without a stage change are recorded but are not headline changes.
    PERFORM public.planning_record_change_event(NEW.id, NULL, 'status_changed',
      jsonb_build_object('status', OLD.status), jsonb_build_object('status', NEW.status), NEW.source_changed_at);
  END IF;
  IF NEW.date_decided IS DISTINCT FROM OLD.date_decided AND NEW.date_decided IS NOT NULL THEN
    PERFORM public.planning_record_change_event(NEW.id, NULL, 'decided',
      jsonb_build_object('date_decided', OLD.date_decided),
      jsonb_build_object('date_decided', NEW.date_decided, 'stage', NEW.stage), NEW.source_changed_at);
  END IF;
  IF NEW.description IS DISTINCT FROM OLD.description THEN
    PERFORM public.planning_record_change_event(NEW.id, NULL, 'description_changed',
      jsonb_build_object('description', OLD.description), jsonb_build_object('description', NEW.description), NEW.source_changed_at);
  END IF;
  IF NEW.stated_dwelling_count IS DISTINCT FROM OLD.stated_dwelling_count THEN
    PERFORM public.planning_record_change_event(NEW.id, NULL, 'dwellings_changed',
      jsonb_build_object('stated_dwelling_count', OLD.stated_dwelling_count),
      jsonb_build_object('stated_dwelling_count', NEW.stated_dwelling_count), NEW.source_changed_at);
  END IF;
  IF NEW.location_provenance IS DISTINCT FROM OLD.location_provenance
     OR (NEW.location IS DISTINCT FROM OLD.location
         AND (NEW.location IS NULL OR OLD.location IS NULL OR NOT ST_DWithin(NEW.location, OLD.location, 50))) THEN
    PERFORM public.planning_record_change_event(NEW.id, NULL, 'location_changed',
      jsonb_build_object('provenance', OLD.location_provenance), jsonb_build_object('provenance', NEW.location_provenance),
      NEW.source_changed_at);
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS planning_application_change_events_insert ON public.planning_applications;
CREATE TRIGGER planning_application_change_events_insert
AFTER INSERT ON public.planning_applications
FOR EACH ROW EXECUTE FUNCTION public.planning_application_change_events();

DROP TRIGGER IF EXISTS planning_application_change_events_update ON public.planning_applications;
CREATE TRIGGER planning_application_change_events_update
AFTER UPDATE OF stage, status, date_decided, description, stated_dwelling_count, location, location_provenance
ON public.planning_applications
FOR EACH ROW
WHEN (
  OLD.stage IS DISTINCT FROM NEW.stage
  OR OLD.status IS DISTINCT FROM NEW.status
  OR OLD.date_decided IS DISTINCT FROM NEW.date_decided
  OR OLD.description IS DISTINCT FROM NEW.description
  OR OLD.stated_dwelling_count IS DISTINCT FROM NEW.stated_dwelling_count
  OR OLD.location IS DISTINCT FROM NEW.location
  OR OLD.location_provenance IS DISTINCT FROM NEW.location_provenance
)
EXECUTE FUNCTION public.planning_application_change_events();

-- Dwelling counts resolved on the development (classifier or human review) change eligibility and
-- totals, so they are material too. A reviewer's correction is recorded as its own kind.
CREATE OR REPLACE FUNCTION public.planning_development_change_events()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.planning_record_change_event(NULL, NEW.id,
    CASE WHEN NEW.model_dwelling_basis = 'human_review' THEN 'dwellings_reviewed' ELSE 'dwellings_changed' END,
    jsonb_build_object('model_dwelling_count', OLD.model_dwelling_count, 'basis', OLD.model_dwelling_basis),
    jsonb_build_object('model_dwelling_count', NEW.model_dwelling_count, 'basis', NEW.model_dwelling_basis),
    now());
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS planning_development_change_events ON public.developments;
CREATE TRIGGER planning_development_change_events
AFTER UPDATE OF model_dwelling_count, model_dwelling_basis ON public.developments
FOR EACH ROW
WHEN (OLD.model_dwelling_count IS DISTINCT FROM NEW.model_dwelling_count
      OR OLD.model_dwelling_basis IS DISTINCT FROM NEW.model_dwelling_basis)
EXECUTE FUNCTION public.planning_development_change_events();

-- ---------------------------------------------------------------------------------------------
-- 5. Digest runs and email deliveries.
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.planning_monitor_digest_runs (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patch_id             uuid NOT NULL REFERENCES public.planning_monitor_patches(id) ON DELETE CASCADE,
  revision_id          uuid NOT NULL REFERENCES public.planning_monitor_patch_revisions(id) ON DELETE CASCADE,
  subscription_id      uuid REFERENCES public.planning_monitor_subscriptions(id) ON DELETE SET NULL,
  -- initial: first briefing after save; preview: after a criteria edit; scheduled: the weekly run.
  kind                 text NOT NULL CHECK (kind IN ('initial', 'preview', 'scheduled')),
  period_start         timestamptz NOT NULL,
  period_end           timestamptz NOT NULL,
  period_label         text NOT NULL,
  source_cutoff        timestamptz,
  status               text NOT NULL DEFAULT 'queued'
                         CHECK (status IN ('queued', 'running', 'generated', 'failed', 'cancelled')),
  attempts             integer NOT NULL DEFAULT 0,
  lease_owner          text,
  lease_expires_at     timestamptz,
  not_before           timestamptz NOT NULL DEFAULT now(),
  -- Frozen evidence: the exact records and changes the summary may speak about.
  input_snapshot       jsonb,
  -- Deterministic counts, highlights and sections, plus the model's validated narrative when present.
  report               jsonb,
  summary_kind         text CHECK (summary_kind IN ('ai', 'fallback', 'no_changes', 'partial')),
  coverage             jsonb,
  model                text,
  prompt_version       text,
  usage                jsonb,
  latency_ms           integer,
  error                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  generated_at         timestamptz,
  CHECK (period_end > period_start)
);
CREATE UNIQUE INDEX IF NOT EXISTS planning_monitor_digest_runs_scheduled_unique
  ON public.planning_monitor_digest_runs (subscription_id, period_start, period_end) WHERE kind = 'scheduled';
CREATE INDEX IF NOT EXISTS planning_monitor_digest_runs_patch_idx
  ON public.planning_monitor_digest_runs (patch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS planning_monitor_digest_runs_queue_idx
  ON public.planning_monitor_digest_runs (not_before) WHERE status IN ('queued', 'running');

CREATE TABLE IF NOT EXISTS public.planning_monitor_deliveries (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id               uuid NOT NULL REFERENCES public.planning_monitor_digest_runs(id) ON DELETE CASCADE,
  subscription_id      uuid NOT NULL REFERENCES public.planning_monitor_subscriptions(id) ON DELETE CASCADE,
  user_id              uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Also sent to Resend as the idempotency key.
  delivery_key         text NOT NULL UNIQUE,
  email                text NOT NULL,
  state                text NOT NULL DEFAULT 'pending' CHECK (state IN (
                         'pending', 'sending', 'sent', 'ambiguous', 'failed', 'bounced', 'complained', 'suppressed')),
  attempts             integer NOT NULL DEFAULT 0,
  provider_message_id  text,
  last_error           text,
  lease_expires_at     timestamptz,
  next_attempt_at      timestamptz NOT NULL DEFAULT now(),
  sending_started_at   timestamptz,
  sent_at              timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS planning_monitor_deliveries_queue_idx
  ON public.planning_monitor_deliveries (next_attempt_at) WHERE state IN ('pending', 'sending', 'ambiguous');

-- ---------------------------------------------------------------------------------------------
-- 6. Row-level security. The API authorises before using the service role; these policies are
--    the second line for any user-scoped client.
-- ---------------------------------------------------------------------------------------------
ALTER TABLE public.planning_monitor_patches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_monitor_patch_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_monitor_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_monitor_watches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_change_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_monitor_digest_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_monitor_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS planning_monitor_patches_owner ON public.planning_monitor_patches;
CREATE POLICY planning_monitor_patches_owner ON public.planning_monitor_patches
  FOR SELECT TO authenticated USING (owner_id = auth.uid());

DROP POLICY IF EXISTS planning_monitor_revisions_owner ON public.planning_monitor_patch_revisions;
CREATE POLICY planning_monitor_revisions_owner ON public.planning_monitor_patch_revisions
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.planning_monitor_patches p WHERE p.id = patch_id AND p.owner_id = auth.uid()));

DROP POLICY IF EXISTS planning_monitor_subscriptions_owner ON public.planning_monitor_subscriptions;
CREATE POLICY planning_monitor_subscriptions_owner ON public.planning_monitor_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS planning_monitor_watches_owner ON public.planning_monitor_watches;
CREATE POLICY planning_monitor_watches_owner ON public.planning_monitor_watches
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS planning_monitor_digest_runs_owner ON public.planning_monitor_digest_runs;
CREATE POLICY planning_monitor_digest_runs_owner ON public.planning_monitor_digest_runs
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.planning_monitor_patches p WHERE p.id = patch_id AND p.owner_id = auth.uid()));

DROP POLICY IF EXISTS planning_monitor_deliveries_owner ON public.planning_monitor_deliveries;
CREATE POLICY planning_monitor_deliveries_owner ON public.planning_monitor_deliveries
  FOR SELECT TO authenticated USING (user_id = auth.uid());
-- Writes go through the API (service role) so geometry, criteria and revision rules cannot be bypassed.
-- planning_change_events has no policy: service role only.

-- ---------------------------------------------------------------------------------------------
-- 7. The match predicate. One builder; every read wraps it.
--
-- p is built by the application (buildPredicate in apps/web/src/lib/planning-monitor/criteria.ts):
--   residential bool, min_dwellings int, commercial bool, commercial_work text[]|null,
--   date_field received|validated|decided, date_from date|null, date_to date|null,
--   stages text[]|null, procedures text[]|null, brand_ids uuid[]|null, radius_m int|null,
--   include text[]|null (LIKE patterns), exclude text[]|null, exact_only bool,
--   watched_application_ids uuid[]|null, application_ids uuid[]|null, boundary geojson|null,
--   bbox [w,s,e,n]|null
--
-- Only active filters are emitted, so the planner sees a plain query and uses the date, spatial
-- and bbox indexes. Every value is bound with format(%L); column names come from a fixed list.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.planning_monitor_match_sql(p jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  v_date_column text;
  v_where text[] := ARRAY['a.location IS NOT NULL'];
  v_branch text[] := ARRAY[]::text[];
  v_boundary text := NULL;
  v_inside text := 'true';
  v_near text := 'NULL::boolean';
  v_min integer := GREATEST(15, COALESCE((p->>'min_dwellings')::integer, 15));
BEGIN
  v_date_column := CASE COALESCE(p->>'date_field', 'received')
    WHEN 'received' THEN 'a.date_received'
    WHEN 'validated' THEN 'a.date_validated'
    WHEN 'decided' THEN 'a.date_decided'
    ELSE NULL END;
  IF v_date_column IS NULL THEN
    RAISE EXCEPTION 'Unknown date field %', p->>'date_field' USING ERRCODE = '22023';
  END IF;

  IF p->>'date_from' IS NOT NULL THEN
    v_where := v_where || format('%s >= %L::date', v_date_column, p->>'date_from');
  END IF;
  IF p->>'date_to' IS NOT NULL THEN
    v_where := v_where || format('%s <= %L::date', v_date_column, p->>'date_to');
  END IF;

  IF jsonb_typeof(p->'bbox') = 'array' THEN
    v_where := v_where || format('a.location::geometry && ST_MakeEnvelope(%s, %s, %s, %s, 4326)',
      (p->'bbox'->>0)::double precision, (p->'bbox'->>1)::double precision,
      (p->'bbox'->>2)::double precision, (p->'bbox'->>3)::double precision);
  END IF;

  IF jsonb_typeof(p->'boundary') = 'object' THEN
    v_boundary := format('ST_SetSRID(ST_GeomFromGeoJSON(%L), 4326)', (p->'boundary')::text);
    -- Search box grown by the widest location allowance (1,500 m) so centroid records near the
    -- edge are considered, then the exact inside/overlap test.
    v_where := v_where || format(
      'a.location::geometry && ST_Expand(b.geom, 1.02 * 1500 / (111320 * cos(radians(LEAST(89, GREATEST(abs(ST_YMin(b.geom)), abs(ST_YMax(b.geom))))))), 1.02 * 1500 / 110574)');
    v_where := v_where || '(ST_Intersects(a.location::geometry, b.geom) OR (public.planning_location_uncertainty_m(a.location_provenance) > 0 AND ST_DWithin(a.location, b.geog, public.planning_location_uncertainty_m(a.location_provenance), false)))'::text;
    v_inside := 'ST_Intersects(a.location::geometry, b.geom)';
  END IF;

  IF COALESCE((p->>'residential')::boolean, false) THEN
    v_branch := v_branch || format(
      '(CASE WHEN d.model_dwelling_basis = ''human_review'' THEN d.model_dwelling_count ELSE COALESCE(a.stated_dwelling_count, d.model_dwelling_count) END) >= %s',
      v_min);
  END IF;
  IF COALESCE((p->>'commercial')::boolean, false) THEN
    IF jsonb_typeof(p->'commercial_work') = 'array' THEN
      v_branch := v_branch || format(
        '((a.eligibility_limbs && ARRAY[''A'', ''A-described'', ''D'', ''D-described'']::text[] OR d.creates_commercial_space = ''yes'') AND a.commercial_work = ANY (%L::text[]))',
        ARRAY(SELECT jsonb_array_elements_text(p->'commercial_work')));
    ELSE
      v_branch := v_branch || '(a.eligibility_limbs && ARRAY[''A'', ''A-described'', ''D'', ''D-described'']::text[] OR d.creates_commercial_space = ''yes'')'::text;
    END IF;
  END IF;
  IF cardinality(v_branch) = 0 THEN
    -- Base eligibility can never be switched off: no branch means no matches, not every record.
    v_where := v_where || 'false'::text;
  ELSE
    v_where := v_where || ('(' || array_to_string(v_branch, ' OR ') || ')');
  END IF;

  IF jsonb_typeof(p->'stages') = 'array' THEN
    v_where := v_where || format(
      '(CASE WHEN a.stage IN (''pending'', ''approved'', ''refused'', ''withdrawn'') THEN a.stage ELSE ''other'' END) = ANY (%L::text[])',
      ARRAY(SELECT jsonb_array_elements_text(p->'stages')));
  END IF;
  IF jsonb_typeof(p->'procedures') = 'array' THEN
    v_where := v_where || format('a.procedure = ANY (%L::text[])', ARRAY(SELECT jsonb_array_elements_text(p->'procedures')));
  END IF;
  IF jsonb_typeof(p->'include') = 'array' THEN
    v_where := v_where || format('a.description ILIKE ANY (%L::text[])', ARRAY(SELECT jsonb_array_elements_text(p->'include')));
  END IF;
  IF jsonb_typeof(p->'exclude') = 'array' THEN
    v_where := v_where || format('NOT (a.description ILIKE ANY (%L::text[]))', ARRAY(SELECT jsonb_array_elements_text(p->'exclude')));
  END IF;
  IF COALESCE((p->>'exact_only')::boolean, false) THEN
    v_where := v_where || 'a.location_provenance = ''source_exact'''::text;
  END IF;
  IF jsonb_typeof(p->'watched_application_ids') = 'array' THEN
    -- A watch follows its development, so a watched application admits its whole family.
    v_where := v_where || format(
      '(a.id = ANY (%1$L::uuid[]) OR da.development_id IN (SELECT w.development_id FROM public.development_applications w WHERE w.planning_application_id = ANY (%1$L::uuid[])))',
      ARRAY(SELECT jsonb_array_elements_text(p->'watched_application_ids')));
  END IF;

  IF jsonb_typeof(p->'application_ids') = 'array' THEN
    -- Weekly selection: evaluate the patch's non-temporal predicate over the records that changed.
    v_where := v_where || format('a.id = ANY (%L::uuid[])', ARRAY(SELECT jsonb_array_elements_text(p->'application_ids')));
  END IF;

  IF jsonb_typeof(p->'brand_ids') = 'array' AND (p->>'radius_m') IS NOT NULL THEN
    -- Straight-line proximity to the selected estate. An approximate location may be within reach
    -- once its allowance is added; `near_confirmed` separates the two.
    v_where := v_where || format(
      'EXISTS (SELECT 1 FROM public.stores s WHERE s.brand_id = ANY (%L::uuid[]) AND s.location IS NOT NULL AND ST_DWithin(s.location, a.location, %s + public.planning_location_uncertainty_m(a.location_provenance)))',
      ARRAY(SELECT jsonb_array_elements_text(p->'brand_ids')), (p->>'radius_m')::integer);
    v_near := format(
      'EXISTS (SELECT 1 FROM public.stores s WHERE s.brand_id = ANY (%L::uuid[]) AND s.location IS NOT NULL AND ST_DWithin(s.location, a.location, %s))',
      ARRAY(SELECT jsonb_array_elements_text(p->'brand_ids')), (p->>'radius_m')::integer);
  END IF;

  RETURN format($q$
    SELECT
      a.id,
      da.development_id,
      da.role AS development_role,
      d.family_state,
      a.location,
      ST_X(a.location::geometry) AS lng,
      ST_Y(a.location::geometry) AS lat,
      a.location_provenance,
      public.planning_location_uncertainty_m(a.location_provenance) AS allowance,
      %1$s AS inside,
      %2$s AS near_confirmed,
      CASE WHEN d.model_dwelling_basis = 'human_review' THEN d.model_dwelling_count
           ELSE COALESCE(a.stated_dwelling_count, d.model_dwelling_count) END AS dwellings,
      (d.model_dwelling_basis = 'human_review') AS dwellings_reviewed,
      COALESCE(
        (CASE WHEN d.model_dwelling_basis = 'human_review' THEN d.model_dwelling_count
              ELSE COALESCE(a.stated_dwelling_count, d.model_dwelling_count) END) >= %3$s, false) AS is_residential,
      (a.eligibility_limbs && ARRAY['A', 'A-described', 'D', 'D-described']::text[] OR COALESCE(d.creates_commercial_space = 'yes', false)) AS is_commercial,
      COALESCE(%4$s, a.date_received) AS sort_date,
      COALESCE(da.development_id::text, 'app:' || a.id::text) AS group_key,
      CASE WHEN da.role IN ('condition', 'related') THEN 1 ELSE 0 END AS paperwork
    FROM public.planning_applications a
    %5$s
    LEFT JOIN public.development_applications da ON da.planning_application_id = a.id
    LEFT JOIN public.developments d ON d.id = da.development_id AND d.review_state <> 'rejected'
    WHERE %6$s
  $q$,
    v_inside,
    v_near,
    v_min,
    v_date_column,
    CASE WHEN v_boundary IS NULL THEN ''
         ELSE format('CROSS JOIN (SELECT g AS geom, g::geography AS geog FROM (SELECT %s AS g) x) b', v_boundary) END,
    array_to_string(v_where, E'\n      AND '));
END $$;

COMMENT ON FUNCTION public.planning_monitor_match_sql(jsonb) IS
  'Builds the Planning Monitor match query from a predicate document. Base eligibility (commercial, or 15+ homes) is always applied.';

-- Totals: patch-wide (or national) counts, split by confirmed/possible location, plus the
-- viewport subset. Applications and developments are counted from the same matched set.
CREATE OR REPLACE FUNCTION public.planning_monitor_count(p jsonb, p_viewport jsonb DEFAULT NULL)
RETURNS TABLE (
  applications bigint,
  developments bigint,
  confirmed_applications bigint,
  possible_applications bigint,
  residential_applications bigint,
  commercial_applications bigint,
  viewport_applications bigint,
  viewport_developments bigint
)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_viewport text := 'false';
BEGIN
  IF jsonb_typeof(p_viewport) = 'array' THEN
    v_viewport := format('location::geometry && ST_MakeEnvelope(%s, %s, %s, %s, 4326)',
      (p_viewport->>0)::double precision, (p_viewport->>1)::double precision,
      (p_viewport->>2)::double precision, (p_viewport->>3)::double precision);
  END IF;
  RETURN QUERY EXECUTE format($q$
    WITH m AS (%s)
    SELECT
      count(*),
      count(DISTINCT group_key),
      count(*) FILTER (WHERE inside),
      count(*) FILTER (WHERE NOT inside),
      count(*) FILTER (WHERE is_residential),
      count(*) FILTER (WHERE is_commercial),
      count(*) FILTER (WHERE %s),
      count(DISTINCT group_key) FILTER (WHERE %s)
    FROM m
  $q$, public.planning_monitor_match_sql(p), v_viewport, v_viewport);
END $$;

-- The list. `p_grouping` = 'applications' lists every match; 'developments' lists one row per
-- development (unlinked applications stand alone), represented by its principal scheme, with how
-- many of the matched applications it holds. Keyset pagination on (sort_date, key).
CREATE OR REPLACE FUNCTION public.planning_monitor_rows(
  p jsonb,
  p_grouping text DEFAULT 'developments',
  p_after_date date DEFAULT NULL,
  p_after_key text DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  row_key text,
  sort_date date,
  id uuid,
  development_id uuid,
  development_role text,
  family_state text,
  matched_applications bigint,
  provider_id text,
  authority_name text,
  reference text,
  address text,
  description text,
  status text,
  stage text,
  procedure text,
  planning_route text,
  commercial_work text,
  links jsonb,
  lng double precision,
  lat double precision,
  location_provenance text,
  location_uncertainty_m double precision,
  inside boolean,
  near_confirmed boolean,
  dwellings integer,
  dwellings_reviewed boolean,
  is_residential boolean,
  is_commercial boolean,
  date_received date,
  date_validated date,
  date_decided date
)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
BEGIN
  IF p_grouping NOT IN ('applications', 'developments') THEN
    RAISE EXCEPTION 'Unknown grouping %', p_grouping USING ERRCODE = '22023';
  END IF;
  RETURN QUERY EXECUTE format($q$
    WITH m AS (%1$s),
    picked AS (
      SELECT DISTINCT ON (CASE WHEN %2$L = 'applications' THEN m.id::text ELSE m.group_key END)
        CASE WHEN %2$L = 'applications' THEN m.id::text ELSE m.group_key END AS row_key,
        m.*,
        count(*) OVER (PARTITION BY m.group_key) AS matched_applications,
        max(m.sort_date) OVER (PARTITION BY CASE WHEN %2$L = 'applications' THEN m.id::text ELSE m.group_key END) AS row_sort_date
      FROM m
      -- The representative is the scheme itself, not its paperwork; then the principal role; then newest.
      ORDER BY CASE WHEN %2$L = 'applications' THEN m.id::text ELSE m.group_key END,
               m.paperwork,
               CASE m.development_role WHEN 'principal' THEN 0 WHEN 'primary' THEN 1 ELSE 2 END,
               m.sort_date DESC NULLS LAST, m.id
    )
    SELECT
      k.row_key, k.row_sort_date, a.id, k.development_id, k.development_role, k.family_state,
      k.matched_applications, a.provider_id, a.authority_name, a.reference, a.address, a.description,
      a.status, a.stage, a.procedure, a.planning_route, a.commercial_work, a.links, k.lng, k.lat,
      k.location_provenance, k.allowance, k.inside, k.near_confirmed, k.dwellings, k.dwellings_reviewed,
      k.is_residential, k.is_commercial, a.date_received, a.date_validated, a.date_decided
    FROM picked k
    JOIN public.planning_applications a ON a.id = k.id
    WHERE %3$L::date IS NULL
       OR (COALESCE(k.row_sort_date, '0001-01-01'::date), k.row_key) < (%3$L::date, %4$L::text)
    ORDER BY COALESCE(k.row_sort_date, '0001-01-01'::date) DESC, k.row_key DESC
    LIMIT %5$s
  $q$, public.planning_monitor_match_sql(p), p_grouping, p_after_date, p_after_key, v_limit);
END $$;

-- Server-side clusters for a viewport. Points snap to a grid sized for the zoom level (about 64
-- screen pixels a cell), so the payload is bounded by the viewport, not by the national store.
-- A cell holding one row carries that row's identity so the client can draw and select it.
CREATE OR REPLACE FUNCTION public.planning_monitor_clusters(
  p jsonb,
  p_zoom double precision,
  p_grouping text DEFAULT 'developments',
  p_max_cells integer DEFAULT 1500
)
RETURNS TABLE (
  cell_key text,
  lng double precision,
  lat double precision,
  count bigint,
  residential bigint,
  commercial bigint,
  possible bigint,
  single_id uuid,
  single_key text,
  single_exact boolean
)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  -- Degrees of longitude per 64 px at this zoom on a 512 px tile.
  v_cell double precision := 360.0 / power(2, LEAST(GREATEST(COALESCE(p_zoom, 5), 0), 22)) * 64.0 / 512.0;
BEGIN
  IF p_grouping NOT IN ('applications', 'developments') THEN
    RAISE EXCEPTION 'Unknown grouping %', p_grouping USING ERRCODE = '22023';
  END IF;
  RETURN QUERY EXECUTE format($q$
    WITH m AS (%1$s),
    units AS (
      -- One unit per counted thing: every application, or one per development at its representative point.
      SELECT DISTINCT ON (CASE WHEN %2$L = 'applications' THEN m.id::text ELSE m.group_key END)
        CASE WHEN %2$L = 'applications' THEN m.id::text ELSE m.group_key END AS unit_key,
        m.id, m.lng, m.lat, m.is_residential, m.is_commercial, m.inside, m.location_provenance
      FROM m
      ORDER BY CASE WHEN %2$L = 'applications' THEN m.id::text ELSE m.group_key END,
               m.paperwork,
               CASE m.development_role WHEN 'principal' THEN 0 WHEN 'primary' THEN 1 ELSE 2 END,
               m.sort_date DESC NULLS LAST, m.id
    )
    SELECT
      floor(u.lng / %3$s)::bigint || ':' || floor(u.lat / %3$s)::bigint AS cell_key,
      avg(u.lng), avg(u.lat), count(*),
      count(*) FILTER (WHERE u.is_residential),
      count(*) FILTER (WHERE u.is_commercial),
      count(*) FILTER (WHERE NOT u.inside),
      CASE WHEN count(*) = 1 THEN (array_agg(u.id))[1] END,
      CASE WHEN count(*) = 1 THEN (array_agg(u.unit_key))[1] END,
      CASE WHEN count(*) = 1 THEN bool_and(u.location_provenance = 'source_exact') END
    FROM units u
    GROUP BY 1
    ORDER BY count(*) DESC
    LIMIT %4$s
  $q$, public.planning_monitor_match_sql(p), p_grouping, v_cell, LEAST(GREATEST(COALESCE(p_max_cells, 1500), 1), 5000));
END $$;

-- ---------------------------------------------------------------------------------------------
-- 8. Atomic patch save: geometry, criteria, a new revision and the subscription in one transaction.
--    Called by the API with the service role after it has authenticated the owner.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.planning_monitor_next_weekly_due(p_after timestamptz, p_timezone text DEFAULT 'Europe/London')
RETURNS timestamptz LANGUAGE sql STABLE SET search_path = public AS $$
  -- date_trunc('week') is Monday. Local Monday 08:00, converted back through the zone so a clock
  -- change moves the UTC hour, not the local one.
  SELECT CASE
    WHEN (date_trunc('week', p_after AT TIME ZONE p_timezone) + interval '8 hours') AT TIME ZONE p_timezone > p_after
      THEN (date_trunc('week', p_after AT TIME ZONE p_timezone) + interval '8 hours') AT TIME ZONE p_timezone
    ELSE (date_trunc('week', p_after AT TIME ZONE p_timezone) + interval '7 days 8 hours') AT TIME ZONE p_timezone
  END;
$$;

CREATE OR REPLACE FUNCTION public.planning_monitor_save_patch(
  p_owner_id uuid,
  p_patch_id uuid,
  p_expected_revision integer,
  p_name text,
  p_geometry jsonb,
  p_display_geometry jsonb,
  p_geometry_source text,
  p_geometry_label text,
  p_geometry_ref jsonb,
  p_criteria jsonb,
  p_criteria_version integer,
  p_criteria_hash text,
  p_capability_version integer,
  p_email_enabled boolean,
  p_skip_quiet_weeks boolean
)
RETURNS TABLE (patch_id uuid, revision_id uuid, revision integer, subscription_id uuid, next_due_at timestamptz, created boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_geom geometry;
  v_patch public.planning_monitor_patches;
  v_revision_id uuid := gen_random_uuid();
  v_revision integer;
  v_created boolean := p_patch_id IS NULL;
  v_subscription_id uuid;
  v_next timestamptz;
BEGIN
  BEGIN
    v_geom := ST_SetSRID(ST_GeomFromGeoJSON(p_geometry::text), 4326);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Patch geometry could not be read' USING ERRCODE = '22023';
  END;
  IF GeometryType(v_geom) NOT IN ('POLYGON', 'MULTIPOLYGON') THEN
    RAISE EXCEPTION 'Patch geometry must be a polygon' USING ERRCODE = '22023';
  END IF;
  IF NOT ST_IsValid(v_geom) THEN
    RAISE EXCEPTION 'Patch geometry is not valid: %', ST_IsValidReason(v_geom) USING ERRCODE = '22023';
  END IF;
  IF ST_NPoints(v_geom) > 20000 THEN
    RAISE EXCEPTION 'Patch geometry has too many points' USING ERRCODE = '22023';
  END IF;

  IF v_created THEN
    INSERT INTO public.planning_monitor_patches
      (owner_id, name, geometry, geom, display_geometry, geometry_source, geometry_label, geometry_ref, criteria, criteria_version)
    VALUES
      (p_owner_id, p_name, p_geometry, v_geom, p_display_geometry, p_geometry_source, p_geometry_label,
       COALESCE(p_geometry_ref, '{}'::jsonb), p_criteria, p_criteria_version)
    RETURNING * INTO v_patch;
  ELSE
    SELECT * INTO v_patch FROM public.planning_monitor_patches
    WHERE id = p_patch_id AND owner_id = p_owner_id AND archived_at IS NULL
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Patch not found' USING ERRCODE = 'P0002';
    END IF;
    -- Optimistic concurrency: an edit made from a stale copy must not overwrite a newer save.
    IF p_expected_revision IS NOT NULL AND v_patch.current_revision <> p_expected_revision THEN
      RAISE EXCEPTION 'Patch was changed elsewhere; reload and try again' USING ERRCODE = '40001';
    END IF;
  END IF;

  v_revision := v_patch.current_revision + 1;
  INSERT INTO public.planning_monitor_patch_revisions
    (id, patch_id, revision, name, geometry, geometry_source, geometry_label, criteria, criteria_version,
     criteria_hash, capability_version, created_by)
  VALUES
    (v_revision_id, v_patch.id, v_revision, p_name, p_geometry, p_geometry_source, p_geometry_label, p_criteria,
     p_criteria_version, p_criteria_hash, p_capability_version, p_owner_id);

  UPDATE public.planning_monitor_patches SET
    name = p_name,
    geometry = p_geometry,
    geom = v_geom,
    display_geometry = p_display_geometry,
    geometry_source = p_geometry_source,
    geometry_label = p_geometry_label,
    -- A save that keeps the geometry passes no reference and keeps the stored one.
    geometry_ref = COALESCE(p_geometry_ref, public.planning_monitor_patches.geometry_ref),
    criteria = p_criteria,
    criteria_version = p_criteria_version,
    current_revision_id = v_revision_id,
    current_revision = v_revision,
    needs_attention = NULL,
    updated_at = now()
  WHERE id = v_patch.id;

  INSERT INTO public.planning_monitor_subscriptions AS s (patch_id, user_id, email_enabled, skip_quiet_weeks, next_due_at)
  VALUES (v_patch.id, p_owner_id, COALESCE(p_email_enabled, false), COALESCE(p_skip_quiet_weeks, false),
          public.planning_monitor_next_weekly_due(now()))
  ON CONFLICT ON CONSTRAINT planning_monitor_subscriptions_patch_id_key DO UPDATE SET
    email_enabled = COALESCE(p_email_enabled, s.email_enabled),
    skip_quiet_weeks = COALESCE(p_skip_quiet_weeks, s.skip_quiet_weeks),
    -- Re-enabling after an unsubscribe is an explicit choice made here.
    unsubscribed_at = CASE WHEN p_email_enabled THEN NULL ELSE s.unsubscribed_at END,
    next_due_at = COALESCE(s.next_due_at, public.planning_monitor_next_weekly_due(now())),
    updated_at = now()
  RETURNING s.id, s.next_due_at INTO v_subscription_id, v_next;

  -- Weekly delivery replaces the monthly proof of concept for this user, so they never get both.
  IF p_email_enabled THEN
    UPDATE public.planning_alert_subscriptions SET enabled = false, updated_at = now()
    WHERE user_id = p_owner_id AND enabled;
  END IF;

  RETURN QUERY SELECT v_patch.id, v_revision_id, v_revision, v_subscription_id, v_next, v_created;
END $$;

-- ---------------------------------------------------------------------------------------------
-- 9. Job claims. Leases let a crashed worker's job be retried; SKIP LOCKED lets several run at once.
-- ---------------------------------------------------------------------------------------------

-- Create this week's scheduled run for each due subscription (at most once per period) and move the
-- subscription on. The period covers the local Monday–Monday week ending at the due time's Monday.
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
    WHERE s.email_enabled AND s.unsubscribed_at IS NULL AND s.next_due_at <= p_now
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

CREATE OR REPLACE FUNCTION public.planning_monitor_claim_run(p_worker text, p_lease interval DEFAULT interval '10 minutes', p_max_attempts integer DEFAULT 3)
RETURNS SETOF public.planning_monitor_digest_runs
LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  UPDATE public.planning_monitor_digest_runs r SET
    status = 'running', attempts = r.attempts + 1, lease_owner = p_worker, lease_expires_at = now() + p_lease
  WHERE r.id = (
    SELECT id FROM public.planning_monitor_digest_runs
    WHERE ((status = 'queued') OR (status = 'running' AND lease_expires_at < now()))
      AND not_before <= now() AND attempts < p_max_attempts
    ORDER BY not_before
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING r.*;
$$;

CREATE OR REPLACE FUNCTION public.planning_monitor_claim_delivery(p_lease interval DEFAULT interval '5 minutes', p_max_attempts integer DEFAULT 5)
RETURNS SETOF public.planning_monitor_deliveries
LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  UPDATE public.planning_monitor_deliveries d SET
    state = CASE WHEN d.state = 'pending' THEN 'sending' ELSE d.state END,
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

-- ---------------------------------------------------------------------------------------------
-- 10. Grants. Nothing is callable by anon or authenticated directly.
-- ---------------------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.planning_record_change_event(uuid, uuid, text, jsonb, jsonb, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.planning_monitor_match_sql(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.planning_monitor_count(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.planning_monitor_rows(jsonb, text, date, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.planning_monitor_clusters(jsonb, double precision, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.planning_monitor_save_patch(uuid, uuid, integer, text, jsonb, jsonb, text, text, jsonb, jsonb, integer, text, integer, boolean, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.planning_monitor_enqueue_due(timestamptz, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.planning_monitor_claim_run(text, interval, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.planning_monitor_claim_delivery(interval, integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.planning_monitor_match_sql(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.planning_monitor_count(jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.planning_monitor_rows(jsonb, text, date, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.planning_monitor_clusters(jsonb, double precision, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.planning_monitor_save_patch(uuid, uuid, integer, text, jsonb, jsonb, text, text, jsonb, jsonb, integer, text, integer, boolean, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.planning_monitor_next_weekly_due(timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.planning_monitor_enqueue_due(timestamptz, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.planning_monitor_claim_run(text, interval, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.planning_monitor_claim_delivery(interval, integer) TO service_role;

-- ---------------------------------------------------------------------------------------------
-- 11. Rollout switches, all off: Planning mode, AI briefing generation, weekly email sending.
-- ---------------------------------------------------------------------------------------------
INSERT INTO public.feature_flags (key, enabled, description) VALUES
  ('planning_monitor_enabled', false, 'Planning Monitor mode in the unified workspace'),
  ('planning_monitor_ai_enabled', false, 'Planning Monitor: generate AI weekly briefings (deterministic reports still generate when off)'),
  ('planning_monitor_email_enabled', false, 'Planning Monitor: send weekly briefing emails (kill-switch; map and reports stay usable)')
ON CONFLICT (key) DO NOTHING;

COMMIT;
