-- =====================================================
-- Storage Policies Setup - Story 3.2
-- Create RLS policies for Supabase Storage
-- =====================================================

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload brochures" ON storage.objects; 
DROP POLICY IF EXISTS "Authenticated users can upload site plans" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload fit-outs" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own organization files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own organization files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own organization files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all files" ON storage.objects;
DROP POLICY IF EXISTS "Public read access" ON storage.objects;

-- Public read access for all buckets (since we want public file access)
CREATE POLICY "Public read access" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id IN ('logos', 'brochures', 'site-plans', 'fit-outs'));

-- Upload policies - users can upload to their own organization folder
CREATE POLICY "Authenticated users can upload logos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] IN (
      SELECT users.org_id::text
      FROM users
      WHERE users.id = auth.uid()
      AND users.org_id IS NOT NULL
    )
  );

CREATE POLICY "Authenticated users can upload brochures" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'brochures'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] IN (
      SELECT users.org_id::text
      FROM users
      WHERE users.id = auth.uid()
      AND users.org_id IS NOT NULL
    )
  );

CREATE POLICY "Authenticated users can upload site plans" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'site-plans'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] IN (
      SELECT users.org_id::text
      FROM users
      WHERE users.id = auth.uid()
      AND users.org_id IS NOT NULL
    )
  );

CREATE POLICY "Authenticated users can upload fit-outs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fit-outs'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] IN (
      SELECT users.org_id::text
      FROM users
      WHERE users.id = auth.uid()
      AND users.org_id IS NOT NULL
    )
  );

-- Update/Delete policies for users' own organization files
CREATE POLICY "Users can update own organization files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('logos', 'brochures', 'site-plans', 'fit-outs')
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] IN (
      SELECT users.org_id::text
      FROM users
      WHERE users.id = auth.uid()
      AND users.org_id IS NOT NULL
    )
  );

CREATE POLICY "Users can delete own organization files" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('logos', 'brochures', 'site-plans', 'fit-outs')
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] IN (
      SELECT users.org_id::text
      FROM users
      WHERE users.id = auth.uid()
      AND users.org_id IS NOT NULL
    )
  );

-- Admin policies
CREATE POLICY "Admins can manage all files" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id IN ('logos', 'brochures', 'site-plans', 'fit-outs')
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );