-- Re-enable RLS and create proper policies for leads table
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Enable anonymous lead insertion" ON public.leads;
DROP POLICY IF EXISTS "Allow anonymous lead creation" ON public.leads;
DROP POLICY IF EXISTS "Allow service role read access" ON public.leads;
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.leads;

-- Policy 1: Allow anonymous inserts (for lead capture form)
CREATE POLICY "anonymous_insert_policy" ON public.leads
  FOR INSERT 
  TO anon
  WITH CHECK (true);

-- Policy 2: Allow service role to read all leads (for admin operations)
CREATE POLICY "service_role_select_policy" ON public.leads
  FOR SELECT
  TO service_role
  USING (true);

-- Policy 3: Allow authenticated admin users to read leads
CREATE POLICY "admin_select_policy" ON public.leads
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_app_meta_data->>'role' = 'admin'
    )
  );

-- Verify policies are created
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'leads';