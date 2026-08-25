-- Migration: Brand-level contacts + brand override fields + store-update rebuild trigger
-- Purpose:
--   1. brand_contacts — an in-house expansion-team member belongs to the *brand* and surfaces
--      on the brand info modal and on every requirement card for that brand. Mirrors
--      requirement_contacts columns; written atomically via save_brand_contacts().
--   2. brands override fields — admin-editable logo + "latest store" overrides that fall back
--      to values derived from stores.open_date when null.
--   3. store_update rebuild trigger — edits to a store now enqueue a cache rebuild (reason
--      'store_update'), matching the existing AFTER DELETE trigger (reason 'store_delete',
--      migration 057) so gap/proximity caches stay fresh.

-- ---------------------------------------------------------------------------
-- 1. brand_contacts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.brand_contacts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id           uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  contact_name       text,
  contact_title      text,
  contact_email      text,
  contact_phone      text,
  contact_area       text,
  headshot_url       text,
  is_primary_contact boolean NOT NULL DEFAULT false,
  contact_kind       text CHECK (contact_kind IS NULL OR contact_kind IN ('in-house','agency')) DEFAULT 'in-house',
  contact_org        text,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brand_contacts_brand_id ON public.brand_contacts(brand_id);

COMMENT ON COLUMN public.brand_contacts.contact_kind IS 'in-house = brand''s own team; agency = appointed agent. NULL = unspecified.';
COMMENT ON COLUMN public.brand_contacts.contact_org IS 'Contact organisation label shown as "role · org" in the brand info modal.';

ALTER TABLE public.brand_contacts ENABLE ROW LEVEL SECURITY;

-- Public exposure is an accepted product decision: brand contacts are intentionally readable
-- by anon so the brand info modal can surface direct outreach details even with no active
-- requirement. Admin write policy mirrors the requirement_contacts inline role check.
CREATE POLICY "Public can view brand contacts" ON public.brand_contacts
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage brand contacts" ON public.brand_contacts
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'));

-- Atomic replace, mirroring _replace_requirement_children's contact insert.
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
    contact_area, contact_kind, contact_org, headshot_url, is_primary_contact
  )
  SELECT p_brand_id,
    elem->>'contact_name', elem->>'contact_title', elem->>'contact_email',
    elem->>'contact_phone', elem->>'contact_area',
    nullif(elem->>'contact_kind',''), elem->>'contact_org',
    elem->>'headshot_url', coalesce((elem->>'is_primary_contact')::boolean, false)
  FROM jsonb_array_elements(coalesce(p_contacts, '[]'::jsonb)) AS elem;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.save_brand_contacts(uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- Derived (never stored) dominant primary category for a brand:
--   stores -> fascias -> fascia_categories(is_primary) -> categories (child + parent).
-- Rendered as "PARENT · CHILD" (or just child when no parent) by the API/modal.
CREATE OR REPLACE FUNCTION public.brand_primary_category(p_brand_id uuid)
RETURNS TABLE(child text, parent text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT c.name AS child, p.name AS parent
  FROM stores s
  JOIN fascias f ON f.id = s.fascia_id
  JOIN fascia_categories fc ON fc.fascia_id = f.id AND fc.is_primary
  JOIN categories c ON c.id = fc.category_id
  LEFT JOIN categories p ON p.id = c.parent_category_id
  WHERE s.brand_id = p_brand_id
  GROUP BY c.name, p.name
  ORDER BY count(*) DESC
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.brand_primary_category(uuid) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. brands override fields (all nullable, admin-editable)
-- ---------------------------------------------------------------------------
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS latest_store_name text,
  ADD COLUMN IF NOT EXISTS latest_store_town text,
  ADD COLUMN IF NOT EXISTS latest_store_opened_at date;

-- ---------------------------------------------------------------------------
-- 3. store_update -> cache_rebuild_queue trigger
--    Deletes already enqueue via trigger_enqueue_rebuild_on_store_delete (migration 057).
--    Add a matching AFTER UPDATE statement-level trigger with reason 'store_update' so the
--    hub's inline store edits flow through the same queue (processed by the existing cron /
--    admin rebuild endpoint) — the API layer fires nothing extra.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_cache_rebuild_on_store_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO cache_rebuild_queue (reason)
  VALUES ('store_update')
  ON CONFLICT DO NOTHING;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enqueue_rebuild_on_store_update ON public.stores;
CREATE TRIGGER trigger_enqueue_rebuild_on_store_update
  AFTER UPDATE ON public.stores
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.enqueue_cache_rebuild_on_store_update();
