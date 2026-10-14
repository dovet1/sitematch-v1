-- Fixture checks for the Brand Matcher demographic migrations (20261023000000 and
-- 20261023020000). Throwaway database only; see stubs.sql for the run order. Each check raises
-- on failure.
\set ON_ERROR_STOP 1

-- 30 English towns in a row, 0.05° squares 0.1° apart. Affluence rises with i, population too.
-- Town 31 is Scottish: it has a population but no demographic signals.
INSERT INTO built_up_areas (gsscode, name, pop_final)
SELECT format('E%s', lpad(i::text, 8, '0')), format('Town %s', i), i * 10000
FROM generate_series(1, 30) i;
INSERT INTO built_up_areas VALUES ('S00000031', 'Scottish Town', 50000);
INSERT INTO built_up_area_geometries (gsscode, geom)
SELECT gsscode, ST_Multi(ST_MakeEnvelope(-2 + i * 0.1, 52.0, -2 + i * 0.1 + 0.05, 52.05, 4326))
FROM (SELECT gsscode, right(gsscode, 2)::int AS i FROM built_up_areas) t;

INSERT INTO demographic_signal_mappings VALUES ('affluence_high', 'affluence'), ('urbanity_rural', 'urbanity');
INSERT INTO bua_demographic_signals
SELECT format('E%s', lpad(i::text, 8, '0')), 'affluence_high', 50 + i * 5 FROM generate_series(1, 30) i
UNION ALL
SELECT format('E%s', lpad(i::text, 8, '0')), 'urbanity_rural', 100 + (i % 3) * 5 FROM generate_series(1, 30) i
-- A Scottish border town given a value from a sliver of an English census area: must be ignored.
UNION ALL SELECT 'S00000031', 'affluence_high', 999;

INSERT INTO brands VALUES
  ('00000000-0000-0000-0000-00000000000a', 'Posh'),
  ('00000000-0000-0000-0000-00000000000b', 'Everywhere');
INSERT INTO fascias VALUES
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', 'Posh'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000a', 'Posh Mini'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000b', 'Everywhere Odd'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000000b', 'Everywhere Even');

CREATE FUNCTION pg_temp.town_point(i int) RETURNS geography LANGUAGE sql AS
  $$ SELECT ST_SetSRID(ST_MakePoint(-2 + i * 0.1 + 0.025, 52.025), 4326)::geography $$;

-- Posh: main fascia in the ten most affluent towns (two stores in town 30), Mini in three,
-- one store in Scotland and one outside every town.
INSERT INTO stores (brand_id, fascia_id, location)
SELECT '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', pg_temp.town_point(i)
FROM generate_series(21, 30) i;
INSERT INTO stores (brand_id, fascia_id, location) VALUES
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', pg_temp.town_point(30)),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', pg_temp.town_point(31)),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1',
   ST_SetSRID(ST_MakePoint(0, 50), 4326)::geography);
INSERT INTO stores (brand_id, fascia_id, location)
SELECT '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', pg_temp.town_point(i)
FROM generate_series(28, 30) i;
-- Everywhere: one store in every town, split across two fascias, plus a fascia-less store.
INSERT INTO stores (brand_id, fascia_id, location)
SELECT '00000000-0000-0000-0000-00000000000b',
       CASE WHEN i % 2 = 1 THEN '00000000-0000-0000-0000-0000000000b1'::uuid
            ELSE '00000000-0000-0000-0000-0000000000b2'::uuid END,
       pg_temp.town_point(i)
FROM generate_series(1, 30) i;
INSERT INTO stores (brand_id, fascia_id, location) VALUES
  ('00000000-0000-0000-0000-00000000000b', NULL, pg_temp.town_point(1));

