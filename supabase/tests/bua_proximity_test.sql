-- BUA presence-aware proximity deployment checks.
--
-- Run only after applying 20260913020000_include_presence_in_proximity_filters.sql and
-- completing rebuild_all_bua_summaries(). The checks are read-only and the
-- transaction is rolled back.
--
--   psql -v ON_ERROR_STOP=1 -d <db> -f supabase/tests/bua_proximity_test.sql

BEGIN;

\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION pg_temp.assert_zero(actual bigint, label text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF actual <> 0 THEN
    RAISE EXCEPTION 'FAIL: % — expected 0, got %', label, actual;
  END IF;
  RAISE NOTICE 'ok: %', label;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.assert_true(actual boolean, label text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF actual IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL: %', label;
  END IF;
  RAISE NOTICE 'ok: %', label;
END;
$$;

-- The geography cast and one-polygon-per-BUA rebuild assumption must be safe.
DO $$
DECLARE
  v_failures bigint;
BEGIN
  SELECT count(*) INTO v_failures
  FROM public.built_up_area_geometries
  WHERE geom IS NULL
     OR ST_SRID(geom) <> 4326
     OR GeometryType(geom) NOT IN ('POLYGON', 'MULTIPOLYGON')
     OR NOT ST_IsValid(geom);
  PERFORM pg_temp.assert_zero(v_failures, 'all BUA geometries are valid SRID-4326 polygons');

  SELECT count(*) INTO v_failures
  FROM public.built_up_areas AS b
  WHERE NOT EXISTS (
    SELECT 1 FROM public.built_up_area_geometries AS g
    WHERE g.gsscode = b.gsscode
  );
  PERFORM pg_temp.assert_zero(v_failures, 'every BUA has geometry');

  SELECT count(*) INTO v_failures
  FROM (
    SELECT gsscode
    FROM public.built_up_area_geometries
    GROUP BY gsscode
    HAVING count(*) > 1
  ) AS duplicates;
  PERFORM pg_temp.assert_zero(v_failures, 'every BUA has one geometry row');

  SELECT count(*) INTO v_failures
  FROM public.built_up_area_geometries AS g
  WHERE NOT EXISTS (
    SELECT 1 FROM public.built_up_areas AS b
    WHERE b.gsscode = g.gsscode
  );
  PERFORM pg_temp.assert_zero(v_failures, 'every BUA geometry belongs to a BUA');
END;
$$;

-- The max-distance spatial join depends on an index over stores.location.
DO $$
DECLARE
  v_has_index boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'stores'
      AND indexdef ILIKE '%USING gist%'
      AND indexdef ILIKE '%location%'
  ) INTO v_has_index;
  PERFORM pg_temp.assert_true(v_has_index, 'stores.location has a GiST index');
END;
$$;

-- Cumulative bands must be nested and counts must never decrease as distance grows.
DO $$
DECLARE
  v_failures bigint;
BEGIN
  SELECT count(*) INTO v_failures
  FROM public.bua_store_nearby AS narrower
  WHERE narrower.distance_m <> 10000
    AND NOT EXISTS (
      SELECT 1
      FROM public.bua_store_nearby AS wider
      WHERE wider.bua_gsscode = narrower.bua_gsscode
        AND wider.distance_m = CASE narrower.distance_m
          WHEN 1000 THEN 3000
          WHEN 3000 THEN 5000
          WHEN 5000 THEN 10000
        END
        AND wider.category_id = narrower.category_id
        AND wider.brand_id IS NOT DISTINCT FROM narrower.brand_id
        AND wider.fascia_id = narrower.fascia_id
        AND wider.store_count >= narrower.store_count
    );
  PERFORM pg_temp.assert_zero(v_failures, '1km, 3km, 5km and 10km bands are nested');
END;
$$;

-- Original reported regression: Birmingham contains Pret, so the combined
-- proximity rule must include it even though the centroid cache does not.
DO $$
DECLARE
  v_pret_fascia constant uuid := '58a24865-b21c-4e48-9fb2-89db09b8f7ed';
  v_is_present boolean;
  v_positive_sql text;
  v_negative_sql text;
  v_is_positive_match boolean;
  v_is_negative_match boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.bua_store_presence
    WHERE bua_gsscode = 'E63010038'
      AND fascia_id = v_pret_fascia
  ) INTO v_is_present;
  PERFORM pg_temp.assert_true(v_is_present, 'Birmingham contains Pret A Manger');

  v_positive_sql := public.filter_buas_rule_has_within(
    'fascia', ARRAY[v_pret_fascia], 'any', 1000, 0, 2147483647
  );
  EXECUTE format(
    'SELECT EXISTS (SELECT 1 FROM (%s) AS result WHERE result.gsscode = $1)',
    v_positive_sql
  ) INTO v_is_positive_match USING 'E63010038';
  PERFORM pg_temp.assert_true(
    v_is_positive_match,
    'Birmingham matches has Pret A Manger within 1km'
  );

  v_negative_sql := public.filter_buas_rule_has_not_within(
    'fascia', ARRAY[v_pret_fascia], 'any', 1000, 0, 2147483647
  );
  EXECUTE format(
    'SELECT EXISTS (SELECT 1 FROM (%s) AS result WHERE result.gsscode = $1)',
    v_negative_sql
  ) INTO v_is_negative_match USING 'E63010038';
  PERFORM pg_temp.assert_true(
    NOT v_is_negative_match,
    'Birmingham does not match missing Pret A Manger within 1km'
  );
