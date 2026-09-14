-- Read-only, standalone check of the four freshness calculations.
-- Replace the SQL Editor contents with this entire file before running.
ROLLBACK;
BEGIN READ ONLY;
SET LOCAL ROLE service_role;
SET LOCAL statement_timeout = '30s';

EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT
  (SELECT max(date_received)
   FROM public.planning_applications) AS latest_application_date,
  (SELECT count(*)
   FROM public.planning_applications) AS stored_records,
  (SELECT count(*)
   FROM public.planning_applications
   WHERE stage IS NULL OR stage IN ('pending', 'other')) AS live_records,
  (SELECT min(last_checked_at)
   FROM public.planning_applications
   WHERE stage IS NULL OR stage IN ('pending', 'other')) AS oldest_live_checked_at;

COMMIT;
