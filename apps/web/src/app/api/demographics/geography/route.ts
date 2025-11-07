import { NextRequest, NextResponse } from 'next/server';
import { getLSOACodesInRadiusWithPolygons } from '@/lib/lsoa-boundaries';
import { calculateCircleArea } from '@/lib/geography-utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/demographics/geography
 * Resolves geographic area codes within a radius of a location
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lat, lng, radius_miles } = body;

    // Validation
    if (typeof lat !== 'number' || typeof lng !== 'number' || typeof radius_miles !== 'number') {
      return NextResponse.json(
        { error: 'Invalid input: lat, lng, and radius_miles must be numbers' },
        { status: 400 }
      );
    }

    if (lat < 49 || lat > 61 || lng < -8 || lng > 2) {
      return NextResponse.json(
        { error: 'Location must be within UK bounds' },
        { status: 400 }
      );
    }

    if (radius_miles < 1 || radius_miles > 50) {
      return NextResponse.json(
        { error: 'Radius must be between 1 and 50 miles' },
        { status: 400 }
      );
    }

    console.log(`Resolving geography for lat=${lat}, lng=${lng}, radius=${radius_miles}mi`);

    // Get LSOA codes using polygon intersection (includes LSOAs partially in radius)
    const codes = getLSOACodesInRadiusWithPolygons(lat, lng, radius_miles);
    const areaType = 'LSOA';

    if (codes.length === 0) {
      return NextResponse.json(
        { error: 'No geographic areas found for this location' },
        { status: 404 }
      );
    }

    console.log(`Found ${codes.length} ${areaType} areas`);

    // Calculate approximate area covered
    const area_sq_km = calculateCircleArea(radius_miles);

    return NextResponse.json({
      geography_codes: codes,
      area_type: areaType,
      total_areas: codes.length,
      coverage_info: {
        center: { lat, lng },
        radius_miles,
        approximate_area_sq_km: Math.round(area_sq_km * 10) / 10,
      },
    });
  } catch (error) {
    console.error('Error in geography API:', error);

    return NextResponse.json(
      {
        error: 'Failed to resolve geographic areas',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
