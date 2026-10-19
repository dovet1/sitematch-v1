-- Experiment only: neighbourhood catchments for Brand Matcher demographic profiles.
-- Everything lives in the throwaway scratch_catchment schema (drop it to clean up). Run in order;
-- each statement fits in the 2-minute limit of the SQL editor on Micro compute.
--
-- Unit: the LSOA a store sits in. Each such LSOA (14,898 with a store) gets a catchment: every
-- LSOA whose centroid is within 1km, widened to 3km where fewer than 5,000 people live within 1km,
-- and to 5km where 3km still has fewer than 5,000. Catchment measures are the same census
-- components and index formulas as the town signals (calculate_demographic_index), summed over
-- the catchment's LSOAs. "population" is people within 1km, the density measure.

CREATE SCHEMA IF NOT EXISTS scratch_catchment;

CREATE TABLE scratch_catchment.lsoa_pt AS
  SELECT b.lsoa_code, ST_SetSRID(ST_MakePoint(b.lng::float8, b.lat::float8), 4326)::geography AS g,
         coalesce(m.numerator, 0)::float8 AS pop
  FROM lsoa_boundaries b
  LEFT JOIN lsoa_metrics m ON m.geo_code = b.lsoa_code AND m.component_id = 'population_total' AND m.edition = '2021';
CREATE INDEX ON scratch_catchment.lsoa_pt USING gist (g);
CREATE UNIQUE INDEX ON scratch_catchment.lsoa_pt (lsoa_code);

-- Located stores in England and Wales, placed in their LSOA (54,328 stores, 295 brands).
CREATE TABLE scratch_catchment.store_lsoa (store_id uuid PRIMARY KEY, brand_id uuid, fascia_id uuid, lsoa_code text);
INSERT INTO scratch_catchment.store_lsoa
SELECT s.id, s.brand_id, s.fascia_id, l.lsoa_code
FROM stores s
JOIN LATERAL (SELECT b.lsoa_code FROM lsoa_boundaries b WHERE ST_Covers(b.geometry, s.location::geometry) LIMIT 1) l ON true
WHERE s.brand_id IS NOT NULL AND s.location IS NOT NULL;

CREATE TABLE scratch_catchment.presence AS
  SELECT brand_id, fascia_id, lsoa_code, count(*) AS store_count FROM scratch_catchment.store_lsoa GROUP BY 1, 2, 3;
CREATE TABLE scratch_catchment.uni AS SELECT DISTINCT lsoa_code FROM scratch_catchment.store_lsoa;

CREATE TABLE scratch_catchment.nbr1k AS
  SELECT u.lsoa_code AS src, n.lsoa_code AS dst, n.pop
  FROM scratch_catchment.uni u
  JOIN scratch_catchment.lsoa_pt p ON p.lsoa_code = u.lsoa_code
  JOIN scratch_catchment.lsoa_pt n ON ST_DWithin(n.g, p.g, 1000);
CREATE TABLE scratch_catchment.density AS
  SELECT src AS lsoa_code, sum(pop) AS pop1k FROM scratch_catchment.nbr1k GROUP BY src;

CREATE TABLE scratch_catchment.nbr3k AS
  SELECT d.lsoa_code AS src, n.lsoa_code AS dst, n.pop
  FROM scratch_catchment.density d
  JOIN scratch_catchment.lsoa_pt p ON p.lsoa_code = d.lsoa_code
  JOIN scratch_catchment.lsoa_pt n ON ST_DWithin(n.g, p.g, 3000)
  WHERE d.pop1k < 5000;
CREATE TABLE scratch_catchment.nbr5k AS
  SELECT z.src, n.lsoa_code AS dst, n.pop
  FROM (SELECT src FROM scratch_catchment.nbr3k GROUP BY src HAVING sum(pop) < 5000) z
  JOIN scratch_catchment.lsoa_pt p ON p.lsoa_code = z.src
  JOIN scratch_catchment.lsoa_pt n ON ST_DWithin(n.g, p.g, 5000);

