-- Add columns for agency edit workflow - Story 18.3.1
-- Add to agency_versions table for tracking submission timing

ALTER TABLE agency_versions 
ADD COLUMN IF NOT EXISTS submitted_for_review_at TIMESTAMP WITH TIME ZONE;

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'agency_versions' 
AND column_name = 'submitted_for_review_at';