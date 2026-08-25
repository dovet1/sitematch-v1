-- Migration: candidate_site -> constraint association for "Find Sites" M8.
--
-- M8 ENRICHMENT: intersect every candidate site in the reusable universe with the
-- authoritative constraint layers (constraint_features: EA Flood Zones 2/3, English Green
-- Belt) and record WHICH constraint types touch it and over how much of its area. This is
-- OCCUPIER-AGNOSTIC (like M3–M6): we record presence + overlap; whether a constraint
-- excludes / warns / is merely preferred-against is an OCCUPIER decision made at search
-- time by the engine's planning_constraints evaluator (criteria.ts) — never baked in here.
--
-- Aggregation: ONE row per (candidate_site, constraint_type). A flood zone arrives as many
-- small polygons, so we UNION every intersecting feature of a type and store the union's
-- area-fraction of the SITE. The pure, Jest-tested constraint-screening.ts then bands that
-- fraction and produces the constraint TOKEN list the engine consumes — keeping the
-- unknown≠zero / near-miss / no-verdict rules out of SQL where they cannot be tested.
--
-- Coverage is reported CLIENT-SIDE by inspect:candidate-constraints (paged pulls), NOT via
-- a coverage RPC: every prior enrichment coverage RPC (M5 land use, M6 geometry) re-scanned
-- the 74k candidate_sites table per sub-metric and hit the statement timeout, so M8 does
-- not add one. Only the write RPC + a debug-map RPC live here.

-- =============================================================================
-- candidate_site_constraints — one row per (candidate_site, constraint_type)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.candidate_site_constraints (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_site_id   uuid NOT NULL REFERENCES public.candidate_sites(id) ON DELETE CASCADE,
  constraint_type     text NOT NULL,         -- normalised token (flood_zone_2|flood_zone_3|green_belt|...)
  category            text NOT NULL,          -- denormalised broad group (flood|green_belt|other)
  overlap_fraction    numeric,                -- fraction (0-1) of the SITE covered by the UNION of this type
  overlap_area_sqm    numeric,                -- union intersection area (m^2)
  feature_count       integer,                -- how many source features of this type intersect the site
  names               jsonb NOT NULL DEFAULT '[]'::jsonb,  -- sample of source feature names/refs (the "why")
  provenance          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_site_id, constraint_type)
);

COMMENT ON TABLE public.candidate_site_constraints IS 'M8 enrichment: one row per (candidate_site, constraint_type) — the union overlap of an authoritative constraint layer (EA Flood Zones/Green Belt) with the parcel. Interpreted by constraint-screening.ts into the engine''s constraint tokens. A screening flag only, never a suitability/planning verdict.';
COMMENT ON COLUMN public.candidate_site_constraints.overlap_fraction IS 'Fraction (0-1) of the SITE polygon covered by the UNION of all this-type constraint features. Banded (none/marginal/partial/majority/within) by constraint-screening.ts; a sub-epsilon clip is a near-miss, not an intersecting constraint.';

CREATE INDEX IF NOT EXISTS idx_csc_site ON public.candidate_site_constraints (candidate_site_id);
CREATE INDEX IF NOT EXISTS idx_csc_type ON public.candidate_site_constraints (constraint_type);
CREATE INDEX IF NOT EXISTS idx_csc_category ON public.candidate_site_constraints (category);

DROP TRIGGER IF EXISTS update_candidate_site_constraints_updated_at ON public.candidate_site_constraints;
CREATE TRIGGER update_candidate_site_constraints_updated_at
  BEFORE UPDATE ON public.candidate_site_constraints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.candidate_site_constraints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view candidate site constraints" ON public.candidate_site_constraints;
CREATE POLICY "Public can view candidate site constraints" ON public.candidate_site_constraints FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage candidate site constraints" ON public.candidate_site_constraints;
CREATE POLICY "Admins can manage candidate site constraints" ON public.candidate_site_constraints
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'));

