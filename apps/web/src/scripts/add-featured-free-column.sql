-- Add is_featured_free column to listings table
-- This column marks which listings are available to non-paid users

ALTER TABLE listings
ADD COLUMN IF NOT EXISTS is_featured_free BOOLEAN DEFAULT false;

-- Add index for performance when filtering free listings
CREATE INDEX IF NOT EXISTS idx_listings_featured_free
ON listings(is_featured_free)
WHERE is_featured_free = true;

-- Add comment for documentation
COMMENT ON COLUMN listings.is_featured_free IS 'When true, this listing is visible to non-paid users as part of the freemium offering';
