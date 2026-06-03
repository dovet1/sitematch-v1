-- Migration 4: Create Signal Mappings Configuration Table
-- Purpose: Define calculation rules for each signal (component_ids, weights, thresholds)

CREATE TABLE public.demographic_signal_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_name TEXT NOT NULL UNIQUE,
  signal_category TEXT NOT NULL, -- matches filter_type in demographic_filters
  component_ids JSONB NOT NULL,  -- Array of component_ids used
  calculation_rules JSONB NOT NULL, -- Weights, thresholds, formulas
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_signal_mappings_category ON public.demographic_signal_mappings(signal_category);

GRANT SELECT ON public.demographic_signal_mappings TO authenticated, anon;

COMMENT ON TABLE public.demographic_signal_mappings IS
  'Configuration for demographic signal calculations. Stores component_ids, weights, and thresholds for each signal.';

-- Validate metric_averages table schema
DO $$
BEGIN
  -- Verify metric_averages has required columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'metric_averages'
      AND column_name IN ('component_id', 'geography_level', 'geography_code', 'avg_pct')
    HAVING COUNT(*) = 4
  ) THEN
    RAISE EXCEPTION 'metric_averages table missing required columns (component_id, geography_level, geography_code, avg_pct)';
  END IF;

  -- Verify we have national averages for key components
  IF NOT EXISTS (
    SELECT 1 FROM metric_averages
    WHERE geography_level = 'national'
      AND geography_code IS NULL
      AND component_id = 'age_25_29'
  ) THEN
    RAISE WARNING 'metric_averages missing national averages - index calculations will return NULL for some signals';
  END IF;

  RAISE NOTICE 'metric_averages schema validated successfully';
END $$;

-- Seed signal mappings (UPDATED with actual component_ids from database)
INSERT INTO public.demographic_signal_mappings (signal_name, signal_category, component_ids, calculation_rules, description) VALUES

-- Life Stage Signals
('student_market', 'life_stage',
 '["age_15_19", "age_20_24", "economically_active_and_a_full_time_student"]',
 '{"components": {"age_15_19": {"weight": 0.35}, "age_20_24": {"weight": 0.40}, "economically_active_and_a_full_time_student": {"weight": 0.25}}, "index_threshold": 110}',
 'Student market concentration (15-24 age group with full-time students)'),

('young_professionals', 'life_stage',
 '["age_25_29", "age_30_34", "age_35_39", "professional_occupations", "managers_directors_and_senior_officials"]',
 '{"components": {"age_25_29": {"weight": 0.25}, "age_30_34": {"weight": 0.25}, "age_35_39": {"weight": 0.25}, "professional_occupations": {"weight": 0.15}, "managers_directors_and_senior_officials": {"weight": 0.10}}, "index_threshold": 110}',
 'Young professional concentration (25-39 age group with professional occupations)'),

('family_market', 'life_stage',
 '["age_5_9", "age_10_14", "age_30_34", "age_35_39", "age_40_44", "age_45_49", "hhc_single_family_household"]',
 '{"components": {"age_5_9": {"weight": 0.20}, "age_10_14": {"weight": 0.20}, "age_30_34": {"weight": 0.10}, "age_35_39": {"weight": 0.10}, "age_40_44": {"weight": 0.10}, "age_45_49": {"weight": 0.10}, "hhc_single_family_household": {"weight": 0.20}}, "index_threshold": 110}',
 'Family market (children 5-14 + parents aged 30-49)'),

('empty_nesters', 'life_stage',
 '["age_55_59", "age_60_64", "age_65_69", "owned"]',
 '{"components": {"age_55_59": {"weight": 0.3}, "age_60_64": {"weight": 0.3}, "age_65_69": {"weight": 0.3}, "owned": {"weight": 0.1}}, "index_threshold": 110}',
 'Empty nester market (55-69, homeowners)'),

('retirement_market', 'life_stage',
 '["age_65_69", "age_70_74", "age_75_79", "age_80_84"]',
 '{"components": {"age_65_69": {"weight": 0.25}, "age_70_74": {"weight": 0.25}, "age_75_79": {"weight": 0.25}, "age_80_84": {"weight": 0.25}}, "index_threshold": 110}',
 'Retirement market (65-84)'),

-- Affluence Signals
('affluence_high', 'affluence',
 '["professional_occupations", "managers_directors_and_senior_officials", "level_4_qualifications_and_above", "owned", "owns_with_mortgage_or_loan_or_shared_ownership"]',
 '{"components": {"professional_occupations": {"weight": 0.25}, "managers_directors_and_senior_officials": {"weight": 0.25}, "level_4_qualifications_and_above": {"weight": 0.25}, "owned": {"weight": 0.15}, "owns_with_mortgage_or_loan_or_shared_ownership": {"weight": 0.10}}, "index_threshold": 120}',
 'High affluence (20%+ above national average)'),

