-- =====================================================
-- Complete Database Setup for Listings System
-- Run this in Supabase SQL Editor to set up all required tables
-- =====================================================

-- 1. Create sectors table
CREATE TABLE IF NOT EXISTS public.sectors (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create use_classes table
CREATE TABLE IF NOT EXISTS public.use_classes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create listings table (assumes organisations and users tables exist)
CREATE TABLE IF NOT EXISTS public.listings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL, -- We'll add foreign key later if organisations table exists
  title text NOT NULL,
  description text,
  sector_id uuid REFERENCES public.sectors(id) NOT NULL,
  use_class_id uuid REFERENCES public.use_classes(id) NOT NULL,
  site_size_min integer,
  site_size_max integer,
  brochure_url text,
  -- Contact fields (from migration 006)
  contact_name text NOT NULL DEFAULT '',
  contact_title text NOT NULL DEFAULT '',
  contact_email text NOT NULL DEFAULT '',
  contact_phone text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
  created_by uuid NOT NULL, -- We'll add foreign key later if users table exists
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Remove default values from contact fields
ALTER TABLE public.listings 
ALTER COLUMN contact_name DROP DEFAULT,
ALTER COLUMN contact_title DROP DEFAULT,
ALTER COLUMN contact_email DROP DEFAULT;

-- 4. Create faqs table
CREATE TABLE IF NOT EXISTS public.faqs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Insert sectors data
INSERT INTO public.sectors (name, description) VALUES 
  ('retail', 'Retail and consumer-facing businesses'),
  ('food_beverage', 'Food & Beverage establishments'),
  ('leisure', 'Entertainment and hospitality'),
  ('industrial_logistics', 'Industrial & Logistics operations'),
  ('office', 'Office and professional services'),
  ('healthcare', 'Healthcare and medical services'),
  ('automotive', 'Automotive and transport services'),
  ('roadside', 'Roadside and highway services'),
  ('other', 'Other sectors not specified above')
ON CONFLICT (name) DO NOTHING;

-- 6. Insert use classes data
INSERT INTO public.use_classes (code, name, description) VALUES 
  ('E(a)', 'Retail', 'Display or retail sale of goods'),
  ('E(b)', 'Café/Restaurant', 'Sale of food and drink for consumption'),
  ('E(g)(i)', 'Office', 'Offices to carry out operational/administrative functions'),
  ('E(g)(iii)', 'Light Industrial', 'Light industrial processes'),
  ('B2', 'General Industrial', 'General industrial processes'),
  ('B8', 'Storage/Distribution', 'Storage or distribution of goods'),
  ('C1', 'Hotel', 'Hotels and accommodation'),
  ('Sui Generis', 'Special Use', 'Drive-thru, Petrol, Cinema, Casino, etc.')
ON CONFLICT (code) DO NOTHING;

-- 7. Enable Row Level Security (optional, for production use)
-- ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.use_classes ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

-- 8. Create policies for public access to reference data
-- CREATE POLICY "Anyone can view sectors" ON public.sectors FOR SELECT USING (true);
-- CREATE POLICY "Anyone can view use classes" ON public.use_classes FOR SELECT USING (true);

-- Verification queries
SELECT 'Sectors created:' as status, count(*) as count FROM public.sectors;
SELECT 'Use classes created:' as status, count(*) as count FROM public.use_classes;