2-- ========================================
-- DIAGNOSTIC QUERIES FOR user_roles ISSUE
-- Run these in Supabase SQL Editor
-- ========================================

-- 1. Check if user_roles table exists
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public'
   AND table_name = 'user_roles'
) as user_roles_table_exists;

-- 2. List all tables in public schema
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- 3. Check RLS policies that might reference user_roles
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
WHERE qual LIKE '%user_roles%' 
   OR with_check LIKE '%user_roles%'
   OR policyname LIKE '%user_roles%';

-- 4. Check all RLS policies on users table specifically
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
WHERE tablename = 'users';

-- 5. Check for foreign key constraints referencing user_roles
SELECT
    tc.table_schema, 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND (ccu.table_name = 'user_roles' OR tc.table_name = 'user_roles');

-- 6. Check for triggers that might reference user_roles
SELECT 
    event_object_schema,
    event_object_table, 
    trigger_name,
    action_timing,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE action_statement LIKE '%user_roles%';

-- 7. Check for functions that might reference user_roles
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_definition LIKE '%user_roles%'
  AND routine_schema = 'public';

-- 8. Check users table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 9. Check for views that might reference user_roles
SELECT 
    table_name,
    view_definition
FROM information_schema.views
WHERE view_definition LIKE '%user_roles%'
  AND table_schema = 'public';

-- 10. Get current user and role info (for debugging auth)
SELECT 
    current_user,
    session_user,
    current_setting('role') as current_role;