// =====================================================
// Listing Logo Utilities - Story 9.0
// Utilities for handling logo display logic
// =====================================================

import { getClearbitLogoUrl } from './clearbit-logo';

/**
 * Gets the appropriate logo URL for display based on logo method
 * @param listing - Listing object with logo fields
 * @returns Logo URL for display or null if no logo
 */
export function getListingLogoUrl(listing: {
  clearbit_logo: boolean;
  company_domain?: string | null;
  logo_url?: string | null;
}): string | null {
  // If using Clearbit logo, generate URL dynamically from domain
  if (listing.clearbit_logo && listing.company_domain) {
    return getClearbitLogoUrl(listing.company_domain);
  }
  
  // If using uploaded logo, return stored URL
  if (!listing.clearbit_logo && listing.logo_url) {
    return listing.logo_url;
  }
  
  // No logo available
  return null;
}

/**
 * Gets the logo URL for form display (includes preview URLs)
 * @param formData - Form data with logo fields
 * @returns Logo URL for display or null if no logo
 */
export function getFormLogoUrl(formData: {
  clearbitLogo?: boolean;
  companyDomain?: string;
  logoPreview?: string;
  logoUrl?: string;
}): string | null {
  // If using Clearbit and we have a preview, use it
  if (formData.clearbitLogo && formData.logoPreview) {
    return formData.logoPreview;
  }
  
  // If using Clearbit and we have a domain, generate URL
  if (formData.clearbitLogo && formData.companyDomain) {
    return getClearbitLogoUrl(formData.companyDomain);
  }
  
  // If using upload method, return the stored/preview URL
  if (!formData.clearbitLogo && (formData.logoPreview || formData.logoUrl)) {
    return formData.logoPreview || formData.logoUrl || null;
  }
  
  // No logo available
  return null;
}