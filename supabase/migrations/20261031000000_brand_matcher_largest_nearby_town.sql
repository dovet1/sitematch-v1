-- Brand Matcher demographics: a site or store just outside a town takes the LARGEST town within
-- 1km, not the nearest.
--
-- 20261030000000 took the nearest town within 1km, which often picked a village: a point just
-- outside Canterbury took Rough Common (529m) rather than Canterbury. Now every town whose
-- boundary is within reach is considered and the most populous wins (census population, as
-- bua_demographic_ranks holds it); distance only breaks ties. A point inside a town is unchanged:
-- the smallest town containing it.
--
-- After applying, re-place the stores (a couple of minutes; from the SQL editor, or in batches of
-- brands):
--   select rebuild_store_buas();

-- ---------------------------------------------------------------------------
-- The site's town
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.brand_matcher_site_bua(
  p_lat double precision,
  p_lon double precision,
  p_max_distance_m integer DEFAULT 2000
)
RETURNS TABLE (
  bua_gsscode text,
  bua_name    text,
  distance_m  double precision,
  signals     jsonb,
  ranks       jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH site AS (
    SELECT ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326) AS geom
  ),
  containing AS (
    SELECT g.gsscode, 0::double precision AS d
    FROM site
    JOIN public.built_up_area_geometries g ON ST_Covers(g.geom, site.geom)
    ORDER BY ST_Area(g.geom) ASC
    LIMIT 1
  ),
  nearby AS (
    -- A bounding-box shortlist in degrees (1km is under 0.02 degrees anywhere in England and
    -- Wales), then the true distance in metres.
    SELECT g.gsscode, ST_Distance(g.geom::geography, site.geom::geography) AS d
    FROM site, public.built_up_area_geometries g
    WHERE NOT EXISTS (SELECT 1 FROM containing)
      AND ST_DWithin(g.geom, site.geom, p_max_distance_m / 50000.0)
      AND ST_DWithin(g.geom::geography, site.geom::geography, p_max_distance_m)
  ),
  largest AS (
    SELECT n.gsscode, n.d
    FROM nearby n
    LEFT JOIN public.bua_demographic_ranks p ON p.bua_gsscode = n.gsscode AND p.signal_name = 'population'
    ORDER BY p.value DESC NULLS LAST, n.d
    LIMIT 1
  ),
  placed AS (
    SELECT * FROM containing
    UNION ALL
    SELECT * FROM largest
  )
  SELECT p.gsscode,
         b.name,
         p.d,
         (SELECT jsonb_object_agg(r.signal_name, r.value)
          FROM public.bua_demographic_ranks r WHERE r.bua_gsscode = p.gsscode),
         (SELECT jsonb_object_agg(r.signal_name, r.rank)
          FROM public.bua_demographic_ranks r WHERE r.bua_gsscode = p.gsscode)
  FROM placed p
  JOIN public.built_up_areas b ON b.gsscode = p.gsscode;
$$;

-- ---------------------------------------------------------------------------
-- Each store's town
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rebuild_store_buas(p_brand_ids uuid[] DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rows integer;
BEGIN
  DELETE FROM public.store_buas sb
  WHERE p_brand_ids IS NULL OR sb.brand_id = ANY(p_brand_ids);

  INSERT INTO public.store_buas (store_id, brand_id, bua_gsscode)
  SELECT s.id, s.brand_id, t.gsscode
  FROM public.stores s
  LEFT JOIN LATERAL (
    SELECT g.gsscode
    FROM public.built_up_area_geometries g
    WHERE ST_Covers(g.geom, s.location::geometry)
    ORDER BY ST_Area(g.geom) ASC
    LIMIT 1
  ) t ON true
  WHERE s.brand_id IS NOT NULL
    AND s.location IS NOT NULL
    AND (p_brand_ids IS NULL OR s.brand_id = ANY(p_brand_ids))
  ON CONFLICT (store_id) DO UPDATE
    SET brand_id = EXCLUDED.brand_id, bua_gsscode = EXCLUDED.bua_gsscode, computed_at = now();

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  -- Stores in no town: the most populous town within 1km, nearest on a tie.
  UPDATE public.store_buas sb
  SET bua_gsscode = n.gsscode, computed_at = now()
  FROM public.stores s
  CROSS JOIN LATERAL (
    SELECT g.gsscode
    FROM public.built_up_area_geometries g
    LEFT JOIN public.bua_demographic_ranks p ON p.bua_gsscode = g.gsscode AND p.signal_name = 'population'
    WHERE ST_DWithin(g.geom, s.location::geometry, 0.02)
      AND ST_DWithin(g.geom::geography, s.location, 1000)
    ORDER BY p.value DESC NULLS LAST, ST_Distance(g.geom::geography, s.location)
    LIMIT 1
  ) n
  WHERE sb.store_id = s.id
    AND sb.bua_gsscode IS NULL
    AND (p_brand_ids IS NULL OR sb.brand_id = ANY(p_brand_ids));

  RETURN v_rows;
END;
$$;
