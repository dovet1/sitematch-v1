-- Migration 7: Create Demographic Filter Function
-- Purpose: Filter function that returns SQL text (matches existing filter_buas_rule_* pattern)

CREATE OR REPLACE FUNCTION public.filter_buas_rule_demographic(
  p_rule JSONB,
  p_min_pop INTEGER,
  p_max_pop INTEGER
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_target_ids UUID[];
  v_matching_logic TEXT;
  v_sql TEXT;
  v_array_literal TEXT;
BEGIN
  -- Extract targetIds from rule
  v_target_ids := ARRAY(SELECT jsonb_array_elements_text(p_rule->'targetIds'))::UUID[];

  IF array_length(v_target_ids, 1) IS NULL OR array_length(v_target_ids, 1) = 0 THEN
    RAISE EXCEPTION 'targetIds cannot be empty for demographic filter';
  END IF;

  -- Extract matching logic (any/all)
  v_matching_logic := COALESCE(p_rule->>'matchingLogic', 'any');

  -- Build SQL that joins to bua_demographic_tags
  IF v_matching_logic = 'all' THEN
    -- ALL: BUA must have all specified demographic tags
    v_sql := format($sql$
      SELECT b.gsscode, b.pop_final
      FROM built_up_areas b
      WHERE b.pop_final BETWEEN %s AND %s
        AND (
          SELECT COUNT(DISTINCT t.filter_id)
          FROM bua_demographic_tags t
          WHERE t.bua_gsscode = b.gsscode
            AND t.filter_id = ANY($1)
        ) = array_length($1, 1)
    $sql$, p_min_pop, p_max_pop);
  ELSE
    -- ANY: BUA must have at least one of the specified demographic tags
    v_sql := format($sql$
      SELECT b.gsscode, b.pop_final
      FROM built_up_areas b
      WHERE b.pop_final BETWEEN %s AND %s
        AND EXISTS (
          SELECT 1
          FROM bua_demographic_tags t
          WHERE t.bua_gsscode = b.gsscode
            AND t.filter_id = ANY($1)
        )
    $sql$, p_min_pop, p_max_pop);
  END IF;

  -- Replace $1 with array literal (matching pattern from filter_buas_rule_has)
  SELECT 'ARRAY[' || string_agg(quote_literal(id::text), ',') || ']::uuid[]'
  INTO v_array_literal
  FROM unnest(v_target_ids) AS id;

  v_sql := replace(v_sql, '$1', v_array_literal);

  RETURN v_sql;
END;
$$;

GRANT EXECUTE ON FUNCTION public.filter_buas_rule_demographic(JSONB, INTEGER, INTEGER) TO authenticated, anon;

COMMENT ON FUNCTION public.filter_buas_rule_demographic IS
  'Filter function for demographic rules. Returns SQL text with array literals inlined (matches filter_buas_rule_has pattern).';
