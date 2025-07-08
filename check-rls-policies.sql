-- Check RLS policies for all relevant tables
-- Run these queries in your Supabase SQL editor

-- 1. Check if RLS is enabled on tables
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('sectors', 'use_classes', 'users', 'listings')
ORDER BY tablename;

-- 2. Check existing RLS policies
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
WHERE schemaname = 'public'
AND tablename IN ('sectors', 'use_classes', 'users', 'listings')
ORDER BY tablename, policyname;

-- 3. Check specific policies for sectors table
SELECT 
    policyname,
    cmd as command,
    roles,
    qual as using_clause
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'sectors';

-- 4. Check specific policies for use_classes table  
SELECT 
    policyname,
    cmd as command,
    roles,
    qual as using_clause
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'use_classes';

-- 5. Check specific policies for users table
SELECT 
    policyname,
    cmd as command,
    roles,
    qual as using_clause
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'users';

-- 6. Test if current user can access these tables directly
SELECT 'sectors' as table_name, COUNT(*) as row_count FROM sectors
UNION ALL
SELECT 'use_classes' as table_name, COUNT(*) as row_count FROM use_classes  
UNION ALL
SELECT 'users' as table_name, COUNT(*) as row_count FROM users
UNION ALL
SELECT 'listings' as table_name, COUNT(*) as row_count FROM listings;

-- 7. Check what role the current user has
SELECT 
    auth.uid() as current_user_id,
    u.email,
    u.role
FROM users u 
WHERE u.id = auth.uid();