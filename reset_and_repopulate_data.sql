-- =====================================================
-- Reset and Repopulate Sectors and Use Classes
-- This script will delete all listings and related data,
-- then repopulate sectors and use_classes tables
-- =====================================================

-- Start transaction
BEGIN;

-- 1. DELETE ALL LISTINGS AND RELATED DATA
-- Due to foreign key constraints, we need to delete in the correct order

-- First, clear the foreign key references in listings table
UPDATE listings SET current_version_id = NULL, live_version_id = NULL;

-- Delete from tables that reference listings
DELETE FROM auto_save_log;
DELETE FROM faqs;
DELETE FROM listing_contacts;
DELETE FROM listing_locations;
DELETE FROM listing_sectors;
DELETE FROM listing_use_classes;
DELETE FROM agency_listings;
DELETE FROM file_uploads WHERE listing_id IS NOT NULL;

-- Now we can delete listing_versions
DELETE FROM listing_versions;

-- Finally, delete the listings themselves
DELETE FROM listings;

-- 2. CLEAR AND REPOPULATE SECTORS
DELETE FROM sectors;

INSERT INTO sectors (name, description) VALUES 
  ('Automotive', 'Automotive dealerships, service centers, car washes, and vehicle-related businesses'),
  ('Care & retirement', 'Care homes, assisted living facilities, retirement communities, and elderly care services'),
  ('Data centre', 'Data storage facilities, server farms, cloud computing infrastructure, and colocation centers'),
  ('Drive-thru', 'Quick service restaurants, coffee shops, banks, and pharmacies with drive-thru facilities'),
  ('EV charging', 'Electric vehicle charging stations, EV infrastructure, and sustainable transport hubs'),
  ('Food & beverage', 'Restaurants, cafes, bars, pubs, food halls, and catering establishments'),
  ('Gym', 'Fitness centers, health clubs, sports facilities, yoga studios, and wellness centers'),
  ('Hotel', 'Hotels, motels, boutique accommodations, serviced apartments, and hospitality venues'),
  ('Industrial', 'Manufacturing facilities, warehouses, factories, workshops, and industrial estates'),
  ('Leisure', 'Entertainment venues, cinemas, bowling alleys, amusement centers, and recreational facilities'),
  ('Logistics', 'Distribution centers, fulfillment centers, last-mile delivery hubs, and supply chain facilities'),
  ('Medical', 'Hospitals, clinics, medical centers, diagnostic facilities, and healthcare services'),
  ('Nursery & childcare', 'Day nurseries, preschools, childcare centers, after-school clubs, and early years facilities'),
  ('Office', 'Corporate offices, business parks, coworking spaces, and professional service buildings'),
  ('Residential', 'Residential developments, apartment complexes, housing estates, and mixed-use residential'),
  ('Retail', 'Shops, stores, shopping centers, retail parks, and consumer-facing businesses'),
  ('Storage', 'Self-storage facilities, warehouse storage, document storage, and secure storage solutions'),
  ('Vet', 'Veterinary clinics, animal hospitals, pet care centers, and animal health facilities');

-- 3. CLEAR AND REPOPULATE USE CLASSES
DELETE FROM use_classes;

INSERT INTO use_classes (code, name, description) VALUES 
  ('B', 'Business', 'General industrial and business uses including offices, research and development, and light industry suitable in residential areas'),
  ('C', 'Residential', 'Dwellinghouses, residential care homes, secure residential institutions, and hotels/hostels/boarding houses'),
  ('E', 'Commercial, Business and Service', 'Retail, professional services, cafes/restaurants, offices, indoor sport/recreation, medical services, nurseries, and other commercial uses'),
  ('F', 'Local Community and Learning', 'Non-residential institutions for local community use including education, places of worship, public halls, and outdoor sport/recreation'),
  ('Sui Generis', 'Sui Generis', 'Uses that do not fall within any specific use class, including theaters, nightclubs, casinos, petrol stations, car showrooms, and other unique uses');

-- Commit the transaction
COMMIT;

-- Verify the changes
SELECT 'Sectors:' as table_name, COUNT(*) as count FROM sectors
UNION ALL
SELECT 'Use Classes:', COUNT(*) FROM use_classes
UNION ALL
SELECT 'Listings:', COUNT(*) FROM listings;