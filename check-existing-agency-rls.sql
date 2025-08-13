-- Query to check existing RLS policies for agency-related tables
-- Run this in your Supabase SQL Editor to see what policies currently exist

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename IN ('agencies', 'agency_agents', 'agency_invitations')
ORDER BY tablename, policyname;

-- Also check if RLS is enabled on these tables
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('agencies', 'agency_agents', 'agency_invitations')
AND schemaname = 'public'
ORDER BY tablename;

-- Check if the created_by column exists in agencies table
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'agencies' 
AND table_schema = 'public'
AND column_name = 'created_by';