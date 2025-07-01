-- Create leads table for email capture
CREATE TABLE public.leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  persona text NOT NULL CHECK (persona IN ('agent', 'investor', 'landlord', 'vendor')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (for lead capture)
CREATE POLICY "Allow anonymous lead creation" ON public.leads
  FOR INSERT TO anon
  WITH CHECK (true);

-- Allow service role to read all leads (for admin/analytics)
CREATE POLICY "Allow service role read access" ON public.leads
  FOR SELECT TO service_role
  USING (true);

-- Allow authenticated users to read all leads (for admin dashboard)
CREATE POLICY "Allow authenticated read access" ON public.leads
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );