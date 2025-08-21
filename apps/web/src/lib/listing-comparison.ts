// =====================================================
// Listing Comparison Utilities
// Compares current listing data with approved version
// =====================================================

import { createClientClient } from '@/lib/supabase';

/**
 * Compares current listing data with the latest approved version
 * Returns true if there are changes that require approval
 */
export async function hasListingChanges(listingId: string): Promise<{
  hasChanges: boolean;
  approvedVersion?: any;
  error?: string;
}> {
  try {
    const supabase = createClientClient();

    // Get the latest approved version
    const { data: approvedVersion, error: versionError } = await supabase
      .from('listing_versions')
      .select('*')
      .eq('listing_id', listingId)
      .eq('status', 'approved')
      .order('version_number', { ascending: false })
      .limit(1)
      .single();

    if (versionError) {
      // No approved version means this is still a draft
      if (versionError.code === 'PGRST116') {
        return { hasChanges: false };
      }
      return { hasChanges: false, error: versionError.message };
    }

    if (!approvedVersion) {
      return { hasChanges: false };
    }

    // Get current listing data with all related data
    const [
      { data: listing },
      { data: contacts },
      { data: locations },
      { data: faqs },
      { data: sectors },
      { data: useClasses },
      { data: files }
    ] = await Promise.all([
      supabase.from('listings').select('*').eq('id', listingId).single(),
      supabase.from('listing_contacts').select('*').eq('listing_id', listingId),
      supabase.from('listing_locations').select('*').eq('listing_id', listingId),
      supabase.from('faqs').select('*').eq('listing_id', listingId).order('display_order'),
      supabase.from('listing_sectors').select('sector_id').eq('listing_id', listingId),
      supabase.from('listing_use_classes').select('use_class_id').eq('listing_id', listingId),
      supabase.from('file_uploads').select('*').eq('listing_id', listingId).order('display_order')
    ]);

    const approvedContent = approvedVersion.content;

    // Compare listing main fields
    const listingFields = [
      'company_name', 'description', 'contact_name', 'contact_title',
      'contact_email', 'contact_phone', 'property_page_link',
      'site_size_min', 'site_size_max', 'dwelling_count_min',
      'dwelling_count_max', 'site_acreage_min', 'site_acreage_max'
    ];

    for (const field of listingFields) {
      if (listing[field] !== approvedContent.listing?.[field]) {
        return { hasChanges: true, approvedVersion };
      }
    }

    // Compare contacts
    if (!compareArrays(contacts || [], approvedContent.contacts || [], ['id', 'created_at', 'updated_at'])) {
      return { hasChanges: true, approvedVersion };
    }

    // Compare locations
    if (!compareArrays(locations || [], approvedContent.locations || [], ['id', 'created_at'])) {
      return { hasChanges: true, approvedVersion };
    }

    // Compare FAQs
    if (!compareArrays(faqs || [], approvedContent.faqs || [], ['id', 'created_at', 'updated_at'])) {
      return { hasChanges: true, approvedVersion };
    }

    // Compare sectors (just the IDs)
    const currentSectorIds = (sectors || []).map((s: any) => s.sector_id).sort();
    const approvedSectorIds = (approvedContent.sectors || []).map((s: any) => s.sector_id).sort();
    if (JSON.stringify(currentSectorIds) !== JSON.stringify(approvedSectorIds)) {
      return { hasChanges: true, approvedVersion };
    }

    // Compare use classes (just the IDs)
    const currentUseClassIds = (useClasses || []).map((uc: any) => uc.use_class_id).sort();
    const approvedUseClassIds = (approvedContent.use_classes || []).map((uc: any) => uc.use_class_id).sort();
    
    console.log('Use class comparison:', {
      current: currentUseClassIds,
      approved: approvedUseClassIds,
      matches: JSON.stringify(currentUseClassIds) === JSON.stringify(approvedUseClassIds)
    });
    
    if (JSON.stringify(currentUseClassIds) !== JSON.stringify(approvedUseClassIds)) {
      return { hasChanges: true, approvedVersion };
    }

    // Compare files (excluding temporary fields)
    const fileCompareFields = ['file_name', 'file_type', 'caption', 'is_primary', 'display_order'];
    const currentFiles = (files || []).map((f: any) => 
      fileCompareFields.reduce((acc: any, field) => {
        acc[field] = f[field];
        return acc;
      }, {})
    );
    const approvedFiles = (approvedContent.files || []).map((f: any) => 
      fileCompareFields.reduce((acc: any, field) => {
        acc[field] = f[field];
        return acc;
      }, {})
    );
    
    if (JSON.stringify(currentFiles) !== JSON.stringify(approvedFiles)) {
      return { hasChanges: true, approvedVersion };
    }

    return { hasChanges: false, approvedVersion };
  } catch (error) {
    console.error('Error comparing listing versions:', error);
    return { hasChanges: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Helper function to compare arrays of objects
 * Ignores specified fields during comparison
 */
function compareArrays(current: any[], approved: any[], ignoreFields: string[] = []): boolean {
  if (current.length !== approved.length) {
    return false;
  }

  const normalizeObject = (obj: any) => {
    const normalized = { ...obj };
    ignoreFields.forEach(field => delete normalized[field]);
    return normalized;
  };

  const currentNormalized = current.map(normalizeObject);
  const approvedNormalized = approved.map(normalizeObject);

  return JSON.stringify(currentNormalized) === JSON.stringify(approvedNormalized);
}

/**
 * Get the latest approved version content for a listing
 */
export async function getLatestApprovedVersion(listingId: string) {
  const supabase = createClientClient();
  
  const { data, error } = await supabase
    .from('listing_versions')
    .select('*')
    .eq('listing_id', listingId)
    .eq('status', 'approved')
    .order('version_number', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    return null;
  }

  return data;
}