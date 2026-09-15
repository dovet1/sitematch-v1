-- Planning Monitor fixtures for migration 20261012000000_planning_monitor.sql.
-- Run against a THROWAWAY local database only (never the remote project):
--   createdb -h /tmp pm_test
--   psql -h /tmp -v ON_ERROR_STOP=1 -f supabase/tests/planning-monitor/stubs.sql pm_test
--   psql -h /tmp -v ON_ERROR_STOP=1 -f supabase/migrations/20261012000000_planning_monitor.sql pm_test
--   psql -h /tmp -v ON_ERROR_STOP=1 -f supabase/migrations/20261013000000_planning_monitor_eligible.sql pm_test
--     (output must be identical with or without 20261013; for the backfill path apply it after this
--      file instead, then run eligible-maintenance.sql)
--   psql -h /tmp -f supabase/tests/planning-monitor/fixtures.sql pm_test
--   dropdb -h /tmp pm_test
-- Each check prints its result next to an `expect:` line.
\set ON_ERROR_STOP 1
-- Leeds-ish square patch with a hole.
\set patch '{"type":"Polygon","coordinates":[[[-1.60,53.78],[-1.50,53.78],[-1.50,53.84],[-1.60,53.84],[-1.60,53.78]],[[-1.56,53.80],[-1.54,53.80],[-1.54,53.82],[-1.56,53.82],[-1.56,53.80]]]}'
INSERT INTO users VALUES ('00000000-0000-0000-0000-00000000000a','a@test'), ('00000000-0000-0000-0000-00000000000b','b@test');
CREATE TEMP TABLE fx (tag text PRIMARY KEY, id uuid);
WITH ins AS (
  INSERT INTO planning_applications (reference, description, stated_dwelling_count, eligibility_limbs, location, location_provenance, date_received, stage, procedure, commercial_work)
  VALUES
   ('R14', '14 homes', 14, '{}', 'SRID=4326;POINT(-1.58 53.79)', 'source_exact', current_date - 3, 'pending', 'full', NULL),
   ('R15', '15 homes', 15, '{}', 'SRID=4326;POINT(-1.58 53.791)', 'source_exact', current_date - 3, 'approved', 'full', NULL),
   ('R50', '50 homes', 50, '{}', 'SRID=4326;POINT(-1.58 53.792)', 'source_exact', current_date - 3, 'pending', 'outline', NULL),
   ('C1', 'New foodstore', NULL, '{A}', 'SRID=4326;POINT(-1.57 53.79)', 'source_exact', current_date - 5, 'pending', 'full', 'new'),
   ('MIX', 'Mixed 20 homes and shop', 20, '{A}', 'SRID=4326;POINT(-1.57 53.791)', 'source_exact', current_date - 5, 'pending', 'full', 'new'),
   ('UNK', 'Residential scheme, count unknown', NULL, '{}', 'SRID=4326;POINT(-1.57 53.792)', 'source_exact', current_date - 5, 'pending', 'full', NULL),
   ('HOLE', '40 homes in the hole', 40, '{}', 'SRID=4326;POINT(-1.55 53.81)', 'source_exact', current_date - 5, 'pending', 'full', NULL),
   ('NEAR', '30 homes centroid just outside', 30, '{}', 'SRID=4326;POINT(-1.49 53.80)', 'source_centroid', current_date - 5, 'pending', 'full', NULL),
   ('FAR', '30 homes exact just outside', 30, '{}', 'SRID=4326;POINT(-1.49 53.801)', 'source_exact', current_date - 5, 'pending', 'full', NULL),
   ('OLD', '100 homes old', 100, '{}', 'SRID=4326;POINT(-1.59 53.83)', 'source_exact', current_date - 200, 'approved', 'full', NULL),
   ('REVIEWED', 'Stated 60 but reviewer set unknown', 60, '{}', 'SRID=4326;POINT(-1.59 53.831)', 'source_exact', current_date - 5, 'pending', 'full', NULL),
   ('PARENT', 'Parent 300 homes', 300, '{}', 'SRID=4326;POINT(-1.52 53.79)', 'source_exact', current_date - 10, 'approved', 'outline', NULL),
   ('RM1', 'Reserved matters 300 homes', 300, '{}', 'SRID=4326;POINT(-1.5201 53.79)', 'source_exact', current_date - 9, 'pending', 'reserved-matters', NULL),
   ('RM2', 'Reserved matters phase 2 300 homes', 300, '{}', 'SRID=4326;POINT(-1.5202 53.79)', 'source_exact', current_date - 8, 'pending', 'reserved-matters', NULL),
   ('D1', 'Discharge of condition 300 homes', 300, '{}', 'SRID=4326;POINT(-1.5203 53.79)', 'source_exact', current_date - 7, 'pending', 'discharge', NULL),
   ('D2', 'Discharge 2 300 homes', 300, '{}', 'SRID=4326;POINT(-1.5204 53.79)', 'source_exact', current_date - 6, 'pending', 'discharge', NULL),
   ('D3', 'Discharge 3 300 homes', 300, '{}', 'SRID=4326;POINT(-1.5205 53.79)', 'source_exact', current_date - 6, 'pending', 'discharge', NULL)
  RETURNING reference, id)