-- =============================================================================
-- associate_candidate_site_constraints() — compute + upsert constraint associations for a
-- batch of candidate sites. For each site x constraint_type, UNION the intersecting
-- constraint features and store the union's area-fraction of the site. Idempotent per site
-- (clears + recomputes against ALL constraint_features, so re-running after importing
-- another layer picks it up). Slivers below p_min_overlap_fraction (edge/point clips) are
-- dropped. service_role only.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.associate_candidate_site_constraints(
  p_site_ids             uuid[],
  p_min_overlap_fraction numeric DEFAULT 0.001,  -- drop trivial edge/point clips below this share of the site
  p_provenance           jsonb   DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  DELETE FROM public.candidate_site_constraints WHERE candidate_site_id = ANY(p_site_ids);

  WITH sites AS (
    SELECT id, geom, area_sqm FROM public.candidate_sites WHERE id = ANY(p_site_ids)
  ),
  -- Every constraint feature that intersects a site, with the intersection geometry.
  hits AS (
    SELECT s.id AS site_id, s.area_sqm,
           f.constraint_type, f.category, f.name, f.source_reference,
           -- keep only polygonal parts so an edge/point touch contributes 0 area + no geography error
           ST_CollectionExtract(ST_Intersection(s.geom, f.geom), 3) AS inter_geom
    FROM sites s
    JOIN public.constraint_features f ON ST_Intersects(s.geom, f.geom)
  ),
  -- UNION the per-type intersections so overlapping/adjacent flood polygons are not double-counted.
  agg AS (
    SELECT site_id, area_sqm, constraint_type,
           max(category) AS category,
           count(*)::int AS feature_count,
           ST_Area(ST_Union(inter_geom)::geography) AS union_sqm,
           coalesce(jsonb_agg(DISTINCT coalesce(name, source_reference))
                    FILTER (WHERE coalesce(name, source_reference) IS NOT NULL), '[]'::jsonb) AS names
    FROM hits
    WHERE inter_geom IS NOT NULL AND NOT ST_IsEmpty(inter_geom)
    GROUP BY site_id, area_sqm, constraint_type
  ),
  final AS (
    SELECT site_id, constraint_type, category, feature_count, union_sqm, names,
           CASE WHEN area_sqm > 0 THEN union_sqm / area_sqm ELSE NULL END AS overlap_fraction
    FROM agg
    WHERE area_sqm > 0 AND union_sqm / area_sqm >= p_min_overlap_fraction
  )
  INSERT INTO public.candidate_site_constraints (
    candidate_site_id, constraint_type, category, overlap_fraction, overlap_area_sqm,
    feature_count, names, provenance
  )
  SELECT site_id, constraint_type, category, overlap_fraction, union_sqm, feature_count,
         -- keep a small sample of source names (avoid unbounded arrays on huge flood layers)
         coalesce((SELECT jsonb_agg(v) FROM (SELECT value v FROM jsonb_array_elements(names) LIMIT 5) t), '[]'::jsonb),
         p_provenance
  FROM final
  ON CONFLICT (candidate_site_id, constraint_type) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.associate_candidate_site_constraints(uuid[], numeric, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.associate_candidate_site_constraints(uuid[], numeric, jsonb) TO service_role;

COMMENT ON FUNCTION public.associate_candidate_site_constraints(uuid[], numeric, jsonb) IS 'M8: intersect a batch of candidate sites with all constraint_features, one aggregated row per (site, constraint_type) with the union overlap-fraction of the site. Idempotent per site. service_role only.';

-- =============================================================================
-- debug_site_constraint_map() — GeoJSON FeatureCollection for the M8 debug map: site
-- polygons (with their associated constraint tokens) + the constraint polygons touching
-- them + surrounding context constraint polygons, so the overlaps can be eyeballed against
-- the actual EA/Green Belt extents. Read-only.
-- Features carry properties.layer in {'context_constraint','assoc_constraint','site'}.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.debug_site_constraint_map(
  p_site_ids uuid[],
  p_radius_m numeric DEFAULT 400
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
WITH sites AS (
  SELECT cs.id, cs.geom, cs.source_reference, cs.area_acres
  FROM public.candidate_sites cs WHERE cs.id = ANY(p_site_ids)
),
v AS (SELECT (p_radius_m / 111320.0) * 2.0 AS deg),
-- The constraint tokens associated to each sample site (for the site's own label).
site_tokens AS (
  SELECT r.candidate_site_id,
         jsonb_agg(jsonb_build_object(
           'constraint_type', r.constraint_type, 'category', r.category,
           'overlap_fraction', round(coalesce(r.overlap_fraction,0)::numeric, 3))
           ORDER BY r.constraint_type) AS tokens
  FROM public.candidate_site_constraints r
  JOIN sites s ON s.id = r.candidate_site_id
  GROUP BY r.candidate_site_id
),
site_features AS (
  SELECT jsonb_build_object(
    'type','Feature', 'geometry', ST_AsGeoJSON(s.geom, 6)::jsonb,
    'properties', jsonb_build_object(
      'layer','site', 'id', s.id, 'source_reference', s.source_reference,
      'area_acres', round(s.area_acres::numeric, 3),
      'constraints', coalesce(t.tokens, '[]'::jsonb))
  ) AS f FROM sites s LEFT JOIN site_tokens t ON t.candidate_site_id = s.id
),
-- Constraint polygons intersecting the sample sites (the associated evidence).
assoc AS (
  SELECT DISTINCT f.id, f.geom, f.constraint_type, f.category, f.name, f.source
  FROM public.constraint_features f
  JOIN sites s ON ST_Intersects(f.geom, s.geom)
),
assoc_features AS (
  SELECT jsonb_build_object(
    'type','Feature', 'geometry', ST_AsGeoJSON(geom, 6)::jsonb,
    'properties', jsonb_build_object(
      'layer','assoc_constraint', 'constraint_type', constraint_type,
      'category', category, 'name', name, 'source', source)
  ) AS f FROM assoc
),
-- Surrounding context constraint polygons (nearby but not necessarily intersecting).
context AS (
  SELECT DISTINCT f.id, f.geom, f.constraint_type, f.category, f.name, f.source
  FROM public.constraint_features f
  JOIN sites s ON ST_DWithin(f.geom, s.geom, (SELECT deg FROM v))
  WHERE ST_Distance(f.geom::geography, s.geom::geography) <= p_radius_m
    AND f.id NOT IN (SELECT id FROM assoc)
),
context_features AS (
  SELECT jsonb_build_object(
    'type','Feature', 'geometry', ST_AsGeoJSON(geom, 6)::jsonb,
    'properties', jsonb_build_object(
      'layer','context_constraint', 'constraint_type', constraint_type,
      'category', category, 'name', name, 'source', source)
  ) AS f FROM context
)
SELECT jsonb_build_object(
  'type','FeatureCollection',
  'features',
    coalesce((SELECT jsonb_agg(f) FROM context_features), '[]'::jsonb) ||
    coalesce((SELECT jsonb_agg(f) FROM assoc_features), '[]'::jsonb) ||
    coalesce((SELECT jsonb_agg(f) FROM site_features), '[]'::jsonb)
)
$$;

REVOKE EXECUTE ON FUNCTION public.debug_site_constraint_map(uuid[], numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.debug_site_constraint_map(uuid[], numeric) TO service_role, authenticated;

COMMENT ON FUNCTION public.debug_site_constraint_map(uuid[], numeric) IS 'M8 debug map: GeoJSON of site polygons (with associated constraint tokens) + intersecting constraint polygons + nearby context constraint polygons. Read-only.';
