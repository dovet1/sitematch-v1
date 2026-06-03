-- Migration 056: Create cache rebuild queue table
-- Stores pending GapFinder cache rebuild requests
-- Processed by cron job or admin endpoint

CREATE TABLE IF NOT EXISTS cache_rebuild_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reason TEXT NOT NULL,  -- 'store_delete', 'store_update', 'manual'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  rebuild_started_at TIMESTAMPTZ,
  rebuild_completed_at TIMESTAMPTZ,
  error TEXT
);

-- Partial unique index to prevent duplicate pending rebuilds
-- Only one pending rebuild allowed at a time (processed_at IS NULL)
CREATE UNIQUE INDEX idx_cache_rebuild_queue_unique_pending
  ON cache_rebuild_queue((processed_at IS NULL))
  WHERE processed_at IS NULL;

-- Partial index for efficiently finding pending rebuilds (most common query)
-- Only indexes rows where processed_at IS NULL
CREATE INDEX idx_cache_rebuild_queue_pending
  ON cache_rebuild_queue(created_at)
  WHERE processed_at IS NULL;

-- Index for monitoring and cleanup operations
-- Find recently completed rebuilds ordered by completion time
CREATE INDEX idx_cache_rebuild_queue_completed
  ON cache_rebuild_queue(processed_at DESC)
  WHERE processed_at IS NOT NULL;

-- Add helpful comments
COMMENT ON TABLE cache_rebuild_queue IS
  'Queue for pending GapFinder cache rebuilds. Processed by cron job every 30 minutes or via admin endpoint.';

COMMENT ON COLUMN cache_rebuild_queue.reason IS
  'Why rebuild was requested: store_delete, store_update, or manual';

COMMENT ON COLUMN cache_rebuild_queue.processed_at IS
  'Timestamp when queue entry was picked up for processing. NULL = pending.';

COMMENT ON COLUMN cache_rebuild_queue.rebuild_started_at IS
  'Timestamp when rebuild_all_bua_summaries() was called';

COMMENT ON COLUMN cache_rebuild_queue.rebuild_completed_at IS
  'Timestamp when rebuild fully completed (may be NULL if still running or failed)';

COMMENT ON COLUMN cache_rebuild_queue.error IS
  'Error message if rebuild failed';
