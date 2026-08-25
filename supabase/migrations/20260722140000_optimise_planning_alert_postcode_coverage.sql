-- Keep interactive planning-alert refreshes below the API statement timeout.
-- Testing every patch against ~1.8m postcode-unit points is unnecessarily
-- expensive: PlanNexus only needs the ~3k outward codes. Each rectangle below
-- encloses every live postcode centroid for one outward code. Rectangles can
-- over-select at their corners, which is safe because final classification uses
-- the exact patch and store radius.

CREATE TABLE IF NOT EXISTS public.uk_postcode_outcode_bounds (
  outward_code text PRIMARY KEY,
  min_latitude double precision NOT NULL,
  min_longitude double precision NOT NULL,
  max_latitude double precision NOT NULL,
  max_longitude double precision NOT NULL,
  bounds geometry(Polygon, 4326) GENERATED ALWAYS AS (
    ST_MakeEnvelope(min_longitude, min_latitude, max_longitude, max_latitude, 4326)
  ) STORED,
  source_release text,
  imported_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CHECK (min_latitude <= max_latitude),
  CHECK (min_longitude <= max_longitude)
);

CREATE INDEX IF NOT EXISTS idx_uk_postcode_outcode_bounds_geometry
  ON public.uk_postcode_outcode_bounds USING gist (bounds);

ALTER TABLE public.uk_postcode_outcode_bounds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.uk_postcode_outcode_bounds FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.uk_postcode_outcode_bounds TO service_role;

-- Seed the compact lookup from the ONSPD data already imported. SQL Editor is
-- not subject to the short PostgREST request timeout used by the web app.
INSERT INTO public.uk_postcode_outcode_bounds (
  outward_code,
  min_latitude,
  min_longitude,
  max_latitude,
  max_longitude,
  source_release,
  imported_at
)
SELECT
  outward_code,
  min(latitude),
  min(longitude),
  max(latitude),
  max(longitude),
  max(source_release),
  timezone('utc'::text, now())
FROM public.uk_postcode_centroids
WHERE is_live = true
GROUP BY outward_code
ON CONFLICT (outward_code) DO UPDATE SET
  min_latitude = EXCLUDED.min_latitude,
  min_longitude = EXCLUDED.min_longitude,
  max_latitude = EXCLUDED.max_latitude,
  max_longitude = EXCLUDED.max_longitude,
  source_release = EXCLUDED.source_release,
  imported_at = EXCLUDED.imported_at;

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
  v_patch_search_area geometry;
  v_estate_search_area geometry;
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

  IF NOT EXISTS (SELECT 1 FROM public.uk_postcode_outcode_bounds LIMIT 1) THEN
    RAISE EXCEPTION 'UK outward-code coverage has not been generated';
  END IF;

  v_patch := ST_SetSRID(
    ST_GeomFromGeoJSON(v_subscription.patch_geojson::text),
    4326
  );

  IF NOT ST_IsValid(v_patch) THEN
    RAISE EXCEPTION 'Planning alert patch geometry is invalid';
  END IF;

  v_patch_search_area := ST_Buffer(
    v_patch::geography,
    p_edge_padding_meters
  )::geometry;

  -- Combine store buffers once, rather than repeatedly joining every store to
  -- every postcode. ST_Collect is sufficient because we only test intersection.
  SELECT ST_Collect(
    ST_Buffer(
      ST_SetSRID(ST_MakePoint(store.lon, store.lat), 4326)::geography,
      v_subscription.radius_meters + p_edge_padding_meters
    )::geometry
  )
  INTO v_estate_search_area
  FROM public.stores AS store
  WHERE store.brand_id = v_subscription.brand_id
    AND store.lat IS NOT NULL
    AND store.lon IS NOT NULL;

  SELECT COALESCE(array_agg(coverage.outward_code ORDER BY coverage.outward_code), '{}')
  INTO v_prefixes
  FROM public.uk_postcode_outcode_bounds AS coverage
  WHERE ST_Intersects(coverage.bounds, v_patch_search_area)
     OR (
       v_estate_search_area IS NOT NULL
       AND ST_Intersects(coverage.bounds, v_estate_search_area)
     );

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

COMMENT ON TABLE public.uk_postcode_outcode_bounds IS
  'Compact bounding rectangles for live ONSPD outward codes, used as a permissive PlanNexus query envelope.';
