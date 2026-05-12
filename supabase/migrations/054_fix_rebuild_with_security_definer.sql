-- Migration: Fix statement timeout using SECURITY DEFINER
-- Purpose: Run rebuild functions as a superuser to bypass timeout restrictions
-- Issue: SET LOCAL statement_timeout isn't working because PostgREST/connection pooler overrides it

-- First, let's try SECURITY DEFINER which runs the function with the creator's permissions
-- This might bypass the connection pooler's timeout restrictions

CREATE OR REPLACE FUNCTION rebuild_all_bua_summaries(p_user_id UUID DEFAULT NULL)
RETURNS TABLE(progress TEXT)
LANGUAGE plpgsql
SECURITY DEFINER  -- Run with function owner's privileges
SET statement_timeout = 0  -- Set config for this function execution
AS $$
BEGIN
  -- Check if rebuild already running
  IF is_rebuild_running() THEN
    RETURN QUERY SELECT 'Rebuild already in progress - skipping' AS progress;
    RETURN;
  END IF;

  -- Acquire lock
  IF NOT acquire_rebuild_lock(p_user_id) THEN
    RETURN QUERY SELECT 'Failed to acquire rebuild lock' AS progress;
    RETURN;
  END IF;

  -- Run rebuilds
  BEGIN
    RETURN QUERY SELECT 'Starting full BUA summary rebuild...' AS progress;
    RETURN QUERY SELECT * FROM rebuild_bua_store_presence();
    RETURN QUERY SELECT * FROM rebuild_bua_store_nearby();
    RETURN QUERY SELECT 'Rebuild complete!' AS progress;

    -- Release lock
    PERFORM release_rebuild_lock();
  EXCEPTION WHEN OTHERS THEN
    -- Release lock on error
    PERFORM release_rebuild_lock();
    RAISE;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION rebuild_bua_store_presence()
RETURNS TABLE(progress TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = 0
AS $$
BEGIN
  RETURN QUERY SELECT 'Starting bua_store_presence rebuild...' AS progress;

  -- Truncate existing data
  TRUNCATE TABLE bua_store_presence;
  RETURN QUERY SELECT 'Truncated bua_store_presence' AS progress;

  -- Rebuild via spatial join
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
$$;

CREATE OR REPLACE FUNCTION rebuild_bua_store_nearby()
RETURNS TABLE(progress TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = 0
AS $$
DECLARE
  dist INTEGER;
  row_count INTEGER;
BEGIN
  RETURN QUERY SELECT 'Starting bua_store_nearby rebuild...' AS progress;

  -- Truncate existing data
  TRUNCATE TABLE bua_store_nearby;
  RETURN QUERY SELECT 'Truncated bua_store_nearby' AS progress;

  -- Rebuild for each distance threshold
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
    WHERE ST_DWithin(b.centroid, s.location, dist)
    GROUP BY b.gsscode, fc.category_id, s.brand_id, s.fascia_id;

    SELECT COUNT(*) INTO row_count FROM bua_store_nearby WHERE distance_m = dist;
    RETURN QUERY SELECT 'Rebuilt bua_store_nearby at ' || dist || 'm: ' || row_count::TEXT || ' rows' AS progress;
  END LOOP;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION rebuild_all_bua_summaries(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_bua_store_presence() TO authenticated;
GRANT EXECUTE ON FUNCTION rebuild_bua_store_nearby() TO authenticated;

-- Add comments
COMMENT ON FUNCTION rebuild_all_bua_summaries(UUID) IS 'Rebuilds BUA summary tables with SECURITY DEFINER and statement_timeout=0. Takes 5-10 minutes.';
COMMENT ON FUNCTION rebuild_bua_store_presence() IS 'Rebuilds bua_store_presence with SECURITY DEFINER and statement_timeout=0.';
COMMENT ON FUNCTION rebuild_bua_store_nearby() IS 'Rebuilds bua_store_nearby with SECURITY DEFINER and statement_timeout=0.';
