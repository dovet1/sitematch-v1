-- Migration 5: Create BUA Demographic Signals Table
-- Purpose: Pre-computed index scores for all signals per BUA

CREATE TABLE public.bua_demographic_signals (
  id BIGSERIAL PRIMARY KEY,
  bua_gsscode TEXT NOT NULL REFERENCES built_up_areas(gsscode) ON DELETE CASCADE,
  signal_name TEXT NOT NULL REFERENCES demographic_signal_mappings(signal_name) ON DELETE CASCADE,
  index_score NUMERIC(6,2), -- 100 = national average, NULL if data unavailable
  computed_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT bua_demographic_signals_unique UNIQUE (bua_gsscode, signal_name)
);

CREATE INDEX idx_bua_signals_bua ON public.bua_demographic_signals(bua_gsscode);
CREATE INDEX idx_bua_signals_signal ON public.bua_demographic_signals(signal_name);
CREATE INDEX idx_bua_signals_index ON public.bua_demographic_signals(index_score);

GRANT SELECT ON public.bua_demographic_signals TO authenticated, anon;

COMMENT ON TABLE public.bua_demographic_signals IS
  'Pre-computed demographic index scores for each BUA. Index 100 = national average, 130 = 30% above average.';

-- Calculation Function
CREATE OR REPLACE FUNCTION public.calculate_demographic_index(
  p_gsscode TEXT,
  p_signal_mapping RECORD -- From demographic_signal_mappings table
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_weighted_sum NUMERIC := 0;
  v_component_id TEXT;
  v_component_config JSONB;
  v_weight NUMERIC;
  v_bua_value NUMERIC;
  v_national_avg NUMERIC;
  v_component_index NUMERIC;
  v_total_weight NUMERIC := 0;
  v_stable_index NUMERIC := 0;
  v_transient_index NUMERIC := 0;
  v_walkable_index NUMERIC := 0;
  v_car_index NUMERIC := 0;
BEGIN
  -- Check if this is a differential signal (stability or car_dependency)
  IF p_signal_mapping.calculation_rules ? 'stable_components' THEN
    -- Stability signal: calculate stable index - transient index
    -- Calculate stable components index
    FOR v_component_id, v_component_config IN
      SELECT key, value FROM jsonb_each(p_signal_mapping.calculation_rules->'stable_components')
    LOOP
      v_weight := (v_component_config->>'weight')::NUMERIC;
      SELECT value_pct INTO v_bua_value FROM bua_demographics_raw WHERE bua_gsscode = p_gsscode AND component_id = v_component_id;
      SELECT avg_pct INTO v_national_avg FROM metric_averages WHERE component_id = v_component_id AND geography_level = 'national' AND geography_code IS NULL;
      IF v_bua_value IS NOT NULL AND v_national_avg IS NOT NULL AND v_national_avg > 0 THEN
        v_stable_index := v_stable_index + ((v_bua_value / v_national_avg * 100) * v_weight);
        v_total_weight := v_total_weight + v_weight;
      END IF;
    END LOOP;

    -- Calculate transient components index
    FOR v_component_id, v_component_config IN
      SELECT key, value FROM jsonb_each(p_signal_mapping.calculation_rules->'transient_components')
    LOOP
      v_weight := (v_component_config->>'weight')::NUMERIC;
      SELECT value_pct INTO v_bua_value FROM bua_demographics_raw WHERE bua_gsscode = p_gsscode AND component_id = v_component_id;
      SELECT avg_pct INTO v_national_avg FROM metric_averages WHERE component_id = v_component_id AND geography_level = 'national' AND geography_code IS NULL;
      IF v_bua_value IS NOT NULL AND v_national_avg IS NOT NULL AND v_national_avg > 0 THEN
        v_transient_index := v_transient_index + ((v_bua_value / v_national_avg * 100) * v_weight);
        v_total_weight := v_total_weight + v_weight;
      END IF;
    END LOOP;

    -- Return differential: stable - transient (higher = more stable)
    IF v_total_weight > 0 THEN
      RETURN ((v_stable_index - v_transient_index) / v_total_weight * 100) + 100;
    END IF;

  ELSIF p_signal_mapping.calculation_rules ? 'walkable_components' THEN
    -- Car dependency signal: calculate walkable index - car index
    -- Calculate walkable components index
    FOR v_component_id, v_component_config IN
      SELECT key, value FROM jsonb_each(p_signal_mapping.calculation_rules->'walkable_components')
    LOOP
      v_weight := (v_component_config->>'weight')::NUMERIC;
      SELECT value_pct INTO v_bua_value FROM bua_demographics_raw WHERE bua_gsscode = p_gsscode AND component_id = v_component_id;
      SELECT avg_pct INTO v_national_avg FROM metric_averages WHERE component_id = v_component_id AND geography_level = 'national' AND geography_code IS NULL;
      IF v_bua_value IS NOT NULL AND v_national_avg IS NOT NULL AND v_national_avg > 0 THEN
        v_walkable_index := v_walkable_index + ((v_bua_value / v_national_avg * 100) * v_weight);
        v_total_weight := v_total_weight + v_weight;
      END IF;
    END LOOP;

    -- Calculate car components index
    FOR v_component_id, v_component_config IN
      SELECT key, value FROM jsonb_each(p_signal_mapping.calculation_rules->'car_components')
    LOOP
      v_weight := (v_component_config->>'weight')::NUMERIC;
      SELECT value_pct INTO v_bua_value FROM bua_demographics_raw WHERE bua_gsscode = p_gsscode AND component_id = v_component_id;
      SELECT avg_pct INTO v_national_avg FROM metric_averages WHERE component_id = v_component_id AND geography_level = 'national' AND geography_code IS NULL;
      IF v_bua_value IS NOT NULL AND v_national_avg IS NOT NULL AND v_national_avg > 0 THEN
        v_car_index := v_car_index + ((v_bua_value / v_national_avg * 100) * v_weight);
        v_total_weight := v_total_weight + v_weight;
      END IF;
    END LOOP;

    -- Return differential: walkable - car (higher = more walkable, lower = more car dependent)
    IF v_total_weight > 0 THEN
      RETURN ((v_walkable_index - v_car_index) / v_total_weight * 100) + 100;
    END IF;

  ELSE
    -- Standard signal: simple weighted average of components
    FOR v_component_id, v_component_config IN
      SELECT key, value FROM jsonb_each(p_signal_mapping.calculation_rules->'components')
    LOOP
      v_weight := (v_component_config->>'weight')::NUMERIC;
      SELECT value_pct INTO v_bua_value FROM bua_demographics_raw WHERE bua_gsscode = p_gsscode AND component_id = v_component_id;
      SELECT avg_pct INTO v_national_avg FROM metric_averages WHERE component_id = v_component_id AND geography_level = 'national' AND geography_code IS NULL;
      IF v_bua_value IS NOT NULL AND v_national_avg IS NOT NULL AND v_national_avg > 0 THEN
        v_component_index := (v_bua_value / v_national_avg * 100);
        v_weighted_sum := v_weighted_sum + (v_component_index * v_weight);
        v_total_weight := v_total_weight + v_weight;
      END IF;
    END LOOP;

    -- Return weighted average index
    IF v_total_weight > 0 THEN
      RETURN v_weighted_sum / v_total_weight;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

-- Rebuild Function
CREATE OR REPLACE FUNCTION public.rebuild_bua_demographic_signals()
RETURNS TABLE(step_name TEXT, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row_count INTEGER;
  v_signal_mapping RECORD;
BEGIN
  SET statement_timeout = 0;

  RETURN QUERY SELECT 'init'::TEXT, 'Rebuilding bua_demographic_signals table...'::TEXT;

  TRUNCATE TABLE bua_demographic_signals;
  RETURN QUERY SELECT 'truncate'::TEXT, 'Truncated existing signals'::TEXT;

  -- Calculate index for each signal for each BUA
  FOR v_signal_mapping IN
    SELECT * FROM demographic_signal_mappings
  LOOP
    INSERT INTO bua_demographic_signals (bua_gsscode, signal_name, index_score)
    SELECT
      b.gsscode,
      v_signal_mapping.signal_name,
      calculate_demographic_index(b.gsscode, v_signal_mapping)
    FROM built_up_areas b
    WHERE EXISTS (
      SELECT 1 FROM bua_lsoa_weights w WHERE w.bua_gsscode = b.gsscode
    );

    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    RETURN QUERY SELECT 'signal'::TEXT,
      ('Calculated ' || v_signal_mapping.signal_name || ': ' || v_row_count::TEXT || ' BUAs')::TEXT;
  END LOOP;

  RETURN QUERY SELECT 'complete'::TEXT, 'Signals calculation complete!'::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rebuild_bua_demographic_signals() TO authenticated;
