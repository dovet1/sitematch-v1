-- Set up JWT custom claims using database triggers and HTTP requests

-- Create function to update JWT claims via Edge Function
CREATE OR REPLACE FUNCTION public.update_user_jwt_claims()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  request_id bigint;
  service_role_key text;
BEGIN
  -- Get the service role key from vault (you need to store it there first)
  -- For now, we'll use the Edge Function to handle this
  
  -- Make HTTP request to our Edge Function
  SELECT http_post(
    'https://nunvbolbcekvtlwuacul.supabase.co/functions/v1/auth-hook',
    jsonb_build_object(
      'type', TG_OP,
      'table', 'public.users',
      'record', to_jsonb(NEW)
    )::text,
    'application/json'
  ) INTO request_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger on public.users table
DROP TRIGGER IF EXISTS on_user_profile_change ON public.users;
CREATE TRIGGER on_user_profile_change
  AFTER INSERT OR UPDATE ON public.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.update_user_jwt_claims();

-- Manually trigger JWT claims update for existing users
-- This will populate claims for users who already exist
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT * FROM public.users LOOP
    PERFORM public.update_user_jwt_claims();
  END LOOP;
END $$;