-- Experiment only: rank each catchment against catchments of a similar density, the way
-- rebuild_bua_demographic_ranks() ranks towns against towns of a similar size. 74 bands of about
-- 200 catchments by people within 1km; "population" (density) itself is ranked across all.
CREATE TABLE scratch_catchment.ranks AS
WITH bands AS (
  SELECT lsoa_code,
         ntile(round((SELECT count(*) FROM scratch_catchment.density) / 200.0)::int)
           OVER (ORDER BY pop1k, lsoa_code) AS size_band
  FROM scratch_catchment.density
), banded AS (
  SELECT s.lsoa_code, s.signal_name, s.signal_category, s.value, b.size_band,
         CASE WHEN s.signal_name = 'population' THEN 0 ELSE b.size_band END AS peer_group
  FROM scratch_catchment.signals s JOIN bands b USING (lsoa_code)
)
SELECT lsoa_code, signal_name, signal_category, value, size_band,
  cume_dist() OVER (PARTITION BY signal_name, peer_group ORDER BY value)
    - (count(*) OVER (PARTITION BY signal_name, peer_group, value))::float8
      / (2 * count(*) OVER (PARTITION BY signal_name, peer_group)) AS rank
FROM banded;
CREATE INDEX ON scratch_catchment.ranks (lsoa_code, signal_name);
CREATE INDEX ON scratch_catchment.ranks (size_band);
