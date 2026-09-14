-- Development linking, step 4: Plota family lookups, stored and reused.
-- See docs/planning-development-linking-plan.md.
--
-- A family lookup spends one Plota request on GET /v1/applications/{id}/associated for a follow-on
-- whose parent we do not hold. The whole family is stored, so later follow-ons of the same scheme
-- resolve locally and never cost another request.

CREATE TABLE IF NOT EXISTS public.planning_families (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  authority_slug            text NOT NULL,
  principal_provider_id     text NOT NULL,
  principal_reference       text NOT NULL,
  principal_application_id  uuid REFERENCES public.planning_applications(id) ON DELETE SET NULL,
  member_count              integer NOT NULL DEFAULT 0,
  -- As Plota reports it: derived from discharge and variation applications in the family, not a
  -- list of outstanding conditions. Where a council's decisions are not re-checked only
  -- 'submitted' and 'variation_sought' appear.
  condition_ledger          jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- The provider response as received, for audit and to re-derive links without paying again.
  raw                       jsonb NOT NULL,
  response_hash             text NOT NULL,
  requested_via_provider_id text NOT NULL,
  fetched_at                timestamptz NOT NULL DEFAULT now(),
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (authority_slug, principal_provider_id)
);

ALTER TABLE public.planning_family_lookups
  ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.planning_families(id) ON DELETE SET NULL,
  -- Where Plota's family and the local links disagree. The family is stored either way; step 5
  -- keeps a family with a conflict separate until someone reviews it.
  ADD COLUMN IF NOT EXISTS conflict jsonb,
  ADD COLUMN IF NOT EXISTS review_state text NOT NULL DEFAULT 'none';

ALTER TABLE public.planning_family_lookups
  DROP CONSTRAINT IF EXISTS planning_family_lookups_review_state;
ALTER TABLE public.planning_family_lookups
  ADD CONSTRAINT planning_family_lookups_review_state CHECK (review_state IN ('none', 'pending', 'resolved'));

CREATE INDEX IF NOT EXISTS planning_family_lookups_review_idx
  ON public.planning_family_lookups (review_state)
  WHERE review_state = 'pending';

-- Plota's family members carry no coordinates. A member it links by shared case number is on the
-- same site by Plota's own rule, and a cited parent is almost always the same site, so a stored
-- member without a location borrows one from a member that has one. The borrowed point is never
-- exact for this application, whatever the source's precision: the precision recorded says where
-- it came from, and the location trigger treats anything but 'exact' or 'rooftop' as approximate.
CREATE OR REPLACE FUNCTION public.planning_copy_family_location(p_target uuid, p_source uuid)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH updated AS (
    UPDATE public.planning_applications target
    SET location = source.location,
        location_precision = 'borrowed_from_family_member'
    FROM public.planning_applications source
    WHERE target.id = p_target AND source.id = p_source
      AND target.location IS NULL AND source.location IS NOT NULL
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM updated);
$$;

-- Associated-endpoint requests this month, for the lookup allowance.
CREATE INDEX IF NOT EXISTS planning_provider_usage_endpoint_occurred_idx
  ON public.planning_provider_usage (endpoint, occurred_at DESC);

ALTER TABLE public.planning_families ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.planning_families FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_families TO service_role;
REVOKE ALL ON FUNCTION public.planning_copy_family_location(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.planning_copy_family_location(uuid, uuid) TO service_role;
