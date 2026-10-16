-- Brand Matcher demographic fit, phase 2: keep each profile's backtest score, so the card shows a
-- demographic pill only where the profile has been shown to pick out the towns the brand really
-- trades in.
--
-- The backtest found a real but uneven signal: across 128 fascias with a distinctive profile the
-- median AUC was 0.62, with strong results for brands such as Gail's (0.87) and Waitrose (0.79)
-- and none for others such as Safestore (0.33). A pill that is right for Waitrose and misleading
-- for Safestore would undermine all of them, so the route reads these scores and shows a fit
-- only for profiles that reached MIN_VALIDATED_AUC (brand-matcher-demographics.ts).
--
-- Small fascias fall back to their brand's whole estate (Little Waitrose -> Waitrose), so the
-- backtest now also runs per brand.
--
-- Run after rebuild_brand_demographic_profiles(), in batches:
--   select record_brand_demographic_backtest('fascia', 1, 75);   -- then 76-150, 151-...
--   select record_brand_demographic_backtest('brand', 1, 75);    -- and so on
-- The first batch of a level (from = 1) clears that level's old scores.

INSERT INTO public.feature_flags (key, enabled, description)
VALUES ('brand_matcher_demographics_enabled', false, 'Demographic fit pill on Brand Matcher cards')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 1. brand_demographic_backtest: also per brand (p_level = 'brand')
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.brand_demographic_backtest(integer, integer, double precision, integer, integer);

