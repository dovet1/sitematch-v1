-- Update leads table persona constraint to accept new values
-- Drop the old constraint
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_persona_check;

-- Add new constraint with updated persona values
ALTER TABLE public.leads ADD CONSTRAINT leads_persona_check CHECK (
  persona = ANY (ARRAY[
    'commercial_occupier'::text,
    'landlord_developer'::text,
    'housebuilder'::text,
    'agent'::text,
    'government'::text,
    'other'::text
  ])
);

-- Optional: Update existing data to match new values
-- Uncomment if you want to migrate existing data
-- UPDATE public.leads SET persona = 'landlord_developer' WHERE persona = 'landlord';
-- UPDATE public.leads SET persona = 'landlord_developer' WHERE persona = 'vendor';
-- UPDATE public.leads SET persona = 'other' WHERE persona = 'investor';
