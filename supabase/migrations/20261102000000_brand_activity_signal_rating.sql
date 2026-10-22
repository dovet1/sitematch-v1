-- Brand activity as an acquisition signal: every article carries a rating from -5 (the brand is
-- closing stores) to +5 (it is opening as fast as it can), and the Brand Matcher derives a
-- brand's news score from them, which moves its Acquisitive score (newsScore and acquisitivePoints in
-- apps/web/src/app/sitematcher-unified/lib/brand-matcher.ts).
--
-- brand_activity becomes the one article log the matcher reads. brand_openings stays the sourced
-- opening history; each of its rows is mirrored here as an opening article so imports keep
-- reaching the matcher without a second step.

ALTER TABLE public.brand_activity DROP CONSTRAINT IF EXISTS brand_activity_kind_check;
ALTER TABLE public.brand_activity
  ADD CONSTRAINT brand_activity_kind_check CHECK (kind IN ('opening', 'closure', 'news'));

ALTER TABLE public.brand_activity
  ADD COLUMN signal_rating smallint NOT NULL DEFAULT 0 CHECK (signal_rating BETWEEN -5 AND 5),
  ADD COLUMN signal_reason text,
  ADD COLUMN signal_rated_by text NOT NULL DEFAULT 'default' CHECK (signal_rated_by IN ('admin', 'default')),
  ADD COLUMN brand_opening_id uuid UNIQUE REFERENCES public.brand_openings(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.brand_activity.kind IS 'opening / closure for a single store; news for anything else about the estate (expansion plans, administration, funding).';
COMMENT ON COLUMN public.brand_activity.signal_rating IS 'How strong a signal the article is that the brand is acquiring now: -5 (closing every store) to +5 (needs many stores soon). 0 is neutral.';
COMMENT ON COLUMN public.brand_activity.signal_reason IS 'Optional line on why the rating was given.';
COMMENT ON COLUMN public.brand_activity.signal_rated_by IS 'admin: set or confirmed by an admin. default: the kind''s default (opening +2, closure -2), not yet reviewed.';
COMMENT ON COLUMN public.brand_activity.brand_opening_id IS 'Set when the article was mirrored from brand_openings.';

-- Existing curated rows take the kind's default until someone reviews them.
UPDATE public.brand_activity
   SET signal_rating = CASE kind WHEN 'opening' THEN 2 WHEN 'closure' THEN -2 ELSE 0 END;

CREATE OR REPLACE FUNCTION public.brand_activity_from_opening()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.brand_activity
    (brand_id, kind, event_date, is_upcoming, headline, url, signal_rating, signal_rated_by, brand_opening_id)
  VALUES (
    NEW.brand_id,
    'opening',
    NEW.opening_date,
    NEW.status = 'planned' OR NEW.opening_date > current_date,
    CASE WHEN NEW.status = 'planned' OR NEW.opening_date > current_date
         THEN 'Opening in ' ELSE 'Opened in ' END || NEW.location,
    NEW.source_url,
    2,
    'default',
    NEW.id
  )
  ON CONFLICT (brand_opening_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS brand_openings_to_activity ON public.brand_openings;
CREATE TRIGGER brand_openings_to_activity
  AFTER INSERT ON public.brand_openings
  FOR EACH ROW EXECUTE FUNCTION public.brand_activity_from_opening();

-- Backfill the openings imported before the trigger existed.
INSERT INTO public.brand_activity
  (brand_id, kind, event_date, is_upcoming, headline, url, signal_rating, signal_rated_by, brand_opening_id)
SELECT o.brand_id,
       'opening',
       o.opening_date,
       o.status = 'planned' OR o.opening_date > current_date,
       CASE WHEN o.status = 'planned' OR o.opening_date > current_date
            THEN 'Opening in ' ELSE 'Opened in ' END || o.location,
       o.source_url,
       2,
       'default',
       o.id
  FROM public.brand_openings o
ON CONFLICT (brand_opening_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
