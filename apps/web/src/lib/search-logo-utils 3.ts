// =====================================================
// Search Logo Utilities
// Utilities for handling logo display in search results
// =====================================================

import { SearchResult } from '@/types/search';
import { getClearbitLogoUrl } from '@/lib/clearbit-logo';

/**
 * Get the appropriate logo URL for a search result listing
 * Implements correct fallback logic:
 * 1. If clearbit_logo is true, use company_domain for Clearbit
 * 2. If clearbit_logo is false, use uploaded logo from file_uploads table
 * 3. If no uploaded logo exists, fall back to initials (handled by component)
 * 
 * @param listing - The search result listing
 * @returns Logo URL or null if no logo available
 */
export function getSearchResultLogoUrl(listing: SearchResult): string | null {
  // 1. Check if listing uses Clearbit logo and has a domain
  if (listing.clearbit_logo && listing.company_domain) {
    // Request high-quality 512px PNG logos from Clearbit
    return getClearbitLogoUrl(listing.company_domain, 512, 'png');
  }
  
  // 2. If clearbit_logo is false, use uploaded logo URL if available
  if (!listing.clearbit_logo && listing.logo_url) {
    return listing.logo_url;
  }
  
  // 3. No logo available - component will show initials
  return null;
}

/**
 * Check if a search result has any logo available
 * 
 * @param listing - The search result listing
 * @returns True if logo is available, false otherwise
 */
export function hasSearchResultLogo(listing: SearchResult): boolean {
  return getSearchResultLogoUrl(listing) !== null;
}

/**
 * Get logo source type for analytics or debugging
 * 
 * @param listing - The search result listing
 * @returns 'clearbit', 'uploaded', or 'none'
 */
export function getLogoSourceType(listing: SearchResult): 'clearbit' | 'uploaded' | 'none' {
  // 1. Check if listing uses Clearbit logo and has a domain
  if (listing.clearbit_logo && listing.company_domain) {
    return 'clearbit';
  }
  
  // 2. If clearbit_logo is false and has uploaded logo
  if (!listing.clearbit_logo && listing.logo_url) {
    return 'uploaded';
  }
  
  return 'none';
}