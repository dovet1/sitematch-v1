-- Migration: fix same-brand distance RPC performance — "Find Sites" M7 (follow-up).
--
-- The first cut of nearest_same_brand_store() / debug_site_brand_map() filtered the
-- brand's stores INSIDE the per-site LATERAL. With no cheap way to reuse that filter,
-- Postgres re-scanned the (large, national) `stores` table once PER candidate site —
-- e.g. 500 sites × a full stores scan — and hit the statement timeout (McDonald's:
-- 1,497 stores nationally, ~8,226 sites).
--
-- Fix: materialize the brand's estate ONCE per call (WITH … AS MATERIALIZED), then KNN
-- each site against that small in-memory set. The big table is scanned a single time;
-- per site we only sort ~a few thousand brand points (planar `<->`) and compute one
-- exact geography distance for the winner. Behaviour is otherwise identical.
--
-- Idempotent CREATE OR REPLACE — same signatures, so grants/comments carry over.

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
  WITH brand_stores AS MATERIALIZED (
    -- Scan the national stores table ONCE for this brand's estate (after any fascia
    -- filter). Everything below joins against this small set, never the big table.
    SELECT s.id, s.store_id, s.fascia_id, s.name, s.town, s.location
    FROM public.stores s
    WHERE s.brand_id = p_brand_id
      AND (p_fascia_ids IS NULL OR s.fascia_id = ANY(p_fascia_ids))
  ),
  cnt AS (SELECT count(*)::bigint AS n FROM brand_stores)
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
    SELECT bs.id, bs.store_id, bs.fascia_id, bs.name, bs.town,
           ST_Distance(cs.geom::geography, bs.location) AS dist_m
    FROM brand_stores bs
    WHERE p_max_dist_m IS NULL OR ST_DWithin(cs.geom::geography, bs.location, p_max_dist_m)
    ORDER BY cs.geom <-> bs.location::geometry
    LIMIT 1
  ) ns ON true
  WHERE cs.id = ANY(p_site_ids);
$$;

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
WITH brand_stores AS MATERIALIZED (
  SELECT st.id, st.store_id, st.name, st.town, st.location
  FROM public.stores st
  WHERE st.brand_id = p_brand_id
    AND (p_fascia_ids IS NULL OR st.fascia_id = ANY(p_fascia_ids))
),
sites AS (
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
    SELECT bs.store_id, bs.name, bs.town, bs.location::geometry AS loc,
           ST_Distance(s.geom::geography, bs.location) AS dist_m
    FROM brand_stores bs
    ORDER BY s.geom <-> bs.location::geometry
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
estate AS (  -- same-brand stores near ANY sampled site (context), from the materialized set
  SELECT DISTINCT bs.id, bs.store_id, bs.name, bs.town, bs.location::geometry AS loc
  FROM brand_stores bs
  WHERE EXISTS (
    SELECT 1 FROM sites s
    WHERE ST_DWithin(bs.location, s.geom::geography, p_context_km * 1000)
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
