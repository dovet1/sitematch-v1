-- Seed the Find Sites runtime kill-switch flag OFF (M10). Find Sites is a standalone
-- experimental prospecting route (/find-sites), gated Plus-only in its layout. Flip `enabled`
-- to true to launch it internally/for beta; set it back to false to hide the route instantly
-- (the layout calls notFound() when off). Read-only feature toggle — no data changes.
INSERT INTO feature_flags (key, enabled, description)
VALUES (
  'find_sites_enabled',
  false,
  'Enables the standalone /find-sites experimental prospecting route (Plus tier).'
)
ON CONFLICT (key) DO NOTHING;
