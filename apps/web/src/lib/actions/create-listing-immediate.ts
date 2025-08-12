// =====================================================
// Server Action: Immediate Listing Creation - Epic 1, Story 1.1
// Server action for creating listings immediately after Step 1
// =====================================================

'use server';

import { getCurrentUser } from '@/lib/auth';
import type { CompanyInfoData } from '@/types/wizard';
import { createListingVersion } from '@/lib/version-management';

export async function createListingImmediate(rawData: any): Promise<{ success: boolean; listingId?: string; error?: string }> {
  console.log('createListingImmediate called with raw data keys:', Object.keys(rawData));
  
  // Sanitize the data to preserve file metadata but remove File objects
  const data = {
    companyName: rawData.companyName,
    listingType: rawData.listingType,
    primaryContact: rawData.primaryContact ? {
      contactName: rawData.primaryContact.contactName,
      contactTitle: rawData.primaryContact.contactTitle,  
      contactEmail: rawData.primaryContact.contactEmail,
      contactPhone: rawData.primaryContact.contactPhone,
      contactArea: rawData.primaryContact.contactArea,
      isPrimaryContact: rawData.primaryContact.isPrimaryContact,
      headshotUrl: rawData.primaryContact.headshotUrl,
      headshotFile: rawData.primaryContact.headshotFile
    } : undefined,
    clearbitLogo: rawData.clearbitLogo,
    companyDomain: rawData.companyDomain,
    logoUrl: rawData.logoUrl,
    logoFile: rawData.logoFile,
    propertyPageLink: rawData.propertyPageLink,
    // Handle brochure files - preserve all metadata
    brochureFiles: rawData.brochureFiles?.map((file: any) => ({
      name: file.name,
      url: file.url,
      path: file.path,
      size: file.size,
      mimeType: file.mimeType
    })).filter((file: any) => file.url || file.path) || []
  };
  
  console.log('Sanitized data:', { 
    companyName: data.companyName,
    listingType: data.listingType,
    contactName: data.primaryContact?.contactName,
    brochureFilesCount: data.brochureFiles?.length || 0,
    headshotUrl: data.primaryContact?.headshotUrl,
    headshotFile: data.primaryContact?.headshotFile
  });
  
  try {
    // Get current user for server action
    const currentUser = await getCurrentUser();
    
    if (!currentUser || (currentUser.role !== 'occupier' && currentUser.role !== 'admin')) {
      return { success: false, error: 'Unauthorized' };
    }

    // Note: We no longer assign default sectors/use_classes at creation time
    // These will be set when users complete the requirements section of the listing

    // Create listing with version management
    const { createServerClient } = await import('@/lib/supabase');
    const supabase = createServerClient();

    // Create the main listing record
    const listingData = {
      title: `Property Requirement - ${data.companyName || 'Company'}`,
      description: `Property requirement from ${data.companyName || 'company'}`,
      company_name: data.companyName || 'Company Name Required',
      listing_type: data.listingType || 'commercial',
      status: 'draft',
      contact_name: data.primaryContact?.contactName || 'Contact Name',
      contact_title: data.primaryContact?.contactTitle || 'Contact Title',
      contact_email: data.primaryContact?.contactEmail || currentUser.email || 'contact@example.com',
      contact_phone: data.primaryContact?.contactPhone,
      contact_area: data.primaryContact?.contactArea,
      // Logo fields - store company domain for Clearbit logos
      clearbit_logo: data.clearbitLogo || false,
      company_domain: data.companyDomain,
      // Property page link - ensure null instead of empty string
      property_page_link: data.propertyPageLink?.trim() || null,
      // User and completion tracking
      created_by: currentUser.id,
      completion_percentage: 20, // 20% complete after Step 1
      last_edited_at: new Date().toISOString()
    };

    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .insert([listingData])
      .select()
      .single();

    if (listingError) {
      console.error('Error creating listing:', listingError);
      return { success: false, error: 'Failed to create listing: ' + listingError.message };
    }

    console.log('Listing created successfully:', listing.id);

    // Create initial version record with comprehensive snapshot
    const versionResult = await createListingVersion(listing.id, 'draft', currentUser.id, supabase);
    
    if (!versionResult.success) {
      console.error('Error creating version:', versionResult.error);
      // Continue anyway - version management is secondary
    }

    // Store primary contact in listing_contacts table
    if (data.primaryContact) {
      console.log('Creating contact with data:', {
        contactName: data.primaryContact.contactName,
        headshotUrl: data.primaryContact.headshotUrl,
        headshotType: typeof data.primaryContact.headshotUrl
      });
      
      const contactData = {
        listing_id: listing.id,
        contact_name: data.primaryContact.contactName || '',
        contact_title: data.primaryContact.contactTitle || '',
        contact_email: data.primaryContact.contactEmail || currentUser.email || '',
        contact_phone: data.primaryContact.contactPhone,
        contact_area: data.primaryContact.contactArea,
        is_primary_contact: true,
        headshot_url: data.primaryContact.headshotUrl
      };

      const { error: contactError } = await supabase
        .from('listing_contacts')
        .insert([contactData]);

      if (contactError) {
        console.error('Error creating contact:', contactError);
        // Continue anyway - contact info is in main listing table too
      }
    }

    // Insert uploaded files into file_uploads table with listing_id
    const filesToInsert = [];

    // Add uploaded logo file if any (not Clearbit)
    if (data.logoUrl && !data.clearbitLogo && data.logoFile && (data.logoFile as any).tempPath) {
      console.log('Adding uploaded logo to file_uploads table:', data.logoUrl);
      const logoFile = data.logoFile as any;
      
      filesToInsert.push({
        user_id: currentUser.id,
        listing_id: listing.id,
        file_path: logoFile.tempPath,
        file_name: logoFile.name || 'company-logo.png',
        file_size: logoFile.size || 0,
        file_type: 'logo',
        mime_type: logoFile.type || 'image/png',
        bucket_name: 'logos',
        display_order: 0,
        is_primary: true
      });
    }

    // Add brochure files with listing_id
    if (data.brochureFiles && data.brochureFiles.length > 0) {
      console.log('Adding brochure files to file_uploads table:', data.brochureFiles.length, 'files');
      
      data.brochureFiles.forEach((file: any, index: number) => {
        if (file.path && file.name) {
          filesToInsert.push({
            user_id: currentUser.id,
            listing_id: listing.id,
            file_path: file.path,
            file_name: file.name,
            file_size: file.size || 0,
            file_type: 'brochure',
            mime_type: file.mimeType || 'application/pdf',
            bucket_name: 'brochures',
            display_order: index,
            is_primary: index === 0
          });
        }
      });
    }
    
    // Add headshot file with listing_id
    console.log('Headshot check:', {
      hasHeadshotUrl: !!data.primaryContact?.headshotUrl,
      hasHeadshotFile: !!data.primaryContact?.headshotFile,
      headshotFileType: typeof data.primaryContact?.headshotFile,
      hasTempPath: !!(data.primaryContact?.headshotFile as any)?.tempPath
    });
    
    if (data.primaryContact?.headshotUrl && data.primaryContact?.headshotFile && (data.primaryContact.headshotFile as any).tempPath) {
      console.log('Adding headshot to file_uploads table:', data.primaryContact.headshotUrl);
      const headshotFile = data.primaryContact.headshotFile as any;
      
      filesToInsert.push({
        user_id: currentUser.id,
        listing_id: listing.id,
        file_path: headshotFile.tempPath,
        file_name: headshotFile.name || 'headshot.jpg',
        file_size: headshotFile.size || 0,
        file_type: 'headshot',
        mime_type: headshotFile.type || 'image/jpeg',
        bucket_name: 'headshots',
        display_order: 0,
        is_primary: true
      });
    }

    // Insert all files at once with listing_id
    if (filesToInsert.length > 0) {
      console.log('Inserting', filesToInsert.length, 'files with listing_id:', listing.id);
      
      const { error: filesError } = await supabase
        .from('file_uploads')
        .insert(filesToInsert);

      if (filesError) {
        console.error('Error inserting files:', filesError);
        // Continue anyway - file storage is optional
      } else {
        console.log('Successfully inserted all files with listing_id');
      }
    }

    return { 
      success: true, 
      listingId: listing.id 
    };
  } catch (error) {
    console.error('Failed to create listing:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create listing' 
    };
  }
}