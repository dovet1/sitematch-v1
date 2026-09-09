-- Plota planning census and Development intelligence foundation.
--
-- The census is deliberately separate from intelligence. Every application we are
-- licensed to retain can live in planning_applications without incurring model cost;
-- only deterministic limbs A-D enter the classification and Development workflow.

-- The existing alert history keeps its old providers for immutable sent digests. New
-- stored-data alert runs identify Plota without rewriting any historic row.
ALTER TABLE public.planning_alert_runs
  DROP CONSTRAINT IF EXISTS planning_alert_runs_provider_check;
ALTER TABLE public.planning_alert_runs
  ADD CONSTRAINT planning_alert_runs_provider_check
  CHECK (provider IN ('mock', 'plannexus', 'plota'));

CREATE TABLE public.planning_ingest_runs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider              text NOT NULL DEFAULT 'plota',
  kind                  text NOT NULL,
  census_scope          text NOT NULL,
  date_from             date,
  date_to               date,
  status                text NOT NULL DEFAULT 'running',
  requests_made         integer NOT NULL DEFAULT 0,
  records_seen          integer NOT NULL DEFAULT 0,
  records_upserted      integer NOT NULL DEFAULT 0,
  intelligence_records  integer NOT NULL DEFAULT 0,
  error                 text,
  started_at            timestamptz NOT NULL DEFAULT now(),
  finished_at           timestamptz,
  CONSTRAINT planning_ingest_runs_provider CHECK (provider = 'plota'),
  CONSTRAINT planning_ingest_runs_kind CHECK (kind IN ('discovery', 'backfill', 'refresh', 'on_demand')),
  CONSTRAINT planning_ingest_runs_scope CHECK (census_scope IN ('full', 'reduced')),
  CONSTRAINT planning_ingest_runs_status CHECK (status IN ('running', 'complete', 'partial', 'failed'))
);

-- One resumable cursor per exact search. A moving discovery window gets a new scope key;
-- a failed invocation resumes the old one instead of silently starting at page one.
CREATE TABLE public.planning_ingest_checkpoints (
  scope_key             text PRIMARY KEY,
  provider              text NOT NULL DEFAULT 'plota',
  parameters            jsonb NOT NULL,
  next_cursor           text,
  status                text NOT NULL DEFAULT 'pending',
  pages_complete        integer NOT NULL DEFAULT 0,
  records_seen          integer NOT NULL DEFAULT 0,
  last_run_id           uuid REFERENCES public.planning_ingest_runs(id) ON DELETE SET NULL,
  last_error            text,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  completed_at          timestamptz,
  CONSTRAINT planning_ingest_checkpoints_provider CHECK (provider = 'plota'),
  CONSTRAINT planning_ingest_checkpoints_status CHECK (status IN ('pending', 'running', 'complete', 'failed'))
);

CREATE TABLE public.planning_authority_coverage (
  authority_slug                    text PRIMARY KEY,
  authority_name                    text NOT NULL,
  provider                          text NOT NULL DEFAULT 'plota',
  latest_provider_application_date  date,
  latest_observed_application_date  date,
  provider_checked_at               timestamptz,
  last_discovery_at                 timestamptz,
  last_refresh_at                   timestamptz,
  records_last_30d                  integer,
  freshness_state                   text NOT NULL DEFAULT 'unknown',
  last_error                        text,
  metadata                          jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at                        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT planning_authority_coverage_provider CHECK (provider = 'plota'),
  CONSTRAINT planning_authority_freshness CHECK (freshness_state IN ('fresh', 'delayed', 'stale', 'unknown', 'error'))
);

