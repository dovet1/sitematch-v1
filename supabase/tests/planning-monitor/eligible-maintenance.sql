-- Planning Monitor eligible-table maintenance check (migration 20261013000000).
-- Run on a THROWAWAY database after stubs.sql, 20261012, fixtures.sql and then 20261013 (which
-- exercises the backfill). Every step must report drift 0: the table equals a full recompute of the
-- eligibility rule after each kind of change.
CREATE OR REPLACE FUNCTION pg_temp.drift() RETURNS bigint LANGUAGE sql AS $$
  WITH truth AS (
    SELECT a.id,
      CASE WHEN d.model_dwelling_basis = 'human_review' THEN d.model_dwelling_count ELSE COALESCE(a.stated_dwelling_count, d.model_dwelling_count) END AS dwellings,
      (a.eligibility_limbs && ARRAY['A','A-described','D','D-described']::text[] OR COALESCE(d.creates_commercial_space = 'yes', false)) AS is_commercial,
      da.development_id, a.stage, a.date_decided, d.family_state
    FROM planning_applications a
    LEFT JOIN development_applications da ON da.planning_application_id = a.id
    LEFT JOIN developments d ON d.id = da.development_id AND d.review_state <> 'rejected'
    WHERE a.location IS NOT NULL
  ), t AS (SELECT * FROM truth WHERE is_commercial OR dwellings >= 15)
  SELECT count(*) FROM (
    (SELECT id, dwellings, is_commercial, development_id, stage, date_decided, family_state FROM t
     EXCEPT SELECT application_id, dwellings, is_commercial, development_id, stage, date_decided, family_state FROM planning_monitor_eligible)
    UNION ALL
    (SELECT application_id, dwellings, is_commercial, development_id, stage, date_decided, family_state FROM planning_monitor_eligible
     EXCEPT SELECT id, dwellings, is_commercial, development_id, stage, date_decided, family_state FROM t)
  ) x
$$;
SELECT 'after backfill' AS step, count(*) AS rows, pg_temp.drift() AS drift FROM planning_monitor_eligible;
-- reviewer corrects the 300-home family to unknown: all six members must drop out
UPDATE developments SET model_dwelling_count = NULL, model_dwelling_basis = 'human_review' WHERE id = '10000000-0000-0000-0000-000000000002';
SELECT 'family reviewed to unknown (still stated 300 on apps? no: human review wins)' AS step, count(*), pg_temp.drift() FROM planning_monitor_eligible;
-- R14 gains a stated count of 16; UNK becomes commercial by limb; FAR loses its location
UPDATE planning_applications SET stated_dwelling_count = 16 WHERE reference = 'R14';
UPDATE planning_applications SET eligibility_limbs = '{A}' WHERE reference = 'UNK';
UPDATE planning_applications SET stage = 'approved', date_decided = current_date WHERE reference = 'C1';
SELECT 'app edits' AS step, count(*), pg_temp.drift() FROM planning_monitor_eligible;
-- membership removed from the family for RM1; development rejected for REVIEWED; family_state changes
DELETE FROM development_applications WHERE planning_application_id = (SELECT id FROM planning_applications WHERE reference = 'RM1');
UPDATE developments SET review_state = 'rejected' WHERE id = '10000000-0000-0000-0000-000000000001';
UPDATE developments SET family_state = 'awaiting_original' WHERE id = '10000000-0000-0000-0000-000000000002';
SELECT 'membership + review + family state' AS step, count(*), pg_temp.drift() FROM planning_monitor_eligible;
-- a new application and a deletion
INSERT INTO planning_applications (reference, description, stated_dwelling_count, location, date_received) VALUES ('NEW', 'new 40 homes', 40, 'SRID=4326;POINT(-1.58 53.80)', current_date);
DELETE FROM planning_applications WHERE reference = 'R15';
SELECT 'insert + delete' AS step, count(*), pg_temp.drift() FROM planning_monitor_eligible;
SELECT reference, e.dwellings, e.is_commercial, e.stage FROM planning_monitor_eligible e JOIN planning_applications a ON a.id = e.application_id WHERE reference IN ('R14','UNK','C1','NEW','R15','REVIEWED','RM1','PARENT') ORDER BY 1;
