import { browserClient } from '@/lib/supabase'
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
  
  const supabase = browserClient
  
  try {
    // 1. Check if user already has an organization
    const userOrgInfo = await organizationService.getUserOrganizationInfo(userId)
    
    let orgId = userOrgInfo.organizationId
    let organizationCreated = false

    // 2. Create organization if user doesn't have one
    if (!userOrgInfo.hasOrganization) {
      const orgResult = await organizationService.createOrganizationFromCompanyInfo({
        name: listingData.companyName,
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

    // 3. Create listing with organization
    const listingId = await createActualListing(listingData, orgId!, userId)

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
 * Create actual listing with integrated database services
 */
async function createActualListing(
  listingData: CreateListingWithOrgData, 
  orgId: string, 
  userId: string
): Promise<string> {
  // Import listing services
  const { createListing, getSectors, getUseClasses } = await import('@/lib/listings');
  
  try {
    // Get reference data for mapping
    const [sectors, useClasses] = await Promise.all([
      getSectors(),
      getUseClasses()
    ]);

    // Handle sectors array (use first one if multiple, or create a default)
    let sectorId: string;
    if (listingData.sectors && listingData.sectors.length > 0) {
      const sector = sectors.find(s => s.name === listingData.sectors![0]);
      if (!sector) {
        throw new Error(`Invalid sector: ${listingData.sectors![0]}`);
      }
      sectorId = sector.id;
    } else {
      // Default to 'other' if no sectors specified
      const defaultSector = sectors.find(s => s.name === 'other');
      if (!defaultSector) {
        throw new Error('No sectors specified and default sector not found');
      }
      sectorId = defaultSector.id;
    }

    // Handle use class IDs array (use first one if multiple, or create a default)
    let useClassId: string;
    if (listingData.useClassIds && listingData.useClassIds.length > 0) {
      const useClass = useClasses.find(uc => uc.id === listingData.useClassIds![0]);
      if (!useClass) {
        throw new Error(`Invalid use class ID: ${listingData.useClassIds![0]}`);
      }
      useClassId = listingData.useClassIds[0];
    } else {
      // Use first available use class as default
      if (useClasses.length === 0) {
        throw new Error('No use classes specified and no default available');
      }
      useClassId = useClasses[0].id;
    }

    // Generate a title from company name and requirements
    const title = `${listingData.companyName} - Property Requirement`;
    const description = `Property requirement for ${listingData.companyName}`;

    // Prepare listing creation data
    const createListingRequest = {
      title,
      description,
      company_name: listingData.companyName,
      sector_id: sectorId,
      use_class_id: useClassId,
      site_size_min: listingData.siteSizeMin,
      site_size_max: listingData.siteSizeMax,
      contact_name: listingData.contactName,
      contact_title: listingData.contactTitle,
      contact_email: listingData.contactEmail,
      contact_phone: listingData.contactPhone,
      // Handle company logo if provided
      company_logos: listingData.logoFile ? [{
        file_url: '', // Will be handled by file upload service
        file_name: listingData.logoFile.name,
        file_size: listingData.logoFile.size
      }] : []
    };

    // Create the listing
    const listing = await createListing(createListingRequest, userId, orgId);
    
    console.log('Successfully created listing with auto-organization:', {
      listingId: listing.id,
      orgId,
      userId,
      companyName: listingData.companyName
    });
    
    return listing.id;
  } catch (error) {
    console.error('Error creating listing:', error);
    throw error;
  }
}

/**
 * Helper function to get or create organization for a user
 * Useful for other parts of the application that need organization info
 */
export async function getOrCreateOrganizationForUser(
  userId: string,
  companyName: string
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