'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase'

/**
 * Update the verification date for a listing
 * Only admins can verify listings
 */
export async function updateListingVerificationDate(
  listingId: string,
  verifiedAt: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser || currentUser.role !== 'admin') {
      return { success: false, error: 'Admin access required' }
    }

    const supabase = createServerClient()

    const { error } = await supabase
      .from('listings')
      .update({ verified_at: verifiedAt })
      .eq('id', listingId)

    if (error) {
      console.error('Error updating verification date:', error)
      return { success: false, error: 'Failed to update verification date' }
    }

    // Revalidate all relevant pages
    revalidatePath('/admin/listings/all')
    revalidatePath('/admin/listings/review')
    revalidatePath('/search')
    revalidatePath('/')

    return { success: true }
  } catch (error) {
    console.error('Error in updateListingVerificationDate:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update verification date'
    }
  }
}

/**
 * Mark a listing as verified today
 * Convenience action for quick verification
 */
export async function markListingVerifiedToday(
  listingId: string
): Promise<{ success: boolean; error?: string }> {
  const today = new Date().toISOString()
  return updateListingVerificationDate(listingId, today)
}
