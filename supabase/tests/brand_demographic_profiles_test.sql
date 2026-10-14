-- Brand Matcher demographic profile deployment checks.
--
-- Run only after applying 20261023000000_brand_demographic_profiles.sql and running
-- rebuild_brand_demographic_profiles(). Read-only; the transaction is rolled back.
-- Prints coverage figures as notices — read them, they say how much of each estate the
-- method can see.
--
--   psql -v ON_ERROR_STOP=1 -d <db> -f supabase/tests/brand_demographic_profiles_test.sql

BEGIN;

\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION pg_temp.assert_true(actual boolean, label text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF actual IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL: %', label;
  END IF;
  RAISE NOTICE 'ok: %', label;
END;
$$;

DO $$
DECLARE
  v_located bigint;
  v_in_town bigint;
  v_in_scored_town bigint;
  v_profiles bigint;
  v_brands bigint;
  v_fascias bigint;
  v_signals bigint;
BEGIN
  SELECT count(*) INTO v_signals FROM (SELECT DISTINCT signal_name FROM public.brand_matcher_bua_signals) s;
  PERFORM pg_temp.assert_true(v_signals > 1, 'BUA signals exist (has rebuild_all_demographics() run?)');

  SELECT count(*) INTO v_profiles FROM public.brand_demographic_profiles;
  PERFORM pg_temp.assert_true(v_profiles > 0, 'profiles exist (has rebuild_brand_demographic_profiles() run?)');

  -- A brand trades in at least as many towns as any one of its fascias.
  PERFORM pg_temp.assert_true(NOT EXISTS (
    SELECT 1
    FROM public.brand_demographic_profiles f
    LEFT JOIN public.brand_demographic_profiles b
      ON b.brand_id = f.brand_id AND b.fascia_id IS NULL AND b.signal_name = f.signal_name
    WHERE f.fascia_id IS NOT NULL
      AND (b.brand_id IS NULL OR b.bua_count < f.bua_count)
  ), 'brand-level profile covers each fascia profile');

  -- Fascias belong to the brand they are profiled under.
  PERFORM pg_temp.assert_true(NOT EXISTS (
    SELECT 1
    FROM public.brand_demographic_profiles d
    JOIN public.fascias f ON f.id = d.fascia_id
    WHERE f.brand_id <> d.brand_id
  ), 'fascia profiles sit under their own brand');

  -- A store inside a town with signals places back into that same town.
  PERFORM pg_temp.assert_true((
    SELECT bool_and(t.bua_gsscode = st.gsscode AND t.distance_m = 0 AND t.signals ? 'population')
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
  ), 'a site at a store inside a town is placed in that town');

  -- Coverage. Not asserted: these are for reading.
  SELECT count(*) INTO v_located FROM public.stores WHERE brand_id IS NOT NULL AND location IS NOT NULL;
  SELECT coalesce(sum(p.store_count), 0) INTO v_in_town FROM public.brand_bua_presence() p;
  SELECT coalesce(sum(p.store_count), 0) INTO v_in_scored_town
  FROM public.brand_bua_presence() p
  WHERE EXISTS (SELECT 1 FROM public.brand_matcher_bua_signals v WHERE v.bua_gsscode = p.bua_gsscode);
  SELECT count(DISTINCT brand_id) INTO v_brands FROM public.brand_demographic_profiles WHERE fascia_id IS NULL;
  SELECT count(DISTINCT fascia_id) INTO v_fascias FROM public.brand_demographic_profiles WHERE fascia_id IS NOT NULL;

  RAISE NOTICE 'coverage: % located stores; % (% %%) inside a town; % (% %%) inside a town with demographics',
    v_located,
    v_in_town, round(100.0 * v_in_town / nullif(v_located, 0), 1),
    v_in_scored_town, round(100.0 * v_in_scored_town / nullif(v_located, 0), 1);
  RAISE NOTICE 'coverage: % brands and % fascias profiled; % signals', v_brands, v_fascias, v_signals;
END;
$$;

-- The most distinctive brand-level signals, to sanity-check by eye (Waitrose should skew affluent).
SELECT b.name AS brand, d.signal_name, round(d.median::numeric, 1) AS median,
       round(d.distinctiveness::numeric, 2) AS distinctiveness, d.bua_count
FROM public.brand_demographic_profiles d
JOIN public.brands b ON b.id = d.brand_id
WHERE d.fascia_id IS NULL
ORDER BY d.distinctiveness DESC
LIMIT 30;

ROLLBACK;
