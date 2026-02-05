import { NextRequest, NextResponse } from 'next/server';
import {
  getAggregatedLSOAMetrics,
  convertAggregatedToLSOAData,
  extractNationalAverages,
  getAggregatedAffluence
} from '@/lib/supabase-census-data';
import {
  getAggregatedDataZoneMetrics,
  convertAggregatedToDataZoneData,
  extractNationalAverages as extractScotlandNationalAverages,
  getAggregatedAffluence as getScotlandAffluence
} from '@/lib/supabase-scotland-census-data';

export const dynamic = 'force-dynamic';

/**
 * POST /api/demographics/data
 * Fetches aggregated demographics data for given geographic areas from Supabase
 * Supports both LSOAs (England/Wales) and Data Zones (Scotland)
 * Uses server-side aggregation for better performance and smaller payload
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

    let englandWalesData = null;
    let scotlandData = null;

    // Fetch England/Wales data
    if (hasLSOAs) {
      console.log(`Fetching aggregated demographics for ${lsoa_codes.length} LSOAs from Supabase`);

      const [aggregatedMetrics, affluenceData] = await Promise.all([
        getAggregatedLSOAMetrics(lsoa_codes),
        getAggregatedAffluence(lsoa_codes),
      ]);

      const aggregatedData = convertAggregatedToLSOAData(aggregatedMetrics);
      const nationalAverages = extractNationalAverages(aggregatedMetrics);

      if (affluenceData) {
        aggregatedData.affluence = affluenceData;
      }

      englandWalesData = {
        demographics: aggregatedData,
        national_averages: nationalAverages,
        area_count: lsoa_codes.length,
        census_year: 2021,
      };

      console.log(`Successfully loaded ${aggregatedMetrics.length} aggregated metrics for ${lsoa_codes.length} LSOAs`);
    }

    // Fetch Scotland data
    if (hasDataZones) {
      console.log(`Fetching aggregated demographics for ${data_zone_codes.length} Data Zones from Supabase`);

      const [aggregatedMetrics, affluenceData] = await Promise.all([
        getAggregatedDataZoneMetrics(data_zone_codes),
        getScotlandAffluence(data_zone_codes),
      ]);

      const aggregatedData = convertAggregatedToDataZoneData(aggregatedMetrics);
      const nationalAverages = extractScotlandNationalAverages(aggregatedMetrics);

      if (affluenceData) {
        aggregatedData.affluence = {
          avg_raw_score: affluenceData.avg_raw_score,
          lsoa_count: affluenceData.dz_count, // Map dz_count to lsoa_count for consistency
        };
      }

      scotlandData = {
        demographics: aggregatedData,
        national_averages: nationalAverages,
        area_count: data_zone_codes.length,
        census_year: 2022,
      };

      console.log(`Successfully loaded ${aggregatedMetrics.length} aggregated metrics for ${data_zone_codes.length} Data Zones`);
    }

    // Return regional data
    const response = {
      england_wales: englandWalesData,
      scotland: scotlandData,
      is_mixed: hasLSOAs && hasDataZones,
    };

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
