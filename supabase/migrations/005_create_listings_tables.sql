-- =====================================================
-- Migration: 005_create_listings_tables.sql
-- Description: Create complete listings database schema with RLS policies
-- Story: 3.0 - Listings Database Schema & Core API
-- =====================================================

-- Sector reference table
CREATE TABLE public.sectors (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Use class reference table  
CREATE TABLE public.use_classes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE, -- E.g., 'E(a)', 'B2', 'Sui Generis'
  name text NOT NULL, -- E.g., 'Retail', 'General Industrial'
  description text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert reference data for sectors
INSERT INTO public.sectors (name, description) VALUES 
  ('retail', 'Retail and consumer-facing businesses'),
  ('office', 'Office and professional services'),
  ('industrial', 'Industrial and logistics operations'),
  ('leisure', 'Entertainment and hospitality'),
  ('mixed', 'Mixed-use or multiple sectors');

-- Insert reference data for use classes
INSERT INTO public.use_classes (code, name, description) VALUES 
  ('E(a)', 'Retail', 'Display or retail sale of goods'),
  ('E(b)', 'Café/Restaurant', 'Sale of food and drink for consumption'),
  ('E(g)(i)', 'Office', 'Offices to carry out operational/administrative functions'),
  ('E(g)(iii)', 'Light Industrial', 'Light industrial processes'),
  ('B2', 'General Industrial', 'General industrial processes'),
  ('B8', 'Storage/Distribution', 'Storage or distribution of goods'),
  ('C1', 'Hotel', 'Hotels and accommodation'),
  ('Sui Generis', 'Special Use', 'Drive-thru, Petrol, Cinema, Casino, etc.');

-- Listings table (aligned with architecture)
CREATE TABLE public.listings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid REFERENCES public.organisations(id) NOT NULL,
  title text NOT NULL,
  description text,
  sector_id uuid REFERENCES public.sectors(id) NOT NULL,
  use_class_id uuid REFERENCES public.use_classes(id) NOT NULL,
  site_size_min integer, -- square feet
  site_size_max integer, -- square feet
  brochure_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
  created_by uuid REFERENCES public.users(id) NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Listing locations table
CREATE TABLE public.listing_locations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE NOT NULL,
  location_name text NOT NULL,
  location_type text NOT NULL CHECK (location_type IN ('preferred', 'acceptable')),
  coordinates jsonb, -- Store lat/lng from Mapbox
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Media files table
CREATE TABLE public.media_files (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE NOT NULL,
  file_type text NOT NULL CHECK (file_type IN ('brochure', 'image', 'pdf')),
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_size integer NOT NULL, -- bytes
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- FAQs table (from architecture requirements)
CREATE TABLE public.faqs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =====================================================
-- ROW LEVEL SECURITY SETUP
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.use_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES FOR REFERENCE TABLES
-- =====================================================

-- Anyone can view sectors and use classes (public reference data)
CREATE POLICY "Anyone can view sectors" ON public.sectors FOR SELECT USING (true);
CREATE POLICY "Anyone can view use classes" ON public.use_classes FOR SELECT USING (true);

-- =====================================================
-- RLS POLICIES FOR LISTINGS
-- =====================================================

-- Occupiers can view listings from their own organization
CREATE POLICY "Occupiers can view own org listings" ON public.listings
  FOR SELECT USING (org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid()));

-- Occupiers can create listings for their organization
CREATE POLICY "Occupiers can create listings" ON public.listings
  FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid() AND role = 'occupier'));

-- Occupiers can update listings from their own organization
CREATE POLICY "Occupiers can update own org listings" ON public.listings
  FOR UPDATE USING (org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid() AND role = 'occupier'));

-- Occupiers can delete listings from their own organization
CREATE POLICY "Occupiers can delete own org listings" ON public.listings
  FOR DELETE USING (org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid() AND role = 'occupier'));

