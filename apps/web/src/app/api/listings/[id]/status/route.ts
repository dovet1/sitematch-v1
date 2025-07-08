// =====================================================
// Listing Status API Route Handler - Story 3.0
// Admin-only status management operations
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { updateListingStatus } from '@/lib/listings';
import { createAdminClient } from '@/lib/supabase';
import type {
  UpdateListingStatusRequest,
  ListingStatus,
  ApiResponse
} from '@/types/listings';

// =====================================================
// PATCH /api/listings/[id]/status - Update listing status (Admin only)
// =====================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only admins can update listing status
    if (user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const listingId = params.id;

    // Validate UUID format
    if (!isValidUUID(listingId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid listing ID format' },
        { status: 400 }
      );
    }

    // Check if listing exists (simple query without joins)
    const adminClient = createAdminClient();
    const { data: existingListing, error: fetchError } = await adminClient
      .from('listings')
      .select('id, status')
      .eq('id', listingId)
      .single();

    if (fetchError || !existingListing) {
      return NextResponse.json(
        { success: false, error: 'Listing not found' },
        { status: 404 }
      );
    }

    // Parse request body
    let statusUpdate: UpdateListingStatusRequest;
    try {
      statusUpdate = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses: ListingStatus[] = ['draft', 'pending', 'approved', 'rejected', 'archived'];
    if (!validStatuses.includes(statusUpdate.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        },
        { status: 400 }
      );
    }

    // Validate status transition
    const validTransition = isValidStatusTransition(existingListing.status, statusUpdate.status);
    if (!validTransition.isValid) {
      return NextResponse.json(
        { success: false, error: validTransition.reason },
        { status: 400 }
      );
    }

    // Note: Rejection reason validation disabled until rejection_reason field is added to schema
    // TODO: Re-enable when rejection_reason field exists in database
    // if (statusUpdate.status === 'rejected' && !statusUpdate.reason) {
    //   return NextResponse.json(
    //     { success: false, error: 'Reason is required when rejecting a listing' },
    //     { status: 400 }
    //   );
    // }

    // Update the listing status using admin client
    const { data: updatedListing, error: updateError } = await adminClient
      .from('listings')
      .update({
        status: statusUpdate.status,
        updated_at: new Date().toISOString()
        // Note: rejection_reason field doesn't exist in current schema
        // TODO: Add rejection_reason field in future migration
      })
      .eq('id', listingId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { success: false, error: `Failed to update listing: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Log the status change for audit trail
    console.log(`Listing status updated: ${listingId} from '${existingListing.status}' to '${statusUpdate.status}' by admin ${user.id}${statusUpdate.reason ? ` (reason: ${statusUpdate.reason})` : ''}`);

    // TODO: Send notification to listing owner about status change
    // This would be implemented in a future story for notifications

    return NextResponse.json({
      success: true,
      data: updatedListing,
      message: `Listing status updated to ${statusUpdate.status}`
    });

  } catch (error) {
    console.error(`PATCH /api/listings/${params.id}/status error:`, error);
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
// BUSINESS LOGIC FUNCTIONS
// =====================================================

interface StatusTransitionResult {
  isValid: boolean;
  reason?: string;
}

/**
 * Validate status transition rules
 */
function isValidStatusTransition(
  currentStatus: ListingStatus,
  newStatus: ListingStatus
): StatusTransitionResult {
  
  // Same status is always valid (no-op)
  if (currentStatus === newStatus) {
    return { isValid: true };
  }

  // Define valid transitions
  const validTransitions: Record<ListingStatus, ListingStatus[]> = {
    draft: ['pending', 'rejected'], // Draft can go to pending or be rejected
    pending: ['approved', 'rejected', 'draft', 'archived'], // Pending can be approved, rejected, sent back to draft, or archived
    approved: ['rejected', 'archived'], // Approved can be rejected (emergency) or archived
    rejected: ['pending', 'draft', 'archived'], // Rejected can be resubmitted as pending, draft, or archived
    archived: ['pending', 'draft'] // Archived can be reactivated to pending or draft
  };

  const allowedTransitions = validTransitions[currentStatus];
  
  if (!allowedTransitions.includes(newStatus)) {
    return {
      isValid: false,
      reason: `Cannot transition from '${currentStatus}' to '${newStatus}'. Valid transitions: ${allowedTransitions.join(', ')}`
    };
  }

  return { isValid: true };
}

/**
 * Get human-readable status change message
 */
function getStatusChangeMessage(oldStatus: ListingStatus, newStatus: ListingStatus): string {
  const messages: Record<string, string> = {
    'draft->pending': 'Listing submitted for review',
    'pending->approved': 'Listing approved and published',
    'pending->rejected': 'Listing rejected',
    'pending->draft': 'Listing returned to draft status',
    'approved->rejected': 'Listing removed from public directory',
    'rejected->pending': 'Listing resubmitted for review',
    'rejected->draft': 'Listing moved back to draft'
  };

  const key = `${oldStatus}->${newStatus}`;
  return messages[key] || `Status changed from ${oldStatus} to ${newStatus}`;
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}