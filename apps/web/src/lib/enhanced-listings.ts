// =====================================================
// Enhanced Listings - Story 3.3
// Enhanced listing creation with FAQs and full PRD support
// =====================================================

import { createServerClient } from '@/lib/supabase';

// =====================================================
// TYPES
// =====================================================

export interface EnhancedListingData {
  // Enhanced contact fields (PRD required)
  contact_name: string;
  contact_title: string;
  contact_email: string;
  contact_phone?: string;
  
  // Company information
  company_name: string;
  
  // Property requirements
  sectors?: string[];
  use_class_ids?: string[];
  site_size_min?: number;
  site_size_max?: number;
  
  // File URLs
  logo_url?: string;
  brochure_urls?: string[];
  site_plan_urls?: string[];
  fit_out_urls?: string[];
  
  // Location data
  locations?: Array<{
    id: string;
    place_name: string;
    coordinates: [number, number];
    type: 'preferred' | 'acceptable';
    formatted_address: string;
    region?: string;
    country?: string;
  }>;
  is_nationwide?: boolean;
  
  // FAQ data
  faqs?: Array<{
    question: string;
    answer: string;
    display_order: number;
  }>;
  
  // Additional contacts data
  additional_contacts?: Array<{
    contact_name: string;
    contact_title: string;
    contact_email: string;
    contact_phone?: string;
    headshot_url?: string;
  }>;
  
  
  status: 'pending' | 'approved' | 'rejected';
}

// =====================================================
// ENHANCED LISTING CREATION
// =====================================================

