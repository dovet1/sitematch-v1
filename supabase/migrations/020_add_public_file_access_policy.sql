-- Add RLS policy for public access to files of approved listings
-- This allows the public API to read files that belong to approved listings

CREATE POLICY "Public can view files of approved listings" ON file_uploads
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM listings 
            WHERE listings.id = file_uploads.listing_id 
            AND listings.status = 'approved'
        )
    );