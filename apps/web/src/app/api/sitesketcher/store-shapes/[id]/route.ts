import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sitesketcher/store-shapes/[id]
 * Fetch full GeoJSON for a specific store shape
 * Called on-demand when user selects a shape (lazy loading optimization)
 * No authentication required - this is public data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    console.log('[Store Shape Detail API] Fetching shape:', id);
    const supabase = createServerClient();

    // Fetch the full record including geojson
    const { data: shape, error } = await supabase
      .from('store_shapes')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('[Store Shape Detail API] Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch store shape', details: error.message },
        { status: 500 }
      );
    }

    if (!shape) {
      return NextResponse.json(
        { error: 'Store shape not found' },
        { status: 404 }
      );
    }

    console.log('[Store Shape Detail API] Successfully fetched shape:', shape.name);
    return NextResponse.json({ shape });
  } catch (error: any) {
    console.error('[Store Shape Detail API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
