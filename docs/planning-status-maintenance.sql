-- Run this command alone in the Supabase SQL Editor as the default postgres role.
-- Do not wrap it in BEGIN/COMMIT or combine it with other statements.
-- Standard VACUUM updates row-visibility information used by index-only scans;
-- ANALYZE refreshes planner statistics. This does not delete application records.
VACUUM (ANALYZE) public.planning_applications;
