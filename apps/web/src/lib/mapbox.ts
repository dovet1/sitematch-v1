// =====================================================
// Mapbox Integration - Story 3.2 Task 0
// Location search utilities with UK/Ireland filtering
// =====================================================

export interface LocationResult {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
  place_type: string[];
  text: string;
  context?: Array<{
    id: string;
    text: string;
    short_code?: string;
  }>;
}

export interface LocationSearchOptions {
  limit?: number;
  proximity?: [number, number];
  country?: string[];
  types?: string[];
}

// Get Mapbox token from environment
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/**
 * Search for locations using Mapbox Geocoding API
 * @param query Search query string
 * @param options Search options
 * @returns Promise resolving to array of location results
 */
export async function searchLocations(
  query: string,
  options: LocationSearchOptions = {}
): Promise<LocationResult[]> {
  // Check if Mapbox token is available
  if (!MAPBOX_TOKEN) {
    throw new Error(
      'Mapbox token not configured. Please set NEXT_PUBLIC_MAPBOX_TOKEN environment variable.'
    );
  }

  // Return empty array for empty queries
  if (!query.trim()) {
    return [];
  }

  const {
    limit = 5,
    proximity,
    country = ['GB', 'IE'], // UK and Ireland by default
    types = ['place', 'locality', 'neighborhood', 'address']
  } = options;

  try {
    // Build query parameters
    const params = new URLSearchParams({
      access_token: MAPBOX_TOKEN,
      country: country.join(','),
      types: types.join(','),
      limit: limit.toString(),
      autocomplete: 'true'
    });

    // Add proximity if provided (for location-based results)
    if (proximity) {
      params.append('proximity', proximity.join(','));
    }

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params.toString()}`;

    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid Mapbox API token. Please check your configuration.');
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      throw new Error(`Location search failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Transform Mapbox response to our format
    return data.features?.map((feature: any): LocationResult => ({
      id: feature.id,
      place_name: feature.place_name,
      center: feature.center,
      place_type: feature.place_type || [],
      text: feature.text,
      context: feature.context
    })) || [];

  } catch (error) {
    console.error('Mapbox search error:', error);
    
    // Re-throw known errors
    if (error instanceof Error) {
      throw error;
    }
    
    // Handle unknown errors
    throw new Error('An unexpected error occurred during location search');
  }
}

/**
 * Debounced search function for real-time search
 * @param query Search query
 * @param delay Debounce delay in milliseconds
 * @param options Search options
 * @returns Promise resolving to location results
 */
export function createDebouncedLocationSearch(delay: number = 300) {
  let timeoutId: NodeJS.Timeout;

  return function debouncedSearch(
    query: string,
    options?: LocationSearchOptions
  ): Promise<LocationResult[]> {
    return new Promise((resolve, reject) => {
      clearTimeout(timeoutId);
      
      timeoutId = setTimeout(async () => {
        try {
          const results = await searchLocations(query, options);
          resolve(results);
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
  };
}

/**
 * Format location for display
 * @param location Location result from Mapbox
 * @returns Formatted location string
 */
export function formatLocationDisplay(location: LocationResult): string {
  // Use the full place_name but remove country parts
  let displayName = location.place_name;
  
  // Remove country suffixes (", United Kingdom", ", England, United Kingdom", ", UK", etc.)
  displayName = displayName
    .replace(/, United Kingdom$/, '')
    .replace(/, UK$/, '')
    .replace(/, England, United Kingdom$/, ', England')
    .replace(/, Scotland, United Kingdom$/, ', Scotland')
    .replace(/, Wales, United Kingdom$/, ', Wales')
    .replace(/, Northern Ireland, United Kingdom$/, ', Northern Ireland');
  
  // For Ireland, keep it as context can be helpful
  displayName = displayName.replace(/, Ireland$/, ', Ireland');
  
  return displayName;
}

/**
 * Check if location is in UK or Ireland
 * @param location Location result
 * @returns Boolean indicating if location is in UK/Ireland
 */
export function isUKOrIreland(location: LocationResult): boolean {
  const country = location.context?.find(ctx => ctx.id.startsWith('country'));
  const shortCode = country?.short_code?.toUpperCase();
  return shortCode === 'GB' || shortCode === 'IE';
}

/**
 * Get location coordinates
 * @param location Location result
 * @returns Coordinates as [longitude, latitude]
 */
export function getLocationCoordinates(location: LocationResult): [number, number] {
  return location.center;
}

/**
 * Calculate distance between two coordinates in kilometers
 * @param coord1 First coordinate [lng, lat]
 * @param coord2 Second coordinate [lng, lat]
 * @returns Distance in kilometers
 */
export function calculateDistance(
  coord1: [number, number],
  coord2: [number, number]
): number {
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;

  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}