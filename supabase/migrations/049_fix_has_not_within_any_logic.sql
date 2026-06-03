-- Fix has_not_within matchingLogic='any' to use correct NOT EXISTS logic
-- Bug: The ELSE branch used count comparison which incorrectly included BUAs with some matching stores
-- Fix: Change to NOT EXISTS to properly exclude BUAs with ANY matching stores nearby

-- Update filter_buas_rule_has_not_within to fix the 'any' logic
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
  v_expanded_ids uuid[];
BEGIN
  -- Determine which column to check
  v_column_name := CASE p_target_type
    WHEN 'fascia' THEN 'fascia_id'
    WHEN 'category' THEN 'category_id'
    ELSE NULL
  END;

  IF v_column_name IS NULL THEN
    RAISE EXCEPTION 'Invalid target type: %', p_target_type;
  END IF;

  -- EXPAND CATEGORY HIERARCHY
  IF p_target_type = 'category' THEN
    v_expanded_ids := get_category_descendants(p_target_ids);
  ELSE
    v_expanded_ids := p_target_ids;
  END IF;

  -- Build SQL based on matching logic
  IF p_matching_logic = 'all' THEN
    -- AND logic: BUA must NOT have ANY of the specified targets within distance
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
  ELSE
    -- OR logic: BUA must NOT have ANY of the specified targets within distance (FIXED)
    -- Previous broken logic: COUNT(DISTINCT sn.fascia_id) < array_length($1, 1)
    -- This incorrectly included BUAs with some (but not all) matching stores
    -- New correct logic: Use NOT EXISTS to exclude BUAs with ANY matching stores
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

  -- Replace $1 with expanded array literal
  SELECT 'ARRAY[' || string_agg(quote_literal(id::text), ',') || ']::uuid[]'
  INTO v_array_literal
  FROM unnest(v_expanded_ids) AS id;

  v_sql := replace(v_sql, '$1', v_array_literal);

  RETURN v_sql;
END;
$$;

GRANT EXECUTE ON FUNCTION filter_buas_rule_has_not_within(text, uuid[], text, integer, integer, integer) TO authenticated, anon;

COMMENT ON FUNCTION filter_buas_rule_has_not_within IS 'Builds SQL for has_not_within operator - both all and any logic now use NOT EXISTS to properly exclude BUAs with matching stores nearby';
