import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/sites/[id]/sketches - List attached sketches
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    // Verify site ownership
    const { data: site, error: siteError } = await supabase
      .from('user_sites')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (siteError || !site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Fetch attached sketches
    const { data: sketches, error } = await supabase
      .from('site_sketches')
      .select('*')
      .eq('site_id', params.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching sketches:', error);
      return NextResponse.json(
        { error: 'Failed to fetch sketches' },
        { status: 500 }
      );
    }

    return NextResponse.json({ sketches: sketches || [] });
  } catch (error) {
    console.error('Error in GET /api/sites/[id]/sketches:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/sites/[id]/sketches - Attach a sketch to site
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { sketch_id } = body;

    if (!sketch_id) {
      return NextResponse.json(
        { error: 'sketch_id is required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Verify site ownership
    const { data: site, error: siteError } = await supabase
      .from('user_sites')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (siteError || !site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Verify sketch ownership
    const { data: sketch, error: sketchError } = await supabase
      .from('site_sketches')
      .select('id, site_id')
      .eq('id', sketch_id)
      .eq('user_id', user.id)
      .single();

    if (sketchError || !sketch) {
      return NextResponse.json({ error: 'Sketch not found' }, { status: 404 });
    }

    // Check if already attached
    if (sketch.site_id === params.id) {
      return NextResponse.json(
        { error: 'Sketch already attached to this site' },
        { status: 400 }
      );
    }

    // Attach sketch to site
    const { data: updatedSketch, error: updateError } = await supabase
      .from('site_sketches')
      .update({ site_id: params.id })
      .eq('id', sketch_id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error attaching sketch:', updateError);
      return NextResponse.json(
        { error: 'Failed to attach sketch' },
        { status: 500 }
      );
    }

    return NextResponse.json({ sketch: updatedSketch });
  } catch (error) {
    console.error('Error in POST /api/sites/[id]/sketches:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/sites/[id]/sketches - Detach a sketch from site
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sketch_id = searchParams.get('sketch_id');

    if (!sketch_id) {
      return NextResponse.json(
        { error: 'sketch_id query parameter is required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Verify ownership and detach
    const { error } = await supabase
      .from('site_sketches')
      .update({ site_id: null })
      .eq('id', sketch_id)
      .eq('site_id', params.id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error detaching sketch:', error);
      return NextResponse.json(
        { error: 'Failed to detach sketch' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/sites/[id]/sketches:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
