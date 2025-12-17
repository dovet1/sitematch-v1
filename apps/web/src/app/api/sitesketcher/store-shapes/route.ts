import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sitesketcher/store-shapes
 * Fetch store shape metadata (no GeoJSON) from the public library
 * No authentication required - this is public data
 * For performance: excludes large geojson column (fetch via /store-shapes/[id] instead)
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Store Shapes API] Fetching store shapes metadata...');
    const supabase = createServerClient();

    // Fetch ONLY metadata fields - exclude massive geojson column for performance
    // This reduces payload from ~4MB to ~5KB per shape
    const { data: shapes, error } = await supabase
      .from('store_shapes')
      .select('id, name, description, company_name, display_order, metadata, is_active, created_at, updated_at')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('[Store Shapes API] Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch store shapes', details: error.message },
        { status: 500 }
      );
    }

    console.log('[Store Shapes API] Successfully fetched', shapes?.length || 0, 'shapes (metadata only)');
    return NextResponse.json({ shapes: shapes || [] });
  } catch (error: any) {
    console.error('[Store Shapes API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
