-- =====================================================
-- Missing Tables Setup for Listings System
-- Run this in Supabase SQL Editor to create the missing tables
-- =====================================================

-- 1. Create listing_locations table
CREATE TABLE IF NOT EXISTS public.listing_locations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE NOT NULL,
  place_name text NOT NULL,
  coordinates jsonb, -- Stores [longitude, latitude] array
  type text CHECK (type IN ('preferred', 'acceptable')) NOT NULL,
  formatted_address text NOT NULL,
  region text,
  country text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create listing_contacts table
CREATE TABLE IF NOT EXISTS public.listing_contacts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE NOT NULL,
  contact_name text NOT NULL,
  contact_title text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  is_primary_contact boolean DEFAULT false NOT NULL,
  headshot_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create file_uploads table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.file_uploads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE,
  org_id uuid NOT NULL,
  user_id uuid NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('logo', 'brochure', 'sitePlan', 'fitOut', 'headshot')),
  mime_type text NOT NULL,
  bucket_name text NOT NULL CHECK (bucket_name IN ('logos', 'brochures', 'site-plans', 'fit-outs', 'headshots')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_listing_locations_listing_id ON public.listing_locations(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_contacts_listing_id ON public.listing_contacts(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_contacts_is_primary ON public.listing_contacts(listing_id, is_primary_contact);
CREATE INDEX IF NOT EXISTS idx_file_uploads_listing_id ON public.file_uploads(listing_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_org_user ON public.file_uploads(org_id, user_id);

-- Verification queries
SELECT 'listing_locations table created successfully' as status;
SELECT 'listing_contacts table created successfully' as status;
SELECT 'file_uploads table created successfully' as status;