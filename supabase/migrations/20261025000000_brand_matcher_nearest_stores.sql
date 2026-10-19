-- Brand Matcher: the three nearest stores per brand, for the Nearest store panel
-- (docs/design_handoff_brand_matcher_signals, #3near).
--
-- Adds nearest_stores (jsonb array of {name, town, distance_m}, nearest first) to
-- brand_matcher_brand_geo. Everything else is unchanged from 20261019000000. The return type
-- changes, so the function is dropped and recreated; the route reads the new column only when
-- it is present, so it works before and after this is applied.

DROP FUNCTION IF EXISTS public.brand_matcher_brand_geo(double precision, double precision, text, text, integer);

CREATE FUNCTION public.brand_matcher_brand_geo(
  p_lat double precision,
  p_lon double precision,
  p_form text DEFAULT NULL,
  p_exclude_rc_id text DEFAULT NULL,
  p_radius_m integer DEFAULT 48280
)
RETURNS TABLE (
  brand_id            uuid,
  store_count         bigint,
  nearest_distance_m  double precision,
  nearest_store_name  text,
  nearest_store_town  text,
  same_form_count     bigint,
  same_form_names     text[],
  same_form_nearest_m double precision,
  nearest_stores      jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH site AS (
    SELECT ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography AS g
  ),
  located AS (
    SELECT s.brand_id, s.name, s.town, ST_Distance(s.location, site.g) AS d
    FROM public.stores s, site
    WHERE s.brand_id IS NOT NULL AND s.location IS NOT NULL
  ),
  ranked AS (
    SELECT l.*, row_number() OVER (PARTITION BY l.brand_id ORDER BY l.d) AS rn
    FROM located l
  ),
  nearest AS (
    SELECT r.brand_id, r.d, r.name, r.town FROM ranked r WHERE r.rn = 1
  ),
  top3 AS (
    SELECT r.brand_id,
           jsonb_agg(jsonb_build_object('name', r.name, 'town', r.town, 'distance_m', r.d) ORDER BY r.rn) AS stores
    FROM ranked r
    WHERE r.rn <= 3
    GROUP BY r.brand_id
  ),
  counts AS (
    SELECT l.brand_id, count(*) AS n FROM located l GROUP BY l.brand_id
  ),
  centres AS (
    SELECT rc.rc_id, rc.name, ST_Distance(rc.centroid, site.g) AS d
    FROM public.retail_centres rc
    JOIN public.retail_centre_classifications c ON c.label = rc.classification
    CROSS JOIN site
    WHERE p_form IS NOT NULL
      AND c.form = p_form
      AND rc.rc_id IS DISTINCT FROM p_exclude_rc_id
      AND ST_DWithin(rc.centroid, site.g, p_radius_m)
  ),
  presence AS (
    -- Presence is summarised per fascia; a multi-fascia brand in one centre counts once.
    SELECT DISTINCT f.brand_id, ce.rc_id, ce.name, ce.d
    FROM centres ce
    JOIN public.retail_centre_store_presence p
      ON p.rc_id = ce.rc_id AND p.target_type = 'fascia'
    JOIN public.fascias f ON f.id = p.target_id
  ),
  same_form AS (
    SELECT pr.brand_id,
           count(*) AS n,
           (array_agg(pr.name ORDER BY pr.d))[1:3] AS names,
           min(pr.d) AS nearest_d
    FROM presence pr
    GROUP BY pr.brand_id
  )
  SELECT n.brand_id,
         counts.n,
         n.d,
         n.name,
         n.town,
         CASE WHEN p_form IS NULL THEN NULL ELSE coalesce(sf.n, 0) END,
         sf.names,
         sf.nearest_d,
         top3.stores
  FROM nearest n
  JOIN counts ON counts.brand_id = n.brand_id
  JOIN top3 ON top3.brand_id = n.brand_id
  LEFT JOIN same_form sf ON sf.brand_id = n.brand_id;
$$;

REVOKE EXECUTE ON FUNCTION public.brand_matcher_brand_geo(double precision, double precision, text, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.brand_matcher_brand_geo(double precision, double precision, text, text, integer)
  TO service_role;
