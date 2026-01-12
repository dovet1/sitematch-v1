-- =====================================================
-- Add articleImage to file_uploads allowed file types
-- =====================================================

-- First, make org_id nullable since article images don't belong to an organization
ALTER TABLE file_uploads ALTER COLUMN org_id DROP NOT NULL;

-- Drop the existing constraints
ALTER TABLE file_uploads DROP CONSTRAINT IF EXISTS valid_file_type;
ALTER TABLE file_uploads DROP CONSTRAINT IF EXISTS valid_bucket;

-- Add the new constraint with articleImage included (NOT VALID to skip existing rows)
ALTER TABLE file_uploads
ADD CONSTRAINT valid_file_type
CHECK (file_type IN ('logo', 'brochure', 'sitePlan', 'fitOut', 'headshot', 'articleImage')) NOT VALID;

-- Validate the constraint (will only apply to new rows)
ALTER TABLE file_uploads VALIDATE CONSTRAINT valid_file_type;

-- Add the new bucket constraint with article-images included (NOT VALID to skip existing rows)
ALTER TABLE file_uploads
ADD CONSTRAINT valid_bucket
CHECK (bucket_name IN ('logos', 'brochures', 'site-plans', 'fit-outs', 'headshots', 'article-images')) NOT VALID;

-- Validate the constraint (will only apply to new rows)
ALTER TABLE file_uploads VALIDATE CONSTRAINT valid_bucket;
