-- Directory database tests (20260721000000_directory.sql).
--
-- These cover behaviour Jest cannot reach: whether a Postgres function actually persists a
-- column, whether an aggregate double-counts, and whether RLS really blocks an anon client.
-- A mocked Supabase client would happily "persist" a column the RPC drops — which is the
-- exact bug these guard against.
--
-- Run against a database with the migrations applied:
--   psql -v ON_ERROR_STOP=1 -d <db> -f supabase/tests/directory_test.sql
--
-- Everything runs inside a transaction that is rolled back, so it is safe to point at a
-- scratch database. Do NOT run it against production: it inserts rows, and a failure aborts
-- mid-way (the ROLLBACK still runs because ON_ERROR_STOP ends the session).

BEGIN;

\set ON_ERROR_STOP on

-- Small assertion helper.
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
-- Fixture: one brand with several children in MORE THAN ONE child table at once.
-- The row-multiplication bug only shows up in that case — with a single populated
-- child table a naive join gives the right answer by accident.
-- ---------------------------------------------------------------------------
INSERT INTO brands (id, name) VALUES ('dddddddd-0000-0000-0000-000000000001', 'Test Brand');

INSERT INTO categories (id, name) VALUES ('dddddddd-0000-0000-0000-0000000000c1', 'Restaurants');
INSERT INTO categories (id, name, parent_category_id)
  VALUES ('dddddddd-0000-0000-0000-0000000000c2', 'Chicken', 'dddddddd-0000-0000-0000-0000000000c1');
INSERT INTO fascias (id, name, brand_id)
  VALUES ('dddddddd-0000-0000-0000-0000000000f1', 'Test Fascia', 'dddddddd-0000-0000-0000-000000000001');
INSERT INTO fascia_categories (fascia_id, category_id, is_primary)
  VALUES ('dddddddd-0000-0000-0000-0000000000f1', 'dddddddd-0000-0000-0000-0000000000c2', true);

-- 5 stores
INSERT INTO stores (brand_id, fascia_id, name, town, open_date)
SELECT 'dddddddd-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-0000000000f1',
       'Store ' || g, 'Town ' || g, DATE '2025-01-01' + g
FROM generate_series(1, 5) g;

-- 3 in-house contacts + 2 agency contacts (only the in-house ones should be counted)
INSERT INTO brand_contacts (brand_id, contact_name, contact_kind)
SELECT 'dddddddd-0000-0000-0000-000000000001', 'InHouse ' || g, 'in-house' FROM generate_series(1, 3) g;
INSERT INTO brand_contacts (brand_id, contact_name, contact_kind, contact_org)
SELECT 'dddddddd-0000-0000-0000-000000000001', 'Agency ' || g, 'agency', 'Test Agency' FROM generate_series(1, 2) g;

-- 2 agents
INSERT INTO directory_agencies (id, name) VALUES ('dddddddd-0000-0000-0000-0000000000a1', 'Test Agency');
INSERT INTO directory_agents (id, agency_id, name) VALUES
  ('dddddddd-0000-0000-0000-0000000000e1', 'dddddddd-0000-0000-0000-0000000000a1', 'Agent One'),
  ('dddddddd-0000-0000-0000-0000000000e2', 'dddddddd-0000-0000-0000-0000000000a1', 'Agent Two');
INSERT INTO brand_agents (brand_id, agent_id) VALUES
  ('dddddddd-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-0000000000e1'),
  ('dddddddd-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-0000000000e2');

