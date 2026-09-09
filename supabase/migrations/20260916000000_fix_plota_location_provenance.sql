-- Correct the location provenance vocabulary.
--
-- A one-page live ingest on 8 Sep 2026 showed that Plota reports a `precision` field on
-- every coordinate, and that all nine located records in that sample said "centroid" --
-- none said "exact". The original trigger set `source_exact` whenever a coordinate was
-- present, so every stored row asserted a precision the provider had explicitly denied.
-- location_provenance exists precisely to stop a UI presenting an approximate point as a
-- real site, so this was the one column that must not be wrong.
--
-- Plota's full precision vocabulary is not documented to us, so this migration does not
-- guess it. It stores the provider's raw string and treats ONLY the exact literal 'exact'
-- as an exact point; anything else, including NULL, degrades to 'source_centroid'.
-- Under-claiming precision is the safe direction.

ALTER TABLE public.planning_applications
  ADD COLUMN IF NOT EXISTS location_precision text;

COMMENT ON COLUMN public.planning_applications.location_precision IS
  'The provider''s own description of coordinate precision, stored verbatim (Plota: location.precision, e.g. "centroid"). Evidence for location_provenance; never presented as a site location on its own.';

ALTER TABLE public.planning_applications
  DROP CONSTRAINT IF EXISTS planning_applications_location_provenance;
ALTER TABLE public.planning_applications
  ADD CONSTRAINT planning_applications_location_provenance CHECK (
    location_provenance IN ('source_exact', 'source_centroid', 'postcode_centroid', 'missing')
  );

ALTER TABLE public.developments
  DROP CONSTRAINT IF EXISTS developments_location_provenance;
ALTER TABLE public.developments
  ADD CONSTRAINT developments_location_provenance CHECK (
    location_provenance IN ('source_exact', 'source_centroid', 'postcode_centroid', 'missing')
  );

-- Ordering the vocabulary makes "keep the best location we have seen" expressible without
-- repeating a CASE ladder in every trigger. Higher means more precise.
CREATE OR REPLACE FUNCTION public.location_provenance_rank(p_provenance text)
RETURNS integer LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE p_provenance
    WHEN 'source_exact'      THEN 3
    WHEN 'source_centroid'   THEN 2
    WHEN 'postcode_centroid' THEN 1
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.planning_application_location_fallback()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.location IS NOT NULL THEN
    -- Only an explicit 'exact' earns source_exact. A provider centroid, an unrecognised
    -- value and a missing value are all treated as approximate.
    NEW.location_provenance := CASE
      WHEN lower(COALESCE(NEW.location_precision, '')) = 'exact' THEN 'source_exact'
      ELSE 'source_centroid'
    END;
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

-- location_precision now participates in the decision, so a change to it alone must also
-- re-derive provenance.
DROP TRIGGER IF EXISTS planning_application_set_location ON public.planning_applications;
CREATE TRIGGER planning_application_set_location
BEFORE INSERT OR UPDATE OF location, postcode, location_precision ON public.planning_applications
FOR EACH ROW EXECUTE FUNCTION public.planning_application_location_fallback();

-- Promotion previously upgraded a Development's provenance only to 'source_exact', which
-- left a 'missing' Development stuck at 'missing' even once a postcode centroid arrived.
-- Ranking fixes that and handles the new value in one place.
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
      -- Take the incoming point only when it is genuinely better evidence.
      location = CASE
        WHEN NEW.location IS NOT NULL
         AND public.location_provenance_rank(NEW.location_provenance)
             >= public.location_provenance_rank(location_provenance)
        THEN NEW.location ELSE location END,
      location_provenance = CASE
        WHEN NEW.location IS NOT NULL
         AND public.location_provenance_rank(NEW.location_provenance)
             >= public.location_provenance_rank(location_provenance)
        THEN NEW.location_provenance ELSE location_provenance END,
      lifecycle_stage = COALESCE(NEW.stage, lifecycle_stage),
      last_seen_at = NEW.last_seen_at,
      updated_at = now()
    WHERE id = v_development_id;
  END IF;

  RETURN NEW;
END $$;

-- The promotion trigger watched `location` but not the two columns that now decide
-- provenance. A precision-only correction -- exactly what an admin review would issue --
-- fixed the application while leaving its Development asserting the old, over-claimed
-- precision. It must observe every input to the provenance decision.
DROP TRIGGER IF EXISTS planning_application_ensure_development ON public.planning_applications;
CREATE TRIGGER planning_application_ensure_development
AFTER INSERT OR UPDATE OF
  intelligence_tier, stage, location, location_precision, location_provenance, last_seen_at
ON public.planning_applications
FOR EACH ROW EXECUTE FUNCTION public.ensure_development_for_planning_application();

-- Backfill: recover the precision the census already captured in the raw payload, then
-- re-derive provenance for rows the old trigger mislabelled. Rows located by postcode
-- centroid are matched on provenance, not on location, so they are left untouched.
UPDATE public.planning_applications
SET location_precision = raw -> 'location' ->> 'precision'
WHERE location_precision IS NULL
  AND jsonb_typeof(raw -> 'location') = 'object';

UPDATE public.planning_applications
SET location_provenance = 'source_centroid'
WHERE location IS NOT NULL
  AND location_provenance = 'source_exact'
  AND lower(COALESCE(location_precision, '')) <> 'exact';

UPDATE public.developments d
SET location_provenance = a.location_provenance
FROM public.development_applications da
JOIN public.planning_applications a ON a.id = da.planning_application_id
WHERE da.development_id = d.id
  AND d.location_provenance = 'source_exact'
  AND a.location_provenance <> 'source_exact';

REVOKE ALL ON FUNCTION public.location_provenance_rank(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.location_provenance_rank(text) TO service_role;
