-- Fix the valid_geojson constraint
-- The ? operator doesn't work as expected with JSONB in this context
-- Use -> operator instead to check for the 'type' key

ALTER TABLE store_shapes DROP CONSTRAINT IF EXISTS valid_geojson;

-- Add corrected constraint
ALTER TABLE store_shapes ADD CONSTRAINT valid_geojson
  CHECK (
    geojson -> 'type' IS NOT NULL AND
    (geojson->>'type' = 'Feature' OR geojson->>'type' = 'FeatureCollection')
  );

COMMENT ON CONSTRAINT valid_geojson ON store_shapes IS 'Ensures geojson column contains valid GeoJSON Feature or FeatureCollection';
