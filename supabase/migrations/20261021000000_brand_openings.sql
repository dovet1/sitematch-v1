-- Brand opening history, independent of physical-store matching and latest-store overrides.
CREATE TABLE public.brand_openings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  location text NOT NULL CHECK (btrim(location) <> ''),
  opening_date date NOT NULL,
  opening_date_original text NOT NULL CHECK (btrim(opening_date_original) <> ''),
  date_precision text NOT NULL CHECK (date_precision IN ('day', 'month', 'quarter', 'season')),
  is_date_estimated boolean NOT NULL,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'planned')),
  source_url text CHECK (source_url IS NULL OR source_url ~ '^https?://[^[:space:]/]+'),
  source_file text,
  source_file_sha256 text CHECK (source_file_sha256 IS NULL OR source_file_sha256 ~ '^[0-9a-f]{64}$'),
  source_row integer CHECK (source_row IS NULL OR source_row >= 2),
  import_batch_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT brand_openings_estimate_consistency_check CHECK (is_date_estimated = (date_precision <> 'day')),
  CONSTRAINT brand_openings_source_provenance_check CHECK ((source_file_sha256 IS NULL) = (source_row IS NULL)),
  CONSTRAINT brand_openings_source_row_unique UNIQUE (source_file_sha256, source_row)
);

CREATE INDEX brand_openings_brand_date_idx ON public.brand_openings(brand_id, opening_date DESC);
CREATE INDEX brand_openings_date_idx ON public.brand_openings(opening_date DESC);

COMMENT ON TABLE public.brand_openings IS 'Sourced brand opening history. Dates can be estimated; confirmation status is a curation decision, not proof that the source was independently verified.';
COMMENT ON COLUMN public.brand_openings.opening_date IS 'Sortable date: exact dates unchanged; month-only dates use day 1; quarters and seasons use day 15 of the middle month.';
COMMENT ON COLUMN public.brand_openings.opening_date_original IS 'Original source date wording, retained even when opening_date is estimated.';
COMMENT ON COLUMN public.brand_openings.source_url IS 'Source article URL for this opening, not a brand website URL.';
COMMENT ON COLUMN public.brand_openings.import_batch_id IS 'Provenance of the additive import; allows a batch to be audited without modifying other records.';

ALTER TABLE public.brand_openings ENABLE ROW LEVEL SECURITY;
-- Directory data is served by the existing service-role APIs. Direct client access is admin-only.
REVOKE ALL ON public.brand_openings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_openings TO authenticated;
GRANT ALL ON public.brand_openings TO service_role;
CREATE POLICY "Admins can manage brand openings" ON public.brand_openings
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'));

NOTIFY pgrst, 'reload schema';
