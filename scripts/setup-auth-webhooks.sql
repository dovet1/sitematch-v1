-- Set up database webhooks to trigger JWT claims update

-- Create webhook for public.users table changes
-- This will trigger when user roles are updated
CREATE OR REPLACE TRIGGER update_jwt_claims_on_user_change
  AFTER INSERT OR UPDATE ON public.users
  FOR EACH ROW 
  EXECUTE FUNCTION supabase_functions.http_request(
    'https://nunvbolbcekvtlwuacul.supabase.co/functions/v1/auth-hook',
    'POST',
    '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key', true) || '"}',
    '{}',
    '5000'
  );

-- Note: For auth.users webhook, you need to configure this in the Supabase Dashboard
-- Go to Database > Webhooks and create a webhook for auth.users table
-- Point it to: https://nunvbolbcekvtlwuacul.supabase.co/functions/v1/auth-hook
-- Events: INSERT, UPDATE
-- HTTP Headers: 
--   Content-Type: application/json
--   Authorization: Bearer [your-service-role-key]