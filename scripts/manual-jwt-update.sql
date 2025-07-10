-- Manually update JWT claims for existing user
-- Replace the user ID with your actual user ID

-- First, let's see what users we have
SELECT id, email, role, org_id FROM public.users;

-- To manually update JWT claims, you need to:
-- 1. Go to Supabase Dashboard > Authentication > Users
-- 2. Find your user (ef57833e-347b-499d-9aaf-636cb0187c8f)
-- 3. Click on the user
-- 4. In the "Raw User Meta Data" section, add this JSON to app_metadata:

/*
{
  "role": "admin",
  "org_id": null,
  "email": "your-email@example.com"
}
*/

-- Or use the Edge Function URL directly:
-- POST to: https://nunvbolbcekvtlwuacul.supabase.co/functions/v1/auth-hook
-- With body:
/*
{
  "type": "UPDATE",
  "table": "public.users", 
  "record": {
    "id": "ef57833e-347b-499d-9aaf-636cb0187c8f",
    "role": "admin",
    "org_id": null,
    "email": "your-email@example.com"
  }
}
*/