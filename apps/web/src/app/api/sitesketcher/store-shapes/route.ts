import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sitesketcher/store-shapes
 * Fetch all active store shapes from the public library
 * No authentication required - this is public data
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Store Shapes API] Fetching store shapes...');
    const supabase = createServerClient();

    // Fetch active shapes ordered by display_order, then name
    const { data: shapes, error } = await supabase
      .from('store_shapes')
      .select('*')
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

    console.log('[Store Shapes API] Successfully fetched', shapes?.length || 0, 'shapes');
    return NextResponse.json({ shapes: shapes || [] });
  } catch (error: any) {
    console.error('[Store Shapes API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
