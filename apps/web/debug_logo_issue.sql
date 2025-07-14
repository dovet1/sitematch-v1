-- Debug query to understand logo upload issue
-- Query to check existing logo files and their is_primary status

SELECT 
  listing_id,
  file_path,
  file_name,
  file_type,
  is_primary,
  created_at,
  bucket_name
FROM file_uploads 
WHERE file_type = 'logo'
ORDER BY created_at DESC;

-- Check if any listings have clearbit_logo = false but no primary logo file
SELECT 
  l.id,
  l.company_name,
  l.clearbit_logo,
  f.file_path,
  f.is_primary
FROM listings l
LEFT JOIN file_uploads f ON l.id = f.listing_id AND f.file_type = 'logo' AND f.is_primary = true
WHERE l.clearbit_logo = false
ORDER BY l.created_at DESC;

-- Update existing logo files to have is_primary = true
-- This fixes the issue for existing uploads
UPDATE file_uploads 
SET is_primary = true 
WHERE file_type = 'logo' 
  AND is_primary IS NULL;