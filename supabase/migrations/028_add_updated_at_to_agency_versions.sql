-- Add updated_at column to agency_versions table for tracking draft modifications
-- Story 18.3 - Versioning System

-- Add updated_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='agency_versions' 
        AND column_name='updated_at'
    ) THEN
        ALTER TABLE agency_versions 
        ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Update trigger to automatically set updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for agency_versions table
DROP TRIGGER IF EXISTS update_agency_versions_updated_at ON agency_versions;
CREATE TRIGGER update_agency_versions_updated_at
    BEFORE UPDATE ON agency_versions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();