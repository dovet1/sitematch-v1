-- Migration: Create requirements tables for /sitematcher-unified
-- Purpose: A curated, admin-managed source of truth for occupier requirements shown
--          ONLY on /sitematcher-unified. `listings` (+ listing_versions, occupier
--          self-service, public /search, homepage, gapfinder, saved searches) is left
--          completely untouched.
--
-- The linchpin is `requirements.brand_id -> brands.id`, which links a requirement to the
-- brand's store estate in `stores` (stores.brand_id already exists) so the modal can show
-- store count / estate map / latest opening without fuzzy company_name matching.
--
-- Dedicated child tables (locations/contacts/sectors/use_classes) rather than reusing the
-- listing_* tables — avoids XOR checks, nullable listing_id, and mixed RLS. The child
-- tables still reference the shared global sectors/use_classes reference tables.

-- =============================================================================
-- Parent table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.requirements (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id           uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  company_name       text NOT NULL,
  title              text,
  description        text,
  listing_type       text CHECK (listing_type IN ('residential', 'commercial')),
  site_size_min      integer,
  site_size_max      integer,
  site_acreage_min   numeric,
  site_acreage_max   numeric,
  dwelling_count_min integer,
  dwelling_count_max integer,
  brochure_url       text,
  property_page_link text,
  company_domain     text,
  clearbit_logo      boolean NOT NULL DEFAULT false,
  is_featured_free   boolean NOT NULL DEFAULT false,
  verified_at        timestamptz,
  status             text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  source_listing_id  uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  created_by         uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.requirements IS 'Admin-curated occupier requirements for /sitematcher-unified only. brand_id links to the brand store estate.';
COMMENT ON COLUMN public.requirements.source_listing_id IS 'Provenance for backfilled rows. Used only by the backfill RPC; never used as an update key by admin CRUD.';
COMMENT ON COLUMN public.requirements.is_featured_free IS 'Free-tier map gating parity with listings.is_featured_free.';

-- =============================================================================
-- Child tables (all cascade-deleted with the parent requirement)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.requirement_locations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id    uuid NOT NULL REFERENCES public.requirements(id) ON DELETE CASCADE,
  place_name        text,
  formatted_address text,
  coordinates       jsonb,
  region            text,
  country           text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.requirement_contacts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id     uuid NOT NULL REFERENCES public.requirements(id) ON DELETE CASCADE,
  contact_name       text,
  contact_title      text,
  contact_email      text,
  contact_phone      text,
  contact_area       text,
  headshot_url       text,
  is_primary_contact boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.requirement_sectors (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id uuid NOT NULL REFERENCES public.requirements(id) ON DELETE CASCADE,
  sector_id      uuid NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requirement_id, sector_id)
);

CREATE TABLE IF NOT EXISTS public.requirement_use_classes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id uuid NOT NULL REFERENCES public.requirements(id) ON DELETE CASCADE,
  use_class_id   uuid NOT NULL REFERENCES public.use_classes(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requirement_id, use_class_id)
);

-- =============================================================================
-- Indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_requirements_brand_id ON public.requirements(brand_id);
CREATE INDEX IF NOT EXISTS idx_requirements_status ON public.requirements(status);
-- Free-tier map path: status='active' + is_featured_free=true
CREATE INDEX IF NOT EXISTS idx_requirements_featured_free
  ON public.requirements(is_featured_free) WHERE status = 'active';
-- Admin "needs brand" review list
CREATE INDEX IF NOT EXISTS idx_requirements_needs_brand
  ON public.requirements(brand_id) WHERE brand_id IS NULL;
-- Idempotent / race-safe backfill upsert target
CREATE UNIQUE INDEX IF NOT EXISTS uq_requirements_source_listing_id
  ON public.requirements(source_listing_id) WHERE source_listing_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_requirement_locations_requirement_id ON public.requirement_locations(requirement_id);
