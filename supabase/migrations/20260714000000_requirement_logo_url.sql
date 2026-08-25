-- Migration: Add requirements.logo_url for admin-uploaded logos
-- Purpose: Requirements previously derived logos only from logo.dev (company_domain +
--          clearbit_logo). Admins can now upload a custom logo; its public URL is stored
--          here and preferred over the logo.dev-derived URL at read time.
--
-- NOTE: Only save_requirement is re-declared below. _replace_requirement_children was
-- redefined in 20260712000000_requirement_contacts_kind_org.sql to persist contact_kind /
-- contact_org; it is intentionally left untouched here so that behaviour is preserved.

ALTER TABLE public.requirements ADD COLUMN IF NOT EXISTS logo_url text;

COMMENT ON COLUMN public.requirements.logo_url IS 'Admin-uploaded logo URL (logos bucket). Preferred over the logo.dev URL when set.';

-- Re-declare save_requirement to persist logo_url on create + update.
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
      company_domain, clearbit_logo, logo_url, is_featured_free, verified_at, status, created_by
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
