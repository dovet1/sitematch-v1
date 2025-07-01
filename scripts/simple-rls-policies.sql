-- Simplified RLS policies for better performance
-- Temporarily remove admin checks that rely on JWT claims until Edge Function is set up

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view profiles" ON public.users;
DROP POLICY IF EXISTS "Users can update profiles" ON public.users;
DROP POLICY IF EXISTS "Users can view organizations" ON public.organisations;
DROP POLICY IF EXISTS "Admins can manage organizations" ON public.organisations;

-- Simple policies that only check basic auth
-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile  
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Allow profile creation during signup
CREATE POLICY "Allow user creation during signup" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can view their own organization
CREATE POLICY "Users can view own organization" ON public.organisations
  FOR SELECT USING (
    id IN (
      SELECT org_id FROM public.users WHERE id = auth.uid()
    )
  );

-- For now, allow all authenticated users to read organizations (we can restrict this later)
CREATE POLICY "Authenticated users can view organizations" ON public.organisations
  FOR SELECT USING (auth.uid() IS NOT NULL);