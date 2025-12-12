-- Migration 034: Add email notification settings to saved searches
-- Allows users to control whether they receive email notifications for new matches

-- Add email notification settings columns
ALTER TABLE saved_searches
  ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMPTZ;

-- Index for efficiently finding searches with notifications enabled
-- Partial index (only indexes rows where email_notifications_enabled = true)
CREATE INDEX IF NOT EXISTS idx_saved_searches_email_notifications
  ON saved_searches(email_notifications_enabled)
  WHERE email_notifications_enabled = true;

-- Add helpful comments
COMMENT ON COLUMN saved_searches.email_notifications_enabled IS 'Whether user wants to receive email notifications for new matches';
COMMENT ON COLUMN saved_searches.last_notified_at IS 'Timestamp of last email notification sent for this search';
