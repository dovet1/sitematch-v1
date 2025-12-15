-- Migration 033: Create saved search matches cache table
-- This table stores cached matching results for saved searches to improve performance
-- Instead of running expensive match queries on every page load, we cache results daily

CREATE TABLE IF NOT EXISTS saved_search_matches_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id UUID NOT NULL REFERENCES saved_searches(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  distance_miles NUMERIC(10, 2),
  cached_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure we don't duplicate the same match
  CONSTRAINT unique_search_listing UNIQUE(search_id, listing_id)
);

-- Index for fast lookups by search_id (most common query pattern)
CREATE INDEX idx_search_matches_search_id ON saved_search_matches_cache(search_id);

-- Index for cleanup operations and reverse lookups
CREATE INDEX idx_search_matches_listing_id ON saved_search_matches_cache(listing_id);

-- Index for identifying stale cache entries
CREATE INDEX idx_search_matches_cached_at ON saved_search_matches_cache(cached_at DESC);

-- Enable Row Level Security
ALTER TABLE saved_search_matches_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view cached matches for their own saved searches
CREATE POLICY "Users can view cached matches for their searches"
  ON saved_search_matches_cache FOR SELECT
  USING (
    search_id IN (
      SELECT id FROM saved_searches WHERE user_id = auth.uid()
    )
  );

-- Add helpful comment
COMMENT ON TABLE saved_search_matches_cache IS 'Cached results of saved search matching queries. Updated daily by cron job to improve performance.';
