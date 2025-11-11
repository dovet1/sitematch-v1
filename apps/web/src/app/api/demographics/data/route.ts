import { NextRequest, NextResponse } from 'next/server';
import { getPerLSOADataFromCSV } from '@/lib/census-data';

export const dynamic = 'force-dynamic';

/**
 * POST /api/demographics/data
 * Fetches per-LSOA demographics data for given geographic areas
 * Returns raw census data for each LSOA
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

    console.log(`Fetching demographics for ${geography_codes.length} LSOAs from Census CSV data`);

    // Fetch per-LSOA data from local CSV files
    const perLsoaData = getPerLSOADataFromCSV(geography_codes);

    console.log(`Successfully loaded demographics for ${geography_codes.length} LSOAs`);

    return NextResponse.json({ by_lsoa: perLsoaData });
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
