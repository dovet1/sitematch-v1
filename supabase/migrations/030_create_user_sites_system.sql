-- Migration: Create user sites system
-- Allows users to create sites and attach saved searches, sketches, and demographic analyses

-- 1. Create user_sites table
CREATE TABLE IF NOT EXISTS user_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  location GEOGRAPHY(POINT) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for user_sites
CREATE INDEX idx_user_sites_user_id ON user_sites(user_id);
CREATE INDEX idx_user_sites_location ON user_sites USING GIST(location);
CREATE INDEX idx_user_sites_created_at ON user_sites(created_at DESC);

-- Add RLS policies for user_sites
ALTER TABLE user_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sites"
  ON user_sites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sites"
  ON user_sites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sites"
  ON user_sites FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sites"
  ON user_sites FOR DELETE
  USING (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE user_sites IS 'User-created sites for organizing saved searches, sketches, and demographic analyses';

-- 2. Add site_id column to site_sketches table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'site_sketches') THEN
    ALTER TABLE site_sketches ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES user_sites(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_site_sketches_site_id ON site_sketches(site_id);
  END IF;
END $$;

-- 3. Add site_id column to saved_searches table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'saved_searches') THEN
    ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES user_sites(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_saved_searches_site_id ON saved_searches(site_id);
  END IF;
END $$;

-- 4. Create site_demographic_analyses table (Pro feature only)
CREATE TABLE IF NOT EXISTS site_demographic_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES user_sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location GEOGRAPHY(POINT) NOT NULL,
  location_name TEXT NOT NULL,
  measurement_mode TEXT NOT NULL CHECK (measurement_mode IN ('distance', 'drive_time', 'walk_time')),
  measurement_value NUMERIC NOT NULL CHECK (measurement_value > 0),
  selected_lsoa_codes TEXT[] NOT NULL,
  demographics_data JSONB NOT NULL,
  national_averages JSONB NOT NULL,
  isochrone_geometry JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for site_demographic_analyses
CREATE INDEX idx_site_demographic_analyses_site_id ON site_demographic_analyses(site_id);
CREATE INDEX idx_site_demographic_analyses_user_id ON site_demographic_analyses(user_id);
CREATE INDEX idx_site_demographic_analyses_location ON site_demographic_analyses USING GIST(location);
CREATE INDEX idx_site_demographic_analyses_created_at ON site_demographic_analyses(created_at DESC);

-- Add RLS policies for site_demographic_analyses
ALTER TABLE site_demographic_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own analyses"
  ON site_demographic_analyses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own analyses"
  ON site_demographic_analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own analyses"
  ON site_demographic_analyses FOR DELETE
  USING (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE site_demographic_analyses IS 'Saved demographic analyses for sites (Pro feature only). Stores snapshot of analysis results.';

-- 5. Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_sites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger for updated_at
CREATE TRIGGER trigger_update_user_sites_updated_at
  BEFORE UPDATE ON user_sites
  FOR EACH ROW
  EXECUTE FUNCTION update_user_sites_updated_at();
