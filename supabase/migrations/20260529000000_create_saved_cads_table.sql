-- Create saved_cads table for CAD library
CREATE TABLE saved_cads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  metres_per_pixel NUMERIC NOT NULL,
  image_width_px INTEGER NOT NULL,
  image_height_px INTEGER NOT NULL,
  calibration_points JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Data integrity constraints
  CONSTRAINT unique_storage_path_per_user UNIQUE (user_id, storage_path),
  CONSTRAINT positive_scale CHECK (metres_per_pixel > 0),
  CONSTRAINT positive_width CHECK (image_width_px > 0),
  CONSTRAINT positive_height CHECK (image_height_px > 0),
  CONSTRAINT non_empty_name CHECK (length(trim(name)) > 0),
  CONSTRAINT no_tmp_path CHECK (storage_path !~ '^[^/]+/tmp/')
);

-- Indexes for performance
CREATE INDEX idx_saved_cads_user_id ON saved_cads(user_id);
CREATE INDEX idx_saved_cads_created_at ON saved_cads(user_id, created_at DESC);

-- Row Level Security
ALTER TABLE saved_cads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own CADs"
  ON saved_cads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own CADs"
  ON saved_cads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own CADs"
  ON saved_cads FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own CADs"
  ON saved_cads FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER trigger_update_saved_cads_updated_at
  BEFORE UPDATE ON saved_cads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
