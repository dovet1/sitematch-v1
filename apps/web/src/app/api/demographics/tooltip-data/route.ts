import { NextRequest, NextResponse } from 'next/server';
import { getLSOATooltipData } from '@/lib/supabase-census-data';
import { getDataZoneTooltipData } from '@/lib/supabase-scotland-census-data';

export const dynamic = 'force-dynamic';

/**
 * POST /api/demographics/tooltip-data
 * Fetches per-LSOA and per-Data Zone tooltip data (name, population, affluence) for map hovers
 * Supports both England/Wales (LSOAs) and Scotland (Data Zones)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lsoa_codes, data_zone_codes } = body;

    // Validation - at least one array must be provided
    const hasLSOAs = Array.isArray(lsoa_codes) && lsoa_codes.length > 0;
    const hasDataZones = Array.isArray(data_zone_codes) && data_zone_codes.length > 0;

    if (!hasLSOAs && !hasDataZones) {
      return NextResponse.json(
        { error: 'Invalid input: lsoa_codes or data_zone_codes must be a non-empty array' },
        { status: 400 }
      );
    }

    let lsoaTooltipData = {};
    let dzTooltipData = {};

    // Fetch LSOA tooltip data
    if (hasLSOAs) {
      console.log(`Fetching tooltip data for ${lsoa_codes.length} LSOAs`);
      lsoaTooltipData = await getLSOATooltipData(lsoa_codes);
      console.log(`Successfully loaded tooltip data for ${Object.keys(lsoaTooltipData).length} LSOAs`);
    }

    // Fetch Data Zone tooltip data
    if (hasDataZones) {
      console.log(`Fetching tooltip data for ${data_zone_codes.length} Data Zones`);
      dzTooltipData = await getDataZoneTooltipData(data_zone_codes);
      console.log(`Successfully loaded tooltip data for ${Object.keys(dzTooltipData).length} Data Zones`);
    }

    return NextResponse.json({
      lsoa_tooltip_data: lsoaTooltipData,
      dz_tooltip_data: dzTooltipData,
    });
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