export async function createEnhancedListing(
  data: EnhancedListingData,
  userId: string
) {
  const supabase = createServerClient();

  console.log('Creating enhanced listing with sectors:', data.sectors, 'use_class_ids:', data.use_class_ids);
  console.log('Sector types:', data.sectors?.map(s => typeof s + ': ' + s));
  console.log('Use class types:', data.use_class_ids?.map(uc => typeof uc + ': ' + uc));

  try {
    // Start transaction
    // Map enhanced data to database schema - start with minimal required fields
    const insertData: any = {
      created_by: userId,
      title: data.company_name || 'Property Requirement',
      description: `Property requirement from ${data.company_name}`,
      company_name: data.company_name || 'Company Name Required',
      status: data.status || 'pending'
    };
    
    // Add optional fields only if they exist
    if (data.site_size_min) {
      insertData.site_size_min = data.site_size_min;
    }
    if (data.site_size_max) {
      insertData.site_size_max = data.site_size_max;
    }
    
    // Try to add contact fields - these might not exist in the current schema
    try {
      if (data.contact_name) insertData.contact_name = data.contact_name;
      if (data.contact_title) insertData.contact_title = data.contact_title;
      if (data.contact_email) insertData.contact_email = data.contact_email;
      if (data.contact_phone) insertData.contact_phone = data.contact_phone;
    } catch (error) {
      console.log('Contact fields not available in current schema');
    }

    // Get all available sectors and use classes first
    const { data: allSectors, error: sectorsError } = await supabase
      .from('sectors')
      .select('id, name');
    
    const { data: allUseClasses, error: useClassesError } = await supabase
      .from('use_classes')
      .select('id, code, name');
    
    if (sectorsError) {
      console.error('Failed to fetch sectors:', sectorsError);
    }
    
    if (useClassesError) {
      console.error('Failed to fetch use classes:', useClassesError);
    }
    
    console.log('Available sectors:', allSectors);
    console.log('Available use classes:', allUseClasses);
    
    // Note: Sectors and use classes will be handled via junction tables after listing creation
    // Remove the old single sector/use class assignment logic
    
    // For backward compatibility, we'll still use first sector/use class for the main table
    // until we fully migrate to junction tables only
    if (allSectors && allSectors.length > 0) {
      if (data.sectors && data.sectors.length > 0) {
        const matchingSector = allSectors.find(s => s.name === data.sectors![0]);
        if (matchingSector) {
          insertData.sector_id = matchingSector.id;
        }
      }
      
      // Use first available sector as fallback
      if (!insertData.sector_id) {
        insertData.sector_id = allSectors[0].id;
        console.log('Using fallback sector:', allSectors[0]);
      }
    }
    
    // For backward compatibility, use first use class for main table
    if (allUseClasses && allUseClasses.length > 0) {
      if (data.use_class_ids && data.use_class_ids.length > 0) {
        const matchingUseClass = allUseClasses.find(uc => uc.id === data.use_class_ids![0] || uc.code === data.use_class_ids![0]);
        if (matchingUseClass) {
          insertData.use_class_id = matchingUseClass.id;
        }
      }
      
      // Use first available use class as fallback
      if (!insertData.use_class_id) {
        insertData.use_class_id = allUseClasses[0].id;
        console.log('Using fallback use class:', allUseClasses[0]);
      }
    }

    console.log('Final insert data:', JSON.stringify(insertData, null, 2));

    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .insert(insertData)
      .select()
      .single();

    if (listingError) {
      console.error('Listing creation error:', listingError);
      console.error('Listing creation error details:', JSON.stringify(listingError, null, 2));
      console.error('Insert data that failed:', JSON.stringify(insertData, null, 2));
      
      const errorMessage = listingError.message || listingError.hint || 'Unknown database error';
      throw new Error(`Failed to create listing: ${errorMessage}`);
    }

    // Insert sectors to junction table
    if (data.sectors && data.sectors.length > 0 && allSectors) {
      const sectorInserts = data.sectors
        .map(sectorId => {
          // Check if it's a UUID (new format) or name (legacy format)
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sectorId);
          
          let sector;
          if (isUUID) {
            // Find by ID
            sector = allSectors.find(s => s.id === sectorId);
          } else {
            // Find by name (legacy format)
            sector = allSectors.find(s => s.name === sectorId);
          }
          
          return sector ? {
            listing_id: listing.id,
            sector_id: sector.id
          } : null;
        })
        .filter(Boolean);

      if (sectorInserts.length > 0) {
        const { data: insertedSectors, error: sectorsError } = await supabase
          .from('listing_sectors')
          .insert(sectorInserts)
          .select();

        if (sectorsError) {
          console.error('Sector junction insertion error:', sectorsError);
        } else {
          console.log(`Successfully inserted ${insertedSectors?.length} sectors to junction table`);
        }
      }
    }

    // Insert use classes to junction table
    if (data.use_class_ids && data.use_class_ids.length > 0 && allUseClasses) {
      const useClassInserts = data.use_class_ids
        .map(useClassId => {
          // Check if it's a UUID (new format) or code (legacy format)
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(useClassId);
          
          let useClass;
          if (isUUID) {
            // Find by ID
            useClass = allUseClasses.find(uc => uc.id === useClassId);
          } else {
            // Find by code (legacy format)
            useClass = allUseClasses.find(uc => uc.code === useClassId);
          }
          
          return useClass ? {
            listing_id: listing.id,
            use_class_id: useClass.id
          } : null;
        })
        .filter(Boolean);

      if (useClassInserts.length > 0) {
        const { data: insertedUseClasses, error: useClassesError } = await supabase
          .from('listing_use_classes')
          .insert(useClassInserts)
          .select();

        if (useClassesError) {
          console.error('Use class junction insertion error:', useClassesError);
        } else {
          console.log(`Successfully inserted ${insertedUseClasses?.length} use classes to junction table`);
        }
      }
    }

    // Insert locations if not nationwide
    if (!data.is_nationwide && data.locations && data.locations.length > 0) {
      const locationInserts = data.locations.map(location => ({
        listing_id: listing.id,
        place_name: location.place_name,
        coordinates: location.coordinates,
        type: location.type,
        formatted_address: location.formatted_address,
        region: location.region,
        country: location.country
      }));

      const { error: locationsError } = await supabase
        .from('listing_locations')
        .insert(locationInserts);

      if (locationsError) {
        console.error('Location insertion error:', locationsError);
        // Don't fail the entire operation for location errors
      }
    }

    // Insert FAQs if provided
    if (data.faqs && data.faqs.length > 0) {
      const faqInserts = data.faqs.map(faq => ({
        listing_id: listing.id,
        question: faq.question,
        answer: faq.answer,
        display_order: faq.display_order
      }));

      const { error: faqsError } = await supabase
        .from('faqs')
        .insert(faqInserts);

      if (faqsError) {
        console.error('FAQ insertion error:', faqsError);
        // Don't fail the entire operation for FAQ errors
      }
    }

    // Insert primary contact
    if (data.contact_name || data.contact_title || data.contact_email) {
      const primaryContactInsert = {
        listing_id: listing.id,
        contact_name: data.contact_name || '',
        contact_title: data.contact_title || '',
        contact_email: data.contact_email || '',
        contact_phone: data.contact_phone || null,
        is_primary_contact: true,
        headshot_url: null // Will be updated later if headshot uploaded
      };

      const { error: contactError } = await supabase
        .from('listing_contacts')
        .insert(primaryContactInsert);

      if (contactError) {
        console.error('Primary contact insertion error:', contactError);
        // Don't fail the entire operation for contact errors
      }
    }

    // Insert additional contacts if provided
    if (data.additional_contacts && data.additional_contacts.length > 0) {
      const additionalContactInserts = data.additional_contacts.map((contact: any) => ({
        listing_id: listing.id,
        contact_name: contact.contact_name || '',
        contact_title: contact.contact_title || '',
        contact_email: contact.contact_email || '',
        contact_phone: contact.contact_phone || null,
        is_primary_contact: false,
        headshot_url: contact.headshot_url || null
      }));

      const { error: additionalContactsError } = await supabase
        .from('listing_contacts')
        .insert(additionalContactInserts);

      if (additionalContactsError) {
        console.error('Additional contacts insertion error:', additionalContactsError);
        // Don't fail the entire operation for additional contact errors
      }
    }

    // Link any remaining orphaned files to this listing
    // (Files should already be linked via draft listing, but this is a fallback)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { error: fileUpdateError } = await supabase
      .from('file_uploads')
      .update({ listing_id: listing.id })
      .eq('user_id', userId)
      .is('listing_id', null)
      .gte('created_at', oneHourAgo);

    if (fileUpdateError) {
      console.error('File linking error:', fileUpdateError);
      // Don't fail the entire operation for file linking errors
    }

    return listing;

  } catch (error) {
    console.error('Enhanced listing creation failed:', error);
    throw error;
  }
}

// =====================================================
// EMAIL CONFIRMATION
// =====================================================

export async function sendSubmissionConfirmation(email: string, listingId: string) {
  try {
    // TODO: Implement with Resend when email service is configured
    // For now, just log that confirmation would be sent
    console.log(`Would send submission confirmation to ${email} for listing ${listingId}`);
    
    // The actual implementation would be:
    // const { Resend } = await import('resend');
    // const resend = new Resend(process.env.RESEND_API_KEY);
    // 
    // await resend.emails.send({
    //   from: process.env.RESEND_FROM_EMAIL!,
    //   to: email,
    //   subject: 'Listing Submission Confirmation',
    //   html: await generateConfirmationEmail(listingId)
    // });

  } catch (error) {
    console.error('Failed to send confirmation email:', error);
    throw error;
  }
}

async function generateConfirmationEmail(listingId: string): Promise<string> {
  return `
    <h1>Listing Submission Confirmed</h1>
    <p>Thank you for submitting your property requirement listing (ID: ${listingId}).</p>
    <p>Your listing is now under review by our admin team.</p>
    <p>You will receive another email once your listing has been approved and goes live.</p>
    <p>Estimated review time: 1-2 business days</p>
    <p>If you have any questions, please contact our support team.</p>
  `;
}