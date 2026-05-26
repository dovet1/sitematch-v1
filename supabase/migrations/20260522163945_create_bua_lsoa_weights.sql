-- Migration 1: Create BUA-LSOA Weights Table
-- Purpose: Store spatial intersection weights for LSOA → BUA mapping

CREATE TABLE public.bua_lsoa_weights (
  id BIGSERIAL PRIMARY KEY,
  bua_gsscode TEXT NOT NULL REFERENCES built_up_areas(gsscode) ON DELETE CASCADE,
  lsoa_code TEXT NOT NULL REFERENCES lsoa_boundaries(lsoa_code) ON DELETE CASCADE,
  intersection_area_sqm NUMERIC NOT NULL,
  lsoa_total_area_sqm NUMERIC NOT NULL,
  weight NUMERIC NOT NULL, -- intersection_area / lsoa_total_area
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT bua_lsoa_weights_unique UNIQUE (bua_gsscode, lsoa_code),
  CONSTRAINT bua_lsoa_weights_weight_valid CHECK (weight >= 0 AND weight <= 1)
);

CREATE INDEX idx_bua_lsoa_weights_bua ON public.bua_lsoa_weights(bua_gsscode);
CREATE INDEX idx_bua_lsoa_weights_lsoa ON public.bua_lsoa_weights(lsoa_code);

COMMENT ON TABLE public.bua_lsoa_weights IS
  'Spatial intersection weights for LSOA → BUA mapping. Weight = proportion of LSOA area that falls within BUA boundary.';

-- Population Function
CREATE OR REPLACE FUNCTION public.calculate_bua_lsoa_weights()
RETURNS TABLE(step_name TEXT, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row_count INTEGER;
  v_bua_count INTEGER;
BEGIN
  SET statement_timeout = 0; -- Disable timeout for long-running operation

  RETURN QUERY SELECT 'init'::TEXT, 'Starting BUA-LSOA weight calculation...'::TEXT;

  -- Truncate existing weights
  TRUNCATE TABLE bua_lsoa_weights;
  RETURN QUERY SELECT 'truncate'::TEXT, 'Truncated existing weights'::TEXT;

  -- Calculate intersections between BUAs and LSOAs
  INSERT INTO bua_lsoa_weights (bua_gsscode, lsoa_code, intersection_area_sqm, lsoa_total_area_sqm, weight)
  SELECT
    bg.gsscode AS bua_gsscode,
    lb.lsoa_code,
    ST_Area(ST_Intersection(bg.geom::geography, lb.geometry::geography)) AS intersection_area_sqm,
    ST_Area(lb.geometry::geography) AS lsoa_total_area_sqm,
    ST_Area(ST_Intersection(bg.geom::geography, lb.geometry::geography)) /
      NULLIF(ST_Area(lb.geometry::geography), 0) AS weight
  FROM built_up_area_geometries bg
  JOIN lsoa_boundaries lb ON ST_Intersects(bg.geom, lb.geometry)
  WHERE ST_Area(ST_Intersection(bg.geom::geography, lb.geometry::geography)) > 1000; -- Minimum 1000 sqm overlap

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN QUERY SELECT 'insert'::TEXT, ('Calculated ' || v_row_count::TEXT || ' BUA-LSOA weight pairs')::TEXT;

  -- Validation: BUA coverage
  SELECT COUNT(DISTINCT bua_gsscode) INTO v_bua_count FROM bua_lsoa_weights;
  RETURN QUERY SELECT 'validation'::TEXT,
    ('BUAs with LSOA coverage: ' || v_bua_count::TEXT || ' / ' ||
     (SELECT COUNT(*)::TEXT FROM built_up_areas))::TEXT;

  RETURN QUERY SELECT 'complete'::TEXT, 'Weight calculation complete!'::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_bua_lsoa_weights() TO authenticated;

COMMENT ON FUNCTION public.calculate_bua_lsoa_weights IS
  'Calculates spatial intersection weights between BUAs and LSOAs. Run once after BUA/LSOA boundaries are loaded or updated.';