CREATE TABLE public.planning_applications (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider                 text NOT NULL DEFAULT 'plota',
  provider_id              text NOT NULL,
  authority_slug           text NOT NULL,
  authority_name           text NOT NULL,
  reference                text NOT NULL,
  address                  text,
  postcode                 text,
  ward                     text,
  parish                   text,
  parish_code              text,
  uprn                     text,
  description              text NOT NULL DEFAULT '',
  category                 jsonb,
  categories               jsonb NOT NULL DEFAULT '[]'::jsonb,
  planning_route           text,
  procedure                text,
  stated_dwelling_count    integer,
  commercial               boolean,
  commercial_work          text,
  commercial_use_class     text,
  stated_floorspace_sqm    numeric,
  status                   text,
  stage                    text,
  decision                 jsonb,
  appeal                   jsonb,
  date_received            date,
  date_validated           date,
  date_decided             date,
  key_dates                jsonb NOT NULL DEFAULT '{}'::jsonb,
  location                 geography(Point, 4326),
  location_provenance      text NOT NULL DEFAULT 'missing',
  documents_count          integer,
  comments                 jsonb,
  links                    jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_kind              text,
  raw                      jsonb NOT NULL,
  source_changed_at        timestamptz,
  first_seen_at            timestamptz NOT NULL DEFAULT now(),
  last_seen_at             timestamptz NOT NULL DEFAULT now(),
  last_checked_at          timestamptz NOT NULL DEFAULT now(),
  input_hash               text NOT NULL,
  eligibility_limbs        text[] NOT NULL DEFAULT '{}',
  brand_alias_hits         jsonb NOT NULL DEFAULT '[]'::jsonb,
  intelligence_tier        boolean NOT NULL DEFAULT false,
  classification_state     text NOT NULL DEFAULT 'not_eligible',
  review_state             text NOT NULL DEFAULT 'unreviewed',
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_id),
  UNIQUE (authority_slug, reference),
  CONSTRAINT planning_applications_provider CHECK (provider = 'plota'),
  CONSTRAINT planning_applications_commercial_work CHECK (
    commercial_work IS NULL OR commercial_work IN ('new', 'extension', 'to-commercial', 'between', 'loss', 'minor')
  ),
  CONSTRAINT planning_applications_stage CHECK (
    stage IS NULL OR stage IN ('pending', 'approved', 'refused', 'withdrawn', 'decided', 'other')
  ),
  CONSTRAINT planning_applications_location_provenance CHECK (
    location_provenance IN ('source_exact', 'postcode_centroid', 'missing')
  ),
  CONSTRAINT planning_applications_classification_state CHECK (
    classification_state IN ('not_eligible', 'queued', 'processing', 'classified', 'failed', 'deferred_budget')
  ),
  CONSTRAINT planning_applications_review_state CHECK (
    review_state IN ('unreviewed', 'pending', 'approved', 'corrected', 'rejected')
  ),
  CONSTRAINT planning_applications_counts_nonnegative CHECK (
    (stated_dwelling_count IS NULL OR stated_dwelling_count >= 0)
    AND (stated_floorspace_sqm IS NULL OR stated_floorspace_sqm >= 0)
    AND (documents_count IS NULL OR documents_count >= 0)
  )
);

CREATE INDEX planning_applications_location_idx ON public.planning_applications USING gist (location);
CREATE INDEX planning_applications_received_idx ON public.planning_applications (date_received DESC);
CREATE INDEX planning_applications_authority_received_idx ON public.planning_applications (authority_slug, date_received DESC);
CREATE INDEX planning_applications_intelligence_queue_idx
  ON public.planning_applications (classification_state, date_received DESC)
  WHERE intelligence_tier;
CREATE INDEX planning_applications_live_refresh_idx
  ON public.planning_applications (authority_slug, date_received DESC)
  WHERE stage = 'pending';

-- Roughly 3% of Plota records have no source coordinate. A postcode centroid keeps
-- those records usable for area totals, while provenance prevents the UI presenting it
-- as an exact site. This reuses the ONSPD table already maintained for planning alerts.
CREATE OR REPLACE FUNCTION public.planning_application_location_fallback()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.location IS NOT NULL THEN
    NEW.location_provenance := 'source_exact';
  ELSIF NEW.postcode IS NOT NULL THEN
    SELECT p.location INTO NEW.location
    FROM public.uk_postcode_centroids p
    WHERE p.postcode = regexp_replace(
      replace(upper(NEW.postcode), ' ', ''), '(.+)(.{3})$', '\1 \2'
    )
      AND p.is_live
    LIMIT 1;
    IF NEW.location IS NOT NULL THEN
      NEW.location_provenance := 'postcode_centroid';
    ELSE
      NEW.location_provenance := 'missing';
    END IF;
  ELSE
    NEW.location_provenance := 'missing';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER planning_application_set_location
