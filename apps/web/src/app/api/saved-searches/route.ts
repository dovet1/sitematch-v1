import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import type { CreateSavedSearch } from '@/lib/saved-searches-types';

export const dynamic = 'force-dynamic';

// GET /api/saved-searches - List all saved searches for the current user
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    // Fetch all saved searches for the user
    const { data: searches, error } = await supabase
      .from('saved_searches')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching saved searches:', error);
      return NextResponse.json(
        { error: 'Failed to fetch saved searches' },
        { status: 500 }
      );
    }

    return NextResponse.json({ searches });
  } catch (error) {
    console.error('Error in GET /api/saved-searches:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/saved-searches - Create a new saved search
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateSavedSearch = await request.json();

    // Validation
    if (!body.name || body.name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Search name is required' },
        { status: 400 }
      );
    }

    // Check if user already has 50 searches
    const supabase = createServerClient();
    const { count, error: countError } = await supabase
      .from('saved_searches')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (countError) {
      console.error('Error counting saved searches:', countError);
      return NextResponse.json(
        { error: 'Failed to validate search limit' },
        { status: 500 }
      );
    }

    if (count && count >= 50) {
      return NextResponse.json(
        { error: 'Maximum of 50 saved searches reached' },
        { status: 400 }
      );
    }

    // Validate size range
    if (
      body.min_size &&
      body.max_size &&
      body.min_size > body.max_size
    ) {
      return NextResponse.json(
        { error: 'Minimum size must be less than maximum size' },
        { status: 400 }
      );
    }

    // Handle sectors: convert empty arrays to null
    let sectors = body.sectors || null;
    if (Array.isArray(sectors) && sectors.length === 0) {
      sectors = null;
    } else if (Array.isArray(sectors)) {
      sectors = sectors.filter(s => s !== null && s !== undefined);
      if (sectors.length === 0) sectors = null;
    }

    // Handle planning_use_classes: convert empty arrays to null
    let planning_use_classes = body.planning_use_classes || null;
    if (Array.isArray(planning_use_classes) && planning_use_classes.length === 0) {
      planning_use_classes = null;
    } else if (Array.isArray(planning_use_classes)) {
      planning_use_classes = planning_use_classes.filter(c => c !== null && c !== undefined);
      if (planning_use_classes.length === 0) planning_use_classes = null;
    }

    // Create the saved search
    const { data: newSearch, error: insertError } = await supabase
      .from('saved_searches')
      .insert({
        user_id: user.id,
        name: body.name.trim(),
        listing_type: body.listing_type || null,
        location_address: body.location_address || null,
        location_lat: body.location_lat || null,
        location_lng: body.location_lng || null,
        location_radius_miles: body.location_radius_miles || null,
        sectors,
        planning_use_classes,
        min_size: body.min_size || null,
        max_size: body.max_size || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating saved search:', insertError);
      return NextResponse.json(
        { error: 'Failed to create saved search' },
        { status: 500 }
      );
    }

    return NextResponse.json({ search: newSearch }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/saved-searches:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
