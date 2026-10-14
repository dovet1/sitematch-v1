-- Fix the scale of the two "difference" demographic signals (stability, car dependency).
--
-- calculate_demographic_index() returns an index where 100 = national average. For the
-- differential signals it computed (a - b) / total_weight * 100 + 100, but a and b are already
-- weighted sums of index points, so (a - b) / total_weight is already in index points and the
-- extra * 100 inflated the result a hundredfold: production scores ran from about -6,000 to
-- +15,000, overflowed bua_demographic_signals.index_score (numeric(6,2)) for 7 towns, and so
-- rebuild_bua_demographic_signals() could not complete. Dropping the * 100 puts these signals on
-- the same scale as the others, which is the scale their index_threshold values (e.g. 110) assume.
--
-- The function is otherwise unchanged from 20260522164045_create_bua_demographic_signals.sql.

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
      RETURN ((v_stable_index - v_transient_index) / v_total_weight) + 100;
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
      RETURN ((v_walkable_index - v_car_index) / v_total_weight) + 100;
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
