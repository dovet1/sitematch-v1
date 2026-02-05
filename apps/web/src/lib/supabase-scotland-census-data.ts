/**
 * Census 2022 Data from Supabase (Scotland)
 * Fetches demographic metrics from the data_zone_metrics table
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

interface DataZoneMetric {
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
  dz_count: number;
}

export interface DataZoneTooltipData {
  geo_code: string;
  geo_name: string;
  population: number;
  affluence_score: number | null;
}

/**
 * Fetch aggregated census metrics for selected Data Zone codes from Supabase
 * Uses server-side aggregation via RPC function for better performance
 */
export async function getAggregatedDataZoneMetrics(
  geographyCodes: string[]
): Promise<AggregatedMetric[]> {
  console.log(`[Supabase] Fetching aggregated metrics for ${geographyCodes.length} Data Zones`);

  const { data, error } = await supabase.rpc('get_data_zone_metrics_agg', {
    selected_geo_codes: geographyCodes,
  });

  if (error) {
    console.error('[Supabase] Error fetching aggregated metrics:', error);
    throw new Error(`Failed to fetch aggregated Data Zone metrics: ${error.message}`);
  }

  console.log(`[Supabase] Fetched ${data?.length || 0} aggregated metrics`);

  return (data as AggregatedMetric[]) || [];
}

/**
 * Extract national averages from aggregated metrics
 * Returns a map of component_id -> national_avg_pct
 */
export function extractNationalAverages(
  aggregatedMetrics: AggregatedMetric[]
): Record<string, number> {
  const nationalAverages: Record<string, number> = {};

  aggregatedMetrics.forEach(metric => {
    if (metric.national_avg_pct !== null && metric.national_avg_pct !== undefined) {
      nationalAverages[metric.component_id] = metric.national_avg_pct;
    }
  });

  return nationalAverages;
}

/**
 * Convert aggregated metrics into the DataZoneData structure
 * Maps Scottish census categories to display format
 */
export function convertAggregatedToDataZoneData(
  aggregatedMetrics: AggregatedMetric[]
): any {
  const dataZoneData: any = {
    dz_code: 'aggregated',
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
      dataZoneData.population_total = value;
      return;
    }

    if (componentId === 'hhc_total_all_households') {
      dataZoneData.households_total = value;
      return;
    }

    if (componentId === 'disabled_rate') {
      const disabledCount = metric.selected_total ?? 0;
      const totalPopulation = metric.selected_denominator ?? 0;
      const notDisabledCount = totalPopulation - disabledCount;

      dataZoneData.disability['Disabled'] = disabledCount;
      dataZoneData.disability['Not disabled'] = notDisabledCount;
      return;
    }

    // Categorize by matching component_id patterns
    // These will need to be adjusted once Scottish census data is imported
    // to match the actual component_id naming conventions from Scotland Census 2022
    if (componentId.startsWith('hhc_')) {
      const label = cleanLabel(componentId, 'hhc_');
      dataZoneData.household_composition[label] = value;
    } else if (componentId.startsWith('accom_')) {
      const label = cleanLabel(componentId, 'accom_');
      dataZoneData.accommodation_type[label] = value;
    } else if (componentId.startsWith('age_')) {
      const label = cleanLabel(componentId, 'age_');
      dataZoneData.age_groups[label] = value;
    } else if (componentId.startsWith('cob_')) {
      const label = cleanLabel(componentId, 'cob_');
      dataZoneData.country_of_birth[label] = value;
    } else if (componentId.startsWith('ts058_')) {
      const label = cleanLabel(componentId, 'ts058_');
      dataZoneData.distance_to_work[label] = value;
    } else if (componentId.startsWith('economically_')) {
      const label = cleanLabel(componentId, 'economically_');
      dataZoneData.economic_activity[label] = value;
    } else {
      // Handle array-based categories
      const travelToWorkIds = [
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
      ];

      const occupationIds = [
        'managers_directors_and_senior_officials',
        'professional_occupations',
        'associate_professional_and_technical_occupations',
        'administrative_and_secretarial_occupations',
        'skilled_trades_occupations',
        'caring_leisure_and_other_service_occupations',
        'sales_and_customer_service_occupations',
        'process_plant_and_machine_operatives',
        'elementary_occupations',
      ];

      const qualificationIds = [
        'no_qualifications',
        'level_1_qualifications',
        'level_2_qualifications',
        'apprenticeship',
        'level_3_qualifications',
        'level_4_qualifications_and_above',
        'other_qualifications',
      ];

      const ethnicityIds = [
        'asian_asian_british_or_asian_welsh',
        'black_black_british_black_welsh_caribbean_or_african',
        'mixed_or_multiple_ethnic_groups',
        'white',
        'other_ethnic_group',
      ];

      const healthIds = [
        'very_good_health',
        'good_health',
        'fair_health',
        'bad_health',
        'very_bad_health',
      ];

      const religionIds = [
        'no_religion',
        'christian',
        'buddhist',
        'hindu',
        'jewish',
        'muslim',
        'sikh',
        'other_religion',
      ];

      const tenureIds = [
        'owned',
        'shared_ownership',
        'social_rented',
        'private_rented',
        'lives_rent_free',
        'owns_with_mortgage_or_loan_or_shared_ownership',
        'private_rented_or_lives_rent_free',
      ];

      if (travelToWorkIds.includes(componentId)) {
        const label = cleanLabel(componentId);
        dataZoneData.travel_to_work[label] = value;
      } else if (occupationIds.includes(componentId)) {
        const label = cleanLabel(componentId);
        dataZoneData.occupation[label] = value;
      } else if (qualificationIds.includes(componentId)) {
        const label = cleanLabel(componentId);
        dataZoneData.qualifications[label] = value;
      } else if (ethnicityIds.includes(componentId)) {
        const label = cleanLabel(componentId);
        dataZoneData.ethnicity[label] = value;
      } else if (healthIds.includes(componentId)) {
        const label = cleanLabel(componentId);
        dataZoneData.general_health[label] = value;
      } else if (religionIds.includes(componentId)) {
        const label = cleanLabel(componentId);
        dataZoneData.religion[label] = value;
      } else if (tenureIds.includes(componentId)) {
        const label = cleanLabel(componentId);
        dataZoneData.tenure[label] = value;
      }
    }
  });

  return dataZoneData;
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

  // For age groups, format as "X to Y" (e.g., "5 9" -> "5 to 9")
  if (prefix === 'age_') {
    // Match patterns like "5 9", "10 14", "80 84"
    label = label.replace(/^(\d+)\s+(\d+)$/, '$1 to $2');
    // Handle "85 And Over" -> "85+"
    label = label.replace(/^(\d+)\s+And\s+Over$/i, '$1+');
  }

  return label;
}

