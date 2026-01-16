// =====================================================
// Version Management Utilities
// Comprehensive versioning system for listings
// =====================================================

'use server';

import { createServerClient } from '@/lib/supabase';

export type VersionStatus = 'draft' | 'pending_review' | 'approved' | 'rejected';

/**
 * Creates a comprehensive version snapshot of a listing and all its related data
 */
export async function createListingVersion(
  listingId: string,
  status: VersionStatus,
  userId: string,
  supabase?: any
): Promise<{ success: boolean; versionId?: string; error?: string }> {
  try {
    const client = supabase || await createServerClient();

    // First get the main listing data including linked agency
    const { data: listing, error: listingError } = await client
      .from('listings')
      .select(`
        *,
        linked_agency:agencies(
          id,
          name,
          logo_url,
          geographic_patch,
          classification
        )
      `)
      .eq('id', listingId)
      .single();

    if (listingError || !listing) {
      return { success: false, error: 'Listing not found' };
    }

    // Fetch all related data for this listing
    const [
      { data: contacts },
      { data: locations }, 
      { data: faqs },
      { data: sectors },
      { data: useClasses },
      { data: files }
    ] = await Promise.all([
      client.from('listing_contacts').select('*').eq('listing_id', listingId),
      client.from('listing_locations').select('*').eq('listing_id', listingId),
      client.from('faqs').select('*').eq('listing_id', listingId),
      client.from('listing_sectors').select('sector_id, sectors(id, name)').eq('listing_id', listingId),
      client.from('listing_use_classes').select('use_class_id, use_classes(id, name, code)').eq('listing_id', listingId),
      client.from('file_uploads').select('*').eq('listing_id', listingId)
    ]);

    // Create comprehensive content snapshot
    const content = {
      // Main listing data
      listing: {
        ...listing,
        // Ensure we have the current state
        updated_at: new Date().toISOString()
      },
      
      // All related data as arrays
      contacts: contacts || [],
      locations: locations || [],
      faqs: (faqs || []).sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0)),
      sectors: (sectors || []).map((s: any) => ({
        sector_id: s.sector_id,
        sector: s.sectors
      })),
      use_classes: (useClasses || []).map((uc: any) => ({
        use_class_id: uc.use_class_id,
        use_class: uc.use_classes
      })),
      files: (files || []).sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0)),
      
      // Snapshot metadata
      snapshot_created_at: new Date().toISOString(),
      snapshot_created_by: userId,
      snapshot_status: status
    };

    // Get the next version number for this listing
    const { data: maxVersionData } = await client
      .from('listing_versions')
      .select('version_number')
      .eq('listing_id', listingId)
      .order('version_number', { ascending: false })
      .limit(1);

    const nextVersionNumber = (maxVersionData?.[0]?.version_number || 0) + 1;

    // Create the version record
    const versionData = {
      listing_id: listingId,
      version_number: nextVersionNumber,
      content,
      status,
      created_by: userId,
      is_live: status === 'approved',
      submitted_at: new Date().toISOString()
    };

    const { data: version, error: versionError } = await client
      .from('listing_versions')
      .insert([versionData])
      .select()
      .single();

    if (versionError) {
      console.error('Error creating version:', versionError);
      return { success: false, error: `Failed to create version: ${versionError.message}` };
    }

    // Update the listing to reference this version
    const updates: any = {
      last_edited_at: new Date().toISOString()
    };

    if (status === 'draft' || status === 'pending_review') {
      updates.current_version_id = version.id;
    }

    if (status === 'approved') {
      updates.live_version_id = version.id;
      updates.status = 'approved';
    }

    await client
      .from('listings')
      .update(updates)
      .eq('id', listingId);

    console.log(`Created ${status} version ${version.id} for listing ${listingId}`);

    return { success: true, versionId: version.id };

  } catch (error) {
    console.error('Error in createListingVersion:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create version' 
    };
  }
}

/**
 * Gets the live (published) version of a listing for public display
 */
export async function getLiveListingVersion(listingId: string): Promise<any> {
  const supabase = await createServerClient();
  
  const { data: listing } = await supabase
    .from('listings')
    .select('live_version_id')
    .eq('id', listingId)
    .single();

  if (!listing?.live_version_id) {
    // Fallback to current database state for listings without versions
    // This should only happen during migration or if something went wrong
    console.warn(`No live version found for listing ${listingId}, falling back to current state`);
    return await getCurrentDatabaseState(listingId);
  }

  const { data: version } = await supabase
    .from('listing_versions')
    .select('content')
    .eq('id', listing.live_version_id)
    .single();

  return version?.content || null;
}

