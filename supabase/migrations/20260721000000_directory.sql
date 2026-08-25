-- Migration: Company Directory for /sitematcher-unified
-- Purpose: Adds the "Directory" mode — a card-based browser of the retail market linking
--          Brands (occupiers) -> in-house teams -> agents, and back again.
--
-- Brands are the hub. A brand already links to its estate (stores.brand_id), its live
-- requirement (requirements.brand_id) and its in-house team (brand_contacts.brand_id).
-- The two things missing were a normalised brand<->agent link and a source for the
-- activity feed; both are added here.
--
-- Directory-only agent tables, deliberately separate from the legacy agencies /
-- agency_team_members / listing_agents system — the same reasoning that kept
-- 20260711000000_create_requirements.sql away from `listings`.
--
-- SECURITY NOTE: unlike brand_contacts, the four new tables get NO public SELECT policy.
-- NEXT_PUBLIC_SUPABASE_ANON_KEY ships in the browser bundle, so a public policy would let
-- anyone read the agent graph straight off PostgREST, bypassing the Plus gate on
-- /sitematcher-unified entirely. Reads reach the client only via the gated
-- /api/public/directory/* routes, which use a service-role client (service role bypasses
-- RLS, so no read policy is required).

-- =============================================================================
-- 1. Directory agent tables
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.directory_agencies (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  website    text,
  domain     text,
  logo_url   text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.directory_agencies IS 'Agency firms shown in the directory. Distinct from the legacy `agencies` table, which is tied to `listings`.';
COMMENT ON COLUMN public.directory_agencies.domain IS 'Bare hostname for a logo.dev lookup (e.g. savills.com). Distinct from logo_url (uploaded file).';

CREATE TABLE IF NOT EXISTS public.directory_agents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id    uuid REFERENCES public.directory_agencies(id) ON DELETE SET NULL,
  name         text NOT NULL,
  title        text,
  email        text,
  phone        text,
  linkedin_url text,
  headshot_url text,
  region       text,
  focus        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.directory_agents IS 'Retained agency reps acting for one or more brands. agency_id is nullable so an independent agent can exist without a firm.';

-- The bidirectional brand<->agent edge. Both directions are indexed: brand_id powers the
-- brand profile's contacts panel, agent_id powers "other brands this agent represents".
CREATE TABLE IF NOT EXISTS public.brand_agents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id      uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  agent_id      uuid NOT NULL REFERENCES public.directory_agents(id) ON DELETE CASCADE,
  role_note     text,
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, agent_id)
);

COMMENT ON COLUMN public.brand_agents.role_note IS 'Optional per-brand override for the agent''s role line, e.g. "acting for Nando''s on retail parks".';

CREATE TABLE IF NOT EXISTS public.brand_activity (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('opening', 'closure')),
  event_date  date NOT NULL,
  is_upcoming boolean NOT NULL DEFAULT false,
  headline    text NOT NULL,
  url         text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.brand_activity IS 'Admin-curated openings/closures for the brand profile activity band. Curated rather than derived because the design shows upcoming and signed-for events plus external news links, none of which exist in `stores`.';

CREATE INDEX IF NOT EXISTS idx_directory_agents_agency_id ON public.directory_agents(agency_id);
CREATE INDEX IF NOT EXISTS idx_brand_agents_brand_id ON public.brand_agents(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_agents_agent_id ON public.brand_agents(agent_id);
CREATE INDEX IF NOT EXISTS idx_brand_activity_brand_id_date ON public.brand_activity(brand_id, event_date DESC);

-- =============================================================================
-- 2. updated_at triggers (reuses public.update_updated_at_column from migration 005)
-- =============================================================================
DROP TRIGGER IF EXISTS update_directory_agencies_updated_at ON public.directory_agencies;
CREATE TRIGGER update_directory_agencies_updated_at
  BEFORE UPDATE ON public.directory_agencies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_directory_agents_updated_at ON public.directory_agents;
CREATE TRIGGER update_directory_agents_updated_at
  BEFORE UPDATE ON public.directory_agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_brand_activity_updated_at ON public.brand_activity;
CREATE TRIGGER update_brand_activity_updated_at
  BEFORE UPDATE ON public.brand_activity
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- 3. RLS — enable, then admin-only policies. NO public SELECT (see header note).
--    ENABLE is load-bearing: RLS is off by default in Postgres and policies on a table
--    without it are inert, which would leave these tables anon-readable AND anon-writable.
-- =============================================================================
ALTER TABLE public.directory_agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.directory_agents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_agents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_activity     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage directory agencies" ON public.directory_agencies;
CREATE POLICY "Admins can manage directory agencies" ON public.directory_agencies
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage directory agents" ON public.directory_agents;
CREATE POLICY "Admins can manage directory agents" ON public.directory_agents
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage brand agents" ON public.brand_agents;
CREATE POLICY "Admins can manage brand agents" ON public.brand_agents
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'));

DROP POLICY IF EXISTS "Admins can manage brand activity" ON public.brand_activity;
CREATE POLICY "Admins can manage brand activity" ON public.brand_activity
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'));

-- =============================================================================
-- 4. Column additions
-- =============================================================================
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS website_url       text,
  ADD COLUMN IF NOT EXISTS store_locator_url text;

COMMENT ON COLUMN public.brands.website_url IS 'Full brand website URL for the profile hero globe link. Distinct from `domain`, which is a bare hostname used only for logo.dev.';
COMMENT ON COLUMN public.brands.store_locator_url IS 'Brand''s own store-finder page; surfaced as provenance beside the estate map store count.';

ALTER TABLE public.requirements
  ADD COLUMN IF NOT EXISTS size_seen_sqft  integer,
  ADD COLUMN IF NOT EXISTS size_seen_basis text;

COMMENT ON COLUMN public.requirements.size_seen_sqft IS 'Admin-curated "size seen in market" figure. Not derived: stores.size_band is unpopulated and there is no numeric sq ft on stores.';
COMMENT ON COLUMN public.requirements.size_seen_basis IS 'Human-readable provenance for size_seen_sqft, e.g. "18 stores opened 2024-25".';

ALTER TABLE public.brand_contacts       ADD COLUMN IF NOT EXISTS linkedin_url text;
ALTER TABLE public.requirement_contacts ADD COLUMN IF NOT EXISTS linkedin_url text;

-- Deterministic "the active requirement" pick. The index column list must match the
-- ORDER BY exactly — including NULLS LAST and both tie-breaks — or Postgres sorts instead
-- of walking the index.
CREATE INDEX IF NOT EXISTS idx_requirements_brand_active_pick
  ON public.requirements (brand_id, verified_at DESC NULLS LAST, updated_at DESC, id)
  WHERE status = 'active';

-- =============================================================================
-- 5. Write-path RPCs redeclared in full.
--    These enumerate their persisted columns explicitly and the admin routes write only
--    through them, so adding a column to the table is NOT enough — it would silently drop.
--    Bodies copied from the latest migration declaring each, then extended.
-- =============================================================================

-- 5a. _replace_requirement_children — from 20260712000000, + linkedin_url.
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
END;
$$;

REVOKE EXECUTE ON FUNCTION public._replace_requirement_children(uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- 5b. save_requirement — from 20260714000000, + size_seen_sqft / size_seen_basis.
CREATE OR REPLACE FUNCTION public.save_requirement(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_requirement_id uuid := nullif(payload->>'id', '')::uuid;
BEGIN
  IF v_requirement_id IS NULL THEN
    INSERT INTO public.requirements (
      brand_id, company_name, title, description, listing_type,
      site_size_min, site_size_max, site_acreage_min, site_acreage_max,
      dwelling_count_min, dwelling_count_max, brochure_url, property_page_link,
      company_domain, clearbit_logo, logo_url, is_featured_free, verified_at, status,
      size_seen_sqft, size_seen_basis, created_by
    )
    VALUES (
      nullif(payload->>'brand_id', '')::uuid,
      payload->>'company_name',
      payload->>'title',
      payload->>'description',
      payload->>'listing_type',
      nullif(payload->>'site_size_min', '')::integer,
      nullif(payload->>'site_size_max', '')::integer,
      nullif(payload->>'site_acreage_min', '')::numeric,
      nullif(payload->>'site_acreage_max', '')::numeric,
      nullif(payload->>'dwelling_count_min', '')::integer,
      nullif(payload->>'dwelling_count_max', '')::integer,
      payload->>'brochure_url',
      payload->>'property_page_link',
      payload->>'company_domain',
      coalesce((payload->>'clearbit_logo')::boolean, false),
      payload->>'logo_url',
      coalesce((payload->>'is_featured_free')::boolean, false),
      nullif(payload->>'verified_at', '')::timestamptz,
      coalesce(nullif(payload->>'status', ''), 'active'),
      nullif(payload->>'size_seen_sqft', '')::integer,
      payload->>'size_seen_basis',
      nullif(payload->>'created_by', '')::uuid
    )
    RETURNING id INTO v_requirement_id;
  ELSE
    UPDATE public.requirements SET
      brand_id           = nullif(payload->>'brand_id', '')::uuid,
      company_name       = payload->>'company_name',
      title              = payload->>'title',
      description        = payload->>'description',
      listing_type       = payload->>'listing_type',
      site_size_min      = nullif(payload->>'site_size_min', '')::integer,
      site_size_max      = nullif(payload->>'site_size_max', '')::integer,
      site_acreage_min   = nullif(payload->>'site_acreage_min', '')::numeric,
      site_acreage_max   = nullif(payload->>'site_acreage_max', '')::numeric,
      dwelling_count_min = nullif(payload->>'dwelling_count_min', '')::integer,
      dwelling_count_max = nullif(payload->>'dwelling_count_max', '')::integer,
      brochure_url       = payload->>'brochure_url',
      property_page_link = payload->>'property_page_link',
      company_domain     = payload->>'company_domain',
      clearbit_logo      = coalesce((payload->>'clearbit_logo')::boolean, false),
      logo_url           = payload->>'logo_url',
      is_featured_free   = coalesce((payload->>'is_featured_free')::boolean, false),
      verified_at        = nullif(payload->>'verified_at', '')::timestamptz,
      status             = coalesce(nullif(payload->>'status', ''), 'active'),
      size_seen_sqft     = nullif(payload->>'size_seen_sqft', '')::integer,
      size_seen_basis    = payload->>'size_seen_basis',
      updated_at         = now()
    WHERE id = v_requirement_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'save_requirement: no requirement with id %', v_requirement_id;
    END IF;
  END IF;

  PERFORM public._replace_requirement_children(v_requirement_id, payload);

  RETURN v_requirement_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_requirement(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_requirement(jsonb) TO service_role;

-- 5c. save_brand_contacts — from 20260715000000, + linkedin_url.
CREATE OR REPLACE FUNCTION public.save_brand_contacts(p_brand_id uuid, p_contacts jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.brand_contacts WHERE brand_id = p_brand_id;
  INSERT INTO public.brand_contacts (
    brand_id, contact_name, contact_title, contact_email, contact_phone,
    contact_area, contact_kind, contact_org, headshot_url, linkedin_url, is_primary_contact
  )
  SELECT p_brand_id,
    elem->>'contact_name', elem->>'contact_title', elem->>'contact_email',
    elem->>'contact_phone', elem->>'contact_area',
    nullif(elem->>'contact_kind',''), elem->>'contact_org',
    elem->>'headshot_url', elem->>'linkedin_url',
    coalesce((elem->>'is_primary_contact')::boolean, false)
  FROM jsonb_array_elements(coalesce(p_contacts, '[]'::jsonb)) AS elem;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.save_brand_contacts(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_brand_contacts(uuid, jsonb) TO service_role;

-- =============================================================================
-- 6. directory_brand_cards() — one-query payload for the directory grid.
--
--    Every count is pre-aggregated in its own CTE before being joined to `brands`.
--    Joining stores + contacts + agents + requirements into a single FROM would multiply
--    rows and inflate every count (a brand with 400 stores and 3 contacts would report
--    1200 contacts). COUNT(DISTINCT ...) would mask that but still scan the product.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.directory_brand_cards()
RETURNS TABLE (
  id                     uuid,
  name                   text,
  logo_url               text,
  domain                 text,
  website_url            text,
  category_child         text,
  category_parent        text,
  store_count            bigint,
  in_house_count         bigint,
  agent_count            bigint,
  has_active_requirement boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH store_counts AS (
    SELECT s.brand_id, count(*) AS n FROM public.stores s GROUP BY s.brand_id
  ),
  in_house_counts AS (
    SELECT bc.brand_id, count(*) AS n
    FROM public.brand_contacts bc
    WHERE bc.contact_kind IS NULL OR bc.contact_kind = 'in-house'
    GROUP BY bc.brand_id
  ),
  agent_counts AS (
    SELECT ba.brand_id, count(*) AS n FROM public.brand_agents ba GROUP BY ba.brand_id
  ),
  active_reqs AS (
    SELECT r.brand_id, count(*) AS n
    FROM public.requirements r
    WHERE r.status = 'active' AND r.brand_id IS NOT NULL
    GROUP BY r.brand_id
  ),
  -- Dominant primary category per brand, mirroring brand_primary_category(uuid) but
  -- computed once for every brand rather than per-row.
  cats AS (
    SELECT DISTINCT ON (s.brand_id)
      s.brand_id, c.name AS child, p.name AS parent
    FROM public.stores s
    JOIN public.fascias f ON f.id = s.fascia_id
    JOIN public.fascia_categories fc ON fc.fascia_id = f.id AND fc.is_primary
    JOIN public.categories c ON c.id = fc.category_id
    LEFT JOIN public.categories p ON p.id = c.parent_category_id
    GROUP BY s.brand_id, c.name, p.name
    ORDER BY s.brand_id, count(*) DESC, c.name
  )
  SELECT
    b.id,
    b.name,
    b.logo_url,
    b.domain,
    b.website_url,
    cats.child,
    cats.parent,
    coalesce(store_counts.n, 0)    AS store_count,
    coalesce(in_house_counts.n, 0) AS in_house_count,
    coalesce(agent_counts.n, 0)    AS agent_count,
    coalesce(active_reqs.n, 0) > 0 AS has_active_requirement
  FROM public.brands b
  LEFT JOIN store_counts    ON store_counts.brand_id    = b.id
  LEFT JOIN in_house_counts ON in_house_counts.brand_id = b.id
  LEFT JOIN agent_counts    ON agent_counts.brand_id    = b.id
  LEFT JOIN active_reqs     ON active_reqs.brand_id     = b.id
  LEFT JOIN cats            ON cats.brand_id            = b.id
  -- Directory presence: skip brand stubs with nothing to show.
  WHERE coalesce(store_counts.n, 0) > 0
     OR coalesce(in_house_counts.n, 0) > 0
     OR coalesce(agent_counts.n, 0) > 0
     OR coalesce(active_reqs.n, 0) > 0
  ORDER BY coalesce(store_counts.n, 0) DESC, b.name;
$$;

REVOKE EXECUTE ON FUNCTION public.directory_brand_cards() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.directory_brand_cards() TO service_role;

-- =============================================================================
-- 7. promote_brand_contact_to_agent — turns a legacy brand_contacts row with
--    contact_kind='agency' into a first-class directory agent + brand_agents edge.
--
--    Atomic so a failure can't leave an orphan agency behind. The original contact row is
--    RETAINED by default: the existing brand info modal still reads brand_contacts, and
--    deleting the row would blank a contact card on an already-shipped surface.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.promote_brand_contact_to_agent(p_contact_id uuid, p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contact   public.brand_contacts%ROWTYPE;
  v_agency_id uuid := nullif(p_payload->>'agency_id', '')::uuid;
  v_agent_id  uuid := nullif(p_payload->>'agent_id', '')::uuid;
BEGIN
  SELECT * INTO v_contact FROM public.brand_contacts WHERE id = p_contact_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'promote_brand_contact_to_agent: no brand_contact with id %', p_contact_id;
  END IF;

  -- Resolve the agency: an explicit id wins, else create one from the supplied name.
  IF v_agency_id IS NULL AND nullif(p_payload->>'agency_name', '') IS NOT NULL THEN
    INSERT INTO public.directory_agencies (name, website, domain)
    VALUES (p_payload->>'agency_name', p_payload->>'agency_website', nullif(p_payload->>'agency_domain', ''))
    RETURNING id INTO v_agency_id;
  END IF;

  -- Resolve the agent: an explicit id wins (the admin confirmed a match in the dialog),
  -- else create a new one from the contact's details. Never auto-merge on name.
  IF v_agent_id IS NULL THEN
    INSERT INTO public.directory_agents (agency_id, name, title, email, phone, linkedin_url, headshot_url)
    VALUES (
      v_agency_id,
      coalesce(nullif(p_payload->>'agent_name', ''), v_contact.contact_name),
      coalesce(nullif(p_payload->>'agent_title', ''), v_contact.contact_title),
      coalesce(nullif(p_payload->>'agent_email', ''), v_contact.contact_email),
      coalesce(nullif(p_payload->>'agent_phone', ''), v_contact.contact_phone),
      coalesce(nullif(p_payload->>'agent_linkedin_url', ''), v_contact.linkedin_url),
      v_contact.headshot_url
    )
    RETURNING id INTO v_agent_id;
  END IF;

  -- Idempotent: re-running the promotion is harmless.
  INSERT INTO public.brand_agents (brand_id, agent_id, role_note)
  VALUES (v_contact.brand_id, v_agent_id, nullif(p_payload->>'role_note', ''))
  ON CONFLICT (brand_id, agent_id) DO NOTHING;

  IF coalesce((p_payload->>'remove_contact')::boolean, false) THEN
    DELETE FROM public.brand_contacts WHERE id = p_contact_id;
  END IF;

  RETURN v_agent_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.promote_brand_contact_to_agent(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_brand_contact_to_agent(uuid, jsonb) TO service_role;
