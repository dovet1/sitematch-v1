import { NextRequest, NextResponse } from 'next/server';
import { getAreaCodesInRadius, getAreaCodesInPolygon } from '@/lib/geographic-boundaries';
import { fetchIsochrone, getModeProfile } from '@/lib/mapbox-isochrone';
import { determineCoverageStatus } from '@/lib/coverage-utils';

export const dynamic = 'force-dynamic';

type MeasurementMode = 'distance' | 'drive_time' | 'walk_time';

/**
 * POST /api/demographics/boundaries
 * Returns LSOA codes, Data Zone codes, and optional isochrone geometry for a given location and radius/isochrone
 * Note: Map visualization uses Mapbox vector tilesets for both LSOAs and Data Zones
 * This endpoint returns lists of codes for demographic data fetching from both regions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lat, lng, radius_miles, measurement_mode = 'distance', place_name } = body;

    // Validation
    if (typeof lat !== 'number' || typeof lng !== 'number' || typeof radius_miles !== 'number') {
      return NextResponse.json(
        { error: 'Invalid input: lat, lng, and radius_miles must be numbers', error_type: 'validation' },
        { status: 400 }
      );
    }

    if (lat < 49 || lat > 61 || lng < -8 || lng > 2) {
      return NextResponse.json(
        { error: 'Location must be within UK bounds', error_type: 'validation' },
        { status: 400 }
      );
    }

    if (radius_miles < 1 || radius_miles > 50) {
      return NextResponse.json(
        { error: 'Radius must be between 1 and 50 miles', error_type: 'validation' },
        { status: 400 }
      );
    }

    console.log(`Fetching area codes for lat=${lat}, lng=${lng}, measurement=${measurement_mode}, value=${radius_miles}`);

    let result: { lsoa_codes: string[]; data_zone_codes: string[]; is_mixed: boolean };
    let isochroneGeometry: any = null;

    // Use isochrone for time-based measurements, circular radius for distance
    if (measurement_mode === 'drive_time' || measurement_mode === 'walk_time') {
      console.log(`[Boundaries API] Fetching ${measurement_mode} isochrone...`);

      const profile = getModeProfile(measurement_mode);
      const isochroneResult = await fetchIsochrone(lat, lng, radius_miles, profile);

      isochroneGeometry = isochroneResult.geometry;

      // Convert isochrone coordinates to WKT format
      const rings = isochroneResult.geometry.coordinates.map((ring: number[][]) =>
        `(${ring.map(coord => `${coord[0]} ${coord[1]}`).join(', ')})`
      ).join(', ');
      const polygonWKT = `POLYGON(${rings})`;

      result = await getAreaCodesInPolygon(polygonWKT);

      console.log(`[Boundaries API] Isochrone returned ${result.lsoa_codes.length} LSOAs, ${result.data_zone_codes.length} Data Zones`);
    } else {
      // Distance mode - use circular radius
      result = await getAreaCodesInRadius(lat, lng, radius_miles);
      console.log(`[Boundaries API] Circular radius returned ${result.lsoa_codes.length} LSOAs, ${result.data_zone_codes.length} Data Zones`);
    }

    console.log(`Returning ${result.lsoa_codes.length} LSOAs, ${result.data_zone_codes.length} Data Zones`);
    console.log(`[Boundaries API] Returning isochrone geometry:`, isochroneGeometry ? 'YES' : 'NO');
    if (isochroneGeometry) {
      console.log(`[Boundaries API] Isochrone type: ${isochroneGeometry.type}, coords length: ${isochroneGeometry.coordinates?.[0]?.length}`);
    }

    // Determine coverage status
    const coverageStatus = determineCoverageStatus(
      result.lsoa_codes,
      result.data_zone_codes,
      {
        lat,
        lng,
        place_name: place_name || 'Selected location',
      }
    );

    // Return coverage error if outside England, Wales, and Scotland
    if (!coverageStatus.isFullyCovered) {
      console.log(`[Boundaries API] Coverage unavailable:`, coverageStatus);
      return NextResponse.json(
        {
          error: 'COVERAGE_UNAVAILABLE',
          error_type: 'coverage',
          coverage_status: coverageStatus,
          lsoa_codes: result.lsoa_codes,
          data_zone_codes: result.data_zone_codes,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      lsoa_codes: result.lsoa_codes,
      data_zone_codes: result.data_zone_codes,
      is_mixed: result.is_mixed,
      isochrone_geometry: isochroneGeometry,
      coverage_status: coverageStatus,
    });
  } catch (error) {
    console.error('Error in boundaries API:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch area codes',
        error_type: 'server',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
