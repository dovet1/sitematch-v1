-- Create user profile for existing auth user
-- Replace the ID and email with your actual values

INSERT INTO public.users (id, email, role, org_id)
VALUES (
  'ef57833e-347b-499d-9aaf-636cb0187c8f', -- Your user ID from the console log
  'your-email@example.com', -- Replace with your actual email
  'admin', -- or 'occupier' if you want to test as regular user
  NULL
)
ON CONFLICT (id) DO UPDATE SET 
  role = EXCLUDED.role,
  updated_at = timezone('utc'::text, now());

-- Verify the user was created
SELECT id, email, role, created_at FROM public.users WHERE id = 'ef57833e-347b-499d-9aaf-636cb0187c8f';