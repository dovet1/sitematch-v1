-- Debug query to check why approved agencies aren't visible
-- Run this to see what's happening with agency visibility

-- 1. Check all agencies and their status
SELECT 
  id,
  name,
  status,
  created_by,
  created_at,
  approved_at
FROM agencies 
ORDER BY created_at DESC;

-- 2. Check if you have any agencies as the current user
SELECT 
  'Your agencies:' as debug_info,
  a.id,
  a.name,
  a.status,
  a.created_at,
  aa.role,
  aa.is_registered
FROM agencies a
JOIN agency_agents aa ON a.id = aa.agency_id
WHERE aa.user_id = auth.uid()
ORDER BY a.created_at DESC;

-- 3. Check RLS policies that might be blocking visibility
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
WHERE tablename = 'agencies'
AND cmd = 'SELECT'
ORDER BY policyname;

-- 4. Test if you can see approved agencies (should work for everyone)
SELECT 
  'Approved agencies (should be visible to all):' as debug_info,
  id,
  name,
  status,
  created_by,
  created_at
FROM agencies 
WHERE status = 'approved'
ORDER BY created_at DESC;