import { NextRequest, NextResponse } from 'next/server';
import {
  getBUABoundaryGeometry,
  getLSOACodesForBUA,
} from '@/lib/lsoa-boundaries-postgis';

export const dynamic = 'force-dynamic';

/**
 * POST /api/demographics/bua-boundaries
 * Returns LSOA codes and boundary geometry for a built-up area.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { gsscode } = body;

    if (typeof gsscode !== 'string' || gsscode.trim().length === 0) {
      return NextResponse.json(
        {
          error: 'Invalid input: gsscode must be a non-empty string',
          error_type: 'validation',
        },
        { status: 400 }
      );
    }

    const trimmedGsscode = gsscode.trim();
    const [lsoaCodes, boundaryGeometry] = await Promise.all([
      getLSOACodesForBUA(trimmedGsscode),
      getBUABoundaryGeometry(trimmedGsscode),
    ]);

    if (!boundaryGeometry) {
      return NextResponse.json(
        {
          error: 'BUA_NOT_FOUND',
          error_type: 'not_found',
          details: `No built-up area boundary found for ${trimmedGsscode}`,
        },
        { status: 404 }
      );
    }

    if (lsoaCodes.length === 0) {
      return NextResponse.json(
        {
          error: 'BUA_LSOA_COVERAGE_UNAVAILABLE',
          error_type: 'coverage',
          details: `No LSOAs intersect built-up area ${trimmedGsscode}`,
          lsoa_codes: [],
          boundary_geometry: boundaryGeometry,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      lsoa_codes: lsoaCodes,
      boundary_geometry: boundaryGeometry,
    });
  } catch (error) {
    console.error('Error in BUA boundaries API:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch BUA LSOA codes',
        error_type: 'server',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
