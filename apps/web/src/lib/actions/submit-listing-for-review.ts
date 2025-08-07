// =====================================================
// Server Action: Submit Listing for Review
// Creates comprehensive version snapshot when submitting for approval
// =====================================================

'use server';

import { getCurrentUser } from '@/lib/auth';
import { submitListingForReview } from '@/lib/version-management';
import { revalidatePath } from 'next/cache';

export async function submitListingForReviewAction(
  listingId: string
): Promise<{ success: boolean; versionId?: string; error?: string }> {
  try {
    // Check authentication and authorization
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return { success: false, error: 'Unauthorized' };
    }

    if (currentUser.role !== 'occupier' && currentUser.role !== 'admin') {
      return { success: false, error: 'Insufficient permissions' };
    }

    // Verify user owns this listing (for occupiers)
    if (currentUser.role === 'occupier') {
      const { createServerClient } = await import('@/lib/supabase');
      const supabase = createServerClient();
      
      const { data: listing, error: listingError } = await supabase
        .from('listings')
        .select('created_by')
        .eq('id', listingId)
        .single();

      if (listingError || !listing) {
        return { success: false, error: 'Listing not found' };
      }

      if (listing.created_by !== currentUser.id) {
        return { success: false, error: 'You can only submit your own listings for review' };
      }
    }

    console.log('About to call submitListingForReview for listing:', listingId);
    
    // Submit for review (creates comprehensive version snapshot)
    const result = await submitListingForReview(listingId, currentUser.id);
    
    console.log('submitListingForReview result:', result);

    if (result.success) {
      console.log('Submission successful, revalidating paths...');
      // Revalidate the listing page to show updated status
      revalidatePath(`/occupier/listing/${listingId}`);
      revalidatePath(`/admin/listings/${listingId}`);
      revalidatePath('/admin/listings');
    } else {
      console.error('Submission failed:', result.error);
    }

    return result;

  } catch (error) {
    console.error('Error in submitListingForReviewAction:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to submit for review' 
    };
  }
}

export async function approveListingAction(
  listingId: string, 
  versionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check authentication and authorization
    const currentUser = await getCurrentUser();
    
    if (!currentUser || currentUser.role !== 'admin') {
      return { success: false, error: 'Admin access required' };
    }

    const { createServerClient } = await import('@/lib/supabase');
    const supabase = createServerClient();

    // Update the version status to approved and set is_live flag
    const { error: versionError } = await supabase
      .from('listing_versions')
      .update({ 
        status: 'approved',
        reviewed_by: currentUser.id,
        reviewed_at: new Date().toISOString(),
        is_live: true
      })
      .eq('id', versionId);

    if (versionError) {
      return { success: false, error: `Failed to approve version: ${versionError.message}` };
    }

    // Update the listing to make this the live version
    const { error: listingError } = await supabase
      .from('listings')
      .update({ 
        live_version_id: versionId,
        status: 'approved',
        updated_at: new Date().toISOString()
      })
      .eq('id', listingId);

    if (listingError) {
      return { success: false, error: `Failed to update listing: ${listingError.message}` };
    }

    // Revalidate relevant pages
    revalidatePath(`/occupier/listing/${listingId}`);
    revalidatePath(`/admin/listings/${listingId}`);
    revalidatePath('/admin/listings');
    revalidatePath('/public/listings');

    return { success: true };

  } catch (error) {
    console.error('Error in approveListingAction:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to approve listing' 
    };
  }
}

export async function rejectListingAction(
  listingId: string, 
  versionId: string, 
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check authentication and authorization
    const currentUser = await getCurrentUser();
    
    if (!currentUser || currentUser.role !== 'admin') {
      return { success: false, error: 'Admin access required' };
    }

    const { createServerClient } = await import('@/lib/supabase');
    const supabase = createServerClient();

    // Update the version status to rejected
    const { error: versionError } = await supabase
      .from('listing_versions')
      .update({ 
        status: 'rejected',
        reviewed_by: currentUser.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: reason || null,
        is_live: false
      })
      .eq('id', versionId);

    if (versionError) {
      return { success: false, error: `Failed to reject version: ${versionError.message}` };
    }

    // Update the listing status back to draft
    const { error: listingError } = await supabase
      .from('listings')
      .update({ 
        status: 'draft'
      })
      .eq('id', listingId);

    if (listingError) {
      return { success: false, error: `Failed to update listing: ${listingError.message}` };
    }

    // Revalidate relevant pages
    revalidatePath(`/occupier/listing/${listingId}`);
    revalidatePath(`/admin/listings/${listingId}`);
    revalidatePath('/admin/listings');

    return { success: true };

  } catch (error) {
    console.error('Error in rejectListingAction:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to reject listing' 
    };
  }
}