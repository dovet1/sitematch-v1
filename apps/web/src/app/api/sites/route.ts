import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/sites - List all sites for the current user with attachment counts
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createServerClient();

    // Fetch all sites for the user
    const { data: sites, error } = await supabase
      .from('user_sites')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching sites:', error);
      return NextResponse.json(
        { error: 'Failed to fetch sites' },
        { status: 500 }
      );
    }

    // Fetch attachment counts for each site
    const sitesWithCounts = await Promise.all(
      sites.map(async (site) => {
        // Count saved searches
        const { count: searchCount } = await supabase
          .from('saved_searches')
          .select('*', { count: 'exact', head: true })
          .eq('site_id', site.id);

        // Count sketches
        const { count: sketchCount } = await supabase
          .from('site_sketches')
          .select('*', { count: 'exact', head: true })
          .eq('site_id', site.id);

        // Count analyses
        const { count: analysisCount } = await supabase
          .from('site_demographic_analyses')
          .select('*', { count: 'exact', head: true })
          .eq('site_id', site.id);

        return {
          ...site,
          attachment_counts: {
            searches: searchCount || 0,
            sketches: sketchCount || 0,
            analyses: analysisCount || 0,
          },
        };
      })
    );

    return NextResponse.json({ sites: sitesWithCounts });
  } catch (error) {
    console.error('Error in GET /api/sites:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/sites - Create a new site
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validation
    if (!body.name || body.name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Site name is required' },
        { status: 400 }
      );
    }

    if (!body.address || body.address.trim().length === 0) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }

    if (!body.lng || !body.lat) {
      return NextResponse.json(
        { error: 'Location coordinates are required' },
        { status: 400 }
      );
    }

    // Validate name length
    if (body.name.trim().length > 100) {
      return NextResponse.json(
        { error: 'Site name must be 100 characters or less' },
        { status: 400 }
      );
    }

    // Validate description length if provided
    if (body.description && body.description.length > 500) {
      return NextResponse.json(
        { error: 'Description must be 500 characters or less' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Create the site with geography point
    // PostGIS expects longitude first, then latitude
    const { data: newSite, error: insertError } = await supabase
      .from('user_sites')
      .insert({
        user_id: user.id,
        name: body.name.trim(),
        address: body.address.trim(),
        location: `POINT(${body.lng} ${body.lat})`,
        description: body.description?.trim() || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating site:', insertError);
      return NextResponse.json(
        { error: 'Failed to create site' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        site: {
          ...newSite,
          attachment_counts: {
            searches: 0,
            sketches: 0,
            analyses: 0,
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/sites:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
