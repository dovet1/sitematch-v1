import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/sitesketcher/sketches/[id] - Get single sketch
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createServerClient();

    const { data: sketch, error } = await supabase
      .from('site_sketches')
      .select('*')
      .eq('id', (await params).id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error fetching sketch:', error);
      return NextResponse.json(
        { error: 'Sketch not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ sketch });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/sitesketcher/sketches/[id] - Update sketch
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createServerClient();

    const body = await request.json();
    const { name, description, data, thumbnail_url, location } = body;

    // Build update object with only provided fields
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (data !== undefined) updateData.data = data;
    if (thumbnail_url !== undefined) updateData.thumbnail_url = thumbnail_url;
    if (location !== undefined) updateData.location = location;

    const { data: sketch, error } = await supabase
      .from('site_sketches')
      .update(updateData)
      .eq('id', (await params).id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating sketch:', error);
      return NextResponse.json(
        { error: 'Failed to update sketch' },
        { status: 500 }
      );
    }

    return NextResponse.json({ sketch });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/sitesketcher/sketches/[id] - Delete sketch
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createServerClient();

    const { error } = await supabase
      .from('site_sketches')
      .delete()
      .eq('id', (await params).id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting sketch:', error);
      return NextResponse.json(
        { error: 'Failed to delete sketch' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
