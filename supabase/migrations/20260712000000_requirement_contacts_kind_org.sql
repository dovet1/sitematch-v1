-- Migration: Add contact kind + org to requirement_contacts
-- Purpose: The redesigned /sitematcher-unified requirement modal distinguishes a retailer's
--          own acquisition team ('in-house') from an appointed agency ('agency'), and shows
--          each contact's organisation ("role · org"). The existing table only stored a free
--          contact_title, so add:
--            - contact_kind : constrained to 'in-house' | 'agency' (nullable = unspecified)
--            - contact_org  : the contact's organisation label (retailer or agency name)
--
-- Also re-declares _replace_requirement_children (CREATE OR REPLACE) so the atomic child
-- write RPC persists the two new columns. save_requirement / upsert_requirement_from_seed
-- call this helper unchanged.

ALTER TABLE public.requirement_contacts
  ADD COLUMN IF NOT EXISTS contact_kind text
    CHECK (contact_kind IS NULL OR contact_kind IN ('in-house', 'agency')),
  ADD COLUMN IF NOT EXISTS contact_org text;

COMMENT ON COLUMN public.requirement_contacts.contact_kind IS 'in-house = retailer''s own team; agency = appointed agent. NULL = unspecified.';
COMMENT ON COLUMN public.requirement_contacts.contact_org IS 'Contact organisation label shown as "role · org" in the requirement modal.';

-- Re-declare the shared child-write helper to include contact_kind + contact_org.
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

  INSERT INTO public.requirement_contacts (requirement_id, contact_name, contact_title, contact_email, contact_phone, contact_area, contact_kind, contact_org, headshot_url, is_primary_contact)
  SELECT p_requirement_id,
    elem->>'contact_name',
    elem->>'contact_title',
    elem->>'contact_email',
    elem->>'contact_phone',
    elem->>'contact_area',
    nullif(elem->>'contact_kind', ''),
    elem->>'contact_org',
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

REVOKE EXECUTE ON FUNCTION public._replace_requirement_children(uuid, jsonb) FROM PUBLIC, anon, authenticated;
