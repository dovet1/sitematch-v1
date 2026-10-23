-- Brand-level use classes.
--
-- Until now a brand's use classes were only implied by its requirements
-- (requirement_use_classes), so a brand with no active requirement had no use class at all and
-- Brand Matcher could neither show nor filter on one. brand_use_classes holds them against the
-- brand itself, pointing at the same shared use_classes lookup. Brand Matcher reads these first
-- and falls back to the requirement ones.
--
-- source records where a row came from, so the category defaults can be reviewed:
--   requirement - backfilled from the brand's active requirements
--   category    - defaulted from the brand's primary store category
--   admin       - set on the admin brand page (save_brand_use_classes)

CREATE TABLE IF NOT EXISTS public.brand_use_classes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id     uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  use_class_id uuid NOT NULL REFERENCES public.use_classes(id) ON DELETE CASCADE,
  source       text NOT NULL DEFAULT 'admin' CHECK (source IN ('requirement', 'category', 'admin')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, use_class_id)
);
CREATE INDEX IF NOT EXISTS idx_brand_use_classes_brand_id ON public.brand_use_classes(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_use_classes_use_class_id ON public.brand_use_classes(use_class_id);

COMMENT ON TABLE public.brand_use_classes IS
  'Use classes a brand trades under. Brand Matcher prefers these over the union of its requirement use classes.';

ALTER TABLE public.brand_use_classes ENABLE ROW LEVEL SECURITY;

-- Public read, like use_classes and brand_contacts; admin write mirrors requirement_use_classes.
CREATE POLICY "Public can view brand use classes" ON public.brand_use_classes
  FOR SELECT USING (true);
CREATE POLICY "Admins can manage brand use classes" ON public.brand_use_classes
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'));

-- Atomic replace from the admin brand page, by use class code. Unknown codes are ignored.
CREATE OR REPLACE FUNCTION public.save_brand_use_classes(p_brand_id uuid, p_codes text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.brand_use_classes WHERE brand_id = p_brand_id;
  INSERT INTO public.brand_use_classes (brand_id, use_class_id, source)
  SELECT p_brand_id, uc.id, 'admin'
  FROM public.use_classes uc
  WHERE uc.code = ANY (coalesce(p_codes, '{}'));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.save_brand_use_classes(uuid, text[]) FROM PUBLIC, anon, authenticated;

-- Backfill 1: every use class on the brand's active requirements.
INSERT INTO public.brand_use_classes (brand_id, use_class_id, source)
SELECT DISTINCT r.brand_id, ruc.use_class_id, 'requirement'
FROM public.requirements r
JOIN public.requirement_use_classes ruc ON ruc.requirement_id = r.id
WHERE r.status = 'active' AND r.brand_id IS NOT NULL
ON CONFLICT (brand_id, use_class_id) DO NOTHING;

-- Backfill 2: brands still without one get a default from their primary store category.
-- Shops, food and drink, gyms, clinics, nurseries and offices are Class E; storage is B (B8);
-- hotels are C (C1); car showrooms and EV charging hubs are Sui Generis. Brands with no
-- category are left for an admin to set.
WITH defaults(category, code) AS (
  VALUES
    ('Food & beverage', 'E'), ('Restaurant', 'E'), ('Coffee', 'E'),
    ('Retail', 'E'), ('Grocery', 'E'), ('Clothing', 'E'), ('Home and DIY Retail', 'E'),
    ('Mobile Network', 'E'), ('Healthcare & beauty', 'E'), ('Vet & petcare', 'E'),
    ('Gym', 'E'), ('Leisure & sport', 'E'), ('Leisure', 'E'), ('Padel', 'E'),
    ('Childcare & education', 'E'), ('Office', 'E'),
    ('Self Storage', 'B'), ('Storage', 'B'),
    ('Hotel', 'C'),
    ('EV Charging', 'Sui Generis'), ('Automotive', 'Sui Generis')
)
INSERT INTO public.brand_use_classes (brand_id, use_class_id, source)
SELECT b.id, uc.id, 'category'
FROM public.brands b
CROSS JOIN LATERAL public.brand_primary_category(b.id) cat
JOIN defaults d ON d.category = cat.child
JOIN public.use_classes uc ON uc.code = d.code
WHERE NOT EXISTS (SELECT 1 FROM public.brand_use_classes x WHERE x.brand_id = b.id)
ON CONFLICT (brand_id, use_class_id) DO NOTHING;
