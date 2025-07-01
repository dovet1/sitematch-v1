-- Final optimized RLS policies using JWT custom claims
-- These should be fast since JWT claims are now populated

-- Drop all existing policies first
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Allow user creation during signup" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can view organizations" ON public.organisations;

-- Users table policies
-- Users can view their own profile OR admins can view all profiles
CREATE POLICY "Users and admins can view profiles" ON public.users
  FOR SELECT USING (
    auth.uid() = id 
    OR 
    (auth.jwt() ->> 'app_metadata')::json ->> 'role' = 'admin'
  );

-- Users can update their own profile OR admins can update any profile
CREATE POLICY "Users and admins can update profiles" ON public.users
  FOR UPDATE USING (
    auth.uid() = id 
    OR 
    (auth.jwt() ->> 'app_metadata')::json ->> 'role' = 'admin'
  );

-- Allow profile creation during signup
CREATE POLICY "Allow user creation during signup" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Organizations table policies
-- Users can view their own organization OR admins can view all
CREATE POLICY "Users and admins can view organizations" ON public.organisations
  FOR SELECT USING (
    -- Users can see their own organization
    id IN (
      SELECT org_id FROM public.users WHERE id = auth.uid()
    )
    OR 
    -- Admins can see all organizations
    (auth.jwt() ->> 'app_metadata')::json ->> 'role' = 'admin'
  );

-- Admins can manage all organizations
CREATE POLICY "Admins can manage organizations" ON public.organisations
  FOR ALL USING (
    (auth.jwt() ->> 'app_metadata')::json ->> 'role' = 'admin'
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_auth_uid ON public.users(id) WHERE id = auth.uid();
CREATE INDEX IF NOT EXISTS idx_users_org_id_auth ON public.users(org_id) WHERE id = auth.uid();