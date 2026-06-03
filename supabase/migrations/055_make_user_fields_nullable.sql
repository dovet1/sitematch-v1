-- =====================================================
-- Make user_type nullable and add 'Consultant' value
-- Remove company_name and user_type collection from signup
-- =====================================================

-- Drop existing CHECK constraint on user_type
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_user_type_check;

-- Make user_type column nullable
ALTER TABLE public.users ALTER COLUMN user_type DROP NOT NULL;

-- Add new CHECK constraint with NULL support and 'Consultant' value
-- Preserves all existing production values: Commercial Occupier, Landlord/developer,
-- Housebuilder, Agent, Government, Other
-- Adds: Consultant (for consultant routes)
ALTER TABLE public.users ADD CONSTRAINT users_user_type_check CHECK (
  user_type IS NULL OR user_type = ANY (
    ARRAY[
      'Commercial Occupier'::text,
      'Landlord/developer'::text,
      'Housebuilder'::text,
      'Agent'::text,
      'Consultant'::text,
      'Government'::text,
      'Other'::text
    ]
  )
);

-- Update handle_new_user() trigger function to insert NULL for OAuth users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  user_type_value text;
  company_name_value text;
BEGIN
  -- Safely extract user_type from metadata with proper null handling
  BEGIN
    user_type_value := (new.user_metadata->>'user_type')::text;
  EXCEPTION
    WHEN others THEN
      user_type_value := NULL;
  END;

  -- Safely extract company_name from metadata
  BEGIN
    company_name_value := (new.user_metadata->>'user_company_name')::text;
  EXCEPTION
    WHEN others THEN
      company_name_value := NULL;
  END;

  -- Insert user with NULL for missing values (OAuth users)
  -- newsletter_opt_in uses DB default (false)
  INSERT INTO public.users (id, email, role, user_type, user_company_name)
  VALUES (
    new.id,
    new.email,
    'occupier',
    user_type_value,
    company_name_value
  );

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments documenting the changes
COMMENT ON COLUMN public.users.user_type IS 'User type - nullable to support OAuth users who sign up without providing this information. Can be set later via profile completion.';
COMMENT ON COLUMN public.users.user_company_name IS 'Company name - nullable to support OAuth users who sign up without providing this information. Can be set later via profile completion.';

-- Migration complete
-- No data migration needed - all existing values remain valid
-- =====================================================
