-- Brand Matcher demographics: a site or store just outside a town takes the nearest town within 1km.
--
-- 20261029000000 placed a store only in a town that contains it, and the site lookup
-- (brand_matcher_site_bua) reached 2km for the site. Both now use the same rule: the smallest town
-- containing the point, else the nearest town whose boundary is within 1km, else none. About
-- 3,500 stores sat in no town before; about 1,400 of them (retail parks and roadside sites on a
-- town's edge) are within 1km of one.
--
-- After applying, re-place the stores from the SQL editor (one call, a couple of minutes):
--   select rebuild_store_buas();

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

  -- Stores in no town: the nearest town within 1km. An index-ordered shortlist in degrees, then
  -- the true distance in metres, as brand_matcher_site_bua does.
  UPDATE public.store_buas sb
  SET bua_gsscode = n.gsscode, computed_at = now()
  FROM public.stores s
  CROSS JOIN LATERAL (
    SELECT c.gsscode
    FROM (
      SELECT g.gsscode, g.geom
      FROM public.built_up_area_geometries g
      ORDER BY g.geom <-> s.location::geometry
      LIMIT 5
    ) c
    -- 0.02 degrees is more than 1km anywhere in England and Wales; it rules out far candidates
    -- before the costly measure in metres.
    WHERE ST_DWithin(c.geom, s.location::geometry, 0.02)
      AND ST_DWithin(c.geom::geography, s.location, 1000)
    ORDER BY ST_Distance(c.geom::geography, s.location)
    LIMIT 1
  ) n
  WHERE sb.store_id = s.id
    AND sb.bua_gsscode IS NULL
    AND (p_brand_ids IS NULL OR sb.brand_id = ANY(p_brand_ids));

  RETURN v_rows;
END;
$$;

-- The match functions now look up the site's town with a 1km reach (was the 2km default).
CREATE OR REPLACE FUNCTION public.brand_matcher_town_matches(p_lat double precision, p_lon double precision)
RETURNS TABLE (
  brand_id          uuid,
  town_stores       bigint,
  close_stores      bigint,
  towns             bigint,
  close_towns       bigint,
  best_bua_gsscode  text,
  best_bua_name     text,
  best_gap          double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY EXECUTE $q$
    WITH site AS (
      SELECT (x.signals->>'population')::double precision AS population,
             (x.signals->>'affluence_high')::double precision AS affluence
      FROM public.brand_matcher_site_bua($1, $2, 1000) x
      LIMIT 1
    ),
    towns AS (
      SELECT sb.brand_id, sb.bua_gsscode, count(*) AS stores
      FROM public.store_buas sb
      WHERE sb.bua_gsscode IS NOT NULL
      GROUP BY sb.brand_id, sb.bua_gsscode
    ),
    figures AS (
      SELECT t.brand_id, t.bua_gsscode, t.stores,
             public.brand_matcher_town_gap(p.value, a.value, site.population, site.affluence) AS gap
      FROM towns t
      CROSS JOIN site
      JOIN public.bua_demographic_ranks p ON p.bua_gsscode = t.bua_gsscode AND p.signal_name = 'population'
      JOIN public.bua_demographic_ranks a ON a.bua_gsscode = t.bua_gsscode AND a.signal_name = 'affluence_high'
    ),
    best AS (
      SELECT DISTINCT ON (f.brand_id) f.brand_id, f.bua_gsscode, f.gap
      FROM figures f
      ORDER BY f.brand_id, f.gap, f.stores DESC, f.bua_gsscode
    )
    SELECT f.brand_id,
           sum(f.stores)::bigint,
           (sum(f.stores) FILTER (WHERE f.gap <= 1))::bigint,
           count(*)::bigint,
           (count(*) FILTER (WHERE f.gap <= 1))::bigint,
           b.bua_gsscode,
           ba.name::text,
           b.gap
    FROM figures f
    JOIN best b ON b.brand_id = f.brand_id
    LEFT JOIN public.built_up_areas ba ON ba.gsscode = b.bua_gsscode
    GROUP BY f.brand_id, b.bua_gsscode, ba.name, b.gap
  $q$ USING p_lat, p_lon;
END;
$$;

CREATE OR REPLACE FUNCTION public.brand_matcher_brand_towns(p_brand_id uuid, p_lat double precision, p_lon double precision)
RETURNS TABLE (
  store_name  text,
  store_town  text,
  distance_m  double precision,
  bua_gsscode text,
  bua_name    text,
  population  double precision,
  affluence   double precision,
  gap         double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY EXECUTE $q$
    WITH site AS (
      SELECT (x.signals->>'population')::double precision AS population,
             (x.signals->>'affluence_high')::double precision AS affluence,
             ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography AS g
      FROM (SELECT 1) one
      LEFT JOIN LATERAL (SELECT * FROM public.brand_matcher_site_bua($2, $3, 1000) LIMIT 1) x ON true
    )
    SELECT s.name, s.town, ST_Distance(s.location, site.g),
           sb.bua_gsscode, ba.name::text, p.value, a.value,
           public.brand_matcher_town_gap(p.value, a.value, site.population, site.affluence)
    FROM public.stores s
    CROSS JOIN site
    LEFT JOIN public.store_buas sb ON sb.store_id = s.id
    LEFT JOIN public.built_up_areas ba ON ba.gsscode = sb.bua_gsscode
    LEFT JOIN public.bua_demographic_ranks p ON p.bua_gsscode = sb.bua_gsscode AND p.signal_name = 'population'
    LEFT JOIN public.bua_demographic_ranks a ON a.bua_gsscode = sb.bua_gsscode AND a.signal_name = 'affluence_high'
    WHERE s.brand_id = $1 AND s.location IS NOT NULL
  $q$ USING p_brand_id, p_lat, p_lon;
END;
$$;
