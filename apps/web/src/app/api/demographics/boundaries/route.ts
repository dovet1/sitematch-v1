import { NextRequest, NextResponse } from 'next/server';
import { getLSOAPolygonsInRadius } from '@/lib/lsoa-boundaries';

export const dynamic = 'force-dynamic';

/**
 * POST /api/demographics/boundaries
 * Returns LSOA polygon boundaries for a given location and radius
 * Used for map visualization
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

    console.log(`Fetching LSOA boundaries for lat=${lat}, lng=${lng}, radius=${radius_miles}mi`);

    // Get LSOA polygons that intersect with the radius
    const geoJSON = getLSOAPolygonsInRadius(lat, lng, radius_miles);

    console.log(`Returning ${geoJSON.features.length} LSOA polygons`);

    return NextResponse.json(geoJSON);
  } catch (error) {
    console.error('Error in boundaries API:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch LSOA boundaries',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