/**
 * Fetch aggregated affluence scores for selected Data Zone codes from Supabase
 * Uses server-side aggregation via RPC function for better performance
 */
export async function getAggregatedAffluence(
  geographyCodes: string[]
): Promise<AffluenceData | null> {
  console.log(`[Supabase] Fetching aggregated affluence for ${geographyCodes.length} Data Zones`);

  const { data, error } = await supabase.rpc('get_data_zone_affluence_agg', {
    selected_geo_codes: geographyCodes,
  });

  if (error) {
    console.error('[Supabase] Error fetching aggregated affluence:', error);
    throw new Error(`Failed to fetch aggregated affluence: ${error.message}`);
  }

  if (!data || data.length === 0) {
    console.warn('[Supabase] No affluence data found for selected Data Zones');
    return null;
  }

  const affluenceData = data[0] as AffluenceData;
  console.log(`[Supabase] Affluence: Score: ${affluenceData.avg_raw_score}, Count: ${affluenceData.dz_count}`);

  return affluenceData;
}

/**
 * Fetch per-Data Zone tooltip data (name, population, affluence) for map hovers
 */
export async function getDataZoneTooltipData(
  geographyCodes: string[]
): Promise<Record<string, DataZoneTooltipData>> {
  console.log(`[Supabase] Fetching tooltip data for ${geographyCodes.length} Data Zones`);

  // Fetch population data
  const { data: populationData, error: popError } = await supabase
    .from('data_zone_metrics')
    .select('geo_code, geo_name, numerator')
    .in('geo_code', geographyCodes)
    .eq('component_id', 'population_total')
    .eq('edition', '2022');

  if (popError) {
    console.error('[Supabase] Error fetching population data:', popError);
    throw new Error(`Failed to fetch population data: ${popError.message}`);
  }

  // Fetch affluence data
  const { data: affluenceData, error: affError } = await supabase
    .from('data_zone_affluence_scores')
    .select('geo_code, geo_name, affluence_score_with_income')
    .in('geo_code', geographyCodes);

  if (affError) {
    console.error('[Supabase] Error fetching affluence data:', affError);
    // Don't throw - affluence is optional
  }

  // Combine into tooltip data structure
  const tooltipData: Record<string, DataZoneTooltipData> = {};

  // Add population data
  populationData?.forEach((row: any) => {
    tooltipData[row.geo_code] = {
      geo_code: row.geo_code,
      geo_name: row.geo_name || row.geo_code,
      population: row.numerator || 0,
      affluence_score: null,
    };
  });

  // Add affluence data
  affluenceData?.forEach((row: any) => {
    if (tooltipData[row.geo_code]) {
      tooltipData[row.geo_code].affluence_score = row.affluence_score_with_income;
    }
  });

  console.log(`[Supabase] Fetched tooltip data for ${Object.keys(tooltipData).length} Data Zones`);

  return tooltipData;
}
