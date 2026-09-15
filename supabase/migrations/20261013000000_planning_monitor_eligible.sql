-- Planning Monitor: a narrow, trigger-maintained table of eligible applications.
--
-- Why: the 15 Sep benchmark (docs/planning-monitor-implementation-status.md) showed every All UK
-- read over a window longer than about 30 days exceeding the 8 s statement timeout, because base
-- eligibility was decided per read by joining ~615k applications to their developments. Here it is
-- decided once, when a record changes, and national reads scan only the schemes that qualify.
--
-- The eligibility rule is unchanged from 20261012 (and the Planning tab, 20261010): commercial by
-- ingestion limb or classifier, or housing with a confirmed count of at least 15 homes, where a human
-- dwelling correction is authoritative (including a correction to unknown), otherwise Plota's stated
-- count, otherwise the classifier's. Records with no location are not mapped and are left out, as before.
--
-- planning_monitor_match_sql is replaced to read this table. Its output columns are unchanged, so
-- planning_monitor_count, _rows and _clusters need no change.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30min';

CREATE TABLE IF NOT EXISTS public.planning_monitor_eligible (
  application_id       uuid PRIMARY KEY REFERENCES public.planning_applications(id) ON DELETE CASCADE,
  development_id       uuid,
  development_role     text,
  family_state         text,
  geom                 geometry(Point, 4326) NOT NULL,
  location             geography(Point, 4326) NOT NULL,
  location_provenance  text NOT NULL,
  date_received        date,
  date_validated       date,
  date_decided         date,
  stage                text,
  procedure            text,
  commercial_work      text,
  -- Resolved as described above; null when unknown.
  dwellings            integer,
  dwellings_reviewed   boolean NOT NULL DEFAULT false,
  is_commercial        boolean NOT NULL,
  refreshed_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT planning_monitor_eligible_rule CHECK (is_commercial OR dwellings >= 15)
);

CREATE INDEX IF NOT EXISTS planning_monitor_eligible_geom_idx ON public.planning_monitor_eligible USING gist (geom);
CREATE INDEX IF NOT EXISTS planning_monitor_eligible_received_idx ON public.planning_monitor_eligible (date_received DESC);
CREATE INDEX IF NOT EXISTS planning_monitor_eligible_validated_idx ON public.planning_monitor_eligible (date_validated DESC) WHERE date_validated IS NOT NULL;
CREATE INDEX IF NOT EXISTS planning_monitor_eligible_decided_idx ON public.planning_monitor_eligible (date_decided DESC) WHERE date_decided IS NOT NULL;
CREATE INDEX IF NOT EXISTS planning_monitor_eligible_development_idx ON public.planning_monitor_eligible (development_id) WHERE development_id IS NOT NULL;

ALTER TABLE public.planning_monitor_eligible ENABLE ROW LEVEL SECURITY;
-- No policies: read through the Monitor's service-role functions only.

-- Recompute the rows for these applications: insert or update the eligible ones, delete the rest.
CREATE OR REPLACE FUNCTION public.planning_monitor_refresh_eligible(p_ids uuid[])
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH src AS (
    SELECT
      a.id,
      da.development_id,
      da.role AS development_role,
      d.family_state,
      a.location,
      a.location_provenance,
      a.date_received,
      a.date_validated,
      a.date_decided,
      a.stage,
      a.procedure,
      a.commercial_work,
      CASE WHEN d.model_dwelling_basis = 'human_review' THEN d.model_dwelling_count
           ELSE COALESCE(a.stated_dwelling_count, d.model_dwelling_count) END AS dwellings,
      COALESCE(d.model_dwelling_basis = 'human_review', false) AS dwellings_reviewed,
      (a.eligibility_limbs && ARRAY['A', 'A-described', 'D', 'D-described']::text[]
        OR COALESCE(d.creates_commercial_space = 'yes', false)) AS is_commercial
    FROM public.planning_applications a
    LEFT JOIN public.development_applications da ON da.planning_application_id = a.id
    LEFT JOIN public.developments d ON d.id = da.development_id AND d.review_state <> 'rejected'
    WHERE a.id = ANY (p_ids)
  ),
  keep AS (
    SELECT * FROM src WHERE location IS NOT NULL AND (is_commercial OR dwellings >= 15)
  ),
  removed AS (
    DELETE FROM public.planning_monitor_eligible e
    WHERE e.application_id = ANY (p_ids)
      AND NOT EXISTS (SELECT 1 FROM keep k WHERE k.id = e.application_id)
  )
  INSERT INTO public.planning_monitor_eligible AS e (
    application_id, development_id, development_role, family_state, geom, location, location_provenance,
    date_received, date_validated, date_decided, stage, procedure, commercial_work, dwellings,
    dwellings_reviewed, is_commercial, refreshed_at
  )
  SELECT
    k.id, k.development_id, k.development_role, k.family_state, k.location::geometry, k.location, k.location_provenance,
    k.date_received, k.date_validated, k.date_decided, k.stage, k.procedure, k.commercial_work, k.dwellings,
    k.dwellings_reviewed, k.is_commercial, now()
  FROM keep k
  ON CONFLICT (application_id) DO UPDATE SET
    development_id = EXCLUDED.development_id,
    development_role = EXCLUDED.development_role,
    family_state = EXCLUDED.family_state,
    geom = EXCLUDED.geom,
    location = EXCLUDED.location,
    location_provenance = EXCLUDED.location_provenance,
    date_received = EXCLUDED.date_received,
    date_validated = EXCLUDED.date_validated,
    date_decided = EXCLUDED.date_decided,
    stage = EXCLUDED.stage,
    procedure = EXCLUDED.procedure,
    commercial_work = EXCLUDED.commercial_work,
    dwellings = EXCLUDED.dwellings,
    dwellings_reviewed = EXCLUDED.dwellings_reviewed,
    is_commercial = EXCLUDED.is_commercial,
    refreshed_at = now();
