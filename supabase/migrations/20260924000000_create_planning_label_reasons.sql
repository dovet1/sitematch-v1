-- Free-text reasoning behind labels already given.
--
-- Separate from `planning_label_submissions` on purpose. That table holds verdicts and its
-- constraints assume one; this holds the reasoning behind a verdict already recorded there,
-- and writing prose into the verdict table would mean supplying a relevance value again and
-- risking a stale one overwriting the real label.
--
-- Same insert-only footing as the labels table, and for the same reason: the expert giving
-- these reasons is outside the organisation, so there is no authenticated path available.
-- An artifact-hosted page cannot serve this need -- declaring a shared store makes an
-- artifact organisation-internal -- so this is posted to from a standalone file with the
-- public anon key, exactly as the labelling page does.
--
-- Scaffolding for one exercise. Revoke when the reasoning has been collected:
--   DROP POLICY "planning_label_reasons_anon_insert" ON public.planning_label_reasons;

CREATE TABLE public.planning_label_reasons (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  labeller      text NOT NULL,
  record_id     text NOT NULL,
  reference     text,
  -- Carried so a reason can be read without joining, and so a mismatch against the stored
  -- label is visible rather than silent.
  verdict       text NOT NULL,
  model_verdict text,
  reason        text NOT NULL,
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT planning_label_reasons_labeller_len CHECK (length(labeller) BETWEEN 1 AND 40),
  CONSTRAINT planning_label_reasons_record_len CHECK (length(record_id) BETWEEN 1 AND 64),
  CONSTRAINT planning_label_reasons_reference_len CHECK (reference IS NULL OR length(reference) <= 120),
  CONSTRAINT planning_label_reasons_reason_len CHECK (length(reason) BETWEEN 1 AND 2000),
  CONSTRAINT planning_label_reasons_verdict CHECK (verdict IN ('high', 'medium', 'low')),
  CONSTRAINT planning_label_reasons_model_verdict CHECK (
    model_verdict IS NULL OR model_verdict IN ('high', 'medium', 'low')
  )
);

-- Editing a reason appends, so the newest row per labeller and record wins on read.
CREATE INDEX planning_label_reasons_latest_idx
  ON public.planning_label_reasons (labeller, record_id, submitted_at DESC);

ALTER TABLE public.planning_label_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planning_label_reasons_anon_insert"
  ON public.planning_label_reasons FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "planning_label_reasons_authenticated_insert"
  ON public.planning_label_reasons FOR INSERT TO authenticated WITH CHECK (true);

REVOKE ALL ON public.planning_label_reasons FROM PUBLIC;
GRANT INSERT ON public.planning_label_reasons TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_label_reasons TO service_role;
