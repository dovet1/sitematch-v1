-- Use the existing presence cache as the first part of every proximity rule.
--
-- Product meaning:
--   * a store inside a BUA always counts at 1km, 3km, 5km and 10km;
--   * stores outside the BUA continue to use the existing centroid-distance cache.
--
-- This guarantees that a town containing a fascia cannot be returned as missing
-- that fascia, without requiring expensive polygon-to-point distance summaries.

CREATE OR REPLACE FUNCTION public.filter_buas_rule_has_within(
  p_target_type text,
  p_target_ids uuid[],
  p_matching_logic text,
  p_distance integer,
  p_min_pop integer,
  p_max_pop integer
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_column_name text;
  v_sql text;
  v_array_literal text;
  v_expanded_ids uuid[];
BEGIN
  v_column_name := CASE p_target_type
    WHEN 'fascia' THEN 'fascia_id'
    WHEN 'category' THEN 'category_id'
    ELSE NULL
  END;

  IF v_column_name IS NULL THEN
    RAISE EXCEPTION 'Invalid target type: %', p_target_type;
  END IF;

  IF p_target_type = 'category' THEN
    v_expanded_ids := public.get_category_descendants(p_target_ids);
  ELSE
    v_expanded_ids := p_target_ids;
  END IF;

  IF p_matching_logic = 'all' THEN
    v_sql := format($sql$
      SELECT b.gsscode, b.pop_final
      FROM public.built_up_areas b
      WHERE b.pop_final BETWEEN %s AND %s
        AND (
          SELECT count(DISTINCT matched.target_id)
          FROM (
            SELECT sn.%I AS target_id
            FROM public.bua_store_nearby sn
            WHERE sn.bua_gsscode = b.gsscode
              AND sn.distance_m <= %s
              AND sn.%I = ANY($1)
            UNION ALL
            SELECT sp.%I AS target_id
            FROM public.bua_store_presence sp
            WHERE sp.bua_gsscode = b.gsscode
              AND sp.%I = ANY($1)
          ) AS matched
        ) = array_length($1, 1)
    $sql$,
      p_min_pop,
      p_max_pop,
      v_column_name,
      p_distance,
      v_column_name,
      v_column_name,
      v_column_name
    );
  ELSE
    v_sql := format($sql$
      SELECT b.gsscode, b.pop_final
      FROM public.built_up_areas b
      WHERE b.pop_final BETWEEN %s AND %s
        AND (
          EXISTS (
            SELECT 1
            FROM public.bua_store_nearby sn
            WHERE sn.bua_gsscode = b.gsscode
              AND sn.distance_m <= %s
              AND sn.%I = ANY($1)
          )
          OR EXISTS (
            SELECT 1
            FROM public.bua_store_presence sp
            WHERE sp.bua_gsscode = b.gsscode
              AND sp.%I = ANY($1)
          )
        )
    $sql$,
      p_min_pop,
      p_max_pop,
      p_distance,
      v_column_name,
      v_column_name
    );
  END IF;

  SELECT 'ARRAY[' || string_agg(quote_literal(id::text), ',') || ']::uuid[]'
  INTO v_array_literal
  FROM unnest(v_expanded_ids) AS id;

  v_sql := replace(v_sql, '$1', v_array_literal);
  RETURN v_sql;
END;
$$;

CREATE OR REPLACE FUNCTION public.filter_buas_rule_has_not_within(
  p_target_type text,
  p_target_ids uuid[],
  p_matching_logic text,
  p_distance integer,
  p_min_pop integer,
  p_max_pop integer
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_column_name text;
  v_sql text;
  v_array_literal text;
  v_expanded_ids uuid[];
BEGIN
  v_column_name := CASE p_target_type
    WHEN 'fascia' THEN 'fascia_id'
    WHEN 'category' THEN 'category_id'
    ELSE NULL
  END;

  IF v_column_name IS NULL THEN
    RAISE EXCEPTION 'Invalid target type: %', p_target_type;
  END IF;

  IF p_target_type = 'category' THEN
    v_expanded_ids := public.get_category_descendants(p_target_ids);
  ELSE
    v_expanded_ids := p_target_ids;
  END IF;

  -- Negative proximity means no target may be either inside the town or in the
  -- selected centroid-distance band. This is intentionally identical for the
  -- historic "all" and "any" branches, matching the corrected gap semantics.
  v_sql := format($sql$
    SELECT b.gsscode, b.pop_final
    FROM public.built_up_areas b
    WHERE b.pop_final BETWEEN %s AND %s
      AND NOT EXISTS (
        SELECT 1
        FROM public.bua_store_nearby sn
        WHERE sn.bua_gsscode = b.gsscode
          AND sn.distance_m <= %s
          AND sn.%I = ANY($1)
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.bua_store_presence sp
        WHERE sp.bua_gsscode = b.gsscode
          AND sp.%I = ANY($1)
      )
  $sql$,
    p_min_pop,
    p_max_pop,
    p_distance,
    v_column_name,
    v_column_name
  );

  SELECT 'ARRAY[' || string_agg(quote_literal(id::text), ',') || ']::uuid[]'
  INTO v_array_literal
  FROM unnest(v_expanded_ids) AS id;

  v_sql := replace(v_sql, '$1', v_array_literal);
  RETURN v_sql;
END;
$$;

GRANT EXECUTE ON FUNCTION public.filter_buas_rule_has_within(
  text, uuid[], text, integer, integer, integer
) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.filter_buas_rule_has_not_within(
  text, uuid[], text, integer, integer, integer
) TO authenticated, anon;

COMMENT ON FUNCTION public.filter_buas_rule_has_within(
  text, uuid[], text, integer, integer, integer
) IS 'Builds BUA positive proximity SQL using polygon presence OR the selected centroid-distance cache.';
COMMENT ON FUNCTION public.filter_buas_rule_has_not_within(
  text, uuid[], text, integer, integer, integer
) IS 'Builds BUA negative proximity SQL requiring absence from both polygon presence and the selected centroid-distance cache.';

-- Apply the same inside-always-counts rule to retail centres.
CREATE OR REPLACE FUNCTION public.retail_centre_matches_rule(
  p_rc_id text,
  p_rule jsonb
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_operator text := p_rule->>'operator';
  v_target_type text := p_rule->>'targetType';
  v_logic text := COALESCE(p_rule->>'matchingLogic', 'any');
  v_distance integer := NULLIF(p_rule->>'distance', '')::integer;
  v_ids uuid[];
  v_matched integer;
BEGIN
  IF v_operator IS NULL OR v_operator NOT IN ('has', 'has_not', 'has_within', 'has_not_within') THEN
    RAISE EXCEPTION 'Invalid retail-centre operator: %', v_operator;
  END IF;
  IF v_target_type IS NULL OR v_target_type NOT IN ('fascia', 'category') THEN
    RAISE EXCEPTION 'Invalid retail-centre target type: %', v_target_type;
  END IF;
  IF v_operator LIKE '%within' AND v_distance NOT IN (1000, 3000, 5000, 10000) THEN
    RAISE EXCEPTION 'Invalid retail-centre distance: %', v_distance;
  END IF;

  SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[])
  INTO v_ids
  FROM jsonb_array_elements_text(COALESCE(p_rule->'targetIds', '[]'::jsonb));

  IF v_target_type = 'category' AND cardinality(v_ids) > 0 THEN
    v_ids := public.get_category_descendants(v_ids);
  END IF;

  IF cardinality(v_ids) = 0 THEN
    RETURN true;
  END IF;

  IF v_operator IN ('has', 'has_not') THEN
    SELECT count(DISTINCT target_id)
    INTO v_matched
    FROM public.retail_centre_store_presence
    WHERE rc_id = p_rc_id
      AND target_type = v_target_type
      AND target_id = ANY(v_ids);
  ELSE
    SELECT count(DISTINCT matched.target_id)
    INTO v_matched
    FROM (
      SELECT target_id
      FROM public.retail_centre_store_nearby
      WHERE rc_id = p_rc_id
        AND distance_m = v_distance
        AND target_type = v_target_type
        AND target_id = ANY(v_ids)
      UNION ALL
      SELECT target_id
      FROM public.retail_centre_store_presence
      WHERE rc_id = p_rc_id
        AND target_type = v_target_type
        AND target_id = ANY(v_ids)
    ) AS matched;
  END IF;

  IF v_operator IN ('has_not', 'has_not_within') THEN
    RETURN v_matched = 0;
  END IF;
  RETURN CASE
    WHEN v_logic = 'all' THEN v_matched = cardinality(v_ids)
    ELSE v_matched > 0
  END;
END;
$$;

COMMENT ON FUNCTION public.retail_centre_matches_rule(text, jsonb) IS
  'Evaluates a retail-centre rule; proximity includes polygon presence plus the selected centroid-distance band.';

-- Keep the safer staging, validation, advisory lock and permissions from the
-- previous migration, but restore the inexpensive point-to-point proximity
-- calculation. Presence remains polygon-based and is combined at query time.
CREATE OR REPLACE FUNCTION public.rebuild_all_bua_summaries(
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE(progress text)
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = 0
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_bad_geometry_count integer;
  v_missing_geometry_count integer;
  v_duplicate_geometry_count integer;
  v_orphan_geometry_count integer;
  v_missing_centroid_count integer;
  v_has_store_location_index boolean;
  v_pair_count bigint;
  v_presence_count bigint;
  v_nearby_count bigint;
  v_invariant_failures bigint;
BEGIN
  IF NOT pg_try_advisory_xact_lock(
    hashtextextended('bua_summary_rebuild', 0)
  ) THEN
    RETURN QUERY SELECT 'Rebuild already in progress - skipping'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'Validating BUA geometry and centroid inputs...'::text;

  SELECT count(*)::integer
  INTO v_bad_geometry_count
  FROM public.built_up_area_geometries AS bg
  WHERE bg.geom IS NULL
     OR ST_SRID(bg.geom) <> 4326
     OR GeometryType(bg.geom) NOT IN ('POLYGON', 'MULTIPOLYGON')
     OR NOT ST_IsValid(bg.geom);

  SELECT count(*)::integer
  INTO v_missing_geometry_count
  FROM public.built_up_areas AS b
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.built_up_area_geometries AS bg
    WHERE bg.gsscode = b.gsscode
  );

  SELECT count(*)::integer
  INTO v_duplicate_geometry_count
  FROM (
    SELECT bg.gsscode
    FROM public.built_up_area_geometries AS bg
    GROUP BY bg.gsscode
    HAVING count(*) > 1
  ) AS duplicates;

  SELECT count(*)::integer
  INTO v_orphan_geometry_count
  FROM public.built_up_area_geometries AS bg
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.built_up_areas AS b
    WHERE b.gsscode = bg.gsscode
  );

  SELECT count(*)::integer
  INTO v_missing_centroid_count
  FROM public.built_up_areas
  WHERE centroid IS NULL;

  IF v_bad_geometry_count > 0
     OR v_missing_geometry_count > 0
     OR v_duplicate_geometry_count > 0
     OR v_orphan_geometry_count > 0
     OR v_missing_centroid_count > 0 THEN
    RAISE EXCEPTION
      'Cannot rebuild BUA summaries: % bad geometries, % missing geometries, % duplicate geometries, % orphan geometries, % missing centroids',
      v_bad_geometry_count,
      v_missing_geometry_count,
      v_duplicate_geometry_count,
      v_orphan_geometry_count,
      v_missing_centroid_count;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'stores'
      AND indexdef ILIKE '%USING gist%'
      AND indexdef ILIKE '%location%'
  )
  INTO v_has_store_location_index;

  IF NOT v_has_store_location_index THEN
    RAISE EXCEPTION
      'Cannot rebuild BUA summaries: stores.location needs a GiST index';
  END IF;

  CREATE TEMP TABLE next_bua_store_presence
    (LIKE public.bua_store_presence INCLUDING DEFAULTS)
    ON COMMIT DROP;

  CREATE TEMP TABLE next_bua_store_nearby
    (LIKE public.bua_store_nearby INCLUDING DEFAULTS)
    ON COMMIT DROP;

  CREATE TEMP TABLE bua_store_centroid_pairs (
    bua_gsscode text NOT NULL,
    store_id uuid NOT NULL,
    brand_id uuid,
    fascia_id uuid NOT NULL,
    centroid_distance_m double precision NOT NULL
  ) ON COMMIT DROP;

  RETURN QUERY SELECT 'Calculating polygon presence...'::text;

  INSERT INTO pg_temp.next_bua_store_presence (
    bua_gsscode,
    category_id,
    brand_id,
    fascia_id,
    store_count
  )
  SELECT
    bg.gsscode,
    fc.category_id,
    s.brand_id,
    s.fascia_id,
    count(DISTINCT s.id)
  FROM public.built_up_area_geometries AS bg
  JOIN public.stores AS s
    ON ST_Covers(bg.geom, s.location::geometry)
  JOIN public.fascia_categories AS fc
    ON fc.fascia_id = s.fascia_id
  WHERE s.location IS NOT NULL
    AND s.fascia_id IS NOT NULL
  GROUP BY bg.gsscode, fc.category_id, s.brand_id, s.fascia_id;

  GET DIAGNOSTICS v_presence_count = ROW_COUNT;

  RETURN QUERY SELECT 'Calculating stores within 10km of BUA centroids...'::text;

  INSERT INTO pg_temp.bua_store_centroid_pairs (
    bua_gsscode,
    store_id,
    brand_id,
    fascia_id,
    centroid_distance_m
  )
  SELECT
    b.gsscode,
    s.id,
    s.brand_id,
    s.fascia_id,
    ST_Distance(b.centroid, s.location)
  FROM public.built_up_areas AS b
  JOIN public.stores AS s
    ON ST_DWithin(b.centroid, s.location, 10000)
  WHERE s.location IS NOT NULL
    AND s.fascia_id IS NOT NULL;

  GET DIAGNOSTICS v_pair_count = ROW_COUNT;
  CREATE INDEX bua_store_centroid_pairs_distance_idx
    ON pg_temp.bua_store_centroid_pairs (centroid_distance_m);
  ANALYZE pg_temp.bua_store_centroid_pairs;

  INSERT INTO pg_temp.next_bua_store_nearby (
    bua_gsscode,
    distance_m,
    category_id,
    brand_id,
    fascia_id,
    store_count
  )
  SELECT
    pair.bua_gsscode,
    band.distance_m,
    fc.category_id,
    pair.brand_id,
    pair.fascia_id,
    count(DISTINCT pair.store_id)
  FROM pg_temp.bua_store_centroid_pairs AS pair
  CROSS JOIN (
    VALUES (1000), (3000), (5000), (10000)
  ) AS band(distance_m)
  JOIN public.fascia_categories AS fc
    ON fc.fascia_id = pair.fascia_id
  WHERE pair.centroid_distance_m <= band.distance_m
  GROUP BY
    pair.bua_gsscode,
    band.distance_m,
    fc.category_id,
    pair.brand_id,
    pair.fascia_id;

  GET DIAGNOSTICS v_nearby_count = ROW_COUNT;

  SELECT count(*)
  INTO v_invariant_failures
  FROM pg_temp.next_bua_store_nearby AS narrower
  WHERE narrower.distance_m <> 10000
    AND NOT EXISTS (
      SELECT 1
      FROM pg_temp.next_bua_store_nearby AS wider
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

  IF v_invariant_failures > 0 THEN
    RAISE EXCEPTION
      'Refusing summary swap: % rows violate cumulative proximity-band nesting',
      v_invariant_failures;
  END IF;

  RETURN QUERY SELECT format(
    'Staged %s centroid pairs, %s presence rows, and %s proximity rows',
    v_pair_count,
    v_presence_count,
    v_nearby_count
  );

  TRUNCATE TABLE public.bua_store_presence, public.bua_store_nearby;

  INSERT INTO public.bua_store_presence (
    bua_gsscode,
    category_id,
    brand_id,
    fascia_id,
    store_count,
    created_at
  )
  SELECT
    bua_gsscode,
    category_id,
    brand_id,
    fascia_id,
    store_count,
    created_at
  FROM pg_temp.next_bua_store_presence;

  INSERT INTO public.bua_store_nearby (
    bua_gsscode,
    distance_m,
    category_id,
    brand_id,
    fascia_id,
    store_count,
    created_at
  )
  SELECT
    bua_gsscode,
    distance_m,
    category_id,
    brand_id,
    fascia_id,
    store_count,
    created_at
  FROM pg_temp.next_bua_store_nearby;

  ANALYZE public.bua_store_presence;
  ANALYZE public.bua_store_nearby;

  RETURN QUERY SELECT 'Rebuild complete!'::text;
END;
$$;

COMMENT ON FUNCTION public.rebuild_all_bua_summaries(uuid) IS
  'Atomically rebuilds polygon presence and cumulative centroid-distance BUA summaries. Proximity filters combine both caches so stores inside a town always count.';
