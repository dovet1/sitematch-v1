-- Insert test listings for moderation queue
-- Make sure you have a user_id to use as created_by

-- First, let's check what sectors and use_classes exist
-- SELECT id, name FROM sectors;
-- SELECT id, name FROM use_classes;

-- Sample test listings (replace 'your-user-id-here' with actual user ID)
INSERT INTO listings (
  id,
  title,
  company_name,
  description,
  contact_name,
  contact_title,
  contact_email,
  contact_phone,
  site_size_min,
  site_size_max,
  sector_id,
  use_class_id,
  status,
  created_by,
  created_at,
  updated_at
) VALUES 
(
  gen_random_uuid(),
  'Flagship Retail Store - High Street Location',
  'Premium Fashion Co',
  'Seeking high-visibility retail space for flagship fashion store. Requires premium fit-out with large windows and street frontage.',
  'Sarah Johnson',
  'Property Director',
  'sarah.johnson@premiumfashion.co.uk',
  '+44 20 7123 4567',
  2000,
  5000,
  (SELECT id FROM sectors WHERE name = 'Retail' LIMIT 1),
  (SELECT id FROM use_classes WHERE code = 'E(a)' LIMIT 1),
  'pending',
  'your-user-id-here', -- Replace with actual user ID
  NOW(),
  NOW()
),
(
  gen_random_uuid(),
  'Restaurant Chain Expansion',
  'Gourmet Burger Ltd', 
  'Expanding successful burger chain. Need ground floor location with kitchen facilities and outdoor seating potential.',
  'Marcus Chen',
  'Development Manager',
  'marcus.chen@gourmetburger.co.uk',
  '+44 161 555 9876',
  1500,
  3000,
  (SELECT id FROM sectors WHERE name = 'Food & Beverage' LIMIT 1),
  (SELECT id FROM use_classes WHERE code = 'E(b)' LIMIT 1),
  'pending',
  'your-user-id-here', -- Replace with actual user ID
  NOW(),
  NOW()
),
(
  gen_random_uuid(),
  'Rejected Example - Missing Details',
  'Incomplete Corp',
  'Need office space somewhere.',
  'John Doe',
  'Manager',
  'john@incomplete.com',
  NULL,
  NULL,
  NULL,
  (SELECT id FROM sectors WHERE name = 'Technology' LIMIT 1),
  (SELECT id FROM use_classes WHERE code = 'B1' LIMIT 1),
  'rejected',
  'your-user-id-here', -- Replace with actual user ID
  NOW(),
  NOW()
);

-- Check the results
-- SELECT id, title, company_name, status, created_at FROM listings ORDER BY created_at DESC;