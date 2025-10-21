-- =====================================================
-- Migration: Allow users to delete their own listings regardless of status
-- =====================================================

-- Drop the existing restrictive delete policy
DROP POLICY IF EXISTS "Users can delete their own draft listings" ON public.listings;

-- Create new policy that allows users to delete their own listings regardless of status
CREATE POLICY "Users can delete their own listings" ON public.listings
  FOR DELETE USING (auth.uid() = created_by);

-- Migration complete
-- =====================================================
