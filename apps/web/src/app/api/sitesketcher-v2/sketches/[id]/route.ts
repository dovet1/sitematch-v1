import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import { hasProAccess, hasPlusAccess } from '@/lib/subscription-utils';
import { sanitizeSketchForUser } from '@/lib/sitesketcher-v2/validation';

export const dynamic = 'force-dynamic';

// GET /api/sitesketcher-v2/sketches/[id] - Get single v2 sketch
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

    // Check Pro access
    const isPro = await hasProAccess(user.id);
    if (!isPro) {
      return NextResponse.json(
        { error: 'Pro subscription required to access saved sketches' },
        { status: 403 }
      );
    }

    const isPlus = await hasPlusAccess(user.id);
    const supabase = await createServerClient();

    const { data: sketch, error } = await supabase
      .from('site_sketches')
      .select('*')
      .eq('id', (await params).id)
      .eq('user_id', user.id)
      .eq('data->>version', '2') // Only fetch v2 sketches
      .single();

    if (error) {
      console.error('Error fetching v2 sketch:', error);
      return NextResponse.json(
        { error: 'Sketch not found' },
        { status: 404 }
      );
    }

    // Sanitize CAD data based on Plus access
    const sanitizedSketch = {
      ...sketch,
      data: sanitizeSketchForUser(sketch.data, isPlus),
    };

    return NextResponse.json({ sketch: sanitizedSketch });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/sitesketcher-v2/sketches/[id] - Update v2 sketch
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

    // Check Pro access
    const isPro = await hasProAccess(user.id);
    if (!isPro) {
      return NextResponse.json(
        { error: 'Pro subscription required to save sketches' },
        { status: 403 }
      );
    }

    const isPlus = await hasPlusAccess(user.id);
    const supabase = await createServerClient();

    const body = await request.json();
    const { name, description, data, thumbnail_url, location } = body;

    // Ensure version is set to 2
    let v2Data = data ? {
      ...data,
      version: 2,
    } : undefined;

    // CAD preservation: If user is non-Plus and sending empty CAD arrays, merge back preserved CAD from DB
    if (v2Data && !isPlus) {
      const { data: existingSketch } = await supabase
        .from('site_sketches')
        .select('data')
        .eq('id', (await params).id)
        .eq('user_id', user.id)
        .single();

      if (existingSketch?.data) {
        // Preserve existing CAD data if client sent empty arrays
        const clientCadImages = v2Data.cadImages || [];
        const clientCadInstances = v2Data.cadInstances || [];

        if (clientCadImages.length === 0 && clientCadInstances.length === 0) {
          v2Data = {
            ...v2Data,
            cadImages: existingSketch.data.cadImages || [],
            cadInstances: existingSketch.data.cadInstances || [],
          };
        }
      }
    }

    // Tier enforcement if data is being updated
    if (v2Data && !isPro) {
      const polygonCount = v2Data.polygons?.length || 0;
      const parkingCount = v2Data.parkingBlocks?.length || 0;

      if (polygonCount > 2 || parkingCount > 2) {
        return NextResponse.json(
          {
            error: 'Free tier limited to 2 polygons and 2 parking blocks. Upgrade to Pro for unlimited objects.',
            tier: 'free',
            limit: { polygons: 2, parkingBlocks: 2 }
          },
          { status: 403 }
        );
      }
    }

    // Build update object with only provided fields
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description || null;
    if (v2Data !== undefined) updateData.data = v2Data;
    if (thumbnail_url !== undefined) updateData.thumbnail_url = thumbnail_url;
    if (location !== undefined) updateData.location = location;

    const { data: sketch, error } = await supabase
      .from('site_sketches')
      .update(updateData)
      .eq('id', (await params).id)
      .eq('user_id', user.id)
      .eq('data->>version', '2') // Only update v2 sketches
      .select()
      .single();

    if (error) {
      console.error('[SiteSketcher V2] Sketch update failed:', {
        sketchId: (await params).id,
        userId: user.id,
        error: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
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

// DELETE /api/sitesketcher-v2/sketches/[id] - Delete v2 sketch
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

    // Check Pro access
    const isPro = await hasProAccess(user.id);
    if (!isPro) {
      return NextResponse.json(
        { error: 'Pro subscription required to manage saved sketches' },
        { status: 403 }
      );
    }

    const supabase = await createServerClient();

    // NOTE: No longer delete CAD storage files on sketch delete
    // Legacy cadImages stored in sketches: Will become orphaned (acceptable - user may have them in other sketches)
    // New cadInstances: Reference savedCads which are managed independently via library

    // Delete the sketch
    const { data, error } = await supabase
      .from('site_sketches')
      .delete()
      .eq('id', (await params).id)
      .eq('user_id', user.id)
      .eq('data->>version', '2') // Only delete v2 sketches
      .select('id')
      .single();

    if (error || !data) {
      console.error('Error deleting v2 sketch:', error);
      return NextResponse.json(
        { error: 'Sketch not found or delete failed' },
        { status: 404 }
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