BEFORE INSERT OR UPDATE OF location, postcode ON public.planning_applications
FOR EACH ROW EXECUTE FUNCTION public.planning_application_location_fallback();

CREATE TABLE public.developments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name        text NOT NULL,
  site_address          text,
  postcode              text,
  county                text,
  uprn                   text,
  location              geography(Point, 4326),
  location_provenance   text NOT NULL DEFAULT 'missing',
  lifecycle_stage       text,
  relevance             text,
  confidence            numeric,
  review_state          text NOT NULL DEFAULT 'pending',
  summary               text,
  unanswered_questions  jsonb NOT NULL DEFAULT '[]'::jsonb,
  first_seen_at         timestamptz NOT NULL DEFAULT now(),
  last_seen_at          timestamptz NOT NULL DEFAULT now(),
  last_enriched_at      timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT developments_location_provenance CHECK (location_provenance IN ('source_exact', 'postcode_centroid', 'missing')),
  CONSTRAINT developments_relevance CHECK (relevance IS NULL OR relevance IN ('high', 'medium', 'low')),
  CONSTRAINT developments_confidence CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  CONSTRAINT developments_review_state CHECK (review_state IN ('pending', 'approved', 'corrected', 'rejected'))
);

CREATE INDEX developments_location_idx ON public.developments USING gist (location);
CREATE INDEX developments_review_idx ON public.developments (review_state, relevance, last_seen_at DESC);

CREATE TABLE public.development_applications (
  development_id          uuid NOT NULL REFERENCES public.developments(id) ON DELETE CASCADE,
  planning_application_id uuid NOT NULL REFERENCES public.planning_applications(id) ON DELETE CASCADE,
  role                    text NOT NULL DEFAULT 'primary',
  relationship_source     text NOT NULL,
  confidence              numeric NOT NULL DEFAULT 1,
  created_at              timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (development_id, planning_application_id),
  UNIQUE (planning_application_id),
  CONSTRAINT development_applications_role CHECK (role IN ('primary', 'principal', 'member', 'amendment', 'condition', 'related')),
  CONSTRAINT development_applications_source CHECK (relationship_source IN ('initial', 'plota_associated', 'shared_uprn', 'cited_reference', 'address_name', 'manual')),
  CONSTRAINT development_applications_confidence CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE TABLE public.development_observations (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id          uuid NOT NULL REFERENCES public.developments(id) ON DELETE CASCADE,
  planning_application_id uuid REFERENCES public.planning_applications(id) ON DELETE SET NULL,
  metric                  text NOT NULL,
  scope                   text NOT NULL,
  action                  text NOT NULL,
  value                   numeric NOT NULL,
  unit                    text NOT NULL,
  evidence_excerpt        text,
  evidence_url            text,
  evidence_page           text,
  confidence              numeric,
  review_state            text NOT NULL DEFAULT 'pending',
  created_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT development_observations_metric CHECK (metric IN ('dwellings', 'commercial_floorspace')),
  CONSTRAINT development_observations_scope CHECK (scope IN ('existing', 'proposed', 'lost', 'net', 'stated_unspecified')),
  CONSTRAINT development_observations_action CHECK (action IN ('create', 'retain', 'remove', 'change', 'unknown')),
  CONSTRAINT development_observations_unit CHECK (unit IN ('count', 'sqm')),
  CONSTRAINT development_observations_confidence CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  CONSTRAINT development_observations_review CHECK (review_state IN ('pending', 'approved', 'corrected', 'rejected'))
);

CREATE TABLE public.development_brand_signals (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id          uuid NOT NULL REFERENCES public.developments(id) ON DELETE CASCADE,
  planning_application_id uuid REFERENCES public.planning_applications(id) ON DELETE SET NULL,
  brand_id                uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  observed_name           text NOT NULL,
  role                    text NOT NULL,
  evidence_source         text NOT NULL,
  evidence_excerpt        text,
  evidence_url            text,
  confidence              numeric,
  review_state            text NOT NULL DEFAULT 'pending',
  first_observed_at       timestamptz NOT NULL DEFAULT now(),
  latest_observed_at      timestamptz NOT NULL DEFAULT now(),
  planning_outcome        text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT development_brand_signals_role CHECK (role IN (
    'proposed_occupier', 'proposed_operator', 'applicant_developer', 'existing_occupier',
    'former_occupier', 'neighbouring_occupier', 'referenced_only', 'unclear'
  )),
  CONSTRAINT development_brand_signals_source CHECK (evidence_source IN ('description', 'applicant', 'council_page', 'document', 'web', 'manual')),
  CONSTRAINT development_brand_signals_confidence CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  CONSTRAINT development_brand_signals_review CHECK (review_state IN ('pending', 'approved', 'corrected', 'rejected'))
);

CREATE INDEX development_brand_signals_brand_idx
  ON public.development_brand_signals (brand_id, review_state, latest_observed_at DESC);

CREATE TABLE public.development_evidence (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id  uuid NOT NULL REFERENCES public.developments(id) ON DELETE CASCADE,
  kind            text NOT NULL,
  title           text,
  url             text NOT NULL,
  publisher       text,
  published_at    timestamptz,
  excerpt         text,
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence      numeric,
  retrieved_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT development_evidence_kind CHECK (kind IN ('plota', 'council_page', 'document', 'web', 'manual')),
  CONSTRAINT development_evidence_confidence CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1))
);

