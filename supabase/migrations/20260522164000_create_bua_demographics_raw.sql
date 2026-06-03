-- Migration 2: Create BUA Demographics Raw Table
-- Purpose: Aggregate census metrics at BUA level using weighted sum

CREATE TABLE public.bua_demographics_raw (
  id BIGSERIAL PRIMARY KEY,
  bua_gsscode TEXT NOT NULL REFERENCES built_up_areas(gsscode) ON DELETE CASCADE,
  component_id TEXT NOT NULL,
  ts_code TEXT NOT NULL,
  numerator INTEGER NOT NULL,
  denominator INTEGER NOT NULL,
  value_pct NUMERIC(6,2),
  computed_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT bua_demographics_raw_unique UNIQUE (bua_gsscode, component_id)
);

CREATE INDEX idx_bua_demographics_raw_bua ON public.bua_demographics_raw(bua_gsscode);
CREATE INDEX idx_bua_demographics_raw_component ON public.bua_demographics_raw(component_id);
CREATE INDEX idx_bua_demographics_raw_ts_code ON public.bua_demographics_raw(ts_code);

COMMENT ON TABLE public.bua_demographics_raw IS
  'Aggregated census metrics at BUA level. Numerator/denominator are weighted sums from constituent LSOAs. Value_pct = (numerator/denominator)*100.';

-- Rebuild Function
CREATE OR REPLACE FUNCTION public.rebuild_bua_demographics_raw()
RETURNS TABLE(step_name TEXT, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row_count INTEGER;
BEGIN
  SET statement_timeout = 0;

  RETURN QUERY SELECT 'init'::TEXT, 'Rebuilding bua_demographics_raw table...'::TEXT;

  -- Truncate existing data
  TRUNCATE TABLE bua_demographics_raw;
  RETURN QUERY SELECT 'truncate'::TEXT, 'Truncated existing demographics'::TEXT;

  -- Aggregate weighted metrics
  INSERT INTO bua_demographics_raw (bua_gsscode, component_id, ts_code, numerator, denominator, value_pct)
  SELECT
    w.bua_gsscode,
    m.component_id,
    m.ts_code,
    SUM(m.numerator * w.weight)::INTEGER AS numerator,
    SUM(m.denominator * w.weight)::INTEGER AS denominator,
    CASE
      WHEN SUM(m.denominator * w.weight) > 0
      THEN (SUM(m.numerator * w.weight) / SUM(m.denominator * w.weight) * 100)::NUMERIC(6,2)
      ELSE NULL
    END AS value_pct
  FROM bua_lsoa_weights w
  JOIN lsoa_metrics m ON m.geo_code = w.lsoa_code
  WHERE m.edition = '2021'
    AND m.numerator IS NOT NULL
    AND m.denominator IS NOT NULL
  GROUP BY w.bua_gsscode, m.component_id, m.ts_code;

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN QUERY SELECT 'insert'::TEXT, ('Aggregated ' || v_row_count::TEXT || ' BUA demographic metrics')::TEXT;

  RETURN QUERY SELECT 'validation'::TEXT,
    ('Processed ' || COUNT(DISTINCT bua_gsscode)::TEXT || ' BUAs')::TEXT
  FROM bua_demographics_raw;

  RETURN QUERY SELECT 'complete'::TEXT, 'Demographics aggregation complete!'::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rebuild_bua_demographics_raw() TO authenticated;
GRANT SELECT ON public.bua_demographics_raw TO authenticated, anon;

-- Helper Functions
CREATE OR REPLACE FUNCTION public.get_bua_metric(
  p_gsscode TEXT,
  p_component_id TEXT
)
RETURNS NUMERIC
LANGUAGE sql STABLE
AS $$
  SELECT value_pct
  FROM bua_demographics_raw
  WHERE bua_gsscode = p_gsscode AND component_id = p_component_id;
$$;

CREATE OR REPLACE FUNCTION public.get_bua_metrics(
  p_gsscode TEXT,
  p_component_ids TEXT[]
)
RETURNS JSONB
LANGUAGE sql STABLE
AS $$
  SELECT jsonb_object_agg(component_id, value_pct)
  FROM bua_demographics_raw
  WHERE bua_gsscode = p_gsscode AND component_id = ANY(p_component_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_bua_metric(TEXT, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_bua_metrics(TEXT, TEXT[]) TO authenticated, anon;
