-- Migration 9: Create Data Quality Validation
-- Purpose: Validate demographic data quality after rebuild

CREATE OR REPLACE FUNCTION public.validate_demographic_data()
RETURNS TABLE(
  check_name TEXT,
  status TEXT,
  message TEXT,
  detail TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check 1: BUA coverage
  RETURN QUERY
  SELECT
    'BUA Coverage'::TEXT,
    CASE WHEN pct >= 95 THEN 'PASS' ELSE 'WARN' END::TEXT,
    'BUAs with demographic data: ' || count_with_data || ' / ' || total_buas || ' (' || pct::TEXT || '%)',
    CASE WHEN pct < 95 THEN 'Some BUAs missing demographic data' ELSE 'Good coverage' END::TEXT
  FROM (
    SELECT
      COUNT(DISTINCT b.gsscode) AS total_buas,
      COUNT(DISTINCT d.bua_gsscode) AS count_with_data,
      ROUND(COUNT(DISTINCT d.bua_gsscode)::NUMERIC / NULLIF(COUNT(DISTINCT b.gsscode), 0) * 100, 1) AS pct
    FROM built_up_areas b
    LEFT JOIN bua_demographics_raw d ON d.bua_gsscode = b.gsscode
  ) coverage;

  -- Check 2: LSOA weights do not exceed 1.0 (CORRECTED VALIDATION)
  RETURN QUERY
  SELECT
    'LSOA Weight Distribution'::TEXT,
    CASE WHEN invalid_count = 0 THEN 'PASS' ELSE 'FAIL' END::TEXT,
    'LSOAs with weight sum > 1.01: ' || invalid_count::TEXT,
    CASE
      WHEN invalid_count > 0 THEN 'Some LSOAs have overlapping weights > 1.0 - indicates geometry issues'
      ELSE 'All LSOA weights are valid (≤ 1.0)'
    END::TEXT
  FROM (
    SELECT COUNT(*) AS invalid_count
    FROM (
      SELECT lsoa_code, SUM(weight) AS weight_sum
      FROM bua_lsoa_weights
      GROUP BY lsoa_code
      HAVING SUM(weight) > 1.01
    ) invalid_lsoas
  ) weight_check;

  -- Check 3: Signal completeness
  RETURN QUERY
  SELECT
    'Signal Completeness'::TEXT,
    CASE WHEN null_count = 0 THEN 'PASS' ELSE 'WARN' END::TEXT,
    'BUA-signal pairs with NULL index_score: ' || null_count::TEXT,
    CASE
      WHEN null_count = 0 THEN 'All signals computed'
      ELSE 'Some BUAs have NULL signal values - may indicate missing census data or national averages'
    END::TEXT
  FROM (
    SELECT COUNT(*) AS null_count
    FROM bua_demographic_signals
    WHERE index_score IS NULL
  ) signal_check;

  -- Check 4: Tag distribution
  RETURN QUERY
  SELECT
    'Tag Distribution'::TEXT,
    'INFO'::TEXT,
    'Total tags: ' || total_tags::TEXT || ' | Avg tags per BUA: ' || avg_tags_per_bua::TEXT,
    'BUAs can have multiple tags if they over-index on multiple demographics'::TEXT
  FROM (
    SELECT
      COUNT(*) AS total_tags,
      ROUND(COUNT(*)::NUMERIC / NULLIF((SELECT COUNT(DISTINCT bua_gsscode) FROM bua_demographic_tags), 0), 1) AS avg_tags_per_bua
    FROM bua_demographic_tags
  ) tag_stats;

  -- Check 5: Population comparison (weighted vs official)
  RETURN QUERY
  SELECT
    'Population Accuracy'::TEXT,
    CASE WHEN large_diff_count <= 10 THEN 'PASS' ELSE 'WARN' END::TEXT,
    'BUAs with >20% population difference: ' || large_diff_count::TEXT,
    'Weighted LSOA aggregation vs official BUA population. Some difference expected due to boundary misalignment.'::TEXT
  FROM (
    SELECT COUNT(*) AS large_diff_count
    FROM (
      SELECT
        b.gsscode,
        b.pop_final AS official_pop,
        d.numerator AS aggregated_pop,
        ABS((d.numerator - b.pop_final)::NUMERIC / NULLIF(b.pop_final, 0)) AS diff_ratio
      FROM built_up_areas b
      JOIN bua_demographics_raw d ON d.bua_gsscode = b.gsscode
      WHERE d.component_id = 'population_total'
        AND b.pop_final > 1000  -- Only check BUAs with pop > 1000
    ) pop_check
    WHERE diff_ratio > 0.20
  ) pop_validation;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_demographic_data() TO authenticated, anon;

COMMENT ON FUNCTION public.validate_demographic_data IS
  'Validates demographic data quality. Run after rebuild_all_demographics() to verify data integrity.';
