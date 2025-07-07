-- =====================================================
-- Add dedicated company_name column to listings table
-- =====================================================

-- Add company_name column to listings table
ALTER TABLE public.listings 
ADD COLUMN company_name text;

-- Update existing listings to extract company name from title
-- This handles existing "Property Requirement - CompanyName" titles
UPDATE public.listings 
SET company_name = TRIM(SUBSTRING(title FROM 'Property Requirement - (.*)'))
WHERE title LIKE 'Property Requirement - %';

-- Set company_name as required for new listings
ALTER TABLE public.listings 
ALTER COLUMN company_name SET NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.listings.company_name IS 'Name of the company/organization looking for commercial space';

-- Migration complete
-- =====================================================