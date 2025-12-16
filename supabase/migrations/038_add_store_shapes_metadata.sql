-- Add metadata column to store_shapes table to store scale and conversion information
-- This enables proper scaling when placing shapes on the map

ALTER TABLE store_shapes ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create GIN index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_store_shapes_metadata ON store_shapes USING gin(metadata);

COMMENT ON COLUMN store_shapes.metadata IS 'Conversion metadata including scale_factor, source_units, and real-world dimensions';

-- Example metadata structure:
-- {
--   "scale_factor": 0.00045,
--   "source_units": "Millimeters",
--   "insunits_code": 4,
--   "source_bbox": {"width": 50000, "height": 25000},
--   "bbox": {
--     "width_meters": 50,
--     "height_meters": 25
--   },
--   "conversion_method": "metadata|heuristic|manual",
--   "source_filename": "store.dxf",
--   "target_width_meters": 50,
--   "geojson_feature_count": 125,
--   "optimized_feature_count": 69
-- }
