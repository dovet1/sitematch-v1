-- Brand Matcher size bands: keep the towns in a band close in size.
--
-- 20261023020000 cut towns into bands of 200 by population. That works for small towns but the
-- top band ran from about 52,000 people to 1.1 million, so among the largest towns size still
-- swayed the ranks (a brand in big university cities came out as "student towns").
--
-- A band now also closes once its next town would be more than twice the population of its
-- smallest, provided it already holds at least 50 towns; a last band under 50 joins the one
-- below it. Small towns still sit in bands of 200, the largest in bands of about 50 that roughly
-- double in size from one to the next.
--
-- Run rebuild_bua_demographic_ranks() then rebuild_brand_demographic_profiles() afterwards.

DROP FUNCTION IF EXISTS public.rebuild_bua_demographic_ranks(integer);

CREATE OR REPLACE FUNCTION public.rebuild_bua_demographic_ranks(
  p_band_size integer DEFAULT 200,
  p_min_band integer DEFAULT 50,
  p_max_ratio double precision DEFAULT 2
) RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rows integer;
  v_town record;
  v_band integer := 1;
  v_count integer := 0;
  v_start double precision;
BEGIN
  CREATE TEMP TABLE pg_temp.bdr_bands (bua_gsscode text PRIMARY KEY, size_band integer NOT NULL) ON COMMIT DROP;

  -- Smallest first; code order breaks ties so a rebuild always draws the same lines. "C" collation
  -- keeps that order identical to the TypeScript mirror's.
  FOR v_town IN
    SELECT v.bua_gsscode, v.value
    FROM public.brand_matcher_bua_signals v
    WHERE v.signal_name = 'population'
    ORDER BY v.value, v.bua_gsscode COLLATE "C"
  LOOP
    IF v_start IS NULL THEN
      v_start := v_town.value;
    ELSIF v_count >= p_band_size OR (v_count >= p_min_band AND v_town.value > p_max_ratio * v_start) THEN
      v_band := v_band + 1;
      v_count := 0;
      v_start := v_town.value;
    END IF;
    INSERT INTO pg_temp.bdr_bands VALUES (v_town.bua_gsscode, v_band);
    v_count := v_count + 1;
  END LOOP;

  IF v_band > 1 AND v_count < p_min_band THEN
    UPDATE pg_temp.bdr_bands SET size_band = v_band - 1 WHERE size_band = v_band;
  END IF;

  DELETE FROM public.bua_demographic_ranks;

  INSERT INTO public.bua_demographic_ranks (bua_gsscode, signal_name, signal_category, value, size_band, rank)
  WITH banded AS (
    SELECT v.bua_gsscode, v.signal_name, v.signal_category, v.value, b.size_band,
           CASE WHEN v.signal_name = 'population' THEN 0 ELSE b.size_band END AS peer_group
    FROM public.brand_matcher_bua_signals v
    JOIN pg_temp.bdr_bands b ON b.bua_gsscode = v.bua_gsscode
  )
  SELECT bua_gsscode, signal_name, signal_category, value, size_band,
         cume_dist() OVER (PARTITION BY signal_name, peer_group ORDER BY value)
           - (count(*) OVER (PARTITION BY signal_name, peer_group, value))::double precision
             / (2 * count(*) OVER (PARTITION BY signal_name, peer_group))
  FROM banded;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  DROP TABLE pg_temp.bdr_bands;
  RETURN v_rows;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rebuild_bua_demographic_ranks(integer, integer, double precision)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_bua_demographic_ranks(integer, integer, double precision)
  TO service_role;
