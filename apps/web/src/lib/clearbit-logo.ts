// =====================================================
// Clearbit Logo API Integration - Story 9.0
// Service for fetching company logos via Clearbit API
// =====================================================

/**
 * Domain validation regex pattern
 * Validates standard domain format (e.g., company.com)
 * Fixed to properly handle domains like eatcommonroom.com
 */
const DOMAIN_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

/**
 * Cache for storing logo lookup results
 * Prevents repeated API calls for the same domain
 */
const logoCache = new Map<string, { url: string | null; timestamp: number }>();

/**
 * Cache expiry time in milliseconds (1 hour)
 */
const CACHE_EXPIRY_MS = 60 * 60 * 1000;

/**
 * Rate limiting state
 */
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 1000; // 1 second between requests

/**
 * Validates if a domain string is in correct format
 * @param domain - The domain to validate (e.g., "apple.com")
 * @returns true if domain format is valid
 */
export function validateDomain(domain: string): boolean {
  if (!domain || typeof domain !== 'string') {
    return false;
  }
  
  const cleanDomain = domain.trim().toLowerCase();
  
  // Remove protocol if present
  const domainWithoutProtocol = cleanDomain.replace(/^https?:\/\//, '');
  
  // Remove www. if present
  const finalDomain = domainWithoutProtocol.replace(/^www\./, '');
  
  return DOMAIN_REGEX.test(finalDomain);
}

/**
 * Normalizes domain string for consistent processing
 * Removes protocols, www., paths, and other URL components
 * @param domain - Raw domain input
 * @returns Normalized domain string (e.g., "apple.com")
 */
export function normalizeDomain(domain: string): string {
  if (!domain || typeof domain !== 'string') {
    return '';
  }
  
  let normalized = domain.trim().toLowerCase();
  
  // Remove protocol if present
  normalized = normalized.replace(/^https?:\/\//, '');
  
  // Remove www. if present
  normalized = normalized.replace(/^www\./, '');
  
  // Remove any path, query parameters, or fragments
  // This handles cases like "boots.com/abc" -> "boots.com"
  normalized = normalized.split('/')[0];
  normalized = normalized.split('?')[0];
  normalized = normalized.split('#')[0];
  
  // Remove trailing slash (in case it wasn't caught by split)
  normalized = normalized.replace(/\/$/, '');
  
  return normalized;
}

/**
 * Formats domain with https:// prefix for display or storage
 * @param domain - Raw domain input
 * @returns Domain with https:// prefix (e.g., "https://apple.com")
 */
export function formatDomainWithProtocol(domain: string): string {
  if (!domain || typeof domain !== 'string') {
    return '';
  }
  
  const normalized = normalizeDomain(domain);
  if (!normalized) {
    return '';
  }
  
  return `https://${normalized}`;
}

/**
 * Checks if a cached result is still valid
 * @param cacheEntry - Cache entry to check
 * @returns true if cache entry is still valid
 */
function isCacheValid(cacheEntry: { url: string | null; timestamp: number }): boolean {
  return Date.now() - cacheEntry.timestamp < CACHE_EXPIRY_MS;
}

/**
 * Implements basic rate limiting
 * @returns Promise that resolves when it's safe to make a request
 */
async function rateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
    const waitTime = MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastRequestTime = Date.now();
}

/**
 * Fetches company logo from Clearbit API
 * @param domain - Company domain (e.g., "apple.com")
 * @returns Promise resolving to logo URL or null if not found
 * @throws Error if domain is invalid or request fails
 */
export async function fetchCompanyLogo(domain: string): Promise<string | null> {
  // Validate domain format
  if (!validateDomain(domain)) {
    throw new Error('Invalid domain format. Please enter a valid domain (e.g., company.com)');
  }
  
  const normalizedDomain = normalizeDomain(domain);
  
  // Check cache first
  const cacheEntry = logoCache.get(normalizedDomain);
  if (cacheEntry && isCacheValid(cacheEntry)) {
    return cacheEntry.url;
  }
  
  // Apply rate limiting
  await rateLimit();
  
  try {
    // Clearbit Logo API endpoint with high quality parameters
    const logoUrl = `https://logo.clearbit.com/${normalizedDomain}?size=512&format=png`;
    
    // Use HEAD request to check if logo exists without downloading
    const response = await fetch(logoUrl, {
      method: 'HEAD',
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });
    
    const result = response.ok ? logoUrl : null;
    
    // Cache the result
    logoCache.set(normalizedDomain, {
      url: result,
      timestamp: Date.now()
    });
    
    return result;
    
  } catch (error) {
    // Handle network errors, timeouts, etc.
    console.error('Clearbit API request failed:', error);
    
    // Cache the failure to prevent immediate retries
    logoCache.set(normalizedDomain, {
      url: null,
      timestamp: Date.now()
    });
    
    // Re-throw with user-friendly message
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Error('Request timed out. Please try again.');
    }
    
    throw new Error('Unable to fetch logo. Please check the domain or try uploading your own logo.');
  }
}

/**
 * Gets the full logo URL for display purposes
 * This method always returns the full URL, even for cached entries
 * @param domain - Company domain
 * @param size - Logo size (optional, defaults to 512 for high quality)
 * @param format - Image format (optional, defaults to png)
 * @returns Full Clearbit logo URL or null
 */
export function getClearbitLogoUrl(domain: string, size: number = 512, format: string = 'png'): string | null {
  if (!validateDomain(domain)) {
    return null;
  }
  
  const normalizedDomain = normalizeDomain(domain);
  // Clearbit supports size parameter and format
  // Size can be any value but common ones are 128, 256, 512
  // Format can be png, jpg, or svg
  return `https://logo.clearbit.com/${normalizedDomain}?size=${size}&format=${format}`;
}

/**
 * Clears the logo cache
 * Useful for testing or when cache needs to be reset
 */
export function clearLogoCache(): void {
  logoCache.clear();
}

/**
 * Gets cache statistics for debugging
 * @returns Object with cache size and entries
 */
export function getCacheStats(): { size: number; entries: string[] } {
  return {
    size: logoCache.size,
    entries: Array.from(logoCache.keys())
  };
}