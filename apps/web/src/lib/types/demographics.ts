export interface DemographicsQuery {
  location: {
    lat: number;
    lng: number;
    place_name: string;
  };
  radius_miles: number;
}

export interface PopulationData {
  total: number;
  male: number;
  male_percentage: number;
  female: number;
  female_percentage: number;
}

export interface HouseholdData {
  total: number;
  average_size: number;
}

export interface AgeGroup {
  age_group: string;
  count: number;
  percentage: number;
}

export interface CountryData {
  country: string;
  count: number;
  percentage: number;
}

export interface HouseholdSizeData {
  size: string;
  count: number;
  percentage: number;
}

export interface HouseholdCompositionData {
  type: string;
  count: number;
  percentage: number;
}

export interface DeprivationData {
  employment: { deprived_count: number; percentage: number };
  education: { deprived_count: number; percentage: number };
  health: { deprived_count: number; percentage: number };
  housing: { deprived_count: number; percentage: number };
}

export interface DemographicsResult {
  query_info: {
    geography_codes: string[];
    total_population: number;
    area_covered_sq_km: number;
  };
  population: PopulationData;
  households: HouseholdData;
  age_profile: AgeGroup[];
  country_of_birth: CountryData[];
  household_size: HouseholdSizeData[];
  household_composition: HouseholdCompositionData[];
  household_deprivation: DeprivationData;
}
