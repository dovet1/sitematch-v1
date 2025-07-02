// =====================================================
// Listings Utilities - Story 3.0
// Database operations and utility functions for listings
// =====================================================

import { createClient } from '@/lib/supabase';
import { validateListingData } from '@/lib/listings-validation';
import type {
  Listing,
  ListingWithDetails,
  CreateListingRequest,
  UpdateListingRequest,
  UpdateListingStatusRequest,
  ListingsQueryParams,
  ListingsResponse,
  Sector,
  UseClass,
  ValidationError,
  ListingStatus
} from '@/types/listings';

// =====================================================
// DATABASE CLIENT
// =====================================================

const supabase = createClient();

// =====================================================
// REFERENCE DATA FUNCTIONS
// =====================================================

export async function getSectors(): Promise<Sector[]> {
  const { data, error } = await supabase
    .from('sectors')
    .select('*')
    .order('name');

  if (error) {
    throw new Error(`Failed to fetch sectors: ${error.message}`);
  }

  return data || [];
}

export async function getUseClasses(): Promise<UseClass[]> {
  const { data, error } = await supabase
    .from('use_classes')
    .select('*')
    .order('name');

  if (error) {
    throw new Error(`Failed to fetch use classes: ${error.message}`);
  }

  return data || [];
}

// =====================================================
// LISTING CRUD OPERATIONS
// =====================================================

export async function createListing(
  listingData: CreateListingRequest,
  userId: string,
  orgId: string
): Promise<Listing> {
  // Validate required fields
  const validation = validateListingData(listingData);
  if (!validation.isValid) {
    throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
  }

  // Start a transaction to create listing and related data
  const { data: listing, error: listingError } = await supabase
    .from('listings')
    .insert({
      org_id: orgId,
      title: listingData.title,
      description: listingData.description,
      sector_id: listingData.sector_id,
      use_class_id: listingData.use_class_id,
      site_size_min: listingData.site_size_min,
      site_size_max: listingData.site_size_max,
      brochure_url: listingData.brochure_url,
      created_by: userId,
      status: 'pending'
    })
    .select()
    .single();

  if (listingError) {
    throw new Error(`Failed to create listing: ${listingError.message}`);
  }

  // Create related data if provided
  if (listingData.locations && listingData.locations.length > 0) {
    const { error: locationsError } = await supabase
      .from('listing_locations')
      .insert(
        listingData.locations.map(location => ({
          listing_id: listing.id,
          ...location
        }))
      );

    if (locationsError) {
      console.error('Failed to create listing locations:', locationsError);
    }
  }

  if (listingData.media_files && listingData.media_files.length > 0) {
    const { error: mediaError } = await supabase
      .from('media_files')
      .insert(
        listingData.media_files.map(media => ({
          listing_id: listing.id,
          ...media
        }))
      );

    if (mediaError) {
      console.error('Failed to create media files:', mediaError);
    }
  }

  if (listingData.faqs && listingData.faqs.length > 0) {
    const { error: faqsError } = await supabase
      .from('faqs')
      .insert(
        listingData.faqs.map(faq => ({
          listing_id: listing.id,
          ...faq
        }))
      );

    if (faqsError) {
      console.error('Failed to create FAQs:', faqsError);
    }
  }

  return listing;
}

export async function getListings(params: ListingsQueryParams = {}): Promise<ListingsResponse> {
  const {
    page = 1,
    limit = 10,
    status,
    sector_id,
    use_class_id,
    org_id,
    search
  } = params;

  let query = supabase
    .from('listings')
    .select(`
      *,
      sector:sectors(*),
      use_class:use_classes(*),
      locations:listing_locations(*),
      media_files(*),
      faqs(*)
    `);

  // Apply filters
  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  if (sector_id) {
    query = query.eq('sector_id', sector_id);
  }

  if (use_class_id) {
    query = query.eq('use_class_id', use_class_id);
  }

  if (org_id) {
    query = query.eq('org_id', org_id);
  }

  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
  }

  // Get total count
  const { count } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true });

  // Apply pagination and ordering
  const offset = (page - 1) * limit;
  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch listings: ${error.message}`);
  }

  return {
    data: data || [],
    meta: {
      total: count || 0,
      page,
      limit,
      total_pages: Math.ceil((count || 0) / limit)
    }
  };
}

export async function getListingById(id: string): Promise<ListingWithDetails | null> {
  const { data, error } = await supabase
    .from('listings')
    .select(`
      *,
      sector:sectors(*),
      use_class:use_classes(*),
      locations:listing_locations(*),
      media_files(*),
      faqs(*)
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch listing: ${error.message}`);
  }

  return data;
}

export async function updateListing(
  id: string,
  updates: UpdateListingRequest
): Promise<Listing> {
  // Validate updates
  if (updates.title || updates.sector_id || updates.use_class_id) {
    const validation = validateListingData(updates as CreateListingRequest);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
    }
  }

  const { data, error } = await supabase
    .from('listings')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update listing: ${error.message}`);
  }

  return data;
}

export async function updateListingStatus(
  id: string,
  statusUpdate: UpdateListingStatusRequest
): Promise<Listing> {
  const { data, error } = await supabase
    .from('listings')
    .update({
      status: statusUpdate.status,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update listing status: ${error.message}`);
  }

  return data;
}

export async function deleteListing(id: string): Promise<void> {
  const { error } = await supabase
    .from('listings')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete listing: ${error.message}`);
  }
}

// =====================================================
// VALIDATION FUNCTIONS (Re-exported from validation module)
// =====================================================

export {
  validateListingData,
  isValidUUID,
  formatSiteSize,
  getStatusColor,
  getStatusLabel,
  type ValidationResult
} from './listings-validation';