('affluence_medium', 'affluence',
 '["professional_occupations", "managers_directors_and_senior_officials", "level_4_qualifications_and_above", "owned", "owns_with_mortgage_or_loan_or_shared_ownership"]',
 '{"components": {"professional_occupations": {"weight": 0.25}, "managers_directors_and_senior_officials": {"weight": 0.25}, "level_4_qualifications_and_above": {"weight": 0.25}, "owned": {"weight": 0.15}, "owns_with_mortgage_or_loan_or_shared_ownership": {"weight": 0.10}}, "index_threshold": 90, "index_max": 120}',
 'Medium affluence (within 10% of national average)'),

('affluence_low', 'affluence',
 '["professional_occupations", "managers_directors_and_senior_officials", "level_4_qualifications_and_above", "owned", "owns_with_mortgage_or_loan_or_shared_ownership"]',
 '{"components": {"professional_occupations": {"weight": 0.25}, "managers_directors_and_senior_officials": {"weight": 0.25}, "level_4_qualifications_and_above": {"weight": 0.25}, "owned": {"weight": 0.15}, "owns_with_mortgage_or_loan_or_shared_ownership": {"weight": 0.10}}, "index_threshold": 0, "index_max": 90}',
 'Low affluence (10%+ below national average)'),

-- Urbanity Signals (using converted housing + detached as proxy for urban/rural)
('urbanity_urban_core', 'urbanity',
 '["accom_converted_house", "accom_converted_other", "private_rented", "on_foot", "bicycle", "bus_minibus_or_coach"]',
 '{"components": {"accom_converted_house": {"weight": 0.20}, "accom_converted_other": {"weight": 0.20}, "private_rented": {"weight": 0.20}, "on_foot": {"weight": 0.20}, "bicycle": {"weight": 0.10}, "bus_minibus_or_coach": {"weight": 0.10}}, "index_threshold": 130}',
 'Urban core (30%+ above national average urbanity - converted housing, rental, public transport)'),

('urbanity_dense_urban', 'urbanity',
 '["accom_converted_house", "accom_converted_other", "private_rented", "on_foot", "bicycle", "bus_minibus_or_coach"]',
 '{"components": {"accom_converted_house": {"weight": 0.20}, "accom_converted_other": {"weight": 0.20}, "private_rented": {"weight": 0.20}, "on_foot": {"weight": 0.20}, "bicycle": {"weight": 0.10}, "bus_minibus_or_coach": {"weight": 0.10}}, "index_threshold": 110, "index_max": 130}',
 'Dense urban (10-30% above national average urbanity)'),

('urbanity_suburban', 'urbanity',
 '["accom_semi_detached", "accom_terraced", "owns_with_mortgage_or_loan_or_shared_ownership"]',
 '{"components": {"accom_semi_detached": {"weight": 0.40}, "accom_terraced": {"weight": 0.40}, "owns_with_mortgage_or_loan_or_shared_ownership": {"weight": 0.20}}, "index_threshold": 110}',
 'Suburban (semi-detached and terraced housing with mortgages)'),

('urbanity_rural', 'urbanity',
 '["accom_detached", "driving_a_car_or_van", "owned"]',
 '{"components": {"accom_detached": {"weight": 0.50}, "driving_a_car_or_van": {"weight": 0.30}, "owned": {"weight": 0.20}}, "index_threshold": 120}',
 'Rural (detached housing, car dependency, ownership)'),

-- Stability Signals
('stability_stable', 'stability',
 '["owned", "owns_with_mortgage_or_loan_or_shared_ownership", "hhc_single_family_household"]',
 '{"stable_components": {"owned": {"weight": 0.40}, "owns_with_mortgage_or_loan_or_shared_ownership": {"weight": 0.35}, "hhc_single_family_household": {"weight": 0.25}}, "transient_components": {"private_rented": {"weight": 0.60}, "economically_active_and_a_full_time_student": {"weight": 0.25}, "age_15_19": {"weight": 0.075}, "age_20_24": {"weight": 0.075}}, "index_threshold": 120}',
 'Stable population (high ownership, low transience)'),

('stability_mixed', 'stability',
 '["owned", "owns_with_mortgage_or_loan_or_shared_ownership", "hhc_single_family_household"]',
 '{"stable_components": {"owned": {"weight": 0.40}, "owns_with_mortgage_or_loan_or_shared_ownership": {"weight": 0.35}, "hhc_single_family_household": {"weight": 0.25}}, "transient_components": {"private_rented": {"weight": 0.60}, "economically_active_and_a_full_time_student": {"weight": 0.25}, "age_15_19": {"weight": 0.075}, "age_20_24": {"weight": 0.075}}, "index_threshold": 80, "index_max": 120}',
 'Mixed stability'),

