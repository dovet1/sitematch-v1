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
    const supabase = createServerClient();

    // Fetch active shapes ordered by display_order, then name
    const { data: shapes, error } = await supabase
      .from('store_shapes')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching store shapes:', error);
      return NextResponse.json(
        { error: 'Failed to fetch store shapes' },
        { status: 500 }
      );
    }

    return NextResponse.json({ shapes: shapes || [] });
  } catch (error) {
    console.error('Unexpected error fetching store shapes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
