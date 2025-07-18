-- Fix handle_new_user function to include user_type field
-- This fixes the 500 error during user signup by ensuring user_type is set

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert user with default role and user_type
  INSERT INTO public.users (id, email, role, user_type)
  VALUES (new.id, new.email, 'occupier', 'Commercial Occupier'); -- Default to most common type
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;