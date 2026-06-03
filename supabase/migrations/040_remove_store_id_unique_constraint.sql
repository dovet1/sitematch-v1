-- Migration: Remove UNIQUE constraint on stores.store_id
-- Purpose: Allow multiple NULL values for store_id field (no longer required for imports)

-- Remove the UNIQUE constraint
ALTER TABLE stores DROP CONSTRAINT IF EXISTS stores_store_id_key;

-- Add comment explaining why
COMMENT ON COLUMN stores.store_id IS 'Legacy field from original dataset. No longer required for imports. Multiple NULL values allowed.';
