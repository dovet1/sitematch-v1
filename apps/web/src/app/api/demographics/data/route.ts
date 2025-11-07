import { NextRequest, NextResponse } from 'next/server';
import {
  getPopulationFromCSV,
  getAgeProfileFromCSV,
  getHouseholdDataFromCSV,
  getCountryOfBirthFromCSV,
  getDeprivationDataFromCSV,
} from '@/lib/census-data';
import type { DemographicsResult } from '@/lib/types/demographics';

export const dynamic = 'force-dynamic';

/**
 * POST /api/demographics/data
 * Fetches and aggregates demographics data for given geographic areas
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { geography_codes } = body;

    // Validation
    if (!Array.isArray(geography_codes) || geography_codes.length === 0) {
      return NextResponse.json(
        { error: 'Invalid input: geography_codes must be a non-empty array' },
        { status: 400 }
      );
    }

    console.log(`Fetching demographics for ${geography_codes.length} areas from Census CSV data`);

    // Fetch demographic data from local CSV files
    const populationData = getPopulationFromCSV(geography_codes);
    const householdData = getHouseholdDataFromCSV(geography_codes);
    const ageProfileData = getAgeProfileFromCSV(geography_codes, populationData.total);
    const countryOfBirthData = getCountryOfBirthFromCSV(geography_codes);
    const deprivationData = getDeprivationDataFromCSV(geography_codes);

    // Construct the response
    const result: DemographicsResult = {
      query_info: {
        geography_codes,
        total_population: populationData.total,
        area_covered_sq_km: 0, // Will be calculated based on actual areas
      },
      population: {
        total: populationData.total,
        male: populationData.male,
        male_percentage: populationData.male_percentage,
        female: populationData.female,
        female_percentage: populationData.female_percentage,
      },
      households: {
        total: householdData.total,
        average_size: householdData.average_size,
      },
      age_profile: ageProfileData,
      country_of_birth: countryOfBirthData,
      household_size: householdData.size_distribution,
      household_composition: householdData.composition,
      household_deprivation: deprivationData,
    };

    console.log(`Successfully aggregated demographics for ${result.population.total} people`);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in demographics data API:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch demographics data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
