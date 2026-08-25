-- Migration: Only return missing fascias whose brand actually has stores
-- Previously get_missing_fascias_near_point used a LEFT JOIN to nearest_stores, so a
-- fascia whose brand has zero stores anywhere in the database still came back as
-- "missing" (with null store fields). Those brands then leaked into the Find Gaps
-- brand filter. Switching that join to an inner join drops fascias that have no store
-- anywhere, so only genuine gaps (brands present elsewhere) are returned.

CREATE OR REPLACE FUNCTION get_missing_fascias_near_point(
  p_lat DOUBLE PRECISION,
  p_lon DOUBLE PRECISION,
  p_radius_m INTEGER,
  p_fascia_ids UUID[] DEFAULT NULL,
  p_category_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  fascia_id UUID,
  fascia_name TEXT,
  brand_id UUID,
  brand_name TEXT,
  category_id UUID,
  category_name TEXT,
  nearest_store_distance DOUBLE PRECISION,
  nearest_store_name TEXT,
  nearest_store_town TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_point geography;
BEGIN
  -- Create geography point from input coordinates
  v_point := ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography;

  RETURN QUERY
  WITH expanded_categories AS (
    -- Expand category hierarchy if category IDs provided
    SELECT DISTINCT unnest(get_category_descendants(p_category_ids)) as expanded_category_id
    WHERE p_category_ids IS NOT NULL
  ),
  scope_fascias AS (
    -- Get all fascias in scope (either from explicit list or from expanded categories)
    SELECT DISTINCT f.id as scope_fascia_id
    FROM fascias f
    LEFT JOIN fascia_categories fc ON f.id = fc.fascia_id
    WHERE
      -- Include if explicitly in fascia list
      (p_fascia_ids IS NOT NULL AND f.id = ANY(p_fascia_ids))
      OR
      -- Include if no fascia filter and matches category filter
      (p_fascia_ids IS NULL AND (
        p_category_ids IS NULL OR fc.category_id IN (SELECT expanded_category_id FROM expanded_categories)
      ))
  ),
  present_fascias AS (
    -- Find fascias present within radius
    SELECT DISTINCT s.fascia_id as present_fascia_id
    FROM stores s
    WHERE
      ST_DWithin(s.location, v_point, p_radius_m)
      AND s.fascia_id IN (SELECT scope_fascia_id FROM scope_fascias)
  ),
  missing_fascias AS (
    -- Subtract present from scope to get missing
    SELECT sf.scope_fascia_id as missing_fascia_id
    FROM scope_fascias sf
    WHERE NOT EXISTS (
      SELECT 1 FROM present_fascias pf WHERE pf.present_fascia_id = sf.scope_fascia_id
    )
  ),
  nearest_stores AS (
    -- For each missing fascia, find nearest store
    SELECT DISTINCT ON (mf.missing_fascia_id)
      mf.missing_fascia_id,
      ST_Distance(s.location, v_point) as distance_m,
      s.name as store_name,
      s.town as store_town
    FROM missing_fascias mf
    JOIN stores s ON s.fascia_id = mf.missing_fascia_id
    ORDER BY mf.missing_fascia_id, ST_Distance(s.location, v_point)
  )
  SELECT
    f.id as fascia_id,
    f.name as fascia_name,
    b.id as brand_id,
    b.name as brand_name,
    fc.category_id,
    c.name as category_name,
    ns.distance_m as nearest_store_distance,
    ns.store_name as nearest_store_name,
    ns.store_town as nearest_store_town
  FROM missing_fascias mf
  JOIN fascias f ON f.id = mf.missing_fascia_id
  JOIN brands b ON b.id = f.brand_id
  LEFT JOIN fascia_categories fc ON fc.fascia_id = f.id AND fc.is_primary = true
  LEFT JOIN categories c ON c.id = fc.category_id
  -- Inner join: exclude fascias that have no store anywhere in the database, so
  -- storeless brands never surface as "missing" / gaps.
  JOIN nearest_stores ns ON ns.missing_fascia_id = mf.missing_fascia_id
  ORDER BY b.name, f.name;
END;
$$;

-- Update comment
COMMENT ON FUNCTION get_missing_fascias_near_point IS
  'Returns fascias that exist in the database AND have at least one store somewhere, but are NOT present within the specified radius of a point. Supports category hierarchy expansion via get_category_descendants.';
