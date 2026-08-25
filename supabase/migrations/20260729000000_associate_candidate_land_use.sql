-- Migration: candidate_site -> land-use association + fusion for "Find Sites" M5.
--
-- M5 ENRICHMENT: attach every land-use EVIDENCE feature (land_use_features: OSM areas,
-- shop/amenity points, brownfield polygons, store points) that spatially relates to a
-- candidate site, then FUSE that evidence into the site's normalised class + confidence.
-- OCCUPIER-AGNOSTIC: we classify; we never exclude. Whether a class is acceptable is a
-- search-time decision (criteria.ts `land_use`), not made here.
--
-- Two-step by design (so each half is independently inspectable + re-runnable):
--   1. associate_candidate_site_land_use()  — the SPATIAL join (must be PostGIS): for
--      each site, every related feature with HOW it relates + how much of the site it
--      covers. Polygons: overlap fraction of the SITE (a landuse polygon covering the
--      whole parcel is strong; a sliver is weak). Points: inside the parcel, or nearby.
--   2. fusion — a PURE, unit-tested reduction (apps/web/src/lib/site-matching/
--      land-use-fusion.ts) run by the associate script, which writes the result back via
--      apply_candidate_land_use_fusion(). Keeping fusion in TS (not SQL) means the
--      heuristic that decides class/confidence/mixed/unknown is Jest-tested and tunable
--      WITHOUT a migration. `unknown` stays `unknown`; weak evidence never forces a class.

-- =============================================================================
-- candidate_site_land_use — one row per (candidate_site, land_use_feature, relation)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.candidate_site_land_use (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_site_id   uuid NOT NULL REFERENCES public.candidate_sites(id) ON DELETE CASCADE,
  land_use_feature_id uuid NOT NULL REFERENCES public.land_use_features(id) ON DELETE CASCADE,
  source              text NOT NULL,        -- denormalised land_use_features.source
  normalised_class    text NOT NULL,        -- denormalised land_use_features.normalised_class
  class_confidence    text,                 -- denormalised source->class confidence (high|medium|low)
  feature_kind        text,                 -- 'polygon' | 'point'
  relation            text NOT NULL,        -- 'covers' | 'overlaps' | 'point_inside' | 'nearby'
  overlap_fraction    numeric,              -- fraction of the SITE area covered (polygons); NULL for points
  overlap_area_sqm    numeric,              -- intersection area (polygons)
  distance_m          numeric,              -- 0 if intersecting; else site-edge->point metres (nearby)
  name                text,
  source_reference    text,
  source_tags         jsonb NOT NULL DEFAULT '{}'::jsonb,   -- retained raw tags (the "why")
  provenance          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_site_id, land_use_feature_id, relation)
);

COMMENT ON TABLE public.candidate_site_land_use IS 'M5 enrichment: candidate_site -> land_use_feature spatial associations (covers/overlaps/point_inside/nearby) with retained evidence. Fused into candidate_sites.current_land_use by the associate script. Occupier-agnostic; never a suitability claim.';
COMMENT ON COLUMN public.candidate_site_land_use.overlap_fraction IS 'Fraction (0-1) of the SITE polygon covered by this land-use polygon. Drives fusion relevance so a sliver overlap counts little and full cover counts fully.';
COMMENT ON COLUMN public.candidate_site_land_use.relation IS 'covers = polygon overlaps >=50% of the site; overlaps = intersects less; point_inside = point within the site; nearby = point within the nearby radius but outside.';

CREATE INDEX IF NOT EXISTS idx_cslu_site ON public.candidate_site_land_use (candidate_site_id);
CREATE INDEX IF NOT EXISTS idx_cslu_feature ON public.candidate_site_land_use (land_use_feature_id);
CREATE INDEX IF NOT EXISTS idx_cslu_source ON public.candidate_site_land_use (source);
CREATE INDEX IF NOT EXISTS idx_cslu_class ON public.candidate_site_land_use (normalised_class);

DROP TRIGGER IF EXISTS update_candidate_site_land_use_updated_at ON public.candidate_site_land_use;
CREATE TRIGGER update_candidate_site_land_use_updated_at
  BEFORE UPDATE ON public.candidate_site_land_use
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.candidate_site_land_use ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view candidate site land use" ON public.candidate_site_land_use;
CREATE POLICY "Public can view candidate site land use" ON public.candidate_site_land_use FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage candidate site land use" ON public.candidate_site_land_use;
CREATE POLICY "Admins can manage candidate site land use" ON public.candidate_site_land_use
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'));

