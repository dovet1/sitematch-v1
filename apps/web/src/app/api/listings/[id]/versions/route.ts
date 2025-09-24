// =====================================================
// API Route: Get Listing Versions
// Fetch versions for a specific listing with filtering
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only admins can access version details
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Use admin client to bypass RLS for admin users
    const { createAdminClient } = await import('@/lib/supabase');
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    
    // Extract query parameters
    const status = searchParams.get('status');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    // Build the query
    let query = supabase
      .from('listing_versions')
      .select('id, version_number, status, created_at, reviewed_at, reviewed_by, review_notes, is_live')
      .eq('listing_id', params.id)
      .order('version_number', { ascending: false });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (limit) {
      const limitNum = parseInt(limit);
      const offsetNum = offset ? parseInt(offset) : 0;
      query = query.range(offsetNum, offsetNum + limitNum - 1);
    }

    const { data: versions, error } = await query;

    if (error) {
      console.error('Error fetching versions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch versions' }, 
        { status: 500 }
      );
    }

    return NextResponse.json({
      versions: versions || [],
      count: versions?.length || 0
    });

  } catch (error) {
    console.error('Error in versions API:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}