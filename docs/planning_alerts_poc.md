# Monthly planning alerts — proof of concept

## What is included

- A public, signed-link report at `/planning-alerts/[token]?month=YYYY-MM`.
- An authenticated report at `/planning-alerts` that opens the current user's enabled subscription directly. Admins can preview and switch between every enabled subscription.
- A no-setup visual demo at `/planning-alerts/demo`.
- A browser-viewable render of the exact email at `/planning-alerts/demo/email`.
- The brand's store estate, exact patch boundary, 5 km store buffers and both application groups on one Mapbox map.
- A PlanNexus adapter that queries the previous complete calendar month.
- A responsive HTML/text email with a link to the full report.
- An idempotent monthly cron at 08:00 UTC on the first of the month.
- An immutable monthly digest snapshot. `summary` is nullable and deliberately reserved for the later LLM step.

## Patch model

Each alert subscription stores two related but deliberately separate values:

1. `patch_geojson`: an exact GeoJSON `Polygon` or `MultiPolygon`. This is the source of truth for the map and final point-in-polygon test.
2. `plannexus_postcode_prefixes`: outward postcode prefixes used only to limit upstream PlanNexus searches.

The prefix set must cover the patch **and** every 5 km buffer around a brand store located inside that patch. Stores outside the user's patch do not belong to that alert's estate. A result returned by a coarse prefix is not automatically included. The server deduplicates the PlanNexus response and applies the exact rules in this order:

1. Within the configured radius of any patch-scoped estate store → “Near estate”.
2. Otherwise inside the exact patch polygon → “Elsewhere in patch”.
3. Otherwise discard.

This ordering makes the two email sections mutually exclusive.

In manual mode an operator supplies the prefixes when creating the subscription. Production mode derives them from quarterly ONS Postcode Directory coordinates. PostGIS selects every outward code represented inside the patch or a buffered store radius, with a 2 km safety margin at edges. This is deliberately a permissive upstream envelope: the exact geometry rules above remove false positives after PlanNexus returns the applications. PlanNexus currently documents postcode-prefix and received-date filters on `GET /v1/applications`; its standard search endpoint does not document an arbitrary polygon filter.

## Environment

```text
PLANNEXUS_API_KEY=pn_live_...
PLANNING_ALERT_SIGNING_SECRET=use-a-long-random-secret
PLANNING_ALERT_DATA_SOURCE=plannexus
PLANNING_ALERT_POSTCODE_SOURCE=onspd
NEXT_PUBLIC_SITE_URL=https://your-app.example
NEXT_PUBLIC_MAPBOX_TOKEN=...
CRON_SECRET=...
RESEND_API_KEY=...
```

Set `PLANNING_ALERT_DATA_SOURCE=mock` to exercise configured subscriptions without calling PlanNexus. The standalone `/planning-alerts/demo` route always uses safe demo data.

## Import UK postcode coverage

Apply `supabase/migrations/20260722130000_planning_alert_postcode_coverage.sql`, then download the latest ONS Postcode Directory from the Office for National Statistics and extract it. Import the large UK CSV from its `Data/CSV` directory:

```text
cd apps/web
npm run import:onspd -- /absolute/path/to/ONSPD_..._UK.csv 2026-05
```

Set `PLANNING_ALERT_POSTCODE_SOURCE=onspd` after the import. Before generating each previously unseen live monthly report, the server rebuilds `plannexus_postcode_prefixes` from the current patch, radius and brand stores. Repeat the import when ONS publishes a new quarterly release.

For installations created before the outward-code optimisation was added, also apply `supabase/migrations/20260722140000_optimise_planning_alert_postcode_coverage.sql`. It creates roughly 3,000 compact coverage envelopes from the imported postcode points so web requests do not scan all 1.8 million live postcodes.

To preview or refresh one subscription directly in Supabase:

```sql
select public.refresh_planning_alert_postcode_prefixes('SUBSCRIPTION_UUID');

select patch_name, plannexus_postcode_prefixes, postcode_prefixes_updated_at
from public.planning_alert_subscriptions
where id = 'SUBSCRIPTION_UUID';
```

## Set up one user

First apply `supabase/migrations/20260722000000_planning_alerts_poc.sql`. The user and brand must already exist. Then insert one subscription using IDs from `users` and `brands`:

```sql
insert into public.planning_alert_subscriptions (
  user_id,
  brand_id,
  patch_name,
  patch_geojson,
  plannexus_postcode_prefixes
) values (
  'USER_UUID',
  'BRAND_UUID',
  'Greater Manchester growth patch',
  '{"type":"Polygon","coordinates":[[[-2.52,53.30],[-1.93,53.30],[-1.93,53.64],[-2.52,53.64],[-2.52,53.30]]]}',
  array['M1','M2','M3','M4','M8','M17','M28','M35','M41','M43','SK1','BL9']
);
```

The report token is generated server-side; no reusable bearer token is stored in the database. Links are HMAC-signed with `PLANNING_ALERT_SIGNING_SECRET` (falling back to `CRON_SECRET` only for local convenience).

## Open the web report without sending email

Sign in to SiteMatcher and visit `/planning-alerts`. The page selects the signed-in user's enabled subscription and the previous complete calendar month. Admins can use the subscription selector to preview any enabled alert. Month controls allow older immutable reports to be opened without generating or sending an email.

The first visit to a month generates and stores its `planning_alert_runs` snapshot. Set `PLANNING_ALERT_DATA_SOURCE=mock` while checking the workflow without PlanNexus, or set `PLANNING_ALERT_DATA_SOURCE=plannexus` and provide `PLANNEXUS_API_KEY` for live data.

Live PlanNexus reports are resumable after applying `supabase/migrations/20260722150000_checkpoint_planning_alert_generation.sql`. Every outward code is persisted as an independent work item. The authenticated report page processes five prefixes per request, checkpoints the partial classified digest after each prefix, and shows completed/total progress. Closing the browser or stopping the development server does not discard completed prefixes; reopening the report continues the remaining work. A prefix abandoned mid-request becomes available again after its five-minute lease expires.

## Run the monthly job manually

Call `GET /api/cron/send-monthly-planning-alerts` with `Authorization: Bearer $CRON_SECRET`. The job skips a subscription once that month's run has an `email_sent_at` value, so a retry does not send a duplicate.

## LLM summarisation follow-up

Add a summarisation stage after deterministic classification and before the run snapshot is saved:

1. Give the model only the normalised applications already selected for the digest.
2. Require structured output containing a short executive summary and optional themes/risks.
3. Store the final prose in `digest_payload.summary`.
4. Keep the application lists deterministic and source-linked; an LLM must not decide spatial inclusion.
5. Log model/version and prompt version alongside the run before production rollout.

## Production hardening

- Move large PlanNexus harvests fully into the scheduled job rather than generating them during an interactive page request.
- Confirm PlanNexus plan limits against the number of prefixes and monthly result volume. The adapter fails closed instead of issuing a national query and caps pages per prefix.
- Add an admin setup screen with patch drawing, prefix coverage preview and a “send test” action.
- Add unsubscribe/disable handling to the email and subscription management UI.
- Add delivery metrics, run retry controls and an error status write for failed generation.
- Consider PlanNexus webhooks for continuous ingestion if monthly searches become quota-heavy; retain the same deterministic month/classification layer.
