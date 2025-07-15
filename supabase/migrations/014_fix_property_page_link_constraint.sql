-- =====================================================
-- Migration: 014_fix_property_page_link_constraint.sql
-- Description: Fix the property_page_link constraint regex pattern
-- =====================================================

-- Drop the existing constraint
ALTER TABLE public.listings 
DROP CONSTRAINT IF EXISTS listings_property_page_link_format;

-- Add the corrected constraint
ALTER TABLE public.listings 
ADD CONSTRAINT listings_property_page_link_format 
CHECK (
  property_page_link IS NULL 
  OR property_page_link ~* '^https?://[^\s/$.?#].[^\s]*$'
);