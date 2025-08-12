-- Migration: Remove legacy sector_id and use_class_id columns from listings table
-- These are replaced by the junction tables listing_sectors and listing_use_classes

BEGIN;

-- Drop foreign key constraints first
ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_sector_id_fkey;
ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_use_class_id_fkey;

-- Remove the legacy columns
ALTER TABLE public.listings DROP COLUMN IF EXISTS sector_id;
ALTER TABLE public.listings DROP COLUMN IF EXISTS use_class_id;

-- Verify the columns are gone
DO $$
BEGIN
    -- Check if columns still exist (should return 0)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'listings' 
        AND table_schema = 'public' 
        AND column_name IN ('sector_id', 'use_class_id')
    ) THEN
        RAISE WARNING 'Legacy columns still exist in listings table!';
    ELSE
        RAISE NOTICE 'Successfully removed legacy sector_id and use_class_id columns from listings table';
        RAISE NOTICE 'The system now uses listing_sectors and listing_use_classes junction tables exclusively';
    END IF;
END $$;

COMMIT;