CREATE TABLE public.planning_classification_runs (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planning_application_id uuid NOT NULL REFERENCES public.planning_applications(id) ON DELETE CASCADE,
  development_id          uuid REFERENCES public.developments(id) ON DELETE SET NULL,
  stage                   text NOT NULL DEFAULT 'initial',
  provider                text NOT NULL,
  model                   text NOT NULL,
  prompt_version          text NOT NULL,
  schema_version          text NOT NULL,
  input_hash              text NOT NULL,
  status                  text NOT NULL DEFAULT 'running',
  output                  jsonb,
  input_tokens            integer,
  output_tokens           integer,
  cost_usd                numeric,
  error                   text,
  started_at              timestamptz NOT NULL DEFAULT now(),
  finished_at             timestamptz,
  CONSTRAINT planning_classification_runs_stage CHECK (stage IN ('initial', 'reviewer', 'document', 'web')),
  CONSTRAINT planning_classification_runs_status CHECK (status IN ('running', 'complete', 'failed', 'deferred_budget')),
  UNIQUE (planning_application_id, stage, provider, model, prompt_version, schema_version, input_hash)
);

-- Reservations count against the cap until completed or explicitly failed. This makes
-- the monthly ceiling safe even if two workers start at the same time.
CREATE TABLE public.planning_ai_usage (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planning_application_id uuid REFERENCES public.planning_applications(id) ON DELETE SET NULL,
  classification_run_id   uuid REFERENCES public.planning_classification_runs(id) ON DELETE SET NULL,
  stage                   text NOT NULL,
  provider                text NOT NULL,
  model                   text NOT NULL,
  status                  text NOT NULL DEFAULT 'reserved',
  reserved_usd            numeric NOT NULL,
  actual_usd              numeric,
  input_tokens            integer,
  output_tokens           integer,
  occurred_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT planning_ai_usage_stage CHECK (stage IN ('initial', 'reviewer', 'document', 'ocr', 'web', 'reserve')),
  CONSTRAINT planning_ai_usage_status CHECK (status IN ('reserved', 'complete', 'failed')),
  CONSTRAINT planning_ai_usage_costs CHECK (reserved_usd >= 0 AND (actual_usd IS NULL OR actual_usd >= 0))
);

CREATE INDEX planning_ai_usage_month_idx ON public.planning_ai_usage (occurred_at DESC, stage, status);

