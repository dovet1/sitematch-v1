// =====================================================
// Draft Listings - Story 3.3
// Draft listing creation for wizard state management
// =====================================================

import { createServerClient } from '@/lib/supabase';

// =====================================================
// DRAFT LISTING CREATION
// =====================================================

export async function createDraftListing(
  organizationId: string,
  userEmail?: string
): Promise<string> {
  const supabase = createServerClient();

  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Authentication required');
    }

    // Get first available sector and use class for draft
    const { data: sectors } = await supabase
      .from('sectors')
      .select('id, name')
      .limit(1);

    const { data: useClasses } = await supabase
      .from('use_classes')
      .select('id, code, name')
      .limit(1);

    if (!sectors || !sectors.length || !useClasses || !useClasses.length) {
      throw new Error('No reference data available');
    }

    // Create minimal draft listing
    const draftData = {
      org_id: organizationId,
      created_by: user.id,
      title: 'Draft Listing - In Progress',
      description: 'Draft listing created during wizard process',
      status: 'draft',
      sector_id: sectors[0].id,
      use_class_id: useClasses[0].id,
      contact_email: userEmail || user.email || 'contact@example.com'
    };

    const { data: listing, error: listingError } = await supabase
      .from('listings')
      .insert(draftData)
      .select()
      .single();

    if (listingError) {
      console.error('Draft listing creation error:', listingError);
      throw new Error(`Failed to create draft listing: ${listingError.message}`);
    }

    console.log('Draft listing created successfully:', listing.id);
    return listing.id;

  } catch (error) {
    console.error('Draft listing creation failed:', error);
    throw error;
  }
}

// =====================================================
// DRAFT LISTING UPDATE
// =====================================================

export async function updateDraftListing(
  listingId: string,
  updateData: Partial<{
    title: string;
    description: string;
    contact_name: string;
    contact_title: string;
    contact_email: string;
    contact_phone: string;
    site_size_min: number;
    site_size_max: number;
    brochure_url: string;
  }>
): Promise<void> {
  // Use browser client if we're on the client side, server client otherwise
  let supabase;
  if (typeof window !== 'undefined') {
    const { browserClient } = await import('@/lib/supabase');
    supabase = browserClient;
  } else {
    supabase = createServerClient();
  }

  try {
    // Validate phone number if present
    if (updateData.contact_phone && typeof updateData.contact_phone === 'string') {
      const trimmedPhone = updateData.contact_phone.trim();
      if (trimmedPhone.length > 0) {
        const phoneRegex = /^(\+44|0)[1-9]\d{8,9}$|^\+\d{7,15}$/;
        if (phoneRegex.test(trimmedPhone.replace(/\s/g, ''))) {
          updateData.contact_phone = trimmedPhone;
        } else {
          console.warn('Invalid phone format in updateDraftListing, removing field:', trimmedPhone);
          delete updateData.contact_phone;
        }
      } else {
        delete updateData.contact_phone;
      }
    }

    const { error } = await supabase
      .from('listings')
      .update(updateData)
      .eq('id', listingId);

    if (error) {
      console.error('Draft listing update error:', error);
      throw new Error(`Failed to update draft listing: ${error.message}`);
    }

    console.log('Draft listing updated successfully:', listingId);

  } catch (error) {
    console.error('Draft listing update failed:', error);
    throw error;
  }
}

// =====================================================
// DRAFT LISTING FINALIZATION
// =====================================================

export async function finalizeDraftListing(
  listingId: string,
  finalData: {
    title: string;
    description: string;
    status: 'pending' | 'approved' | 'rejected';
    site_size_min?: number;
    site_size_max?: number;
    brochure_url?: string;
    contact_name?: string;
    contact_title?: string;
    contact_email?: string;
    contact_phone?: string;
  }
): Promise<void> {
  // Use browser client if we're on the client side, server client otherwise
  let supabase;
  if (typeof window !== 'undefined') {
    const { browserClient } = await import('@/lib/supabase');
    supabase = browserClient;
  } else {
    supabase = createServerClient();
  }

  try {
    const updateData: any = {
      title: finalData.title,
      description: finalData.description,
      status: finalData.status,
      updated_at: new Date().toISOString()
    };

    // Add optional fields if provided
    if (finalData.site_size_min !== undefined) {
      updateData.site_size_min = finalData.site_size_min;
    }
    if (finalData.site_size_max !== undefined) {
      updateData.site_size_max = finalData.site_size_max;
    }
    if (finalData.brochure_url) {
      updateData.brochure_url = finalData.brochure_url;
    }
    if (finalData.contact_name) {
      updateData.contact_name = finalData.contact_name;
    }
    if (finalData.contact_title) {
      updateData.contact_title = finalData.contact_title;
    }
    if (finalData.contact_email) {
      updateData.contact_email = finalData.contact_email;
    }
    if (finalData.contact_phone) {
      // Validate phone number format
      const trimmedPhone = finalData.contact_phone.trim();
      if (trimmedPhone.length > 0) {
        const phoneRegex = /^(\+44|0)[1-9]\d{8,9}$|^\+\d{7,15}$/;
        if (phoneRegex.test(trimmedPhone.replace(/\s/g, ''))) {
          updateData.contact_phone = trimmedPhone;
        } else {
          console.warn('Invalid phone format for main listing, removing field:', trimmedPhone);
          // Don't set the field at all if invalid
        }
      }
    }

    const { error } = await supabase
      .from('listings')
      .update(updateData)
      .eq('id', listingId);

    if (error) {
      console.error('Draft listing finalization error:', error);
      throw new Error(`Failed to finalize draft listing: ${error.message}`);
    }

    console.log('Draft listing finalized successfully:', listingId);

  } catch (error) {
    console.error('Draft listing finalization failed:', error);
    throw error;
  }
}

