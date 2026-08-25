-- Migration: land_use_features — the source-agnostic land-use EVIDENCE substrate for
-- "Find Sites" M5 (land use as evidence fusion).
--
-- M5 is the pivotal uncertainty: land use is 0% today, and no comprehensive OPEN UK
-- land-use classification exists (OS NGD is PSGA/commercial-gated). So instead of one
-- authoritative source we FUSE evidence from many: OSM (landuse/amenity/shop/building),
-- brownfield registers, the existing SiteMatcher estate (stores), and — if later added —
-- OS functional sites, UPRN, planning history. Each source feature is normalised to one
-- broad class + a SOURCE-level confidence (how firmly its tags imply that class) and
-- stored here with its raw tags retained, so the "why" behind any classification is
-- always inspectable and no evidence is ever discarded behind a score.
--
-- This table is the land-use analogue of road_links / traffic_counts: source-agnostic
-- raw features. The candidate_site -> land_use association + fusion is a SEPARATE step
-- (20260729000000_associate_candidate_land_use.sql), so the fusion rule can be designed,
-- unit-tested (apps/web/src/lib/site-matching/land-use-{classification,fusion}.ts) and
-- re-tuned WITHOUT re-importing, and coverage measured honestly on real Canterbury data.
--
-- Geometry is WGS84 (4326); features may be POLYGON/MULTIPOLYGON (a landuse area) or a
-- POINT (a shop, an amenity, a store). feature_kind records which so association can
-- treat them correctly (overlap fraction for polygons, inside/nearby for points).
--
-- LICENCE / ATTRIBUTION (per source, recorded in each row's provenance so it travels):
--   * OpenStreetMap: © OpenStreetMap contributors, ODbL 1.0 (share-alike).
--   * Brownfield registers: Open Government Licence v3 (local-authority published).
--   * SiteMatcher stores: internal.

-- =============================================================================
-- land_use_features — one row per source land-use feature (polygon or point)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.land_use_features (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geom                 geometry(Geometry, 4326) NOT NULL,   -- polygon OR point
  feature_kind         text NOT NULL,                       -- 'polygon' | 'point'
  normalised_class     text NOT NULL,                       -- SiteMatcher broad class (see land-use-classification.ts)
  class_confidence     text CHECK (class_confidence IN ('high','medium','low')), -- source->class confidence
  name                 text,
  source               text NOT NULL,                       -- 'osm' | 'brownfield_register' | 'sitematcher_stores' | ...
  source_reference     text,                                -- OSM id, register ref, store id, ...
  source_tags          jsonb NOT NULL DEFAULT '{}'::jsonb,  -- RETAINED raw tags behind the classification
  source_geometry_srid integer,
  metadata             jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance           jsonb NOT NULL DEFAULT '{}'::jsonb,  -- {dataset, version, imported_at, licence}
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.land_use_features IS 'M5 land-use evidence substrate: source-agnostic normalised land-use features (OSM/brownfield/stores/...), polygon or point, each with a broad class + source-level confidence + retained raw tags. Fused per candidate site in a separate step; never a suitability claim.';
COMMENT ON COLUMN public.land_use_features.normalised_class IS 'SiteMatcher broad class (residential/retail/food_drink/pub_bar/fuel/parking/commercial/industrial/storage_distribution/community/leisure_recreation/agricultural/natural/transport/utility/vacant_or_brownfield/construction). Never NULL here — unclassifiable source features are simply not imported.';
COMMENT ON COLUMN public.land_use_features.class_confidence IS 'How firmly the SOURCE tags imply the class (high=explicit landuse/amenity/shop; medium=typed building). NOT a spatial-coverage confidence — that is applied at fusion time.';

CREATE INDEX IF NOT EXISTS idx_luf_geom ON public.land_use_features USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_luf_source ON public.land_use_features (source);
CREATE INDEX IF NOT EXISTS idx_luf_class ON public.land_use_features (normalised_class);
CREATE INDEX IF NOT EXISTS idx_luf_kind ON public.land_use_features (feature_kind);
CREATE UNIQUE INDEX IF NOT EXISTS uq_luf_source_ref
  ON public.land_use_features (source, source_reference) WHERE source_reference IS NOT NULL;

DROP TRIGGER IF EXISTS update_land_use_features_updated_at ON public.land_use_features;
CREATE TRIGGER update_land_use_features_updated_at
  BEFORE UPDATE ON public.land_use_features
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- RLS: public SELECT, admin manage; bulk writes via the service-role RPCs below.
-- =============================================================================
ALTER TABLE public.land_use_features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view land use features" ON public.land_use_features;
CREATE POLICY "Public can view land use features" ON public.land_use_features FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage land use features" ON public.land_use_features;
CREATE POLICY "Admins can manage land use features" ON public.land_use_features
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'));

-- =============================================================================
-- import_land_use_features() — bulk upsert from GeoJSON features whose properties the
-- importer has ALREADY normalised (normalised_class + class_confidence computed in TS
-- via land-use-classification.ts, so the mapping is unit-tested). Geometry is WGS84.
-- Upserts on (source, source_reference). service_role only.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.import_land_use_features(
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
  v_kind text;
  v_ref  text;
  v_class text;
  v_cnt  integer := 0;
BEGIN
  FOR feat IN SELECT * FROM jsonb_array_elements(coalesce(p_features, '[]'::jsonb))
  LOOP
    g := ST_MakeValid(ST_GeomFromGeoJSON(feat->'geometry'));
    CONTINUE WHEN g IS NULL OR ST_IsEmpty(g);
    g := ST_SetSRID(g, 4326);
    gtype := GeometryType(g);

    -- Normalise to a single stored geometry + kind. Polygons/multipolygons keep area;
    -- points stay points; lines are not land-use evidence and are skipped.
    IF gtype IN ('POLYGON','MULTIPOLYGON') THEN
      g := ST_Multi(ST_CollectionExtract(g, 3));
      v_kind := 'polygon';
    ELSIF gtype = 'POINT' THEN
      v_kind := 'point';
    ELSIF gtype = 'MULTIPOINT' THEN
      g := ST_Centroid(g);
      v_kind := 'point';
    ELSE
      CONTINUE;  -- lines / collections: not land-use evidence
    END IF;
    CONTINUE WHEN g IS NULL OR ST_IsEmpty(g);

    props   := coalesce(feat->'properties', '{}'::jsonb);
    v_class := nullif(props->>'normalised_class', '');
    CONTINUE WHEN v_class IS NULL;  -- unclassifiable → not evidence (unknown stays unknown)
    v_ref   := nullif(props->>'source_reference', '');

    INSERT INTO public.land_use_features (
      geom, feature_kind, normalised_class, class_confidence, name,
      source, source_reference, source_tags, source_geometry_srid, metadata, provenance
    )
    VALUES (
      g, v_kind, v_class,
      nullif(props->>'class_confidence',''),
      nullif(props->>'name',''),
      p_source, v_ref,
      coalesce(props->'source_tags','{}'::jsonb),
      p_source_srid,
      coalesce(props->'metadata','{}'::jsonb),
      p_provenance
    )
    ON CONFLICT (source, source_reference) WHERE source_reference IS NOT NULL
    DO UPDATE SET
      geom = EXCLUDED.geom,
      feature_kind = EXCLUDED.feature_kind,
      normalised_class = EXCLUDED.normalised_class,
      class_confidence = EXCLUDED.class_confidence,
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

REVOKE EXECUTE ON FUNCTION public.import_land_use_features(jsonb, text, jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_land_use_features(jsonb, text, jsonb, integer) TO service_role;

COMMENT ON FUNCTION public.import_land_use_features(jsonb, text, jsonb, integer) IS 'M5: bulk upsert of pre-normalised land-use features (polygon or point) from GeoJSON (WGS84). Unclassifiable features (no normalised_class) are skipped. service_role only.';

-- =============================================================================
-- sync_store_land_use_features() — turn the LIVE SiteMatcher estate into land-use
-- evidence WITHOUT an export: every store becomes a point land_use_feature. A store is
-- firm evidence of actively-occupied commercial premises → broad class 'retail' at
-- MEDIUM confidence (the store's own brand category, food vs shop vs services, is a
-- refinement deliberately deferred — see the M5 findings). Idempotent per store.
-- service_role only.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.sync_store_land_use_features(
  p_provenance jsonb DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cnt integer := 0;
BEGIN
  INSERT INTO public.land_use_features (
    geom, feature_kind, normalised_class, class_confidence, name,
    source, source_reference, source_tags, source_geometry_srid, provenance
  )
  SELECT
    s.location::geometry, 'point', 'retail', 'medium', s.name,
    'sitematcher_stores', s.id::text,
    jsonb_strip_nulls(jsonb_build_object(
      'store_id', s.store_id, 'brand_id', s.brand_id, 'fascia_id', s.fascia_id,
      'town', s.town, 'postcode', s.postcode)),
    4326, p_provenance
  FROM public.stores s
  WHERE s.location IS NOT NULL
  ON CONFLICT (source, source_reference) WHERE source_reference IS NOT NULL
  DO UPDATE SET
    geom = EXCLUDED.geom,
    name = EXCLUDED.name,
    source_tags = EXCLUDED.source_tags,
    provenance = EXCLUDED.provenance,
    updated_at = now();

  GET DIAGNOSTICS v_cnt = ROW_COUNT;
  RETURN v_cnt;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_store_land_use_features(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_store_land_use_features(jsonb) TO service_role;

COMMENT ON FUNCTION public.sync_store_land_use_features(jsonb) IS 'M5: mirror live stores into land_use_features as point evidence (class=retail, medium). Idempotent per store. service_role only.';
