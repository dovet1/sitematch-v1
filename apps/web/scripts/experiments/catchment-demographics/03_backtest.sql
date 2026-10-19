-- Experiment only (scratch_catchment schema): the five-fold backtest of
-- brand_demographic_backtest() (migration 20261023060000), with neighbourhood catchments in place
-- of towns. Differences from the town version, and why:
--   * A unit's "towns" are the distinct LSOAs its stores sit in; each is scored on its catchment.
--   * Ranks are within density bands (people within 1km), not town-size bands.
--   * Folds are dealt by ~5km grid cell, not by place: neighbouring stores share catchment LSOAs,
--     so dealing them into different folds would let a profile see its own test sites.
--   * Negatives are retail neighbourhoods (an LSOA with any store) in the same density band,
--     excluding any within 1km of the unit's stores: a gap between two of its stores is not
--     evidence it would not trade there.
--   * "size" becomes density alone (people within 1km), against any retail neighbourhood.
CREATE OR REPLACE FUNCTION scratch_catchment.backtest(
  p_unit_from integer DEFAULT 1,
  p_unit_to integer DEFAULT 1000000,
  p_folds integer DEFAULT 5,
  p_negatives integer DEFAULT 300,
  p_min_towns integer DEFAULT 12,
  p_level text DEFAULT 'fascia'
)
RETURNS TABLE (
  unit_no bigint, brand_id uuid, fascia_id uuid, brand_name text, fascia_name text,
  towns bigint, held_out bigint, broad boolean,
  auc_demographics double precision, auc_size double precision, top_signals text[],
  held_out_good bigint, held_out_partial bigint, held_out_weak bigint,
  other_good bigint, other_partial bigint, other_weak bigint
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  WITH town AS (
    SELECT r.lsoa_code, max(r.size_band) AS size_band
    FROM scratch_catchment.ranks r
    GROUP BY r.lsoa_code
  ),
  member AS (
    SELECT DISTINCT u.brand_id, u.fascia_id, u.ukey, u.lsoa_code,
           floor(brand_matcher_hash01(u.ukey || '|' || u.cell) * p_folds)::integer AS fold
    FROM (
      SELECT s.brand_id,
             CASE WHEN p_level = 'brand' THEN NULL ELSE s.fascia_id END AS fascia_id,
             CASE WHEN p_level = 'brand' THEN s.brand_id::text ELSE s.brand_id::text || '/' || s.fascia_id::text END AS ukey,
             s.lsoa_code,
             floor(b.lat / 0.05)::text || ':' || floor(b.lng / 0.05)::text AS cell
      FROM scratch_catchment.presence s
      JOIN lsoa_boundaries b ON b.lsoa_code = s.lsoa_code
      JOIN town t ON t.lsoa_code = s.lsoa_code
      WHERE p_level = 'brand' OR s.fascia_id IS NOT NULL
    ) u
  ),
  candidate AS (
    SELECT m.ukey, m.brand_id, m.fascia_id, count(*) AS towns
    FROM member m
    GROUP BY m.ukey, m.brand_id, m.fascia_id
    HAVING count(*) >= p_min_towns
  ),
  fold_all AS (
    SELECT c.ukey, f.k
    FROM candidate c
    CROSS JOIN generate_series(0, p_folds - 1) AS f(k)
    JOIN member m ON m.ukey = c.ukey
    GROUP BY c.ukey, f.k
    HAVING count(*) FILTER (WHERE m.fold = f.k) >= 1
       AND count(*) FILTER (WHERE m.fold <> f.k) >= 8
  ),
  unit AS (
    SELECT c.*, row_number() OVER (ORDER BY c.ukey COLLATE "C") AS unit_no
    FROM candidate c
    WHERE EXISTS (SELECT 1 FROM fold_all fa WHERE fa.ukey = c.ukey)
  ),
  batch AS (
    SELECT * FROM unit u WHERE u.unit_no BETWEEN p_unit_from AND p_unit_to
  ),
  fold AS (
    SELECT fa.* FROM fold_all fa JOIN batch b ON b.ukey = fa.ukey
  ),
  -- Neighbourhoods within 1km of the unit's stores: never negatives.
  excluded AS (
    SELECT DISTINCT m.ukey, n.dst AS lsoa_code
    FROM member m
    JOIN batch b ON b.ukey = m.ukey
    JOIN scratch_catchment.nbr1k n ON n.src = m.lsoa_code
  ),
  train AS (
    SELECT fo.ukey, fo.k, r.signal_name, r.signal_category,
           percentile_cont(0.10) WITHIN GROUP (ORDER BY r.rank) AS p10,
           percentile_cont(0.25) WITHIN GROUP (ORDER BY r.rank) AS p25,
           percentile_cont(0.50) WITHIN GROUP (ORDER BY r.rank) AS median_rank,
           percentile_cont(0.75) WITHIN GROUP (ORDER BY r.rank) AS p75,
           percentile_cont(0.90) WITHIN GROUP (ORDER BY r.rank) AS p90
    FROM fold fo
    JOIN member m ON m.ukey = fo.ukey AND m.fold <> fo.k
    JOIN scratch_catchment.ranks r ON r.lsoa_code = m.lsoa_code
    GROUP BY fo.ukey, fo.k, r.signal_name, r.signal_category
    HAVING count(*) >= 8
  ),
  train_d AS (
    SELECT t.*, least(1, abs(t.median_rank - 0.5) * 2) AS dist FROM train t
  ),
  best AS (
    SELECT DISTINCT ON (d.ukey, d.k, d.signal_category) d.*
    FROM train_d d
    WHERE d.signal_name <> 'population'
    ORDER BY d.ukey, d.k, d.signal_category, d.dist DESC, d.signal_name COLLATE "C"
  ),
  chosen AS (
    SELECT * FROM (
      SELECT b.*, row_number() OVER (PARTITION BY b.ukey, b.k ORDER BY b.dist DESC, b.signal_name COLLATE "C") AS rk
      FROM best b
      WHERE b.dist >= 0.3
    ) x
    WHERE x.rk <= 4
  ),
  test_town AS (
    SELECT fo.ukey, fo.k, m.lsoa_code, t.size_band
    FROM fold fo
    JOIN member m ON m.ukey = fo.ukey AND m.fold = fo.k
    JOIN town t ON t.lsoa_code = m.lsoa_code
  ),
  per_town AS (
    SELECT tt.ukey, ceil(p_negatives::numeric / count(*))::integer AS n
    FROM test_town tt
    GROUP BY tt.ukey
  ),
  matched AS (
    SELECT DISTINCT x.ukey, x.k, x.lsoa_code
    FROM (
      SELECT tt.ukey, tt.k, t2.lsoa_code,
             row_number() OVER (
               PARTITION BY tt.ukey, tt.k, tt.lsoa_code
               ORDER BY brand_matcher_hash01(tt.ukey || '|neg|' || tt.lsoa_code || '|' || t2.lsoa_code)
             ) AS rn
      FROM test_town tt
      JOIN town t2 ON t2.size_band = tt.size_band
      WHERE EXISTS (SELECT 1 FROM chosen c WHERE c.ukey = tt.ukey AND c.k = tt.k)
        AND NOT EXISTS (SELECT 1 FROM excluded e WHERE e.ukey = tt.ukey AND e.lsoa_code = t2.lsoa_code)
    ) x
    JOIN per_town p ON p.ukey = x.ukey
    WHERE x.rn <= p.n
  ),
  any_size AS (
    SELECT x.ukey, x.lsoa_code
    FROM (
      SELECT b.ukey, t.lsoa_code,
             row_number() OVER (PARTITION BY b.ukey ORDER BY brand_matcher_hash01(b.ukey || '|any|' || t.lsoa_code)) AS rn
      FROM batch b
      CROSS JOIN town t
      WHERE NOT EXISTS (SELECT 1 FROM excluded e WHERE e.ukey = b.ukey AND e.lsoa_code = t.lsoa_code)
    ) x
    WHERE x.rn <= p_negatives
  ),
  demo_scored AS (
    SELECT s.ukey, s.k, s.lsoa_code, s.role,
           sum(c.dist * brand_matcher_signal_fit(r.rank, c.p10, c.p25, c.p75, c.p90)) / sum(c.dist) AS score
    FROM (
      SELECT tt.ukey, tt.k, tt.lsoa_code, 'pos'::text AS role FROM test_town tt
      UNION ALL
      SELECT mt.ukey, mt.k, mt.lsoa_code, 'neg' FROM matched mt
    ) s
    JOIN chosen c ON c.ukey = s.ukey AND c.k = s.k
    JOIN scratch_catchment.ranks r ON r.lsoa_code = s.lsoa_code AND r.signal_name = c.signal_name
    GROUP BY s.ukey, s.k, s.lsoa_code, s.role
  ),
  demo_auc AS (
    SELECT p.ukey,
           avg(CASE WHEN n.score < p.score THEN 1.0 WHEN n.score = p.score THEN 0.5 ELSE 0.0 END)::double precision AS auc
    FROM demo_scored p
    JOIN demo_scored n ON n.ukey = p.ukey AND n.k = p.k AND n.role = 'neg'
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
    SELECT s.ukey, s.k, s.role, brand_matcher_signal_fit(r.rank, sp.p10, sp.p25, sp.p75, sp.p90) AS score
    FROM (
      SELECT tt.ukey, tt.k, tt.lsoa_code, 'pos'::text AS role FROM test_town tt
      UNION ALL
      SELECT a.ukey, fo.k, a.lsoa_code, 'neg' FROM any_size a JOIN fold fo ON fo.ukey = a.ukey
    ) s
    JOIN train_d sp ON sp.ukey = s.ukey AND sp.k = s.k AND sp.signal_name = 'population'
    JOIN scratch_catchment.ranks r ON r.lsoa_code = s.lsoa_code AND r.signal_name = 'population'
  ),
  size_auc AS (
    SELECT p.ukey,
           avg(CASE WHEN n.score < p.score THEN 1.0 WHEN n.score = p.score THEN 0.5 ELSE 0.0 END)::double precision AS auc
    FROM size_scored p
    JOIN size_scored n ON n.ukey = p.ukey AND n.k = p.k AND n.role = 'neg'
    WHERE p.role = 'pos'
    GROUP BY p.ukey
  )
  SELECT b.unit_no, b.brand_id, b.fascia_id, br.name, f.name, b.towns,
         (SELECT count(*) FROM test_town tt WHERE tt.ukey = b.ukey),
         NOT EXISTS (SELECT 1 FROM chosen c WHERE c.ukey = b.ukey),
         da.auc, sa.auc,
         (SELECT array_agg(c.signal_name ORDER BY c.rk) FROM chosen c
          WHERE c.ukey = b.ukey AND c.k = (SELECT min(c2.k) FROM chosen c2 WHERE c2.ukey = b.ukey)),
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

CREATE TABLE IF NOT EXISTS scratch_catchment.results (
  level text, unit_no bigint, brand_id uuid, fascia_id uuid, brand_name text, fascia_name text,
  towns bigint, held_out bigint, broad boolean,
  auc_demographics double precision, auc_size double precision, top_signals text[],
  held_out_good bigint, held_out_partial bigint, held_out_weak bigint,
  other_good bigint, other_partial bigint, other_weak bigint
);
