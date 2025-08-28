import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: listingId } = params;
    const body = await request.json();
    const { linkedAgencyId } = body;

    const supabase = createServerClient();

    // Check if user owns this listing
    const { data: listing, error: fetchError } = await supabase
      .from('listings')
      .select('created_by')
      .eq('id', listingId)
      .single();

    if (fetchError || !listing || listing.created_by !== user.id) {
      return NextResponse.json({ error: 'Listing not found or unauthorized' }, { status: 403 });
    }

    // Validate agency if provided
    if (linkedAgencyId) {
      const { data: agency, error: agencyError } = await supabase
        .from('agencies')
        .select('id, status, created_by')
        .eq('id', linkedAgencyId)
        .single();

      if (agencyError || !agency) {
        return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
      }

      // Can only link to approved agencies or own agencies
      if (agency.status !== 'approved' && agency.created_by !== user.id) {
        return NextResponse.json({ 
          error: 'Can only link to approved agencies or your own agency' 
        }, { status: 400 });
      }
    }

    // Update listing
    const { data: updatedListing, error: updateError } = await supabase
      .from('listings')
      .update({ 
        linked_agency_id: linkedAgencyId || null,
        updated_at: new Date().toISOString() 
      })
      .eq('id', listingId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating listing agency link:', updateError);
      return NextResponse.json(
        { error: 'Failed to update agency link' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      data: updatedListing,
      message: linkedAgencyId ? 'Agency linked successfully' : 'Agency link removed successfully'
    });
  } catch (error) {
    console.error('Error in listing agency link route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}