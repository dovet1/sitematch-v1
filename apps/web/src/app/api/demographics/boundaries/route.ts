import { NextRequest, NextResponse } from 'next/server';
import { getLSOAPolygonsInRadius, getLSOAPolygonsByCodes } from '@/lib/lsoa-boundaries';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * POST /api/demographics/boundaries
 * Returns LSOA polygon boundaries for a given location and radius
 * Also returns adjacent LSOAs (neighbors) for extended map coverage
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

    // Get inner LSOA polygons that intersect with the radius
    const innerGeoJSON = getLSOAPolygonsInRadius(lat, lng, radius_miles);
    const innerCodes = innerGeoJSON.features.map((f) => f.properties.LSOA21CD);

    console.log(`Found ${innerCodes.length} inner LSOAs`);

    // Fetch adjacent LSOAs from Supabase neighbor table
    const supabase = createServerClient();
    const { data: neighbors, error: neighborsError } = await supabase
      .from('lsoa_neighbors')
      .select('neighbor_code')
      .in('lsoa_code', innerCodes);

    if (neighborsError) {
      console.error('Error fetching neighbors:', neighborsError);
      // Return just inner LSOAs if neighbor fetch fails
      return NextResponse.json({
        inner: innerGeoJSON,
        adjacent: { type: 'FeatureCollection', features: [] },
      });
    }

    // Get unique neighbor codes, excluding those already in inner set
    const innerCodeSet = new Set(innerCodes);
    const adjacentCodes = [...new Set(neighbors?.map((n) => n.neighbor_code) || [])]
      .filter((code) => !innerCodeSet.has(code));

    console.log(`Found ${adjacentCodes.length} adjacent LSOAs`);

    // Get polygons for adjacent LSOAs
    const adjacentGeoJSON = getLSOAPolygonsByCodes(adjacentCodes);

    console.log(`Returning ${innerGeoJSON.features.length} inner + ${adjacentGeoJSON.features.length} adjacent LSOA polygons`);

    return NextResponse.json({
      inner: innerGeoJSON,
      adjacent: adjacentGeoJSON,
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
