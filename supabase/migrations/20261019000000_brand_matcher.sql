-- Brand Matcher (SiteMatcher unified workspace, site -> brands mode).
-- See docs/design_handoff_contact_brands/README.md.
--
-- Two read-only functions, both service_role only (the route gates on Plus + the flag):
--   1. brand_matcher_site(postcode)  — places the site: postcode centroid, the GeoDS retail
--      centre it sits inside (if any) and the region of the nearest centre.
--   2. brand_matcher_brand_geo(...)  — per brand: nearest store to the site, and how many
--      other centres of the site's own form (retail park / high street / shopping centre)
--      within the radius the brand already trades in.
-- Everything else the route needs (requirements, contacts, profiles) is plain table reads.

INSERT INTO public.feature_flags (key, enabled, description)
VALUES ('brand_matcher_enabled', false, 'Brand Matcher mode in the unified workspace')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 1. brand_matcher_site
--    p_postcode must already be normalised to the ONSPD 'OUT IN' form (the route does it).
--    Live postcodes win over terminated ones; a terminated postcode still places a site.
--    Region comes from the nearest GeoDS centre: uk_postcode_centroids carries no region,
--    and a nearest-centre read is exact everywhere except right on a regional border.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.brand_matcher_site(p_postcode text)
RETURNS TABLE (
  postcode        text,
  lat             double precision,
  lon             double precision,
  rc_id           text,
  rc_name         text,
  rc_classification text,
  rc_form         text,
  rc_form_label   text,
  region_name     text,
  country         text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH pc AS (
    SELECT p.postcode, p.latitude, p.longitude, p.location
    FROM public.uk_postcode_centroids p
    WHERE p.postcode = p_postcode
    ORDER BY p.is_live DESC
    LIMIT 1
  ),
  containing AS (
    -- A point can sit inside overlapping centres (a retail park inside a town-centre
    -- polygon); the smaller one is the more specific description of the site.
    SELECT rc.rc_id, rc.name, rc.classification, c.form, c.form_label
    FROM pc
    JOIN public.retail_centre_geometries g ON ST_Covers(g.geom, pc.location::geometry)
    JOIN public.retail_centres rc ON rc.rc_id = g.rc_id
    JOIN public.retail_centre_classifications c ON c.label = rc.classification
    ORDER BY rc.area_km2 ASC NULLS LAST
    LIMIT 1
  ),
  nearest AS (
    SELECT rc.region_name, rc.country
    FROM pc, public.retail_centres rc
    ORDER BY rc.centroid <-> pc.location
    LIMIT 1
  )
  SELECT pc.postcode, pc.latitude, pc.longitude,
         containing.rc_id, containing.name, containing.classification,
         containing.form, containing.form_label,
         nearest.region_name, nearest.country
  FROM pc
  LEFT JOIN containing ON true
  LEFT JOIN nearest ON true;
$$;

REVOKE EXECUTE ON FUNCTION public.brand_matcher_site(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.brand_matcher_site(text) TO service_role;

-- ---------------------------------------------------------------------------
-- 2. brand_matcher_brand_geo
--    One row per brand with at least one located store. same_form_* are NULL when the site
--    is not inside a centre (p_form NULL) — "no location type" is not the same as "trades
--    in none". The site's own centre is excluded: the band reads "trades in N *other* …",
--    and a brand already trading in the site's own centre surfaces as a near nearest store.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.brand_matcher_brand_geo(
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
  same_form_nearest_m double precision
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
  nearest AS (
    SELECT DISTINCT ON (l.brand_id) l.brand_id, l.d, l.name, l.town
    FROM located l
    ORDER BY l.brand_id, l.d
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
         sf.nearest_d
  FROM nearest n
  JOIN counts ON counts.brand_id = n.brand_id
  LEFT JOIN same_form sf ON sf.brand_id = n.brand_id;
$$;

REVOKE EXECUTE ON FUNCTION public.brand_matcher_brand_geo(double precision, double precision, text, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.brand_matcher_brand_geo(double precision, double precision, text, text, integer)
  TO service_role;
