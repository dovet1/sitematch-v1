-- A planning alert estate is scoped by its commercial patch. Only brand stores
-- whose coordinates fall inside that patch contribute store-radius postcode
-- coverage. The patch itself continues to contribute its full outward-code
-- coverage, including the 2 km coarse-query safety margin.

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

  -- A store belongs to this alert only when its pin lies inside the patch.
  -- Its search buffer may extend outside the patch so applications within the
  -- configured store radius are not lost at a patch boundary.
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
    AND store.lon IS NOT NULL
    AND ST_Covers(
      v_patch,
      ST_SetSRID(ST_MakePoint(store.lon, store.lat), 4326)
    );

  SELECT COALESCE(array_agg(coverage.outward_code ORDER BY coverage.outward_code), '{}')
  INTO v_prefixes
  FROM public.uk_postcode_outcode_bounds AS coverage
  WHERE ST_Intersects(coverage.bounds, v_patch_search_area)
     OR (
       v_estate_search_area IS NOT NULL
       AND ST_Intersects(coverage.bounds, v_estate_search_area)
     );

  IF cardinality(v_prefixes) = 0 THEN
    RAISE EXCEPTION 'No postcode prefixes overlap this patch or its scoped estate';
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

COMMENT ON FUNCTION public.refresh_planning_alert_postcode_prefixes(uuid, integer) IS
  'Rebuilds PlanNexus prefix coverage from the patch and buffers around brand stores located inside that patch.';