END;
$$;

-- Retail-centre proximity follows the same inside-always-counts rule.
DO $$
DECLARE
  v_rc_id text;
  v_target_type text;
  v_target_id uuid;
  v_has_match boolean;
  v_missing_match boolean;
BEGIN
  SELECT rc_id, target_type, target_id
  INTO v_rc_id, v_target_type, v_target_id
  FROM public.retail_centre_store_presence
  ORDER BY rc_id, target_type, target_id
  LIMIT 1;

  PERFORM pg_temp.assert_true(v_rc_id IS NOT NULL, 'retail-centre presence fixture exists');

  v_has_match := public.retail_centre_matches_rule(
    v_rc_id,
    jsonb_build_object(
      'operator', 'has_within',
      'targetType', v_target_type,
      'targetIds', jsonb_build_array(v_target_id),
      'matchingLogic', 'any',
      'distance', 1000
    )
  );
  PERFORM pg_temp.assert_true(v_has_match, 'retail-centre presence counts as within 1km');

  v_missing_match := public.retail_centre_matches_rule(
    v_rc_id,
    jsonb_build_object(
      'operator', 'has_not_within',
      'targetType', v_target_type,
      'targetIds', jsonb_build_array(v_target_id),
      'matchingLogic', 'any',
      'distance', 1000
    )
  );
  PERFORM pg_temp.assert_true(
    NOT v_missing_match,
    'retail-centre presence cannot match missing within 1km'
  );
END;
$$;

-- Expensive SECURITY DEFINER rebuilds must not be callable from browser roles.
DO $$
BEGIN
  PERFORM pg_temp.assert_true(
    NOT has_function_privilege('anon', 'public.rebuild_all_bua_summaries(uuid)', 'EXECUTE'),
    'anon cannot execute the rebuild'
  );
  PERFORM pg_temp.assert_true(
    NOT has_function_privilege('authenticated', 'public.rebuild_all_bua_summaries(uuid)', 'EXECUTE'),
    'authenticated users cannot execute the rebuild directly'
  );
  PERFORM pg_temp.assert_true(
    has_function_privilege('service_role', 'public.rebuild_all_bua_summaries(uuid)', 'EXECUTE'),
    'service_role can execute the rebuild'
  );
END;
$$;

ROLLBACK;
