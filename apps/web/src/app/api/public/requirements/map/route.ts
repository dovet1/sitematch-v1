import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { checkSubscriptionAccess } from '@/lib/subscription';
import { getRequirementMapFeaturesFromRequirements } from '@/lib/requirement-map-data';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;

    const north = searchParams.get('north') ? Number(searchParams.get('north')) : null;
    const south = searchParams.get('south') ? Number(searchParams.get('south')) : null;
    const east = searchParams.get('east') ? Number(searchParams.get('east')) : null;
    const west = searchParams.get('west') ? Number(searchParams.get('west')) : null;

    const zoom = Number(searchParams.get('zoom')) || 12;

    const companyName = searchParams.get('companyName') || '';
    const sector = searchParams.getAll('sector');
    const useClass = searchParams.getAll('useClass');
    const listingType = searchParams.getAll('listingType');
    const sizeMin = searchParams.get('sizeMin') ? Number(searchParams.get('sizeMin')) : null;
    const sizeMax = searchParams.get('sizeMax') ? Number(searchParams.get('sizeMax')) : null;
    const acreageMin = searchParams.get('minAcreage') ? Number(searchParams.get('minAcreage')) : null;
    const acreageMax = searchParams.get('maxAcreage') ? Number(searchParams.get('maxAcreage')) : null;
    const dwellingMin = searchParams.get('minDwelling') ? Number(searchParams.get('minDwelling')) : null;
    const dwellingMax = searchParams.get('maxDwelling') ? Number(searchParams.get('maxDwelling')) : null;

    const supabase = await createServerClient();

    // Free-tier gating parity with the listings map route.
    const { data: { user } } = await supabase.auth.getUser();
    const hasAccess = user ? await checkSubscriptionAccess(user.id) : false;
    const isFreeTier = !hasAccess;

    const features = await getRequirementMapFeaturesFromRequirements(supabase, {
      isFreeTier,
      filters: {
        companyName,
        sector,
        useClass,
        listingType,
        sizeMin,
        sizeMax,
        acreageMin,
        acreageMax,
        dwellingMin,
        dwellingMax,
      },
    });

    if (features.length === 0) {
      return NextResponse.json({
        geojson: { type: 'FeatureCollection', features: [] },
        total: 0,
        bounds: { north, south, east, west },
        message: 'No active requirements with specific locations found for these filters',
      });
    }

    return NextResponse.json({
      geojson: { type: 'FeatureCollection', features },
      total: features.length,
      bounds: { north, south, east, west },
      metadata: {
        zoom,
        timestamp: new Date().toISOString(),
        debug: { totalFeatures: features.length, isFreeTier },
      },
    });
  } catch (error) {
    console.error('Unexpected error in requirements map API:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to fetch requirement map',
        ...(process.env.NODE_ENV === 'development' && {
          details: error instanceof Error ? error.message : 'Unknown error',
        }),
      },
      { status: 500 }
    );
  }
}