-- 10,072 catchments at 1km, 3,767 at 3km, 1,059 at 5km.
CREATE TABLE scratch_catchment.catch AS
  SELECT src, dst, 1000 AS radius FROM scratch_catchment.nbr1k
  WHERE src IN (SELECT lsoa_code FROM scratch_catchment.density WHERE pop1k >= 5000)
  UNION ALL
  SELECT src, dst, 3000 FROM scratch_catchment.nbr3k WHERE src NOT IN (SELECT src FROM scratch_catchment.nbr5k)
  UNION ALL
  SELECT src, dst, 5000 FROM scratch_catchment.nbr5k;
CREATE INDEX ON scratch_catchment.catch (src);

-- The census components the signals read.
CREATE TABLE scratch_catchment.comp AS
  SELECT DISTINCT k AS component_id
  FROM demographic_signal_mappings m,
  LATERAL (SELECT jsonb_object_keys(coalesce(m.calculation_rules->'components', '{}'))
           UNION ALL SELECT jsonb_object_keys(coalesce(m.calculation_rules->'stable_components', '{}'))
           UNION ALL SELECT jsonb_object_keys(coalesce(m.calculation_rules->'transient_components', '{}'))
           UNION ALL SELECT jsonb_object_keys(coalesce(m.calculation_rules->'walkable_components', '{}'))
           UNION ALL SELECT jsonb_object_keys(coalesce(m.calculation_rules->'car_components', '{}'))) j(k);
CREATE TABLE scratch_catchment.lm AS
  SELECT m.geo_code, m.component_id, m.numerator::float8 AS num, m.denominator::float8 AS den
  FROM lsoa_metrics m JOIN scratch_catchment.comp c USING (component_id)
  WHERE m.edition = '2021' AND m.numerator IS NOT NULL AND m.denominator IS NOT NULL;
CREATE INDEX ON scratch_catchment.lm (geo_code);

-- As bua_demographics_raw, summed over the catchment instead of the town's weighted LSOAs.
CREATE TABLE scratch_catchment.raw AS
  SELECT c.src AS lsoa_code, l.component_id, sum(l.num) / nullif(sum(l.den), 0) * 100 AS value_pct
  FROM scratch_catchment.catch c JOIN scratch_catchment.lm l ON l.geo_code = c.dst
  GROUP BY c.src, l.component_id;

-- calculate_demographic_index(), set-based. Checked against bua_demographic_signals: applied to
-- bua_demographics_raw it reproduces the stored town scores to within 0.005 (their rounding).
CREATE TABLE scratch_catchment.signals AS
WITH w AS (
  SELECT m.signal_name, m.signal_category, g.grp, j.key AS component_id, (j.value->>'weight')::float8 AS weight
  FROM demographic_signal_mappings m,
  LATERAL (VALUES ('components'), ('stable_components'), ('transient_components'), ('walkable_components'), ('car_components')) g(grp),
  LATERAL jsonb_each(coalesce(m.calculation_rules->g.grp, '{}')) j
), nat AS (
  SELECT component_id, avg_pct::float8 AS avg_pct FROM metric_averages
  WHERE geography_level = 'national' AND geography_code IS NULL
)
SELECT r.lsoa_code, w.signal_name, w.signal_category,
  CASE WHEN bool_or(w.grp IN ('stable_components', 'walkable_components'))
       THEN (sum(r.value_pct / n.avg_pct * 100 * w.weight) FILTER (WHERE w.grp IN ('stable_components', 'walkable_components'))
            - coalesce(sum(r.value_pct / n.avg_pct * 100 * w.weight) FILTER (WHERE w.grp IN ('transient_components', 'car_components')), 0))
            / sum(w.weight) + 100
       ELSE sum(r.value_pct / n.avg_pct * 100 * w.weight) / sum(w.weight) END AS value
FROM scratch_catchment.raw r
JOIN w ON w.component_id = r.component_id
JOIN nat n ON n.component_id = r.component_id AND n.avg_pct > 0
WHERE r.value_pct IS NOT NULL
GROUP BY r.lsoa_code, w.signal_name, w.signal_category;
INSERT INTO scratch_catchment.signals
  SELECT lsoa_code, 'population', 'population', pop1k FROM scratch_catchment.density;
