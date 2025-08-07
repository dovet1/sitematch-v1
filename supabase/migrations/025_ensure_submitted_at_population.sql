-- Migration: Ensure submitted_at is populated correctly
-- Updates any existing versions that might be missing submitted_at

BEGIN;

-- Update any existing versions that don't have submitted_at set
-- Use created_at as the fallback since that's when the version was submitted
UPDATE listing_versions 
SET submitted_at = created_at 
WHERE submitted_at IS NULL;

-- Create a trigger to automatically set submitted_at on new versions
CREATE OR REPLACE FUNCTION set_submitted_at_on_insert()
RETURNS TRIGGER AS $$
BEGIN
    -- Always set submitted_at on new versions if not already set
    IF NEW.submitted_at IS NULL THEN
        NEW.submitted_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger for new inserts only
DROP TRIGGER IF EXISTS trigger_set_submitted_at ON listing_versions;
CREATE TRIGGER trigger_set_submitted_at
    BEFORE INSERT ON listing_versions
    FOR EACH ROW
    EXECUTE FUNCTION set_submitted_at_on_insert();

COMMIT;