$$;

CREATE OR REPLACE FUNCTION public.planning_monitor_eligible_from_application()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.planning_monitor_refresh_eligible(ARRAY[NEW.id]);
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.planning_monitor_eligible_from_membership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.planning_monitor_refresh_eligible(ARRAY[NEW.planning_application_id]);
  END IF;
  IF TG_OP IN ('DELETE', 'UPDATE') AND (TG_OP = 'DELETE' OR OLD.planning_application_id IS DISTINCT FROM NEW.planning_application_id) THEN
    PERFORM public.planning_monitor_refresh_eligible(ARRAY[OLD.planning_application_id]);
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.planning_monitor_eligible_from_development()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ids uuid[];
BEGIN
  SELECT array_agg(planning_application_id) INTO v_ids
  FROM public.development_applications WHERE development_id = NEW.id;
  IF v_ids IS NOT NULL THEN
    PERFORM public.planning_monitor_refresh_eligible(v_ids);
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS planning_monitor_eligible_application_insert ON public.planning_applications;
CREATE TRIGGER planning_monitor_eligible_application_insert
AFTER INSERT ON public.planning_applications
FOR EACH ROW EXECUTE FUNCTION public.planning_monitor_eligible_from_application();

DROP TRIGGER IF EXISTS planning_monitor_eligible_application_update ON public.planning_applications;
CREATE TRIGGER planning_monitor_eligible_application_update
AFTER UPDATE OF eligibility_limbs, stated_dwelling_count, location, location_provenance, date_received,
  date_validated, date_decided, stage, procedure, commercial_work
ON public.planning_applications
FOR EACH ROW
WHEN (
  OLD.eligibility_limbs IS DISTINCT FROM NEW.eligibility_limbs
  OR OLD.stated_dwelling_count IS DISTINCT FROM NEW.stated_dwelling_count
  OR OLD.location IS DISTINCT FROM NEW.location
  OR OLD.location_provenance IS DISTINCT FROM NEW.location_provenance
  OR OLD.date_received IS DISTINCT FROM NEW.date_received
  OR OLD.date_validated IS DISTINCT FROM NEW.date_validated
  OR OLD.date_decided IS DISTINCT FROM NEW.date_decided
  OR OLD.stage IS DISTINCT FROM NEW.stage
  OR OLD.procedure IS DISTINCT FROM NEW.procedure
  OR OLD.commercial_work IS DISTINCT FROM NEW.commercial_work
)
EXECUTE FUNCTION public.planning_monitor_eligible_from_application();

DROP TRIGGER IF EXISTS planning_monitor_eligible_membership ON public.development_applications;
CREATE TRIGGER planning_monitor_eligible_membership
AFTER INSERT OR UPDATE OR DELETE ON public.development_applications
FOR EACH ROW EXECUTE FUNCTION public.planning_monitor_eligible_from_membership();

DROP TRIGGER IF EXISTS planning_monitor_eligible_development ON public.developments;
CREATE TRIGGER planning_monitor_eligible_development
AFTER UPDATE OF model_dwelling_count, model_dwelling_basis, creates_commercial_space, review_state, family_state
ON public.developments
FOR EACH ROW
WHEN (
  OLD.model_dwelling_count IS DISTINCT FROM NEW.model_dwelling_count
  OR OLD.model_dwelling_basis IS DISTINCT FROM NEW.model_dwelling_basis
  OR OLD.creates_commercial_space IS DISTINCT FROM NEW.creates_commercial_space
  OR OLD.review_state IS DISTINCT FROM NEW.review_state
  OR OLD.family_state IS DISTINCT FROM NEW.family_state
)
EXECUTE FUNCTION public.planning_monitor_eligible_from_development();

