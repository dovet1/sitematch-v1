-- Fix agency visibility for public access
-- The current RLS policy only allows authenticated users to see approved agencies
-- But the public directory should show approved agencies to everyone

-- Drop the current SELECT policy
DROP POLICY IF EXISTS "Users can view agencies" ON agencies;

-- Create a new policy that allows public access to approved agencies
CREATE POLICY "Public can view approved agencies" 
ON agencies FOR SELECT 
TO public 
USING (status = 'approved');

-- Create a separate policy for authenticated users to see their own agencies
CREATE POLICY "Users can view their own agencies" 
ON agencies FOR SELECT 
TO authenticated 
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM agency_agents 
    WHERE agency_agents.agency_id = agencies.id 
    AND agency_agents.user_id = auth.uid()
  )
);