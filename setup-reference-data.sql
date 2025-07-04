-- =====================================================
-- Setup Reference Data for Listings
-- This script ensures sectors and use_classes tables have data
-- =====================================================

-- First, let's make sure the sectors table exists and has data
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

-- Insert reference data for use classes
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