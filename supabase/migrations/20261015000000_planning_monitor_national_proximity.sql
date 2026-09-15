-- Planning Monitor: nationwide store proximity within the statement timeout.
--
-- Why: the 15 Sep desktop walkthrough found All UK with "within 3 miles of Lidl, Aldi" timing out.
-- Measured through the API: all UK this year 26,819 eligible records counted in ~0.3-0.5 s without
-- proximity and ~5.5-5.8 s with it (the page also reads the list at the same time, which passes 8 s);
-- 90 days ~2.1 s, 30 days ~0.55 s. Each record probed the stores table on its own, and a 3-mile radius
-- around 2,124 stores keeps 78% of records, so the filter cost a probe for nearly everything.
--
-- Change: without a patch boundary, the chosen stores find nearby records through the eligible
-- table's geom index, once per query, instead of each record looking for a store. With a boundary
-- the existing per-record probe stays: few records qualify there and it measured 45-350 ms.
-- Results are unchanged; only planning_monitor_match_sql is replaced.
BEGIN;
SET LOCAL lock_timeout = '5s';

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
  v_brands text[];
  v_radius integer;
  v_store_scope text;
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
    v_brands := ARRAY(SELECT jsonb_array_elements_text(p->'brand_ids'));
    v_radius := (p->>'radius_m')::integer;
    IF v_boundary IS NOT NULL THEN
      -- Inside a patch few records qualify, so each one looks for a store near it.
      v_where := v_where || format(
        'EXISTS (SELECT 1 FROM public.stores s WHERE s.brand_id = ANY (%L::uuid[]) AND s.location IS NOT NULL AND ST_DWithin(s.location, e.location, %s + public.planning_location_uncertainty_m(e.location_provenance)))',
        v_brands, v_radius);
      v_near := format(
        'EXISTS (SELECT 1 FROM public.stores s WHERE s.brand_id = ANY (%L::uuid[]) AND s.location IS NOT NULL AND ST_DWithin(s.location, e.location, %s))',
        v_brands, v_radius);
    ELSE
      -- Nationally most records qualify and a probe per record exceeds the statement timeout, so
      -- the chosen stores (a few thousand) find their neighbours through the geom index instead:
      -- a box wide enough for the radius plus the largest location allowance, then the exact
      -- geography distance. Each set is computed once per query. A viewport box, when present,
      -- limits the stores searched to those that could reach it.
      v_store_scope := CASE WHEN jsonb_typeof(p->'bbox') = 'array' THEN format(
        ' AND s.location::geometry && ST_Expand(ST_MakeEnvelope(%s, %s, %s, %s, 4326), %s / (111320 * cos(radians(61))), %s / 110574)',
        (p->'bbox'->>0)::double precision, (p->'bbox'->>1)::double precision,
        (p->'bbox'->>2)::double precision, (p->'bbox'->>3)::double precision,
        1.02 * (v_radius + 1500), 1.02 * (v_radius + 1500)) ELSE '' END;
      v_where := v_where || format(
        'e.application_id IN (SELECT n.application_id FROM public.stores s JOIN public.planning_monitor_eligible n ON n.geom && ST_Expand(s.location::geometry, %2$s / (111320 * cos(radians(LEAST(89, abs(ST_Y(s.location::geometry)))))), %2$s / 110574) AND ST_DWithin(s.location, n.location, %3$s + public.planning_location_uncertainty_m(n.location_provenance)) WHERE s.brand_id = ANY (%1$L::uuid[]) AND s.location IS NOT NULL%4$s)',
        v_brands, 1.02 * (v_radius + 1500), v_radius, v_store_scope);
      v_near := format(
        'e.application_id IN (SELECT n.application_id FROM public.stores s JOIN public.planning_monitor_eligible n ON n.geom && ST_Expand(s.location::geometry, %2$s / (111320 * cos(radians(LEAST(89, abs(ST_Y(s.location::geometry)))))), %2$s / 110574) AND ST_DWithin(s.location, n.location, %3$s) WHERE s.brand_id = ANY (%1$L::uuid[]) AND s.location IS NOT NULL%4$s)',
        v_brands, 1.02 * (v_radius + 1500), v_radius, v_store_scope);
    END IF;
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

REVOKE ALL ON FUNCTION public.planning_monitor_match_sql(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.planning_monitor_match_sql(jsonb) TO service_role;

COMMIT;
