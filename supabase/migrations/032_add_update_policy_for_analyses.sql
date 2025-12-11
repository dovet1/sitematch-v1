-- Add missing UPDATE policy for site_demographic_analyses
-- This was preventing users from unlinking analyses from sites

CREATE POLICY "Users can update their own analyses"
  ON site_demographic_analyses FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
