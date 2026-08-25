-- Migration: same-brand distance (existing estate) — "Find Sites" M7.
--
-- M7 is DELIBERATELY DIFFERENT from M3–M6. Roads/traffic/land-use/geometry are
-- occupier-agnostic enrichment: computed ONCE per candidate site and stored, because
-- they do not depend on who is searching. Same-brand distance DOES depend on the
-- searching brand (a KFC brief cares about KFC's estate, a Costa brief about Costa's),
-- so baking it into the reusable dataset would be wrong — it is a SEARCH-TIME, per-brand
-- calculation against the live `stores` estate. Hence M7 adds NO candidate_site_* table;
-- it adds read-only RPCs the (future M9) search service calls per brand, plus a debug map.
--
-- "Same brand" = the PARENT-GROUP estate: distance to the nearest store of ANY fascia the
-- brand operates. The primary key is brand_id (an optional fascia filter is supported for
-- a narrower rollup). Distance is parcel-polygon → store-point in metres (geography).
--
-- The pure interpretation (bands, and the load-bearing "no estate → satisfied, never
-- unknown" rule) lives in apps/web/src/lib/site-matching/brand-distance.ts (Jest-tested),
-- NOT in SQL. Existing-estate distance is one of the few criteria with NO unknown state:
-- a store's location is precisely known, so the answer is either a real distance or
-- "the brand has no estate" (trivially satisfied — nothing to cannibalise).

-- =============================================================================
-- nearest_same_brand_store() — SEARCH-TIME per-site nearest same-brand store.
--
-- For each requested candidate site, returns the nearest store of the given brand
-- (optionally narrowed to a fascia set) and that store's distance in metres, plus the
-- brand's total store count (constant across rows) so the caller can decide
-- brandHasStores. Computed UNCAPPED by default (p_max_dist_m NULL) so a real nearest
-- distance is always available for the >= N-mile test; pass p_max_dist_m to bound the
-- search for performance (sites with no store within the cap come back with NULL
-- distance — the pure layer reads that as "clear of the estate", never zero).
--
-- Read-only. SECURITY DEFINER so it can read `stores` regardless of caller RLS.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.nearest_same_brand_store(
  p_site_ids    uuid[],
  p_brand_id    uuid,
  p_fascia_ids  uuid[]           DEFAULT NULL,
  p_max_dist_m  double precision DEFAULT NULL
)
RETURNS TABLE (
  site_id            uuid,
  nearest_store_id   uuid,
  nearest_store_ref  text,
  nearest_fascia_id  uuid,
  nearest_store_name text,
  nearest_store_town text,
  distance_m         double precision,
  brand_store_count  bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH cnt AS (
    -- The brand's total estate size (after any fascia filter) — constant across sites.
    SELECT count(*)::bigint AS n
    FROM public.stores s
    WHERE s.brand_id = p_brand_id
      AND (p_fascia_ids IS NULL OR s.fascia_id = ANY(p_fascia_ids))
  )
  SELECT
    cs.id AS site_id,
    ns.id AS nearest_store_id,
    ns.store_id AS nearest_store_ref,
    ns.fascia_id AS nearest_fascia_id,
    ns.name AS nearest_store_name,
    ns.town AS nearest_store_town,
    ns.dist_m AS distance_m,
    (SELECT n FROM cnt) AS brand_store_count
  FROM public.candidate_sites cs
  LEFT JOIN LATERAL (
    SELECT s.id, s.store_id, s.fascia_id, s.name, s.town,
           ST_Distance(cs.geom::geography, s.location) AS dist_m
    FROM public.stores s
    WHERE s.brand_id = p_brand_id
      AND (p_fascia_ids IS NULL OR s.fascia_id = ANY(p_fascia_ids))
      AND (p_max_dist_m IS NULL OR ST_DWithin(cs.geom::geography, s.location, p_max_dist_m))
    ORDER BY cs.geom <-> s.location::geometry
    LIMIT 1
  ) ns ON true
  WHERE cs.id = ANY(p_site_ids);
$$;

REVOKE EXECUTE ON FUNCTION public.nearest_same_brand_store(uuid[], uuid, uuid[], double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nearest_same_brand_store(uuid[], uuid, uuid[], double precision) TO service_role, authenticated;

COMMENT ON FUNCTION public.nearest_same_brand_store(uuid[], uuid, uuid[], double precision) IS
  'M7 (Find Sites): search-time nearest same-brand (parent-group) store per candidate site, with the brand''s total estate size. Read-only; uncapped by default. Feeds the same_brand_distance criterion via brand-distance.ts.';

-- =============================================================================
-- brand_estate_summary() — one-shot brand-level facts for a run header: total estate
-- size and how many of those stores fall in a bbox (e.g. the Canterbury pipeline bbox),
-- so the M7 inspection can state whether the chosen brand is actually present locally.
-- Read-only.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.brand_estate_summary(
  p_brand_id   uuid,
  p_fascia_ids uuid[]           DEFAULT NULL,
  p_min_lon    double precision DEFAULT NULL,
  p_min_lat    double precision DEFAULT NULL,
  p_max_lon    double precision DEFAULT NULL,
  p_max_lat    double precision DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'brand_id', p_brand_id,
    'brand_name', (SELECT b.name FROM public.brands b WHERE b.id = p_brand_id),
    'store_count', count(*),
    'fascia_count', count(DISTINCT s.fascia_id),
    'store_count_in_bbox', count(*) FILTER (
      WHERE p_min_lon IS NOT NULL
        AND s.location && ST_MakeEnvelope(p_min_lon, p_min_lat, p_max_lon, p_max_lat, 4326)::geography
    )
  )
  FROM public.stores s
  WHERE s.brand_id = p_brand_id
    AND (p_fascia_ids IS NULL OR s.fascia_id = ANY(p_fascia_ids));
$$;

REVOKE EXECUTE ON FUNCTION public.brand_estate_summary(uuid, uuid[], double precision, double precision, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.brand_estate_summary(uuid, uuid[], double precision, double precision, double precision, double precision) TO service_role, authenticated;

COMMENT ON FUNCTION public.brand_estate_summary(uuid, uuid[], double precision, double precision, double precision, double precision) IS
  'M7 (Find Sites): brand-level estate facts (total stores, fascia count, stores within an optional bbox). Read-only.';

-- =============================================================================
-- debug_site_brand_map() — GeoJSON for the M7 debug map: sampled site polygons, a line
-- from each site to its nearest same-brand store, the nearest-store point, and the
-- surrounding same-brand estate within p_context_km. Lets a geographically varied sample
-- be eyeballed: is the "nearest existing store" the one a human would pick, and does the
-- distance look right? Read-only.
-- properties.layer in {'estate_store','nearest_link','nearest_store','site'}.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.debug_site_brand_map(
  p_site_ids   uuid[],
  p_brand_id   uuid,
  p_fascia_ids uuid[]           DEFAULT NULL,
  p_context_km double precision DEFAULT 10
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
WITH sites AS (
  SELECT cs.id, cs.geom, cs.source_reference, cs.area_acres, cs.current_land_use,
         ST_PointOnSurface(cs.geom) AS rep
  FROM public.candidate_sites cs
  WHERE cs.id = ANY(p_site_ids)
),
nearest AS (
  SELECT s.id AS site_id, s.rep, s.source_reference, s.area_acres, s.current_land_use,
         ns.store_id, ns.name, ns.town, ns.loc, ns.dist_m
  FROM sites s
  LEFT JOIN LATERAL (
    SELECT st.store_id, st.name, st.town, st.location::geometry AS loc,
           ST_Distance(s.geom::geography, st.location) AS dist_m
    FROM public.stores st
    WHERE st.brand_id = p_brand_id
      AND (p_fascia_ids IS NULL OR st.fascia_id = ANY(p_fascia_ids))
    ORDER BY s.geom <-> st.location::geometry
    LIMIT 1
  ) ns ON true
),
site_features AS (
  SELECT jsonb_build_object(
    'type','Feature',
    'geometry', ST_AsGeoJSON(s.geom, 6)::jsonb,
    'properties', jsonb_build_object(
      'layer','site', 'id', s.id, 'source_reference', s.source_reference,
      'area_acres', round(s.area_acres::numeric, 3),
      'current_land_use', s.current_land_use,
      'nearest_store', n.store_id, 'nearest_store_town', n.town,
      'distance_m', round(n.dist_m::numeric, 1)
    )
  ) AS f
  FROM sites s LEFT JOIN nearest n ON n.site_id = s.id
),
nearest_link_features AS (
  SELECT jsonb_build_object(
    'type','Feature',
    'geometry', ST_AsGeoJSON(ST_MakeLine(n.rep, n.loc), 6)::jsonb,
    'properties', jsonb_build_object(
      'layer','nearest_link', 'site_ref', n.source_reference,
      'store', n.store_id, 'distance_m', round(n.dist_m::numeric, 1)
    )
  ) AS f
  FROM nearest n WHERE n.loc IS NOT NULL
),
nearest_store_features AS (
  SELECT jsonb_build_object(
    'type','Feature',
    'geometry', ST_AsGeoJSON(n.loc, 6)::jsonb,
    'properties', jsonb_build_object(
      'layer','nearest_store', 'store', n.store_id, 'name', n.name, 'town', n.town,
      'site_ref', n.source_reference, 'distance_m', round(n.dist_m::numeric, 1)
    )
  ) AS f
  FROM nearest n WHERE n.loc IS NOT NULL
),
estate AS (  -- all same-brand stores near ANY sampled site (context)
  SELECT DISTINCT st.id, st.store_id, st.name, st.town, st.location::geometry AS loc
  FROM public.stores st
  WHERE st.brand_id = p_brand_id
    AND (p_fascia_ids IS NULL OR st.fascia_id = ANY(p_fascia_ids))
    AND EXISTS (
      SELECT 1 FROM sites s
      WHERE ST_DWithin(st.location, s.geom::geography, p_context_km * 1000)
    )
),
estate_features AS (
  SELECT jsonb_build_object(
    'type','Feature',
    'geometry', ST_AsGeoJSON(loc, 6)::jsonb,
    'properties', jsonb_build_object('layer','estate_store', 'store', store_id, 'name', name, 'town', town)
  ) AS f FROM estate
)
SELECT jsonb_build_object(
  'type','FeatureCollection',
  'features',
    coalesce((SELECT jsonb_agg(f) FROM estate_features), '[]'::jsonb) ||
    coalesce((SELECT jsonb_agg(f) FROM nearest_link_features), '[]'::jsonb) ||
    coalesce((SELECT jsonb_agg(f) FROM nearest_store_features), '[]'::jsonb) ||
    coalesce((SELECT jsonb_agg(f) FROM site_features), '[]'::jsonb)
)
$$;

REVOKE EXECUTE ON FUNCTION public.debug_site_brand_map(uuid[], uuid, uuid[], double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.debug_site_brand_map(uuid[], uuid, uuid[], double precision) TO service_role, authenticated;

COMMENT ON FUNCTION public.debug_site_brand_map(uuid[], uuid, uuid[], double precision) IS
  'M7 (Find Sites) debug map: GeoJSON of sampled sites, their nearest same-brand store + connecting line, and the surrounding same-brand estate. Read-only.';
