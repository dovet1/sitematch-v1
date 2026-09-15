-- Fixtures for 20261015000000_planning_monitor_national_proximity.sql.
-- Run after fixtures.sql and the 20261015 migration on the same THROWAWAY database:
--   psql -h /tmp -f supabase/tests/planning-monitor/national-proximity.sql pm_test
-- The national (no boundary) path must return exactly what the per-record probe returns.
\set ON_ERROR_STOP 1
-- Stores around the fixture records, including one just beyond an exact record's radius and one
-- that reaches a centroid record only through its 1,500 m allowance.
INSERT INTO brands VALUES ('20000000-0000-0000-0000-000000000002','Lidl') ON CONFLICT DO NOTHING;
INSERT INTO stores (brand_id, location) VALUES
  ('20000000-0000-0000-0000-000000000002','SRID=4326;POINT(-1.58 53.7945)'),
  ('20000000-0000-0000-0000-000000000002','SRID=4326;POINT(-1.4700 53.8000)'),
  ('20000000-0000-0000-0000-000000000002','SRID=4326;POINT(-1.5900 53.8500)');

CREATE TEMP TABLE prox_case AS
SELECT r AS radius_m, b AS brands FROM (VALUES (300), (1000), (2500), (4828)) v(r)
CROSS JOIN (VALUES
  (jsonb_build_array('20000000-0000-0000-0000-000000000001')),
  (jsonb_build_array('20000000-0000-0000-0000-000000000002')),
  (jsonb_build_array('20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002'))
) w(b);

\echo '--- national path equals the per-record probe (filter and near_confirmed), every case'
SELECT count(*) AS cases,
       count(*) FILTER (WHERE national IS DISTINCT FROM probe) AS mismatches,
       sum(jsonb_array_length(national)) AS matched_rows
FROM (
  SELECT c.radius_m, c.brands,
    (SELECT COALESCE(jsonb_agg(jsonb_build_array(r.id, r.near_confirmed) ORDER BY r.id), '[]') FROM planning_monitor_rows(
       jsonb_build_object('residential',true,'commercial',true,'brand_ids',c.brands,'radius_m',c.radius_m), 'applications', NULL, NULL, 200) r) AS national,
    (SELECT COALESCE(jsonb_agg(jsonb_build_array(m.id, m.near) ORDER BY m.id), '[]') FROM (
       SELECT e.application_id AS id,
         EXISTS (SELECT 1 FROM stores s WHERE s.brand_id = ANY (ARRAY(SELECT jsonb_array_elements_text(c.brands))::uuid[]) AND ST_DWithin(s.location, e.location, c.radius_m)) AS near
       FROM planning_monitor_eligible e
       WHERE EXISTS (SELECT 1 FROM stores s WHERE s.brand_id = ANY (ARRAY(SELECT jsonb_array_elements_text(c.brands))::uuid[])
                     AND ST_DWithin(s.location, e.location, c.radius_m + planning_location_uncertainty_m(e.location_provenance)))
     ) m) AS probe
  FROM prox_case c
) t;
\echo 'expect: 12 cases, 0 mismatches, matched_rows > 0'

\echo '--- a viewport box limits stores without changing what is inside it'
SELECT count(*) FILTER (WHERE boxed IS DISTINCT FROM unboxed) AS bbox_mismatches FROM (
  SELECT c.radius_m,
    (SELECT COALESCE(jsonb_agg(r.id ORDER BY r.id), '[]') FROM planning_monitor_rows(
       jsonb_build_object('residential',true,'commercial',true,'brand_ids',c.brands,'radius_m',c.radius_m,'bbox',jsonb_build_array(-1.60,53.78,-1.48,53.84)), 'applications', NULL, NULL, 200) r) AS boxed,
    (SELECT COALESCE(jsonb_agg(r.id ORDER BY r.id), '[]') FROM planning_monitor_rows(
       jsonb_build_object('residential',true,'commercial',true,'brand_ids',c.brands,'radius_m',c.radius_m), 'applications', NULL, NULL, 200) r
       JOIN planning_monitor_eligible e ON e.application_id = r.id AND e.geom && ST_MakeEnvelope(-1.60,53.78,-1.48,53.84,4326)) AS unboxed
  FROM prox_case c
) t;
\echo 'expect: 0'

\echo '--- inside a boundary the per-record probe is still used'
SELECT position('e.application_id IN (SELECT n.application_id' IN planning_monitor_match_sql(jsonb_build_object(
  'residential',true,'commercial',true,'brand_ids',jsonb_build_array('20000000-0000-0000-0000-000000000002'),'radius_m',300,
  'boundary','{"type":"Polygon","coordinates":[[[-1.6,53.78],[-1.5,53.78],[-1.5,53.84],[-1.6,53.84],[-1.6,53.78]]]}'::jsonb))) = 0 AS boundary_uses_probe;
\echo 'expect: t'
