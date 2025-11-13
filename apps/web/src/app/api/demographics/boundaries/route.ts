import { NextRequest, NextResponse } from 'next/server';
import { getLSOAPolygonsInRadius, getLSOAPolygonsInIsochrone } from '@/lib/lsoa-boundaries';
import { fetchIsochrone, getModeProfile } from '@/lib/mapbox-isochrone';

export const dynamic = 'force-dynamic';

type MeasurementMode = 'distance' | 'drive_time' | 'walk_time';

/**
 * POST /api/demographics/boundaries
 * Returns LSOA polygon boundaries for a given location and radius/isochrone
 * Used for map visualization
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lat, lng, radius_miles, measurement_mode = 'distance' } = body;

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

    console.log(`Fetching LSOA boundaries for lat=${lat}, lng=${lng}, measurement=${measurement_mode}, value=${radius_miles}`);

    let geoJSON: any;
    let isochroneGeometry: any = null;

    // Use isochrone for time-based measurements, circular radius for distance
    if (measurement_mode === 'drive_time' || measurement_mode === 'walk_time') {
      console.log(`[Boundaries API] Fetching ${measurement_mode} isochrone...`);

      const profile = getModeProfile(measurement_mode);
      const isochroneResult = await fetchIsochrone(lat, lng, radius_miles, profile);

      isochroneGeometry = isochroneResult.geometry;
      geoJSON = getLSOAPolygonsInIsochrone(isochroneResult.geometry.coordinates);

      console.log(`[Boundaries API] Isochrone returned ${geoJSON.features.length} LSOA polygons`);
    } else {
      // Distance mode - use circular radius
      geoJSON = getLSOAPolygonsInRadius(lat, lng, radius_miles);
      console.log(`[Boundaries API] Circular radius returned ${geoJSON.features.length} LSOA polygons`);
    }

    console.log(`Returning ${geoJSON.features.length} LSOA polygons`);
    console.log(`[Boundaries API] Returning isochrone geometry:`, isochroneGeometry ? 'YES' : 'NO');
    if (isochroneGeometry) {
      console.log(`[Boundaries API] Isochrone type: ${isochroneGeometry.type}, coords length: ${isochroneGeometry.coordinates?.[0]?.length}`);
    }

    return NextResponse.json({
      lsoa_polygons: geoJSON,
      isochrone_geometry: isochroneGeometry,
    });
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