-- Atomic reservation: advisory lock serialises workers for the few milliseconds needed
-- to total the month. A model call is allowed only after this row exists.
CREATE OR REPLACE FUNCTION public.reserve_planning_ai_usage(
  p_planning_application_id uuid,
  p_classification_run_id uuid,
  p_stage text,
  p_provider text,
  p_model text,
  p_reserved_usd numeric,
  p_monthly_budget_usd numeric,
  p_stage_budget_usd numeric
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_month_start timestamptz := date_trunc('month', now());
  v_total numeric;
  v_stage_total numeric;
  v_id uuid;
BEGIN
  IF p_reserved_usd < 0 OR p_monthly_budget_usd < 0 OR p_stage_budget_usd < 0 THEN
    RAISE EXCEPTION 'AI budgets and reservations must be non-negative';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('planning_ai_usage:' || to_char(v_month_start, 'YYYY-MM')));

  SELECT COALESCE(sum(CASE
    WHEN status = 'failed' THEN 0
    WHEN status = 'complete' AND actual_usd IS NOT NULL THEN actual_usd
    ELSE reserved_usd END), 0)
  INTO v_total
  FROM public.planning_ai_usage
  WHERE occurred_at >= v_month_start;

  SELECT COALESCE(sum(CASE
    WHEN status = 'failed' THEN 0
    WHEN status = 'complete' AND actual_usd IS NOT NULL THEN actual_usd
    ELSE reserved_usd END), 0)
  INTO v_stage_total
  FROM public.planning_ai_usage
  WHERE occurred_at >= v_month_start AND stage = p_stage;

  IF v_total + p_reserved_usd > p_monthly_budget_usd
     OR v_stage_total + p_reserved_usd > p_stage_budget_usd THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.planning_ai_usage (
    planning_application_id, classification_run_id, stage, provider, model,
    status, reserved_usd
  ) VALUES (
    p_planning_application_id, p_classification_run_id, p_stage, p_provider,
    p_model, 'reserved', p_reserved_usd
  ) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE TABLE public.planning_provider_usage (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider            text NOT NULL DEFAULT 'plota',
  endpoint            text NOT NULL,
  request_id          text,
  monthly_limit       integer,
  monthly_remaining   integer,
  status_code         integer NOT NULL,
  occurred_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT planning_provider_usage_provider CHECK (provider = 'plota')
);

-- Promote an intelligence record conservatively: one Development per application.
-- Explicit Plota associations or a human can merge these later; proximity never can.
CREATE OR REPLACE FUNCTION public.ensure_development_for_planning_application()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_development_id uuid;
BEGIN
  IF NEW.intelligence_tier IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT development_id INTO v_development_id
  FROM public.development_applications
  WHERE planning_application_id = NEW.id;

  IF v_development_id IS NULL THEN
    INSERT INTO public.developments (
      canonical_name, site_address, postcode, uprn, location, location_provenance,
      lifecycle_stage, first_seen_at, last_seen_at
    ) VALUES (
      COALESCE(NULLIF(NEW.address, ''), NULLIF(left(NEW.description, 160), ''), NEW.reference),
      NEW.address, NEW.postcode, NEW.uprn, NEW.location, NEW.location_provenance,
      NEW.stage, NEW.first_seen_at, NEW.last_seen_at
    ) RETURNING id INTO v_development_id;

    INSERT INTO public.development_applications (
      development_id, planning_application_id, role, relationship_source, confidence
    ) VALUES (v_development_id, NEW.id, 'primary', 'initial', 1);
  ELSE
    UPDATE public.developments SET
      site_address = COALESCE(NEW.address, site_address),
      postcode = COALESCE(NEW.postcode, postcode),
      uprn = COALESCE(NEW.uprn, uprn),
      location = COALESCE(NEW.location, location),
      location_provenance = CASE
        WHEN NEW.location_provenance = 'source_exact' THEN 'source_exact'
        ELSE location_provenance
      END,
      lifecycle_stage = COALESCE(NEW.stage, lifecycle_stage),
      last_seen_at = NEW.last_seen_at,
      updated_at = now()
    WHERE id = v_development_id;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER planning_application_ensure_development
AFTER INSERT OR UPDATE OF intelligence_tier, stage, location, last_seen_at
ON public.planning_applications
FOR EACH ROW EXECUTE FUNCTION public.ensure_development_for_planning_application();

-- Server-side spatial reads. The app validates polygon size/shape before invoking this;
-- the function still accepts polygons only and applies exact PostGIS intersection.
CREATE OR REPLACE FUNCTION public.planning_applications_in_boundary(p_boundary jsonb, p_since date DEFAULT NULL)
RETURNS SETOF public.planning_applications
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT a.*
  FROM public.planning_applications a
  WHERE a.location IS NOT NULL
    AND (p_since IS NULL OR a.date_received >= p_since)
    AND ST_Intersects(a.location::geometry, ST_SetSRID(ST_GeomFromGeoJSON(p_boundary::text), 4326));
