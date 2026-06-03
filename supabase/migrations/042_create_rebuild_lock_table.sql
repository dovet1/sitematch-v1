-- Migration: Create rebuild_lock table and concurrency guard functions
-- Purpose: Prevent overlapping BUA summary rebuilds

-- Create lock table
CREATE TABLE rebuild_lock (
  lock_name TEXT PRIMARY KEY,
  locked_at TIMESTAMPTZ NOT NULL,
  locked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Add comment
COMMENT ON TABLE rebuild_lock IS 'Prevents concurrent BUA summary rebuilds. Lock auto-expires after 15 minutes.';

-- Function: Check if rebuild is running
CREATE OR REPLACE FUNCTION is_rebuild_running()
RETURNS BOOLEAN AS $$
DECLARE
  lock_age INTERVAL;
BEGIN
  SELECT NOW() - locked_at INTO lock_age
  FROM rebuild_lock
  WHERE lock_name = 'bua_summary_rebuild';

  -- If lock exists and is less than 15 minutes old, consider it running
  IF lock_age IS NOT NULL AND lock_age < INTERVAL '15 minutes' THEN
    RETURN TRUE;
  ELSE
    -- Clean up stale lock
    DELETE FROM rebuild_lock WHERE lock_name = 'bua_summary_rebuild';
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function: Acquire rebuild lock
CREATE OR REPLACE FUNCTION acquire_rebuild_lock(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Try to insert lock
  INSERT INTO rebuild_lock (lock_name, locked_at, locked_by)
  VALUES ('bua_summary_rebuild', NOW(), p_user_id)
  ON CONFLICT (lock_name) DO NOTHING;

  -- Check if we got the lock
  RETURN EXISTS (
    SELECT 1 FROM rebuild_lock
    WHERE lock_name = 'bua_summary_rebuild'
      AND locked_by = p_user_id
  );
END;
$$ LANGUAGE plpgsql;

-- Function: Release rebuild lock
CREATE OR REPLACE FUNCTION release_rebuild_lock()
RETURNS VOID AS $$
BEGIN
  DELETE FROM rebuild_lock WHERE lock_name = 'bua_summary_rebuild';
END;
$$ LANGUAGE plpgsql;

-- Update master rebuild function to use concurrency guard
CREATE OR REPLACE FUNCTION rebuild_all_bua_summaries(p_user_id UUID DEFAULT NULL)
RETURNS TABLE(progress TEXT) AS $$
BEGIN
  -- Check if rebuild already running
  IF is_rebuild_running() THEN
    RETURN QUERY SELECT 'Rebuild already in progress - skipping' AS progress;
    RETURN;
  END IF;

  -- Acquire lock
  IF NOT acquire_rebuild_lock(p_user_id) THEN
    RETURN QUERY SELECT 'Failed to acquire rebuild lock' AS progress;
    RETURN;
  END IF;

  -- Run rebuilds
  BEGIN
    RETURN QUERY SELECT 'Starting full BUA summary rebuild...' AS progress;
    RETURN QUERY SELECT * FROM rebuild_bua_store_presence();
    RETURN QUERY SELECT * FROM rebuild_bua_store_nearby();
    RETURN QUERY SELECT 'Rebuild complete!' AS progress;

    -- Release lock
    PERFORM release_rebuild_lock();
  EXCEPTION WHEN OTHERS THEN
    -- Release lock on error
    PERFORM release_rebuild_lock();
    RAISE;
  END;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_rebuild_running() TO authenticated;
GRANT EXECUTE ON FUNCTION acquire_rebuild_lock(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION release_rebuild_lock() TO authenticated;
