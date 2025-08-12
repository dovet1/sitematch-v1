-- Check files for specific listing
SELECT 
    id,
    listing_id,
    file_name,
    file_type,
    file_path,
    bucket_name,
    file_size,
    is_primary,
    display_order,
    created_at
FROM file_uploads 
WHERE listing_id = 'd5263cdf-c392-4b00-9b43-ad980416be11'
ORDER BY file_type, display_order;

-- Also check all file types in the system
SELECT 
    file_type,
    COUNT(*) as count
FROM file_uploads 
GROUP BY file_type
ORDER BY file_type;

-- Check if there are any files at all in the table
SELECT COUNT(*) as total_files FROM file_uploads;