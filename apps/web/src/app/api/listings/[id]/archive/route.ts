// =====================================================
// Listing Archive API Route Handler
// User-facing archive/unarchive operations
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import type { ListingStatus } from '@/types/listings';

export const dynamic = 'force-dynamic';

// =====================================================
// PATCH /api/listings/[id]/archive - Toggle archive status
// =====================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const listingId = (await params).id;

    // Validate UUID format
    if (!isValidUUID(listingId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid listing ID format' },
        { status: 400 }
      );
    }

    // Create Supabase client with user session
    const supabase = await createServerClient();

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get the listing and verify ownership
    const { data: existingListing, error: fetchError } = await supabase
      .from('listings')
      .select('id, status, created_by')
      .eq('id', listingId)
      .single();

    if (fetchError || !existingListing) {
      console.error('Error fetching listing:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Listing not found' },
        { status: 404 }
      );
    }

    // Verify user owns the listing
    if (existingListing.created_by !== user.id) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to modify this listing' },
        { status: 403 }
      );
    }

    // Parse request body to determine action
    let body: any;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const isArchiving = body.archive !== false; // Default to archiving if not specified

    let newStatus: ListingStatus;
    let updateData: any;

    if (isArchiving) {
      // Archive the listing
      if (existingListing.status === 'archived') {
        return NextResponse.json(
          { success: false, error: 'Listing is already archived' },
          { status: 400 }
        );
      }

      newStatus = 'archived';
      updateData = {
        status: 'archived',
        updated_at: new Date().toISOString()
      };

      console.log(`Archiving listing ${listingId}: ${existingListing.status} → archived`);
    } else {
      // Unarchive the listing
      if (existingListing.status !== 'archived') {
        return NextResponse.json(
          { success: false, error: 'Listing is not archived' },
          { status: 400 }
        );
      }

      // Always restore to 'draft' status when unarchiving
      // User can then resubmit if they want it to be pending/approved
      newStatus = 'draft';

      updateData = {
        status: 'draft',
        updated_at: new Date().toISOString()
      };

      console.log(`Unarchiving listing ${listingId}: archived → draft`);
    }

    // Update the listing
    const { data: updatedListing, error: updateError } = await supabase
      .from('listings')
      .update(updateData)
      .eq('id', listingId)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json(
        { success: false, error: `Failed to update listing: ${updateError.message}` },
        { status: 500 }
      );
    }

    const action = isArchiving ? 'archived' : 'unarchived';
    console.log(`✅ Listing ${listingId} ${action} by user ${user.id}`);

    return NextResponse.json({
      success: true,
      data: updatedListing,
      message: `Listing ${action} successfully`
    });

  } catch (error) {
    console.error(`PATCH /api/listings/${(await params).id}/archive error:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}