CREATE FUNCTION pg_temp.check(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF;
  RAISE NOTICE 'ok: %', label;
END $$;

CREATE FUNCTION pg_temp.near(a double precision, b double precision) RETURNS boolean LANGUAGE sql AS
  $$ SELECT abs(a - b) < 1e-6 $$;

-- One size band (30 towns < 200), so ranks are across all towns: 30 towns x 3 signals.
SELECT pg_temp.check(rebuild_bua_demographic_ranks() = 90, 'ranks written for every English town and signal');
SELECT pg_temp.check(NOT EXISTS (SELECT 1 FROM bua_demographic_ranks WHERE bua_gsscode = 'S00000031'),
  'the Scottish town gets no ranks');

-- Units with >= 8 towns: Posh, Posh fascia, Everywhere, and its two fascias. x 3 signals.
SELECT pg_temp.check(rebuild_brand_demographic_profiles() = 15, 'full rebuild writes 5 profiles x 3 signals');

SELECT pg_temp.check(NOT EXISTS (
  SELECT 1 FROM brand_demographic_profiles WHERE fascia_id = '00000000-0000-0000-0000-0000000000a2'
), 'a fascia in fewer than 8 towns gets no profile');

SELECT pg_temp.check(
  (SELECT bua_count = 10 AND store_count = 14
          AND pg_temp.near(median, 177.5) AND pg_temp.near(p10, 159.5) AND pg_temp.near(p90, 195.5)
          AND pg_temp.near(median_rank, 25.0 / 30) AND pg_temp.near(distinctiveness, 2 * (25.0 / 30 - 0.5))
          AND pg_temp.near(rank_p10, 21.4 / 30) AND pg_temp.near(rank_p90, 28.6 / 30)
   FROM brand_demographic_profiles
   WHERE brand_id = '00000000-0000-0000-0000-00000000000a' AND fascia_id IS NULL AND signal_name = 'affluence_high'),
  'Posh: ten English towns (Scotland and out-of-town stores excluded), affluent and distinctive');

-- Urbanity takes three values, ten towns each; Posh's towns spread evenly across them.
SELECT pg_temp.check(
  (SELECT pg_temp.near(median_rank, 0.5) AND pg_temp.near(distinctiveness, 0)
   FROM brand_demographic_profiles
   WHERE brand_id = '00000000-0000-0000-0000-00000000000a' AND fascia_id IS NULL AND signal_name = 'urbanity_rural'),
  'tied values rank mid-group, so an evenly spread signal is not distinctive');

SELECT pg_temp.check(
  (SELECT pg_temp.near(median, 255000) AND signal_category = 'population'
   FROM brand_demographic_profiles
   WHERE brand_id = '00000000-0000-0000-0000-00000000000a' AND fascia_id IS NULL AND signal_name = 'population'),
  'population is profiled as a signal in people');

SELECT pg_temp.check(
  (SELECT bua_count = 30 AND store_count = 31 AND pg_temp.near(distinctiveness, 0)
   FROM brand_demographic_profiles
   WHERE brand_id = '00000000-0000-0000-0000-00000000000b' AND fascia_id IS NULL AND signal_name = 'affluence_high'),
  'Everywhere: a town traded under two fascias counts once; not distinctive');

SELECT pg_temp.check(
  (SELECT bua_count = 15 FROM brand_demographic_profiles
   WHERE fascia_id = '00000000-0000-0000-0000-0000000000b1' AND signal_name = 'affluence_high'),
  'fascia profiles use only that fascia''s towns');

-- A scoped rebuild must reproduce the full rebuild's rows exactly.
CREATE TEMP TABLE full_rows AS
  SELECT brand_id, fascia_key, signal_name, bua_count, store_count, p10, p25, median, p75, p90, median_rank, distinctiveness
  FROM brand_demographic_profiles;
SELECT pg_temp.check(rebuild_brand_demographic_profiles(ARRAY['00000000-0000-0000-0000-00000000000a'::uuid]) = 6,
  'scoped rebuild rewrites only that brand');
SELECT pg_temp.check(NOT EXISTS (
  (SELECT brand_id, fascia_key, signal_name, bua_count, store_count, p10, p25, median, p75, p90, median_rank, distinctiveness
   FROM brand_demographic_profiles)
  EXCEPT SELECT * FROM full_rows
) AND (SELECT count(*) FROM brand_demographic_profiles) = 15, 'scoped rebuild matches the full rebuild');

-- Size bands of 10 towns. Affluence rises with size in these towns, so Posh's towns (the ten
-- biggest, all in the top band) are only as affluent as towns of their size: not distinctive.
-- Population is still ranked across all towns, so their size still stands out.
SELECT pg_temp.check(rebuild_bua_demographic_ranks(10, 5, 1000) = 90, 'ranks rebuilt in bands of ten');
SELECT pg_temp.check((SELECT count(DISTINCT size_band) = 3 FROM bua_demographic_ranks), 'three size bands');
SELECT rebuild_brand_demographic_profiles();
SELECT pg_temp.check(
  (SELECT pg_temp.near(distinctiveness, 0) AND pg_temp.near(median, 177.5)
   FROM brand_demographic_profiles
   WHERE brand_id = '00000000-0000-0000-0000-00000000000a' AND fascia_id IS NULL AND signal_name = 'affluence_high'),
  'affluence that only comes with size is not distinctive once towns are compared within their size band');
SELECT pg_temp.check(
  (SELECT pg_temp.near(distinctiveness, 2 * (25.0 / 30 - 0.5))
   FROM brand_demographic_profiles
   WHERE brand_id = '00000000-0000-0000-0000-00000000000a' AND fascia_id IS NULL AND signal_name = 'population'),
  'town size is still ranked against all towns');
