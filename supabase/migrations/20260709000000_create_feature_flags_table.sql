-- Global runtime feature flags (not per-user). Toggled via SQL/admin to enable
-- or instantly disable features without a redeploy.
CREATE TABLE feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT non_empty_key CHECK (length(trim(key)) > 0)
);

-- Row Level Security: anyone may read flags; only the service role (which
-- bypasses RLS) may write. No write policy is defined on purpose.
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Feature flags are readable by everyone"
  ON feature_flags FOR SELECT
  USING (true);

-- Keep updated_at fresh on writes.
CREATE TRIGGER trigger_update_feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed the unified workspace flag OFF. Flip `enabled` to true to launch.
INSERT INTO feature_flags (key, enabled, description)
VALUES (
  'unified_workspace_enabled',
  false,
  'Enables the /sitematcher-unified workspace route (Plus tier).'
);
