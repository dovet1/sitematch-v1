-- Migration 035: Create saved search notification queue table
-- Stores pending email notifications for new matches
-- Allows batching and retry logic for email delivery

CREATE TABLE IF NOT EXISTS saved_search_notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  search_id UUID NOT NULL REFERENCES saved_searches(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,

  -- Prevent duplicate notifications for the same search/listing combination
  CONSTRAINT unique_notification UNIQUE(search_id, listing_id)
);

-- Index for efficiently finding pending notifications (most common query)
-- Partial index only indexes unsent notifications
CREATE INDEX idx_notification_queue_pending
  ON saved_search_notification_queue(sent_at)
  WHERE sent_at IS NULL;

-- Index for grouping notifications by user when sending emails
CREATE INDEX idx_notification_queue_user
  ON saved_search_notification_queue(user_id)
  WHERE sent_at IS NULL;

-- Index for cleanup operations (finding old sent notifications)
CREATE INDEX idx_notification_queue_created_at
  ON saved_search_notification_queue(created_at DESC);

-- Add helpful comment
COMMENT ON TABLE saved_search_notification_queue IS 'Queue of pending email notifications for new saved search matches. Processed daily by cron job.';
COMMENT ON COLUMN saved_search_notification_queue.sent_at IS 'Timestamp when notification was sent. NULL = pending.';
