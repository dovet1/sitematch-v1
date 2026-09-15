-- Fixtures for 20261014000000_planning_monitor_review_fixes.sql.
-- Run after fixtures.sql and the 20261014 migration, on the same THROWAWAY database:
--   psql -h /tmp -v ON_ERROR_STOP=1 -f supabase/migrations/20261014000000_planning_monitor_review_fixes.sql pm_test
--   psql -h /tmp -f supabase/tests/planning-monitor/review-fixes.sql pm_test
-- fixtures.sql leaves one scheduled run claimed by worker w1.
\set ON_ERROR_STOP 1

\echo '--- weekly reports are scheduled with email off'
UPDATE planning_monitor_subscriptions SET email_enabled = false, unsubscribed_at = now(), next_due_at = '2026-11-02T08:00:00Z';
SELECT planning_monitor_enqueue_due('2026-11-02T08:05:00Z') AS enqueued_without_email;
\echo 'expect: 1'
UPDATE planning_monitor_subscriptions SET email_enabled = true, unsubscribed_at = NULL;

\echo '--- finish refuses a run whose lease another worker holds, and writes nothing'
SELECT planning_monitor_finish_run(
  (SELECT id FROM planning_monitor_digest_runs WHERE status = 'running'), 'w2',
  '{"report":{},"input_snapshot":{},"summary_kind":"no_changes","coverage":{},"source_cutoff":"2026-10-26T08:00:00Z","model":null,"prompt_version":null,"usage":null,"latency_ms":5}',
  jsonb_build_object('subscription_id', (SELECT id FROM planning_monitor_subscriptions), 'user_id', '00000000-0000-0000-0000-00000000000a', 'email', 'a@test', 'delivery_key', 'pm-stolen')
) AS finished_by_wrong_worker;
SELECT count(*) AS deliveries_after_refusal FROM planning_monitor_deliveries;
\echo 'expect: false, 0'

\echo '--- finish saves the report and its delivery together'
SELECT planning_monitor_finish_run(
  (SELECT id FROM planning_monitor_digest_runs WHERE status = 'running'), 'w1',
  '{"report":{"revision":2},"input_snapshot":{},"summary_kind":"no_changes","coverage":{},"source_cutoff":"2026-10-26T08:00:00Z","model":null,"prompt_version":null,"usage":null,"latency_ms":5}',
  jsonb_build_object('subscription_id', (SELECT id FROM planning_monitor_subscriptions), 'user_id', '00000000-0000-0000-0000-00000000000a', 'email', 'a@test', 'delivery_key', 'pm-one')
) AS finished;
SELECT r.status, r.lease_owner IS NULL AS lease_cleared, r.usage IS NULL AS usage_null, d.state, d.delivery_key
FROM planning_monitor_digest_runs r JOIN planning_monitor_deliveries d ON d.run_id = r.id;
\echo 'expect: true; generated, t, t, pending, pm-one'

\echo '--- finishing again is refused and creates no second delivery'
SELECT planning_monitor_finish_run(
  (SELECT run_id FROM planning_monitor_deliveries), 'w1', '{"report":{}}',
  jsonb_build_object('subscription_id', (SELECT id FROM planning_monitor_subscriptions), 'user_id', '00000000-0000-0000-0000-00000000000a', 'email', 'a@test', 'delivery_key', 'pm-two')
) AS finished_twice;
SELECT count(*) AS deliveries FROM planning_monitor_deliveries;
\echo 'expect: false, 1'

\echo '--- a retried ambiguous delivery is leased: a second worker cannot claim it'
UPDATE planning_monitor_deliveries SET state = 'ambiguous', attempts = 1, next_attempt_at = now() - interval '1 minute', lease_expires_at = NULL;
SELECT state, attempts, lease_expires_at > now() AS leased FROM planning_monitor_claim_delivery();
SELECT count(*) AS second_claim FROM planning_monitor_claim_delivery();
\echo 'expect: sending, 2, t; 0'

\echo '--- once the lease expires the retry is reclaimable'
UPDATE planning_monitor_deliveries SET lease_expires_at = now() - interval '1 second';
SELECT state, attempts FROM planning_monitor_claim_delivery();
\echo 'expect: sending, 3'
