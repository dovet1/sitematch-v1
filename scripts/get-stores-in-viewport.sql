-- Drop existing functions first to allow return type changes
DROP FUNCTION IF EXISTS get_included_stores_in_viewport(double precision, double precision, double precision, double precision, uuid[], uuid[], integer);
DROP FUNCTION IF EXISTS get_excluded_stores_in_viewport(double precision, double precision, double precision, double precision, uuid[], uuid[], integer);

-- Function to get included stores (matching any of the include filters)
CREATE OR REPLACE FUNCTION get_included_stores_in_viewport(
  p_min_lat DOUBLE PRECISION,
  p_min_lon DOUBLE PRECISION,
  p_max_lat DOUBLE PRECISION,
  p_max_lon DOUBLE PRECISION,
  p_brand_ids UUID[] DEFAULT NULL,
  p_category_ids UUID[] DEFAULT NULL,
  p_limit INTEGER DEFAULT 2000
)
RETURNS TABLE(
  id UUID,
  store_id BIGINT,
  brand_id UUID,
  fascia_id UUID,
  name TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  postcode TEXT,
  town TEXT,
  suburb TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.store_id,
    s.brand_id,
    s.fascia_id,
    s.name,
    s.lat,
    s.lon,
    s.postcode,
    s.town,
    s.suburb
  FROM stores s
  WHERE s.lat BETWEEN p_min_lat AND p_max_lat
    AND s.lon BETWEEN p_min_lon AND p_max_lon
    -- Match brand IDs OR category IDs (any match qualifies as "included")
    AND (
      (p_brand_ids IS NOT NULL AND s.fascia_id = ANY(p_brand_ids))
      OR
      (p_category_ids IS NOT NULL AND EXISTS (
        SELECT 1 FROM fascia_categories fc
        WHERE fc.fascia_id = s.fascia_id
          AND fc.category_id = ANY(p_category_ids)
      ))
    )
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get excluded stores (matching any of the exclude filters)
CREATE OR REPLACE FUNCTION get_excluded_stores_in_viewport(
  p_min_lat DOUBLE PRECISION,
  p_min_lon DOUBLE PRECISION,
  p_max_lat DOUBLE PRECISION,
  p_max_lon DOUBLE PRECISION,
  p_brand_ids UUID[] DEFAULT NULL,
  p_category_ids UUID[] DEFAULT NULL,
  p_limit INTEGER DEFAULT 2000
)
RETURNS TABLE(
  id UUID,
  store_id BIGINT,
  brand_id UUID,
  fascia_id UUID,
  name TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  postcode TEXT,
  town TEXT,
  suburb TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.store_id,
    s.brand_id,
    s.fascia_id,
    s.name,
    s.lat,
    s.lon,
    s.postcode,
    s.town,
    s.suburb
  FROM stores s
  WHERE s.lat BETWEEN p_min_lat AND p_max_lat
    AND s.lon BETWEEN p_min_lon AND p_max_lon
    -- Match brand IDs OR category IDs (any match qualifies as "excluded")
    AND (
      (p_brand_ids IS NOT NULL AND s.fascia_id = ANY(p_brand_ids))
      OR
      (p_category_ids IS NOT NULL AND EXISTS (
        SELECT 1 FROM fascia_categories fc
        WHERE fc.fascia_id = s.fascia_id
          AND fc.category_id = ANY(p_category_ids)
      ))
    )
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;