-- =============================================================================
-- associate_candidate_site_land_use() — compute + upsert land-use associations for a
-- batch of candidate sites. Idempotent per site (clears + recomputes against ALL
-- land_use_features, so re-running after importing another source picks it up).
-- service_role only.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.associate_candidate_site_land_use(
  p_site_ids           uuid[],
  p_nearby_point_m     numeric DEFAULT 25,    -- points outside the parcel but within this are weak 'nearby' context
  p_min_overlap_fraction numeric DEFAULT 0.02, -- drop trivial polygon slivers below this share of the site
  p_provenance         jsonb   DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deg   numeric := (p_nearby_point_m / 111320.0) * 2.0;  -- planar-degree prefilter for nearby points
  v_count integer := 0;
BEGIN
  DELETE FROM public.candidate_site_land_use WHERE candidate_site_id = ANY(p_site_ids);

  WITH sites AS (
    SELECT id, geom, area_sqm FROM public.candidate_sites WHERE id = ANY(p_site_ids)
  ),
  -- POLYGON evidence: intersecting land-use areas, weighted by how much of the SITE they cover.
  poly AS (
    SELECT s.id AS site_id, f.id AS feature_id, f.source, f.normalised_class,
           f.class_confidence, f.feature_kind, f.name, f.source_reference, f.source_tags,
           -- CollectionExtract(...,3) keeps only polygonal parts, so an edge/point-touch
           -- intersection (line/point, or a mixed GEOMETRYCOLLECTION) contributes 0 area
           -- and never errors on the geography cast.
           ST_Area(ST_CollectionExtract(ST_Intersection(s.geom, f.geom), 3)::geography) AS inter_sqm,
           s.area_sqm
    FROM sites s
    JOIN public.land_use_features f
      ON f.feature_kind = 'polygon' AND ST_Intersects(s.geom, f.geom)
  ),
  poly_rows AS (
    SELECT site_id, feature_id, source, normalised_class, class_confidence, feature_kind,
           name, source_reference, source_tags,
           inter_sqm AS overlap_area_sqm,
           CASE WHEN area_sqm > 0 THEN inter_sqm / area_sqm ELSE NULL END AS overlap_fraction,
           0::numeric AS distance_m
    FROM poly
    WHERE area_sqm > 0 AND (inter_sqm / area_sqm) >= p_min_overlap_fraction
  ),
  poly_final AS (
    SELECT site_id, feature_id, source, normalised_class, class_confidence, feature_kind,
           name, source_reference, source_tags, overlap_area_sqm, overlap_fraction, distance_m,
           CASE WHEN overlap_fraction >= 0.5 THEN 'covers' ELSE 'overlaps' END AS relation
    FROM poly_rows
  ),
  -- POINT evidence: inside the parcel (strong) or nearby (weak context).
  pts AS (
    SELECT s.id AS site_id, f.id AS feature_id, f.source, f.normalised_class,
           f.class_confidence, f.feature_kind, f.name, f.source_reference, f.source_tags,
           ST_Contains(s.geom, f.geom) AS inside,
           ST_Distance(s.geom::geography, f.geom::geography) AS dist_m
    FROM sites s
    JOIN public.land_use_features f
      ON f.feature_kind = 'point'
     AND (ST_Contains(s.geom, f.geom) OR ST_DWithin(f.geom, s.geom, v_deg))
  ),
  pts_final AS (
    SELECT site_id, feature_id, source, normalised_class, class_confidence, feature_kind,
           name, source_reference, source_tags,
           NULL::numeric AS overlap_area_sqm, NULL::numeric AS overlap_fraction,
           CASE WHEN inside THEN 0 ELSE dist_m END AS distance_m,
           CASE WHEN inside THEN 'point_inside' ELSE 'nearby' END AS relation
    FROM pts
    WHERE inside OR dist_m <= p_nearby_point_m
  ),
  unioned AS (
    SELECT * FROM poly_final
    UNION ALL
    SELECT site_id, feature_id, source, normalised_class, class_confidence, feature_kind,
           name, source_reference, source_tags, overlap_area_sqm, overlap_fraction, distance_m, relation
    FROM pts_final
  )
  INSERT INTO public.candidate_site_land_use (
    candidate_site_id, land_use_feature_id, source, normalised_class, class_confidence,
    feature_kind, relation, overlap_fraction, overlap_area_sqm, distance_m, name,
    source_reference, source_tags, provenance
  )
  SELECT site_id, feature_id, source, normalised_class, class_confidence,
         feature_kind, relation, overlap_fraction, overlap_area_sqm, distance_m, name,
         source_reference, source_tags, p_provenance
  FROM unioned
  ON CONFLICT (candidate_site_id, land_use_feature_id, relation) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.associate_candidate_site_land_use(uuid[], numeric, numeric, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.associate_candidate_site_land_use(uuid[], numeric, numeric, jsonb) TO service_role;

COMMENT ON FUNCTION public.associate_candidate_site_land_use(uuid[], numeric, numeric, jsonb) IS 'M5: attach land-use evidence features to a batch of candidate sites (polygon overlap + point inside/nearby). Idempotent per site; recomputes against all land_use_features. service_role only.';

-- =============================================================================
-- apply_candidate_land_use_fusion() — write the TS fusion result back onto
-- candidate_sites. Takes an array of {site_id, current_land_use, land_use_confidence,
-- land_use_evidence}. NULL current_land_use is a valid result (unknown stays unknown).
-- service_role only.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.apply_candidate_land_use_fusion(
  p_updates jsonb   -- [{site_id, current_land_use, land_use_confidence, land_use_evidence}]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  u      jsonb;
  v_cnt  integer := 0;
BEGIN
  FOR u IN SELECT * FROM jsonb_array_elements(coalesce(p_updates, '[]'::jsonb))
  LOOP
    UPDATE public.candidate_sites SET
      current_land_use    = nullif(u->>'current_land_use',''),
      land_use_confidence = nullif(u->>'land_use_confidence',''),
      land_use_evidence   = coalesce(u->'land_use_evidence', '[]'::jsonb),
      updated_at          = now()
    WHERE id = (u->>'site_id')::uuid;
    IF FOUND THEN v_cnt := v_cnt + 1; END IF;
  END LOOP;
  RETURN v_cnt;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_candidate_land_use_fusion(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_candidate_land_use_fusion(jsonb) TO service_role;

COMMENT ON FUNCTION public.apply_candidate_land_use_fusion(jsonb) IS 'M5: write fused land-use class/confidence/evidence (computed by the pure TS fusion) back onto candidate_sites. NULL class = unknown, a valid result. service_role only.';

-- =============================================================================
-- candidate_land_use_coverage() — authoritative M5 gate numbers for a candidate-site
-- band: how much of the universe carries ANY land-use signal, how much is confidently
-- classified, how much stays unknown, the class + confidence distribution, per-source
-- contribution, and source AGREEMENT vs conflict (does OSM agree with the estate?).
-- Read-only. Called once per band (universe + drive-thru subset), reported SEPARATELY.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.candidate_land_use_coverage(
  p_min_acres   numeric DEFAULT 0.3,
  p_max_acres   numeric DEFAULT NULL,
  p_site_source text    DEFAULT 'hmlr_inspire'
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
WITH universe AS (
  SELECT cs.id, cs.current_land_use, cs.land_use_confidence
  FROM public.candidate_sites cs
  WHERE cs.source = p_site_source
    AND cs.area_acres >= p_min_acres
    AND (p_max_acres IS NULL OR cs.area_acres < p_max_acres)
),
ev AS (
  SELECT r.candidate_site_id, r.source, r.normalised_class
  FROM public.candidate_site_land_use r
  JOIN universe u ON u.id = r.candidate_site_id
),
sites_with_ev AS (SELECT DISTINCT candidate_site_id FROM ev),
-- Per site: distinct evidence sources + distinct HIGH/MEDIUM evidence classes (for agreement).
site_sources AS (
  SELECT candidate_site_id, count(DISTINCT source) AS n_sources
  FROM ev GROUP BY candidate_site_id
),
site_strong_classes AS (
  SELECT r.candidate_site_id, count(DISTINCT r.normalised_class) AS n_classes
  FROM public.candidate_site_land_use r
  JOIN universe u ON u.id = r.candidate_site_id
  WHERE r.class_confidence IN ('high','medium')
    AND r.relation IN ('covers','point_inside')
  GROUP BY r.candidate_site_id
)
SELECT jsonb_build_object(
  'site_source', p_site_source,
  'min_acres', p_min_acres,
  'max_acres', p_max_acres,
  'universe', (SELECT count(*) FROM universe),
  -- Coverage funnel (the honest M5 numbers).
  'with_any_evidence', (SELECT count(*) FROM sites_with_ev),
  'classified', (SELECT count(*) FROM universe WHERE current_land_use IS NOT NULL),
  'unknown', (SELECT count(*) FROM universe WHERE current_land_use IS NULL),
  'confidence_counts', (
    SELECT coalesce(jsonb_object_agg(coalesce(land_use_confidence,'(null)'), c), '{}'::jsonb)
    FROM (SELECT land_use_confidence, count(*) c FROM universe WHERE current_land_use IS NOT NULL GROUP BY land_use_confidence) t
  ),
  'class_distribution', (
    SELECT coalesce(jsonb_object_agg(current_land_use, c), '{}'::jsonb)
    FROM (SELECT current_land_use, count(*) c FROM universe WHERE current_land_use IS NOT NULL GROUP BY current_land_use) t
  ),
  -- Which sources actually contributed, and to how many sites.
  'source_contribution', (
    SELECT coalesce(jsonb_object_agg(source, c), '{}'::jsonb)
    FROM (SELECT source, count(DISTINCT candidate_site_id) c FROM ev GROUP BY source) t
  ),
  'evidence_rows', (SELECT count(*) FROM ev),
  -- Multi-source agreement: of sites with >=2 evidence sources, how many have a single
  -- strong class (agree) vs multiple strong classes (conflict → fused as 'mixed').
  'multi_source_sites', (SELECT count(*) FROM site_sources WHERE n_sources >= 2),
  'multi_source_agree', (
    SELECT count(*) FROM site_sources ss
    JOIN site_strong_classes sc ON sc.candidate_site_id = ss.candidate_site_id
    WHERE ss.n_sources >= 2 AND sc.n_classes = 1
  ),
  'multi_source_conflict', (
    SELECT count(*) FROM site_sources ss
    JOIN site_strong_classes sc ON sc.candidate_site_id = ss.candidate_site_id
    WHERE ss.n_sources >= 2 AND sc.n_classes >= 2
  )
)
$$;

REVOKE EXECUTE ON FUNCTION public.candidate_land_use_coverage(numeric, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.candidate_land_use_coverage(numeric, numeric, text) TO service_role, authenticated;

COMMENT ON FUNCTION public.candidate_land_use_coverage(numeric, numeric, text) IS 'M5 reporting: authoritative land-use coverage (any signal / classified / unknown), class + confidence distribution, per-source contribution + multi-source agreement, for a candidate-site band. Read-only.';

-- =============================================================================
-- debug_site_land_use_map() — GeoJSON FeatureCollection for the M5 debug map: site
-- polygons (with their FUSED class/confidence) + the land-use features associated to
-- them + surrounding context land-use polygons, so the classification can be eyeballed
-- against what is visibly on the ground. Read-only.
-- Features carry properties.layer in {'context_land_use','assoc_land_use','site'}.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.debug_site_land_use_map(
  p_site_ids uuid[],
  p_radius_m numeric DEFAULT 150
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
WITH sites AS (
  SELECT cs.id, cs.geom, cs.source_reference, cs.area_acres,
         cs.current_land_use, cs.land_use_confidence
  FROM public.candidate_sites cs WHERE cs.id = ANY(p_site_ids)
),
v AS (SELECT (p_radius_m / 111320.0) * 2.0 AS deg),
site_features AS (
  SELECT jsonb_build_object(
    'type','Feature', 'geometry', ST_AsGeoJSON(geom, 6)::jsonb,
    'properties', jsonb_build_object(
      'layer','site', 'id', id, 'source_reference', source_reference,
      'area_acres', round(area_acres::numeric, 3),
      'current_land_use', current_land_use, 'land_use_confidence', land_use_confidence)
  ) AS f FROM sites
),
-- Features associated to the sample sites (the evidence behind the fused class).
assoc AS (
  SELECT DISTINCT f.id, f.geom, r.normalised_class, r.class_confidence, r.relation,
         r.overlap_fraction, r.distance_m, r.source, f.name, r.source_tags
  FROM public.candidate_site_land_use r
  JOIN sites s ON s.id = r.candidate_site_id
  JOIN public.land_use_features f ON f.id = r.land_use_feature_id
),
assoc_features AS (
  SELECT jsonb_build_object(
    'type','Feature', 'geometry', ST_AsGeoJSON(geom, 6)::jsonb,
    'properties', jsonb_build_object(
      'layer','assoc_land_use', 'normalised_class', normalised_class,
      'class_confidence', class_confidence, 'relation', relation,
      'overlap_fraction', round(coalesce(overlap_fraction,0)::numeric, 3),
      'distance_m', round(coalesce(distance_m,0)::numeric, 1),
      'source', source, 'name', name, 'tags', source_tags)
  ) AS f FROM assoc
),
-- Surrounding context land-use polygons (not necessarily associated), to judge fit.
context AS (
  SELECT DISTINCT f.geom, f.normalised_class, f.class_confidence, f.source, f.name
  FROM public.land_use_features f
  JOIN sites s ON f.feature_kind = 'polygon' AND ST_DWithin(f.geom, s.geom, (SELECT deg FROM v))
  WHERE ST_Distance(f.geom::geography, s.geom::geography) <= p_radius_m
),
context_features AS (
  SELECT jsonb_build_object(
    'type','Feature', 'geometry', ST_AsGeoJSON(geom, 6)::jsonb,
    'properties', jsonb_build_object(
      'layer','context_land_use', 'normalised_class', normalised_class,
      'class_confidence', class_confidence, 'source', source, 'name', name)
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

REVOKE EXECUTE ON FUNCTION public.debug_site_land_use_map(uuid[], numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.debug_site_land_use_map(uuid[], numeric) TO service_role, authenticated;

COMMENT ON FUNCTION public.debug_site_land_use_map(uuid[], numeric) IS 'M5 debug map: GeoJSON of site polygons (with fused class) + associated land-use evidence + surrounding context land-use polygons. Read-only.';
