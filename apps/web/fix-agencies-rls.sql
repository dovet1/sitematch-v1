-- =====================================================
-- Fix RLS policies for agencies table
-- =====================================================

-- First, ensure the created_by column exists
ALTER TABLE agencies 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can create agencies" ON agencies;
DROP POLICY IF EXISTS "Users can view approved agencies" ON agencies;
DROP POLICY IF EXISTS "Agency admins can update their agency" ON agencies;
DROP POLICY IF EXISTS "Agency admins can delete their agency" ON agencies;

-- Enable RLS on agencies table
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;

-- Policy: Any authenticated user can create an agency (if not already in one)
CREATE POLICY "Users can create agencies" 
ON agencies FOR INSERT 
TO authenticated 
WITH CHECK (
  auth.uid() = created_by
  AND NOT EXISTS (
    SELECT 1 FROM agency_agents 
    WHERE user_id = auth.uid()
  )
);

-- Policy: Anyone can view approved agencies, users can view their own pending agencies
CREATE POLICY "Users can view agencies" 
ON agencies FOR SELECT 
TO authenticated 
USING (
  status = 'approved' 
  OR created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM agency_agents 
    WHERE agency_agents.agency_id = agencies.id 
    AND agency_agents.user_id = auth.uid()
  )
);

-- Policy: Agency admins can update their agency
CREATE POLICY "Agency admins can update their agency" 
ON agencies FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM agency_agents 
    WHERE agency_agents.agency_id = agencies.id 
    AND agency_agents.user_id = auth.uid() 
    AND agency_agents.role = 'admin'
  )
);

-- Policy: Agency creator or admins can delete their agency
CREATE POLICY "Agency admins can delete their agency" 
ON agencies FOR DELETE 
TO authenticated 
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM agency_agents 
    WHERE agency_agents.agency_id = agencies.id 
    AND agency_agents.user_id = auth.uid() 
    AND agency_agents.role = 'admin'
  )
);

-- Also ensure RLS policies for agency_agents table
ALTER TABLE agency_agents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view agency members" ON agency_agents;
DROP POLICY IF EXISTS "Agency admins can manage members" ON agency_agents;
DROP POLICY IF EXISTS "Users can join agencies" ON agency_agents;

-- Policy: Users can view members of agencies they belong to or approved agencies
CREATE POLICY "Users can view agency members" 
ON agency_agents FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM agencies 
    WHERE agencies.id = agency_agents.agency_id 
    AND (
      agencies.status = 'approved' 
      OR agencies.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM agency_agents aa 
        WHERE aa.agency_id = agencies.id 
        AND aa.user_id = auth.uid()
      )
    )
  )
);

-- Policy: Agency admins can insert members (for direct adds)
CREATE POLICY "Agency admins can add members" 
ON agency_agents FOR INSERT 
TO authenticated 
WITH CHECK (
  -- Allow if user is adding themselves (during agency creation)
  user_id = auth.uid()
  OR
  -- Or if they're an admin of the agency
  EXISTS (
    SELECT 1 FROM agency_agents existing 
    WHERE existing.agency_id = agency_agents.agency_id 
    AND existing.user_id = auth.uid() 
    AND existing.role = 'admin'
  )
);

-- Policy: Agency admins can update members
CREATE POLICY "Agency admins can update members" 
ON agency_agents FOR UPDATE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM agency_agents existing 
    WHERE existing.agency_id = agency_agents.agency_id 
    AND existing.user_id = auth.uid() 
    AND existing.role = 'admin'
  )
);

-- Policy: Agency admins can remove members
CREATE POLICY "Agency admins can remove members" 
ON agency_agents FOR DELETE 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM agency_agents existing 
    WHERE existing.agency_id = agency_agents.agency_id 
    AND existing.user_id = auth.uid() 
    AND existing.role = 'admin'
  )
);

-- Also ensure RLS for agency_invitations
ALTER TABLE agency_invitations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Agency admins can manage invitations" ON agency_invitations;
DROP POLICY IF EXISTS "Users can view their invitations" ON agency_invitations;

-- Policy: Agency admins can manage invitations
CREATE POLICY "Agency admins can manage invitations" 
ON agency_invitations FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM agency_agents 
    WHERE agency_agents.agency_id = agency_invitations.agency_id 
    AND agency_agents.user_id = auth.uid() 
    AND agency_agents.role = 'admin'
  )
);

-- Policy: Users can view invitations sent to their email
CREATE POLICY "Users can view their invitations" 
ON agency_invitations FOR SELECT 
TO authenticated 
USING (
  email = (SELECT email FROM auth.users WHERE id = auth.uid())
);