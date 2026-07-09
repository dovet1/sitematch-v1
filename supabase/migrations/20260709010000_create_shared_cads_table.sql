-- Create shared_cads table: an admin-maintained CAD library visible to all users.
-- Mirrors saved_cads but is not user-scoped, and carries provenance metadata.
CREATE TABLE shared_cads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  metres_per_pixel NUMERIC NOT NULL,
  image_width_px INTEGER NOT NULL,
  image_height_px INTEGER NOT NULL,
  calibration_points JSONB,
  -- Provenance metadata (captured by the admin on upload)
  brand TEXT NOT NULL,
  format TEXT NOT NULL,
  source_store TEXT NOT NULL,
  survey_year INTEGER NOT NULL,
  gia_sqm NUMERIC,
  dims_label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_shared_storage_path UNIQUE (storage_path),
  CONSTRAINT positive_shared_scale CHECK (metres_per_pixel > 0),
  CONSTRAINT positive_shared_width CHECK (image_width_px > 0),
  CONSTRAINT positive_shared_height CHECK (image_height_px > 0),
  CONSTRAINT non_empty_shared_name CHECK (length(trim(name)) > 0),
  CONSTRAINT non_empty_shared_brand CHECK (length(trim(brand)) > 0),
  CONSTRAINT non_empty_shared_format CHECK (length(trim(format)) > 0),
  CONSTRAINT non_empty_shared_source CHECK (length(trim(source_store)) > 0)
);

CREATE INDEX idx_shared_cads_created_at ON shared_cads(created_at DESC);
CREATE INDEX idx_shared_cads_brand ON shared_cads(brand);

-- Row Level Security: readable by any authenticated user; writes go through the
-- admin API using the service-role client (which bypasses RLS), so no write
-- policies are defined here.
ALTER TABLE shared_cads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view shared CADs"
  ON shared_cads FOR SELECT
  USING (auth.role() = 'authenticated');

-- Trigger for updated_at
CREATE TRIGGER trigger_update_shared_cads_updated_at
  BEFORE UPDATE ON shared_cads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
