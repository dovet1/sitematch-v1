-- Migration: Create store shapes library for SiteSketcher
-- Allows admins to upload pre-defined store footprints that users can place

CREATE TABLE IF NOT EXISTS public.store_shapes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  company_name TEXT NOT NULL,
  geojson JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  display_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add constraint to validate GeoJSON structure
-- Supports both Feature and FeatureCollection to allow detailed architectural drawings
ALTER TABLE store_shapes ADD CONSTRAINT valid_geojson
  CHECK (
    geojson ? 'type' AND
    (geojson->>'type' = 'Feature' OR geojson->>'type' = 'FeatureCollection')
  );

-- Indexes for performance
CREATE INDEX idx_store_shapes_is_active ON store_shapes(is_active);
CREATE INDEX idx_store_shapes_display_order ON store_shapes(display_order);
CREATE INDEX idx_store_shapes_company_name ON store_shapes(company_name);

-- RLS Policies
ALTER TABLE store_shapes ENABLE ROW LEVEL SECURITY;

-- Anyone can view active store shapes (public library)
CREATE POLICY "Anyone can view active store shapes"
  ON store_shapes FOR SELECT
  USING (is_active = true);

-- Trigger for updated_at
CREATE TRIGGER trigger_update_store_shapes_updated_at
  BEFORE UPDATE ON store_shapes
  FOR EACH ROW
  EXECUTE FUNCTION update_user_sites_updated_at();

-- Comments
COMMENT ON TABLE store_shapes IS 'Library of pre-defined store footprints that users can place in SiteSketcher';
COMMENT ON COLUMN store_shapes.name IS 'Display name for the store shape (e.g., "Tesco Superstore")';
COMMENT ON COLUMN store_shapes.company_name IS 'Company/brand name (e.g., "Tesco")';
COMMENT ON COLUMN store_shapes.geojson IS 'GeoJSON Feature or FeatureCollection with detailed architectural elements (coordinates normalized to origin [0,0])';
COMMENT ON COLUMN store_shapes.is_active IS 'Whether this shape is visible to users';
COMMENT ON COLUMN store_shapes.display_order IS 'Order for displaying shapes in UI (lower numbers first)';
