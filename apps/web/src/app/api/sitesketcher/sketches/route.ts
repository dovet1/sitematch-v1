import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

// GET /api/sitesketcher/sketches - List all sketches for current user
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createServerClient();

    // Fetch sketches ordered by most recently updated
    const { data: sketches, error } = await supabase
      .from('site_sketches')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching sketches:', error);
      return NextResponse.json(
        { error: 'Failed to fetch sketches' },
        { status: 500 }
      );
    }

    return NextResponse.json({ sketches });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/sitesketcher/sketches - Create new sketch
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createServerClient();

    const body = await request.json();
    const { name, description, data, thumbnail_url, location } = body;

    // Validate required fields
    if (!name || !data) {
      return NextResponse.json(
        { error: 'Name and data are required' },
        { status: 400 }
      );
    }

    // Insert new sketch
    const { data: sketch, error } = await supabase
      .from('site_sketches')
      .insert({
        user_id: user.id,
        name,
        description: description || null,
        data,
        thumbnail_url: thumbnail_url || null,
        location: location || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating sketch:', error);
      return NextResponse.json(
        { error: 'Failed to create sketch' },
        { status: 500 }
      );
    }

    return NextResponse.json({ sketch }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
