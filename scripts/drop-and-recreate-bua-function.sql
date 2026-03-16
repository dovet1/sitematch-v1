-- Drop the old version of the function (with INTEGER[] categories)
-- This is necessary because PostgreSQL can't decide between overloaded functions
DROP FUNCTION IF EXISTS get_filtered_bua_gsscodes(INTEGER, INTEGER, UUID[], INTEGER[], UUID[], INTEGER[]);

-- Now create the correct version with UUID[] for all ID parameters
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
  SELECT b.gsscode
  FROM built_up_areas b
  WHERE b.pop BETWEEN p_min_pop AND p_max_pop
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
  ORDER BY b.pop DESC;
END;
$$ LANGUAGE plpgsql STABLE;
