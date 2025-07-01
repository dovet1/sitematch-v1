-- Admin User Creation Script
-- Story 2.0: User Authentication & Role System Setup
-- 
-- Instructions:
-- 1. First, have the admin user sign up normally through the auth flow
-- 2. Find their user ID in the Supabase Auth dashboard
-- 3. Replace the UUID below with their actual auth.users ID
-- 4. Run this script in the Supabase SQL editor

-- Update existing user to admin role (replace UUID with actual user ID)
UPDATE public.users 
SET role = 'admin' 
WHERE id = '00000000-0000-0000-0000-000000000000'; -- Replace with actual auth.users ID

-- Alternative: Insert admin user if they don't exist in users table
-- (This should rarely be needed due to the trigger, but included for completeness)
INSERT INTO public.users (id, email, role, org_id)
VALUES (
  '00000000-0000-0000-0000-000000000000', -- Replace with actual auth.users ID
  'admin@yourdomain.com',                 -- Replace with actual admin email
  'admin', 
  NULL
)
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- Verify admin user creation
SELECT id, email, role, created_at 
FROM public.users 
WHERE role = 'admin';

-- Show all users for verification
SELECT id, email, role, org_id, created_at 
FROM public.users 
ORDER BY created_at DESC;