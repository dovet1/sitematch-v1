-- Migration: Set live_version_id for all approved listings
-- This fixes listings that were approved before live_version_id was being set

DO $$
DECLARE
  listing_rec RECORD;
  latest_approved_version_id UUID;
BEGIN
  -- Loop through all approved listings
  FOR listing_rec IN
    SELECT id
    FROM listings
    WHERE status = 'approved'
  LOOP
    -- Find the latest approved version for this listing
    SELECT id INTO latest_approved_version_id
    FROM listing_versions
    WHERE listing_id = listing_rec.id
      AND status = 'approved'
    ORDER BY version_number DESC
    LIMIT 1;

    -- If we found an approved version, update the listing
    IF latest_approved_version_id IS NOT NULL THEN
      -- Update the listings table
      UPDATE listings
      SET
        live_version_id = latest_approved_version_id,
        current_version_id = latest_approved_version_id,
        updated_at = NOW()
      WHERE id = listing_rec.id;

      -- Mark this version as live
      UPDATE listing_versions
      SET is_live = true
      WHERE id = latest_approved_version_id;

      -- Mark all other versions of this listing as not live
      UPDATE listing_versions
      SET is_live = false
      WHERE listing_id = listing_rec.id
        AND id != latest_approved_version_id;

      RAISE NOTICE 'Updated listing % with live_version_id %', listing_rec.id, latest_approved_version_id;
    ELSE
      RAISE NOTICE 'No approved version found for listing %', listing_rec.id;
    END IF;
  END LOOP;
END $$;

-- Verify the results
SELECT
  COUNT(*) as total_approved_listings,
  COUNT(live_version_id) as listings_with_live_version,
  COUNT(*) - COUNT(live_version_id) as listings_missing_live_version
FROM listings
WHERE status = 'approved';
