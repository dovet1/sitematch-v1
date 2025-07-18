-- Fix handle_new_user function to properly handle metadata access
-- This ensures the function doesn't fail when metadata is not available

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  user_type_value text;
BEGIN
  -- Safely extract user_type from metadata with proper null handling
  BEGIN
    user_type_value := (new.user_metadata->>'user_type')::text;
  EXCEPTION 
    WHEN others THEN
      user_type_value := NULL;
  END;
  
  -- Use extracted value or default to Commercial Occupier
  IF user_type_value IS NULL OR user_type_value = '' THEN
    user_type_value := 'Commercial Occupier';
  END IF;
  
  -- Insert user with extracted or default user_type
  INSERT INTO public.users (id, email, role, user_type)
  VALUES (
    new.id, 
    new.email, 
    'occupier', 
    user_type_value
  );
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;