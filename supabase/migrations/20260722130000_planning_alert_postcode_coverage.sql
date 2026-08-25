-- Production postcode coverage for planning alerts.
--
-- ONSPD supplies one coordinate per UK postcode. The outward code is the
-- coarse PlanNexus search key; the patch and store radii remain the exact
-- inclusion rules after applications have been fetched.

CREATE TABLE IF NOT EXISTS public.uk_postcode_centroids (
  postcode text PRIMARY KEY,
  outward_code text NOT NULL,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  location geography(Point, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
  ) STORED,
  is_live boolean NOT NULL DEFAULT true,
  source_release text,
  imported_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_uk_postcode_centroids_location_live
  ON public.uk_postcode_centroids USING gist (location)
  WHERE is_live = true;
CREATE INDEX IF NOT EXISTS idx_uk_postcode_centroids_outward_code
  ON public.uk_postcode_centroids (outward_code)
  WHERE is_live = true;

ALTER TABLE public.uk_postcode_centroids ENABLE ROW LEVEL SECURITY;

-- Only the service role imports and queries this reference dataset.
REVOKE ALL ON TABLE public.uk_postcode_centroids FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.uk_postcode_centroids TO service_role;

ALTER TABLE public.planning_alert_subscriptions
  ADD COLUMN IF NOT EXISTS postcode_prefixes_updated_at timestamptz;

CREATE OR REPLACE FUNCTION public.refresh_planning_alert_postcode_prefixes(
  p_subscription_id uuid,
  p_edge_padding_meters integer DEFAULT 2000
)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription public.planning_alert_subscriptions%ROWTYPE;
  v_patch geometry;
  v_patch_search_area geography;
  v_prefixes text[];
BEGIN
  IF p_edge_padding_meters < 0 OR p_edge_padding_meters > 10000 THEN
    RAISE EXCEPTION 'Postcode edge padding must be between 0 and 10000 metres';
  END IF;

  SELECT *
  INTO v_subscription
  FROM public.planning_alert_subscriptions
  WHERE id = p_subscription_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Planning alert subscription % was not found', p_subscription_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.uk_postcode_centroids WHERE is_live = true LIMIT 1
  ) THEN
    RAISE EXCEPTION 'UK postcode centroid data has not been imported';
  END IF;

  v_patch := ST_SetSRID(
    ST_GeomFromGeoJSON(v_subscription.patch_geojson::text),
    4326
  );

  IF NOT ST_IsValid(v_patch) THEN
    RAISE EXCEPTION 'Planning alert patch geometry is invalid';
  END IF;

  -- A small padding protects the coarse upstream search from postcode-centroid
  -- and application-coordinate differences near an exact patch/radius edge.
  -- False positives are harmless because application classification is exact.
  v_patch_search_area := ST_Buffer(
    v_patch::geography,
    p_edge_padding_meters
  );

  SELECT COALESCE(array_agg(matches.outward_code ORDER BY matches.outward_code), '{}')
  INTO v_prefixes
  FROM (
    SELECT DISTINCT postcode.outward_code
    FROM public.uk_postcode_centroids AS postcode
    WHERE postcode.is_live = true
      AND ST_Intersects(postcode.location, v_patch_search_area)

    UNION

    SELECT DISTINCT postcode.outward_code
    FROM public.stores AS store
    JOIN public.uk_postcode_centroids AS postcode
      ON postcode.is_live = true
      AND ST_DWithin(
        postcode.location,
        ST_SetSRID(ST_MakePoint(store.lon, store.lat), 4326)::geography,
        v_subscription.radius_meters + p_edge_padding_meters
      )
    WHERE store.brand_id = v_subscription.brand_id
      AND store.lat IS NOT NULL
      AND store.lon IS NOT NULL
  ) AS matches;

  IF cardinality(v_prefixes) = 0 THEN
    RAISE EXCEPTION 'No postcode prefixes overlap this patch or estate';
  END IF;

  UPDATE public.planning_alert_subscriptions
  SET plannexus_postcode_prefixes = v_prefixes,
      postcode_prefixes_updated_at = timezone('utc'::text, now())
  WHERE id = p_subscription_id;

  RETURN v_prefixes;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_planning_alert_postcode_prefixes(uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_planning_alert_postcode_prefixes(uuid, integer)
  TO service_role;

COMMENT ON TABLE public.uk_postcode_centroids IS
  'Quarterly ONS Postcode Directory coordinates used to derive coarse PlanNexus outward-code coverage.';
COMMENT ON FUNCTION public.refresh_planning_alert_postcode_prefixes(uuid, integer) IS
  'Rebuilds a planning subscription PlanNexus prefix envelope from its patch and buffered brand estate.';
