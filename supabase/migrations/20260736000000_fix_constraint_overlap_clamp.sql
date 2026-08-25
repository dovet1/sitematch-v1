-- Migration: clamp candidate_site_constraints.overlap_fraction to <= 1.0 (Find Sites M8 fix).
--
-- Found during the M8 run: 28 parcels that sit FULLY within a flood zone recorded an
-- overlap_fraction of 1 + up to ~2.3e-7 — pure floating-point noise, because the geodesic
-- intersection area ST_Area(ST_Union(intersection)::geography) equals the parcel's own
-- stored geodesic area_sqm (computed at M2) only to float precision. Functionally harmless
-- (all such rows band as 'within'), but it violates the stated "fraction in [0,1]" invariant
-- and the constraint-screening.ts contract. This redefines the write RPC to CLAMP the ratio
-- with LEAST(..., 1.0) so the invariant holds at write time on any dataset (a different area
-- method for another local authority could otherwise exceed 1 by more than float noise).
--
-- Only the final SELECT's overlap_fraction expression changes vs 20260735000000; everything
-- else is identical. Idempotent per site; re-run associate:candidate-constraints after apply.

CREATE OR REPLACE FUNCTION public.associate_candidate_site_constraints(
  p_site_ids             uuid[],
  p_min_overlap_fraction numeric DEFAULT 0.001,
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
  hits AS (
    SELECT s.id AS site_id, s.area_sqm,
           f.constraint_type, f.category, f.name, f.source_reference,
           ST_CollectionExtract(ST_Intersection(s.geom, f.geom), 3) AS inter_geom
    FROM sites s
    JOIN public.constraint_features f ON ST_Intersects(s.geom, f.geom)
  ),
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
           -- CLAMP: geodesic intersection area can float-exceed the stored parcel area by ~1e-7.
           CASE WHEN area_sqm > 0 THEN LEAST(union_sqm / area_sqm, 1.0) ELSE NULL END AS overlap_fraction
    FROM agg
    WHERE area_sqm > 0 AND union_sqm / area_sqm >= p_min_overlap_fraction
  )
  INSERT INTO public.candidate_site_constraints (
    candidate_site_id, constraint_type, category, overlap_fraction, overlap_area_sqm,
    feature_count, names, provenance
  )
  SELECT site_id, constraint_type, category, overlap_fraction, union_sqm, feature_count,
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

-- One-off clamp of the rows already written by the pre-fix RPC (so a re-run is not required).
UPDATE public.candidate_site_constraints SET overlap_fraction = 1.0 WHERE overlap_fraction > 1.0;
