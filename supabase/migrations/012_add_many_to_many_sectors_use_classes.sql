-- =====================================================
-- Migration 012: Add Many-to-Many Support for Sectors and Use Classes
-- Adds junction tables to support multiple sectors and use classes per listing
-- =====================================================

-- Junction table for listing-sector relationships
CREATE TABLE listing_sectors (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  sector_id uuid REFERENCES sectors(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(listing_id, sector_id)
);

-- Junction table for listing-use_class relationships  
CREATE TABLE listing_use_classes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid REFERENCES listings(id) ON DELETE CASCADE NOT NULL,
  use_class_id uuid REFERENCES use_classes(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(listing_id, use_class_id)
);

-- Add indexes for better query performance
CREATE INDEX idx_listing_sectors_listing_id ON listing_sectors(listing_id);
CREATE INDEX idx_listing_sectors_sector_id ON listing_sectors(sector_id);
CREATE INDEX idx_listing_use_classes_listing_id ON listing_use_classes(listing_id);
CREATE INDEX idx_listing_use_classes_use_class_id ON listing_use_classes(use_class_id);

-- Migrate existing data from single foreign keys to junction tables
-- This preserves existing sector and use class assignments
INSERT INTO listing_sectors (listing_id, sector_id)
SELECT id, sector_id 
FROM listings 
WHERE sector_id IS NOT NULL;

INSERT INTO listing_use_classes (listing_id, use_class_id)
SELECT id, use_class_id 
FROM listings 
WHERE use_class_id IS NOT NULL;

-- Set up RLS policies for junction tables
ALTER TABLE listing_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_use_classes ENABLE ROW LEVEL SECURITY;

-- RLS policies for listing_sectors
CREATE POLICY "Users can view listing sectors"
ON listing_sectors FOR SELECT
USING (true);

CREATE POLICY "Users can insert listing sectors"
ON listing_sectors FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM listings 
    WHERE id = listing_id 
    AND created_by = auth.uid()
  )
);

CREATE POLICY "Users can update listing sectors"
ON listing_sectors FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM listings 
    WHERE id = listing_id 
    AND created_by = auth.uid()
  )
);

CREATE POLICY "Users can delete listing sectors"
ON listing_sectors FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM listings 
    WHERE id = listing_id 
    AND created_by = auth.uid()
  )
);

-- RLS policies for listing_use_classes
CREATE POLICY "Users can view listing use classes"
ON listing_use_classes FOR SELECT
USING (true);

CREATE POLICY "Users can insert listing use classes"
ON listing_use_classes FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM listings 
    WHERE id = listing_id 
    AND created_by = auth.uid()
  )
);

CREATE POLICY "Users can update listing use classes"
ON listing_use_classes FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM listings 
    WHERE id = listing_id 
    AND created_by = auth.uid()
  )
);

CREATE POLICY "Users can delete listing use classes"
ON listing_use_classes FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM listings 
    WHERE id = listing_id 
    AND created_by = auth.uid()
  )
);

-- Add comments for documentation
COMMENT ON TABLE listing_sectors IS 'Junction table for many-to-many relationship between listings and sectors';
COMMENT ON TABLE listing_use_classes IS 'Junction table for many-to-many relationship between listings and use classes';