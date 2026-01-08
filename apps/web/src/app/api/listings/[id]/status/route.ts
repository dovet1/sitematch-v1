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

export const dynamic = 'force-dynamic';

// =====================================================
// PATCH /api/listings/[id]/status - Update listing status (Admin only)
// =====================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    console.log('🔐 getCurrentUser result:', { user, hasUser: !!user, role: user?.role });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - No user found' },
        { status: 401 }
      );
    }

    // Only admins can update listing status
    if (user.role !== 'admin') {
      console.log('❌ Access denied - user role:', user.role, 'required: admin');
      return NextResponse.json(
        { success: false, error: `Admin access required. Current role: ${user.role}` },
        { status: 403 }
      );
    }

    console.log('✅ Admin access confirmed for user:', user.email);

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
      .single() as { data: { id: string; status: ListingStatus } | null; error: any };

    if (fetchError || !existingListing) {
      return NextResponse.json(
        { success: false, error: 'Listing not found' },
        { status: 404 }
      );
    }

    // Parse request body
    let statusUpdate: any;
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
    if (!validStatuses.includes(statusUpdate.status as ListingStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        },
        { status: 400 }
      );
    }

    // After validation, we can safely cast to the correct type
    const validatedStatusUpdate: UpdateListingStatusRequest = {
      status: statusUpdate.status as ListingStatus,
      reason: statusUpdate.reason
    };

    // Validate status transition
    const validTransition = isValidStatusTransition(existingListing.status, validatedStatusUpdate.status);
    if (!validTransition.isValid) {
      return NextResponse.json(
        { success: false, error: validTransition.reason },
        { status: 400 }
      );
    }

    // Validate rejection reason is provided when rejecting
    if (validatedStatusUpdate.status === 'rejected' && !validatedStatusUpdate.reason) {
      return NextResponse.json(
        { success: false, error: 'Reason is required when rejecting a listing' },
        { status: 400 }
      );
    }

    // Update the listing status using admin client
    const updateData: any = {
      status: validatedStatusUpdate.status,
      updated_at: new Date().toISOString()
    };

    // Add rejection reason if provided and status is rejected
    if (validatedStatusUpdate.status === 'rejected' && validatedStatusUpdate.reason) {
      updateData.rejection_reason = validatedStatusUpdate.reason;
    }

    // If approving, also set live_version_id to the latest approved version
    if (validatedStatusUpdate.status === 'approved') {
      // Find the latest approved version
      const versionResult = await adminClient
        .from('listing_versions')
        .select('id')
        .eq('listing_id', listingId)
        .eq('status', 'approved')
        .order('version_number', { ascending: false })
        .limit(1)
        .single();

      if (!versionResult.error && versionResult.data) {
        const latestVersion = versionResult.data as { id: string };
        updateData.live_version_id = latestVersion.id;
        updateData.current_version_id = latestVersion.id;

        // Mark this version as live
        await adminClient
          .from('listing_versions')
          .update({ is_live: true })
          .eq('id', latestVersion.id);

        // Mark all other versions as not live
        await adminClient
          .from('listing_versions')
          .update({ is_live: false })
          .eq('listing_id', listingId)
          .neq('id', latestVersion.id);
      }
    }

    const { data: updatedListing, error: updateError } = await (adminClient
      .from('listings') as any)
      .update(updateData)
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
    console.log(`Listing status updated: ${listingId} from '${existingListing.status}' to '${validatedStatusUpdate.status}' by admin ${user.id}${validatedStatusUpdate.reason ? ` (reason: ${validatedStatusUpdate.reason})` : ''}`);

    // Send email notifications based on status change
    try {
      await sendStatusChangeNotification(updatedListing, validatedStatusUpdate, existingListing.status);
    } catch (emailError) {
      // Log email error but don't fail the status update
      console.error('Email notification failed:', emailError);
    }

    return NextResponse.json({
      success: true,
      data: updatedListing,
      message: `Listing status updated to ${validatedStatusUpdate.status}`
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

/**
 * Send email notification based on status change
 */
async function sendStatusChangeNotification(
  listing: any,
  statusUpdate: UpdateListingStatusRequest,
  previousStatus: ListingStatus
) {
  console.log(`📧 Email notification check: status=${statusUpdate.status}, previousStatus=${previousStatus}, hasEmail=${!!listing.contact_email}`);
  
  try {
    // Only send emails for meaningful status changes
    if (statusUpdate.status === 'rejected') {
      console.log(`📧 Sending rejection email to ${listing.contact_email}`);
      await sendRejectionNotification(listing, statusUpdate.reason || 'No reason provided');
    } else if (statusUpdate.status === 'approved' && previousStatus === 'pending') {
      console.log(`📧 Sending approval email to ${listing.contact_email}`);
      await sendApprovalNotification(listing);
    } else {
      console.log(`📧 No email needed for status change: ${previousStatus} → ${statusUpdate.status}`);
    }
  } catch (error) {
    // Log error but don't fail the status update
    console.error('Failed to send status change notification:', error);
    throw error; // Re-throw so we can see the error in the parent catch
  }
}

/**
 * Send rejection email to listing owner
 */
async function sendRejectionNotification(listing: any, reason: string) {
  const { sendRejectionEmail } = await import('@/lib/email-templates');
  
  // Map reason string to rejection reason type
  const rejectionReasonMap: Record<string, any> = {
    'incomplete_company_info': 'incomplete_company_info',
    'missing_contact_details': 'missing_contact_details', 
    'unclear_requirements': 'unclear_requirements',
    'invalid_brochure': 'invalid_brochure',
    'duplicate_listing': 'duplicate_listing',
    'requirements_too_vague': 'requirements_too_vague',
    'suspected_spam': 'suspected_spam',
    'other': 'other'
  };

  const rejectionReason = rejectionReasonMap[reason] || 'other';
  const customReason = rejectionReasonMap[reason] ? undefined : reason;

  const emailData = {
    contactName: listing.contact_name,
    contactEmail: listing.contact_email,
    companyName: listing.company_name || 'Your Company',
    rejectionReason,
    customReason,
    listingEditUrl: `${process.env.NEXT_PUBLIC_APP_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://app.sitematch.com')}/occupier/create-listing?edit=${listing.id}`,
    listingTitle: listing.title || `Property Requirement for ${listing.company_name}`
  };

  console.log(`📧 Sending rejection email with data:`, emailData);
  const emailResult = await sendRejectionEmail(emailData);
  console.log(`📧 Rejection email result:`, emailResult);
  
  if (emailResult.success) {
    console.log(`✅ Rejection email sent successfully to ${listing.contact_email} for listing ${listing.id}`);
  } else {
    console.error(`❌ Rejection email failed: ${emailResult.error}`);
  }
}

/**
 * Send approval email to listing owner
 */
async function sendApprovalNotification(listing: any) {
  const { sendApprovalEmail } = await import('@/lib/email-templates');
  
  const emailData = {
    contactName: listing.contact_name,
    contactEmail: listing.contact_email,
    companyName: listing.company_name || 'Your Company',
    listingTitle: listing.title || `Property Requirement for ${listing.company_name}`,
    publicListingUrl: `${process.env.NEXT_PUBLIC_APP_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://app.sitematch.com')}/listings/${listing.id}`
  };

  console.log(`📧 Sending approval email with data:`, emailData);
  const emailResult = await sendApprovalEmail(emailData);
  console.log(`📧 Approval email result:`, emailResult);
  
  if (emailResult.success) {
    console.log(`✅ Approval email sent successfully to ${listing.contact_email} for listing ${listing.id}`);
  } else {
    console.error(`❌ Approval email failed: ${emailResult.error}`);
  }
}