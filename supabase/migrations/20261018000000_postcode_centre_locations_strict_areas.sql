-- Planning locations: recognise postcode centres, and match areas and radii on the pin alone.
--
-- Why (measured 17 Sep 2026 against uk_postcode_centroids, live store):
--   * Plota's `centroid` precision is almost always a unit-postcode centre, not a ward or parish
--     centre: of 235,836 located `centroid` rows with a known postcode, 201,417 (85%) sit within
--     5 m of that postcode's centre (median 0 m). The historical backfill rows, which carry no
--     precision at all, match their postcode centre a third of the time (53,195 of 159,498).
--     Every one of them was stored as `source_centroid` and treated as up to 1,500 m out.
--   * Users found records shown outside the area or radius they chose confusing. A record now
--     matches an area only when its stored point is inside it, and a brand radius only when its
--     stored point is within that radius. The location allowance no longer widens either.
--
-- Changes:
--   1. location_provenance_rank puts a postcode centre above a provider centroid of unknown size.
--   2. planning_application_location_fallback labels a non-exact provider point that sits within
--      5 m of the record's own postcode centre as `postcode_centroid`. A new provider precision
--      word still degrades to `source_centroid`, never to exact.
--   3. planning_application_change_events no longer records a relabel between the two centre
--      kinds as a location change when the point itself has not moved, so this backfill (and any
--      later re-derivation) does not flood the weekly briefings with ~255k "location changed" events.
--   4. planning_tab_applications_v4 and planning_monitor_match_sql match on the point alone.
--      Their output columns are unchanged: `inside`/`inside_boundary` is now always true for a
--      boundary match, and `near_confirmed` always agrees with the brand filter.
--      `exact_only` now also admits postcode centres, and planning_monitor_clusters draws a
--      single postcode-centre pin as solid.
--   5. Backfill of planning_applications and developments.
--
-- The backfill updates ~255k rows and fires the eligible-table and promotion triggers for each.
-- Expect it to take a few minutes on Micro compute; statement_timeout is lifted for this
-- transaction only.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = 0;

-- 1. Precision order. Higher means more precise.
CREATE OR REPLACE FUNCTION public.location_provenance_rank(p_provenance text)
RETURNS integer LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE p_provenance
    WHEN 'source_exact'      THEN 3
    WHEN 'postcode_centroid' THEN 2
    WHEN 'source_centroid'   THEN 1
    ELSE 0
  END;
$$;

-- 2. Provenance on write.
CREATE OR REPLACE FUNCTION public.planning_application_location_fallback()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_postcode_centre geography;
BEGIN
  IF NEW.postcode IS NOT NULL THEN
    SELECT p.location INTO v_postcode_centre
    FROM public.uk_postcode_centroids p
    WHERE p.postcode = regexp_replace(
      replace(upper(NEW.postcode), ' ', ''), '(.+)(.{3})$', '\1 \2'
    )
    LIMIT 1;
  END IF;

  IF NEW.location IS NOT NULL THEN
    NEW.location_provenance := CASE
      WHEN lower(COALESCE(NEW.location_precision, '')) IN ('exact', 'rooftop') THEN 'source_exact'
      -- A point on the record's own postcode centre is that centre, whatever the provider called it.
      WHEN v_postcode_centre IS NOT NULL
       AND ST_DWithin(NEW.location, v_postcode_centre, 5) THEN 'postcode_centroid'
      ELSE 'source_centroid'
    END;
  ELSIF NEW.postcode IS NOT NULL THEN
    -- The fallback itself only uses live postcodes, as before.
    SELECT p.location INTO NEW.location
    FROM public.uk_postcode_centroids p
    WHERE p.postcode = regexp_replace(
      replace(upper(NEW.postcode), ' ', ''), '(.+)(.{3})$', '\1 \2'
    )
      AND p.is_live
    LIMIT 1;
    NEW.location_provenance := CASE WHEN NEW.location IS NOT NULL THEN 'postcode_centroid' ELSE 'missing' END;
  ELSE
    NEW.location_provenance := 'missing';
  END IF;
  RETURN NEW;
END $$;

-- 3. Change events: a relabel between centre kinds with an unmoved point is not news.
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
  IF (NEW.location_provenance IS DISTINCT FROM OLD.location_provenance
      AND NOT (NEW.location IS NOT DISTINCT FROM OLD.location
               AND OLD.location_provenance IN ('source_centroid', 'postcode_centroid')
               AND NEW.location_provenance IN ('source_centroid', 'postcode_centroid')))
     OR (NEW.location IS DISTINCT FROM OLD.location
         AND (NEW.location IS NULL OR OLD.location IS NULL OR NOT ST_DWithin(NEW.location, OLD.location, 50))) THEN
    PERFORM public.planning_record_change_event(NEW.id, NULL, 'location_changed',
      jsonb_build_object('provenance', OLD.location_provenance), jsonb_build_object('provenance', NEW.location_provenance),
      NEW.source_changed_at);
  END IF;
  RETURN NULL;
END $$;