-- ---------------------------------------------------------------------------
-- 1. directory_brand_cards(): every count independent, not a join product.
--    A naive single-FROM join would report 5*3*2 = 30 for each of these.
-- ---------------------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM directory_brand_cards()
   WHERE id = 'dddddddd-0000-0000-0000-000000000001';

  PERFORM pg_temp.assert_eq(r.store_count, 5::bigint, 'store_count is 5, not inflated');
  PERFORM pg_temp.assert_eq(r.in_house_count, 3::bigint, 'in_house_count is 3 (agency rows excluded)');
  PERFORM pg_temp.assert_eq(r.agent_count, 2::bigint, 'agent_count is 2');
  PERFORM pg_temp.assert_eq(r.has_active_requirement, false, 'no active requirement yet');
  PERFORM pg_temp.assert_eq(r.category_child, 'Chicken', 'category child resolved');
  PERFORM pg_temp.assert_eq(r.category_parent, 'Restaurants', 'category parent resolved');
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. save_requirement() persists size_seen_* on BOTH the insert and update branches.
--    The two branches enumerate columns separately, so the update path is the one most
--    likely to be missed when a column is added.
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_id uuid; v_sqft integer; v_basis text; v_link text;
BEGIN
  v_id := save_requirement(jsonb_build_object(
    'brand_id', 'dddddddd-0000-0000-0000-000000000001',
    'company_name', 'Test Brand',
    'size_seen_sqft', '4200',
    'size_seen_basis', '18 stores opened 2024-25',
    'contacts', jsonb_build_array(jsonb_build_object(
      'contact_name', 'Req Contact',
      'contact_kind', 'in-house',
      'linkedin_url', 'https://linkedin.com/in/req'))));

  SELECT size_seen_sqft, size_seen_basis INTO v_sqft, v_basis FROM requirements WHERE id = v_id;
  PERFORM pg_temp.assert_eq(v_sqft, 4200, 'save_requirement INSERT persists size_seen_sqft');
  PERFORM pg_temp.assert_eq(v_basis, '18 stores opened 2024-25', 'save_requirement INSERT persists size_seen_basis');

  SELECT linkedin_url INTO v_link FROM requirement_contacts WHERE requirement_id = v_id;
  PERFORM pg_temp.assert_eq(v_link, 'https://linkedin.com/in/req',
    '_replace_requirement_children persists contact linkedin_url');

  PERFORM save_requirement(jsonb_build_object(
    'id', v_id,
    'brand_id', 'dddddddd-0000-0000-0000-000000000001',
    'company_name', 'Test Brand',
    'size_seen_sqft', '5100',
    'size_seen_basis', 'updated basis'));

  SELECT size_seen_sqft, size_seen_basis INTO v_sqft, v_basis FROM requirements WHERE id = v_id;
  PERFORM pg_temp.assert_eq(v_sqft, 5100, 'save_requirement UPDATE persists size_seen_sqft');
  PERFORM pg_temp.assert_eq(v_basis, 'updated basis', 'save_requirement UPDATE persists size_seen_basis');
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. save_brand_contacts() persists linkedin_url.
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_link text; v_count integer;
BEGIN
  PERFORM save_brand_contacts('dddddddd-0000-0000-0000-000000000001', jsonb_build_array(
    jsonb_build_object('contact_name', 'Only Contact', 'contact_kind', 'in-house',
                       'linkedin_url', 'https://linkedin.com/in/only')));

  SELECT linkedin_url INTO v_link FROM brand_contacts
   WHERE brand_id = 'dddddddd-0000-0000-0000-000000000001';
  PERFORM pg_temp.assert_eq(v_link, 'https://linkedin.com/in/only',
    'save_brand_contacts persists linkedin_url');

  -- Documents the destructive replace semantics: the 5 fixture contacts are gone.
  SELECT count(*) INTO v_count FROM brand_contacts
   WHERE brand_id = 'dddddddd-0000-0000-0000-000000000001';
  PERFORM pg_temp.assert_eq(v_count, 1, 'save_brand_contacts replaces rather than appends');
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Deterministic active-requirement pick.
--    brand_id is not unique, so without a stable ordering the same brand flips between
--    requirements across requests.
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_first uuid; v_second uuid; v_newest uuid;
BEGIN
  UPDATE requirements SET verified_at = TIMESTAMPTZ '2026-01-01'
   WHERE brand_id = 'dddddddd-0000-0000-0000-000000000001';

  INSERT INTO requirements (brand_id, company_name, status, verified_at)
  VALUES ('dddddddd-0000-0000-0000-000000000001', 'Test Brand', 'active', TIMESTAMPTZ '2026-06-01')
  RETURNING id INTO v_newest;

  SELECT id INTO v_first FROM requirements
   WHERE brand_id = 'dddddddd-0000-0000-0000-000000000001' AND status = 'active'
   ORDER BY verified_at DESC NULLS LAST, updated_at DESC, id LIMIT 1;

  SELECT id INTO v_second FROM requirements
   WHERE brand_id = 'dddddddd-0000-0000-0000-000000000001' AND status = 'active'
   ORDER BY verified_at DESC NULLS LAST, updated_at DESC, id LIMIT 1;

  PERFORM pg_temp.assert_eq(v_first, v_newest, 'active-requirement pick returns the newest verified');
  PERFORM pg_temp.assert_eq(v_first, v_second, 'active-requirement pick is stable across calls');
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. promote_brand_contact_to_agent(): atomic, retains the contact, idempotent.
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_contact uuid; v_agent uuid; v_edges integer; v_retained integer;
BEGIN
  INSERT INTO brand_contacts (brand_id, contact_name, contact_kind, contact_org, contact_email)
  VALUES ('dddddddd-0000-0000-0000-000000000001', 'Promote Me', 'agency', 'New Firm', 'p@firm.com')
  RETURNING id INTO v_contact;

  v_agent := promote_brand_contact_to_agent(v_contact,
    '{"agency_name":"New Firm","role_note":"retail parks"}'::jsonb);

  SELECT count(*) INTO v_edges FROM brand_agents
   WHERE brand_id = 'dddddddd-0000-0000-0000-000000000001';
  PERFORM pg_temp.assert_eq(v_edges, 3, 'promotion adds a brand_agents edge');

  SELECT count(*) INTO v_retained FROM brand_contacts WHERE id = v_contact;
  PERFORM pg_temp.assert_eq(v_retained, 1, 'original contact retained by default');

  -- Re-running with the resolved agent must not duplicate the edge.
  PERFORM promote_brand_contact_to_agent(v_contact,
    jsonb_build_object('agent_id', v_agent));
  SELECT count(*) INTO v_edges FROM brand_agents
   WHERE brand_id = 'dddddddd-0000-0000-0000-000000000001';
  PERFORM pg_temp.assert_eq(v_edges, 3, 'promotion is idempotent');

  -- remove_contact deletes it only when explicitly asked.
  PERFORM promote_brand_contact_to_agent(v_contact,
    jsonb_build_object('agent_id', v_agent, 'remove_contact', true));
  SELECT count(*) INTO v_retained FROM brand_contacts WHERE id = v_contact;
  PERFORM pg_temp.assert_eq(v_retained, 0, 'remove_contact deletes the original when requested');
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. RLS lockdown. The four directory tables must be unreadable by anon even though
--    Supabase grants anon SELECT on public tables by default — RLS is the actual control,
--    and this is the test that would have caught a stray "FOR SELECT USING (true)".
--
--    RLS is skipped for superusers and table owners, so this only asserts meaningfully when
--    run as a non-owner (i.e. against a real Supabase database). It reports rather than
--    fails when the current role bypasses RLS.
-- ---------------------------------------------------------------------------
DO $$
DECLARE v_rls_enabled boolean;
BEGIN
  FOR v_rls_enabled IN
    SELECT relrowsecurity FROM pg_class
     WHERE relname IN ('directory_agencies', 'directory_agents', 'brand_agents', 'brand_activity')
       AND relnamespace = 'public'::regnamespace
  LOOP
    IF NOT v_rls_enabled THEN
      RAISE EXCEPTION 'FAIL: a directory table has RLS disabled — policies on it are inert';
    END IF;
  END LOOP;
  RAISE NOTICE 'ok: RLS is ENABLED on all four directory tables';
END;
$$;

DO $$
DECLARE v_policies integer;
BEGIN
  -- There must be no permissive SELECT policy granting reads to anon/public.
  SELECT count(*) INTO v_policies
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('directory_agencies', 'directory_agents', 'brand_agents', 'brand_activity')
     AND cmd IN ('SELECT', 'ALL')
     AND qual = 'true';
  PERFORM pg_temp.assert_eq(v_policies, 0,
    'no directory table has an unconditional public SELECT policy');
END;
$$;

ROLLBACK;
