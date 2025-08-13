-- Check the schema and constraints for agency_agents table
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'agency_agents' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check constraints
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(c.oid) as constraint_definition
FROM pg_constraint c 
JOIN pg_class t ON c.conrelid = t.oid 
JOIN pg_namespace n ON t.relnamespace = n.oid 
WHERE t.relname = 'agency_agents' 
AND n.nspname = 'public';