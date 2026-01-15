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
  const supabase = await createServerClient();

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
    contact_area: string;
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
    supabase = await createServerClient();
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
    company_name?: string;
    site_size_min?: number;
    site_size_max?: number;
    brochure_url?: string;
    // Logo method fields - Story 9.0
    clearbit_logo?: boolean;
    company_domain?: string;
    listing_type?: 'residential' | 'commercial';
    contact_name?: string;
    contact_title?: string;
    contact_email?: string;
    contact_phone?: string;
    contact_area?: string;
  }
): Promise<void> {
  console.log('=== FINALIZE DRAFT DEBUG ===');
  console.log('Listing ID:', listingId);
  console.log('Final data company_name:', finalData.company_name);
  console.log('Final data company_name type:', typeof finalData.company_name);
  console.log('Final data keys:', Object.keys(finalData));
  // Use browser client if we're on the client side, server client otherwise
  let supabase;
  if (typeof window !== 'undefined') {
    const { browserClient } = await import('@/lib/supabase');
    supabase = browserClient;
  } else {
    supabase = await createServerClient();
  }

  try {
    const updateData: any = {
      title: finalData.title,
      description: finalData.description,
      status: finalData.status,
      company_name: finalData.company_name || 'Company Name Required',
      listing_type: finalData.listing_type || 'commercial',
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
    // Logo method fields - Story 9.0
    if (finalData.clearbit_logo !== undefined) {
      updateData.clearbit_logo = finalData.clearbit_logo;
    }
    if (finalData.company_domain) {
      updateData.company_domain = finalData.company_domain;
    }
    // company_name is now always set in the base updateData above
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
    if (finalData.contact_area) {
      updateData.contact_area = finalData.contact_area;
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
    contact_area?: string;
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
    supabase = await createServerClient();
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
    supabase = await createServerClient();
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
// ADD SECTORS TO DRAFT LISTING
// =====================================================

export async function addSectorsToDraftListing(
  listingId: string,
  sectorNames: string[]
): Promise<void> {
  // Use browser client if we're on the client side, server client otherwise
  let supabase;
  if (typeof window !== 'undefined') {
    const { browserClient } = await import('@/lib/supabase');
    supabase = browserClient;
  } else {
    supabase = await createServerClient();
  }

  try {
    // Get sector IDs from names
    const { data: sectors, error: sectorsError } = await supabase
      .from('sectors')
      .select('id, name')
      .in('name', sectorNames);

    if (sectorsError) {
      console.error('Error fetching sectors:', sectorsError);
      throw new Error(`Failed to fetch sectors: ${sectorsError.message}`);
    }

    if (!sectors || sectors.length === 0) {
      console.log('No matching sectors found for:', sectorNames);
      return;
    }

    // Clear existing sectors first
    await supabase
      .from('listing_sectors')
      .delete()
      .eq('listing_id', listingId);

    // Insert new sectors
    const sectorInserts = sectors.map(sector => ({
      listing_id: listingId,
      sector_id: sector.id
    }));

    const { error } = await supabase
      .from('listing_sectors')
      .insert(sectorInserts);

    if (error) {
      console.error('Sector insertion error:', error);
      throw new Error(`Failed to add sectors to draft listing: ${error.message}`);
    }

    console.log('Sectors added to draft listing successfully:', listingId);

  } catch (error) {
    console.error('Adding sectors to draft listing failed:', error);
    throw error;
  }
}

// =====================================================
// ADD USE CLASSES TO DRAFT LISTING
// =====================================================

export async function addUseClassesToDraftListing(
  listingId: string,
  useClassIds: string[]
): Promise<void> {
  // Use browser client if we're on the client side, server client otherwise
  let supabase;
  if (typeof window !== 'undefined') {
    const { browserClient } = await import('@/lib/supabase');
    supabase = browserClient;
  } else {
    supabase = await createServerClient();
  }

  try {
    // Get use class IDs - they could be passed as IDs or codes
    const { data: useClasses, error: useClassesError } = await supabase
      .from('use_classes')
      .select('id, code')
      .or(`id.in.(${useClassIds.join(',')}),code.in.(${useClassIds.join(',')})`);

    if (useClassesError) {
      console.error('Error fetching use classes:', useClassesError);
      throw new Error(`Failed to fetch use classes: ${useClassesError.message}`);
    }

    if (!useClasses || useClasses.length === 0) {
      console.log('No matching use classes found for:', useClassIds);
      return;
    }

    // Clear existing use classes first
    await supabase
      .from('listing_use_classes')
      .delete()
      .eq('listing_id', listingId);

    // Insert new use classes
    const useClassInserts = useClasses.map(useClass => ({
      listing_id: listingId,
      use_class_id: useClass.id
    }));

    const { error } = await supabase
      .from('listing_use_classes')
      .insert(useClassInserts);

    if (error) {
      console.error('Use class insertion error:', error);
      throw new Error(`Failed to add use classes to draft listing: ${error.message}`);
    }

    console.log('Use classes added to draft listing successfully:', listingId);

  } catch (error) {
    console.error('Adding use classes to draft listing failed:', error);
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
    supabase = await createServerClient();
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