INSERT INTO fx SELECT reference, id FROM ins;
INSERT INTO developments (id, model_dwelling_count, model_dwelling_basis) VALUES ('10000000-0000-0000-0000-000000000001', NULL, 'human_review'), ('10000000-0000-0000-0000-000000000002', 300, 'model');
INSERT INTO development_applications SELECT '10000000-0000-0000-0000-000000000001', id, 'primary' FROM fx WHERE tag='REVIEWED';
INSERT INTO development_applications SELECT '10000000-0000-0000-0000-000000000002', id,
  CASE tag WHEN 'PARENT' THEN 'principal' WHEN 'RM1' THEN 'member' WHEN 'RM2' THEN 'member' ELSE 'condition' END FROM fx WHERE tag IN ('PARENT','RM1','RM2','D1','D2','D3');

\echo '--- base, patch, 30d, applications'
SELECT string_agg(a.reference, ',' ORDER BY a.reference) AS matched
FROM planning_monitor_rows(jsonb_build_object('residential',true,'min_dwellings',15,'commercial',true,'date_field','received','date_from',(current_date-30)::text,'boundary',:'patch'::jsonb), 'applications', NULL, NULL, 200) r
JOIN planning_applications a ON a.id = r.id;
\echo 'expect: C1,D1,D2,D3,MIX,NEAR,PARENT,R15,R50,RM1,RM2   (not R14, UNK, HOLE, FAR, OLD, REVIEWED)'

\echo '--- counts (applications, developments, confirmed, possible)'
SELECT applications, developments, confirmed_applications, possible_applications, residential_applications, commercial_applications
FROM planning_monitor_count(jsonb_build_object('residential',true,'min_dwellings',15,'commercial',true,'date_field','received','date_from',(current_date-30)::text,'boundary',:'patch'::jsonb));
\echo 'expect: 11 apps, 6 developments (C1,MIX,NEAR,R15,R50 + family), 10 confirmed, 1 possible'

\echo '--- developments grouping: family once, represented by PARENT'
SELECT a.reference, r.matched_applications, r.dwellings, r.inside FROM planning_monitor_rows(jsonb_build_object('residential',true,'min_dwellings',15,'commercial',true,'date_from',(current_date-30)::text,'boundary',:'patch'::jsonb), 'developments', NULL, NULL, 50) r JOIN planning_applications a ON a.id=r.id ORDER BY a.reference;

