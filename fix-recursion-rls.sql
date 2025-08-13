-- Fix the infinite recursion in agency_agents RLS policies

-- Drop the problematic policies
DROP POLICY IF EXISTS "Agency management and self-insertion" ON agency_agents;
DROP POLICY IF EXISTS "Users can view agency members appropriately" ON agency_agents;
DROP POLICY IF EXISTS "Agency admins can update members" ON agency_agents;
DROP POLICY IF EXISTS "Agency admins can remove members" ON agency_agents;

-- Create simpler, non-recursive policies for agency_agents

-- INSERT policy: Allow users to add themselves or if they're admin of the agency
CREATE POLICY "Users can insert agency agents" 
ON agency_agents FOR INSERT 
TO authenticated 
WITH CHECK (
  -- Allow if user is adding themselves
  user_id = auth.uid()
  OR
  -- Allow if user is admin of the agency (but avoid recursion by checking agencies table directly)
  EXISTS (
    SELECT 1 FROM agencies 
    WHERE agencies.id = agency_agents.agency_id 
    AND agencies.created_by = auth.uid()
  )
);

-- SELECT policy: Users can view members of agencies they belong to or approved agencies
CREATE POLICY "Users can view agency agents" 
ON agency_agents FOR SELECT 
TO authenticated 
USING (
  -- Can view if they're viewing an approved agency
  agency_id IN (
    SELECT id FROM agencies 
    WHERE status = 'approved'
  )
  OR
  -- Can view if they're the creator of the agency
  agency_id IN (
    SELECT id FROM agencies 
    WHERE created_by = auth.uid()
  )
  OR
  -- Can view if it's their own record
  user_id = auth.uid()
);

-- UPDATE policy: Only agency creators and existing admins can update
CREATE POLICY "Authorized users can update agency agents" 
ON agency_agents FOR UPDATE 
TO authenticated 
USING (
  -- Agency creator can update
  agency_id IN (
    SELECT id FROM agencies 
    WHERE created_by = auth.uid()
  )
);

-- DELETE policy: Only agency creators can delete members
CREATE POLICY "Authorized users can delete agency agents" 
ON agency_agents FOR DELETE 
TO authenticated 
USING (
  -- Agency creator can delete
  agency_id IN (
    SELECT id FROM agencies 
    WHERE created_by = auth.uid()
  )
);