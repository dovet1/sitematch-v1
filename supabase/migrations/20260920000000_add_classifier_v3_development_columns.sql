-- Columns for classifier v3, so the model's answers are queryable rather than buried.
--
-- The field this replaces, `opportunityType`, was emitted on every one of 164 records and
-- stored nowhere: it lived only inside the run output JSON, no product code ever read it,
-- and two of its seven values were never returned at all. Adding the columns in the same
-- change as the schema is what stops that repeating.
--
-- See `docs/plota-development-intelligence-classifier-v3-spec.md`.

ALTER TABLE public.developments
  ADD COLUMN creates_commercial_space text,
  ADD COLUMN commercial_use_classes   text[] NOT NULL DEFAULT '{}',
  ADD COLUMN model_dwelling_count     integer,
  ADD COLUMN model_dwelling_basis     text,
  -- Derived in code as (relevance = high AND creates_commercial_space = yes), not asked of
  -- the model. Stored because the expensive document and web-search pass selects on it.
  ADD COLUMN escalate_for_research    boolean NOT NULL DEFAULT false;

ALTER TABLE public.developments
  ADD CONSTRAINT developments_creates_commercial_space CHECK (
    creates_commercial_space IS NULL
    OR creates_commercial_space IN ('yes', 'no', 'unclear')
  ),
  ADD CONSTRAINT developments_model_dwelling_count CHECK (
    model_dwelling_count IS NULL OR model_dwelling_count >= 0
  ),
  ADD CONSTRAINT developments_model_dwelling_basis CHECK (
    model_dwelling_basis IS NULL
    OR model_dwelling_basis IN ('stated', 'counted_from_description', 'not_stated')
  );

-- `model_dwelling_count` sits beside Plota's own `stated_dwelling_count` rather than
-- overwriting it. Plota leaves its figure empty on 130 of the 164 records currently in the
-- tier while the description states the number plainly, so the model recovers what Plota
-- lacks -- but where both speak they can disagree, both are evidence, and a reviewer has to
-- be able to see the pair.
COMMENT ON COLUMN public.developments.model_dwelling_count IS
  'Homes the model read from the description. NULL means the application does not say; 0 means it says none. Compare with the source figure, never replace it.';

COMMENT ON COLUMN public.developments.escalate_for_research IS
  'Derived gate for the paid document and web-search pass. Set by the classifier worker, not by the model.';

-- The research pass reads exactly this slice, so it gets its own index. Partial, because
-- the false rows are the overwhelming majority and are never selected.
CREATE INDEX developments_escalate_for_research_idx
  ON public.developments (escalate_for_research, last_seen_at DESC)
  WHERE escalate_for_research;

-- Dwellings are a first-class field now, so no further observation rows carry that metric.
-- Existing rows are left alone: they are real model output from v4 runs and deleting them
-- would destroy the only record of what v4 said, which v5 has to be compared against.
COMMENT ON COLUMN public.development_observations.metric IS
  'commercial_floorspace for v3 and later. Rows with metric = dwellings are v4 output, retained for comparison.';
