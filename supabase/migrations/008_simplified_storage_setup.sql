-- =====================================================
-- Simplified Storage Setup - Story 3.2 Task 2
-- Create file metadata table and basic policies
-- =====================================================

-- =====================================================
-- FILE METADATA TABLE
-- =====================================================

-- Create table to store file metadata and associations
CREATE TABLE IF NOT EXISTS file_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id UUID, -- Will reference listings(id) when listings table exists
  
  -- File information
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL, -- 'logo', 'brochure', 'sitePlan', 'fitOut'
  mime_type TEXT NOT NULL,
  bucket_name TEXT NOT NULL,
  
  -- Optional metadata
  display_order INTEGER DEFAULT 0,
  caption TEXT,
  is_primary BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_file_type CHECK (file_type IN ('logo', 'brochure', 'sitePlan', 'fitOut', 'headshot')),
  CONSTRAINT valid_bucket CHECK (bucket_name IN ('logos', 'brochures', 'site-plans', 'fit-outs', 'headshots')),
  CONSTRAINT file_size_positive CHECK (file_size > 0)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_file_uploads_org_id ON file_uploads(org_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_listing_id ON file_uploads(listing_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_user_id ON file_uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_file_type ON file_uploads(file_type);
CREATE INDEX IF NOT EXISTS idx_file_uploads_created_at ON file_uploads(created_at);

-- Enable RLS on file_uploads table
ALTER TABLE file_uploads ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- FILE_UPLOADS TABLE POLICIES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can insert own organization file metadata" ON file_uploads;
DROP POLICY IF EXISTS "Users can view own organization file metadata" ON file_uploads;
DROP POLICY IF EXISTS "Users can update own organization file metadata" ON file_uploads;
DROP POLICY IF EXISTS "Users can delete own organization file metadata" ON file_uploads;
DROP POLICY IF EXISTS "Admins can manage all file metadata" ON file_uploads;

-- Allow users to insert file metadata for their own organization
CREATE POLICY "Users can insert own organization file metadata" ON file_uploads
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_id = auth.uid()
    AND org_id IN (
      SELECT users.org_id
      FROM users
      WHERE users.id = auth.uid()
    )
  );

-- Allow users to view file metadata for their own organization
CREATE POLICY "Users can view own organization file metadata" ON file_uploads
  FOR SELECT TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND org_id IN (
      SELECT users.org_id
      FROM users
      WHERE users.id = auth.uid()
    )
  );

-- Allow users to update file metadata for their own organization
CREATE POLICY "Users can update own organization file metadata" ON file_uploads
  FOR UPDATE TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND org_id IN (
      SELECT users.org_id
      FROM users
      WHERE users.id = auth.uid()
    )
  );

-- Allow users to delete file metadata for their own organization
CREATE POLICY "Users can delete own organization file metadata" ON file_uploads
  FOR DELETE TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND org_id IN (
      SELECT users.org_id
      FROM users
      WHERE users.id = auth.uid()
    )
  );

-- Allow admins to manage all file metadata
CREATE POLICY "Admins can manage all file metadata" ON file_uploads
  FOR ALL TO authenticated
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_file_uploads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_file_uploads_updated_at ON file_uploads;
CREATE TRIGGER trigger_update_file_uploads_updated_at
  BEFORE UPDATE ON file_uploads
  FOR EACH ROW
  EXECUTE FUNCTION update_file_uploads_updated_at();