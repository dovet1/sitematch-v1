-- Check the user_id for the files we know exist
SELECT 
    id,
    user_id,
    listing_id,
    file_name,
    file_type
FROM file_uploads 
WHERE listing_id = 'd5263cdf-c392-4b00-9b43-ad980416be11';