\echo '--- commercial only: 15+ threshold must not exclude commercial'
SELECT string_agg(a.reference, ',' ORDER BY a.reference) FROM planning_monitor_rows(jsonb_build_object('residential',false,'commercial',true,'boundary',:'patch'::jsonb), 'applications', NULL, NULL, 200) r JOIN planning_applications a ON a.id=r.id;
\echo 'expect: C1,MIX'
\echo '--- residential min 50'
SELECT string_agg(a.reference, ',' ORDER BY a.reference) FROM planning_monitor_rows(jsonb_build_object('residential',true,'min_dwellings',50,'commercial',false,'boundary',:'patch'::jsonb), 'applications', NULL, NULL, 200) r JOIN planning_applications a ON a.id=r.id;
\echo 'expect: D1,D2,D3,OLD,PARENT,R50,RM1,RM2'
\echo '--- min_dwellings below 15 is clamped'
SELECT count(*) FROM planning_monitor_rows(jsonb_build_object('residential',true,'min_dwellings',1,'commercial',false,'boundary',:'patch'::jsonb,'include',jsonb_build_array('%14 homes%')), 'applications', NULL, NULL, 200);
\echo 'expect: 0'
\echo '--- no branch = nothing'
SELECT count(*) FROM planning_monitor_rows('{}'::jsonb, 'applications', NULL, NULL, 200);
\echo '--- All UK (no boundary) sees FAR but still not R14/UNK'
SELECT string_agg(a.reference, ',' ORDER BY a.reference) FROM planning_monitor_rows(jsonb_build_object('residential',true,'commercial',true,'date_from',(current_date-30)::text), 'applications', NULL, NULL, 200) r JOIN planning_applications a ON a.id=r.id;
\echo '--- stages, procedures, keywords, exact_only'
SELECT string_agg(a.reference, ',' ORDER BY a.reference) FROM planning_monitor_rows(jsonb_build_object('residential',true,'commercial',true,'stages',jsonb_build_array('approved'),'boundary',:'patch'::jsonb), 'applications', NULL, NULL, 200) r JOIN planning_applications a ON a.id=r.id;
\echo 'expect: OLD,PARENT,R15'
SELECT string_agg(a.reference, ',' ORDER BY a.reference) FROM planning_monitor_rows(jsonb_build_object('residential',true,'commercial',true,'procedures',jsonb_build_array('discharge','amendment'),'exclude',jsonb_build_array('%discharge 3%')), 'applications', NULL, NULL, 200) r JOIN planning_applications a ON a.id=r.id;
\echo 'expect: D1,D2'
SELECT count(*) FILTER (WHERE location_provenance <> 'source_exact') FROM planning_monitor_rows(jsonb_build_object('residential',true,'commercial',true,'exact_only',true), 'applications', NULL, NULL, 200);
\echo 'expect: 0'

\echo '--- proximity: store near C1 only, 300 m'
INSERT INTO brands VALUES ('20000000-0000-0000-0000-000000000001','Aldi');
INSERT INTO stores (brand_id, location) VALUES ('20000000-0000-0000-0000-000000000001','SRID=4326;POINT(-1.5702 53.7902)');
SELECT string_agg(a.reference || ':' || r.near_confirmed, ',' ORDER BY a.reference) FROM planning_monitor_rows(jsonb_build_object('residential',true,'commercial',true,'brand_ids',jsonb_build_array('20000000-0000-0000-0000-000000000001'),'radius_m',300), 'applications', NULL, NULL, 200) r JOIN planning_applications a ON a.id=r.id;
\echo 'expect: C1:true,MIX:true (UNK is near but ineligible)'
\echo '--- no-estate brand -> nothing'
SELECT count(*) FROM planning_monitor_rows(jsonb_build_object('residential',true,'commercial',true,'brand_ids',jsonb_build_array('20000000-0000-0000-0000-000000000009'),'radius_m',300), 'applications', NULL, NULL, 200);

\echo '--- watched only: watching RM1 admits the whole family'
SELECT count(*) FROM planning_monitor_rows(jsonb_build_object('residential',true,'commercial',true,'watched_application_ids',(SELECT jsonb_build_array(id) FROM fx WHERE tag='RM1')), 'applications', NULL, NULL, 200);
\echo 'expect: 6'
SELECT count(*) FROM planning_monitor_rows(jsonb_build_object('residential',true,'commercial',true,'watched_application_ids','[]'::jsonb), 'applications', NULL, NULL, 200);
\echo 'expect: 0'

