-- Migration: Fix statement timeout in rebuild_all_bua_summaries function
-- Purpose: Disable statement timeout for long-running rebuild operations
-- Issue: The rebuild was being killed mid-execution due to PostgreSQL statement timeout

-- Update the function to disable statement timeout at the start
CREATE OR REPLACE FUNCTION rebuild_all_bua_summaries(p_user_id UUID DEFAULT NULL)
RETURNS TABLE(progress TEXT) AS $$
BEGIN
  -- Disable statement timeout for this long-running operation
  -- This is safe because we have a 15-minute lock expiry as a safety mechanism
  SET LOCAL statement_timeout = 0;

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

-- Add comment explaining the change
COMMENT ON FUNCTION rebuild_all_bua_summaries(UUID) IS 'Rebuilds BUA summary tables with statement timeout disabled. Takes 5-10 minutes to complete. Protected by 15-minute lock expiry.';
