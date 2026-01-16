// =====================================================
// Create Listing Page - Story 3.1
// Protected route for occupiers to create listings
// =====================================================

// Helper function to extract storage path from full Supabase URL
function extractStoragePath(url: string): string {
  // Extract path after /storage/v1/object/public/{bucket}/
  const match = url.match(/\/storage\/v1\/object\/public\/[^\/]+\/(.+)$/);
  return match ? match[1] : url;
}

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Toaster } from 'sonner';
import { getCurrentUser } from '@/lib/auth';
import { ListingWizard } from '@/components/listings/listing-wizard';
import { createListing } from '@/lib/listings';
import { ErrorBoundary } from '@/components/error-boundary';
import type { WizardFormData, SubmissionResult } from '@/types/wizard';
import type { CreateListingRequest } from '@/types/listings';

export const dynamic = 'force-dynamic';

// =====================================================
// PAGE COMPONENT
// =====================================================

export default async function CreateListingPage({
  searchParams
}: {
  searchParams: Promise<{ edit?: string; fresh?: string }>
}) {
  const params = await searchParams

  // Check authentication and authorization
  const user = await getCurrentUser();

  if (!user) {
    redirect('/?login=1&redirect=/occupier/create-listing');
  }

  if (user.role !== 'occupier' && user.role !== 'admin') {
    redirect('/unauthorized');
  }

  // Get edit listing ID from URL parameters
  const editListingId = params.edit;
  const startFresh = params.fresh === 'true';

  // Organization requirements removed - listings are now independent

  // =====================================================
  // SUBMISSION HANDLER
  // =====================================================

  async function handleSubmit(data: WizardFormData): Promise<SubmissionResult> {
    'use server';
    
    console.log('handleSubmit called with data:', { 
      companyName: data.companyName, 
      existingListingId: data.existingListingId,
      editListingId,
      sectors: data.sectors,
      useClassIds: data.useClassIds,
      sectorsType: typeof data.sectors?.[0],
      useClassIdsType: typeof data.useClassIds?.[0]
    });
    
    try {
      
      // Get current user for server action
      const currentUser = await getCurrentUser();
      
      if (!currentUser || (currentUser.role !== 'occupier' && currentUser.role !== 'admin')) {
        return { success: false, error: 'Unauthorized' };
      }

      // Use the enhanced listing function that handles contacts and files
      const { createEnhancedListing } = await import('@/lib/enhanced-listings');
      const { finalizeDraftListing } = await import('@/lib/draft-listings');
      
      // Organization creation is no longer needed - using user-based access control

      // Use real database now that tables are set up
      const { getSectors, getUseClasses } = await import('@/lib/listings');
      
      let sectorId, useClassId;
      try {
        const sectors = await getSectors();
        const useClasses = await getUseClasses();
        
        // Use first available sector and use class
        sectorId = sectors[0]?.id;
        useClassId = useClasses[0]?.id;
        
        
      } catch (error) {
        console.error('Failed to fetch reference data:', error);
        return { success: false, error: 'Database not set up properly. Please run the SQL setup script first.' };
      }

      if (!sectorId || !useClassId) {
        return { success: false, error: 'No sectors or use classes available. Please run the SQL setup script first.' };
      }

      // Create enhanced listing data that includes all related data
      console.log('🔍 DEBUG: Property page link in create:', data.propertyPageLink);
      const enhancedListingData = {
        title: `Property Requirement - ${data.companyName || 'Company'}`,
        description: `Property requirement from ${data.companyName || 'company'}`,
        sector_id: sectorId,
        use_class_id: useClassId,
        site_size_min: data.siteSizeMin,
        site_size_max: data.siteSizeMax,
        // Contact fields from primary contact
        contact_name: data.primaryContact?.contactName || 'Contact Name',
        contact_title: data.primaryContact?.contactTitle || 'Contact Title', 
        contact_email: data.primaryContact?.contactEmail || currentUser.email || 'contact@example.com',
        contact_phone: data.primaryContact?.contactPhone,
        contact_area: data.primaryContact?.contactArea,
        // Additional data for enhanced listing
        company_name: data.companyName || 'Company Name Required',
        listing_type: data.listingType || 'commercial',
        // Only store logo_url for uploaded logos, not Clearbit logos
        logo_url: data.clearbitLogo ? null : data.logoUrl,
        // Logo method fields - Story 9.0
        clearbit_logo: data.clearbitLogo || false,
        company_domain: data.companyDomain,
        // Property page link field
        property_page_link: data.propertyPageLink,
        // Residential fields
        dwelling_count_min: data.dwellingCountMin,
        dwelling_count_max: data.dwellingCountMax,
        site_acreage_min: data.siteAcreageMin,
        site_acreage_max: data.siteAcreageMax,
        is_nationwide: data.locationSearchNationwide || false,
        locations: data.locationSearchNationwide ? [] : (data.locations || []),
        // Include sectors and use_class_ids for junction table population
        sectors: data.sectors || [],
        use_class_ids: data.useClassIds || [],
        faqs: data.faqs?.map(faq => ({
          question: faq.question,
          answer: faq.answer,
          display_order: faq.displayOrder
        })) || [],
        additional_contacts: data.additionalContacts?.map(contact => ({
          contact_name: contact.contactName || '',
          contact_title: contact.contactTitle || '',
          contact_email: contact.contactEmail || '',
          contact_phone: contact.contactPhone,
          contact_area: contact.contactArea,
          headshot_url: contact.headshotUrl
        })) || [],
        brochure_urls: data.brochureFiles?.map(f => f.url).filter(Boolean) || [],
        photo_urls: data.photoFiles?.map(f => f.url).filter(Boolean) || [],
        video_urls: data.videoFiles?.map(f => f.url).filter(Boolean) || [],
        status: 'pending' as const
      };

      console.log('🔍 DEBUG: Enhanced listing data property_page_link:', enhancedListingData.property_page_link);

      // Check if we have an existing listing to update or draft to finalize
      if (data.existingListingId) {
        console.log('Have existingListingId:', data.existingListingId);
        console.log('editListingId from URL:', editListingId);
        
        // Distinguish between editing an existing listing vs finalizing a draft
        // If editListingId exists, we're editing an existing listing (not a draft)
        if (editListingId) {
          console.log('Entering update path for listing:', data.existingListingId);
          
          // Import update function
          const { updateListing } = await import('@/lib/listings');
          const { createServerClient } = await import('@/lib/supabase');
          const serverClient = await createServerClient();
          
          // Prepare sector and use class IDs for main table update
          let finalSectorId = sectorId;
          let finalUseClassId = useClassId;
          
          // If user selected sectors/use classes, validate they're UUIDs and use the first one for main table
          if (data.sectors && data.sectors.length > 0) {
            const firstSector = data.sectors[0];
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(firstSector);
            if (isUUID) {
              finalSectorId = firstSector;
            } else {
              console.warn('First sector is not a UUID, using fallback:', firstSector);
            }
          }
          
          if (data.useClassIds && data.useClassIds.length > 0) {
            const firstUseClass = data.useClassIds[0];
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(firstUseClass);
            if (isUUID) {
              finalUseClassId = firstUseClass;
            } else {
              console.warn('First use class is not a UUID, using fallback:', firstUseClass);
            }
          }
          
          console.log('Update data debug:', {
            originalSectors: data.sectors,
            originalUseClassIds: data.useClassIds,
            finalSectorId,
            finalUseClassId,
            fallbackSectorId: sectorId,
            fallbackUseClassId: useClassId
          });

          // Debug logo data
          console.log('🔍 DEBUG: Logo data in update:', {
            logoUrl: data.logoUrl,
            clearbitLogo: data.clearbitLogo,
            companyDomain: data.companyDomain,
            logoFile: data.logoFile?.name || 'none',
            logoMethod: data.logoMethod
          });

          // Debug property page link
          console.log('🔍 DEBUG: Property page link in update:', data.propertyPageLink);

          // Update the existing listing (with logo fields - Story 9.0)
          const updatedListing = await updateListing(data.existingListingId, {
            title: `Property Requirement - ${data.companyName || 'Company'}`,
            description: `Property requirement from ${data.companyName || 'company'}`,
            company_name: data.companyName || 'Company Name Required',
            listing_type: data.listingType || 'commercial',
            site_size_min: data.siteSizeMin,
            site_size_max: data.siteSizeMax,
            brochure_url: data.brochureFiles?.[0]?.url,
            contact_name: data.primaryContact?.contactName || 'Contact Name',
            contact_title: data.primaryContact?.contactTitle || 'Contact Title',
            contact_email: data.primaryContact?.contactEmail || currentUser.email || 'contact@example.com',
            contact_phone: data.primaryContact?.contactPhone,
            contact_area: data.primaryContact?.contactArea,
            // Logo method fields - Story 9.0
            clearbit_logo: data.clearbitLogo || false,
            company_domain: data.companyDomain,
            // Property page link field
            property_page_link: data.propertyPageLink,
            // Residential fields
            dwelling_count_min: data.dwellingCountMin,
            dwelling_count_max: data.dwellingCountMax,
            site_acreage_min: data.siteAcreageMin,
            site_acreage_max: data.siteAcreageMax,
            status: 'pending', // Reset to pending when edited
            // Use validated UUIDs
            sector_id: finalSectorId,
            use_class_id: finalUseClassId
          }, serverClient);

          // Update related data (contacts, FAQs, locations, documents, files)
          try {
            console.log('Starting related data update for listing:', data.existingListingId);
            console.log('FAQs data received:', data.faqs);
            console.log('Additional contacts data received:', data.additionalContacts);
            console.log('Primary contact data received:', data.primaryContact);
            // Use the same server client for consistency
            const supabase = serverClient;

            // 1. Delete existing additional contacts (keep primary contact in main table)
          console.log('Deleting existing contacts for listing:', data.existingListingId);
          const { error: deleteContactsError } = await supabase
            .from('listing_contacts')
            .delete()
            .eq('listing_id', data.existingListingId);
          
          if (deleteContactsError) {
            console.error('Error deleting contacts:', deleteContactsError);
          } else {
            console.log('Successfully deleted existing contacts');
          }

          // 2. Delete existing FAQs
          console.log('Deleting existing FAQs for listing:', data.existingListingId);
          const { error: deleteFAQsError } = await supabase
            .from('faqs')
            .delete()
            .eq('listing_id', data.existingListingId);
          
          if (deleteFAQsError) {
            console.error('Error deleting FAQs:', deleteFAQsError);
          } else {
            console.log('Successfully deleted existing FAQs');
          }

          // 3. Delete existing locations
          console.log('Deleting existing locations...');
          const { error: deleteLocationsError } = await supabase
            .from('listing_locations')
            .delete()
            .eq('listing_id', data.existingListingId);
          
          if (deleteLocationsError) {
            console.error('Error deleting locations:', deleteLocationsError);
          } else {
            console.log('Successfully deleted existing locations');
          }

          // 4. Delete existing file uploads for this listing (except headshots)
          // Handle logos separately based on method
          console.log('Deleting existing file uploads (except headshots)...');
          
          // If using Clearbit, delete any uploaded logos
          if (data.clearbitLogo) {
            console.log('Using Clearbit logo - deleting uploaded logos...');
            const { error: deleteLogosError } = await supabase
              .from('file_uploads')
              .delete()
              .eq('listing_id', data.existingListingId)
              .eq('file_type', 'logo');
            
            if (deleteLogosError) {
              console.error('Error deleting uploaded logos:', deleteLogosError);
            } else {
              console.log('Successfully deleted uploaded logos (using Clearbit)');
            }
          }
          
          // Delete other file uploads except headshots and current logos (if upload method)
          const fileTypesToDelete = ['brochure', 'sitePlan', 'site_plan', 'fitOut', 'fit_out', 'image', 'video', 'pdf'];
          // If using Clearbit, also delete uploaded logos
          if (data.clearbitLogo) {
            fileTypesToDelete.push('logo');
          }
          
          for (const fileType of fileTypesToDelete) {
            const { error: deleteFileError } = await supabase
              .from('file_uploads')
              .delete()
              .eq('listing_id', data.existingListingId)
              .eq('file_type', fileType);
            
            if (deleteFileError) {
              console.error(`Error deleting ${fileType} files:`, deleteFileError);
            }
          }
          
          console.log('Successfully deleted existing file uploads (except headshots and preserved logos)');

          // 5. Logo handling is complete:
          // - Uploaded logos are preserved in file_uploads table (uploaded in Step1)
          // - Clearbit logos only need company_domain field (no file_uploads entry needed)

          // 6. Add updated contacts (primary + additional)
          const contactsForDatabase = [];
          
          // Add primary contact to listing_contacts table
          if (data.primaryContact) {
            console.log('Adding primary contact to listing_contacts table:', data.primaryContact);
            const primaryContactData = {
              listing_id: data.existingListingId,
              contact_name: data.primaryContact.contactName || '',
              contact_title: data.primaryContact.contactTitle || '',
              contact_email: data.primaryContact.contactEmail || '',
              contact_phone: data.primaryContact.contactPhone,
              contact_area: data.primaryContact.contactArea,
              is_primary_contact: true,
              headshot_url: data.primaryContact.headshotUrl
            };
            console.log('Primary contact data prepared:', primaryContactData);
            contactsForDatabase.push(primaryContactData);
          }
          
          // Add additional contacts
          if (data.additionalContacts && data.additionalContacts.length > 0) {
            console.log('Adding additional contacts:', data.additionalContacts.length);
            data.additionalContacts.forEach(contact => {
              contactsForDatabase.push({
                listing_id: data.existingListingId,
                contact_name: contact.contactName || '',
                contact_title: contact.contactTitle || '',
                contact_email: contact.contactEmail || '',
                contact_phone: contact.contactPhone,
                contact_area: contact.contactArea,
                is_primary_contact: false,
                headshot_url: contact.headshotUrl
              });
            });
          }

          // Insert all contacts if any exist
          if (contactsForDatabase.length > 0) {
            const { error: contactsError } = await supabase
              .from('listing_contacts')
              .insert(contactsForDatabase);
            
            if (contactsError) {
              console.error('Error inserting contacts:', contactsError);
            } else {
              console.log(`Successfully inserted ${contactsForDatabase.length} contacts (${contactsForDatabase.filter(c => c.is_primary_contact).length} primary, ${contactsForDatabase.filter(c => !c.is_primary_contact).length} additional)`);
            }
          }

          // 7. Add updated FAQs (if any)
          if (data.faqs && data.faqs.length > 0) {
            console.log('Adding FAQs:', data.faqs.length);
            console.log('FAQs data:', JSON.stringify(data.faqs, null, 2));
            const faqsForDatabase = data.faqs.map((faq, index) => ({
              listing_id: data.existingListingId,
              question: faq.question,
              answer: faq.answer,
              display_order: faq.displayOrder !== undefined ? faq.displayOrder : index
            }));
            console.log('FAQs prepared for database:', JSON.stringify(faqsForDatabase, null, 2));

            const { error: faqsError } = await supabase
              .from('faqs')
              .insert(faqsForDatabase);
            
            if (faqsError) {
              console.error('Error inserting FAQs:', faqsError);
            } else {
              console.log(`Successfully inserted ${faqsForDatabase.length} FAQs`);
            }
          }

          // 8. Add updated locations (if not nationwide)
          console.log('Processing locations:', { 
            locationSearchNationwide: data.locationSearchNationwide, 
            locationsCount: data.locations?.length,
            locations: data.locations 
          });
          
          if (!data.locationSearchNationwide && data.locations && data.locations.length > 0) {
            console.log('Adding locations to database:', data.locations.length);
            const locationsForDatabase = data.locations.map(location => ({
              listing_id: data.existingListingId,
              place_name: location.place_name || location.formatted_address || 'Unknown Location',
              formatted_address: location.formatted_address || location.place_name || 'Unknown Address',
              region: location.region || null,
              country: location.country || null,
              coordinates: location.coordinates || null
            }));

            console.log('Locations for database:', locationsForDatabase);
            const { error: locationsError } = await supabase
              .from('listing_locations')
              .insert(locationsForDatabase);
            
            if (locationsError) {
              console.error('Error inserting locations:', locationsError);
            } else {
              console.log('Successfully inserted locations');
            }
          } else {
            console.log('Skipping location insert - either nationwide or no locations provided');
          }

          // 9. Add updated brochure files (if any)
          if (data.brochureFiles && data.brochureFiles.length > 0) {
            for (let i = 0; i < data.brochureFiles.length; i++) {
              const file = data.brochureFiles[i];
              await supabase
                .from('file_uploads')
                .insert({
                  user_id: currentUser.id,
                  listing_id: data.existingListingId,
                  file_path: file.path || extractStoragePath(file.url), // Use file.path if available, extract from URL
                  file_name: file.name,
                  file_size: file.size || 0,
                  file_type: 'brochure',
                  mime_type: file.mimeType || 'application/pdf',
                  bucket_name: 'brochures',
                  display_order: i,
                  is_primary: i === 0 // First brochure is primary
                });
            }
          }

          // 10. Add updated site plan files (if any)
          if (data.photoFiles && data.photoFiles.length > 0) {
            for (let i = 0; i < data.photoFiles.length; i++) {
              const file = data.photoFiles[i];
              await supabase
                .from('file_uploads')
                .insert({
                  user_id: currentUser.id,
                  listing_id: data.existingListingId,
                  file_path: file.path || extractStoragePath(file.url), // Use file.path if available, extract from URL
                  file_name: file.name,
                  file_size: file.size || 0,
                  file_type: 'photo',
                  mime_type: file.mimeType || 'application/pdf',
                  bucket_name: 'photos',
                  display_order: i
                });
            }
          }

          // 11. Add updated fit-out files (if any)
          if (data.videoFiles && data.videoFiles.length > 0) {
            for (let i = 0; i < data.videoFiles.length; i++) {
              const file = data.videoFiles[i];
              await supabase
                .from('file_uploads')
                .insert({
                  user_id: currentUser.id,
                  listing_id: data.existingListingId,
                  file_path: file.path || extractStoragePath(file.url), // Use file.path if available, extract from URL
                  file_name: file.name,
                  file_size: file.size || 0,
                  file_type: 'video',
                  mime_type: file.mimeType || 'image/jpeg',
                  bucket_name: 'videos',
                  display_order: file.displayOrder || i
                });
            }
          }

          // 12. Update junction tables for sectors and use classes
          console.log('Updating junction tables with data:', {
            sectors: data.sectors,
            useClassIds: data.useClassIds
          });

          // Clear existing junction table entries
          await supabase.from('listing_sectors').delete().eq('listing_id', data.existingListingId);
          await supabase.from('listing_use_classes').delete().eq('listing_id', data.existingListingId);

          // Add new sectors to junction table
          if (data.sectors && data.sectors.length > 0) {
            // Get sector data to handle both UUID and name formats
            const { data: allSectors } = await supabase.from('sectors').select('id, name');
            
            const sectorInserts = data.sectors
              .map(sectorIdOrName => {
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sectorIdOrName);
                let sector;
                if (isUUID) {
                  sector = allSectors?.find(s => s.id === sectorIdOrName);
                } else {
                  sector = allSectors?.find(s => s.name === sectorIdOrName);
                }
                return sector ? {
                  listing_id: data.existingListingId,
                  sector_id: sector.id
                } : null;
              })
              .filter(Boolean);

            if (sectorInserts.length > 0) {
              const { error: sectorsError } = await supabase
                .from('listing_sectors')
                .insert(sectorInserts);

              if (sectorsError) {
                console.error('Error updating sectors:', sectorsError);
              } else {
                console.log(`Updated ${sectorInserts.length} sectors in junction table`);
              }
            }
          }

          // Add new use classes to junction table
          if (data.useClassIds && data.useClassIds.length > 0) {
            // Get use class data to handle both UUID and code formats
            const { data: allUseClasses } = await supabase.from('use_classes').select('id, code');
            
            const useClassInserts = data.useClassIds
              .map(useClassIdOrCode => {
                const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(useClassIdOrCode);
                let useClass;
                if (isUUID) {
                  useClass = allUseClasses?.find(uc => uc.id === useClassIdOrCode);
                } else {
                  useClass = allUseClasses?.find(uc => uc.code === useClassIdOrCode);
                }
                return useClass ? {
                  listing_id: data.existingListingId,
                  use_class_id: useClass.id
                } : null;
              })
              .filter(Boolean);

            if (useClassInserts.length > 0) {
              const { error: useClassesError } = await supabase
                .from('listing_use_classes')
                .insert(useClassInserts);

              if (useClassesError) {
                console.error('Error updating use classes:', useClassesError);
              } else {
                console.log(`Updated ${useClassInserts.length} use classes in junction table`);
              }
            }
          }

          } catch (relatedDataError) {
            console.error('Failed to update related data:', relatedDataError);
            // Main listing was updated successfully, but related data failed
            return {
              success: true,
              listingId: updatedListing.id,
              message: 'Listing updated successfully (some related data may not have been saved)'
            };
          }

          console.log('Returning success for updated listing:', updatedListing.id);
          return {
            success: true,
            listingId: updatedListing.id,
            message: 'Listing updated successfully',
            // Debug info to check in client
            debug: {
              faqsProcessed: data.faqs?.length || 0,
              contactsProcessed: (data.additionalContacts?.length || 0) + 1 // +1 for primary
            }
          };
        } else {
          // Import additional draft listing functions
          const { addContactsToDraftListing, addFAQsToDraftListing, addLocationsToDraftListing, addSectorsToDraftListing, addUseClassesToDraftListing } = await import('@/lib/draft-listings');

        // Finalize the existing draft listing with all data
        await finalizeDraftListing(data.existingListingId, {
          title: `Property Requirement - ${data.companyName || 'Company'}`,
          description: `Property requirement from ${data.companyName || 'company'}`,
          status: 'pending',
          company_name: data.companyName || 'Company Name Required',
          listing_type: data.listingType || 'commercial',
          site_size_min: data.siteSizeMin,
          site_size_max: data.siteSizeMax,
          brochure_url: data.brochureFiles?.[0]?.url,
          // Logo method fields - Story 9.0
          clearbit_logo: data.clearbitLogo || false,
          company_domain: data.companyDomain,
          contact_name: data.primaryContact?.contactName || 'Contact Name',
          contact_title: data.primaryContact?.contactTitle || 'Contact Title',
          contact_email: data.primaryContact?.contactEmail || currentUser.email || 'contact@example.com',
          contact_phone: data.primaryContact?.contactPhone,
          contact_area: data.primaryContact?.contactArea
        });

        // Save sectors to junction table if provided
        if (data.sectors && data.sectors.length > 0) {
          await addSectorsToDraftListing(data.existingListingId, data.sectors);
        }

        // Save use classes to junction table if provided
        if (data.useClassIds && data.useClassIds.length > 0) {
          await addUseClassesToDraftListing(data.existingListingId, data.useClassIds);
        }

        // Save FAQs if provided
        if (data.faqs && data.faqs.length > 0) {
          const faqsForDatabase = data.faqs.map(faq => ({
            question: faq.question,
            answer: faq.answer,
            display_order: faq.displayOrder
          }));
          await addFAQsToDraftListing(data.existingListingId, faqsForDatabase);
        }

        // Save contacts if provided
        if (data.primaryContact || (data.additionalContacts && data.additionalContacts.length > 0)) {
          const allContacts = [];
          
          // Add primary contact
          if (data.primaryContact) {
            allContacts.push({
              contact_name: data.primaryContact.contactName || '',
              contact_title: data.primaryContact.contactTitle || '',
              contact_email: data.primaryContact.contactEmail || currentUser.email || '',
              contact_phone: data.primaryContact.contactPhone,
              contact_area: data.primaryContact.contactArea,
              is_primary_contact: true,
              headshot_url: data.primaryContact.headshotUrl
            });
          }
          
          // Add additional contacts
          if (data.additionalContacts) {
            data.additionalContacts.forEach(contact => {
              allContacts.push({
                contact_name: contact.contactName || '',
                contact_title: contact.contactTitle || '',
                contact_email: contact.contactEmail || '',
                contact_phone: contact.contactPhone,
                contact_area: contact.contactArea,
                is_primary_contact: false,
                headshot_url: contact.headshotUrl
              });
            });
          }
          
          if (allContacts.length > 0) {
            await addContactsToDraftListing(data.existingListingId, allContacts);
          }
        }

        // Save locations if provided (but not if nationwide is selected)
        if (!data.locationSearchNationwide && data.locations && data.locations.length > 0) {
          await addLocationsToDraftListing(data.existingListingId, data.locations);
        }

          return {
            success: true,
            listingId: data.existingListingId,
            message: 'Listing submitted successfully'
          };
        }
      } else {
        // Create a new listing (fallback for cases where draft creation failed)
        const listing = await createEnhancedListing(enhancedListingData, currentUser.id);

        return {
          success: true,
          listingId: listing.id,
          message: 'Listing created successfully'
        };
      }
    } catch (error) {
      console.error('Failed to create listing:', error);
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        cause: error instanceof Error ? (error as any).cause : undefined
      });
      
      const errorResult = { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create listing' 
      };
      console.log('Returning error result:', errorResult);
      return errorResult;
    }
  }

  // =====================================================
  // SAVE HANDLER (Draft functionality)
  // =====================================================

  async function handleSave(data: Partial<WizardFormData>): Promise<void> {
    'use server';
    
    try {
      // Get current user for server action
      const currentUser = await getCurrentUser();
      
      if (!currentUser) {
        throw new Error('Unauthorized');
      }

      // Create a sanitized version without File objects for server action
      const sanitizedData = { ...data };
      
      // Remove File objects as they can't be serialized in server actions
      if (sanitizedData.logoFile instanceof File) {
        delete sanitizedData.logoFile;
      }
      
      // Remove other File arrays as well
      if (sanitizedData.brochureFiles) {
        delete sanitizedData.brochureFiles;
      }
      if (sanitizedData.photoFiles) {
        delete sanitizedData.photoFiles;
      }
      if (sanitizedData.videoFiles) {
        delete sanitizedData.videoFiles;
      }
      
      // Clean primary contact headshot file
      if (sanitizedData.primaryContact?.headshotFile instanceof File) {
        sanitizedData.primaryContact = {
          ...sanitizedData.primaryContact,
          headshotFile: undefined
        };
      }
      
      // Clean additional contacts headshot files
      if (sanitizedData.additionalContacts) {
        sanitizedData.additionalContacts = sanitizedData.additionalContacts.map(contact => {
          const cleanContact = { ...contact };
          if (cleanContact.headshotFile instanceof File) {
            cleanContact.headshotFile = undefined;
          }
          return cleanContact;
        });
      }
      
      // Remove any Date objects or other non-serializable data
      const cleanData = JSON.parse(JSON.stringify(sanitizedData, (key, value) => {
        // Remove File objects
        if (value instanceof File) {
          return undefined;
        }
        // Convert Date objects to ISO strings
        if (value instanceof Date) {
          return value.toISOString();
        }
        // Remove functions
        if (typeof value === 'function') {
          return undefined;
        }
        return value;
      }));
      
      // Use the cleaned data
      Object.assign(sanitizedData, cleanData);
      
      // This could save as draft to the database in the future
      // For now, we'll just acknowledge the save was successful
      // The actual saving happens in localStorage via the wizard component
    } catch (error) {
      console.error('Save failed:', error);
      throw new Error('Failed to save progress');
    }
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="min-h-screen bg-background">
      {/* Breadcrumb Navigation */}
      <div className="bg-background border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <nav className="flex items-center space-x-4 body-small">
              <Link href="/new-dashboard" className="text-muted-foreground hover:text-foreground violet-bloom-nav-item">
                Dashboard
              </Link>
              <span className="text-muted-foreground">/</span>
              <span className="text-foreground font-medium">
                {editListingId ? 'Update Listing' : 'Create New Listing'}
              </span>
            </nav>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="py-8">
        <ErrorBoundary
          resetKeys={[user.email]} // Reset boundary when user changes
          context={{
            component: 'ListingWizard',
            userId: user.id,
            feature: 'Listing Creation'
          }}
        >
          <ListingWizard
            initialData={{
              primaryContact: {
                contactName: '',
                contactTitle: '',
                contactEmail: user.email,
                isPrimaryContact: true
              },
              existingListingId: editListingId
            }}
            onSubmit={handleSubmit}
            onSave={handleSave}
            userEmail={user.email}
            userId={user.id}
            editMode={!!editListingId}
            startFresh={startFresh}
          />
        </ErrorBoundary>
      </div>

      {/* Toast Notifications */}
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
        }}
      />
    </div>
  );
}

// =====================================================
// METADATA
// =====================================================

export const metadata = {
  title: 'Create New Listing - SiteMatcher',
  description: 'Create a new property requirement listing',
};