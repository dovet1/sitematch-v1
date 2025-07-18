-- Update handle_new_user function to use user_type from metadata
-- This ensures user_type is set correctly during user creation

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Get user_type from metadata if available, otherwise use default
  INSERT INTO public.users (id, email, role, user_type)
  VALUES (
    new.id, 
    new.email, 
    'occupier', 
    COALESCE(new.user_metadata->>'user_type', 'Commercial Occupier')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;