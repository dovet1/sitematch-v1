-- Migration: candidate_sites — the internal, source-agnostic candidate-site concept
-- for the "Find Sites" (occupier → site matching) MVP.
--
-- A candidate site is SiteMatcher's OWN normalised unit of land. It may originate
-- from an HMLR INSPIRE title polygon, an OS land-use polygon, a brownfield site, a
-- planning application, a manual draw, a merge/subdivision of others, etc. We keep
-- source + source_reference + provenance so we are NEVER permanently coupled to any
-- one dataset (e.g. HMLR). One explicit MVP finding is whether an HMLR title is even
-- a useful candidate unit — this schema lets us swap the generator without rework.
--
-- Geometry is WGS84 (4326). Derived metrics (area, centroid, cheap shape diagnostics)
-- are computed in PostGIS at import time via import_candidate_sites(), reprojecting to
-- British National Grid (27700) for metric measurements.

CREATE TABLE IF NOT EXISTS public.candidate_sites (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text,
  geom                 geometry(MultiPolygon, 4326) NOT NULL,
  centroid             geography(Point, 4326),
  area_sqm             numeric,
  area_acres           numeric,
  current_land_use     text,                 -- normalised broad category; NULL = unknown
  land_use_confidence  text CHECK (land_use_confidence IN ('high','medium','low')),
  land_use_evidence    jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{signal, value, source, ...}]
  -- Cheap shape diagnostics (metres). Preserved for inspection; NOT used in ranking (MVP).
  bbox_width_m         numeric,
  bbox_depth_m         numeric,
  perimeter_m          numeric,
  compactness          numeric,              -- Polsby–Popper 4*pi*area/perimeter^2, [0,1]
  min_rect_width_m     numeric,
  min_rect_depth_m     numeric,
  -- Provenance — so users can always answer "where did this polygon come from?"
  source               text NOT NULL,        -- e.g. 'hmlr_inspire', 'manual', 'os_land_use'
  source_reference     text,                 -- e.g. INSPIRE id / title number
  source_geometry_srid integer,              -- SRID of the original source geometry
  metadata             jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance           jsonb NOT NULL DEFAULT '{}'::jsonb, -- {dataset, version, imported_at, licence}
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.candidate_sites IS 'SiteMatcher''s internal candidate land/site polygons for occupier→site matching. Source-agnostic; never FK-couple to a source-specific table.';
COMMENT ON COLUMN public.candidate_sites.current_land_use IS 'Normalised broad category (pub, petrol_station, retail, residential, vacant, ...). NULL = unknown, which is distinct from a fail.';
COMMENT ON COLUMN public.candidate_sites.land_use_evidence IS 'Array of land-use signals with provenance behind the chosen classification (OS/OSM/store/planning/address).';

CREATE INDEX IF NOT EXISTS idx_candidate_sites_geom ON public.candidate_sites USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_candidate_sites_centroid ON public.candidate_sites USING GIST (centroid);
CREATE INDEX IF NOT EXISTS idx_candidate_sites_source ON public.candidate_sites (source);
CREATE INDEX IF NOT EXISTS idx_candidate_sites_land_use ON public.candidate_sites (current_land_use);
-- Idempotent import target (only where a source reference exists)
CREATE UNIQUE INDEX IF NOT EXISTS uq_candidate_sites_source_ref
  ON public.candidate_sites (source, source_reference) WHERE source_reference IS NOT NULL;

DROP TRIGGER IF EXISTS update_candidate_sites_updated_at ON public.candidate_sites;
CREATE TRIGGER update_candidate_sites_updated_at
  BEFORE UPDATE ON public.candidate_sites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- Row Level Security: public SELECT (workspace reads as authenticated after
-- computing tier), admin manage. Bulk writes go through the service-role RPC.
-- =============================================================================
ALTER TABLE public.candidate_sites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view candidate sites" ON public.candidate_sites;
CREATE POLICY "Public can view candidate sites" ON public.candidate_sites
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage candidate sites" ON public.candidate_sites;
CREATE POLICY "Admins can manage candidate sites" ON public.candidate_sites
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'));

