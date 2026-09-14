-- The late and deep discovery lanes re-read older receipt dates for applications councils
-- published late. Logged as plain 'discovery', they would stand in for main discovery in
-- planning_pipeline_status (which reports the latest run per kind), so a stopped main
-- discovery could look healthy. Give each lane its own run kind. No rows change.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.planning_ingest_runs
  DROP CONSTRAINT planning_ingest_runs_kind,
  ADD CONSTRAINT planning_ingest_runs_kind
    CHECK (kind IN ('discovery', 'discovery_late', 'discovery_deep', 'backfill', 'refresh', 'on_demand'));

COMMIT;
