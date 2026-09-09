-- Extend the human-label collection point for classifier v3.
--
-- The calibration exercise now asks three questions instead of two. `opportunity_type` is
-- retired along with the model field it measured, but the column stays: one label was
-- already submitted under the old shape and discarding it would be discarding evidence.
--
-- Two new columns replace it, matching the orthogonal outputs in
-- `docs/plota-development-intelligence-classifier-v3-spec.md`:
--
--   creates_commercial_space  does this produce commercial space someone could occupy
--   dwelling_count            how many homes it creates
--
-- `dwelling_count` is deliberately nullable and the distinction is load-bearing:
--   NULL  the application does not say
--   0     the application says there are none
-- That is exactly the distinction the model got wrong in session 2, when it wrote 0 for
-- "not stated" and produced a confident false zero. Human labels on this column are what
-- let us measure whether v5 has stopped doing it.

ALTER TABLE public.planning_label_submissions
  ADD COLUMN creates_commercial_space text,
  ADD COLUMN dwelling_count integer;

-- Same reasoning as the existing vocabulary constraints: a malformed or hostile post must
-- not quietly become a data point the scorer treats as a real judgement.
ALTER TABLE public.planning_label_submissions
  ADD CONSTRAINT planning_label_submissions_creates_commercial CHECK (
    creates_commercial_space IS NULL
    OR creates_commercial_space IN ('yes', 'no', 'unclear', 'skipped')
  ),
  ADD CONSTRAINT planning_label_submissions_dwelling_count CHECK (
    dwelling_count IS NULL OR (dwelling_count >= 0 AND dwelling_count <= 10000)
  );

-- `opportunity_type` is no longer collected. It was already nullable; this only records
-- the intent for anyone reading the schema after the page stopped sending it.
COMMENT ON COLUMN public.planning_label_submissions.opportunity_type IS
  'Retired with classifier v3. Retained for labels submitted under the v4 exercise.';

COMMENT ON COLUMN public.planning_label_submissions.dwelling_count IS
  'NULL means the application does not state a number. 0 means it states there are none.';

-- Table-level INSERT already covers new columns, so anon labelling keeps working with no
-- further grant. The insert-only footing and the revocation note in the creating migration
-- both still stand.
