import { createClient } from '@supabase/supabase-js';

export interface GeographicBoundaryResult {
  lsoa_codes: string[];
  data_zone_codes: string[];
  is_mixed: boolean; // true if results span both regions
}

/**
 * Query both LSOA and Data Zone boundaries in parallel
 * Returns ALL matching areas from both regions
 */
export async function getAreaCodesInRadius(
  lat: number,
  lng: number,
  radiusMiles: number
): Promise<GeographicBoundaryResult> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const radiusMeters = radiusMiles * 1609.34;

  // Query both tables in parallel
  const [lsoaResult, dzResult] = await Promise.all([
    supabase.rpc('get_lsoas_in_radius', {
      center_lat: lat,
      center_lng: lng,
      radius_meters: radiusMeters,
    }),
    supabase.rpc('get_data_zones_in_radius', {
      center_lat: lat,
      center_lng: lng,
      radius_meters: radiusMeters,
    }),
  ]);

  const lsoaCodes = lsoaResult.data?.map((row: any) => row.lsoa_code) || [];
  const dzCodes = dzResult.data?.map((row: any) => row.dz_code) || [];

  return {
    lsoa_codes: lsoaCodes,
    data_zone_codes: dzCodes,
    is_mixed: lsoaCodes.length > 0 && dzCodes.length > 0,
  };
}

export async function getAreaCodesInPolygon(
  polygonWKT: string
): Promise<GeographicBoundaryResult> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Query both tables in parallel
  const [lsoaResult, dzResult] = await Promise.all([
    supabase.rpc('get_lsoas_in_polygon', { polygon_wkt: polygonWKT }),
    supabase.rpc('get_data_zones_in_polygon', { polygon_wkt: polygonWKT }),
  ]);

  const lsoaCodes = lsoaResult.data?.map((row: any) => row.lsoa_code) || [];
  const dzCodes = dzResult.data?.map((row: any) => row.dz_code) || [];

  return {
    lsoa_codes: lsoaCodes,
    data_zone_codes: dzCodes,
    is_mixed: lsoaCodes.length > 0 && dzCodes.length > 0,
  };
}