-- A band also closes once towns more than double in size: 10k-50k | 60k-120k | 130k-260k, and
-- the last four (270k-300k, under the minimum of five) join the band below.
SELECT rebuild_bua_demographic_ranks(200, 5, 2);
SELECT pg_temp.check(
  (SELECT array_agg(n ORDER BY size_band) = ARRAY[5, 7, 18]::bigint[]
   FROM (SELECT size_band, count(*) AS n FROM bua_demographic_ranks WHERE signal_name = 'population' GROUP BY 1) b),
  'bands close when population doubles, and a small last band joins the one below');

SELECT rebuild_bua_demographic_ranks();
SELECT rebuild_brand_demographic_profiles();

-- A brand that drops below the minimum loses its profile rather than keeping a stale one.
DELETE FROM stores WHERE brand_id = '00000000-0000-0000-0000-00000000000a'
  AND location::geometry && ST_MakeEnvelope(-0.05, 51.9, 1, 52.1, 4326);  -- towns 20-29
SELECT pg_temp.check(rebuild_brand_demographic_profiles(ARRAY['00000000-0000-0000-0000-00000000000a'::uuid]) = 0,
  'brand below the minimum is rebuilt to nothing');
SELECT pg_temp.check(NOT EXISTS (
  SELECT 1 FROM brand_demographic_profiles WHERE brand_id = '00000000-0000-0000-0000-00000000000a'
), 'stale profile removed');

-- The profile rebuild keeps a snapshot of which towns each brand trades in, for the backtest.
SELECT pg_temp.check(NOT EXISTS (
  (SELECT * FROM brand_bua_presence() EXCEPT SELECT * FROM brand_bua_presence_snapshot)
  UNION ALL
  (SELECT * FROM brand_bua_presence_snapshot EXCEPT SELECT * FROM brand_bua_presence())
), 'presence snapshot matches the stores');

-- The backtest's helpers match the TypeScript ones.
SELECT pg_temp.check(pg_temp.near(brand_matcher_hash01('unit|E00000001'),
  ('x' || substr(md5('unit|E00000001'), 1, 8))::bit(32)::bigint / 4294967296.0), 'hash01 is the first 32 bits of md5');
SELECT pg_temp.check(
  pg_temp.near(brand_matcher_signal_fit(110, 100, 110, 130, 140), 1)
  AND pg_temp.near(brand_matcher_signal_fit(105, 100, 110, 130, 140), 0.75)
  AND pg_temp.near(brand_matcher_signal_fit(95, 100, 110, 130, 140), 0.25)
  AND pg_temp.near(brand_matcher_signal_fit(60, 100, 110, 130, 140), 0)
  AND pg_temp.near(brand_matcher_signal_fit(145, 100, 110, 130, 140), 0.25)
  AND pg_temp.near(brand_matcher_signal_fit(109, 110, 110, 130, 140), 0),
  'signal fit matches signalFit()');

-- Placing a site.
SELECT pg_temp.check(
  (SELECT bua_gsscode = 'E00000025' AND distance_m = 0 AND (signals->>'population')::numeric = 250000
          AND (signals->>'affluence_high')::numeric = 175
          AND pg_temp.near((ranks->>'affluence_high')::double precision, 24.5 / 30)
   FROM brand_matcher_site_bua(52.025, -2 + 25 * 0.1 + 0.025)),
  'a site inside a town gets that town, its signals and its ranks');
SELECT pg_temp.check(
  (SELECT bua_gsscode = 'E00000030' AND distance_m BETWEEN 600 AND 800
   FROM brand_matcher_site_bua(52.025, 1.06)),
  'a site just outside a town falls back to the nearest one');
SELECT pg_temp.check(
  NOT EXISTS (SELECT 1 FROM brand_matcher_site_bua(52.025, 1.2)),
  'a site beyond the fallback distance is not placed');
SELECT pg_temp.check(
  (SELECT bua_gsscode = 'S00000031' AND signals IS NULL AND ranks IS NULL FROM brand_matcher_site_bua(52.025, 1.125)),
  'a town without demographics is placed with no signals');

SELECT pg_temp.check(
  NOT has_function_privilege('anon', 'public.brand_matcher_site_bua(double precision, double precision, integer)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.rebuild_brand_demographic_profiles(uuid[])', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.rebuild_bua_demographic_ranks(integer, integer, double precision)', 'EXECUTE')
  AND NOT has_table_privilege('anon', 'public.brand_demographic_profiles', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.bua_demographic_ranks', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.brand_bua_presence_snapshot', 'SELECT')
  AND NOT has_function_privilege('authenticated', 'public.brand_demographic_backtest(integer, integer, double precision, integer, integer)', 'EXECUTE'),
  'nothing is reachable by anon or authenticated');
