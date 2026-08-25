ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS domain text;
COMMENT ON COLUMN public.brands.domain IS
  'Bare website domain (e.g. boots.com) used to fetch a logo.dev logo. Distinct from logo_url (uploaded file).';