$$;

-- The date filter is an EXISTS rather than a join predicate. A LEFT JOIN plus
-- `a.date_received >= p_since` in WHERE silently drops any Development whose applications
-- are all undated, and every Development that has no application at all -- the merged and
-- manually created cases. date_received is nullable, so first_seen_at is the dated
-- fallback; a Development with no applications stays visible rather than disappearing.
CREATE OR REPLACE FUNCTION public.developments_in_boundary(p_boundary jsonb, p_since date DEFAULT NULL)
RETURNS SETOF public.developments
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT d.*
  FROM public.developments d
  WHERE d.location IS NOT NULL
    AND ST_Intersects(d.location::geometry, ST_SetSRID(ST_GeomFromGeoJSON(p_boundary::text), 4326))
    AND (
      p_since IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.development_applications da
        JOIN public.planning_applications a ON a.id = da.planning_application_id
        WHERE da.development_id = d.id
          AND COALESCE(a.date_received, a.first_seen_at::date) >= p_since
      )
      OR NOT EXISTS (
        SELECT 1 FROM public.development_applications da WHERE da.development_id = d.id
      )
    );
$$;

-- Approved proposed occupier/operator signals only. Pending model guesses never leak to
-- brand surfaces through this view.
CREATE VIEW public.brand_development_quarterly AS
SELECT
  s.brand_id,
  COALESCE(d.county, 'Unknown') AS county,
  date_trunc('quarter', COALESCE(a.date_received::timestamptz, s.first_observed_at))::date AS quarter,
  count(DISTINCT d.id)::integer AS developments,
  count(DISTINCT a.id)::integer AS applications,
  count(DISTINCT d.id) FILTER (WHERE a.stage = 'pending')::integer AS pending,
  count(DISTINCT d.id) FILTER (WHERE a.stage = 'approved')::integer AS approved,
  count(DISTINCT d.id) FILTER (WHERE a.stage = 'refused')::integer AS refused,
  count(DISTINCT d.id) FILTER (WHERE a.stage = 'withdrawn')::integer AS withdrawn
FROM public.development_brand_signals s
JOIN public.developments d ON d.id = s.development_id
LEFT JOIN public.development_applications da ON da.development_id = d.id
LEFT JOIN public.planning_applications a ON a.id = da.planning_application_id
WHERE s.review_state = 'approved'
  AND s.role IN ('proposed_occupier', 'proposed_operator')
  AND s.brand_id IS NOT NULL
GROUP BY s.brand_id, COALESCE(d.county, 'Unknown'),
         date_trunc('quarter', COALESCE(a.date_received::timestamptz, s.first_observed_at))::date;

-- New planning data is never directly readable by browser roles. Product APIs use the
-- service role so they can apply confidence, licensing and location-provenance rules.
ALTER TABLE public.planning_ingest_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_ingest_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_authority_coverage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.development_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.development_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.development_brand_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.development_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_classification_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_provider_usage ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.planning_ingest_runs, public.planning_ingest_checkpoints,
  public.planning_authority_coverage, public.planning_applications, public.developments,
  public.development_applications, public.development_observations,
  public.development_brand_signals, public.development_evidence,
  public.planning_classification_runs, public.planning_ai_usage,
  public.planning_provider_usage, public.brand_development_quarterly
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_ingest_runs,
  public.planning_ingest_checkpoints, public.planning_authority_coverage,
  public.planning_applications, public.developments, public.development_applications,
  public.development_observations, public.development_brand_signals,
  public.development_evidence, public.planning_classification_runs,
  public.planning_ai_usage, public.planning_provider_usage TO service_role;
GRANT SELECT ON public.brand_development_quarterly TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.planning_provider_usage_id_seq TO service_role;

REVOKE ALL ON FUNCTION public.planning_applications_in_boundary(jsonb, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.developments_in_boundary(jsonb, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_planning_ai_usage(uuid, uuid, text, text, text, numeric, numeric, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.planning_applications_in_boundary(jsonb, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.developments_in_boundary(jsonb, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_planning_ai_usage(uuid, uuid, text, text, text, numeric, numeric, numeric) TO service_role;
