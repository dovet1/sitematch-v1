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

GRANT EXECUTE ON FUNCTION filter_buas_evaluate_rule(jsonb, integer, integer) TO authenticated, anon;
