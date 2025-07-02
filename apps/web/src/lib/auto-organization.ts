import { createClient, createAdminClient } from '@/lib/supabase'
import { organizationService } from '@/lib/organization-service'
import { 
  CreateListingWithOrgData, 
  CreateListingResult 
} from '@/types/organization'

/**
 * Creates a listing with automatic organization creation if needed
 * This is the main integration point for the listing wizard
 */
export async function createListingWithAutoOrganization(
  listingData: CreateListingWithOrgData,
  userId: string
): Promise<CreateListingResult> {
  
  const adminClient = createAdminClient()
  
  try {
    // 1. Check if user already has an organization
    const userOrgInfo = await organizationService.getUserOrganizationInfo(userId)
    
    let orgId = userOrgInfo.organizationId
    let organizationCreated = false

    // 2. Create organization if user doesn't have one
    if (!userOrgInfo.hasOrganization) {
      const orgResult = await organizationService.createOrganizationFromCompanyInfo({
        name: listingData.companyName,
        description: listingData.companyDescription,
        type: 'occupier',
        createdByUserId: userId
      })

      if (!orgResult.success) {
        return {
          success: false,
          error: `Organization creation failed: ${orgResult.error}`,
        }
      }

      orgId = orgResult.organizationId!
      organizationCreated = true
    }

    // 3. Create listing with organization - placeholder for now
    // This will integrate with the actual listing creation logic from Story 3.0
    const listingId = await createPlaceholderListing(listingData, orgId!, userId)

    return {
      success: true,
      listingId,
      organizationId: orgId,
      organizationCreated
    }

  } catch (error) {
    console.error('Error in createListingWithAutoOrganization:', error)
    return {
      success: false,
      error: 'Unexpected error during listing creation with auto-organization'
    }
  }
}

/**
 * Placeholder listing creation - will be replaced with actual listing service
 * when integrating with Story 3.0 listing implementation
 */
async function createPlaceholderListing(
  listingData: CreateListingWithOrgData, 
  orgId: string, 
  userId: string
): Promise<string> {
  // This is a placeholder that simulates listing creation
  // In the actual implementation, this would call the listing service
  // from Story 3.0 to create the actual listing record
  
  console.log('Creating listing with auto-organization:', {
    orgId,
    userId,
    companyName: listingData.companyName
  })
  
  // Return placeholder listing ID
  return `listing_${Date.now()}_${orgId}`
}

/**
 * Helper function to get or create organization for a user
 * Useful for other parts of the application that need organization info
 */
export async function getOrCreateOrganizationForUser(
  userId: string,
  companyName: string,
  companyDescription?: string
): Promise<{ organizationId: string; organizationCreated: boolean; error?: string }> {
  
  try {
    // Check if user already has organization
    const userOrgInfo = await organizationService.getUserOrganizationInfo(userId)
    
    if (userOrgInfo.hasOrganization) {
      return {
        organizationId: userOrgInfo.organizationId!,
        organizationCreated: false
      }
    }

    // Create new organization
    const orgResult = await organizationService.createOrganizationFromCompanyInfo({
      name: companyName,
      description: companyDescription,
      type: 'occupier',
      createdByUserId: userId
    })

    if (!orgResult.success) {
      return {
        organizationId: '',
        organizationCreated: false,
        error: orgResult.error
      }
    }

    return {
      organizationId: orgResult.organizationId!,
      organizationCreated: true
    }

  } catch (error) {
    console.error('Error in getOrCreateOrganizationForUser:', error)
    return {
      organizationId: '',
      organizationCreated: false,
      error: 'Unexpected error during organization creation'
    }
  }
}