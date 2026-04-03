-- Migration: Enable pg_trgm extension for fuzzy string matching
-- Purpose: Support fuzzy brand name matching (>90% similarity detection)

-- Enable the extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add comment
COMMENT ON EXTENSION pg_trgm IS 'Provides similarity() function for fuzzy string matching in store imports';

-- Create index on brands.name for fast similarity searches
CREATE INDEX IF NOT EXISTS idx_brands_name_trgm ON brands USING gin (name gin_trgm_ops);

-- Add comment
COMMENT ON INDEX idx_brands_name_trgm IS 'GIN index for fuzzy brand name matching using trigram similarity';
