-- Brand Matcher demographics, simplified: the catchment population and affluence around the site
-- and around each brand's three nearest stores to it.
--
-- Replaces the backtest-gated demographic fit on the card (20261027000000). A store's catchment is
-- the catchment of the LSOA it stands in, as lsoa_catchments defines it: the LSOAs whose centres
-- are within 1km, or 3km / 5km where fewer than 5,000 people live within 1km. Population is the
-- people in those LSOAs; affluence is the catchment's affluence index (100 = the England and Wales
-- average), as lsoa_catchment_ranks holds it. The profile and backtest tables are left in place,
-- unused.
--
-- One row per brand store (rank 1..3, nearest first, by the same distance as
-- brand_matcher_brand_geo) and one row for the site itself (brand_id NULL, rank 0). Stores and
-- sites outside England and Wales come back with NULL catchment columns.

CREATE OR REPLACE FUNCTION public.brand_matcher_store_catchments(p_lat double precision, p_lon double precision)
RETURNS TABLE (
  brand_id   uuid,
  rank       integer,
  store_name text,
  store_town text,
  distance_m double precision,
  lsoa_code  text,
  radius_m   integer,
  population double precision,
  affluence  double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Dynamic so the plan is made for these coordinates, not a generic one (see 20261027000000).
  RETURN QUERY EXECUTE $q$
    WITH site AS (
      SELECT ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography AS g
    ),
    ranked AS (
      SELECT s.brand_id, s.name, s.town, s.location, ST_Distance(s.location, site.g) AS d,
             row_number() OVER (PARTITION BY s.brand_id ORDER BY ST_Distance(s.location, site.g)) AS rn
      FROM public.stores s, site
      WHERE s.brand_id IS NOT NULL AND s.location IS NOT NULL
    ),
    points AS MATERIALIZED (
      SELECT r.brand_id, r.rn::integer AS rn, r.name, r.town, r.d, r.location::geometry AS geom
      FROM ranked r
      WHERE r.rn <= 3
      UNION ALL
      SELECT NULL::uuid, 0, NULL::text, NULL::text, 0::double precision, site.g::geometry FROM site
    ),
    located AS MATERIALIZED (
      SELECT p.*,
             (SELECT b.lsoa_code FROM public.lsoa_boundaries b WHERE ST_Covers(b.geometry, p.geom) LIMIT 1) AS lsoa_code
      FROM points p
    )
    SELECT l.brand_id,
           l.rn,
           l.name,
           l.town,
           l.d,
           c.lsoa_code,
           c.radius_m,
           CASE WHEN c.radius_m IS NULL THEN NULL
                WHEN c.radius_m = 1000 THEN c.pop_1km
                ELSE (SELECT sum(n.population) FROM public.lsoa_catchments n
                      WHERE ST_DWithin(n.centroid, c.centroid, c.radius_m)) END,
           r.value
    FROM located l
    LEFT JOIN public.lsoa_catchments c ON c.lsoa_code = l.lsoa_code
    LEFT JOIN public.lsoa_catchment_ranks r ON r.lsoa_code = c.lsoa_code AND r.signal_name = 'affluence_high'
  $q$ USING p_lat, p_lon;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.brand_matcher_store_catchments(double precision, double precision)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.brand_matcher_store_catchments(double precision, double precision)
  TO service_role;
