-- Migration: Enable RLS on all listing-related tables and create appropriate policies
-- This ensures proper data access control throughout the listing flow

BEGIN;

-- =====================================================
-- Enable RLS on tables that don't have it
-- =====================================================

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.use_classes ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- LISTINGS TABLE POLICIES
-- =====================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own listings" ON public.listings;
DROP POLICY IF EXISTS "Users can create their own listings" ON public.listings;
DROP POLICY IF EXISTS "Users can update their own listings" ON public.listings;
DROP POLICY IF EXISTS "Users can delete their own listings" ON public.listings;
DROP POLICY IF EXISTS "Admins can view all listings" ON public.listings;
DROP POLICY IF EXISTS "Admins can update all listings" ON public.listings;
DROP POLICY IF EXISTS "Public can view approved listings" ON public.listings;

-- Users can view their own listings
CREATE POLICY "Users can view their own listings" 
ON public.listings FOR SELECT 
USING (auth.uid() = created_by);

-- Users can create listings
CREATE POLICY "Users can create their own listings" 
ON public.listings FOR INSERT 
WITH CHECK (auth.uid() = created_by);

-- Users can update their own listings
CREATE POLICY "Users can update their own listings" 
ON public.listings FOR UPDATE 
USING (auth.uid() = created_by);

-- Users can delete their own draft listings
CREATE POLICY "Users can delete their own draft listings" 
ON public.listings FOR DELETE 
USING (auth.uid() = created_by AND status = 'draft');

-- Admins can do everything
CREATE POLICY "Admins can view all listings" 
ON public.listings FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role = 'admin'
    )
);

CREATE POLICY "Admins can update all listings" 
ON public.listings FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role = 'admin'
    )
);

-- Public can view approved listings (for public API)
CREATE POLICY "Public can view approved listings" 
ON public.listings FOR SELECT 
USING (status = 'approved');

-- =====================================================
-- FAQS TABLE POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can manage FAQs for their listings" ON public.faqs;
DROP POLICY IF EXISTS "Admins can manage all FAQs" ON public.faqs;
DROP POLICY IF EXISTS "Public can view FAQs for approved listings" ON public.faqs;

-- Users can manage FAQs for their own listings
CREATE POLICY "Users can manage FAQs for their listings" 
ON public.faqs FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.listings 
        WHERE id = faqs.listing_id 
        AND created_by = auth.uid()
    )
);

-- Admins can manage all FAQs
CREATE POLICY "Admins can manage all FAQs" 
ON public.faqs FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role = 'admin'
    )
);

-- Public can view FAQs for approved listings
CREATE POLICY "Public can view FAQs for approved listings" 
ON public.faqs FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.listings 
        WHERE id = faqs.listing_id 
        AND status = 'approved'
    )
);

-- =====================================================
-- LISTING_LOCATIONS TABLE POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can manage locations for their listings" ON public.listing_locations;
DROP POLICY IF EXISTS "Admins can manage all locations" ON public.listing_locations;
DROP POLICY IF EXISTS "Public can view locations for approved listings" ON public.listing_locations;

-- Users can manage locations for their own listings
CREATE POLICY "Users can manage locations for their listings" 
ON public.listing_locations FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.listings 
        WHERE id = listing_locations.listing_id 
        AND created_by = auth.uid()
    )
);

-- Admins can manage all locations
CREATE POLICY "Admins can manage all locations" 
ON public.listing_locations FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role = 'admin'
    )
);

-- Public can view locations for approved listings
CREATE POLICY "Public can view locations for approved listings" 
ON public.listing_locations FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.listings 
        WHERE id = listing_locations.listing_id 
        AND status = 'approved'
    )
);

-- =====================================================
-- SECTORS AND USE_CLASSES TABLES (Reference Data)
-- =====================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Anyone can view sectors" ON public.sectors;
DROP POLICY IF EXISTS "Only admins can manage sectors" ON public.sectors;
DROP POLICY IF EXISTS "Anyone can view use classes" ON public.use_classes;
DROP POLICY IF EXISTS "Only admins can manage use classes" ON public.use_classes;

-- Everyone can read sectors (reference data)
CREATE POLICY "Anyone can view sectors" 
ON public.sectors FOR SELECT 
USING (true);

-- Only admins can modify sectors
CREATE POLICY "Only admins can manage sectors" 
ON public.sectors FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role = 'admin'
    )
);

-- Everyone can read use classes (reference data)
CREATE POLICY "Anyone can view use classes" 
ON public.use_classes FOR SELECT 
USING (true);

-- Only admins can modify use classes
CREATE POLICY "Only admins can manage use classes" 
ON public.use_classes FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE id = auth.uid() 
        AND role = 'admin'
    )
);

-- =====================================================
-- Verify existing policies for already-enabled tables
-- =====================================================

-- Check that these tables have appropriate policies:
-- - file_uploads (already has RLS)
-- - listing_contacts (already has RLS)
-- - listing_sectors (already has RLS)
-- - listing_use_classes (already has RLS)
-- - listing_versions (already has RLS)

-- =====================================================
-- Summary of what this migration does:
-- =====================================================
-- 1. Enables RLS on: listings, faqs, listing_locations, sectors, use_classes
-- 2. Creates policies for user access to their own data
-- 3. Creates policies for admin access to all data
-- 4. Creates policies for public access to approved listings
-- 5. Ensures reference tables (sectors, use_classes) are readable by all

COMMIT;