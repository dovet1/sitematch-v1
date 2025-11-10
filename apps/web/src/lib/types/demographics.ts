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

// Per-LSOA raw data for client-side aggregation
export interface LSOADemographics {
  lsoa_code: string;
  population: {
    total: number;
    male: number;
    female: number;
  };
  households: {
    total: number;
  };
  age_groups: Record<string, number>; // age_group -> count
  country_of_birth: Record<string, number>; // country -> count
  household_sizes: Record<string, number>; // size -> count
  household_composition: Record<string, number>; // type -> count
  household_deprivation: {
    employment_deprived: number;
    education_deprived: number;
    health_deprived: number;
    housing_deprived: number;
  };
}

export interface DemographicsAPIResponse {
  aggregated: DemographicsResult;
  by_lsoa: Record<string, LSOADemographics>;
}