('stability_transient', 'stability',
 '["owned", "owns_with_mortgage_or_loan_or_shared_ownership", "hhc_single_family_household"]',
 '{"stable_components": {"owned": {"weight": 0.40}, "owns_with_mortgage_or_loan_or_shared_ownership": {"weight": 0.35}, "hhc_single_family_household": {"weight": 0.25}}, "transient_components": {"private_rented": {"weight": 0.60}, "economically_active_and_a_full_time_student": {"weight": 0.25}, "age_15_19": {"weight": 0.075}, "age_20_24": {"weight": 0.075}}, "index_threshold": 0, "index_max": 80}',
 'Transient population (high rental, students)'),

-- Car Dependency Signals
('car_dependency_walkable', 'car_dependency',
 '["on_foot", "bicycle", "bus_minibus_or_coach"]',
 '{"walkable_components": {"on_foot": {"weight": 0.50}, "bicycle": {"weight": 0.30}, "bus_minibus_or_coach": {"weight": 0.20}}, "car_components": {"driving_a_car_or_van": {"weight": 0.80}, "passenger_in_a_car_or_van": {"weight": 0.20}}, "index_threshold": 120}',
 'Walkable (low car dependency)'),

('car_dependency_mixed', 'car_dependency',
 '["on_foot", "bicycle", "bus_minibus_or_coach"]',
 '{"walkable_components": {"on_foot": {"weight": 0.50}, "bicycle": {"weight": 0.30}, "bus_minibus_or_coach": {"weight": 0.20}}, "car_components": {"driving_a_car_or_van": {"weight": 0.80}, "passenger_in_a_car_or_van": {"weight": 0.20}}, "index_threshold": 85, "index_max": 120}',
 'Mixed mobility'),

('car_dependency_car_dependent', 'car_dependency',
 '["on_foot", "bicycle", "bus_minibus_or_coach"]',
 '{"walkable_components": {"on_foot": {"weight": 0.50}, "bicycle": {"weight": 0.30}, "bus_minibus_or_coach": {"weight": 0.20}}, "car_components": {"driving_a_car_or_van": {"weight": 0.80}, "passenger_in_a_car_or_van": {"weight": 0.20}}, "index_threshold": 0, "index_max": 85}',
 'Car dependent (high car usage)'),

-- Professional Economy Signals
('professional_economy_high', 'professional_economy',
 '["professional_occupations", "managers_directors_and_senior_officials", "associate_professional_and_technical_occupations", "level_4_qualifications_and_above"]',
 '{"components": {"professional_occupations": {"weight": 0.30}, "managers_directors_and_senior_officials": {"weight": 0.30}, "associate_professional_and_technical_occupations": {"weight": 0.20}, "level_4_qualifications_and_above": {"weight": 0.20}}, "index_threshold": 120}',
 'High professional economy'),

('professional_economy_medium', 'professional_economy',
 '["professional_occupations", "managers_directors_and_senior_officials", "associate_professional_and_technical_occupations", "level_4_qualifications_and_above"]',
 '{"components": {"professional_occupations": {"weight": 0.30}, "managers_directors_and_senior_officials": {"weight": 0.30}, "associate_professional_and_technical_occupations": {"weight": 0.20}, "level_4_qualifications_and_above": {"weight": 0.20}}, "index_threshold": 85, "index_max": 120}',
 'Medium professional economy'),

('professional_economy_low', 'professional_economy',
 '["professional_occupations", "managers_directors_and_senior_officials", "associate_professional_and_technical_occupations", "level_4_qualifications_and_above"]',
 '{"components": {"professional_occupations": {"weight": 0.30}, "managers_directors_and_senior_officials": {"weight": 0.30}, "associate_professional_and_technical_occupations": {"weight": 0.20}, "level_4_qualifications_and_above": {"weight": 0.20}}, "index_threshold": 0, "index_max": 85}',
 'Low professional economy'),

-- Student Presence Signals
('student_presence_strong', 'student_presence',
 '["economically_active_and_a_full_time_student", "age_15_19", "age_20_24"]',
 '{"components": {"economically_active_and_a_full_time_student": {"weight": 0.50}, "age_15_19": {"weight": 0.25}, "age_20_24": {"weight": 0.25}}, "index_threshold": 150}',
 'Strong student presence (50%+ above national average)'),

('student_presence_moderate', 'student_presence',
 '["economically_active_and_a_full_time_student", "age_15_19", "age_20_24"]',
 '{"components": {"economically_active_and_a_full_time_student": {"weight": 0.50}, "age_15_19": {"weight": 0.25}, "age_20_24": {"weight": 0.25}}, "index_threshold": 110, "index_max": 150}',
 'Moderate student presence'),

('student_presence_minimal', 'student_presence',
 '["economically_active_and_a_full_time_student", "age_15_19", "age_20_24"]',
 '{"components": {"economically_active_and_a_full_time_student": {"weight": 0.50}, "age_15_19": {"weight": 0.25}, "age_20_24": {"weight": 0.25}}, "index_threshold": 0, "index_max": 110}',
 'Minimal student presence');
