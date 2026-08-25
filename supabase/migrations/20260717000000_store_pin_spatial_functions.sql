-- Migration: Spatial query functions for find-gaps store pins
-- Description:
--   get_stores_in_bua   - every store whose location falls inside a BUA polygon
--                         (scenario 1: selected location). No LIMIT: the polygon
--                         inherently bounds the set and we must show every store.
--   get_stores_in_bbox  - stores within a viewport envelope, optionally filtered
--                         to a set of fascia ids (scenario 2: brand context).
--                         Filtering happens INSIDE the function, before LIMIT, so
--                         the cap can never drop matching pins ahead of filtering.

CREATE OR REPLACE FUNCTION get_stores_in_bua(
  p_gsscode text
)
RETURNS TABLE (
  id uuid,
  store_id text,
  brand_id uuid,
  fascia_id uuid,
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
    s.id, s.store_id, s.brand_id, s.fascia_id, s.name, s.lon, s.lat,
    s.location, s.postcode, s.town, s.suburb, s.county,
    s.address_line_1, s.address_line_2, s.created_at
  FROM stores s
  JOIN built_up_area_geometries bg
    ON bg.gsscode = p_gsscode
   AND ST_Contains(bg.geom, s.location::geometry);
$$;

COMMENT ON FUNCTION get_stores_in_bua IS
  'Returns every store inside a built-up area polygon (by gsscode). Used for the find-gaps selected-location store pins.';

CREATE OR REPLACE FUNCTION get_stores_in_bbox(
  p_min_lon double precision,
  p_min_lat double precision,
  p_max_lon double precision,
  p_max_lat double precision,
  p_fascia_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  store_id text,
  brand_id uuid,
  fascia_id uuid,
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
    s.id, s.store_id, s.brand_id, s.fascia_id, s.name, s.lon, s.lat,
    s.location, s.postcode, s.town, s.suburb, s.county,
    s.address_line_1, s.address_line_2, s.created_at
  FROM stores s
  WHERE s.location && ST_MakeEnvelope(p_min_lon, p_min_lat, p_max_lon, p_max_lat, 4326)::geography
    AND (p_fascia_ids IS NULL OR s.fascia_id = ANY(p_fascia_ids))
  LIMIT 5001;
$$;

COMMENT ON FUNCTION get_stores_in_bbox IS
  'Returns stores within a viewport envelope, optionally filtered to fascia ids. LIMIT 5001 is a safety guard (guard+1) so callers can detect truncation. Used for the find-gaps brand-context store pins.';

GRANT EXECUTE ON FUNCTION get_stores_in_bua(text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_stores_in_bbox(double precision, double precision, double precision, double precision, uuid[]) TO authenticated, anon, service_role;