CREATE INDEX IF NOT EXISTS idx_requirement_contacts_requirement_id ON public.requirement_contacts(requirement_id);
CREATE INDEX IF NOT EXISTS idx_requirement_sectors_requirement_id ON public.requirement_sectors(requirement_id);
CREATE INDEX IF NOT EXISTS idx_requirement_sectors_sector_id ON public.requirement_sectors(sector_id);
CREATE INDEX IF NOT EXISTS idx_requirement_use_classes_requirement_id ON public.requirement_use_classes(requirement_id);
CREATE INDEX IF NOT EXISTS idx_requirement_use_classes_use_class_id ON public.requirement_use_classes(use_class_id);

-- =============================================================================
-- updated_at trigger (reuses public.update_updated_at_column from migration 005)
-- =============================================================================
DROP TRIGGER IF EXISTS update_requirements_updated_at ON public.requirements;
CREATE TRIGGER update_requirements_updated_at
  BEFORE UPDATE ON public.requirements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- Row Level Security
-- Public SELECT of active rows for ALL roles (anon + authenticated), since the unified
-- map route queries as `authenticated` after computing subscription tier. Admins full.
-- =============================================================================
ALTER TABLE public.requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requirement_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requirement_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requirement_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requirement_use_classes ENABLE ROW LEVEL SECURITY;

-- requirements
CREATE POLICY "Public can view active requirements" ON public.requirements
  FOR SELECT USING (status = 'active');
CREATE POLICY "Admins can manage requirements" ON public.requirements
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'));

-- requirement_locations
CREATE POLICY "Public can view active requirement locations" ON public.requirement_locations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.requirements r WHERE r.id = requirement_locations.requirement_id AND r.status = 'active')
  );
CREATE POLICY "Admins can manage requirement locations" ON public.requirement_locations
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'));

-- requirement_contacts
CREATE POLICY "Public can view active requirement contacts" ON public.requirement_contacts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.requirements r WHERE r.id = requirement_contacts.requirement_id AND r.status = 'active')
  );
CREATE POLICY "Admins can manage requirement contacts" ON public.requirement_contacts
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'));

-- requirement_sectors
CREATE POLICY "Public can view active requirement sectors" ON public.requirement_sectors
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.requirements r WHERE r.id = requirement_sectors.requirement_id AND r.status = 'active')
  );
CREATE POLICY "Admins can manage requirement sectors" ON public.requirement_sectors
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'));

-- requirement_use_classes
CREATE POLICY "Public can view active requirement use classes" ON public.requirement_use_classes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.requirements r WHERE r.id = requirement_use_classes.requirement_id AND r.status = 'active')
  );
CREATE POLICY "Admins can manage requirement use classes" ON public.requirement_use_classes
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'));

-- =============================================================================
-- Atomic write RPCs
-- The Supabase JS client can't span multiple statements in one transaction, so parent +
-- child writes are done in a single SECURITY DEFINER function. Hardened: fixed
-- search_path, and EXECUTE revoked from PUBLIC/anon/authenticated and granted only to
-- service_role. These are invoked exclusively from server routes using the service-role
-- client, never from a browser client — so the SECURITY DEFINER bypass is unreachable
-- from anon/authenticated.
-- =============================================================================

