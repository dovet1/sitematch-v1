-- =====================================================
-- Migration: 013_add_property_page_link_column.sql
-- Description: Add property_page_link column to listings table
-- =====================================================

-- Add property_page_link column to listings table
ALTER TABLE public.listings 
ADD COLUMN property_page_link text;

-- Add URL format validation for property_page_link
ALTER TABLE public.listings 
ADD CONSTRAINT listings_property_page_link_format 
CHECK (
  property_page_link IS NULL 
  OR property_page_link ~* '^https?://[^\s/$.?#].[^\s]*$'
);

-- Add comment for documentation
COMMENT ON COLUMN public.listings.property_page_link IS 'Optional URL link to the occupier''s property page';