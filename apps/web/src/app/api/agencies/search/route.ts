import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const classification = searchParams.get('classification');
    
    const user = await getCurrentUser();
    
    const supabase = await createServerClient();
    
    let dbQuery = supabase
      .from('agencies')
      .select(`
        id, 
        name, 
        classification, 
        geographic_patch, 
        logo_url,
        agency_versions!inner(status)
      `)
      .eq('agency_versions.status', 'approved')
      .order('name');

    // Apply search filter
    if (query.trim()) {
      dbQuery = dbQuery.ilike('name', `%${query.trim()}%`);
    }

    // Apply classification filter
    if (classification && classification !== 'all') {
      dbQuery = dbQuery.eq('classification', classification);
    }

    // Limit results for performance
    dbQuery = dbQuery.limit(20);

    const { data: agencies, error } = await dbQuery;

    if (error) {
      console.error('Error searching agencies:', error);
      return NextResponse.json({ error: 'Failed to search agencies' }, { status: 500 });
    }

    return NextResponse.json({ data: agencies || [] });
  } catch (error) {
    console.error('Error in agencies search route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}