-- =============================================================================
-- Bulk import RPC: accepts a GeoJSON FeatureCollection's `features` array (already
-- reprojected to WGS84 by the importer) and computes all derived metrics in PostGIS.
-- Upserts on (source, source_reference). service_role only.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.import_candidate_sites(
  p_features jsonb,
  p_source text,
  p_provenance jsonb DEFAULT '{}'::jsonb,
  p_source_srid integer DEFAULT 4326
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  feat            jsonb;
  g4326           geometry;
  g27700          geometry;
  oriented        geometry;
  v_source_ref    text;
  v_name          text;
  v_land_use      text;
  v_env           geometry;
  v_count         integer := 0;
BEGIN
  FOR feat IN SELECT * FROM jsonb_array_elements(coalesce(p_features, '[]'::jsonb))
  LOOP
    -- Parse + normalise geometry to MultiPolygon/4326.
    g4326 := ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_GeomFromGeoJSON(feat->'geometry')), 3));
    CONTINUE WHEN g4326 IS NULL OR ST_IsEmpty(g4326);
    g4326 := ST_SetSRID(g4326, 4326);
    g27700 := ST_Transform(g4326, 27700);
    v_env := ST_Envelope(g27700);

    v_source_ref := nullif(feat->'properties'->>'source_reference', '');
    v_name       := nullif(feat->'properties'->>'name', '');
    v_land_use   := nullif(feat->'properties'->>'current_land_use', '');

    -- Oriented (minimum-rotated) envelope for approx width/depth.
    oriented := ST_OrientedEnvelope(g27700);

    INSERT INTO public.candidate_sites (
      name, geom, centroid, area_sqm, area_acres,
      current_land_use, land_use_confidence, land_use_evidence,
      bbox_width_m, bbox_depth_m, perimeter_m, compactness,
      min_rect_width_m, min_rect_depth_m,
      source, source_reference, source_geometry_srid, metadata, provenance
    )
    VALUES (
      v_name,
      g4326,
      ST_Centroid(g4326)::geography,
      ST_Area(g4326::geography),
      ST_Area(g4326::geography) / 4046.8564224,
      v_land_use,
      nullif(feat->'properties'->>'land_use_confidence', ''),
      coalesce(feat->'properties'->'land_use_evidence', '[]'::jsonb),
      ST_XMax(v_env) - ST_XMin(v_env),
      ST_YMax(v_env) - ST_YMin(v_env),
      ST_Perimeter(g4326::geography),
      CASE WHEN ST_Perimeter(g4326::geography) > 0
        THEN (4 * pi() * ST_Area(g4326::geography)) / power(ST_Perimeter(g4326::geography), 2)
        ELSE NULL END,
      -- min rotated-rectangle side lengths from the oriented envelope's first two edges
      ST_DistanceSphere(ST_PointN(ST_ExteriorRing(ST_Transform(oriented,4326)),1), ST_PointN(ST_ExteriorRing(ST_Transform(oriented,4326)),2)),
      ST_DistanceSphere(ST_PointN(ST_ExteriorRing(ST_Transform(oriented,4326)),2), ST_PointN(ST_ExteriorRing(ST_Transform(oriented,4326)),3)),
      p_source,
      v_source_ref,
      p_source_srid,
      coalesce(feat->'properties'->'metadata', '{}'::jsonb),
      p_provenance
    )
    ON CONFLICT (source, source_reference) WHERE source_reference IS NOT NULL
    DO UPDATE SET
      name = EXCLUDED.name,
      geom = EXCLUDED.geom,
      centroid = EXCLUDED.centroid,
      area_sqm = EXCLUDED.area_sqm,
      area_acres = EXCLUDED.area_acres,
      current_land_use = EXCLUDED.current_land_use,
      land_use_confidence = EXCLUDED.land_use_confidence,
      land_use_evidence = EXCLUDED.land_use_evidence,
      bbox_width_m = EXCLUDED.bbox_width_m,
      bbox_depth_m = EXCLUDED.bbox_depth_m,
      perimeter_m = EXCLUDED.perimeter_m,
      compactness = EXCLUDED.compactness,
      min_rect_width_m = EXCLUDED.min_rect_width_m,
      min_rect_depth_m = EXCLUDED.min_rect_depth_m,
      source_geometry_srid = EXCLUDED.source_geometry_srid,
      metadata = EXCLUDED.metadata,
      provenance = EXCLUDED.provenance,
      updated_at = now();

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.import_candidate_sites(jsonb, text, jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_candidate_sites(jsonb, text, jsonb, integer) TO service_role;

COMMENT ON FUNCTION public.import_candidate_sites(jsonb, text, jsonb, integer) IS 'Bulk upsert of candidate sites from GeoJSON features (WGS84); computes area/centroid/shape diagnostics in PostGIS. service_role only.';
