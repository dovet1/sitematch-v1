-- Brand Matcher: how far apart each brand's stores usually are, so distance only rewards a site
-- inside the area the brand trades in.
--
-- The Nearest store signal gave full points to any site 10+ miles from the brand's nearest store,
-- so a brand that only trades in Northern Ireland (Centra) or London scored as having a gap
-- everywhere else. A brand's spacing is the 90th percentile of the distance from each of its
-- stores to its next nearest one. Of 3,679 dated openings since 2021, 90% opened within 1.2x
-- the brand's spacing of an existing store and 99% within 3.4x; the score tapers between 2x and
-- 5x (scoreMatch in brand-matcher.ts).
--
-- Finding every store's nearest same-brand store takes about 80 seconds for 62,000 stores,
-- longer than PostgREST's 8-second statement cap, so refresh_brand_store_spacing() works through
-- brands in id order up to a store budget per call and returns where it stopped. The daily cron
-- (/api/cron/refresh-brand-store-spacing) calls it until it returns NULL.

CREATE TABLE IF NOT EXISTS public.brand_store_spacing (
  brand_id     uuid PRIMARY KEY REFERENCES public.brands(id) ON DELETE CASCADE,
  store_count  integer NOT NULL,
  -- NULL for a brand with one located store: there is no gap to measure.
  p90_gap_m    double precision,
  refreshed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_store_spacing ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.brand_store_spacing FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.brand_store_spacing TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_brand_store_spacing(
  p_after uuid DEFAULT NULL,
  p_max_stores integer DEFAULT 4000
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ids  uuid[];
  v_last uuid;
BEGIN
  -- The next brands in id order, up to p_max_stores located stores; always at least one brand,
  -- so a brand larger than the budget is still refreshed on its own.
  WITH counts AS (
    SELECT s.brand_id, count(*) AS n
    FROM public.stores s
    WHERE s.brand_id IS NOT NULL
      AND s.location IS NOT NULL
      AND (p_after IS NULL OR s.brand_id > p_after)
    GROUP BY s.brand_id
  ),
  running AS (
    SELECT c.brand_id, sum(c.n) OVER (ORDER BY c.brand_id) - c.n AS before
    FROM counts c
  )
  SELECT array_agg(r.brand_id ORDER BY r.brand_id), max(r.brand_id)
  INTO v_ids, v_last
  FROM running r
  WHERE r.before < p_max_stores;

  IF v_ids IS NULL THEN
    -- Past the last brand: drop rows for brands that no longer have a located store.
    DELETE FROM public.brand_store_spacing b
    WHERE NOT EXISTS (
      SELECT 1 FROM public.stores s WHERE s.brand_id = b.brand_id AND s.location IS NOT NULL
    );
    RETURN NULL;
  END IF;

  INSERT INTO public.brand_store_spacing (brand_id, store_count, p90_gap_m, refreshed_at)
  SELECT g.brand_id,
         count(*),
         percentile_cont(0.9) WITHIN GROUP (ORDER BY g.d),
         now()
  FROM (
    SELECT a.brand_id,
           (SELECT ST_Distance(a.location, b.location)
            FROM public.stores b
            WHERE b.brand_id = a.brand_id AND b.id <> a.id AND b.location IS NOT NULL
            ORDER BY b.location <-> a.location
            LIMIT 1) AS d
    FROM public.stores a
    WHERE a.brand_id = ANY(v_ids) AND a.location IS NOT NULL
  ) g
  GROUP BY g.brand_id
  ON CONFLICT (brand_id) DO UPDATE
    SET store_count = EXCLUDED.store_count,
        p90_gap_m = EXCLUDED.p90_gap_m,
        refreshed_at = EXCLUDED.refreshed_at;

  RETURN v_last;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.refresh_brand_store_spacing(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_brand_store_spacing(uuid, integer) TO service_role;
