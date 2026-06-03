-- Migration: Create BUA summary rebuild functions
-- Purpose: Rebuild bua_store_presence and bua_store_nearby tables after store imports

-- Function 1: Rebuild bua_store_presence (store presence in each BUA)
CREATE OR REPLACE FUNCTION rebuild_bua_store_presence()
RETURNS TABLE(progress TEXT) AS $$
BEGIN
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

-- Function 2: Rebuild bua_store_nearby (stores within distance thresholds)
CREATE OR REPLACE FUNCTION rebuild_bua_store_nearby()
RETURNS TABLE(progress TEXT) AS $$
DECLARE
  dist INTEGER;
  row_count INTEGER;
BEGIN
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

-- Function 3: Master rebuild function (calls both with concurrency guard)
-- Note: Concurrency guard will be added in migration 042
CREATE OR REPLACE FUNCTION rebuild_all_bua_summaries(p_user_id UUID DEFAULT NULL)
RETURNS TABLE(progress TEXT) AS $$
BEGIN
  RETURN QUERY SELECT 'Starting full BUA summary rebuild...' AS progress;

  -- Rebuild store presence
  RETURN QUERY SELECT * FROM rebuild_bua_store_presence();

  -- Rebuild nearby stores
  RETURN QUERY SELECT * FROM rebuild_bua_store_nearby();

  RETURN QUERY SELECT 'Rebuild complete!' AS progress;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions to authenticated users (admins only via API)
GRANT EXECUTE ON FUNCTION rebuild_bua_store_presence() TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_bua_store_nearby() TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_all_bua_summaries(UUID) TO authenticated;
