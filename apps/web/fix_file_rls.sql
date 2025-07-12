-- Add RLS policy to allow public read access to files for approved listings
CREATE POLICY "Public can view files for approved listings" ON public.file_uploads
FOR SELECT 
TO anon
USING (
  listing_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 
    FROM public.listings 
    WHERE listings.id = file_uploads.listing_id 
      AND listings.status = 'approved'
  )
);

-- Alternative: If you want to allow pending listings too (for preview purposes)
-- CREATE POLICY "Public can view files for approved and pending listings" ON public.file_uploads
-- FOR SELECT 
-- TO anon
-- USING (
--   listing_id IS NOT NULL 
--   AND EXISTS (
--     SELECT 1 
--     FROM public.listings 
--     WHERE listings.id = file_uploads.listing_id 
--       AND listings.status IN ('approved', 'pending')
--   )
-- );