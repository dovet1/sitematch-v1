-- Migration: constraint_features — the source-agnostic planning/environmental CONSTRAINT
-- polygon substrate for "Find Sites" M8 (constraints: EA Flood Zones + English Green Belt).
--
-- M8 is back to OCCUPIER-AGNOSTIC enrichment (like M3–M6): we intersect each candidate
-- site with authoritative constraint polygon layers and store WHICH constraints touch it
-- and over how much of its area. This table is the constraint analogue of road_links /
-- traffic_counts / land_use_features: source-agnostic raw polygons, each normalised to one
-- constraint TOKEN (flood_zone_2 / flood_zone_3 / green_belt / …) + a broad category, with
-- raw source tags retained. The candidate_site -> constraint association is a SEPARATE step
-- (20260735000000_associate_candidate_constraints.sql), so the interpretation can be
-- designed + unit-tested (apps/web/src/lib/site-matching/constraint-screening.ts) and
-- coverage measured honestly on the real Canterbury universe.
--
-- IMPORTANT (design guardrail): a constraint intersection is a SCREENING FLAG requiring
-- review — never a suitability, developability or planning-permission verdict. Severity
-- (exclude vs warn vs prefer) is an OCCUPIER decision applied at search time by the
-- engine's planning_constraints evaluator (criteria.ts), NOT baked in here. And these are
-- authoritative full-coverage national layers, so "no intersecting feature" is a real
-- negative ("not within the mapped zone"), but NOT a claim of "no flood risk / no nearby
-- designation".
--
-- Constraints are AREAS: only polygon/multipolygon features are stored (a point/line is not
-- a constraint extent and is skipped). Geometry is WGS84 (4326).
--
-- LICENCE / ATTRIBUTION (per source, recorded in each row's provenance so it travels):
--   * EA Flood Map for Planning (Flood Zones 2 & 3): © Environment Agency, Open Government Licence v3.
--   * English Green Belt: © Crown copyright / MHCLG (DLUHC), Open Government Licence v3.

-- =============================================================================
-- constraint_features — one row per source constraint polygon
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.constraint_features (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geom                 geometry(MultiPolygon, 4326) NOT NULL,  -- constraint EXTENT (areas only)
  constraint_type      text NOT NULL,                          -- normalised token: flood_zone_2 | flood_zone_3 | green_belt | ...
  category             text NOT NULL,                          -- broad group: 'flood' | 'green_belt' | 'other'
  name                 text,
  source               text NOT NULL,                          -- 'ea_flood_map' | 'green_belt' | ...
  source_reference     text,                                   -- source feature id / ref
  source_tags          jsonb NOT NULL DEFAULT '{}'::jsonb,     -- RETAINED raw attributes (the "why")
  source_geometry_srid integer,
  metadata             jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance           jsonb NOT NULL DEFAULT '{}'::jsonb,     -- {dataset, version, imported_at, licence}
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.constraint_features IS 'M8 constraint substrate: source-agnostic normalised constraint polygons (EA Flood Zones 2/3, English Green Belt, …), each with a constraint token + broad category + retained raw tags. Intersected with candidate sites in a separate step. A screening flag only — never a suitability/planning verdict.';
COMMENT ON COLUMN public.constraint_features.constraint_type IS 'Normalised constraint token (flood_zone_2/flood_zone_3/green_belt/...). Matched by the engine planning_constraints evaluator against the occupier''s exclusion/warning/preference lists. Never NULL — unmappable features are simply not imported.';
COMMENT ON COLUMN public.constraint_features.category IS 'Broad grouping for reporting/colouring: flood | green_belt | other. See constraint-screening.ts constraintCategory().';

CREATE INDEX IF NOT EXISTS idx_cf_geom ON public.constraint_features USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_cf_type ON public.constraint_features (constraint_type);
CREATE INDEX IF NOT EXISTS idx_cf_category ON public.constraint_features (category);
CREATE INDEX IF NOT EXISTS idx_cf_source ON public.constraint_features (source);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cf_source_ref
  ON public.constraint_features (source, constraint_type, source_reference) WHERE source_reference IS NOT NULL;

DROP TRIGGER IF EXISTS update_constraint_features_updated_at ON public.constraint_features;
CREATE TRIGGER update_constraint_features_updated_at
  BEFORE UPDATE ON public.constraint_features
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- RLS: public SELECT, admin manage; bulk writes via the service-role RPC below.
-- =============================================================================
ALTER TABLE public.constraint_features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view constraint features" ON public.constraint_features;
CREATE POLICY "Public can view constraint features" ON public.constraint_features FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage constraint features" ON public.constraint_features;
CREATE POLICY "Admins can manage constraint features" ON public.constraint_features
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'));

-- =============================================================================
-- import_constraint_features() — bulk upsert from GeoJSON features whose properties the
-- importer has ALREADY normalised (constraint_type + category computed in TS via
-- constraint-screening.ts, so the mapping is unit-tested). Polygons only; a feature with
-- no constraint_type is skipped. Upserts on (source, constraint_type, source_reference).
-- service_role only.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.import_constraint_features(
  p_features    jsonb,
  p_source      text,
  p_provenance  jsonb    DEFAULT '{}'::jsonb,
  p_source_srid integer  DEFAULT 4326
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  feat   jsonb;
  props  jsonb;
  g      geometry;
  gtype  text;
  v_type text;
  v_cat  text;
  v_ref  text;
  v_cnt  integer := 0;
BEGIN
  FOR feat IN SELECT * FROM jsonb_array_elements(coalesce(p_features, '[]'::jsonb))
  LOOP
    g := ST_MakeValid(ST_GeomFromGeoJSON(feat->'geometry'));
    CONTINUE WHEN g IS NULL OR ST_IsEmpty(g);
    g := ST_SetSRID(g, 4326);
    gtype := GeometryType(g);

    -- Constraints are AREAS. Keep only polygonal parts (CollectionExtract ,3), coerce to
    -- MultiPolygon; anything with no polygonal part is not a constraint extent → skip.
    IF gtype IN ('POLYGON','MULTIPOLYGON','GEOMETRYCOLLECTION') THEN
      g := ST_Multi(ST_CollectionExtract(g, 3));
    ELSE
      CONTINUE;  -- points / lines are not a constraint extent
    END IF;
    CONTINUE WHEN g IS NULL OR ST_IsEmpty(g);

    props  := coalesce(feat->'properties', '{}'::jsonb);
    v_type := nullif(props->>'constraint_type', '');
    CONTINUE WHEN v_type IS NULL;  -- unmappable → not stored (unknown stays out)
    v_cat  := coalesce(nullif(props->>'category', ''), 'other');
    v_ref  := nullif(props->>'source_reference', '');

    INSERT INTO public.constraint_features (
      geom, constraint_type, category, name,
      source, source_reference, source_tags, source_geometry_srid, metadata, provenance
    )
    VALUES (
      g, v_type, v_cat,
      nullif(props->>'name',''),
      p_source, v_ref,
      coalesce(props->'source_tags','{}'::jsonb),
      p_source_srid,
      coalesce(props->'metadata','{}'::jsonb),
      p_provenance
    )
    ON CONFLICT (source, constraint_type, source_reference) WHERE source_reference IS NOT NULL
    DO UPDATE SET
      geom = EXCLUDED.geom,
      category = EXCLUDED.category,
      name = EXCLUDED.name,
      source_tags = EXCLUDED.source_tags,
      source_geometry_srid = EXCLUDED.source_geometry_srid,
      metadata = EXCLUDED.metadata,
      provenance = EXCLUDED.provenance,
      updated_at = now();

    v_cnt := v_cnt + 1;
  END LOOP;
  RETURN v_cnt;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.import_constraint_features(jsonb, text, jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_constraint_features(jsonb, text, jsonb, integer) TO service_role;

COMMENT ON FUNCTION public.import_constraint_features(jsonb, text, jsonb, integer) IS 'M8: bulk upsert of pre-normalised constraint polygons from GeoJSON (WGS84). Polygons only; features with no constraint_type are skipped. service_role only.';
