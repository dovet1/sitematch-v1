-- =====================================================
-- Migration: Remove Organization Dependencies
-- Switch from org-based to user-based access control
-- =====================================================

-- 1. Remove org_id constraint from file_uploads table
ALTER TABLE public.file_uploads 
DROP CONSTRAINT IF EXISTS file_uploads_org_id_fkey;

ALTER TABLE public.file_uploads 
ALTER COLUMN org_id DROP NOT NULL;

-- 2. Remove org_id constraint from users table  
ALTER TABLE public.users 
DROP CONSTRAINT IF EXISTS users_org_id_fkey;

ALTER TABLE public.users 
ALTER COLUMN org_id DROP NOT NULL;

-- 3. Remove org_id constraint from listings table
ALTER TABLE public.listings 
DROP CONSTRAINT IF EXISTS listings_org_id_fkey;

ALTER TABLE public.listings 
ALTER COLUMN org_id DROP NOT NULL;

-- 4. Update RLS Policies for User-Based Access Control
-- =====================================================

-- Drop existing organization-based policies
DROP POLICY IF EXISTS "Occupiers can view own org listings" ON public.listings;
DROP POLICY IF EXISTS "Occupiers can create listings" ON public.listings;  
DROP POLICY IF EXISTS "Occupiers can update own org listings" ON public.listings;
DROP POLICY IF EXISTS "Occupiers can delete own org listings" ON public.listings;
DROP POLICY IF EXISTS "Users can view own org files" ON public.file_uploads;
DROP POLICY IF EXISTS "Users can upload files for own org" ON public.file_uploads;
DROP POLICY IF EXISTS "Users can update own org files" ON public.file_uploads;
DROP POLICY IF EXISTS "Users can delete own org files" ON public.file_uploads;

-- Drop admin policies if they exist
DROP POLICY IF EXISTS "Admins can view all listings" ON public.listings;
DROP POLICY IF EXISTS "Admins can manage all listings" ON public.listings;
DROP POLICY IF EXISTS "Admins can view all files" ON public.file_uploads;
DROP POLICY IF EXISTS "Admins can manage all files" ON public.file_uploads;

-- Create new user-based policies for listings
-- =====================================================

-- Anyone can view published listings
CREATE POLICY "Anyone can view published listings" ON public.listings
  FOR SELECT USING (status = 'published');

-- Users can view their own draft/pending listings  
CREATE POLICY "Users can view own draft listings" ON public.listings
  FOR SELECT USING (created_by = auth.uid() AND status IN ('draft', 'pending'));

-- Users can create their own listings
CREATE POLICY "Users can create own listings" ON public.listings
  FOR INSERT WITH CHECK (created_by = auth.uid());

-- Users can update their own listings
CREATE POLICY "Users can update own listings" ON public.listings
  FOR UPDATE USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Users can delete their own listings  
CREATE POLICY "Users can delete own listings" ON public.listings
  FOR DELETE USING (created_by = auth.uid());

-- Create new user-based policies for file_uploads
-- =====================================================

-- Users can view their own files
CREATE POLICY "Users can view own files" ON public.file_uploads
  FOR SELECT USING (user_id = auth.uid());

-- Users can upload their own files
CREATE POLICY "Users can upload own files" ON public.file_uploads
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own files
CREATE POLICY "Users can update own files" ON public.file_uploads
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own files
CREATE POLICY "Users can delete own files" ON public.file_uploads
  FOR DELETE USING (user_id = auth.uid());

-- Create admin policies (admins can access everything)
-- =====================================================

-- Admins can view all listings
CREATE POLICY "Admins can view all listings" ON public.listings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can manage all listings
CREATE POLICY "Admins can manage all listings" ON public.listings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'  
    )
  );

-- Admins can view all files
CREATE POLICY "Admins can view all files" ON public.file_uploads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can manage all files  
CREATE POLICY "Admins can manage all files" ON public.file_uploads
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 5. Update indexes to reflect new access patterns
-- =====================================================

-- Remove org-based indexes
DROP INDEX IF EXISTS idx_listings_org_id;
DROP INDEX IF EXISTS idx_file_uploads_org_id;

-- Add user-based indexes for performance
CREATE INDEX IF NOT EXISTS idx_listings_user_status ON public.listings(created_by, status);
CREATE INDEX IF NOT EXISTS idx_file_uploads_user_id ON public.file_uploads(user_id);

-- 6. Add helpful comments
-- =====================================================

COMMENT ON COLUMN public.listings.org_id IS 'Legacy organization ID - now optional, use created_by for access control';
COMMENT ON COLUMN public.users.org_id IS 'Legacy organization ID - now optional';  
COMMENT ON COLUMN public.file_uploads.org_id IS 'Legacy organization ID - now optional, use user_id for access control';

-- Migration complete
-- =====================================================