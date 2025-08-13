-- Add agency_id to file_uploads table to support agency files
-- This allows the same table to handle both listing and agency file uploads

-- Add agency_id column
ALTER TABLE file_uploads 
ADD COLUMN agency_id UUID NULL;

-- Add foreign key constraint
ALTER TABLE file_uploads 
ADD CONSTRAINT file_uploads_agency_id_fkey 
FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_file_uploads_agency_id 
ON file_uploads USING btree (agency_id);

-- Add constraint to ensure either listing_id OR agency_id is set (but not both)
ALTER TABLE file_uploads 
ADD CONSTRAINT file_uploads_single_parent_check 
CHECK (
  (listing_id IS NOT NULL AND agency_id IS NULL) OR
  (listing_id IS NULL AND agency_id IS NOT NULL)
);