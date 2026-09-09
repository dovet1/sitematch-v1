-- A temporary collection point for human relevance labels.
--
-- Calibrating the planning classifier needs judgements from people who are not in the
-- organisation, so the labelling page cannot use any authenticated path. It posts here with
-- the public anon key, exactly as the existing lead-capture form does.
--
-- DELIBERATELY INSERT-ONLY FOR anon. A holder of the anon key (which ships in the browser
-- bundle already, so this exposes no new secret) can add rows and nothing else: no read, no
-- update, no delete. The worst case is junk rows in this table, which the scorer filters by
-- labeller. Nothing here touches the census or the Development tables.
--
-- This is scaffolding for one exercise. When labelling is finished, revoke it:
--   DROP POLICY "planning_label_submissions_anon_insert" ON public.planning_label_submissions;
-- and drop the table once the labels have been scored and exported.

CREATE TABLE public.planning_label_submissions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  labeller         text NOT NULL,
  record_id        text NOT NULL,
  reference        text,
  relevance        text NOT NULL,
  opportunity_type text,
  submitted_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT planning_label_submissions_labeller_len CHECK (
    length(labeller) BETWEEN 1 AND 40
  ),
  CONSTRAINT planning_label_submissions_record_len CHECK (
    length(record_id) BETWEEN 1 AND 64
  ),
  CONSTRAINT planning_label_submissions_reference_len CHECK (
    reference IS NULL OR length(reference) <= 120
  ),
  -- Constraining the vocabulary here means a malformed or hostile post cannot quietly
  -- become a data point the scorer would treat as a real judgement.
  CONSTRAINT planning_label_submissions_relevance CHECK (
    relevance IN ('high', 'medium', 'low', 'skipped')
  ),
  CONSTRAINT planning_label_submissions_opportunity CHECK (
    opportunity_type IS NULL OR opportunity_type IN (
      'new_space', 'change_of_use', 'subdivision', 'commercial_loss',
      'residential_scheme', 'mixed_use', 'other', 'skipped'
    )
  )
);

-- The scorer reads the newest row per labeller and record, so relabelling simply supersedes.
CREATE INDEX planning_label_submissions_latest_idx
  ON public.planning_label_submissions (labeller, record_id, submitted_at DESC);

ALTER TABLE public.planning_label_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planning_label_submissions_anon_insert"
  ON public.planning_label_submissions
  FOR INSERT TO anon
  WITH CHECK (true);

-- Authenticated sessions get the same insert-only footing; reading stays with the service
-- role, which is how the scorer reaches it.
CREATE POLICY "planning_label_submissions_authenticated_insert"
  ON public.planning_label_submissions
  FOR INSERT TO authenticated
  WITH CHECK (true);

REVOKE ALL ON public.planning_label_submissions FROM PUBLIC;
GRANT INSERT ON public.planning_label_submissions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_label_submissions TO service_role;
