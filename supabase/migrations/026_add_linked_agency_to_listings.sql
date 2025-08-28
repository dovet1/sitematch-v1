-- Migration: Add linked_agency_id column to listings table
-- This allows listings to be associated with agencies for agent representation

BEGIN;

-- Add the linked_agency_id column to listings table
ALTER TABLE public.listings 
ADD COLUMN linked_agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX idx_listings_linked_agency_id ON public.listings(linked_agency_id);

-- Update the Database interface types will need to be updated separately

COMMIT;