-- Backfill upsert, keyed on source_listing_id (idempotent + atomic).
CREATE OR REPLACE FUNCTION public.upsert_requirement_from_seed(seed jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_requirement_id uuid;
  v_source_listing_id uuid := nullif(seed->>'source_listing_id', '')::uuid;
BEGIN
  IF v_source_listing_id IS NULL THEN
    RAISE EXCEPTION 'upsert_requirement_from_seed requires source_listing_id';
  END IF;

  INSERT INTO public.requirements (
    brand_id, company_name, title, description, listing_type,
    site_size_min, site_size_max, site_acreage_min, site_acreage_max,
    dwelling_count_min, dwelling_count_max, brochure_url, property_page_link,
    company_domain, clearbit_logo, is_featured_free, verified_at, status, source_listing_id
  )
  VALUES (
    nullif(seed->>'brand_id', '')::uuid,
    seed->>'company_name',
    seed->>'title',
    seed->>'description',
    seed->>'listing_type',
    nullif(seed->>'site_size_min', '')::integer,
    nullif(seed->>'site_size_max', '')::integer,
    nullif(seed->>'site_acreage_min', '')::numeric,
    nullif(seed->>'site_acreage_max', '')::numeric,
    nullif(seed->>'dwelling_count_min', '')::integer,
    nullif(seed->>'dwelling_count_max', '')::integer,
    seed->>'brochure_url',
    seed->>'property_page_link',
    seed->>'company_domain',
    coalesce((seed->>'clearbit_logo')::boolean, false),
    coalesce((seed->>'is_featured_free')::boolean, false),
    nullif(seed->>'verified_at', '')::timestamptz,
    coalesce(nullif(seed->>'status', ''), 'active'),
    v_source_listing_id
  )
  ON CONFLICT (source_listing_id) WHERE source_listing_id IS NOT NULL
  DO UPDATE SET
    brand_id           = EXCLUDED.brand_id,
    company_name       = EXCLUDED.company_name,
    title              = EXCLUDED.title,
    description        = EXCLUDED.description,
    listing_type       = EXCLUDED.listing_type,
    site_size_min      = EXCLUDED.site_size_min,
    site_size_max      = EXCLUDED.site_size_max,
    site_acreage_min   = EXCLUDED.site_acreage_min,
    site_acreage_max   = EXCLUDED.site_acreage_max,
    dwelling_count_min = EXCLUDED.dwelling_count_min,
    dwelling_count_max = EXCLUDED.dwelling_count_max,
    brochure_url       = EXCLUDED.brochure_url,
    property_page_link = EXCLUDED.property_page_link,
    company_domain     = EXCLUDED.company_domain,
    clearbit_logo      = EXCLUDED.clearbit_logo,
    is_featured_free   = EXCLUDED.is_featured_free,
    verified_at        = EXCLUDED.verified_at,
    status             = EXCLUDED.status,
    updated_at         = now()
  RETURNING id INTO v_requirement_id;

  PERFORM public._replace_requirement_children(v_requirement_id, seed);

  RETURN v_requirement_id;
END;
$$;

-- Admin CRUD write, keyed on id (present = update, absent = create). Never touches
-- source_listing_id — that provenance key belongs to the backfill RPC only.
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
      company_domain, clearbit_logo, is_featured_free, verified_at, status, created_by
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
      coalesce((payload->>'is_featured_free')::boolean, false),
      nullif(payload->>'verified_at', '')::timestamptz,
      coalesce(nullif(payload->>'status', ''), 'active'),
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
      is_featured_free   = coalesce((payload->>'is_featured_free')::boolean, false),
      verified_at        = nullif(payload->>'verified_at', '')::timestamptz,
      status             = coalesce(nullif(payload->>'status', ''), 'active'),
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

-- Shared helper: delete + re-insert all child rows from a seed/payload jsonb. Idempotent.
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

  INSERT INTO public.requirement_contacts (requirement_id, contact_name, contact_title, contact_email, contact_phone, contact_area, headshot_url, is_primary_contact)
  SELECT p_requirement_id,
    elem->>'contact_name',
    elem->>'contact_title',
    elem->>'contact_email',
    elem->>'contact_phone',
    elem->>'contact_area',
    elem->>'headshot_url',
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

-- Harden execute grants: only the service-role server routes may call these.
REVOKE EXECUTE ON FUNCTION public.upsert_requirement_from_seed(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.save_requirement(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._replace_requirement_children(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_requirement_from_seed(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_requirement(jsonb) TO service_role;

COMMENT ON FUNCTION public.upsert_requirement_from_seed(jsonb) IS 'Backfill: atomic + idempotent upsert of a requirement + its children, keyed on source_listing_id. service_role only.';
COMMENT ON FUNCTION public.save_requirement(jsonb) IS 'Admin CRUD: atomic create/update of a requirement + its children, keyed on id. Never touches source_listing_id. service_role only.';
