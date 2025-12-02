import { NextRequest, NextResponse } from 'next/server';
import { getLSOATooltipData } from '@/lib/supabase-census-data';

export const dynamic = 'force-dynamic';

/**
 * POST /api/demographics/tooltip-data
 * Fetches per-LSOA tooltip data (name, population, affluence) for map hovers
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

    console.log(`Fetching tooltip data for ${geography_codes.length} LSOAs`);

    const tooltipData = await getLSOATooltipData(geography_codes);

    console.log(`Successfully loaded tooltip data for ${Object.keys(tooltipData).length} LSOAs`);

    return NextResponse.json({ tooltip_data: tooltipData });
  } catch (error) {
    console.error('Error in tooltip data API:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch tooltip data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
