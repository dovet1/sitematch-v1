-- Migration: Create spatial query functions for store gap analysis
-- Description: Functions for finding stores near a point (Assess Area mode)

-- Function for spatial query in Assess Area mode
-- Returns stores within a specified radius of a point
CREATE OR REPLACE FUNCTION get_stores_near_point(
  p_lat double precision,
  p_lon double precision,
  p_radius_m integer
)
RETURNS TABLE (
  id integer,
  store_id text,
  brand_id integer,
  fascia_id integer,
  name text,
  lon double precision,
  lat double precision,
  location geography,
  postcode text,
  town text,
  suburb text,
  county text,
  address_line_1 text,
  address_line_2 text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    id, store_id, brand_id, fascia_id, name, lon, lat,
    location, postcode, town, suburb, county,
    address_line_1, address_line_2, created_at
  FROM stores
  WHERE ST_DWithin(
    location,
    ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography,
    p_radius_m
  )
  ORDER BY location <-> ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography
  LIMIT 1000;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION get_stores_near_point IS
  'Returns stores within a radius (in meters) of a given point, ordered by distance. Used for Assess Area mode in Gap Analysis tool.';
