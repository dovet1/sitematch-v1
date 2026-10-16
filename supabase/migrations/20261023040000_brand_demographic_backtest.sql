-- Brand Matcher demographic fit: a backtest that runs inside the database.
--
-- Question: does a fascia's town profile pick out the towns it really trades in, compared with
-- towns of the same size it does not trade in? For each fascia, hold back 20% of its towns, build
-- the profile from the rest, then score the held-back towns and same-size towns it is not in. AUC
-- is the chance a real town outscores one it is not in: 0.5 is a coin toss, 0.7+ is useful.
--
-- This mirrors runBacktest() in brand-matcher-demographics-backtest.ts and the scoring in
-- brand-matcher-demographics.ts, and agrees with them unit for unit (towns are split by the same
-- md5-based hash). Read-only apart from what rebuild_brand_demographic_profiles() writes.
--
-- Pieces:
--   1. brand_bua_presence_snapshot — which towns each brand/fascia trades in, saved by
--      rebuild_brand_demographic_profiles() so the backtest need not redo the store-to-town
--      spatial join (about 30 seconds) on every call.
--   2. brand_matcher_hash01, brand_matcher_signal_fit — the split and the per-signal fit.
--   3. brand_demographic_backtest(from, to) — results per fascia, in batches by unit number.

-- ---------------------------------------------------------------------------
-- 1. brand_bua_presence_snapshot, written by the profile rebuild
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.brand_bua_presence_snapshot (
  brand_id    uuid    NOT NULL,
  fascia_id   uuid,
  bua_gsscode text    NOT NULL,
  store_count bigint  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_brand_bua_presence_snapshot_brand
  ON public.brand_bua_presence_snapshot(brand_id);

ALTER TABLE public.brand_bua_presence_snapshot ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.brand_bua_presence_snapshot FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_bua_presence_snapshot TO service_role;

COMMENT ON TABLE public.brand_bua_presence_snapshot IS
  'Brand Matcher: brand_bua_presence() as of the last rebuild_brand_demographic_profiles().';

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

  INSERT INTO public.brand_bua_presence_snapshot (brand_id, fascia_id, bua_gsscode, store_count)
  SELECT p.brand_id, p.fascia_id, p.bua_gsscode, p.store_count
  FROM public.brand_bua_presence() p
  WHERE p_brand_ids IS NULL OR p.brand_id = ANY(p_brand_ids);

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

-- ---------------------------------------------------------------------------
-- 2. Helpers, mirroring hash01() and signalFit() in TypeScript
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.brand_matcher_hash01(p_text text)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT ('x' || substr(md5(p_text), 1, 8))::bit(32)::bigint / 4294967296.0::double precision;
$$;

-- 1 inside p25..p75, easing to 0.5 at p10/p90, then to 0 by the same distance again beyond.
CREATE OR REPLACE FUNCTION public.brand_matcher_signal_fit(
  v double precision, p10 double precision, p25 double precision, p75 double precision, p90 double precision
)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN v >= p25 AND v <= p75 THEN 1
    WHEN v < p25 AND v >= p10 THEN 0.5 + 0.5 * (v - p10) / (p25 - p10)
    WHEN v < p10 THEN CASE WHEN p25 > p10 THEN greatest(0, 0.5 * (1 - (p10 - v) / (p25 - p10))) ELSE 0 END
    WHEN v <= p90 THEN 0.5 + 0.5 * (p90 - v) / (p90 - p75)
    ELSE CASE WHEN p90 > p75 THEN greatest(0, 0.5 * (1 - (v - p90) / (p90 - p75))) ELSE 0 END
  END::double precision;
$$;

REVOKE EXECUTE ON FUNCTION public.brand_matcher_hash01(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.brand_matcher_hash01(text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.brand_matcher_signal_fit(double precision, double precision, double precision, double precision, double precision)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.brand_matcher_signal_fit(double precision, double precision, double precision, double precision, double precision)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 3. brand_demographic_backtest
--    One row per fascia with enough towns, numbered by unit_no; pass a range to run in batches.
--    auc_demographics is NULL for a "broad" fascia (typical for its size on every measure).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.brand_demographic_backtest(
  p_unit_from integer DEFAULT 1,
  p_unit_to integer DEFAULT 1000000,
  p_holdout double precision DEFAULT 0.2,
  p_negatives integer DEFAULT 300,
  p_min_towns integer DEFAULT 12
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
  member AS (
    SELECT DISTINCT s.brand_id, s.fascia_id, s.brand_id::text || '/' || s.fascia_id::text AS ukey, s.bua_gsscode,
           brand_matcher_hash01(s.brand_id::text || '/' || s.fascia_id::text || '|' || s.bua_gsscode) < p_holdout AS is_test
    FROM brand_bua_presence_snapshot s
    JOIN town t ON t.bua_gsscode = s.bua_gsscode
    WHERE s.fascia_id IS NOT NULL
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
  -- For each held-back town, towns from its own size band the fascia is not in.
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
  -- Towns of any size the fascia is not in, for town size on its own.
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

REVOKE EXECUTE ON FUNCTION public.brand_demographic_backtest(integer, integer, double precision, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.brand_demographic_backtest(integer, integer, double precision, integer, integer)
  TO service_role;
