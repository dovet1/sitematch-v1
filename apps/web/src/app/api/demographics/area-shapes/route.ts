import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// A 50-mile radius around Glasgow is ~3,000 data zones.
const MAX_CODES = 5000;

/**
 * POST /api/demographics/area-shapes
 * GeoJSON outlines for Scottish data zones. The maps draw England and Wales LSOAs from a Mapbox
 * vector tileset that has no Scotland, so they fetch these for the S01 codes in an analysis.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const codes: unknown = body?.codes;

    if (!Array.isArray(codes) || codes.some((c) => typeof c !== 'string')) {
      return NextResponse.json({ error: 'Invalid input: codes must be an array of strings' }, { status: 400 });
    }

    const scottish = Array.from(new Set(codes as string[])).filter((c) => /^S01\d{6}$/.test(c));
    if (scottish.length > MAX_CODES) {
      return NextResponse.json({ error: `At most ${MAX_CODES} codes per request` }, { status: 400 });
    }
    if (scottish.length === 0) {
      return NextResponse.json({ type: 'FeatureCollection', features: [] });
    }

    const { data, error } = await supabase.rpc('get_lsoa_shapes_geojson', { p_codes: scottish });
    if (error) throw new Error(error.message);

    return NextResponse.json(data ?? { type: 'FeatureCollection', features: [] });
  } catch (error) {
    console.error('Error in area shapes API:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch area shapes',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