/**
 * Gets the current draft version of a listing for editing
 */
export async function getCurrentListingVersion(listingId: string): Promise<any> {
  const supabase = await createServerClient();
  
  const { data: listing } = await supabase
    .from('listings')
    .select('current_version_id, live_version_id')
    .eq('id', listingId)
    .single();

  if (!listing?.current_version_id) {
    // If no current version, fall back to live version, then current database state
    if (listing?.live_version_id) {
      const { data: version } = await supabase
        .from('listing_versions')
        .select('content')
        .eq('id', listing.live_version_id)
        .single();
      return version?.content || null;
    }
    
    // Final fallback to current database state
    console.warn(`No current or live version found for listing ${listingId}, falling back to current state`);
    return await getCurrentDatabaseState(listingId);
  }

  const { data: version } = await supabase
    .from('listing_versions')
    .select('content')
    .eq('id', listing.current_version_id)
    .single();

  return version?.content || null;
}

/**
 * Submits a listing for review by creating a pending_review version
 */
export async function submitListingForReview(
  listingId: string, 
  userId: string
): Promise<{ success: boolean; versionId?: string; error?: string }> {
  try {
    console.log('submitListingForReview called with:', { listingId, userId });
    
    const result = await createListingVersion(listingId, 'pending_review', userId);
    
    console.log('createListingVersion result:', result);
    
    if (result.success) {
      console.log('Version created successfully, updating listing status...');
      // Update the listing status
      const supabase = await createServerClient();
      const { data, error: updateError } = await supabase
        .from('listings')
        .update({ 
          status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', listingId)
        .select();
      
      if (updateError) {
        console.error('Error updating listing status:', updateError);
        return { success: false, error: `Failed to update listing status: ${updateError.message}` };
      }
      
      console.log('Successfully updated listing status:', data);
    }
    
    return result;
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to submit for review' 
    };
  }
}

/**
 * Restores a listing and all its related data from a version snapshot
 * This is useful for displaying what the public sees vs what the user is editing
 */
export async function getListingFromVersion(
  listingId: string,
  usePublishedVersion: boolean = false
): Promise<any> {
  try {
    const supabase = await createServerClient();
    
    // Get both version fields and determine which one to use
    const { data: listing } = await supabase
      .from('listings')
      .select('live_version_id, current_version_id')
      .eq('id', listingId)
      .single();

    const versionId = usePublishedVersion 
      ? listing?.live_version_id 
      : listing?.current_version_id;
    
    if (!versionId) {
      // Fallback to current database state if no version exists
      return await getCurrentDatabaseState(listingId);
    }

    const { data: version } = await supabase
      .from('listing_versions')
      .select('content')
      .eq('id', versionId)
      .single();

    return version?.content || null;
    
  } catch (error) {
    console.error('Error getting listing from version:', error);
    return null;
  }
}

/**
 * Fallback function to get current state from database tables
 * Used when no version snapshot exists
 */
async function getCurrentDatabaseState(listingId: string): Promise<any> {
  const supabase = await createServerClient();
  
  const [
    { data: listing },
    { data: contacts },
    { data: locations }, 
    { data: faqs },
    { data: sectors },
    { data: useClasses },
    { data: files }
  ] = await Promise.all([
    supabase.from('listings').select(`
      *,
      linked_agency:agencies(
        id,
        name,
        logo_url,
        geographic_patch,
        classification
      )
    `).eq('id', listingId).single(),
    supabase.from('listing_contacts').select('*').eq('listing_id', listingId),
    supabase.from('listing_locations').select('*').eq('listing_id', listingId),
    supabase.from('faqs').select('*').eq('listing_id', listingId),
    supabase.from('listing_sectors').select('sector_id, sectors(id, name)').eq('listing_id', listingId),
    supabase.from('listing_use_classes').select('use_class_id, use_classes(id, name, code)').eq('listing_id', listingId),
    supabase.from('file_uploads').select('*').eq('listing_id', listingId)
  ]);

  if (!listing) return null;

  return {
    listing,
    contacts: contacts || [],
    locations: locations || [],
    faqs: (faqs || []).sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0)),
    sectors: (sectors || []).map((s: any) => ({
      sector_id: s.sector_id,
      sector: s.sectors
    })),
    use_classes: (useClasses || []).map((uc: any) => ({
      use_class_id: uc.use_class_id,
      use_class: uc.use_classes
    })),
    files: (files || []).sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))
  };
}