-- Monthly planning-alert POC.
--
-- A subscription associates one existing SiteMatcher user with one brand estate.
-- `patch_geojson` is the exact commercial patch used for final point-in-polygon
-- classification. `plannexus_postcode_prefixes` is only a coarse upstream query
-- envelope; it should cover the patch plus the 5 km buffers around the estate.

CREATE TABLE IF NOT EXISTS public.planning_alert_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  patch_name text NOT NULL,
  patch_geojson jsonb NOT NULL CHECK (patch_geojson->>'type' IN ('Polygon', 'MultiPolygon')),
  plannexus_postcode_prefixes text[] NOT NULL DEFAULT '{}',
  radius_meters integer NOT NULL DEFAULT 5000 CHECK (radius_meters > 0 AND radius_meters <= 50000),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (user_id, brand_id)
);

CREATE TABLE IF NOT EXISTS public.planning_alert_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.planning_alert_subscriptions(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  provider text NOT NULL CHECK (provider IN ('mock', 'plannexus')),
  source_application_count integer NOT NULL DEFAULT 0,
  -- An immutable snapshot keeps emailed links stable even if stores or a patch change later.
  -- The nullable summary field inside this payload is the seam for the later LLM stage.
  digest_payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'sent', 'failed')),
  error_message text,
  generated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (subscription_id, period_start),
  CHECK (period_end > period_start)
);

CREATE INDEX IF NOT EXISTS idx_planning_alert_subscriptions_enabled
  ON public.planning_alert_subscriptions (enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_planning_alert_runs_subscription_period
  ON public.planning_alert_runs (subscription_id, period_start DESC);

DROP TRIGGER IF EXISTS update_planning_alert_subscriptions_updated_at
  ON public.planning_alert_subscriptions;
CREATE TRIGGER update_planning_alert_subscriptions_updated_at
  BEFORE UPDATE ON public.planning_alert_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.planning_alert_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_alert_runs ENABLE ROW LEVEL SECURITY;

-- Setup stays admin-only. Report reads and cron processing use the server-side
-- service-role client, so no browser-readable policy is required.
CREATE POLICY "Admins manage planning alert subscriptions"
  ON public.planning_alert_subscriptions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

CREATE POLICY "Admins manage planning alert runs"
  ON public.planning_alert_runs FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin')
  );

COMMENT ON COLUMN public.planning_alert_subscriptions.patch_geojson IS
  'Exact GeoJSON Polygon/MultiPolygon used for local classification and report display.';
COMMENT ON COLUMN public.planning_alert_subscriptions.plannexus_postcode_prefixes IS
  'Coarse PlanNexus query prefixes covering both the patch and every store 5 km buffer.';
