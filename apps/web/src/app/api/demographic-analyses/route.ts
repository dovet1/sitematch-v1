import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/demographic-analyses - List all analyses for current user
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    // Fetch all analyses for the user
    const { data: analyses, error } = await supabase
      .from('site_demographic_analyses')
      .select(`
        id,
        site_id,
        user_id,
        name,
        location_name,
        measurement_mode,
        measurement_value,
        created_at
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching analyses:', error);
      return NextResponse.json(
        { error: 'Failed to fetch analyses' },
        { status: 500 }
      );
    }

    return NextResponse.json({ analyses: analyses || [] });
  } catch (error) {
    console.error('Error in GET /api/demographic-analyses:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
