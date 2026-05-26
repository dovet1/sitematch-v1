-- Migration 8: Create Master Rebuild Function
-- Purpose: Single command to rebuild entire demographic layer

CREATE OR REPLACE FUNCTION public.rebuild_all_demographics(
  p_skip_weights BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(step_name TEXT, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  SET statement_timeout = 0;

  RETURN QUERY SELECT 'header'::TEXT, '=== Starting full demographic rebuild ==='::TEXT;

  -- Step 1: Calculate BUA-LSOA weights (if not skipping)
  IF NOT p_skip_weights THEN
    RETURN QUERY SELECT 'phase1'::TEXT, '--- Phase 1: BUA-LSOA Weights ---'::TEXT;
    RETURN QUERY SELECT * FROM calculate_bua_lsoa_weights();
  ELSE
    RETURN QUERY SELECT 'phase1'::TEXT, 'Skipping weight calculation (using existing weights)'::TEXT;
  END IF;

  -- Step 2: Aggregate raw demographics
  RETURN QUERY SELECT 'phase2'::TEXT, '--- Phase 2: Raw Demographics Aggregation ---'::TEXT;
  RETURN QUERY SELECT * FROM rebuild_bua_demographics_raw();

  -- Step 3: Calculate commercial signals
  RETURN QUERY SELECT 'phase3'::TEXT, '--- Phase 3: Commercial Signal Indices ---'::TEXT;
  RETURN QUERY SELECT * FROM rebuild_bua_demographic_signals();

  -- Step 4: Generate demographic tags
  RETURN QUERY SELECT 'phase4'::TEXT, '--- Phase 4: Demographic Tags ---'::TEXT;
  RETURN QUERY SELECT * FROM rebuild_bua_demographic_tags();

  RETURN QUERY SELECT 'complete'::TEXT, '=== Demographic rebuild complete! ==='::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rebuild_all_demographics(BOOLEAN) TO authenticated;

COMMENT ON FUNCTION public.rebuild_all_demographics IS
  'Master rebuild function for all BUA demographic data.
   Set p_skip_weights=true to skip weight calculation (use when census data changes but boundaries do not).
   WARNING: This is a long-running operation (may take 10-30 minutes depending on data size).';
