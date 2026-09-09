-- Recognise `rooftop` as an exact coordinate.
--
-- The previous migration accepted only the literal 'exact', chosen deliberately before we
-- knew Plota's vocabulary. Twenty live records later, the observed values are `centroid`
-- (15) and `rooftop` (4) -- 'exact' does not appear at all, so keying on it alone would
-- permanently under-claim every precise coordinate we ever receive.
--
-- `rooftop` is standard geocoding terminology for a building-level fix, the most precise
-- tier a geocoder reports, and materially better than a centroid. It is treated as exact.
-- The list stays an explicit allowlist: an unrecognised or missing value still degrades to
-- source_centroid, so a new provider word can only ever cost us precision, never overstate it.

CREATE OR REPLACE FUNCTION public.planning_application_location_fallback()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.location IS NOT NULL THEN
    NEW.location_provenance := CASE
      WHEN lower(COALESCE(NEW.location_precision, '')) IN ('exact', 'rooftop') THEN 'source_exact'
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

-- `postcode` belongs in the promotion trigger's column list. Postgres decides UPDATE OF
-- from the columns named in the SET clause, not from what actually changed, so a BEFORE
-- trigger silently rewriting location/location_provenance during a postcode-only update
-- does not fire an AFTER trigger that omits `postcode`. Observed: a Development stayed at
-- 'missing' after its application had been resolved to a postcode centroid.
DROP TRIGGER IF EXISTS planning_application_ensure_development ON public.planning_applications;
CREATE TRIGGER planning_application_ensure_development
AFTER INSERT OR UPDATE OF
  intelligence_tier, stage, location, location_precision, location_provenance, postcode, last_seen_at
ON public.planning_applications
FOR EACH ROW EXECUTE FUNCTION public.ensure_development_for_planning_application();

-- Re-derive the rows already stored under the stricter rule. Only rows the old rule
-- demoted are touched; postcode-centroid and missing rows are matched on provenance so
-- they cannot be disturbed.
UPDATE public.planning_applications
SET location_provenance = 'source_exact'
WHERE location IS NOT NULL
  AND location_provenance = 'source_centroid'
  AND lower(COALESCE(location_precision, '')) IN ('exact', 'rooftop');

-- Developments inherit the best provenance among their applications. Ranking keeps this
-- an upgrade: a Development already at source_exact is never pulled back down.
UPDATE public.developments d
SET location_provenance = best.provenance,
    location = COALESCE(best.location, d.location),
    updated_at = now()
FROM (
  SELECT DISTINCT ON (da.development_id)
    da.development_id,
    a.location_provenance AS provenance,
    a.location            AS location
  FROM public.development_applications da
  JOIN public.planning_applications a ON a.id = da.planning_application_id
  ORDER BY da.development_id,
           public.location_provenance_rank(a.location_provenance) DESC,
           a.date_received DESC NULLS LAST
) AS best
WHERE best.development_id = d.id
  AND public.location_provenance_rank(best.provenance)
      > public.location_provenance_rank(d.location_provenance);