-- Admins can view all listings
CREATE POLICY "Admins can view all listings" ON public.listings
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- Admins can update all listings (for status management)
CREATE POLICY "Admins can update all listings" ON public.listings
  FOR UPDATE USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- Public (anonymous) users can view approved listings only
CREATE POLICY "Public can view approved listings" ON public.listings
  FOR SELECT TO anon USING (status = 'approved');

-- =====================================================
-- RLS POLICIES FOR LISTING LOCATIONS
-- =====================================================

-- Users can view locations for listings they can access
CREATE POLICY "Users can view locations for accessible listings" ON public.listing_locations
  FOR SELECT USING (
    listing_id IN (
      SELECT id FROM public.listings 
      WHERE org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
      OR status = 'approved'
    )
  );

-- Occupiers can manage locations for their own listings
CREATE POLICY "Occupiers can manage locations for own listings" ON public.listing_locations
  FOR ALL USING (
    listing_id IN (
      SELECT id FROM public.listings 
      WHERE org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid() AND role = 'occupier')
    )
  );

-- Public can view locations for approved listings
CREATE POLICY "Public can view locations for approved listings" ON public.listing_locations
  FOR SELECT TO anon USING (
    listing_id IN (SELECT id FROM public.listings WHERE status = 'approved')
  );

-- =====================================================
-- RLS POLICIES FOR MEDIA FILES
-- =====================================================

-- Users can view media files for listings they can access
CREATE POLICY "Users can view media for accessible listings" ON public.media_files
  FOR SELECT USING (
    listing_id IN (
      SELECT id FROM public.listings 
      WHERE org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
      OR status = 'approved'
    )
  );

-- Occupiers can manage media files for their own listings
CREATE POLICY "Occupiers can manage media for own listings" ON public.media_files
  FOR ALL USING (
    listing_id IN (
      SELECT id FROM public.listings 
      WHERE org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid() AND role = 'occupier')
    )
  );

-- Public can view media files for approved listings
CREATE POLICY "Public can view media for approved listings" ON public.media_files
  FOR SELECT TO anon USING (
    listing_id IN (SELECT id FROM public.listings WHERE status = 'approved')
  );

-- =====================================================
-- RLS POLICIES FOR FAQS
-- =====================================================

-- Users can view FAQs for listings they can access
CREATE POLICY "Users can view FAQs for accessible listings" ON public.faqs
  FOR SELECT USING (
    listing_id IN (
      SELECT id FROM public.listings 
      WHERE org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
      OR status = 'approved'
    )
  );

-- Occupiers can manage FAQs for their own listings
CREATE POLICY "Occupiers can manage FAQs for own listings" ON public.faqs
  FOR ALL USING (
    listing_id IN (
      SELECT id FROM public.listings 
      WHERE org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid() AND role = 'occupier')
    )
  );

-- Public can view FAQs for approved listings
CREATE POLICY "Public can view FAQs for approved listings" ON public.faqs
  FOR SELECT TO anon USING (
    listing_id IN (SELECT id FROM public.listings WHERE status = 'approved')
  );

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Index for listing queries by organization
CREATE INDEX idx_listings_org_id ON public.listings(org_id);

-- Index for listing queries by status
CREATE INDEX idx_listings_status ON public.listings(status);

-- Index for listing queries by sector
CREATE INDEX idx_listings_sector_id ON public.listings(sector_id);

-- Index for listing queries by use class
CREATE INDEX idx_listings_use_class_id ON public.listings(use_class_id);

-- Index for location queries by listing
CREATE INDEX idx_listing_locations_listing_id ON public.listing_locations(listing_id);

-- Index for media file queries by listing
CREATE INDEX idx_media_files_listing_id ON public.media_files(listing_id);

-- Index for FAQ queries by listing
CREATE INDEX idx_faqs_listing_id ON public.faqs(listing_id);

-- Index for FAQ ordering
CREATE INDEX idx_faqs_display_order ON public.faqs(listing_id, display_order);

-- =====================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =====================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to listings table
CREATE TRIGGER update_listings_updated_at BEFORE UPDATE ON public.listings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();