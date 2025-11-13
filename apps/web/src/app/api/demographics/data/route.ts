import { NextRequest, NextResponse } from 'next/server';
import { getAggregatedLSOAMetrics, convertAggregatedToLSOAData } from '@/lib/supabase-census-data';

export const dynamic = 'force-dynamic';

/**
 * POST /api/demographics/data
 * Fetches aggregated demographics data for given geographic areas from Supabase
 * Uses server-side aggregation for better performance and smaller payload
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

    console.log(`Fetching aggregated demographics for ${geography_codes.length} LSOAs from Supabase`);

    // Fetch aggregated data from Supabase using RPC function
    const aggregatedMetrics = await getAggregatedLSOAMetrics(geography_codes);

    // Convert to single aggregated LSOAData structure for backward compatibility
    const aggregatedData = convertAggregatedToLSOAData(aggregatedMetrics);

    // Return as single "aggregated" LSOA for frontend
    const response = {
      by_lsoa: {
        aggregated: aggregatedData,
      },
    };

    console.log(`Successfully loaded ${aggregatedMetrics.length} aggregated metrics for ${geography_codes.length} LSOAs`);

    return NextResponse.json(response);
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
