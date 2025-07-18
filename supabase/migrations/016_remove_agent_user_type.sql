-- Remove 'Agent' from user_type constraint
-- This migration removes the 'Agent' option from the user_type check constraint

-- First, drop the existing constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_user_type_check;

-- Recreate the constraint without 'Agent'
ALTER TABLE public.users ADD CONSTRAINT users_user_type_check CHECK (
  user_type = ANY (
    ARRAY[
      'Commercial Occupier'::text,
      'Housebuilder'::text,
      'Consultant'::text,
      'Landlord/Vendor'::text,
      'Developer'::text,
      'Government'::text,
      'Other'::text
    ]
  )
);

-- Optional: Update any existing users with 'Agent' type to 'Other' (if any exist)
UPDATE public.users 
SET user_type = 'Other' 
WHERE user_type = 'Agent';