/**
 * Census 2021 Data from Supabase
 * Fetches demographic metrics from the lsoa_metrics table
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

interface LSOAMetric {
  geo_code: string;
  geo_name: string;
  component_id: string;
  ts_code: string;
  value_pct: number | null;
  numerator: number | null;
  denominator: number | null;
  edition: string;
}

interface AggregatedMetric {
  component_id: string;
  selected_avg_pct: number | null;
  selected_total: number | null;
  selected_denominator: number | null;
  national_avg_pct: number | null;
}

interface AffluenceData {
  avg_raw_score: number;
  calculated_category: 'A' | 'B' | 'C' | 'D' | 'E';
  lsoa_count: number;
}

interface LSOAData {
  lsoa_code: string;
  lsoa_name?: string;
  // Population & Households
  population_total: number;
  households_total: number;
  household_composition: Record<string, number>;
  accommodation_type: Record<string, number>;
  tenure: Record<string, number>;
  // Demographics
  age_groups: Record<string, number>;
  ethnicity: Record<string, number>;
  country_of_birth: Record<string, number>;
  religion: Record<string, number>;
  // Employment
  economic_activity: Record<string, number>;
  occupation: Record<string, number>;
  // Education
  qualifications: Record<string, number>;
  // Mobility
  travel_to_work: Record<string, number>;
  distance_to_work: Record<string, number>;
  // Health
  general_health: Record<string, number>;
  disability: Record<string, number>;
  // Affluence
  affluence?: AffluenceData;
}

/**
 * Component ID prefix mapping for categorization
 */
const COMPONENT_PREFIXES = {
  household_composition: 'hhc_',
  accommodation_type: 'accom_',
  age_groups: 'age_',
  country_of_birth: 'cob_',
  travel_to_work: [
    'work_mainly_at_or_from_home',
    'underground_metro_light_rail_tram',
    'train',
    'bus_minibus_or_coach',
    'taxi',
    'motorcycle_scooter_or_moped',
    'driving_a_car_or_van',
    'passenger_in_a_car_or_van',
    'bicycle',
    'on_foot',
    'other_method_of_travel_to_work',
  ],
  distance_to_work: 'ts058_',
  economic_activity: 'economically_',
  occupation: [
    'managers_directors_and_senior_officials',
    'professional_occupations',
    'associate_professional_and_technical_occupations',
    'administrative_and_secretarial_occupations',
    'skilled_trades_occupations',
    'caring_leisure_and_other_service_occupations',
    'sales_and_customer_service_occupations',
    'process_plant_and_machine_operatives',
    'elementary_occupations',
  ],
  qualifications: [
    'no_qualifications',
    'level_1_qualifications',
    'level_2_qualifications',
    'apprenticeship',
    'level_3_qualifications',
    'level_4_qualifications_and_above',
    'other_qualifications',
  ],
  ethnicity: [
    'asian_asian_british_or_asian_welsh',
    'black_black_british_black_welsh_caribbean_or_african',
    'mixed_or_multiple_ethnic_groups',
    'white',
    'other_ethnic_group',
  ],
  general_health: [
    'very_good_health',
    'good_health',
    'fair_health',
    'bad_health',
    'very_bad_health',
  ],
  religion: [
    'no_religion',
    'christian',
    'buddhist',
    'hindu',
    'jewish',
    'muslim',
    'sikh',
    'other_religion',
  ],
  tenure: [
    'owned',
    'shared_ownership',
    'social_rented',
    'private_rented',
    'lives_rent_free',
    'owns_with_mortgage_or_loan_or_shared_ownership',
    'private_rented_or_lives_rent_free',
  ],
};

/**
 * Check if a component_id matches a category
 */
function matchesCategory(componentId: string, category: string | string[]): boolean {
  if (typeof category === 'string') {
    return componentId.startsWith(category);
  }
  return category.includes(componentId);
}

/**
 * Clean up component_id to create a friendly label
 */
function cleanLabel(componentId: string, prefix?: string): string {
  let label = componentId;

  // Remove prefix if provided
  if (prefix && typeof prefix === 'string' && label.startsWith(prefix)) {
    label = label.substring(prefix.length);
  }

  // Convert underscores to spaces and capitalize
  label = label
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return label;
}

/**
 * Fetch aggregated census metrics for selected LSOA codes from Supabase
 * Uses server-side aggregation via RPC function for better performance
 */
export async function getAggregatedLSOAMetrics(
  geographyCodes: string[]
): Promise<AggregatedMetric[]> {
  console.log(`[Supabase] Fetching aggregated metrics for ${geographyCodes.length} LSOAs`);

  const { data, error } = await supabase.rpc('get_lsoa_metrics_agg', {
    selected_geo_codes: geographyCodes,
  });

  if (error) {
    console.error('[Supabase] Error fetching aggregated metrics:', error);
    throw new Error(`Failed to fetch aggregated LSOA metrics: ${error.message}`);
  }

  console.log(`[Supabase] Fetched ${data?.length || 0} aggregated metrics`);

  return (data as AggregatedMetric[]) || [];
}

/**
 * Convert aggregated metrics into the LSOAData structure for backward compatibility
 */
