-- Optimize RLS policies for better performance
-- The current JWT-based policies are slow because they parse JSON on every query

-- Drop existing policies
DROP POLICY IF EXISTS "Admin users can view all users" ON public.users;
DROP POLICY IF EXISTS "Admin users can update any user" ON public.users;
DROP POLICY IF EXISTS "Admin users can view all organizations" ON public.organisations;
DROP POLICY IF EXISTS "Admin users can manage organizations" ON public.organisations;

-- Create more efficient policies using a simpler approach
-- Users can view their own profile OR if they have admin role in app_metadata
CREATE POLICY "Users can view profiles" ON public.users
  FOR SELECT USING (
    auth.uid() = id 
    OR 
    (auth.jwt() ->> 'app_metadata')::json ->> 'role' = 'admin'
  );

-- Users can update their own profile OR admins can update any profile
CREATE POLICY "Users can update profiles" ON public.users
  FOR UPDATE USING (
    auth.uid() = id 
    OR 
    (auth.jwt() ->> 'app_metadata')::json ->> 'role' = 'admin'
  );

-- For organizations: users can view their own org OR admins can view all
CREATE POLICY "Users can view organizations" ON public.organisations
  FOR SELECT USING (
    id IN (
      SELECT org_id FROM public.users WHERE id = auth.uid()
    )
    OR 
    (auth.jwt() ->> 'app_metadata')::json ->> 'role' = 'admin'
  );

-- Admins can manage all organizations
CREATE POLICY "Admins can manage organizations" ON public.organisations
  FOR ALL USING (
    (auth.jwt() ->> 'app_metadata')::json ->> 'role' = 'admin'
  );

-- Add indexes to improve RLS policy performance
CREATE INDEX IF NOT EXISTS idx_users_id_auth ON public.users(id) WHERE id = auth.uid();
CREATE INDEX IF NOT EXISTS idx_users_org_lookup ON public.users(id, org_id);