-- Migration 3: Create Demographic Filters Reference Table
-- Purpose: Reference table for filter UI with UUIDs (maintains consistency with brand/fascia pattern)

CREATE TABLE public.demographic_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filter_type TEXT NOT NULL, -- 'life_stage', 'affluence', 'urbanity', 'stability', 'car_dependency', 'professional_economy', 'student_presence'
  value TEXT NOT NULL,       -- 'young_professionals', 'high', 'urban_core', etc.
  display_name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT demographic_filters_unique UNIQUE (filter_type, value)
);

CREATE INDEX idx_demographic_filters_type ON public.demographic_filters(filter_type);

GRANT SELECT ON public.demographic_filters TO authenticated, anon;

COMMENT ON TABLE public.demographic_filters IS
  'Reference table for demographic filter UI. Each filter has a UUID for consistency with existing brand/fascia filter architecture.';

-- Validate that required component_ids exist before seeding
DO $$
DECLARE
  v_missing_components TEXT[];
  v_required_components TEXT[] := ARRAY[
    -- Age components (5-year bands from 5-84)
    'age_5_9', 'age_10_14', 'age_15_19', 'age_20_24', 'age_25_29', 'age_30_34', 'age_35_39',
    'age_40_44', 'age_45_49', 'age_50_54', 'age_55_59', 'age_60_64', 'age_65_69', 'age_70_74',
    'age_75_79', 'age_80_84',
    -- Occupations
    'professional_occupations', 'managers_directors_and_senior_officials',
    'associate_professional_and_technical_occupations',
    -- Qualifications
    'level_4_qualifications_and_above',
    -- Tenure
    'owned', 'owns_with_mortgage_or_loan_or_shared_ownership', 'private_rented',
    -- Accommodation
    'accom_detached', 'accom_semi_detached', 'accom_terraced', 'accom_converted_house', 'accom_converted_other',
    -- Transport
    'on_foot', 'bicycle', 'bus_minibus_or_coach', 'driving_a_car_or_van', 'passenger_in_a_car_or_van',
    -- Economic activity
    'economically_active_and_a_full_time_student',
    -- Household composition
    'hhc_single_family_household'
  ];
BEGIN
  -- Check which required components don't exist in lsoa_metrics
  SELECT ARRAY_AGG(comp) INTO v_missing_components
  FROM UNNEST(v_required_components) AS comp
  WHERE NOT EXISTS (
    SELECT 1 FROM lsoa_metrics WHERE component_id = comp LIMIT 1
  );

  IF array_length(v_missing_components, 1) > 0 THEN
    RAISE EXCEPTION 'Missing required component_ids in lsoa_metrics: %',
      array_to_string(v_missing_components, ', ');
  END IF;

  RAISE NOTICE 'All required component_ids validated successfully';
END $$;

-- Seed demographic filters
INSERT INTO public.demographic_filters (filter_type, value, display_name, description, sort_order) VALUES
-- Life Stages
('life_stage', 'student_market', 'Student Market', 'High concentration of 15-24 year olds and full-time students', 1),
('life_stage', 'young_professionals', 'Young Professionals', '25-39 year olds with professional occupations', 2),
('life_stage', 'family_market', 'Family Market', 'Families with children (5-14) and parents aged 30-49', 3),
('life_stage', 'empty_nesters', 'Empty Nesters', '55-69 year old homeowners', 4),
('life_stage', 'retirement_market', 'Retirement Market', '65+ population', 5),

-- Affluence
('affluence', 'high', 'High Affluence', 'Above-average professional occupations, qualifications, and home ownership', 1),
('affluence', 'medium', 'Medium Affluence', 'Average affluence indicators', 2),
('affluence', 'low', 'Low Affluence', 'Below-average affluence indicators', 3),

-- Urbanity
('urbanity', 'urban_core', 'Urban Core', 'Dense urban areas with converted housing and high public transport use', 1),
('urbanity', 'dense_urban', 'Dense Urban', 'Urban areas with mixed housing and transport', 2),
('urbanity', 'suburban', 'Suburban', 'Suburban areas with semi-detached and terraced housing', 3),
('urbanity', 'rural', 'Rural', 'Rural areas with detached housing and car dependency', 4),

-- Stability
('stability', 'stable', 'Stable', 'High home ownership and family presence', 1),
('stability', 'mixed', 'Mixed', 'Mix of owners and renters', 2),
('stability', 'transient', 'Transient', 'High rental and student population', 3),

-- Car Dependency
('car_dependency', 'walkable', 'Walkable', 'High walking/cycling, low car use', 1),
('car_dependency', 'mixed', 'Mixed Mobility', 'Balanced transport modes', 2),
('car_dependency', 'car_dependent', 'Car Dependent', 'High car usage for commuting', 3),

-- Professional Economy
('professional_economy', 'high', 'High Professional Economy', 'Strong knowledge economy presence', 1),
('professional_economy', 'medium', 'Medium Professional Economy', 'Average professional presence', 2),
('professional_economy', 'low', 'Low Professional Economy', 'Below-average professional presence', 3),

-- Student Presence
('student_presence', 'strong', 'Strong Student Presence', 'Significant student population', 1),
('student_presence', 'moderate', 'Moderate Student Presence', 'Some student presence', 2),
('student_presence', 'minimal', 'Minimal Student Presence', 'Few students', 3);
