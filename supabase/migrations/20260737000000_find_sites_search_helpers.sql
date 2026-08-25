-- =============================================================================
-- M9 (Find Sites): read-only search helper — known-site recall lookup.
--
-- The M9 known-site recall test asks: "would our universe/pipeline have found &
-- ranked real drive-thrus we already know about?" To answer it we need to map each
-- KNOWN real-world site (an existing brand store, taken as ground truth for a viable
-- drive-thru location) to the candidate parcel it falls in — or is nearest to — WITHIN
-- the SAME searchable universe the ranking runs over (source + min-acres). This RPC does
-- exactly that spatial join and nothing else: no scoring, no verdict.
--
-- A store that maps to no parcel within the lookup radius returns candidate_site_id NULL
-- — a genuine miss of the UNIVERSE (the parcel substrate doesn't cover it), kept distinct
-- from a miss of the RANKING (mapped, but ranked poorly). A parcel that contains the point
-- reports contained = true and distance 0; otherwise the nearest parcel within the radius.
--
-- Read-only, SECURITY DEFINER, service_role/authenticated only — same posture as the M7
-- same-brand RPCs. No new tables; no writes.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.find_candidate_sites_for_stores(
  p_brand_id    uuid,
  p_min_lon     double precision,
  p_min_lat     double precision,
  p_max_lon     double precision,
  p_max_lat     double precision,
  p_fascia_ids  uuid[]           DEFAULT NULL,
  p_site_source text             DEFAULT 'hmlr_inspire',
  p_min_acres   numeric          DEFAULT 0.3,
  p_max_dist_m  double precision DEFAULT 150
)
RETURNS TABLE (
  store_id          uuid,
  store_ref         text,
  store_name        text,
  store_town        text,
  lon               double precision,
  lat               double precision,
  candidate_site_id uuid,
  contained         boolean,
  distance_m        double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    s.id                                   AS store_id,
    s.store_id                             AS store_ref,
    s.name                                 AS store_name,
    s.town                                 AS store_town,
    ST_X(s.location::geometry)             AS lon,
    ST_Y(s.location::geometry)             AS lat,
    ns.id                                  AS candidate_site_id,
    ns.contained                           AS contained,
    ns.dist_m                              AS distance_m
  FROM public.stores s
  LEFT JOIN LATERAL (
    -- Nearest candidate parcel in the SEARCHABLE universe (source + min-acres). A parcel
    -- that contains the point has distance 0, so it is naturally selected as nearest.
    SELECT cs.id,
           ST_Contains(cs.geom, s.location::geometry)      AS contained,
           ST_Distance(cs.geom::geography, s.location)     AS dist_m
    FROM public.candidate_sites cs
    WHERE cs.source = p_site_source
      AND (p_min_acres IS NULL OR cs.area_acres >= p_min_acres)
      AND ST_DWithin(cs.geom::geography, s.location, p_max_dist_m)
    ORDER BY cs.geom <-> s.location::geometry
    LIMIT 1
  ) ns ON true
  WHERE s.brand_id = p_brand_id
    AND (p_fascia_ids IS NULL OR s.fascia_id = ANY(p_fascia_ids))
    AND s.location && ST_MakeEnvelope(p_min_lon, p_min_lat, p_max_lon, p_max_lat, 4326)::geography;
$$;

REVOKE EXECUTE ON FUNCTION public.find_candidate_sites_for_stores(
  uuid, double precision, double precision, double precision, double precision,
  uuid[], text, numeric, double precision
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_candidate_sites_for_stores(
  uuid, double precision, double precision, double precision, double precision,
  uuid[], text, numeric, double precision
) TO service_role, authenticated;

COMMENT ON FUNCTION public.find_candidate_sites_for_stores(
  uuid, double precision, double precision, double precision, double precision,
  uuid[], text, numeric, double precision
) IS
  'M9 (Find Sites) known-site recall helper: maps each brand store within a bbox to the candidate parcel it falls in / is nearest to, within the searchable universe (source + min-acres). candidate_site_id NULL = the parcel substrate does not cover the point (a universe miss). Read-only; feeds search-analysis.ts knownSiteRecall(). Never a suitability verdict.';