-- 4a. Planning tab: a record is in the area only when its point is.
CREATE OR REPLACE FUNCTION public.planning_tab_applications_v4(p_boundary jsonb, p_limit integer DEFAULT 2000)
 RETURNS TABLE(sort_rank bigint, id uuid, provider_id text, authority_name text, reference text, address text, status text, stage text, planning_route text, procedure text, commercial_work text, stated_floorspace_sqm numeric, description text, links jsonb, longitude double precision, latitude double precision, location_provenance text, location_uncertainty_m double precision, inside_boundary boolean, date_received date, date_decided date, date_validated date, stated_dwelling_count integer, eligibility_limbs text[], intelligence_tier boolean, development_id uuid, development_role text, family_state text, relevance text, summary text, model_dwelling_count integer, creates_commercial_space text, model_dwelling_basis text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH boundary AS (
    SELECT ST_SetSRID(ST_GeomFromGeoJSON(p_boundary::text), 4326) AS geom
  ),
  candidates AS (
    SELECT
      a.id,
      a.date_received,
      a.commercial_work,
      a.stated_dwelling_count,
      a.eligibility_limbs
    FROM public.planning_applications a
    CROSS JOIN boundary b
    WHERE a.location IS NOT NULL
      AND a.location::geometry && b.geom
      AND ST_Intersects(a.location::geometry, b.geom)
  ),
  kept AS (
    SELECT
      c.id,
      c.date_received,
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
    LEFT JOIN public.development_applications da ON da.planning_application_id = c.id
    LEFT JOIN public.developments d ON d.id = da.development_id AND d.review_state <> 'rejected'
    WHERE (
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
    public.planning_location_uncertainty_m(a.location_provenance) AS location_uncertainty_m,
    true AS inside_boundary,
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
$function$;

-- 4b. Planning Monitor predicate: patches and brand radii match on the point alone.
CREATE OR REPLACE FUNCTION public.planning_monitor_match_sql(p jsonb)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
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
    -- ST_Intersects uses the geom index itself; no widened box is needed any more.
    v_where := v_where || 'ST_Intersects(e.geom, b.geom)'::text;
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
    -- A postcode centre is treated as the site; only area centres are excluded.
    v_where := v_where || 'e.location_provenance IN (''source_exact'', ''postcode_centroid'')'::text;
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
      v_near := format(
        'EXISTS (SELECT 1 FROM public.stores s WHERE s.brand_id = ANY (%L::uuid[]) AND s.location IS NOT NULL AND ST_DWithin(s.location, e.location, %s))',
        v_brands, v_radius);
    ELSE
      -- Nationally most records qualify and a probe per record exceeds the statement timeout, so
      -- the chosen stores (a few thousand) find their neighbours through the geom index instead:
      -- a box wide enough for the radius, then the exact geography distance. Each set is computed
      -- once per query. A viewport box, when present, limits the stores searched to those that
      -- could reach it.
      v_store_scope := CASE WHEN jsonb_typeof(p->'bbox') = 'array' THEN format(
        ' AND s.location::geometry && ST_Expand(ST_MakeEnvelope(%s, %s, %s, %s, 4326), %s / (111320 * cos(radians(61))), %s / 110574)',
        (p->'bbox'->>0)::double precision, (p->'bbox'->>1)::double precision,
        (p->'bbox'->>2)::double precision, (p->'bbox'->>3)::double precision,
        1.02 * v_radius, 1.02 * v_radius) ELSE '' END;
      v_near := format(
        'e.application_id IN (SELECT n.application_id FROM public.stores s JOIN public.planning_monitor_eligible n ON n.geom && ST_Expand(s.location::geometry, %2$s / (111320 * cos(radians(LEAST(89, abs(ST_Y(s.location::geometry)))))), %2$s / 110574) AND ST_DWithin(s.location, n.location, %3$s) WHERE s.brand_id = ANY (%1$L::uuid[]) AND s.location IS NOT NULL%4$s)',
        v_brands, 1.02 * v_radius, v_radius, v_store_scope);
    END IF;
    -- The filter and the "near" flag are now the same test.
    v_where := v_where || v_near;
    v_near := 'true';
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
         ELSE format('CROSS JOIN (SELECT g AS geom FROM (SELECT %s AS g) x) b', v_boundary) END,
    array_to_string(v_where, E'\n      AND '));
END $function$;

-- 4c. Map clusters: a single pin is drawn solid unless it is an area centre. Otherwise the
-- 20261017 version.
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
  single_exact boolean,
  colocated boolean
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
      CASE WHEN count(*) = 1 THEN bool_and(u.location_provenance IN ('source_exact', 'postcode_centroid')) END,
      -- 0.00001 degrees is about a metre: closer than any zoom level can separate.
      count(*) > 1 AND max(u.lng) - min(u.lng) <= 0.00001 AND max(u.lat) - min(u.lat) <= 0.00001
    FROM units u
    GROUP BY 1
    ORDER BY count(*) DESC
    LIMIT %4$s
  $q$, public.planning_monitor_match_sql(p), p_grouping, v_cell, LEAST(GREATEST(COALESCE(p_max_cells, 1500), 1), 5000));
END $$;

-- 5. Backfill. location_provenance is not in the BEFORE trigger's column list, so this sets the
-- label directly; the rule matches the trigger's, so a later re-derivation reaches the same answer.
UPDATE public.planning_applications a
SET location_provenance = 'postcode_centroid'
FROM public.uk_postcode_centroids p
WHERE a.location_provenance = 'source_centroid'
  AND a.location IS NOT NULL
  AND a.postcode IS NOT NULL
  AND p.postcode = regexp_replace(replace(upper(a.postcode), ' ', ''), '(.+)(.{3})$', '\1 \2')
  AND ST_DWithin(a.location, p.location, 5);

-- The promotion trigger has already carried most of these onto their developments; this covers
-- developments whose own point and postcode say the same thing but whose application did not change.
UPDATE public.developments d
SET location_provenance = 'postcode_centroid', updated_at = now()
FROM public.uk_postcode_centroids p
WHERE d.location_provenance = 'source_centroid'
  AND d.location IS NOT NULL
  AND d.postcode IS NOT NULL
  AND p.postcode = regexp_replace(replace(upper(d.postcode), ' ', ''), '(.+)(.{3})$', '\1 \2')
  AND ST_DWithin(d.location, p.location, 5);

NOTIFY pgrst, 'reload schema';

COMMIT;
