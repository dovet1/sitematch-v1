-- Fixtures for 20261018000000_postcode_centre_locations_strict_areas.sql.
-- Throwaway database only. Order: stubs.sql, strict-areas-stubs.sql, migrations 20261012-20261017,
-- fixtures.sql, 20261018, then this file.
\set ON_ERROR_STOP 1
\set patch '{"type":"Polygon","coordinates":[[[-1.60,53.78],[-1.50,53.78],[-1.50,53.84],[-1.60,53.84],[-1.60,53.78]],[[-1.56,53.80],[-1.54,53.80],[-1.54,53.82],[-1.56,53.82],[-1.56,53.80]]]}'

\echo '--- a centroid point outside the patch is no longer matched'
SELECT string_agg(a.reference, ',' ORDER BY a.reference) AS matched, bool_and(r.inside) AS all_inside
FROM planning_monitor_rows(jsonb_build_object('residential',true,'min_dwellings',15,'commercial',true,'date_field','received','date_from',(current_date-30)::text,'boundary',:'patch'::jsonb), 'applications', NULL, NULL, 200) r
JOIN planning_applications a ON a.id = r.id;
\echo 'expect: C1,D1,D2,D3,MIX,PARENT,R15,R50,RM1,RM2, all_inside t'

\echo '--- counts: nothing is possible any more'
SELECT applications, possible_applications FROM planning_monitor_count(jsonb_build_object('residential',true,'min_dwellings',15,'commercial',true,'date_field','received','date_from',(current_date-30)::text,'boundary',:'patch'::jsonb));
\echo 'expect: 10, 0'

\echo '--- planning tab: only points inside the drawn area'
SELECT string_agg(reference, ',' ORDER BY reference) AS matched, bool_and(inside_boundary) AS all_inside
FROM planning_tab_applications_v4(:'patch'::jsonb, 100);
\echo 'expect: C1,D1,D2,D3,MIX,OLD,PARENT,R15,R50,RM1,RM2 (no date filter here; FAR and NEAR absent), all_inside t'

\echo '--- brand radius: a store 1,000 m from the centroid record NEAR does not match a 500 m radius'
INSERT INTO brands VALUES ('20000000-0000-0000-0000-000000000009','Test') ON CONFLICT DO NOTHING;
INSERT INTO stores (brand_id, location) VALUES ('20000000-0000-0000-0000-000000000009', ST_Project('SRID=4326;POINT(-1.49 53.80)'::geography, 1000, radians(0)));
SELECT (SELECT count(*) FROM planning_monitor_rows(jsonb_build_object('residential',true,'commercial',true,'brand_ids',jsonb_build_array('20000000-0000-0000-0000-000000000009'),'radius_m',500), 'applications', NULL, NULL, 200)) AS national_500,
       (SELECT string_agg(a.reference, ',') FROM planning_monitor_rows(jsonb_build_object('residential',true,'commercial',true,'brand_ids',jsonb_build_array('20000000-0000-0000-0000-000000000009'),'radius_m',1100), 'applications', NULL, NULL, 200) r JOIN planning_applications a ON a.id = r.id) AS national_1100,
       (SELECT bool_and(near_confirmed) FROM planning_monitor_rows(jsonb_build_object('residential',true,'commercial',true,'brand_ids',jsonb_build_array('20000000-0000-0000-0000-000000000009'),'radius_m',1100), 'applications', NULL, NULL, 200)) AS near_flag;
\echo 'expect: 0, FAR,NEAR (FAR is ~110 m further; both within 1,100 m), t'

\echo '--- provenance on write'
INSERT INTO uk_postcode_centroids (postcode, latitude, longitude, is_live) VALUES ('TN23 1EW', 51.150561, 0.854402, true), ('LS1 1AA', 53.80, -1.55, false);
CREATE TRIGGER planning_application_set_location
BEFORE INSERT OR UPDATE OF location, postcode, location_precision ON public.planning_applications
FOR EACH ROW EXECUTE FUNCTION public.planning_application_location_fallback();
INSERT INTO planning_applications (reference, postcode, location, location_precision) VALUES
  ('PC_ON', 'tn231ew', 'SRID=4326;POINT(0.854402 51.150561)', 'centroid'),
  ('PC_NULLPREC', 'TN23 1EW', 'SRID=4326;POINT(0.85441 51.150565)', NULL),
  ('PC_OFF', 'TN23 1EW', 'SRID=4326;POINT(0.86 51.16)', 'centroid'),
  ('ROOF', 'TN23 1EW', 'SRID=4326;POINT(0.854402 51.150561)', 'rooftop'),
  ('NEWWORD', 'TN23 1EW', 'SRID=4326;POINT(0.87 51.15)', 'anchor'),
  ('TERMINATED', 'LS1 1AA', 'SRID=4326;POINT(-1.55 53.80)', 'centroid'),
  ('FALLBACK', 'TN23 1EW', NULL, NULL),
  ('FALLBACK_DEAD', 'LS1 1AA', NULL, NULL),
  ('NOTHING', NULL, NULL, NULL);
SELECT reference, location_provenance FROM planning_applications WHERE reference IN
  ('PC_ON','PC_NULLPREC','PC_OFF','ROOF','NEWWORD','TERMINATED','FALLBACK','FALLBACK_DEAD','NOTHING') ORDER BY reference;
\echo 'expect: FALLBACK postcode_centroid, FALLBACK_DEAD missing, NEWWORD source_centroid, NOTHING missing,'
\echo '        PC_NULLPREC postcode_centroid, PC_OFF source_centroid, PC_ON postcode_centroid, ROOF source_exact,'
\echo '        TERMINATED postcode_centroid'

\echo '--- a precision-only update re-derives the same label'
UPDATE planning_applications SET location_precision = 'borrowed_from_family_member' WHERE reference = 'PC_ON';
SELECT location_provenance FROM planning_applications WHERE reference = 'PC_ON';
\echo 'expect: postcode_centroid'

\echo '--- relabel between centre kinds is not a location change; a real move still is'
DELETE FROM planning_change_events;
UPDATE planning_applications SET location_provenance = 'source_centroid' WHERE reference = 'PC_ON';
UPDATE planning_applications SET location_provenance = 'source_exact' WHERE reference = 'PC_OFF';
UPDATE planning_applications SET location = 'SRID=4326;POINT(0.80 51.15)' WHERE reference = 'NEWWORD';
SELECT a.reference, e.kind FROM planning_change_events e JOIN planning_applications a ON a.id = e.planning_application_id ORDER BY a.reference;
\echo 'expect: NEWWORD location_changed, PC_OFF location_changed (PC_ON absent)'

\echo '--- rank order'
SELECT location_provenance_rank('source_exact') > location_provenance_rank('postcode_centroid')
   AND location_provenance_rank('postcode_centroid') > location_provenance_rank('source_centroid')
   AND location_provenance_rank('source_centroid') > location_provenance_rank('missing') AS ordered;
\echo 'expect: t'
