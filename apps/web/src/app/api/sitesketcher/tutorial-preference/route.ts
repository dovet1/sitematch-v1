import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/sitesketcher/tutorial-preference - Check if user has hidden tutorial
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServerClient();

    // Fetch user's tutorial preference from database
    const { data: userData, error } = await supabase
      .from('users')
      .select('hide_sitesketcher_tutorial')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error fetching tutorial preference:', error);
      return NextResponse.json({ error: 'Failed to fetch tutorial preference' }, { status: 500 });
    }

    return NextResponse.json({
      hide_tutorial: userData?.hide_sitesketcher_tutorial ?? false,
    });
  } catch (error) {
    console.error('Error in GET /api/sitesketcher/tutorial-preference:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/sitesketcher/tutorial-preference - Update user's tutorial preference
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { hide_tutorial } = body;

    // Validate input
    if (typeof hide_tutorial !== 'boolean') {
      return NextResponse.json({ error: 'hide_tutorial must be a boolean' }, { status: 400 });
    }

    const supabase = await createServerClient();

    // Update user's tutorial preference in database
    const { error } = await supabase
      .from('users')
      .update({ hide_sitesketcher_tutorial: hide_tutorial })
      .eq('id', user.id);

    if (error) {
      console.error('Error updating tutorial preference:', error);
      return NextResponse.json({ error: 'Failed to update tutorial preference' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      hide_tutorial,
    });
  } catch (error) {
    console.error('Error in POST /api/sitesketcher/tutorial-preference:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
