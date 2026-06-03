import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import { hasProAccess } from '@/lib/subscription-utils';

export const dynamic = 'force-dynamic';

// GET /api/sitesketcher-v2/sketches - List all v2 sketches for current user
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check Pro access
    const isPro = await hasProAccess(user.id);
    if (!isPro) {
      return NextResponse.json(
        { error: 'Pro subscription required to access saved sketches' },
        { status: 403 }
      );
    }

    const supabase = await createServerClient();

    // Fetch v2 sketches only ordered by most recently updated
    const { data: sketches, error } = await supabase
      .from('site_sketches')
      .select('*')
      .eq('user_id', user.id)
      .eq('data->>version', '2') // Only v2 sketches
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching v2 sketches:', error);
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

// POST /api/sitesketcher-v2/sketches - Create new v2 sketch
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check Pro access for saving
    const isPro = await hasProAccess(user.id);
    if (!isPro) {
      return NextResponse.json(
        { error: 'Pro subscription required to save sketches' },
        { status: 403 }
      );
    }

    const supabase = await createServerClient();
    const body = await request.json();
    const { name, description, data, thumbnail_url, location } = body;

    // Validate required fields
    if (!name || !data) {
      return NextResponse.json(
        { error: 'Name and data are required' },
        { status: 400 }
      );
    }

    // Ensure version is set to 2
    const v2Data = {
      ...data,
      version: 2,
    };

    // Count existing polygons and parking blocks
    const polygonCount = v2Data.polygons?.length || 0;
    const parkingCount = v2Data.parkingBlocks?.length || 0;

    // Tier enforcement: Pro/Plus = unlimited, Free = 1 polygon + 1 parking
    if (!isPro) {
      if (polygonCount > 1 || parkingCount > 1) {
        return NextResponse.json(
          {
            error: 'Free tier limited to 1 polygon and 1 parking block. Upgrade to Pro for unlimited objects.',
            tier: 'free',
            limit: { polygons: 1, parkingBlocks: 1 }
          },
          { status: 403 }
        );
      }
    }

    // Insert new sketch
    const { data: sketch, error } = await supabase
      .from('site_sketches')
      .insert({
        user_id: user.id,
        name,
        description: description || null,
        data: v2Data,
        thumbnail_url: thumbnail_url || null,
        location: location || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating v2 sketch:', error);
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
