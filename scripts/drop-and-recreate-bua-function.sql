-- Drop the old version of the function (with INTEGER[] categories)
-- This is necessary because PostgreSQL can't decide between overloaded functions
DROP FUNCTION IF EXISTS get_filtered_bua_gsscodes(INTEGER, INTEGER, UUID[], INTEGER[], UUID[], INTEGER[]);

-- Drop the version without proximity parameters (if exists)
DROP FUNCTION IF EXISTS get_filtered_bua_gsscodes(INTEGER, INTEGER, UUID[], UUID[], UUID[], UUID[]);

-- Now create the correct version with UUID[] for all ID parameters + proximity exclusion
CREATE OR REPLACE FUNCTION get_filtered_bua_gsscodes(
  p_min_pop INTEGER,
  p_max_pop INTEGER,
  p_include_fascias UUID[] DEFAULT NULL,
  p_include_categories UUID[] DEFAULT NULL,
  p_exclude_fascias UUID[] DEFAULT NULL,
  p_exclude_categories UUID[] DEFAULT NULL,
  p_nearby_exclude_fascias JSONB[] DEFAULT NULL,
  p_nearby_exclude_categories JSONB[] DEFAULT NULL
)
RETURNS TABLE(gsscode TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT b.gsscode
  FROM built_up_areas b
  WHERE (
    -- If min_pop < 5000, treat all BUAs with pop < 5000 as having pop = 0
    -- This ensures they're included regardless of the min_pop value (as long as it's < 5000)
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
    -- Proximity exclusion: Exclude BUAs with specified fascias nearby
    AND (
      p_nearby_exclude_fascias IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM unnest(p_nearby_exclude_fascias) AS rule
        CROSS JOIN LATERAL (
          SELECT (rule->>'distance_m')::integer AS dist,
                 array(SELECT jsonb_array_elements_text(rule->'ids'))::uuid[] AS fascia_ids
        ) AS parsed
        JOIN bua_store_nearby sn
          ON sn.bua_gsscode = b.gsscode
         AND sn.distance_m = parsed.dist
         AND sn.fascia_id = ANY(parsed.fascia_ids)
      )
    )
    -- Proximity exclusion: Exclude BUAs with specified categories nearby
    AND (
      p_nearby_exclude_categories IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM unnest(p_nearby_exclude_categories) AS rule
        CROSS JOIN LATERAL (
          SELECT (rule->>'distance_m')::integer AS dist,
                 array(SELECT jsonb_array_elements_text(rule->'ids'))::uuid[] AS category_ids
        ) AS parsed
        JOIN bua_store_nearby sn
          ON sn.bua_gsscode = b.gsscode
         AND sn.distance_m = parsed.dist
         AND sn.category_id = ANY(parsed.category_ids)
      )
    )
  ORDER BY COALESCE(b.pop_final, b.pop) DESC;
END;
$$ LANGUAGE plpgsql STABLE;
