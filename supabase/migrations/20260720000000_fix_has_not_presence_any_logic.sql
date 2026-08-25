-- Fix has_not (presence / "In the town") matchingLogic='any' to use correct NOT EXISTS logic.
-- Bug: migration 047 swapped the has_not branches, leaving the 'any' (ELSE) branch using
--   COUNT(DISTINCT sp.fascia_id) < array_length($1, 1)
-- which means "BUA is missing at least ONE of the target fascias". A brand resolves to ALL
-- of its fascia ids, so a town containing that brand (but not every fascia variant) was
-- wrongly returned as a gap. The client hard-codes matchingLogic='any', so "In the town"
-- exclusion was broken for any multi-fascia brand.
-- Fix: mirror migration 049 (which fixed the proximity sibling has_not_within) — use
-- NOT EXISTS in the 'any' branch so BUAs with ANY matching target are excluded.

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

  -- Build SQL based on matching logic. Both branches now use NOT EXISTS so any BUA that
  -- contains ANY of the target fascias/categories is excluded from the gap results.
  IF p_matching_logic = 'all' THEN
    -- AND logic: BUA must NOT have ANY of the specified targets
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
  ELSE
    -- OR logic: BUA must NOT have ANY of the specified targets (FIXED)
    -- Previous broken logic: COUNT(DISTINCT sp.fascia_id) < array_length($1, 1)
    -- This incorrectly included BUAs with some (but not all) matching stores
    -- New correct logic: Use NOT EXISTS to exclude BUAs with ANY matching store present
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

  -- Replace $1 with expanded array literal
  SELECT 'ARRAY[' || string_agg(quote_literal(id::text), ',') || ']::uuid[]'
  INTO v_array_literal
  FROM unnest(v_expanded_ids) AS id;

  v_sql := replace(v_sql, '$1', v_array_literal);

  RETURN v_sql;
END;
$$;

GRANT EXECUTE ON FUNCTION filter_buas_rule_has_not(text, uuid[], text, integer, integer) TO authenticated, anon;

COMMENT ON FUNCTION filter_buas_rule_has_not IS 'Builds SQL for has_not (presence) operator - both all and any logic now use NOT EXISTS to properly exclude BUAs that contain any matching store';