// =====================================================
// ADD CONTACTS TO DRAFT LISTING
// =====================================================

export async function addContactsToDraftListing(
  listingId: string,
  contacts: Array<{
    contact_name: string;
    contact_title: string;
    contact_email: string;
    contact_phone?: string;
    is_primary_contact: boolean;
    headshot_url?: string;
  }>
): Promise<void> {
  // Use browser client if we're on the client side, server client otherwise
  let supabase;
  if (typeof window !== 'undefined') {
    const { browserClient } = await import('@/lib/supabase');
    supabase = browserClient;
  } else {
    supabase = createServerClient();
  }

  try {
    const contactInserts = contacts.map(contact => {
      // Clean and validate phone number
      let cleanPhone = null;
      if (contact.contact_phone && typeof contact.contact_phone === 'string') {
        const trimmedPhone = contact.contact_phone.trim();
        if (trimmedPhone.length > 0) {
          // Basic phone validation - allow UK format or international
          const phoneRegex = /^(\+44|0)[1-9]\d{8,9}$|^\+\d{7,15}$/;
          if (phoneRegex.test(trimmedPhone.replace(/\s/g, ''))) {
            cleanPhone = trimmedPhone;
          } else {
            console.warn('Invalid phone format, setting to null:', trimmedPhone);
            cleanPhone = null;
          }
        }
      }
      
      return {
        ...contact,
        listing_id: listingId,
        contact_phone: cleanPhone
      };
    });

    const { error } = await supabase
      .from('listing_contacts')
      .insert(contactInserts);

    if (error) {
      console.error('Contact insertion error:', error);
      throw new Error(`Failed to add contacts to draft listing: ${error.message}`);
    }

    console.log('Contacts added to draft listing successfully:', listingId);

  } catch (error) {
    console.error('Adding contacts to draft listing failed:', error);
    throw error;
  }
}

// =====================================================
// ADD FAQS TO DRAFT LISTING
// =====================================================

export async function addFAQsToDraftListing(
  listingId: string,
  faqs: Array<{
    question: string;
    answer: string;
    display_order: number;
  }>
): Promise<void> {
  // Use browser client if we're on the client side, server client otherwise
  let supabase;
  if (typeof window !== 'undefined') {
    const { browserClient } = await import('@/lib/supabase');
    supabase = browserClient;
  } else {
    supabase = createServerClient();
  }

  try {
    const faqInserts = faqs.map(faq => ({
      ...faq,
      listing_id: listingId
    }));

    const { error } = await supabase
      .from('faqs')
      .insert(faqInserts);

    if (error) {
      console.error('FAQ insertion error:', error);
      throw new Error(`Failed to add FAQs to draft listing: ${error.message}`);
    }

    console.log('FAQs added to draft listing successfully:', listingId);

  } catch (error) {
    console.error('Adding FAQs to draft listing failed:', error);
    throw error;
  }
}

// =====================================================
// ADD LOCATIONS TO DRAFT LISTING
// =====================================================

export async function addLocationsToDraftListing(
  listingId: string,
  locations: Array<{
    place_name: string;
    coordinates: [number, number];
    type: 'preferred' | 'acceptable';
    formatted_address?: string;
    region?: string;
    country?: string;
  }>
): Promise<void> {
  // Use browser client if we're on the client side, server client otherwise
  let supabase;
  if (typeof window !== 'undefined') {
    const { browserClient } = await import('@/lib/supabase');
    supabase = browserClient;
  } else {
    supabase = createServerClient();
  }

  try {
    const locationInserts = locations.map(location => ({
      listing_id: listingId,
      place_name: location.place_name,
      type: location.type,
      coordinates: {
        lat: location.coordinates[1],
        lng: location.coordinates[0]
      },
      formatted_address: location.formatted_address || location.place_name,
      region: location.region,
      country: location.country
    }));

    const { error } = await supabase
      .from('listing_locations')
      .insert(locationInserts);

    if (error) {
      console.error('Location insertion error:', error);
      throw new Error(`Failed to add locations to draft listing: ${error.message}`);
    }

    console.log('Locations added to draft listing successfully:', listingId);

  } catch (error) {
    console.error('Adding locations to draft listing failed:', error);
    throw error;
  }
}