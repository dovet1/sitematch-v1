/**
 * LSOA Boundary Data Loader (PostGIS Version)
 * Queries LSOA polygon boundaries from Supabase PostGIS database
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Get LSOA codes that intersect with a radius circle
 * Uses PostGIS ST_DWithin for efficient spatial querying
 */
export async function getLSOACodesInRadiusWithPolygons(
  lat: number,
  lng: number,
  radiusMiles: number
): Promise<string[]> {
  console.log(`[PostGIS] Finding LSOAs within ${radiusMiles}mi of (${lat}, ${lng})...`);

  // Convert miles to meters for PostGIS (1 mile = 1609.34 meters)
  const radiusMeters = radiusMiles * 1609.34;

  // Create a point and use ST_DWithin to find intersecting LSOAs
  // ST_DWithin is faster than ST_Intersects with ST_Buffer
  // Using geography type for accurate distance calculation
  const { data, error } = await supabase.rpc('get_lsoas_in_radius', {
    center_lat: lat,
    center_lng: lng,
    radius_meters: radiusMeters,
  });

  if (error) {
    console.error('[PostGIS] Error querying LSOAs:', error);
    throw new Error(`Failed to query LSOAs: ${error.message}`);
  }

  const lsoaCodes = data?.map((row: any) => row.lsoa_code) || [];
  console.log(`[PostGIS] Found ${lsoaCodes.length} LSOAs`);

  return lsoaCodes;
}

/**
 * Get LSOA codes that intersect with an isochrone polygon
 * Uses PostGIS ST_Intersects for polygon-polygon intersection
 */
export async function getLSOACodesInIsochrone(
  isochroneCoordinates: number[][][]
): Promise<string[]> {
  console.log(`[PostGIS] Finding LSOAs intersecting isochrone polygon...`);

  // Convert isochrone coordinates to WKT format
  const rings = isochroneCoordinates.map(ring =>
    `(${ring.map(coord => `${coord[0]} ${coord[1]}`).join(', ')})`
  ).join(', ');
  const polygonWKT = `POLYGON(${rings})`;

  // Use ST_Intersects to find LSOAs that intersect the isochrone
  const { data, error } = await supabase.rpc('get_lsoas_in_polygon', {
    polygon_wkt: polygonWKT,
  });

  if (error) {
    console.error('[PostGIS] Error querying LSOAs:', error);
    throw new Error(`Failed to query LSOAs: ${error.message}`);
  }

  const lsoaCodes = data?.map((row: any) => row.lsoa_code) || [];
  console.log(`[PostGIS] Found ${lsoaCodes.length} LSOAs intersecting isochrone`);

  return lsoaCodes;
}
