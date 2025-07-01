-- Fix infinite recursion in RLS policies
-- The issue is that admin policies are querying users table which triggers the same policies

-- Drop the problematic policies
DROP POLICY IF EXISTS "Admin users can view all users" ON public.users;
DROP POLICY IF EXISTS "Admin users can update any user" ON public.users;
DROP POLICY IF EXISTS "Admin users can view all organizations" ON public.organisations;
DROP POLICY IF EXISTS "Admin users can manage organizations" ON public.organisations;

-- Recreate admin policies using app_metadata instead of users table query
-- This avoids the infinite recursion by checking JWT claims directly

-- Admin users can view all users (using JWT claims)
CREATE POLICY "Admin users can view all users" ON public.users
  FOR SELECT USING (
    (auth.jwt() ->> 'app_metadata')::json ->> 'role' = 'admin'
  );

-- Admin users can update any user (using JWT claims)
CREATE POLICY "Admin users can update any user" ON public.users
  FOR UPDATE USING (
    (auth.jwt() ->> 'app_metadata')::json ->> 'role' = 'admin'
  );

-- Admin users can view all organizations (using JWT claims)
CREATE POLICY "Admin users can view all organizations" ON public.organisations
  FOR SELECT USING (
    (auth.jwt() ->> 'app_metadata')::json ->> 'role' = 'admin'
  );

-- Admin users can manage organizations (using JWT claims)
CREATE POLICY "Admin users can manage organizations" ON public.organisations
  FOR ALL USING (
    (auth.jwt() ->> 'app_metadata')::json ->> 'role' = 'admin'
  );