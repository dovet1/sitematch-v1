-- Targeted fix for agency creation RLS policy
-- This replaces only the problematic INSERT policy

-- Drop the current INSERT policy that's causing issues
DROP POLICY IF EXISTS "Authenticated users can create agencies" ON agencies;

-- Create a new, more restrictive INSERT policy
CREATE POLICY "Users can create agencies if not already in one" 
ON agencies FOR INSERT 
TO authenticated 
WITH CHECK (
  -- User must be creating agency with their own ID as created_by
  auth.uid() = created_by
  -- AND user must not already be part of any agency
  AND NOT EXISTS (
    SELECT 1 FROM agency_agents 
    WHERE user_id = auth.uid()
  )
);

-- Also need to update the agency_agents INSERT policy to allow self-insertion during agency creation
-- First check the current policy
DROP POLICY IF EXISTS "Agency admins can manage agency agents" ON agency_agents;

-- Create a more specific policy that allows:
-- 1. Agency creators to add members to their own agency
-- 2. Users to add themselves when joining an agency
-- 3. Agency admins to manage their agency members
CREATE POLICY "Agency management and self-insertion" 
ON agency_agents FOR INSERT 
TO authenticated 
WITH CHECK (
  -- Allow if user is adding themselves (during agency creation or invitation acceptance)
  user_id = auth.uid()
  OR
  -- Or if they're the creator of the agency
  agency_id IN (
    SELECT id FROM agencies 
    WHERE created_by = auth.uid()
  )
  OR
  -- Or if they're an admin of the agency
  EXISTS (
    SELECT 1 FROM agency_agents existing 
    WHERE existing.agency_id = agency_agents.agency_id 
    AND existing.user_id = auth.uid() 
    AND existing.role = 'admin'
  )
);

-- Keep the existing SELECT policy for agency_agents but make it more explicit
DROP POLICY IF EXISTS "Agency members can view co-agents" ON agency_agents;

CREATE POLICY "Users can view agency members appropriately" 
ON agency_agents FOR SELECT 
TO authenticated 
USING (
  -- Can view members of agencies they belong to
  agency_id IN (
    SELECT agency_id FROM agency_agents 
    WHERE user_id = auth.uid()
  )
  OR
  -- Can view members of approved agencies (public view)
  agency_id IN (
    SELECT id FROM agencies 
    WHERE status = 'approved'
  )
  OR
  -- Agency creators can view all their agency members
  agency_id IN (
    SELECT id FROM agencies 
    WHERE created_by = auth.uid()
  )
);

-- Add UPDATE and DELETE policies for agency_agents if they don't exist
CREATE POLICY "Agency admins can update members" 
ON agency_agents FOR UPDATE 
TO authenticated 
USING (
  -- Agency creator can manage their agency
  agency_id IN (
    SELECT id FROM agencies 
    WHERE created_by = auth.uid()
  )
  OR
  -- Agency admins can manage their agency
  EXISTS (
    SELECT 1 FROM agency_agents existing 
    WHERE existing.agency_id = agency_agents.agency_id 
    AND existing.user_id = auth.uid() 
    AND existing.role = 'admin'
  )
);

CREATE POLICY "Agency admins can remove members" 
ON agency_agents FOR DELETE 
TO authenticated 
USING (
  -- Agency creator can manage their agency
  agency_id IN (
    SELECT id FROM agencies 
    WHERE created_by = auth.uid()
  )
  OR
  -- Agency admins can manage their agency
  EXISTS (
    SELECT 1 FROM agency_agents existing 
    WHERE existing.agency_id = agency_agents.agency_id 
    AND existing.user_id = auth.uid() 
    AND existing.role = 'admin'
  )
);