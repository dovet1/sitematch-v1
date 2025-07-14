-- Fix existing logo files that don't have is_primary set
-- This is a one-time migration to fix the logo display issue

-- First, let's see what we're working with
SELECT 
  id,
  listing_id,
  file_name,
  file_type,
  is_primary,
  created_at
FROM file_uploads 
WHERE file_type = 'logo' 
  AND (is_primary IS NULL OR is_primary = false)
ORDER BY created_at DESC;

-- Update all logo files to have is_primary = true
-- Since there should typically be only one logo per listing
UPDATE file_uploads 
SET is_primary = true 
WHERE file_type = 'logo' 
  AND (is_primary IS NULL OR is_primary = false);

-- Verify the fix
SELECT 
  id,
  listing_id,
  file_name,
  file_type,
  is_primary,
  created_at
FROM file_uploads 
WHERE file_type = 'logo' 
ORDER BY created_at DESC;

-- Check if any listings now have their logos showing up correctly
SELECT 
  l.id,
  l.company_name,
  l.clearbit_logo,
  f.file_path,
  f.is_primary,
  f.file_name
FROM listings l
LEFT JOIN file_uploads f ON l.id = f.listing_id AND f.file_type = 'logo' AND f.is_primary = true
WHERE l.clearbit_logo = false
ORDER BY l.created_at DESC;