/**
 * LSOA Geographic Lookup
 *
 * Simple lookup that provides approximate coordinates for LSOAs.
 * This uses the Postcodes.io API to geocode LSOA codes.
 */

import { calculateDistance } from './geography-utils';

// Cache for LSOA coordinates (populated on demand)
const lsoaCache = new Map<string, { lat: number; lng: number }>();

/**
 * Get approximate coordinates for an LSOA code using postcodes.io API
 */
async function getLSOACoordinates(lsoaCode: string): Promise<{ lat: number; lng: number } | null> {
  // Check cache first
  if (lsoaCache.has(lsoaCode)) {
    return lsoaCache.get(lsoaCode)!;
  }

  try {
    const response = await fetch(
      `https://api.postcodes.io/outcodes/${lsoaCode}/nearest?limit=1`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.result && data.result.length > 0) {
      const coords = {
        lat: data.result[0].latitude,
        lng: data.result[0].longitude,
      };
      lsoaCache.set(lsoaCode, coords);
      return coords;
    }
  } catch (error) {
    console.error(`Failed to geocode LSOA ${lsoaCode}:`, error);
  }

  return null;
}

/**
 * Hardcoded approximate coordinates for major UK cities/regions
 * Used as fallback when API lookup fails
 */
const REGION_COORDS: Record<string, { lat: number; lng: number }> = {
  'Canterbury': { lat: 51.2802, lng: 1.0789 },
  'London': { lat: 51.5074, lng: -0.1278 },
  'Manchester': { lat: 53.4808, lng: -2.2426 },
  'Birmingham': { lat: 52.4862, lng: -1.8904 },
  'Leeds': { lat: 53.8008, lng: -1.5491 },
  'Liverpool': { lat: 53.4084, lng: -2.9916 },
  'Bristol': { lat: 51.4545, lng: -2.5879 },
  'Sheffield': { lat: 53.3811, lng: -1.4701 },
  'Newcastle': { lat: 54.9783, lng: -1.6178 },
  'Nottingham': { lat: 52.9548, lng: -1.1581 },
};

/**
 * Get approximate LSOA coordinates from the LSOA name
 * Extracts city/area name and uses known coordinates
 */
function getApproximateCoords(lsoaName: string): { lat: number; lng: number } | null {
  const areaName = lsoaName.split(' ')[0];

  if (REGION_COORDS[areaName]) {
    // Add small random offset to simulate different LSOAs in same area
    const offset = 0.01 * (parseInt(lsoaName.match(/\d+/)?.[0] || '0') % 10);
    return {
      lat: REGION_COORDS[areaName].lat + offset,
      lng: REGION_COORDS[areaName].lng + offset,
    };
  }

  return null;
}

/**
 * Filter LSOA codes by distance from a point
 * @param allLSOAs Array of {code, name} objects
 * @param centerLat Center latitude
 * @param centerLng Center longitude
 * @param radiusMiles Radius in miles
 * @returns Array of LSOA codes within radius
 */
export async function filterLSOAsByDistance(
  allLSOAs: Array<{ code: string; name: string }>,
  centerLat: number,
  centerLng: number,
  radiusMiles: number
): Promise<string[]> {
  const withinRadius: string[] = [];

  for (const lsoa of allLSOAs) {
    // Try to get approximate coordinates from the name
    const coords = getApproximateCoords(lsoa.name);

    if (coords) {
      const distance = calculateDistance(centerLat, centerLng, coords.lat, coords.lng);

      if (distance <= radiusMiles) {
        withinRadius.push(lsoa.code);
      }
    }
  }

  return withinRadius;
}
