-- Migration 6: Create BUA Demographic Tags Table (Many-to-Many)
-- Purpose: Tag BUAs that over-index on specific demographics (enables fast filtering)

CREATE TABLE public.bua_demographic_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bua_gsscode TEXT NOT NULL REFERENCES built_up_areas(gsscode) ON DELETE CASCADE,
  filter_id UUID NOT NULL REFERENCES demographic_filters(id) ON DELETE CASCADE,
  index_score NUMERIC(6,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT bua_demographic_tags_unique UNIQUE (bua_gsscode, filter_id)
);

CREATE INDEX idx_bua_tags_bua ON public.bua_demographic_tags(bua_gsscode);
CREATE INDEX idx_bua_tags_filter ON public.bua_demographic_tags(filter_id);
CREATE INDEX idx_bua_tags_index ON public.bua_demographic_tags(index_score);

GRANT SELECT ON public.bua_demographic_tags TO authenticated, anon;

COMMENT ON TABLE public.bua_demographic_tags IS
  'Many-to-many tags for BUAs that over-index on specific demographics. Tag is applied if index_score >= threshold (typically 110 = 10% above national average).';

-- Rebuild Function
CREATE OR REPLACE FUNCTION public.rebuild_bua_demographic_tags()
RETURNS TABLE(step_name TEXT, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row_count INTEGER;
BEGIN
  SET statement_timeout = 0;

  RETURN QUERY SELECT 'init'::TEXT, 'Rebuilding bua_demographic_tags table...'::TEXT;

  TRUNCATE TABLE bua_demographic_tags;
  RETURN QUERY SELECT 'truncate'::TEXT, 'Truncated existing tags'::TEXT;

  -- Tag BUAs where index >= threshold
  INSERT INTO bua_demographic_tags (bua_gsscode, filter_id, index_score)
  SELECT
    s.bua_gsscode,
    f.id AS filter_id,
    s.index_score
  FROM bua_demographic_signals s
  JOIN demographic_signal_mappings m ON m.signal_name = s.signal_name
  JOIN demographic_filters f ON f.filter_type = m.signal_category
    AND f.value = (
      -- Map signal_name to filter value
      CASE
        WHEN m.signal_name = 'affluence_high' THEN 'high'
        WHEN m.signal_name = 'affluence_medium' THEN 'medium'
        WHEN m.signal_name = 'affluence_low' THEN 'low'
        WHEN m.signal_name = 'urbanity_urban_core' THEN 'urban_core'
        WHEN m.signal_name = 'urbanity_dense_urban' THEN 'dense_urban'
        WHEN m.signal_name = 'urbanity_suburban' THEN 'suburban'
        WHEN m.signal_name = 'urbanity_rural' THEN 'rural'
        WHEN m.signal_name = 'stability_stable' THEN 'stable'
        WHEN m.signal_name = 'stability_mixed' THEN 'mixed'
        WHEN m.signal_name = 'stability_transient' THEN 'transient'
        WHEN m.signal_name = 'car_dependency_walkable' THEN 'walkable'
        WHEN m.signal_name = 'car_dependency_mixed' THEN 'mixed'
        WHEN m.signal_name = 'car_dependency_car_dependent' THEN 'car_dependent'
        WHEN m.signal_name = 'professional_economy_high' THEN 'high'
        WHEN m.signal_name = 'professional_economy_medium' THEN 'medium'
        WHEN m.signal_name = 'professional_economy_low' THEN 'low'
        WHEN m.signal_name = 'student_presence_strong' THEN 'strong'
        WHEN m.signal_name = 'student_presence_moderate' THEN 'moderate'
        WHEN m.signal_name = 'student_presence_minimal' THEN 'minimal'
        ELSE m.signal_name
      END
    )
  WHERE s.index_score IS NOT NULL
    AND s.index_score >= COALESCE((m.calculation_rules->>'index_threshold')::NUMERIC, 110)
    AND ((m.calculation_rules->>'index_max') IS NULL
         OR s.index_score < (m.calculation_rules->>'index_max')::NUMERIC);

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN QUERY SELECT 'insert'::TEXT, ('Created ' || v_row_count::TEXT || ' demographic tags')::TEXT;

  -- Summary statistics
  RETURN QUERY
  SELECT 'summary'::TEXT,
    (f.display_name || ': ' || COUNT(*)::TEXT || ' BUAs')::TEXT
  FROM bua_demographic_tags t
  JOIN demographic_filters f ON f.id = t.filter_id
  GROUP BY f.display_name, f.sort_order
  ORDER BY f.sort_order;

  RETURN QUERY SELECT 'complete'::TEXT, 'Tags rebuild complete!'::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rebuild_bua_demographic_tags() TO authenticated;
