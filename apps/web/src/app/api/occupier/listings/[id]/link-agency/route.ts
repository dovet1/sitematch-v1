import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: listingId } = params;
    const { agencyId } = await request.json();

    if (!agencyId) {
      return NextResponse.json({ error: 'Agency ID is required' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Check if user owns this listing
    const { data: listing, error: fetchError } = await supabase
      .from('listings')
      .select('id, created_by')
      .eq('id', listingId)
      .single();

    if (fetchError || !listing || listing.created_by !== user.id) {
      return NextResponse.json({ error: 'Listing not found or unauthorized' }, { status: 403 });
    }

    // Verify the agency exists and has approved versions
    const { data: agency, error: agencyError } = await supabase
      .from('agencies')
      .select(`
        id, 
        name,
        agency_versions!inner(status)
      `)
      .eq('id', agencyId)
      .eq('agency_versions.status', 'approved')
      .single();

    if (agencyError || !agency) {
      return NextResponse.json({ error: 'Agency not found or not approved' }, { status: 400 });
    }

    // Update the listing with the linked agency
    const { data: updateData, error: updateError } = await supabase
      .from('listings')
      .update({ 
        linked_agency_id: agencyId,
        updated_at: new Date().toISOString()
      })
      .eq('id', listingId)
      .select();

    // Debug: Remove logging once migration is applied

    if (updateError) {
      console.error('Error linking agency to listing:', updateError);
      return NextResponse.json({ error: 'Failed to link agency' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: `Successfully linked ${agency.name} to your listing` 
    });
  } catch (error) {
    console.error('Error in link agency route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: listingId } = params;
    const supabase = createServerClient();

    // Check if user owns this listing
    const { data: listing, error: fetchError } = await supabase
      .from('listings')
      .select('id, created_by')
      .eq('id', listingId)
      .single();

    if (fetchError || !listing || listing.created_by !== user.id) {
      return NextResponse.json({ error: 'Listing not found or unauthorized' }, { status: 403 });
    }

    // Remove the linked agency
    const { error: updateError } = await supabase
      .from('listings')
      .update({ 
        linked_agency_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', listingId);

    if (updateError) {
      console.error('Error unlinking agency from listing:', updateError);
      return NextResponse.json({ error: 'Failed to unlink agency' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true,
      message: 'Successfully removed agent from your listing' 
    });
  } catch (error) {
    console.error('Error in unlink agency route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}