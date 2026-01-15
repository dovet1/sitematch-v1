import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/sites/[id]/searches - List attached saved searches
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

    // Verify site ownership
    const { data: site, error: siteError } = await supabase
      .from('user_sites')
      .select('id')
      .eq('id', (await params).id)
      .eq('user_id', user.id)
      .single();

    if (siteError || !site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Fetch attached searches
    const { data: searches, error } = await supabase
      .from('saved_searches')
      .select('*')
      .eq('site_id', (await params).id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching searches:', error);
      return NextResponse.json(
        { error: 'Failed to fetch searches' },
        { status: 500 }
      );
    }

    return NextResponse.json({ searches: searches || [] });
  } catch (error) {
    console.error('Error in GET /api/sites/[id]/searches:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/sites/[id]/searches - Attach a saved search to site
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { search_id } = body;

    if (!search_id) {
      return NextResponse.json(
        { error: 'search_id is required' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Verify site ownership
    const { data: site, error: siteError } = await supabase
      .from('user_sites')
      .select('id')
      .eq('id', (await params).id)
      .eq('user_id', user.id)
      .single();

    if (siteError || !site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Verify search ownership
    const { data: search, error: searchError } = await supabase
      .from('saved_searches')
      .select('id, site_id')
      .eq('id', search_id)
      .eq('user_id', user.id)
      .single();

    if (searchError || !search) {
      return NextResponse.json({ error: 'Search not found' }, { status: 404 });
    }

    // Check if already attached
    if (search.site_id === (await params).id) {
      return NextResponse.json(
        { error: 'Search already attached to this site' },
        { status: 400 }
      );
    }

    // Attach search to site
    const { data: updatedSearch, error: updateError } = await supabase
      .from('saved_searches')
      .update({ site_id: (await params).id })
      .eq('id', search_id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error attaching search:', updateError);
      return NextResponse.json(
        { error: 'Failed to attach search' },
        { status: 500 }
      );
    }

    return NextResponse.json({ search: updatedSearch });
  } catch (error) {
    console.error('Error in POST /api/sites/[id]/searches:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/sites/[id]/searches - Detach a saved search from site
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search_id = searchParams.get('search_id');

    if (!search_id) {
      return NextResponse.json(
        { error: 'search_id query parameter is required' },
        { status: 400 }
      );
    }

    const supabase = await createServerClient();

    // Verify ownership and detach
    const { error } = await supabase
      .from('saved_searches')
      .update({ site_id: null })
      .eq('id', search_id)
      .eq('site_id', (await params).id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error detaching search:', error);
      return NextResponse.json(
        { error: 'Failed to detach search' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/sites/[id]/searches:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
