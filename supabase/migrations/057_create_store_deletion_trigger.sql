-- Migration 057: Create trigger to enqueue cache rebuilds on store deletion
-- Lightweight, non-blocking trigger that adds entries to cache_rebuild_queue

-- Function: Enqueue cache rebuild request
CREATE OR REPLACE FUNCTION enqueue_cache_rebuild()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Insert rebuild request (fast, non-blocking)
  -- ON CONFLICT DO NOTHING prevents duplicate pending entries
  -- due to UNIQUE constraint on processed_at WHERE processed_at IS NULL
  INSERT INTO cache_rebuild_queue (reason)
  VALUES ('store_delete')
  ON CONFLICT DO NOTHING;

  -- Return NULL because this is an AFTER trigger (return value is ignored)
  RETURN NULL;
END;
$$;

-- Create the trigger on stores table
-- Using AFTER DELETE and FOR EACH STATEMENT (not FOR EACH ROW)
-- This fires once per DELETE statement, not once per deleted row
-- Efficient for bulk deletions - multiple deleted stores = one queue entry
DROP TRIGGER IF EXISTS trigger_enqueue_rebuild_on_store_delete ON stores;
CREATE TRIGGER trigger_enqueue_rebuild_on_store_delete
  AFTER DELETE ON stores
  FOR EACH STATEMENT
  EXECUTE FUNCTION enqueue_cache_rebuild();

-- Add comments for documentation
COMMENT ON FUNCTION enqueue_cache_rebuild IS
  'Enqueues cache rebuild request when stores are deleted. Fast, non-blocking. Prevents duplicate pending entries via UNIQUE constraint.';

COMMENT ON TRIGGER trigger_enqueue_rebuild_on_store_delete ON stores IS
  'Triggers cache rebuild queue entry when stores are deleted. Fires once per DELETE statement, not per row. Processed by cron job or admin endpoint.';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION enqueue_cache_rebuild() TO authenticated;
