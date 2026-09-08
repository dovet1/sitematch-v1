-- Migration: match state on store_floor_areas, and a record of each matching run.
--
-- Why this exists
-- ---------------
-- Stores imported after the last full matcher run carry no floor area and nothing says
-- so. A cron will match them in batches; this is the state that makes the batch
-- restartable and its failures visible instead of silent.
--
-- The queue is DERIVED, not stored
-- --------------------------------
-- The matcher writes a row for every store it considers, including confidence='none'
-- when no admissible certificate exists (scripts/epc/matchall.py). So:
--
--     queue = stores with no row in store_floor_areas
--
-- There is no enqueue step to forget, no trigger to maintain, and nothing that can fall
-- out of step with the stores table. "Never attempted" stays genuinely distinguishable
-- from "attempted, found nothing" — which a status column on a queue table would blur
-- the first time someone requeued a row.
--
-- That leaves errors with nowhere to live, which is what the two columns below are for.
-- They belong on this row rather than in a side table precisely because the queue is
-- derived from this row's absence: state about an attempt and the attempt's result
-- cannot drift apart if they are the same row.

-- =============================================================================
-- 1. Attempt state
--
-- Additive only. On PostgreSQL 11+ a non-volatile DEFAULT is recorded in the catalogue
-- rather than written to every tuple, so this does not rewrite the table.
--
-- DEFAULT 1, not 0: every row that exists was produced by a matcher run that attempted
-- it. Zero would describe 43,070 already-matched stores as never tried.
-- =============================================================================
ALTER TABLE public.store_floor_areas
  ADD COLUMN IF NOT EXISTS match_attempts integer NOT NULL DEFAULT 1;

ALTER TABLE public.store_floor_areas
  ADD COLUMN IF NOT EXISTS last_error text;

COMMENT ON COLUMN public.store_floor_areas.match_attempts IS
  'How many times a matcher has tried this store. Existing rows default to 1 because they are the output of a run that did try them. A row is retried while this is below the worker''s limit; past it the row is a dead letter and should be visible as one rather than retried forever.';
COMMENT ON COLUMN public.store_floor_areas.last_error IS
  'Why the most recent attempt failed, or NULL if it did not. A row carrying this alongside confidence=''none'' means the matcher broke, which is a different thing from the register having no certificate for the store — and the difference matters, because only one of them is worth retrying.';

-- Finding retryable failures must not scan 43,070 rows to return a handful.
CREATE INDEX IF NOT EXISTS idx_store_floor_areas_last_error
  ON public.store_floor_areas (match_attempts)
  WHERE last_error IS NOT NULL;

-- =============================================================================
-- 2. epc_match_runs — what the admin health page reads.
--
-- Everything else on that page is derivable from store_floor_areas and stores. This is
-- not: how long a run took, how many stores it looked at, and whether it finished. A run
-- that dies half way is otherwise indistinguishable from one that found nothing, and
-- both look like a healthy quiet day.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.epc_match_runs (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 'incremental' is the cron over newly imported stores; 'full' is the quarterly
  -- Python run over the whole estate; 'backfill' is a deliberate re-match of a subset.
  kind              text        NOT NULL,
  matcher_version   text        NOT NULL,
  status            text        NOT NULL DEFAULT 'running',

  stores_considered integer     NOT NULL DEFAULT 0,
  matched_high      integer     NOT NULL DEFAULT 0,
  matched_medium    integer     NOT NULL DEFAULT 0,
  matched_low       integer     NOT NULL DEFAULT 0,
  matched_none      integer     NOT NULL DEFAULT 0,
  errored           integer     NOT NULL DEFAULT 0,

  error             text,
  started_at        timestamptz NOT NULL DEFAULT now(),
  finished_at       timestamptz,

  CONSTRAINT epc_match_runs_kind_valid
    CHECK (kind IN ('incremental', 'full', 'backfill')),
  CONSTRAINT epc_match_runs_status_valid
    CHECK (status IN ('running', 'complete', 'failed'))
);

COMMENT ON TABLE public.epc_match_runs IS
  'One row per matching run. The tier counts are what they were at the end of the run, not a live view — store_floor_areas is the live view, and the point of this table is to be able to tell a run that found nothing from a run that never finished.';

CREATE INDEX IF NOT EXISTS idx_epc_match_runs_started
  ON public.epc_match_runs (started_at DESC);

ALTER TABLE public.epc_match_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.epc_match_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.epc_match_runs TO service_role;
