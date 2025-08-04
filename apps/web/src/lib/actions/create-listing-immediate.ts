// =====================================================
// Server Action: Immediate Listing Creation - Epic 1, Story 1.1
// Server action for creating listings immediately after Step 1
// =====================================================

'use server';

import { getCurrentUser } from '@/lib/auth';
import type { CompanyInfoData } from '@/types/wizard';

export async function createListingImmediate(rawData: any): Promise<{ success: boolean; listingId?: string; error?: string }> {
  console.log('createListingImmediate called with raw data keys:', Object.keys(rawData));
  
  // Sanitize the data to remove File objects and other non-serializable items
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
      headshotUrl: rawData.primaryContact.headshotUrl
    } : undefined,
    clearbitLogo: rawData.clearbitLogo,
    companyDomain: rawData.companyDomain,
    logoUrl: rawData.logoUrl,
    propertyPageLink: rawData.propertyPageLink,
    // Handle brochure files - only URLs, not File objects
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
    brochureFilesCount: data.brochureFiles?.length || 0
  });
  
  try {
    // Get current user for server action
    const currentUser = await getCurrentUser();
    
    if (!currentUser || (currentUser.role !== 'occupier' && currentUser.role !== 'admin')) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get reference data
    const { getSectors, getUseClasses } = await import('@/lib/listings');
    
    let sectorId, useClassId;
    try {
      const sectors = await getSectors();
      const useClasses = await getUseClasses();
      
      // Use first available sector and use class as defaults
      sectorId = sectors[0]?.id;
      useClassId = useClasses[0]?.id;
    } catch (error) {
      console.error('Failed to fetch reference data:', error);
      return { success: false, error: 'Database not set up properly. Please run the SQL setup script first.' };
    }

    if (!sectorId || !useClassId) {
      return { success: false, error: 'No sectors or use classes available. Please run the SQL setup script first.' };
    }

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
      // Property page link
      property_page_link: data.propertyPageLink,
      // Default values for required fields
      sector_id: sectorId,
      use_class_id: useClassId,
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

    // Create initial version record
    const versionData = {
      listing_id: listing.id,
      content: {
        ...listingData,
        id: listing.id,
        created_at: listing.created_at,
        primaryContact: data.primaryContact
      },
      status: 'draft',
      created_by: currentUser.id
    };

    const { data: version, error: versionError } = await supabase
      .from('listing_versions')
      .insert([versionData])
      .select()
      .single();

    if (versionError) {
      console.error('Error creating version:', versionError);
      // Continue anyway - version management is secondary
    } else {
      // Update listing to reference this version
      await supabase
        .from('listings')
        .update({ 
          current_version_id: version.id,
          live_version_id: null // No live version yet
        })
        .eq('id', listing.id);
    }

    // Store primary contact in listing_contacts table
    if (data.primaryContact) {
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

    // Store uploaded logo file if any (not Clearbit)
    if (data.logoUrl && !data.clearbitLogo) {
      console.log('Storing uploaded logo in file_uploads table:', data.logoUrl);
      
      const logoFileData = {
        user_id: currentUser.id,
        listing_id: listing.id,
        file_path: data.logoUrl.includes('/storage/v1/object/public/') 
          ? data.logoUrl.split('/storage/v1/object/public/logos/')[1] 
          : data.logoUrl,
        file_name: 'company-logo.png', // Default name for uploaded logos
        file_size: 0, // Size not available in immediate creation
        file_type: 'logo',
        mime_type: 'image/png',
        bucket_name: 'logos',
        display_order: 0,
        is_primary: true
      };

      const { error: logoError } = await supabase
        .from('file_uploads')
        .insert([logoFileData]);

      if (logoError) {
        console.error('Error storing logo file reference:', logoError);
        // Continue anyway - logo storage is optional
      } else {
        console.log('Successfully stored logo file reference');
      }
    }

    // Store brochure files if any
    if (data.brochureFiles && data.brochureFiles.length > 0) {
      const fileInserts = data.brochureFiles.map((file: any, index: number) => ({
        user_id: currentUser.id,
        listing_id: listing.id,
        file_path: file.path || file.url,
        file_name: file.name,
        file_size: file.size || 0,
        file_type: 'brochure',
        mime_type: file.mimeType || 'application/pdf',
        bucket_name: 'brochures',
        display_order: index,
        is_primary: index === 0
      }));

      const { error: filesError } = await supabase
        .from('file_uploads')
        .insert(fileInserts);

      if (filesError) {
        console.error('Error storing file references:', filesError);
        // Continue anyway - files are optional
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