CREATE FUNCTION public.brand_demographic_backtest(
  p_unit_from integer DEFAULT 1,
  p_unit_to integer DEFAULT 1000000,
  p_holdout double precision DEFAULT 0.2,
  p_negatives integer DEFAULT 300,
  p_min_towns integer DEFAULT 12,
  p_level text DEFAULT 'fascia'
)
RETURNS TABLE (
  unit_no bigint,
  brand_id uuid,
  fascia_id uuid,
  brand_name text,
  fascia_name text,
  towns bigint,
  held_out bigint,
  broad boolean,
  auc_demographics double precision,
  auc_size double precision,
  top_signals text[],
  held_out_good bigint,
  held_out_partial bigint,
  held_out_weak bigint,
  other_good bigint,
  other_partial bigint,
  other_weak bigint
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  WITH town AS (
    SELECT r.bua_gsscode, max(r.size_band) AS size_band
    FROM bua_demographic_ranks r
    GROUP BY r.bua_gsscode
  ),
  -- A unit is a fascia, or a whole brand. Key text matches runBacktest(): "brand/fascia" or "brand".
  member AS (
    SELECT DISTINCT u.brand_id, u.fascia_id, u.ukey, u.bua_gsscode,
           brand_matcher_hash01(u.ukey || '|' || u.bua_gsscode) < p_holdout AS is_test
    FROM (
      SELECT s.brand_id,
             CASE WHEN p_level = 'brand' THEN NULL ELSE s.fascia_id END AS fascia_id,
             CASE WHEN p_level = 'brand' THEN s.brand_id::text ELSE s.brand_id::text || '/' || s.fascia_id::text END AS ukey,
             s.bua_gsscode
      FROM brand_bua_presence_snapshot s
      JOIN town t ON t.bua_gsscode = s.bua_gsscode
      WHERE p_level = 'brand' OR s.fascia_id IS NOT NULL
    ) u
  ),
  unit AS (
    SELECT m.ukey, m.brand_id, m.fascia_id, count(*) AS towns, count(*) FILTER (WHERE m.is_test) AS held_out,
           row_number() OVER (ORDER BY m.ukey COLLATE "C") AS unit_no
    FROM member m
    GROUP BY m.ukey, m.brand_id, m.fascia_id
    HAVING count(*) >= p_min_towns
       AND count(*) FILTER (WHERE NOT m.is_test) >= 8
       AND count(*) FILTER (WHERE m.is_test) >= 2
  ),
  batch AS (
    SELECT * FROM unit u WHERE u.unit_no BETWEEN p_unit_from AND p_unit_to
  ),
  -- Profiles from the training towns only.
  train AS (
    SELECT b.ukey, r.signal_name, r.signal_category,
           percentile_cont(0.10) WITHIN GROUP (ORDER BY r.rank) AS p10,
           percentile_cont(0.25) WITHIN GROUP (ORDER BY r.rank) AS p25,
           percentile_cont(0.50) WITHIN GROUP (ORDER BY r.rank) AS median_rank,
           percentile_cont(0.75) WITHIN GROUP (ORDER BY r.rank) AS p75,
           percentile_cont(0.90) WITHIN GROUP (ORDER BY r.rank) AS p90
    FROM batch b
    JOIN member m ON m.ukey = b.ukey AND NOT m.is_test
    JOIN bua_demographic_ranks r ON r.bua_gsscode = m.bua_gsscode
    GROUP BY b.ukey, r.signal_name, r.signal_category
    HAVING count(*) >= 8
  ),
  train_d AS (
    SELECT t.*, least(1, abs(t.median_rank - 0.5) * 2) AS dist FROM train t
  ),
  -- demographicFit(): one signal per category, distinctive ones only, the top four.
  best AS (
    SELECT DISTINCT ON (d.ukey, d.signal_category) d.*
    FROM train_d d
    WHERE d.signal_name <> 'population'
    ORDER BY d.ukey, d.signal_category, d.dist DESC, d.signal_name COLLATE "C"
  ),
  chosen AS (
    SELECT * FROM (
      SELECT b.*, row_number() OVER (PARTITION BY b.ukey ORDER BY b.dist DESC, b.signal_name COLLATE "C") AS k
      FROM best b
      WHERE b.dist >= 0.3
    ) x
    WHERE x.k <= 4
  ),
  test_town AS (
    SELECT m.ukey, m.bua_gsscode, t.size_band
    FROM member m
    JOIN batch b ON b.ukey = m.ukey
    JOIN town t ON t.bua_gsscode = m.bua_gsscode
    WHERE m.is_test
  ),
  per_town AS (
    SELECT tt.ukey, ceil(p_negatives::numeric / count(*))::integer AS k
    FROM test_town tt
    GROUP BY tt.ukey
  ),
  -- For each held-back town, towns from its own size band the unit is not in.
  matched AS (
    SELECT DISTINCT x.ukey, x.bua_gsscode
    FROM (
      SELECT tt.ukey, t2.bua_gsscode,
             row_number() OVER (
               PARTITION BY tt.ukey, tt.bua_gsscode
               ORDER BY brand_matcher_hash01(tt.ukey || '|neg|' || tt.bua_gsscode || '|' || t2.bua_gsscode)
             ) AS rn
      FROM test_town tt
      JOIN town t2 ON t2.size_band = tt.size_band
      WHERE NOT EXISTS (SELECT 1 FROM member m WHERE m.ukey = tt.ukey AND m.bua_gsscode = t2.bua_gsscode)
    ) x
    JOIN per_town p ON p.ukey = x.ukey
    WHERE x.rn <= p.k
  ),
  -- Towns of any size the unit is not in, for town size on its own.
  any_size AS (
    SELECT x.ukey, x.bua_gsscode
    FROM (
      SELECT b.ukey, t.bua_gsscode,
             row_number() OVER (PARTITION BY b.ukey ORDER BY brand_matcher_hash01(b.ukey || '|any|' || t.bua_gsscode)) AS rn
      FROM batch b
      CROSS JOIN town t
      WHERE NOT EXISTS (SELECT 1 FROM member m WHERE m.ukey = b.ukey AND m.bua_gsscode = t.bua_gsscode)
    ) x
    WHERE x.rn <= p_negatives
  ),
  demo_scored AS (
    SELECT s.ukey, s.bua_gsscode, s.role,
           sum(c.dist * brand_matcher_signal_fit(r.rank, c.p10, c.p25, c.p75, c.p90)) / sum(c.dist) AS score
    FROM (
      SELECT tt.ukey, tt.bua_gsscode, 'pos'::text AS role FROM test_town tt
      UNION ALL
      SELECT mt.ukey, mt.bua_gsscode, 'neg' FROM matched mt
    ) s
    JOIN chosen c ON c.ukey = s.ukey
    JOIN bua_demographic_ranks r ON r.bua_gsscode = s.bua_gsscode AND r.signal_name = c.signal_name
    GROUP BY s.ukey, s.bua_gsscode, s.role
  ),
  demo_auc AS (
    SELECT p.ukey,
           avg(CASE WHEN n.score < p.score THEN 1.0 WHEN n.score = p.score THEN 0.5 ELSE 0.0 END)::double precision AS auc
    FROM demo_scored p
    JOIN demo_scored n ON n.ukey = p.ukey AND n.role = 'neg'
    WHERE p.role = 'pos'
    GROUP BY p.ukey
  ),
  demo_bands AS (
    SELECT d.ukey,
           count(*) FILTER (WHERE d.role = 'pos' AND d.score >= 0.75) AS pos_good,
           count(*) FILTER (WHERE d.role = 'pos' AND d.score >= 0.5 AND d.score < 0.75) AS pos_partial,
           count(*) FILTER (WHERE d.role = 'pos' AND d.score < 0.5) AS pos_weak,
           count(*) FILTER (WHERE d.role = 'neg' AND d.score >= 0.75) AS neg_good,
           count(*) FILTER (WHERE d.role = 'neg' AND d.score >= 0.5 AND d.score < 0.75) AS neg_partial,
           count(*) FILTER (WHERE d.role = 'neg' AND d.score < 0.5) AS neg_weak
    FROM demo_scored d
    GROUP BY d.ukey
  ),
  size_scored AS (
    SELECT s.ukey, s.role, brand_matcher_signal_fit(r.rank, sp.p10, sp.p25, sp.p75, sp.p90) AS score
    FROM (
      SELECT tt.ukey, tt.bua_gsscode, 'pos'::text AS role FROM test_town tt
      UNION ALL
      SELECT a.ukey, a.bua_gsscode, 'neg' FROM any_size a
    ) s
    JOIN train_d sp ON sp.ukey = s.ukey AND sp.signal_name = 'population'
    JOIN bua_demographic_ranks r ON r.bua_gsscode = s.bua_gsscode AND r.signal_name = 'population'
  ),
  size_auc AS (
    SELECT p.ukey,
           avg(CASE WHEN n.score < p.score THEN 1.0 WHEN n.score = p.score THEN 0.5 ELSE 0.0 END)::double precision AS auc
    FROM size_scored p
    JOIN size_scored n ON n.ukey = p.ukey AND n.role = 'neg'
    WHERE p.role = 'pos'
    GROUP BY p.ukey
  )
  SELECT b.unit_no, b.brand_id, b.fascia_id, br.name, f.name, b.towns, b.held_out,
         NOT EXISTS (SELECT 1 FROM chosen c WHERE c.ukey = b.ukey),
         da.auc, sa.auc,
         (SELECT array_agg(c.signal_name ORDER BY c.k) FROM chosen c WHERE c.ukey = b.ukey),
         coalesce(db.pos_good, 0), coalesce(db.pos_partial, 0), coalesce(db.pos_weak, 0),
         coalesce(db.neg_good, 0), coalesce(db.neg_partial, 0), coalesce(db.neg_weak, 0)
  FROM batch b
  JOIN brands br ON br.id = b.brand_id
  LEFT JOIN fascias f ON f.id = b.fascia_id
  LEFT JOIN demo_auc da ON da.ukey = b.ukey
  LEFT JOIN size_auc sa ON sa.ukey = b.ukey
  LEFT JOIN demo_bands db ON db.ukey = b.ukey
  ORDER BY b.unit_no;
$$;

REVOKE EXECUTE ON FUNCTION public.brand_demographic_backtest(integer, integer, double precision, integer, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.brand_demographic_backtest(integer, integer, double precision, integer, integer, text)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 2. brand_demographic_backtest_results + record_brand_demographic_backtest
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.brand_demographic_backtest_results (
  brand_id         uuid        NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  -- NULL = the brand as a whole.
  fascia_id        uuid        REFERENCES public.fascias(id) ON DELETE CASCADE,
  towns            integer     NOT NULL,
  held_out         integer     NOT NULL,
  -- Typical for their size on every measure: no profile to validate.
  broad            boolean     NOT NULL,
  -- Chance a real held-back town outscores a same-size town the unit is not in. NULL when broad.
  auc_demographics double precision,
  -- Town size alone, against towns of any size.
  auc_size         double precision,
  computed_at      timestamptz NOT NULL DEFAULT now(),
  fascia_key       uuid        GENERATED ALWAYS AS
                                 (coalesce(fascia_id, '00000000-0000-0000-0000-000000000000'::uuid)) STORED,
  PRIMARY KEY (brand_id, fascia_key)
);

ALTER TABLE public.brand_demographic_backtest_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.brand_demographic_backtest_results FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_demographic_backtest_results TO service_role;

COMMENT ON TABLE public.brand_demographic_backtest_results IS
  'Brand Matcher: backtest score per fascia and per brand, read by the route to decide where the demographic pill is shown. Written by record_brand_demographic_backtest().';

CREATE OR REPLACE FUNCTION public.record_brand_demographic_backtest(
  p_level text DEFAULT 'fascia',
  p_unit_from integer DEFAULT 1,
  p_unit_to integer DEFAULT 1000000
) RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rows integer;
BEGIN
  IF p_level NOT IN ('fascia', 'brand') THEN
    RAISE EXCEPTION 'p_level must be fascia or brand, not %', p_level;
  END IF;

  -- A fresh run of a level starts clean, so a unit that no longer qualifies loses its score.
  IF p_unit_from = 1 THEN
    DELETE FROM public.brand_demographic_backtest_results r
    WHERE (r.fascia_id IS NULL) = (p_level = 'brand');
  END IF;

  INSERT INTO public.brand_demographic_backtest_results
    (brand_id, fascia_id, towns, held_out, broad, auc_demographics, auc_size, computed_at)
  SELECT b.brand_id, b.fascia_id, b.towns, b.held_out, b.broad, b.auc_demographics, b.auc_size, now()
  FROM public.brand_demographic_backtest(p_unit_from, p_unit_to, 0.2, 300, 12, p_level) b
  ON CONFLICT (brand_id, fascia_key) DO UPDATE SET
    towns = EXCLUDED.towns,
    held_out = EXCLUDED.held_out,
    broad = EXCLUDED.broad,
    auc_demographics = EXCLUDED.auc_demographics,
    auc_size = EXCLUDED.auc_size,
    computed_at = EXCLUDED.computed_at;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_brand_demographic_backtest(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_brand_demographic_backtest(text, integer, integer) TO service_role;
