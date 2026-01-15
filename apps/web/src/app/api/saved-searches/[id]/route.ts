import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import type { UpdateSavedSearch } from '@/lib/saved-searches-types';

export const dynamic = 'force-dynamic';

// GET /api/saved-searches/[id] - Get a single saved search
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServerClient();

    const { data: search, error } = await supabase
      .from('saved_searches')
      .select('*')
      .eq('id', (await params).id)
      .eq('user_id', user.id)
      .single();

    if (error || !search) {
      return NextResponse.json(
        { error: 'Saved search not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ search });
  } catch (error) {
    console.error('Error in GET /api/saved-searches/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT /api/saved-searches/[id] - Update a saved search
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: UpdateSavedSearch = await request.json();

    console.log('Received update body:', JSON.stringify(body, null, 2));

    // Validation
    if (body.name !== undefined && body.name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Search name cannot be empty' },
        { status: 400 }
      );
    }

    // Validate size range
    if (
      body.min_size !== undefined &&
      body.min_size !== null &&
      body.max_size !== undefined &&
      body.max_size !== null &&
      body.min_size > body.max_size
    ) {
      return NextResponse.json(
        { error: 'Minimum size must be less than maximum size' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Check that the search exists and belongs to the user
    const { data: existingSearch, error: fetchError } = await supabase
      .from('saved_searches')
      .select('id')
      .eq('id', (await params).id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !existingSearch) {
      return NextResponse.json(
        { error: 'Saved search not found' },
        { status: 404 }
      );
    }

    // Update the search
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.listing_type !== undefined) updateData.listing_type = body.listing_type;
    if (body.location_address !== undefined) updateData.location_address = body.location_address;
    if (body.location_lat !== undefined) updateData.location_lat = body.location_lat;
    if (body.location_lng !== undefined) updateData.location_lng = body.location_lng;
    if (body.location_radius_miles !== undefined) updateData.location_radius_miles = body.location_radius_miles;

    // Handle sectors: null, empty array, or array of strings
    if (body.sectors !== undefined) {
      if (body.sectors === null || (Array.isArray(body.sectors) && body.sectors.length === 0)) {
        updateData.sectors = null;
      } else if (Array.isArray(body.sectors)) {
        updateData.sectors = body.sectors.filter(s => s !== null && s !== undefined);
        if (updateData.sectors.length === 0) updateData.sectors = null;
      } else {
        updateData.sectors = [body.sectors];
      }
    }

    // Handle planning_use_classes: null, empty array, or array of strings
    if (body.planning_use_classes !== undefined) {
      if (body.planning_use_classes === null || (Array.isArray(body.planning_use_classes) && body.planning_use_classes.length === 0)) {
        updateData.planning_use_classes = null;
      } else if (Array.isArray(body.planning_use_classes)) {
        updateData.planning_use_classes = body.planning_use_classes.filter(c => c !== null && c !== undefined);
        if (updateData.planning_use_classes.length === 0) updateData.planning_use_classes = null;
      } else {
        updateData.planning_use_classes = [body.planning_use_classes];
      }
    }

    if (body.min_size !== undefined) updateData.min_size = body.min_size;
    if (body.max_size !== undefined) updateData.max_size = body.max_size;
    if (body.email_notifications_enabled !== undefined) updateData.email_notifications_enabled = body.email_notifications_enabled;

    const { data: updatedSearch, error: updateError } = await supabase
      .from('saved_searches')
      .update(updateData)
      .eq('id', (await params).id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating saved search:', updateError);
      return NextResponse.json(
        { error: 'Failed to update saved search' },
        { status: 500 }
      );
    }

    return NextResponse.json({ search: updatedSearch });
  } catch (error) {
    console.error('Error in PUT /api/saved-searches/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/saved-searches/[id] - Delete a saved search
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServerClient();

    const { error } = await supabase
      .from('saved_searches')
      .delete()
      .eq('id', (await params).id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting saved search:', error);
      return NextResponse.json(
        { error: 'Failed to delete saved search' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/saved-searches/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
