-- Query to show all RLS policies on the listing_contacts table
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
WHERE tablename = 'listing_contacts' 
  AND schemaname = 'public'
ORDER BY policyname;

-- Alternative query with more details
SELECT 
    pol.polname AS policy_name,
    pol.polpermissive AS permissive,
    pol.polroles AS roles,
    pol.polcmd AS command,
    pol.polqual AS using_expression,
    pol.polwithcheck AS with_check_expression,
    c.relname AS table_name,
    n.nspname AS schema_name
FROM pg_policy pol
JOIN pg_class c ON pol.polrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE c.relname = 'listing_contacts'
  AND n.nspname = 'public'
ORDER BY pol.polname;

-- Check if RLS is enabled on the table
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'listing_contacts' 
  AND schemaname = 'public';