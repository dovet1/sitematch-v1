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
  
  // Organization ID
  organization_id: string;
  
  status: 'pending' | 'approved' | 'rejected';
}

// =====================================================
// ENHANCED LISTING CREATION
// =====================================================

export async function createEnhancedListing(
  data: EnhancedListingData,
  userId: string,
  organizationId: string
) {
  const supabase = createServerClient();

  try {
    // Start transaction
    // Map enhanced data to database schema - start with minimal required fields
    const insertData: any = {
      org_id: organizationId,
      created_by: userId,
      title: data.company_name || 'Property Requirement',
      description: `Property requirement from ${data.company_name}`,
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
    
    // Try to find matching sector
    if (allSectors && allSectors.length > 0) {
      if (data.sectors && data.sectors.length > 0) {
        const matchingSector = allSectors.find(s => s.name === data.sectors[0]);
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
    
    // Try to find matching use class
    if (allUseClasses && allUseClasses.length > 0) {
      if (data.use_class_ids && data.use_class_ids.length > 0) {
        const matchingUseClass = allUseClasses.find(uc => uc.id === data.use_class_ids[0] || uc.code === data.use_class_ids[0]);
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
      
      const errorMessage = listingError.message || listingError.error_description || listingError.hint || 'Unknown database error';
      throw new Error(`Failed to create listing: ${errorMessage}`);
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