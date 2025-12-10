-- Migration: Create function to extract lat/lng from demographic analysis geography point
-- Converts PostGIS GEOGRAPHY(POINT) to JSON with lat/lng fields

CREATE OR REPLACE FUNCTION get_demographic_analysis_with_location(p_analysis_id UUID)
RETURNS TABLE (
  id UUID,
  site_id UUID,
  user_id UUID,
  name TEXT,
  location JSON,
  location_name TEXT,
  measurement_mode TEXT,
  measurement_value NUMERIC,
  selected_lsoa_codes TEXT[],
  demographics_data JSONB,
  national_averages JSONB,
  isochrone_geometry JSONB,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.site_id,
    a.user_id,
    a.name,
    json_build_object(
      'lng', ST_X(a.location::geometry),
      'lat', ST_Y(a.location::geometry)
    ) as location,
    a.location_name,
    a.measurement_mode,
    a.measurement_value,
    a.selected_lsoa_codes,
    a.demographics_data,
    a.national_averages,
    a.isochrone_geometry,
    a.created_at
  FROM site_demographic_analyses a
  WHERE a.id = p_analysis_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_demographic_analysis_with_location(UUID) TO authenticated;

COMMENT ON FUNCTION get_demographic_analysis_with_location IS 'Returns demographic analysis with location as {lng, lat} JSON object';

-- Create similar function for user_sites
CREATE OR REPLACE FUNCTION get_site_with_location(p_site_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  name TEXT,
  address TEXT,
  location JSON,
  description TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.user_id,
    s.name,
    s.address,
    json_build_object(
      'lng', ST_X(s.location::geometry),
      'lat', ST_Y(s.location::geometry)
    ) as location,
    s.description,
    s.created_at,
    s.updated_at
  FROM user_sites s
  WHERE s.id = p_site_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_site_with_location(UUID) TO authenticated;

COMMENT ON FUNCTION get_site_with_location IS 'Returns user site with location as {lng, lat} JSON object';
