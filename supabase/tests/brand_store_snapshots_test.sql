-- brand_store_snapshots tests
--   20260905000000_create_brand_store_snapshots.sql
--   20260906000000_snapshot_brand_stores_no_backfill.sql
--
-- These cover behaviour Jest cannot reach: whether the function actually persists the
-- counts it claims, whether re-running it duplicates or corrects a month, whether an
-- emptied county disappears, whether an unobserved month is left alone rather than
-- reconstructed, and whether RLS really keeps the table off the anon client.
-- A mocked Supabase client would happily report a successful RPC that wrote nothing.
--
-- Run against a database with the migrations applied:
--   psql -v ON_ERROR_STOP=1 -d <db> -f supabase/tests/brand_store_snapshots_test.sql
--
-- Everything runs inside a transaction that is rolled back, so it is safe to point at a
-- scratch database. Do NOT run it against production: it inserts rows, and a failure
-- aborts mid-way (the ROLLBACK still runs because ON_ERROR_STOP ends the session).

BEGIN;

\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION pg_temp.assert_eq(actual anyelement, expected anyelement, label text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'FAIL: % — expected %, got %', label, expected, actual;
  END IF;
  RAISE NOTICE 'ok: %', label;
END;
$$;

-- ---------------------------------------------------------------------------
-- Fixture: one brand, stores spread across two named counties plus one with no
-- county at all, and one store that opens after the month under test.
-- ---------------------------------------------------------------------------
\set brand_id '''eeeeeeee-0000-0000-0000-000000000001'''
\set fascia_id '''eeeeeeee-0000-0000-0000-0000000000f1'''
\set month '''2026-06-01'''

INSERT INTO brands (id, name) VALUES (:brand_id::uuid, 'Snapshot Test Brand');

-- Mirrors directory_test.sql: stores are always created against a fascia by the import
-- pipeline, so the fixture does the same rather than relying on fascia_id being nullable.
INSERT INTO fascias (id, name, brand_id)
  VALUES ('eeeeeeee-0000-0000-0000-0000000000f1', 'Snapshot Test Fascia', :brand_id::uuid);

-- 3 in Kent, one of which opened during June 2026
INSERT INTO stores (brand_id, fascia_id, name, town, county, open_date)
VALUES (:brand_id::uuid, :fascia_id::uuid, 'Kent A', 'Canterbury', 'Kent', DATE '2024-03-04'),
       (:brand_id::uuid, :fascia_id::uuid, 'Kent B', 'Ashford',    'Kent', DATE '2026-06-11'),
       (:brand_id::uuid, :fascia_id::uuid, 'Kent C', 'Dover',      'Kent', NULL);

-- 1 in Surrey
INSERT INTO stores (brand_id, fascia_id, name, town, county, open_date)
VALUES (:brand_id::uuid, :fascia_id::uuid, 'Surrey A', 'Guildford', 'Surrey', DATE '2025-09-01');

-- 2 with no usable county — one NULL, one whitespace — both belong in 'Unknown'
INSERT INTO stores (brand_id, fascia_id, name, town, county, open_date)
VALUES (:brand_id::uuid, :fascia_id::uuid, 'Nowhere A', 'Leeds', NULL,  NULL),
       (:brand_id::uuid, :fascia_id::uuid, 'Nowhere B', 'Hull',  '   ', NULL);

-- Opens in July — must not appear in June's snapshot at all
INSERT INTO stores (brand_id, fascia_id, name, town, county, open_date)
VALUES (:brand_id::uuid, :fascia_id::uuid, 'Kent Future', 'Margate', 'Kent', DATE '2026-07-02');

-- June 2026 is an elapsed month with no rows, so the no-backfill guard would skip it.
-- p_force is what a deliberate historic capture looks like.
SELECT public.snapshot_brand_stores(:month::date, p_force := true);

-- ---------------------------------------------------------------------------
-- Counts land on the right county, and a future opening is excluded
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_count integer;
BEGIN
  SELECT store_count INTO v_count FROM public.brand_store_snapshots
   WHERE snapshot_month = DATE '2026-06-01'
     AND brand_id = 'eeeeeeee-0000-0000-0000-000000000001' AND county = 'Kent';
  PERFORM pg_temp.assert_eq(v_count, 3, 'Kent holds 3 stores, excluding the July opening');

  SELECT store_count INTO v_count FROM public.brand_store_snapshots
   WHERE snapshot_month = DATE '2026-06-01'
     AND brand_id = 'eeeeeeee-0000-0000-0000-000000000001' AND county = 'Surrey';
  PERFORM pg_temp.assert_eq(v_count, 1, 'Surrey holds 1 store');

  -- NULL and whitespace counties collapse into one bucket rather than two or none.
  SELECT store_count INTO v_count FROM public.brand_store_snapshots
   WHERE snapshot_month = DATE '2026-06-01'
     AND brand_id = 'eeeeeeee-0000-0000-0000-000000000001' AND county = 'Unknown';
  PERFORM pg_temp.assert_eq(v_count, 2, 'NULL and blank counties both bucket as Unknown');
END;
$$;

-- Summing counties must reproduce the national total — the reason no rolled-up row
-- is stored. If the Unknown bucket ever silently dropped rows, this is what catches it.
DO $$
DECLARE v_total integer;
BEGIN
  SELECT sum(store_count)::integer INTO v_total FROM public.brand_store_snapshots
   WHERE snapshot_month = DATE '2026-06-01'
     AND brand_id = 'eeeeeeee-0000-0000-0000-000000000001';
  PERFORM pg_temp.assert_eq(v_total, 6, 'counties sum to the national estate of 6');
END;
$$;

-- ---------------------------------------------------------------------------
-- opened_in_period is the month's real expansion; with_open_date is its coverage
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_opened integer; v_coverage integer;
BEGIN
  SELECT opened_in_period, with_open_date INTO v_opened, v_coverage
    FROM public.brand_store_snapshots
   WHERE snapshot_month = DATE '2026-06-01'
     AND brand_id = 'eeeeeeee-0000-0000-0000-000000000001' AND county = 'Kent';
  PERFORM pg_temp.assert_eq(v_opened, 1, 'one Kent store opened during June 2026');
  PERFORM pg_temp.assert_eq(v_coverage, 2, 'two of the three Kent stores carry an open_date');
END;
$$;

-- Every store in this fixture was inserted just now, so the month containing today is
-- the one that should record them as added. June 2026 is only "this month" if the test
-- happens to run then, so assert against the current month instead of a literal.
--
-- Scoped to the Unknown bucket deliberately: its two stores carry no open_date, so they
-- fall inside every month's snapshot whatever the clock says. A whole-brand total would
-- depend on whether today is before or after the fixture's July 2026 opening.
DO $$
DECLARE v_added integer; v_this_month date := date_trunc('month', current_date)::date;
BEGIN
  PERFORM public.snapshot_brand_stores(v_this_month);
  SELECT added_in_period INTO v_added FROM public.brand_store_snapshots
   WHERE snapshot_month = v_this_month
     AND brand_id = 'eeeeeeee-0000-0000-0000-000000000001' AND county = 'Unknown';
  PERFORM pg_temp.assert_eq(v_added, 2, 'added_in_period records this run''s imports');
END;
$$;

-- ---------------------------------------------------------------------------
-- Re-running a month corrects it in place rather than duplicating or accumulating
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_rows integer; v_count integer;
BEGIN
  INSERT INTO stores (brand_id, fascia_id, name, town, county, open_date)
  VALUES ('eeeeeeee-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-0000000000f1', 'Kent D', 'Folkestone', 'Kent', DATE '2026-06-20');

  PERFORM public.snapshot_brand_stores(DATE '2026-06-01', p_force := true);

  SELECT count(*)::integer INTO v_rows FROM public.brand_store_snapshots
   WHERE snapshot_month = DATE '2026-06-01'
     AND brand_id = 'eeeeeeee-0000-0000-0000-000000000001' AND county = 'Kent';
  PERFORM pg_temp.assert_eq(v_rows, 1, 're-running a month leaves exactly one row per county');

  SELECT store_count INTO v_count FROM public.brand_store_snapshots
   WHERE snapshot_month = DATE '2026-06-01'
     AND brand_id = 'eeeeeeee-0000-0000-0000-000000000001' AND county = 'Kent';
  PERFORM pg_temp.assert_eq(v_count, 4, 're-running a month overwrites the count rather than adding to it');
END;
$$;

-- ---------------------------------------------------------------------------
-- An emptied county loses its row, so an estate can visibly shrink
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_rows integer;
BEGIN
  DELETE FROM stores
   WHERE brand_id = 'eeeeeeee-0000-0000-0000-000000000001' AND county = 'Surrey';

  PERFORM public.snapshot_brand_stores(DATE '2026-06-01', p_force := true);

  SELECT count(*)::integer INTO v_rows FROM public.brand_store_snapshots
   WHERE snapshot_month = DATE '2026-06-01'
     AND brand_id = 'eeeeeeee-0000-0000-0000-000000000001' AND county = 'Surrey';
  PERFORM pg_temp.assert_eq(v_rows, 0, 'a county with no stores left keeps no stale snapshot row');
END;
$$;

-- ---------------------------------------------------------------------------
-- The month key is pinned to the first of the month, whatever date is passed
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_rows integer;
BEGIN
  PERFORM public.snapshot_brand_stores(DATE '2026-05-17', p_force := true);
  SELECT count(*)::integer INTO v_rows FROM public.brand_store_snapshots
   WHERE snapshot_month = DATE '2026-05-01'
     AND brand_id = 'eeeeeeee-0000-0000-0000-000000000001';
  PERFORM pg_temp.assert_eq(v_rows > 0, true, 'a mid-month date is normalised to the first of that month');
END;
$$;

-- ---------------------------------------------------------------------------
-- An elapsed month we never watched is not reconstructed from today's data
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_rows integer; v_written integer;
BEGIN
  -- January 2026 has no rows and is long over. Computing it now would mean deriving it
  -- from the store table as it stands today and presenting that as an observation.
  v_written := public.snapshot_brand_stores(DATE '2026-01-01');
  PERFORM pg_temp.assert_eq(v_written, 0, 'an unobserved elapsed month writes nothing');

  SELECT count(*)::integer INTO v_rows FROM public.brand_store_snapshots
   WHERE snapshot_month = DATE '2026-01-01';
  PERFORM pg_temp.assert_eq(v_rows, 0, 'and leaves no reconstructed rows behind');

  -- Once a month has been observed, the daily refresh must still be able to close it out.
  PERFORM public.snapshot_brand_stores(DATE '2026-01-01', p_force := true);
  v_written := public.snapshot_brand_stores(DATE '2026-01-01');
  PERFORM pg_temp.assert_eq(v_written > 0, true,
    'an elapsed month that was observed is still refreshed without p_force');
END;
$$;

-- The current month is always writable — it is being observed right now, which is the
-- whole point of a daily run.
DO $$
DECLARE v_written integer;
BEGIN
  DELETE FROM public.brand_store_snapshots
   WHERE snapshot_month = date_trunc('month', current_date)::date;
  v_written := public.snapshot_brand_stores();
  PERFORM pg_temp.assert_eq(v_written > 0, true, 'the current month needs no p_force');
END;
$$;

-- ---------------------------------------------------------------------------
-- The accumulated trend is the asset — it must not be readable without service_role
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_enabled boolean; v_policies integer; v_grants integer;
BEGIN
  SELECT relrowsecurity INTO v_enabled
    FROM pg_class WHERE oid = 'public.brand_store_snapshots'::regclass;
  PERFORM pg_temp.assert_eq(v_enabled, true, 'RLS is ENABLED — without it the policies below are inert');

  SELECT count(*)::integer INTO v_policies FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'brand_store_snapshots';
  PERFORM pg_temp.assert_eq(v_policies, 0, 'no policy exists, so RLS denies every non-service_role read');

  SELECT count(*)::integer INTO v_grants
    FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND table_name = 'brand_store_snapshots'
     AND grantee IN ('anon', 'authenticated', 'PUBLIC');
  PERFORM pg_temp.assert_eq(v_grants, 0, 'anon and authenticated hold no table grants');
END;
$$;

DO $$
DECLARE v_grants integer;
BEGIN
  SELECT count(*)::integer INTO v_grants
    FROM information_schema.routine_privileges
   WHERE routine_schema = 'public' AND routine_name = 'snapshot_brand_stores'
     AND grantee IN ('anon', 'authenticated', 'PUBLIC');
  -- Also catches the pre-20260906000000 single-argument overload being left behind,
  -- which would silently keep the un-guarded implementation reachable.
  PERFORM pg_temp.assert_eq(v_grants, 0, 'snapshot_brand_stores is not executable by anon or authenticated');
END;
$$;

ROLLBACK;
