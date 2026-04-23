-- New filter function that supports AND/OR logic BETWEEN rules
-- Uses left-to-right evaluation: ((Rule1 CONNECTOR Rule2) CONNECTOR Rule3)...

DROP FUNCTION IF EXISTS filter_buas_with_expression(jsonb, integer, integer);

CREATE OR REPLACE FUNCTION filter_buas_with_expression(
  p_filter_expression jsonb,
  p_min_pop integer,
  p_max_pop integer
)
RETURNS TABLE(gsscode text, pop_final integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_rules jsonb;
  v_rule jsonb;
  v_rule_count integer;
  v_current_index integer := 0;
  v_sql text;
  v_rule_sqls text[] := ARRAY[]::text[];
  v_connector text;
BEGIN
  -- Extract rules array from filter expression
  v_rules := p_filter_expression->'rules';
  v_rule_count := jsonb_array_length(v_rules);

  -- If no rules, return all BUAs in population range
  IF v_rule_count = 0 OR v_rules IS NULL THEN
    RETURN QUERY
    SELECT b.gsscode, b.pop_final
    FROM built_up_areas b
    WHERE b.pop_final BETWEEN p_min_pop AND p_max_pop
    ORDER BY b.pop_final DESC NULLS LAST;
    RETURN;
  END IF;

  -- Build SQL for each rule
  FOR v_current_index IN 0..(v_rule_count - 1) LOOP
    v_rule := v_rules->v_current_index;

    -- Generate SQL for this rule
    v_rule_sqls := array_append(v_rule_sqls,
      filter_buas_evaluate_rule(v_rule, p_min_pop, p_max_pop)
    );
  END LOOP;

  -- Combine rules with connectors using left-to-right evaluation
  v_sql := v_rule_sqls[1];  -- Start with first rule

  FOR v_current_index IN 2..array_length(v_rule_sqls, 1) LOOP
    -- Get connector from previous rule (index - 2 because arrays are 1-based and we need previous rule)
    v_connector := v_rules->(v_current_index - 2)->>'connector';

    IF v_connector = 'or' THEN
      -- Union (OR): combine with previous results
      v_sql := format('(%s) UNION (%s)', v_sql, v_rule_sqls[v_current_index]);
    ELSE
      -- Intersect (AND): only keep BUAs that match both
      v_sql := format('(%s) INTERSECT (%s)', v_sql, v_rule_sqls[v_current_index]);
    END IF;
  END LOOP;

  -- Add final ordering
  v_sql := format('SELECT * FROM (%s) AS combined ORDER BY pop_final DESC NULLS LAST', v_sql);

  -- Log the generated SQL for debugging
  RAISE NOTICE 'Generated SQL: %', v_sql;

  -- Execute and return
  RETURN QUERY EXECUTE v_sql;
END;
$$;

-- Helper function to evaluate a single rule
CREATE OR REPLACE FUNCTION filter_buas_evaluate_rule(
  p_rule jsonb,
  p_min_pop integer,
  p_max_pop integer
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_operator text;
  v_target_type text;
  v_target_ids uuid[];
  v_matching_logic text;
  v_distance integer;
  v_sql text;
BEGIN
  -- Extract rule properties
  v_operator := p_rule->>'operator';
  v_target_type := p_rule->>'targetType';
  v_matching_logic := p_rule->>'matchingLogic';
  v_distance := (p_rule->>'distance')::integer;

  -- Convert targetIds from jsonb array to uuid array
  SELECT array_agg(value::text::uuid)
  INTO v_target_ids
  FROM jsonb_array_elements_text(p_rule->'targetIds');

  IF v_target_ids IS NULL OR array_length(v_target_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Filter rule has no targetIds';
  END IF;

  -- Build SQL based on operator
  CASE v_operator
    WHEN 'has' THEN
      v_sql := filter_buas_rule_has(
        v_target_type,
        v_target_ids,
        v_matching_logic,
        p_min_pop,
        p_max_pop
      );

    WHEN 'has_not' THEN
      v_sql := filter_buas_rule_has_not(
        v_target_type,
        v_target_ids,
        v_matching_logic,
        p_min_pop,
        p_max_pop
      );

    WHEN 'has_within' THEN
      v_sql := filter_buas_rule_has_within(
        v_target_type,
        v_target_ids,
        v_matching_logic,
        v_distance,
        p_min_pop,
        p_max_pop
      );

    WHEN 'has_not_within' THEN
      v_sql := filter_buas_rule_has_not_within(
        v_target_type,
        v_target_ids,
        v_matching_logic,
        v_distance,
        p_min_pop,
        p_max_pop
      );

    ELSE
      RAISE EXCEPTION 'Unknown operator: %', v_operator;
  END CASE;

  RETURN v_sql;
END;
$$;

-- Rule evaluator: HAS (BUA contains store/category)
CREATE OR REPLACE FUNCTION filter_buas_rule_has(
  p_target_type text,
  p_target_ids uuid[],
  p_matching_logic text,
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
BEGIN
  -- Determine which column to check (fascia_id or category_id)
  v_column_name := CASE p_target_type
    WHEN 'fascia' THEN 'fascia_id'
    WHEN 'category' THEN 'category_id'
    ELSE NULL
  END;

  IF v_column_name IS NULL THEN
    RAISE EXCEPTION 'Invalid target type: %', p_target_type;
  END IF;

  -- Build SQL based on matching logic
  IF p_matching_logic = 'all' THEN
    -- AND logic: BUA must have ALL specified targets
    v_sql := format($sql$
      SELECT b.gsscode, b.pop_final
      FROM built_up_areas b
      WHERE b.pop_final BETWEEN %s AND %s
        AND (
          SELECT COUNT(DISTINCT sp.%I)
          FROM bua_store_presence sp
          WHERE sp.bua_gsscode = b.gsscode
            AND sp.%I = ANY($1)
        ) = array_length($1, 1)
    $sql$, p_min_pop, p_max_pop, v_column_name, v_column_name);
  ELSE
    -- OR logic: BUA must have at least ONE of the specified targets
    v_sql := format($sql$
      SELECT b.gsscode, b.pop_final
      FROM built_up_areas b
      WHERE b.pop_final BETWEEN %s AND %s
        AND EXISTS (
          SELECT 1
          FROM bua_store_presence sp
          WHERE sp.bua_gsscode = b.gsscode
            AND sp.%I = ANY($1)
        )
    $sql$, p_min_pop, p_max_pop, v_column_name);
  END IF;

  -- Replace $1 with actual array literal using ARRAY constructor syntax
  SELECT 'ARRAY[' || string_agg(quote_literal(id::text), ',') || ']::uuid[]'
  INTO v_array_literal
  FROM unnest(p_target_ids) AS id;

  v_sql := replace(v_sql, '$1', v_array_literal);

  RETURN v_sql;
END;
$$;

-- Rule evaluator: HAS_NOT (BUA doesn't contain store/category)
CREATE OR REPLACE FUNCTION filter_buas_rule_has_not(
  p_target_type text,
  p_target_ids uuid[],
  p_matching_logic text,
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
BEGIN
  v_column_name := CASE p_target_type
    WHEN 'fascia' THEN 'fascia_id'
    WHEN 'category' THEN 'category_id'
    ELSE NULL
  END;

  IF v_column_name IS NULL THEN
    RAISE EXCEPTION 'Invalid target type: %', p_target_type;
  END IF;

  -- For exclusion, 'all' means "doesn't have ALL of them" (has none or only some)
  -- and 'any' means "doesn't have ANY of them" (has none)
  IF p_matching_logic = 'all' THEN
    -- AND logic: BUA must NOT have ALL specified targets (can have some, but not all)
    v_sql := format($sql$
      SELECT b.gsscode, b.pop_final
      FROM built_up_areas b
      WHERE b.pop_final BETWEEN %s AND %s
        AND (
          SELECT COUNT(DISTINCT sp.%I)
          FROM bua_store_presence sp
          WHERE sp.bua_gsscode = b.gsscode
            AND sp.%I = ANY($1)
        ) < array_length($1, 1)
    $sql$, p_min_pop, p_max_pop, v_column_name, v_column_name);
  ELSE
    -- OR logic: BUA must NOT have ANY of the specified targets
    v_sql := format($sql$
      SELECT b.gsscode, b.pop_final
      FROM built_up_areas b
      WHERE b.pop_final BETWEEN %s AND %s
        AND NOT EXISTS (
          SELECT 1
          FROM bua_store_presence sp
          WHERE sp.bua_gsscode = b.gsscode
            AND sp.%I = ANY($1)
        )
    $sql$, p_min_pop, p_max_pop, v_column_name);
  END IF;

  -- Replace $1 with actual array literal using ARRAY constructor syntax
  SELECT 'ARRAY[' || string_agg(quote_literal(id::text), ',') || ']::uuid[]'
  INTO v_array_literal
  FROM unnest(p_target_ids) AS id;

  v_sql := replace(v_sql, '$1', v_array_literal);

  RETURN v_sql;
END;
$$;

-- Rule evaluator: HAS_WITHIN (store/category within distance)
CREATE OR REPLACE FUNCTION filter_buas_rule_has_within(
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
BEGIN
  v_column_name := CASE p_target_type
    WHEN 'fascia' THEN 'fascia_id'
    WHEN 'category' THEN 'category_id'
    ELSE NULL
  END;

  IF v_column_name IS NULL THEN
    RAISE EXCEPTION 'Invalid target type: %', p_target_type;
  END IF;

  IF p_matching_logic = 'all' THEN
    -- AND logic: ALL specified targets must be within distance
    v_sql := format($sql$
      SELECT b.gsscode, b.pop_final
      FROM built_up_areas b
      WHERE b.pop_final BETWEEN %s AND %s
        AND (
          SELECT COUNT(DISTINCT sn.%I)
          FROM bua_store_nearby sn
          WHERE sn.bua_gsscode = b.gsscode
            AND sn.distance_m <= %s
            AND sn.%I = ANY($1)
        ) = array_length($1, 1)
    $sql$, p_min_pop, p_max_pop, v_column_name, p_distance, v_column_name);
  ELSE
    -- OR logic: At least ONE specified target must be within distance
    v_sql := format($sql$
      SELECT b.gsscode, b.pop_final
      FROM built_up_areas b
      WHERE b.pop_final BETWEEN %s AND %s
        AND EXISTS (
          SELECT 1
          FROM bua_store_nearby sn
          WHERE sn.bua_gsscode = b.gsscode
            AND sn.distance_m <= %s
            AND sn.%I = ANY($1)
        )
    $sql$, p_min_pop, p_max_pop, p_distance, v_column_name);
  END IF;

  -- Replace $1 with actual array literal using ARRAY constructor syntax
  SELECT 'ARRAY[' || string_agg(quote_literal(id::text), ',') || ']::uuid[]'
  INTO v_array_literal
  FROM unnest(p_target_ids) AS id;

  v_sql := replace(v_sql, '$1', v_array_literal);

  RETURN v_sql;
END;
$$;

-- Rule evaluator: HAS_NOT_WITHIN (no store/category within distance)
CREATE OR REPLACE FUNCTION filter_buas_rule_has_not_within(
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
BEGIN
  v_column_name := CASE p_target_type
    WHEN 'fascia' THEN 'fascia_id'
    WHEN 'category' THEN 'category_id'
    ELSE NULL
  END;

  IF v_column_name IS NULL THEN
    RAISE EXCEPTION 'Invalid target type: %', p_target_type;
  END IF;

  IF p_matching_logic = 'all' THEN
    -- AND logic: NOT ALL targets within distance (can have some, but not all)
    v_sql := format($sql$
      SELECT b.gsscode, b.pop_final
      FROM built_up_areas b
      WHERE b.pop_final BETWEEN %s AND %s
        AND (
          SELECT COUNT(DISTINCT sn.%I)
          FROM bua_store_nearby sn
          WHERE sn.bua_gsscode = b.gsscode
            AND sn.distance_m <= %s
            AND sn.%I = ANY($1)
        ) < array_length($1, 1)
    $sql$, p_min_pop, p_max_pop, v_column_name, p_distance, v_column_name);
  ELSE
    -- OR logic: NONE of the targets within distance
    v_sql := format($sql$
      SELECT b.gsscode, b.pop_final
      FROM built_up_areas b
      WHERE b.pop_final BETWEEN %s AND %s
        AND NOT EXISTS (
          SELECT 1
          FROM bua_store_nearby sn
          WHERE sn.bua_gsscode = b.gsscode
            AND sn.distance_m <= %s
            AND sn.%I = ANY($1)
        )
    $sql$, p_min_pop, p_max_pop, p_distance, v_column_name);
  END IF;

  -- Replace $1 with actual array literal using ARRAY constructor syntax
  SELECT 'ARRAY[' || string_agg(quote_literal(id::text), ',') || ']::uuid[]'
  INTO v_array_literal
  FROM unnest(p_target_ids) AS id;

  v_sql := replace(v_sql, '$1', v_array_literal);

  RETURN v_sql;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION filter_buas_with_expression(jsonb, integer, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION filter_buas_evaluate_rule(jsonb, integer, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION filter_buas_rule_has(text, uuid[], text, integer, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION filter_buas_rule_has_not(text, uuid[], text, integer, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION filter_buas_rule_has_within(text, uuid[], text, integer, integer, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION filter_buas_rule_has_not_within(text, uuid[], text, integer, integer, integer) TO authenticated, anon;
