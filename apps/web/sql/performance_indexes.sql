-- Performance Indexes for /search Page Optimization
-- Run these commands in your Supabase SQL Editor
-- These indexes will significantly speed up common query patterns

-- 1. Index for status + featured filtering (most common query)
-- Speeds up filtering approved listings and checking is_featured_free for free tier users
CREATE INDEX IF NOT EXISTS idx_listings_status_featured
ON listings(status, is_featured_free)
WHERE status = 'approved';

-- 2. Index for listing_sectors junction table
-- Speeds up sector filtering queries
CREATE INDEX IF NOT EXISTS idx_listing_sectors_lookup
ON listing_sectors(listing_id);

-- Also index the reverse lookup (finding listings by sector)
CREATE INDEX IF NOT EXISTS idx_listing_sectors_sector_lookup
ON listing_sectors(sector_id);

-- 3. Index for listing_use_classes junction table
-- Speeds up use class filtering queries
CREATE INDEX IF NOT EXISTS idx_listing_use_classes_lookup
ON listing_use_classes(listing_id);

-- Also index the reverse lookup (finding listings by use class)
CREATE INDEX IF NOT EXISTS idx_listing_use_classes_useclass_lookup
ON listing_use_classes(use_class_id);

-- 4. Index for listing_locations
-- Speeds up location-based queries when fetching locations for listings
CREATE INDEX IF NOT EXISTS idx_listing_locations_listing
ON listing_locations(listing_id);

-- 5. Index for file_uploads logo lookups
-- Speeds up fetching logos for listings
CREATE INDEX IF NOT EXISTS idx_file_uploads_listing_logo
ON file_uploads(listing_id, file_type)
WHERE file_type = 'logo';

-- 6. Composite index for listing_versions (if not already exists)
-- Speeds up fetching approved versions by listing_id
CREATE INDEX IF NOT EXISTS idx_listing_versions_listing_status_version
ON listing_versions(listing_id, status, version_number DESC)
WHERE status = 'approved';

-- Verify indexes were created
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
