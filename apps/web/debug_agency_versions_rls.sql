-- Check current RLS policies on agency_versions table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'agency_versions';

-- Check if user_roles table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE  table_schema = 'public'
   AND    table_name   = 'user_roles'
);

-- Show the structure of agency_versions table
\d agency_versions

-- If there are problematic RLS policies, we'll need to fix or disable them
-- This query will help us see what's causing the issue
SELECT * FROM pg_policies WHERE tablename = 'agency_versions';