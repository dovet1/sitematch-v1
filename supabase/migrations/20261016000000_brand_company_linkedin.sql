-- Company LinkedIn page, separate from individual contacts' linkedin_url fields.
-- Nullable with no default so existing brand data remains unchanged.
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS linkedin_url text;

COMMENT ON COLUMN public.brands.linkedin_url IS
  'Company LinkedIn page URL. May be a company or official showcase page; distinct from contact LinkedIn URLs.';
