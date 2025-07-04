-- =====================================================
-- Migration: 006_enhanced_listings_schema.sql
-- Description: Enhanced listings database schema with PRD-aligned fields
-- Story: 3.0 - Enhanced Database Schema Implementation
-- QA Issues Fixed: Contact fields, enhanced media support, PRD sectors
-- =====================================================

-- Update sectors with PRD-specified options
DELETE FROM public.sectors;
INSERT INTO public.sectors (name, description) VALUES 
  ('retail', 'Retail and consumer-facing businesses'),
  ('food_beverage', 'Food & Beverage establishments'),
  ('leisure', 'Entertainment and hospitality'),
  ('industrial_logistics', 'Industrial & Logistics operations'),
  ('office', 'Office and professional services'),
  ('healthcare', 'Healthcare and medical services'),
  ('automotive', 'Automotive and transport services'),
  ('roadside', 'Roadside and highway services'),
  ('other', 'Other sectors not specified above');

-- Add PRD-required contact fields to listings table
ALTER TABLE public.listings 
ADD COLUMN contact_name text NOT NULL DEFAULT '',
ADD COLUMN contact_title text NOT NULL DEFAULT '',
ADD COLUMN contact_email text NOT NULL DEFAULT '',
ADD COLUMN contact_phone text;

-- Remove default values after adding columns
ALTER TABLE public.listings 
ALTER COLUMN contact_name DROP DEFAULT,
ALTER COLUMN contact_title DROP DEFAULT,
ALTER COLUMN contact_email DROP DEFAULT;

-- Update media_files table to support enhanced file types
ALTER TABLE public.media_files 
DROP CONSTRAINT IF EXISTS media_files_file_type_check;

ALTER TABLE public.media_files 
ADD CONSTRAINT media_files_file_type_check 
CHECK (file_type IN ('brochure', 'logo', 'site_plan', 'fit_out', 'image', 'pdf', 'video'));

-- Add file category and display order if not exists
ALTER TABLE public.media_files 
ADD COLUMN IF NOT EXISTS file_category text CHECK (file_category IN ('company', 'property', 'gallery')),
ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;

-- Create specialized media tables for enhanced organization

-- Company logos table
CREATE TABLE IF NOT EXISTS public.company_logos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_size integer NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Listing documents table (site plans, store plans, brochures)
CREATE TABLE IF NOT EXISTS public.listing_documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE NOT NULL,
  document_type text NOT NULL CHECK (document_type IN ('site_plan', 'store_plan', 'brochure')),
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_size integer NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Listing galleries table (fit-out examples)
CREATE TABLE IF NOT EXISTS public.listing_galleries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('image', 'video')),
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_size integer NOT NULL,
  thumbnail_url text,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =====================================================
-- ROW LEVEL SECURITY FOR NEW TABLES
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE public.company_logos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_galleries ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES FOR COMPANY LOGOS
-- =====================================================

-- Users can view logos for listings they can access
CREATE POLICY "Users can view logos for accessible listings" ON public.company_logos
  FOR SELECT USING (
    listing_id IN (
      SELECT id FROM public.listings 
      WHERE org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
      OR status = 'approved'
    )
  );

-- Occupiers can manage logos for their own listings
CREATE POLICY "Occupiers can manage logos for own listings" ON public.company_logos
  FOR ALL USING (
    listing_id IN (
      SELECT id FROM public.listings 
      WHERE org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid() AND role = 'occupier')
    )
  );

-- Public can view logos for approved listings
CREATE POLICY "Public can view logos for approved listings" ON public.company_logos
  FOR SELECT TO anon USING (
    listing_id IN (SELECT id FROM public.listings WHERE status = 'approved')
  );

-- =====================================================
-- RLS POLICIES FOR LISTING DOCUMENTS
-- =====================================================

-- Users can view documents for listings they can access
CREATE POLICY "Users can view documents for accessible listings" ON public.listing_documents
  FOR SELECT USING (
    listing_id IN (
      SELECT id FROM public.listings 
      WHERE org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
      OR status = 'approved'
    )
  );

-- Occupiers can manage documents for their own listings
CREATE POLICY "Occupiers can manage documents for own listings" ON public.listing_documents
  FOR ALL USING (
    listing_id IN (
      SELECT id FROM public.listings 
      WHERE org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid() AND role = 'occupier')
    )
  );

-- Public can view documents for approved listings
CREATE POLICY "Public can view documents for approved listings" ON public.listing_documents
  FOR SELECT TO anon USING (
    listing_id IN (SELECT id FROM public.listings WHERE status = 'approved')
  );

-- =====================================================
-- RLS POLICIES FOR LISTING GALLERIES
-- =====================================================

-- Users can view galleries for listings they can access
CREATE POLICY "Users can view galleries for accessible listings" ON public.listing_galleries
  FOR SELECT USING (
    listing_id IN (
      SELECT id FROM public.listings 
      WHERE org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid())
      OR status = 'approved'
    )
  );

-- Occupiers can manage galleries for their own listings
CREATE POLICY "Occupiers can manage galleries for own listings" ON public.listing_galleries
  FOR ALL USING (
    listing_id IN (
      SELECT id FROM public.listings 
      WHERE org_id IN (SELECT org_id FROM public.users WHERE id = auth.uid() AND role = 'occupier')
    )
  );

-- Public can view galleries for approved listings
CREATE POLICY "Public can view galleries for approved listings" ON public.listing_galleries
  FOR SELECT TO anon USING (
    listing_id IN (SELECT id FROM public.listings WHERE status = 'approved')
  );

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Index for company logo queries by listing
CREATE INDEX IF NOT EXISTS idx_company_logos_listing_id ON public.company_logos(listing_id);

-- Index for document queries by listing
CREATE INDEX IF NOT EXISTS idx_listing_documents_listing_id ON public.listing_documents(listing_id);

-- Index for gallery queries by listing
CREATE INDEX IF NOT EXISTS idx_listing_galleries_listing_id ON public.listing_galleries(listing_id);

-- Index for gallery ordering
CREATE INDEX IF NOT EXISTS idx_listing_galleries_display_order ON public.listing_galleries(listing_id, display_order);

-- =====================================================
-- VALIDATION CONSTRAINTS
-- =====================================================

-- Add email validation for contact_email
ALTER TABLE public.listings 
ADD CONSTRAINT listings_contact_email_format 
CHECK (contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Add phone validation for contact_phone (optional field)
ALTER TABLE public.listings 
ADD CONSTRAINT listings_contact_phone_format 
CHECK (contact_phone IS NULL OR contact_phone ~* '^\+?[1-9]\d{1,14}$');