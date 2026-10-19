-- Migration: Link requirement contacts to directory agents
-- Purpose: requirement_contacts are free-text copies scoped to one requirement, so the same
--          Savills rep listed on 18 requirements is 18 unrelated rows and the directory's
--          agent graph (directory_agents / brand_agents) stays empty. This adds a durable
--          requirement_contacts.agent_id link, keyed on the contact's email, and keeps it alive
--          across admin saves.
--
-- Only agents are linked. In-house contacts (email on the brand's own domain) are left alone.
--
-- The one-off backfill that creates the agencies / agents from existing requirement contacts
-- lives in supabase/scripts/backfill_requirement_contact_agents.sql — it needs a reviewed
-- firm-name list, so it is not part of the migration.

-- =============================================================================
-- 1. Schema
-- =============================================================================
ALTER TABLE public.requirement_contacts
  ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES public.directory_agents(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.requirement_contacts.agent_id IS 'The directory agent this contact is. Set by link_requirement_contact_agents() on email match; NULL for in-house or unmatched contacts.';

CREATE INDEX IF NOT EXISTS idx_requirement_contacts_agent_id ON public.requirement_contacts(agent_id);

-- Email is the agent's identity, so it must be unique (case-insensitively). Both tables were
-- empty when this was written, so neither index can fail on existing duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS uq_directory_agents_email
  ON public.directory_agents (lower(email)) WHERE email IS NOT NULL AND email <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_directory_agencies_domain
  ON public.directory_agencies (lower(domain)) WHERE domain IS NOT NULL AND domain <> '';

-- =============================================================================
-- 2. link_requirement_contact_agents — match a requirement's contacts to existing agents
--    by email, stamp agent_id / kind / org, and make sure the brand<->agent edge exists.
--    Links only; it never creates agents (that is an admin decision, via the backfill or
--    /admin/directory-agents).
-- =============================================================================
CREATE OR REPLACE FUNCTION public.link_requirement_contact_agents(p_requirement_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.requirement_contacts rc
  SET agent_id     = a.id,
      contact_kind = 'agency',
      contact_org  = coalesce(nullif(rc.contact_org, ''), ag.name)
  FROM public.directory_agents a
  LEFT JOIN public.directory_agencies ag ON ag.id = a.agency_id
  WHERE rc.requirement_id = p_requirement_id
    AND rc.agent_id IS NULL
    AND nullif(trim(rc.contact_email), '') IS NOT NULL
    AND lower(trim(rc.contact_email)) = lower(a.email);

  INSERT INTO public.brand_agents (brand_id, agent_id)
  SELECT DISTINCT r.brand_id, rc.agent_id
  FROM public.requirement_contacts rc
  JOIN public.requirements r ON r.id = rc.requirement_id
  WHERE rc.requirement_id = p_requirement_id
    AND rc.agent_id IS NOT NULL
    AND r.brand_id IS NOT NULL
  ON CONFLICT (brand_id, agent_id) DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.link_requirement_contact_agents(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_requirement_contact_agents(uuid) TO service_role;

-- =============================================================================
-- 3. _replace_requirement_children redeclared in full (from 20260721000000).
--    Admin saves delete and re-insert every contact, which would drop agent_id; re-linking
--    at the end of the replace keeps the link without the admin form knowing about it.
-- =============================================================================
CREATE OR REPLACE FUNCTION public._replace_requirement_children(p_requirement_id uuid, p_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.requirement_locations WHERE requirement_id = p_requirement_id;
  DELETE FROM public.requirement_contacts WHERE requirement_id = p_requirement_id;
  DELETE FROM public.requirement_sectors WHERE requirement_id = p_requirement_id;
  DELETE FROM public.requirement_use_classes WHERE requirement_id = p_requirement_id;

  INSERT INTO public.requirement_locations (requirement_id, place_name, formatted_address, coordinates, region, country)
  SELECT p_requirement_id,
    elem->>'place_name',
    elem->>'formatted_address',
    CASE WHEN jsonb_typeof(elem->'coordinates') IN ('array', 'object') THEN elem->'coordinates' ELSE NULL END,
    elem->>'region',
    elem->>'country'
  FROM jsonb_array_elements(coalesce(p_data->'locations', '[]'::jsonb)) AS elem;

  INSERT INTO public.requirement_contacts (requirement_id, contact_name, contact_title, contact_email, contact_phone, contact_area, contact_kind, contact_org, headshot_url, linkedin_url, is_primary_contact)
  SELECT p_requirement_id,
    elem->>'contact_name',
    elem->>'contact_title',
    elem->>'contact_email',
    elem->>'contact_phone',
    elem->>'contact_area',
    nullif(elem->>'contact_kind', ''),
    elem->>'contact_org',
    elem->>'headshot_url',
    elem->>'linkedin_url',
    coalesce((elem->>'is_primary_contact')::boolean, false)
  FROM jsonb_array_elements(coalesce(p_data->'contacts', '[]'::jsonb)) AS elem;

  INSERT INTO public.requirement_sectors (requirement_id, sector_id)
  SELECT DISTINCT p_requirement_id, sid::uuid
  FROM jsonb_array_elements_text(coalesce(p_data->'sectors', '[]'::jsonb)) AS sid
  WHERE nullif(sid, '') IS NOT NULL;

  INSERT INTO public.requirement_use_classes (requirement_id, use_class_id)
  SELECT DISTINCT p_requirement_id, ucid::uuid
  FROM jsonb_array_elements_text(coalesce(p_data->'use_classes', '[]'::jsonb)) AS ucid
  WHERE nullif(ucid, '') IS NOT NULL;

  PERFORM public.link_requirement_contact_agents(p_requirement_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public._replace_requirement_children(uuid, jsonb) FROM PUBLIC, anon, authenticated;
