/**
 * Mapbox Isochrone API Integration
 * Fetches realistic reachable areas based on drive/walk time
 */

export type IsochroneProfile = 'walking' | 'driving' | 'driving-traffic';

export interface IsochroneOptions {
  minutes: number;
  profile: IsochroneProfile;
}

export interface IsochroneResult {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: {
    contour: number;
    color: string;
    opacity: number;
  };
}

// Get Mapbox token from environment
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/**
 * Fetch isochrone polygon from Mapbox API
 * @param lat Latitude of center point
 * @param lng Longitude of center point
 * @param minutes Time in minutes (1-60)
 * @param profile Routing profile ('walking', 'driving', 'driving-traffic')
 * @returns Promise resolving to GeoJSON polygon feature
 */
export async function fetchIsochrone(
  lat: number,
  lng: number,
  minutes: number,
  profile: IsochroneProfile = 'driving'
): Promise<IsochroneResult> {
  if (!MAPBOX_TOKEN) {
    throw new Error(
      'Mapbox token not configured. Please set NEXT_PUBLIC_MAPBOX_TOKEN environment variable.'
    );
  }

  // Validate inputs
  if (minutes < 1 || minutes > 60) {
    throw new Error('Minutes must be between 1 and 60');
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error('Invalid coordinates');
  }

  // Build API URL
  const url = new URL(
    `https://api.mapbox.com/isochrone/v1/mapbox/${profile}/${lng},${lat}`
  );

  url.searchParams.append('contours_minutes', minutes.toString());
  url.searchParams.append('polygons', 'true');
  url.searchParams.append('access_token', MAPBOX_TOKEN);

  console.log(`[Isochrone] Fetching ${minutes}min ${profile} isochrone for (${lat}, ${lng})`);

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Mapbox Isochrone API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // Extract the polygon feature (first feature in the collection)
    if (!data.features || data.features.length === 0) {
      throw new Error('No isochrone data returned from Mapbox');
    }

    const feature = data.features[0] as IsochroneResult;
    console.log(`[Isochrone] Received polygon with ${feature.geometry.coordinates[0].length} points`);

    return feature;
  } catch (error) {
    console.error('[Isochrone] Error fetching from Mapbox:', error);
    throw error;
  }
}

/**
 * Convert measurement mode to Mapbox profile
 */
export function getModeProfile(mode: 'distance' | 'drive_time' | 'walk_time'): IsochroneProfile {
  switch (mode) {
    case 'walk_time':
      return 'walking';
    case 'drive_time':
      return 'driving-traffic'; // Use traffic-aware routing for more realistic drive times
    default:
      return 'driving';
  }
}
