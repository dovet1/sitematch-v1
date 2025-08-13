-- Debug the dashboard data query
-- This checks what the dashboard should see for the current user

-- 1. Check current user
SELECT 
  'Current user:' as debug_info,
  auth.uid() as user_id,
  (SELECT email FROM auth.users WHERE id = auth.uid()) as email;

-- 2. Check agency_agents records for current user
SELECT 
  'Agency agents for current user:' as debug_info,
  aa.agency_id,
  aa.user_id,
  aa.email,
  aa.name,
  aa.role,
  aa.is_registered,
  aa.joined_at
FROM agency_agents aa
WHERE aa.user_id = auth.uid()
ORDER BY aa.joined_at DESC;

-- 3. Check the full dashboard query (what the page should see)
SELECT 
  'Dashboard query result:' as debug_info,
  aa.agency_id,
  aa.role,
  aa.joined_at,
  a.id as agency_id,
  a.name as agency_name,
  a.logo_url,
  a.coverage_areas,
  a.specialisms,
  a.status,
  a.admin_notes,
  a.created_at,
  a.approved_at
FROM agency_agents aa
JOIN agencies a ON aa.agency_id = a.id
WHERE aa.user_id = auth.uid();

-- 4. Check agency_agents RLS policies
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
WHERE tablename = 'agency_agents'
ORDER BY policyname;

-- 5. Check if there are any agency_agents records at all
SELECT 
  'All agency_agents records:' as debug_info,
  COUNT(*) as total_records
FROM agency_agents;

-- 6. Check if there are agency_agents records for any specific user ID
-- Replace 'your-user-id-here' with your actual user ID from the first query
-- SELECT 
--   'Agency agents for specific user:' as debug_info,
--   *
-- FROM agency_agents
-- WHERE user_id = 'your-user-id-here';