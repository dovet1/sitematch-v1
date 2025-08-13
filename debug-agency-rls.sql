-- Debug query to test agency creation RLS
-- Run this to see what's happening with the current user and policies

-- 1. Check current user info
SELECT 
  auth.uid() as current_user_id,
  auth.role() as current_role,
  auth.jwt() ->> 'email' as current_email;

-- 2. Check if current user is already in an agency
SELECT 
  'Current user agency membership:' as debug_info,
  aa.*
FROM agency_agents aa
WHERE aa.user_id = auth.uid();

-- 3. Test the exact policy condition
SELECT 
  'Policy check results:' as debug_info,
  auth.uid() as user_id,
  'test-agency-id' as fake_created_by_check,
  CASE 
    WHEN auth.uid() IS NOT NULL THEN 'User ID exists'
    ELSE 'User ID is NULL'
  END as user_id_status,
  CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM agency_agents 
      WHERE user_id = auth.uid()
    ) THEN 'User not in any agency - CAN CREATE'
    ELSE 'User already in agency - CANNOT CREATE'
  END as agency_membership_check;

-- 4. Check the exact RLS policies currently active
SELECT 
  policyname,
  cmd,
  with_check
FROM pg_policies 
WHERE tablename = 'agencies' 
AND cmd = 'INSERT';

-- 5. Try to simulate the insert conditions
SELECT 
  'Insert simulation:' as debug_info,
  auth.uid() = auth.uid() as created_by_matches,
  NOT EXISTS (
    SELECT 1 FROM agency_agents 
    WHERE user_id = auth.uid()
  ) as not_in_agency,
  (auth.uid() = auth.uid() AND NOT EXISTS (
    SELECT 1 FROM agency_agents 
    WHERE user_id = auth.uid()
  )) as overall_policy_check;