import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { AddListingAgentRequest, RemoveListingAgentRequest } from '@/types/agencies';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;
  const supabase = createServerClient();

  try {
    const { data, error } = await supabase
      .from('listing_agents')
      .select(`
        id,
        listing_id,
        agency_id,
        added_at,
        agency:agencies (
          id,
          name,
          description,
          website,
          email,
          phone,
          address,
          logo_url,
          created_by,
          created_at,
          updated_at
        )
      `)
      .eq('listing_id', listingId);

    if (error) {
      console.error('Error fetching listing agents:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch agents' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Error in GET /api/listings/[id]/agents:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;
  const supabase = createServerClient();

  try {
    const body: AddListingAgentRequest = await request.json();
    
    // Verify the listing exists and user has permission
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, created_by')
      .eq('id', listingId)
      .single();

    if (listingError || !listing) {
      return NextResponse.json(
        { success: false, error: 'Listing not found' },
        { status: 404 }
      );
    }

    // Verify the agency exists
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .select('id')
      .eq('id', body.agency_id)
      .single();

    if (agencyError || !agency) {
      return NextResponse.json(
        { success: false, error: 'Agency not found' },
        { status: 404 }
      );
    }

    // Add the agent (upsert to handle duplicates)
    const { data, error } = await supabase
      .from('listing_agents')
      .upsert({
        listing_id: listingId,
        agency_id: body.agency_id
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json(
          { success: false, error: 'Agency already linked to this listing' },
          { status: 400 }
        );
      }
      console.error('Error adding listing agent:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to add agent' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error in POST /api/listings/[id]/agents:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;
  const supabase = createServerClient();

  try {
    const url = new URL(request.url);
    const agencyId = url.searchParams.get('agency_id');

    if (!agencyId) {
      return NextResponse.json(
        { success: false, error: 'agency_id parameter is required' },
        { status: 400 }
      );
    }

    // Verify the listing exists and user has permission
    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .select('id, created_by')
      .eq('id', listingId)
      .single();

    if (listingError || !listing) {
      return NextResponse.json(
        { success: false, error: 'Listing not found' },
        { status: 404 }
      );
    }

    // Remove the agent
    const { error } = await supabase
      .from('listing_agents')
      .delete()
      .eq('listing_id', listingId)
      .eq('agency_id', agencyId);

    if (error) {
      console.error('Error removing listing agent:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to remove agent' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Agent removed successfully'
    });
  } catch (error) {
    console.error('Error in DELETE /api/listings/[id]/agents:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}