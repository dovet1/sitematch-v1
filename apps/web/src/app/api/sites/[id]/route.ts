import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/sites/[id] - Get site details with all attachments
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

    // Try to fetch the site with location coordinates using the PostGIS function
    const { data: siteData, error: siteError } = await supabase
      .rpc('get_site_with_location', { p_site_id: params.id });

    let site = null;

    if (siteError || !siteData || siteData.length === 0) {
      // Fallback: fetch without coordinates
      console.log('get_site_with_location RPC not available, using fallback');
      const { data: basicSite, error: basicError } = await supabase
        .from('user_sites')
        .select(`
          id,
          user_id,
          name,
          address,
          description,
          created_at,
          updated_at
        `)
        .eq('id', params.id)
        .eq('user_id', user.id)
        .single();

      if (basicError || !basicSite) {
        return NextResponse.json({ error: 'Site not found' }, { status: 404 });
      }

      // Set location to null since we can't extract it
      site = { ...basicSite, location: null };
    } else {
      site = siteData[0];
      // Verify ownership
      if (site.user_id !== user.id) {
        return NextResponse.json({ error: 'Site not found' }, { status: 404 });
      }
    }

    // Fetch all attachments
    const [
      { data: searches },
      { data: sketches },
      { data: analyses },
    ] = await Promise.all([
      supabase
        .from('saved_searches')
        .select('*')
        .eq('site_id', params.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('site_sketches')
        .select('*')
        .eq('site_id', params.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('site_demographic_analyses')
        .select('*')
        .eq('site_id', params.id)
        .order('created_at', { ascending: false }),
    ]);

    return NextResponse.json({
      site: {
        ...site,
        searches: searches || [],
        sketches: sketches || [],
        analyses: analyses || [],
      },
    });
  } catch (error) {
    console.error('Error in GET /api/sites/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/sites/[id] - Update site
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const supabase = createServerClient();

    // Verify ownership
    const { data: existing, error: fetchError } = await supabase
      .from('user_sites')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Build update object
    const updates: any = {};

    if (body.name !== undefined) {
      if (!body.name || body.name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Site name is required' },
          { status: 400 }
        );
      }
      if (body.name.trim().length > 100) {
        return NextResponse.json(
          { error: 'Site name must be 100 characters or less' },
          { status: 400 }
        );
      }
      updates.name = body.name.trim();
    }

    if (body.address !== undefined) {
      if (!body.address || body.address.trim().length === 0) {
        return NextResponse.json(
          { error: 'Address is required' },
          { status: 400 }
        );
      }
      updates.address = body.address.trim();
    }

    if (body.description !== undefined) {
      if (body.description && body.description.length > 500) {
        return NextResponse.json(
          { error: 'Description must be 500 characters or less' },
          { status: 400 }
        );
      }
      updates.description = body.description?.trim() || null;
    }

    // Update location if coordinates provided
    if (body.lng !== undefined && body.lat !== undefined) {
      updates.location = `POINT(${body.lng} ${body.lat})`;
    }

    // Perform update
    const { data: updatedSite, error: updateError } = await supabase
      .from('user_sites')
      .update(updates)
      .eq('id', params.id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating site:', updateError);
      return NextResponse.json(
        { error: 'Failed to update site' },
        { status: 500 }
      );
    }

    return NextResponse.json({ site: updatedSite });
  } catch (error) {
    console.error('Error in PATCH /api/sites/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/sites/[id] - Delete site
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerClient();

    // Unlink attachments (set site_id to null) before deleting site
    await Promise.all([
      supabase
        .from('saved_searches')
        .update({ site_id: null })
        .eq('site_id', params.id),
      supabase
        .from('site_sketches')
        .update({ site_id: null })
        .eq('site_id', params.id),
    ]);

    // Note: site_demographic_analyses will CASCADE DELETE due to foreign key

    // Delete the site
    const { error } = await supabase
      .from('user_sites')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting site:', error);
      return NextResponse.json(
        { error: 'Failed to delete site' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/sites/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
