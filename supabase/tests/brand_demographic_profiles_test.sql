-- Brand Matcher demographic profile deployment checks.
--
-- Run only after applying the Brand Matcher demographic migrations (20261023000000 and
-- 20261023020000) and running rebuild_bua_demographic_ranks() then
-- rebuild_brand_demographic_profiles(). Read-only. Works pasted into the Supabase SQL editor
-- or with psql:
--
--   psql -v ON_ERROR_STOP=1 -d <db> -f supabase/tests/brand_demographic_profiles_test.sql
--
-- A failed check stops with an error naming it. If they all pass, the result is one row of
-- coverage figures — read them: they say how much of each estate the method can see.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.brand_matcher_bua_signals WHERE signal_name <> 'population') THEN
    RAISE EXCEPTION 'FAIL: no BUA demographic signals — run rebuild_all_demographics() first';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.bua_demographic_ranks) THEN
    RAISE EXCEPTION 'FAIL: no size-adjusted ranks — run rebuild_bua_demographic_ranks()';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.brand_demographic_profiles) THEN
    RAISE EXCEPTION 'FAIL: no profiles — run rebuild_brand_demographic_profiles()';
  END IF;

  -- A brand trades in at least as many towns as any one of its fascias.
  IF EXISTS (
    SELECT 1
    FROM public.brand_demographic_profiles f
    LEFT JOIN public.brand_demographic_profiles b
      ON b.brand_id = f.brand_id AND b.fascia_id IS NULL AND b.signal_name = f.signal_name
    WHERE f.fascia_id IS NOT NULL
      AND (b.brand_id IS NULL OR b.bua_count < f.bua_count)
  ) THEN
    RAISE EXCEPTION 'FAIL: a fascia profile covers more towns than its brand profile';
  END IF;

  -- Fascias belong to the brand they are profiled under.
  IF EXISTS (
    SELECT 1
    FROM public.brand_demographic_profiles d
    JOIN public.fascias f ON f.id = d.fascia_id
    WHERE f.brand_id <> d.brand_id
  ) THEN
    RAISE EXCEPTION 'FAIL: a fascia is profiled under the wrong brand';
  END IF;

  -- A store inside a town with signals places back into that same town.
  IF NOT (
    SELECT coalesce(bool_and(t.bua_gsscode = st.gsscode AND t.distance_m = 0 AND t.signals ? 'population'), false)
    FROM (
      SELECT s.location, g.gsscode
      FROM public.stores s
      JOIN public.built_up_area_geometries g ON ST_Covers(g.geom, s.location::geometry)
      WHERE s.location IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.brand_matcher_bua_signals v WHERE v.bua_gsscode = g.gsscode)
      LIMIT 20
    ) st
    CROSS JOIN LATERAL public.brand_matcher_site_bua(
      ST_Y(st.location::geometry), ST_X(st.location::geometry)
    ) t
  ) THEN
    RAISE EXCEPTION 'FAIL: a site at a store inside a town was not placed in that town';
  END IF;
END;
$$;

-- All checks passed. Coverage, for reading.
WITH presence AS (
  SELECT p.*,
         EXISTS (SELECT 1 FROM public.brand_matcher_bua_signals v WHERE v.bua_gsscode = p.bua_gsscode) AS has_signals
  FROM public.brand_bua_presence() p
),
located AS (
  SELECT count(*) AS n FROM public.stores WHERE brand_id IS NOT NULL AND location IS NOT NULL
)
SELECT
  'all checks passed' AS status,
  located.n AS located_stores,
  (SELECT sum(store_count) FROM presence) AS stores_inside_a_town,
  round(100.0 * (SELECT sum(store_count) FROM presence) / nullif(located.n, 0), 1) AS pct_inside_a_town,
  (SELECT sum(store_count) FROM presence WHERE has_signals) AS stores_in_town_with_demographics,
  round(100.0 * (SELECT sum(store_count) FROM presence WHERE has_signals) / nullif(located.n, 0), 1)
    AS pct_in_town_with_demographics,
  (SELECT count(DISTINCT brand_id) FROM public.brand_demographic_profiles WHERE fascia_id IS NULL) AS brands_profiled,
  (SELECT count(DISTINCT fascia_id) FROM public.brand_demographic_profiles WHERE fascia_id IS NOT NULL) AS fascias_profiled,
  (SELECT count(DISTINCT signal_name) FROM public.brand_matcher_bua_signals) AS signals
FROM located;
