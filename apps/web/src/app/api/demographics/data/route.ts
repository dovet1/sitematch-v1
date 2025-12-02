import { NextRequest, NextResponse } from 'next/server';
import {
  getAggregatedLSOAMetrics,
  convertAggregatedToLSOAData,
  extractNationalAverages,
  getAggregatedAffluence
} from '@/lib/supabase-census-data';

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

    // Fetch both census metrics and affluence data in parallel
    const [aggregatedMetrics, affluenceData] = await Promise.all([
      getAggregatedLSOAMetrics(geography_codes),
      getAggregatedAffluence(geography_codes),
    ]);

    // Convert to single aggregated LSOAData structure for backward compatibility
    const aggregatedData = convertAggregatedToLSOAData(aggregatedMetrics);

    // Extract national averages from aggregated metrics
    const nationalAverages = extractNationalAverages(aggregatedMetrics);

    // Add affluence data if available
    if (affluenceData) {
      aggregatedData.affluence = affluenceData;
    }

    // Return as single "aggregated" LSOA for frontend with national averages
    const response = {
      by_lsoa: {
        aggregated: aggregatedData,
      },
      national_averages: nationalAverages,
    };

    console.log(`Successfully loaded ${aggregatedMetrics.length} aggregated metrics${affluenceData ? ' and affluence data' : ''} for ${geography_codes.length} LSOAs`);
    console.log(`Extracted ${Object.keys(nationalAverages).length} national averages`);

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
