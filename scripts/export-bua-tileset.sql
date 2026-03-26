-- Supabase RPC Function: Get all matching BUA gsscodes for map filtering
-- This returns ALL matching gsscodes (no limit) for client-side Mapbox filtering
--
-- Usage:
--   1. Run this SQL in Supabase SQL Editor to create the function
--   2. Call from TypeScript: supabase.rpc('get_filtered_bua_gsscodes', { ... })

CREATE OR REPLACE FUNCTION get_filtered_bua_gsscodes(
  p_min_pop INTEGER,
  p_max_pop INTEGER,
  p_include_fascias UUID[] DEFAULT NULL,
  p_include_categories UUID[] DEFAULT NULL,
  p_exclude_fascias UUID[] DEFAULT NULL,
  p_exclude_categories UUID[] DEFAULT NULL
)
RETURNS TABLE(gsscode TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT b.gsscode
  FROM built_up_areas b
  WHERE (
    -- If min_pop < 5000, include all BUAs with pop < 5000
    (p_min_pop < 5000 AND COALESCE(b.pop_final, b.pop) < 5000)
    OR
    -- For BUAs with pop >= 5000, apply normal filtering
    (COALESCE(b.pop_final, b.pop) BETWEEN p_min_pop AND p_max_pop)
  )
    -- Include filter: BUA must have at least one of these fascias
    AND (
      p_include_fascias IS NULL
      OR EXISTS (
        SELECT 1 FROM bua_store_presence sp
        WHERE sp.bua_gsscode = b.gsscode
          AND sp.fascia_id = ANY(p_include_fascias)
      )
    )
    -- Include filter: BUA must have at least one fascia in these categories
    AND (
      p_include_categories IS NULL
      OR EXISTS (
        SELECT 1 FROM bua_store_presence sp
        WHERE sp.bua_gsscode = b.gsscode
          AND sp.category_id = ANY(p_include_categories)
      )
    )
    -- Exclude filter: BUA must NOT have any of these fascias
    AND (
      p_exclude_fascias IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM bua_store_presence sp
        WHERE sp.bua_gsscode = b.gsscode
          AND sp.fascia_id = ANY(p_exclude_fascias)
      )
    )
    -- Exclude filter: BUA must NOT have any fascia in these categories
    AND (
      p_exclude_categories IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM bua_store_presence sp
        WHERE sp.bua_gsscode = b.gsscode
          AND sp.category_id = ANY(p_exclude_categories)
      )
    )
  ORDER BY COALESCE(b.pop_final, b.pop) DESC;
END;
$$ LANGUAGE plpgsql STABLE;