-- Backfill. The triggers above are already live in this transaction, so nothing is missed between
-- the two; rows written concurrently wait on the trigger creation lock.
INSERT INTO public.planning_monitor_eligible (
  application_id, development_id, development_role, family_state, geom, location, location_provenance,
  date_received, date_validated, date_decided, stage, procedure, commercial_work, dwellings,
  dwellings_reviewed, is_commercial
)
SELECT *
FROM (
  SELECT
    a.id, da.development_id, da.role, d.family_state, a.location::geometry, a.location, a.location_provenance,
    a.date_received, a.date_validated, a.date_decided, a.stage, a.procedure, a.commercial_work,
    CASE WHEN d.model_dwelling_basis = 'human_review' THEN d.model_dwelling_count
         ELSE COALESCE(a.stated_dwelling_count, d.model_dwelling_count) END AS dwellings,
    COALESCE(d.model_dwelling_basis = 'human_review', false),
    (a.eligibility_limbs && ARRAY['A', 'A-described', 'D', 'D-described']::text[]
      OR COALESCE(d.creates_commercial_space = 'yes', false)) AS is_commercial
  FROM public.planning_applications a
  LEFT JOIN public.development_applications da ON da.planning_application_id = a.id
  LEFT JOIN public.developments d ON d.id = da.development_id AND d.review_state <> 'rejected'
  WHERE a.location IS NOT NULL
) s
WHERE s.is_commercial OR s.dwellings >= 15
ON CONFLICT (application_id) DO NOTHING;

ANALYZE public.planning_monitor_eligible;