export function convertAggregatedToLSOAData(
  aggregatedMetrics: AggregatedMetric[]
): LSOAData {
  const lsoaData: LSOAData = {
    lsoa_code: 'aggregated',
    population_total: 0,
    households_total: 0,
    household_composition: {},
    accommodation_type: {},
    tenure: {},
    age_groups: {},
    ethnicity: {},
    country_of_birth: {},
    religion: {},
    economic_activity: {},
    occupation: {},
    qualifications: {},
    travel_to_work: {},
    distance_to_work: {},
    general_health: {},
    disability: {},
  };

  aggregatedMetrics.forEach(metric => {
    const componentId = metric.component_id;
    const value = metric.selected_total ?? 0;

    // Special cases for totals
    if (componentId === 'population_total') {
      lsoaData.population_total = value;
      return;
    }

    if (componentId === 'hhc_total_all_households') {
      lsoaData.households_total = value;
      return;
    }

    if (componentId === 'disabled_rate') {
      // For rate metrics, store as counts so the UI can calculate percentages properly
      // The UI expects counts that add up to a total, not pre-calculated percentages
      const disabledCount = metric.selected_total ?? 0;
      const totalPopulation = metric.selected_denominator ?? 0;
      const notDisabledCount = totalPopulation - disabledCount;

      // Store both disabled and not disabled counts so they add up to 100%
      lsoaData.disability['Disabled'] = disabledCount;
      lsoaData.disability['Not disabled'] = notDisabledCount;
      return;
    }

    // Categorize by prefix/list matching
    if (matchesCategory(componentId, COMPONENT_PREFIXES.household_composition)) {
      const label = cleanLabel(componentId, COMPONENT_PREFIXES.household_composition);
      lsoaData.household_composition[label] = value;
    } else if (matchesCategory(componentId, COMPONENT_PREFIXES.accommodation_type)) {
      const label = cleanLabel(componentId, COMPONENT_PREFIXES.accommodation_type);
      lsoaData.accommodation_type[label] = value;
    } else if (matchesCategory(componentId, COMPONENT_PREFIXES.age_groups)) {
      const label = cleanLabel(componentId, COMPONENT_PREFIXES.age_groups);
      lsoaData.age_groups[label] = value;
    } else if (matchesCategory(componentId, COMPONENT_PREFIXES.country_of_birth)) {
      const label = cleanLabel(componentId, COMPONENT_PREFIXES.country_of_birth);
      lsoaData.country_of_birth[label] = value;
    } else if (matchesCategory(componentId, COMPONENT_PREFIXES.distance_to_work)) {
      const label = cleanLabel(componentId, COMPONENT_PREFIXES.distance_to_work);
      lsoaData.distance_to_work[label] = value;
    } else if (matchesCategory(componentId, COMPONENT_PREFIXES.economic_activity)) {
      const label = cleanLabel(componentId, COMPONENT_PREFIXES.economic_activity);
      lsoaData.economic_activity[label] = value;
    } else if (matchesCategory(componentId, COMPONENT_PREFIXES.travel_to_work)) {
      const label = cleanLabel(componentId);
      lsoaData.travel_to_work[label] = value;
    } else if (matchesCategory(componentId, COMPONENT_PREFIXES.occupation)) {
      const label = cleanLabel(componentId);
      lsoaData.occupation[label] = value;
    } else if (matchesCategory(componentId, COMPONENT_PREFIXES.qualifications)) {
      const label = cleanLabel(componentId);
      lsoaData.qualifications[label] = value;
    } else if (matchesCategory(componentId, COMPONENT_PREFIXES.ethnicity)) {
      const label = cleanLabel(componentId);
      lsoaData.ethnicity[label] = value;
    } else if (matchesCategory(componentId, COMPONENT_PREFIXES.general_health)) {
      const label = cleanLabel(componentId);
      lsoaData.general_health[label] = value;
    } else if (matchesCategory(componentId, COMPONENT_PREFIXES.religion)) {
      const label = cleanLabel(componentId);
      lsoaData.religion[label] = value;
    } else if (matchesCategory(componentId, COMPONENT_PREFIXES.tenure)) {
      const label = cleanLabel(componentId);
      lsoaData.tenure[label] = value;
    }
  });

  return lsoaData;
}

/**
 * Fetch aggregated affluence scores for selected LSOA codes from Supabase
 * Uses server-side aggregation via RPC function for better performance
 */
export async function getAggregatedAffluence(
  geographyCodes: string[]
): Promise<AffluenceData | null> {
  console.log(`[Supabase] Fetching aggregated affluence for ${geographyCodes.length} LSOAs`);

  const { data, error } = await supabase.rpc('get_lsoa_affluence_agg', {
    selected_geo_codes: geographyCodes,
  });

  if (error) {
    console.error('[Supabase] Error fetching aggregated affluence:', error);
    throw new Error(`Failed to fetch aggregated affluence: ${error.message}`);
  }

  if (!data || data.length === 0) {
    console.warn('[Supabase] No affluence data found for selected LSOAs');
    return null;
  }

  const affluenceData = data[0] as AffluenceData;
  console.log(`[Supabase] Affluence: Category ${affluenceData.calculated_category}, Score: ${affluenceData.avg_raw_score}, Count: ${affluenceData.lsoa_count}`);

  return affluenceData;
}
