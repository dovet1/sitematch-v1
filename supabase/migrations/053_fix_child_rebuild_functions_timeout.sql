-- Migration: Fix statement timeout in child rebuild functions
-- Purpose: Disable statement timeout in rebuild_bua_store_presence and rebuild_bua_store_nearby
-- Issue: These functions are called by rebuild_all_bua_summaries and need timeout disabled too

-- Function 1: Rebuild bua_store_presence with timeout disabled
CREATE OR REPLACE FUNCTION rebuild_bua_store_presence()
RETURNS TABLE(progress TEXT) AS $$
BEGIN
  -- Disable statement timeout for this long-running spatial join
  SET LOCAL statement_timeout = 0;

  RETURN QUERY SELECT 'Starting bua_store_presence rebuild...' AS progress;

  -- Truncate existing data
  TRUNCATE TABLE bua_store_presence;
  RETURN QUERY SELECT 'Truncated bua_store_presence' AS progress;

  -- Rebuild via spatial join
  -- IMPORTANT: Use built_up_area_geometries.geom (polygon) for point-in-polygon check
  INSERT INTO bua_store_presence (bua_gsscode, category_id, brand_id, fascia_id, store_count)
  SELECT
    bg.gsscode,
    fc.category_id,
    s.brand_id,
    s.fascia_id,
    COUNT(s.id) AS store_count
  FROM stores s
  JOIN fascia_categories fc ON fc.fascia_id = s.fascia_id
  JOIN built_up_area_geometries bg ON ST_Contains(bg.geom, s.location::geometry)
  GROUP BY bg.gsscode, fc.category_id, s.brand_id, s.fascia_id;

  RETURN QUERY SELECT 'Rebuilt bua_store_presence: ' || COUNT(*)::TEXT || ' rows'
    FROM bua_store_presence;
END;
$$ LANGUAGE plpgsql;

-- Function 2: Rebuild bua_store_nearby with timeout disabled
CREATE OR REPLACE FUNCTION rebuild_bua_store_nearby()
RETURNS TABLE(progress TEXT) AS $$
DECLARE
  dist INTEGER;
  row_count INTEGER;
BEGIN
  -- Disable statement timeout for this long-running proximity analysis
  SET LOCAL statement_timeout = 0;

  RETURN QUERY SELECT 'Starting bua_store_nearby rebuild...' AS progress;

  -- Truncate existing data
  TRUNCATE TABLE bua_store_nearby;
  RETURN QUERY SELECT 'Truncated bua_store_nearby' AS progress;

  -- Rebuild for each distance threshold: 1km, 3km, 5km, 10km
  -- IMPORTANT: Use built_up_areas.centroid (geography point) for proximity check
  FOREACH dist IN ARRAY ARRAY[1000, 3000, 5000, 10000] LOOP
    INSERT INTO bua_store_nearby (bua_gsscode, distance_m, category_id, brand_id, fascia_id, store_count)
    SELECT
      b.gsscode,
      dist,
      fc.category_id,
      s.brand_id,
      s.fascia_id,
      COUNT(s.id) AS store_count
    FROM built_up_areas b
    CROSS JOIN stores s
    JOIN fascia_categories fc ON fc.fascia_id = s.fascia_id
    WHERE ST_DWithin(
      b.centroid,    -- BUA centroid (geography, auto-generated)
      s.location,    -- Store location (geography)
      dist           -- Distance threshold in meters
    )
    GROUP BY b.gsscode, fc.category_id, s.brand_id, s.fascia_id;

    SELECT COUNT(*) INTO row_count FROM bua_store_nearby WHERE distance_m = dist;
    RETURN QUERY SELECT 'Rebuilt bua_store_nearby at ' || dist || 'm: ' || row_count::TEXT || ' rows' AS progress;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON FUNCTION rebuild_bua_store_presence() IS 'Rebuilds bua_store_presence table with statement timeout disabled. Uses spatial joins.';
COMMENT ON FUNCTION rebuild_bua_store_nearby() IS 'Rebuilds bua_store_nearby table with statement timeout disabled. Uses proximity analysis at 1km, 3km, 5km, 10km.';
