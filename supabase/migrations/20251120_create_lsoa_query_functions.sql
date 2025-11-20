-- Create RPC functions for querying LSOA boundaries with PostGIS

/**
 * Function: get_lsoas_in_radius
 * Returns LSOA codes within a given radius (in meters) of a center point
 * Uses geography type for accurate distance calculation
 */
CREATE OR REPLACE FUNCTION public.get_lsoas_in_radius(
  center_lat NUMERIC,
  center_lng NUMERIC,
  radius_meters NUMERIC
)
RETURNS TABLE (lsoa_code TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT lb.lsoa_code
  FROM public.lsoa_boundaries lb
  WHERE ST_DWithin(
    lb.geometry::geography,
    ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
    radius_meters
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment
COMMENT ON FUNCTION public.get_lsoas_in_radius IS
  'Returns LSOA codes within a specified radius (meters) of a center point.
   Uses PostGIS ST_DWithin with geography type for accurate distance calculation.';

/**
 * Function: get_lsoas_in_polygon
 * Returns LSOA codes that intersect with a given polygon (e.g., isochrone)
 * Takes a polygon in WKT format
 */
CREATE OR REPLACE FUNCTION public.get_lsoas_in_polygon(
  polygon_wkt TEXT
)
RETURNS TABLE (lsoa_code TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT lb.lsoa_code
  FROM public.lsoa_boundaries lb
  WHERE ST_Intersects(
    lb.geometry,
    ST_GeomFromText(polygon_wkt, 4326)
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment
COMMENT ON FUNCTION public.get_lsoas_in_polygon IS
  'Returns LSOA codes that intersect with a given polygon (WKT format).
   Useful for isochrone-based queries.';