-- The match predicate, now over the eligible table. Output columns and every filter are unchanged.
CREATE OR REPLACE FUNCTION public.planning_monitor_match_sql(p jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  v_date_column text;
  v_where text[] := ARRAY['true'];
  v_branch text[] := ARRAY[]::text[];
  v_boundary text := NULL;
  v_inside text := 'true';
  v_near text := 'NULL::boolean';
  v_join_application boolean := false;
  v_min integer := GREATEST(15, COALESCE((p->>'min_dwellings')::integer, 15));
BEGIN
  v_date_column := CASE COALESCE(p->>'date_field', 'received')
    WHEN 'received' THEN 'e.date_received'
    WHEN 'validated' THEN 'e.date_validated'
    WHEN 'decided' THEN 'e.date_decided'
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
    v_where := v_where || format('e.geom && ST_MakeEnvelope(%s, %s, %s, %s, 4326)',
      (p->'bbox'->>0)::double precision, (p->'bbox'->>1)::double precision,
      (p->'bbox'->>2)::double precision, (p->'bbox'->>3)::double precision);
  END IF;

  IF jsonb_typeof(p->'boundary') = 'object' THEN
    v_boundary := format('ST_SetSRID(ST_GeomFromGeoJSON(%L), 4326)', (p->'boundary')::text);
    v_where := v_where || format(
      'e.geom && ST_Expand(b.geom, 1.02 * 1500 / (111320 * cos(radians(LEAST(89, GREATEST(abs(ST_YMin(b.geom)), abs(ST_YMax(b.geom))))))), 1.02 * 1500 / 110574)');
    v_where := v_where || '(ST_Intersects(e.geom, b.geom) OR (public.planning_location_uncertainty_m(e.location_provenance) > 0 AND ST_DWithin(e.location, b.geog, public.planning_location_uncertainty_m(e.location_provenance), false)))'::text;
    v_inside := 'ST_Intersects(e.geom, b.geom)';
  END IF;

  IF COALESCE((p->>'residential')::boolean, false) THEN
    v_branch := v_branch || format('e.dwellings >= %s', v_min);
  END IF;
  IF COALESCE((p->>'commercial')::boolean, false) THEN
    IF jsonb_typeof(p->'commercial_work') = 'array' THEN
      v_branch := v_branch || format('(e.is_commercial AND e.commercial_work = ANY (%L::text[]))',
        ARRAY(SELECT jsonb_array_elements_text(p->'commercial_work')));
    ELSE
      v_branch := v_branch || 'e.is_commercial'::text;
    END IF;
  END IF;
  IF cardinality(v_branch) = 0 THEN
    v_where := v_where || 'false'::text;
  ELSE
    v_where := v_where || ('(' || array_to_string(v_branch, ' OR ') || ')');
  END IF;

  IF jsonb_typeof(p->'stages') = 'array' THEN
    v_where := v_where || format(
      '(CASE WHEN e.stage IN (''pending'', ''approved'', ''refused'', ''withdrawn'') THEN e.stage ELSE ''other'' END) = ANY (%L::text[])',
      ARRAY(SELECT jsonb_array_elements_text(p->'stages')));
  END IF;
  IF jsonb_typeof(p->'procedures') = 'array' THEN
    v_where := v_where || format('e.procedure = ANY (%L::text[])', ARRAY(SELECT jsonb_array_elements_text(p->'procedures')));
  END IF;
  IF jsonb_typeof(p->'include') = 'array' THEN
    v_join_application := true;
    v_where := v_where || format('a.description ILIKE ANY (%L::text[])', ARRAY(SELECT jsonb_array_elements_text(p->'include')));
  END IF;
  IF jsonb_typeof(p->'exclude') = 'array' THEN
    v_join_application := true;
    v_where := v_where || format('NOT (a.description ILIKE ANY (%L::text[]))', ARRAY(SELECT jsonb_array_elements_text(p->'exclude')));
  END IF;
  IF COALESCE((p->>'exact_only')::boolean, false) THEN
    v_where := v_where || 'e.location_provenance = ''source_exact'''::text;
  END IF;
  IF jsonb_typeof(p->'watched_application_ids') = 'array' THEN
    v_where := v_where || format(
      '(e.application_id = ANY (%1$L::uuid[]) OR e.development_id IN (SELECT w.development_id FROM public.development_applications w WHERE w.planning_application_id = ANY (%1$L::uuid[])))',
      ARRAY(SELECT jsonb_array_elements_text(p->'watched_application_ids')));
  END IF;
  IF jsonb_typeof(p->'application_ids') = 'array' THEN
    v_where := v_where || format('e.application_id = ANY (%L::uuid[])', ARRAY(SELECT jsonb_array_elements_text(p->'application_ids')));
  END IF;

  IF jsonb_typeof(p->'brand_ids') = 'array' AND (p->>'radius_m') IS NOT NULL THEN
    v_where := v_where || format(
      'EXISTS (SELECT 1 FROM public.stores s WHERE s.brand_id = ANY (%L::uuid[]) AND s.location IS NOT NULL AND ST_DWithin(s.location, e.location, %s + public.planning_location_uncertainty_m(e.location_provenance)))',
      ARRAY(SELECT jsonb_array_elements_text(p->'brand_ids')), (p->>'radius_m')::integer);
    v_near := format(
      'EXISTS (SELECT 1 FROM public.stores s WHERE s.brand_id = ANY (%L::uuid[]) AND s.location IS NOT NULL AND ST_DWithin(s.location, e.location, %s))',
      ARRAY(SELECT jsonb_array_elements_text(p->'brand_ids')), (p->>'radius_m')::integer);
  END IF;

  RETURN format($q$
    SELECT
      e.application_id AS id,
      e.development_id,
      e.development_role,
      e.family_state,
      e.location,
      ST_X(e.geom) AS lng,
      ST_Y(e.geom) AS lat,
      e.location_provenance,
      public.planning_location_uncertainty_m(e.location_provenance) AS allowance,
      %1$s AS inside,
      %2$s AS near_confirmed,
      e.dwellings,
      e.dwellings_reviewed,
      COALESCE(e.dwellings >= %3$s, false) AS is_residential,
      e.is_commercial,
      COALESCE(%4$s, e.date_received) AS sort_date,
      COALESCE(e.development_id::text, 'app:' || e.application_id::text) AS group_key,
      CASE WHEN e.development_role IN ('condition', 'related') THEN 1 ELSE 0 END AS paperwork
    FROM public.planning_monitor_eligible e
    %5$s
    %6$s
    WHERE %7$s
  $q$,
    v_inside,
    v_near,
    v_min,
    v_date_column,
    CASE WHEN v_join_application THEN 'JOIN public.planning_applications a ON a.id = e.application_id' ELSE '' END,
    CASE WHEN v_boundary IS NULL THEN ''
         ELSE format('CROSS JOIN (SELECT g AS geom, g::geography AS geog FROM (SELECT %s AS g) x) b', v_boundary) END,
    array_to_string(v_where, E'\n      AND '));
END $$;

COMMENT ON TABLE public.planning_monitor_eligible IS
  'Planning Monitor: applications passing base eligibility (commercial, or 15+ homes), maintained by triggers. Read by planning_monitor_match_sql.';

REVOKE ALL ON FUNCTION public.planning_monitor_refresh_eligible(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.planning_monitor_refresh_eligible(uuid[]) TO service_role;
REVOKE ALL ON FUNCTION public.planning_monitor_match_sql(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.planning_monitor_match_sql(jsonb) TO service_role;

COMMIT;
