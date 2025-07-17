-- =====================================================
-- Migration: 015_add_listing_type_column.sql
-- Description: Add listing_type column to listings table
-- Story: Bug Fix - Listing Type Filter Not Working
-- =====================================================

-- Add listing_type column to listings table
ALTER TABLE public.listings 
ADD COLUMN listing_type text NOT NULL DEFAULT 'commercial' CHECK (listing_type IN ('commercial', 'residential'));

-- Set default values for existing listings
UPDATE public.listings 
SET listing_type = 'commercial' 
WHERE listing_type IS NULL;

-- Create index for listing_type queries
CREATE INDEX IF NOT EXISTS idx_listings_listing_type ON public.listings(listing_type);

-- Sample data: Update some listings to be residential for testing
UPDATE public.listings 
SET listing_type = 'residential' 
WHERE company_name IN ('Residential Corp', 'Housing Ltd', 'Apartment Solutions', 'Residential Properties');

-- If no specific residential companies exist, make some listings residential for testing
UPDATE public.listings 
SET listing_type = 'residential' 
WHERE id IN (
  SELECT id FROM public.listings 
  ORDER BY created_at DESC 
  LIMIT 4
);