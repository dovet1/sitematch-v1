-- Brand Matcher demographics: let the admin refresh run in short batches.
--
-- The app reaches the database through PostgREST, whose role caps every statement at 8 seconds.
-- A full profile rebuild takes about 45 seconds, because brand_bua_presence() places all 61,000
-- stores in their towns even when only a few brands are being rebuilt. It now takes the brands to
-- place, so the admin button (/api/admin/stores/refresh-brand-demographics) can rebuild 25 brands
-- per call in a second or two, then record backtest scores a few units per call.

DROP FUNCTION IF EXISTS public.brand_bua_presence();

CREATE FUNCTION public.brand_bua_presence(p_brand_ids uuid[] DEFAULT NULL)
RETURNS TABLE (brand_id uuid, fascia_id uuid, bua_gsscode text, store_count bigint)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT s.brand_id, s.fascia_id, g.gsscode, count(*)
  FROM public.stores s
  JOIN public.built_up_area_geometries g ON ST_Covers(g.geom, s.location::geometry)
  WHERE s.brand_id IS NOT NULL
    AND s.location IS NOT NULL
    AND (p_brand_ids IS NULL OR s.brand_id = ANY(p_brand_ids))
  GROUP BY s.brand_id, s.fascia_id, g.gsscode;
$$;

REVOKE EXECUTE ON FUNCTION public.brand_bua_presence(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.brand_bua_presence(uuid[]) TO service_role;

CREATE OR REPLACE FUNCTION public.rebuild_brand_demographic_profiles(
  p_brand_ids uuid[] DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rows integer;
BEGIN
  SET LOCAL statement_timeout = 0;

  DELETE FROM public.brand_bua_presence_snapshot s
  WHERE p_brand_ids IS NULL OR s.brand_id = ANY(p_brand_ids);

  -- Only the brands being rebuilt are placed in their towns.
  INSERT INTO public.brand_bua_presence_snapshot (brand_id, fascia_id, bua_gsscode, store_count)
  SELECT p.brand_id, p.fascia_id, p.bua_gsscode, p.store_count
  FROM public.brand_bua_presence(p_brand_ids) p;

  DELETE FROM public.brand_demographic_profiles d
  WHERE p_brand_ids IS NULL OR d.brand_id = ANY(p_brand_ids);

  INSERT INTO public.brand_demographic_profiles (
    brand_id, fascia_id, signal_name, signal_category,
    bua_count, store_count,
    p10, p25, median, p75, p90,
    rank_p10, rank_p25, median_rank, rank_p75, rank_p90,
    distinctiveness
  )
  WITH presence AS (
    SELECT * FROM public.brand_bua_presence_snapshot s
    WHERE p_brand_ids IS NULL OR s.brand_id = ANY(p_brand_ids)
  ),
  units AS (
    -- Each fascia, plus the brand as a whole. A town a brand trades in under two fascias is
    -- one town for the brand-level profile.
    SELECT p.brand_id, p.fascia_id, p.bua_gsscode, p.store_count
    FROM presence p
    WHERE p.fascia_id IS NOT NULL
    UNION ALL
    SELECT p.brand_id, NULL::uuid, p.bua_gsscode, sum(p.store_count)::bigint
    FROM presence p
    GROUP BY p.brand_id, p.bua_gsscode
  )
  SELECT u.brand_id,
         u.fascia_id,
         r.signal_name,
         r.signal_category,
         count(*)::integer,
         sum(u.store_count)::integer,
         percentile_cont(0.10) WITHIN GROUP (ORDER BY r.value),
         percentile_cont(0.25) WITHIN GROUP (ORDER BY r.value),
         percentile_cont(0.50) WITHIN GROUP (ORDER BY r.value),
         percentile_cont(0.75) WITHIN GROUP (ORDER BY r.value),
         percentile_cont(0.90) WITHIN GROUP (ORDER BY r.value),
         percentile_cont(0.10) WITHIN GROUP (ORDER BY r.rank),
         percentile_cont(0.25) WITHIN GROUP (ORDER BY r.rank),
         percentile_cont(0.50) WITHIN GROUP (ORDER BY r.rank),
         percentile_cont(0.75) WITHIN GROUP (ORDER BY r.rank),
         percentile_cont(0.90) WITHIN GROUP (ORDER BY r.rank),
         least(1, abs(percentile_cont(0.50) WITHIN GROUP (ORDER BY r.rank) - 0.5) * 2)
  FROM units u
  JOIN public.bua_demographic_ranks r ON r.bua_gsscode = u.bua_gsscode
  GROUP BY u.brand_id, u.fascia_id, r.signal_name, r.signal_category
  HAVING count(*) >= 8;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rebuild_brand_demographic_profiles(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_brand_demographic_profiles(uuid[]) TO service_role;