\echo '--- more than 2,000 matches: count and pagination beyond the old cap'
INSERT INTO planning_applications (reference, description, stated_dwelling_count, location, date_received)
SELECT 'BULK' || g, 'bulk', 20, ST_SetSRID(ST_MakePoint(-2.0 + (g % 100) * 0.001, 52.0 + (g / 100) * 0.001), 4326)::geography, current_date - (g % 25)
FROM generate_series(1, 2500) g;
SELECT applications FROM planning_monitor_count(jsonb_build_object('residential',true,'commercial',false,'include',jsonb_build_array('%bulk%')));
DO $$
DECLARE d date; k text; n int := 0; got int;
BEGIN
  CREATE TEMP TABLE pages (row_key text, sort_date date, id uuid);
  LOOP
    DELETE FROM pages;
    INSERT INTO pages SELECT x.row_key, x.sort_date, x.id FROM planning_monitor_rows('{"residential":true,"include":["%bulk%"]}', 'applications', d, k, 200) x;
    GET DIAGNOSTICS got = ROW_COUNT;
    EXIT WHEN got = 0;
    n := n + got;
    SELECT p.sort_date, p.row_key INTO d, k FROM pages p ORDER BY p.sort_date ASC, p.row_key ASC LIMIT 1;
  END LOOP;
  RAISE NOTICE 'paged total = % (expect 2500)', n;
END $$;

\echo '--- clusters: national zoom few cells, local zoom singles'
SELECT count(*) AS cells, sum(count) AS units FROM planning_monitor_clusters('{"residential":true,"commercial":true}', 5, 'developments');
SELECT count(*) AS cells, count(single_id) AS singles FROM planning_monitor_clusters(jsonb_build_object('residential',true,'commercial',true,'bbox',jsonb_build_array(-1.61,53.77,-1.48,53.85)), 17, 'developments');

\echo '--- change events'
SELECT kind, count(*) FROM planning_change_events GROUP BY 1 ORDER BY 1;
UPDATE planning_applications SET status = status WHERE reference = 'R15';
UPDATE planning_applications SET stage = 'approved', date_decided = current_date, source_changed_at = '2026-09-14' WHERE reference = 'R50';
SELECT kind, before, after FROM planning_change_events WHERE planning_application_id = (SELECT id FROM fx WHERE tag='R50') AND kind <> 'observed' ORDER BY kind;
-- replay the identical transition
SELECT planning_record_change_event((SELECT id FROM fx WHERE tag='R50'), NULL, 'stage_changed', '{"stage":"pending"}', '{"stage":"approved"}', '2026-09-14');
SELECT count(*) AS stage_events_after_replay FROM planning_change_events WHERE kind='stage_changed';
UPDATE developments SET model_dwelling_count = 280, model_dwelling_basis = 'human_review' WHERE id = '10000000-0000-0000-0000-000000000002';
SELECT kind, after FROM planning_change_events WHERE development_id IS NOT NULL;

\echo '--- save patch, revision, subscription, monthly POC disabled'
INSERT INTO planning_alert_subscriptions (user_id, enabled) VALUES ('00000000-0000-0000-0000-00000000000a', true);
SELECT patch_id IS NOT NULL, revision, created FROM planning_monitor_save_patch('00000000-0000-0000-0000-00000000000a', NULL, NULL, 'Leeds', :'patch'::jsonb, :'patch'::jsonb, 'drawn', NULL, '{}', '{"version":1}', 1, 'h1', 1, false, false);
SELECT enabled AS poc_still_enabled FROM planning_alert_subscriptions;
SELECT revision, created FROM planning_monitor_save_patch('00000000-0000-0000-0000-00000000000a', (SELECT id FROM planning_monitor_patches LIMIT 1), 1, 'Leeds 2', :'patch'::jsonb, :'patch'::jsonb, 'drawn', NULL, '{}', '{"version":1}', 1, 'h2', 1, true, false);
SELECT enabled AS poc_enabled_after_weekly FROM planning_alert_subscriptions;
\echo '--- stale expected revision is refused'
DO $$ BEGIN
  PERFORM planning_monitor_save_patch('00000000-0000-0000-0000-00000000000a', (SELECT id FROM planning_monitor_patches LIMIT 1), 1, 'stale', '{"type":"Polygon","coordinates":[[[-1.6,53.78],[-1.5,53.78],[-1.5,53.84],[-1.6,53.78]]]}', '{}', 'drawn', NULL, '{}', '{}', 1, 'h', 1, false, false);
  RAISE NOTICE 'FAIL: stale save accepted';
