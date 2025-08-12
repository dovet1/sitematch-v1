-- Check the actual columns in file_uploads table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'file_uploads' 
AND table_schema = 'public'
ORDER BY ordinal_position;