EXCEPTION WHEN serialization_failure THEN RAISE NOTICE 'ok: stale save refused';
END $$;
\echo '--- other owner cannot save to this patch'
DO $$ BEGIN
  PERFORM planning_monitor_save_patch('00000000-0000-0000-0000-00000000000b', (SELECT id FROM planning_monitor_patches LIMIT 1), NULL, 'x', '{"type":"Polygon","coordinates":[[[-1.6,53.78],[-1.5,53.78],[-1.5,53.84],[-1.6,53.78]]]}', '{}', 'drawn', NULL, '{}', '{}', 1, 'h', 1, false, false);
  RAISE NOTICE 'FAIL: cross-owner save accepted';
EXCEPTION WHEN no_data_found THEN RAISE NOTICE 'ok: cross-owner save refused';
END $$;
\echo '--- invalid bow tie refused'
DO $$ BEGIN
  PERFORM planning_monitor_save_patch('00000000-0000-0000-0000-00000000000a', NULL, NULL, 'bow', '{"type":"Polygon","coordinates":[[[-1.6,53.78],[-1.5,53.88],[-1.5,53.78],[-1.6,53.88],[-1.6,53.78]]]}', '{}', 'drawn', NULL, '{}', '{}', 1, 'h', 1, false, false);
  RAISE NOTICE 'FAIL: invalid accepted';
EXCEPTION WHEN invalid_parameter_value THEN RAISE NOTICE 'ok: %', SQLERRM;
END $$;

\echo '--- weekly due (DST) matches TS fixtures'
SELECT planning_monitor_next_weekly_due('2026-09-15T10:00:00Z') AT TIME ZONE 'UTC' AS summer,
       planning_monitor_next_weekly_due('2026-11-04T10:00:00Z') AT TIME ZONE 'UTC' AS winter,
       planning_monitor_next_weekly_due('2026-10-20T12:00:00Z') AT TIME ZONE 'UTC' AS autumn_change,
       planning_monitor_next_weekly_due('2026-09-21T07:00:00Z') AT TIME ZONE 'UTC' AS at_send,
       planning_monitor_next_weekly_due('2026-09-20T23:30:00Z') AT TIME ZONE 'UTC' AS sunday_late;
\echo 'expect: 2026-09-21 07:00, 2026-11-09 08:00, 2026-10-26 08:00, 2026-09-28 07:00, 2026-09-21 07:00'

\echo '--- enqueue is once per period even when run twice'
UPDATE planning_monitor_subscriptions SET next_due_at = '2026-10-26T08:00:00Z';
SELECT planning_monitor_enqueue_due('2026-10-26T08:05:00Z');
UPDATE planning_monitor_subscriptions SET next_due_at = '2026-10-26T08:00:00Z';
SELECT planning_monitor_enqueue_due('2026-10-26T08:06:00Z');
SELECT kind, period_start AT TIME ZONE 'UTC', period_end AT TIME ZONE 'UTC', period_label FROM planning_monitor_digest_runs;
SELECT next_due_at AT TIME ZONE 'UTC' FROM planning_monitor_subscriptions;
\echo 'expect one run 2026-10-18 23:00 -> 2026-10-26 00:00, next due 2026-11-02 08:00'
SELECT (planning_monitor_claim_run('w1')).status;
SELECT count(*) AS second_claim FROM planning_monitor_claim_run('w2');
