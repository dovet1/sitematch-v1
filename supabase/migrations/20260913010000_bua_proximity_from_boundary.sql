-- Make Find Gaps proximity town-shaped rather than centroid-shaped.
--
-- "Within N km of a town" now means the whole BUA polygon plus N km beyond its
-- boundary. A store covered by the polygon therefore belongs to every proximity
-- band. The bands are cumulative; store_count must never be summed across bands.
--
-- The expensive spatial work is staged in temporary tables. The live summaries
-- are locked only for the final truncate/copy, not for the spatial calculation.

-- Do not switch locking schemes while a rebuild using the legacy table lock may
-- still be active. A stale row (including one poisoned by the old NULL-user bug)
-- is safe to remove later in this migration.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.rebuild_lock
    WHERE lock_name = 'bua_summary_rebuild'
      AND locked_at >= clock_timestamp() - interval '15 minutes'
  ) THEN
    RAISE EXCEPTION
      'Cannot install boundary proximity rebuild while the legacy BUA rebuild lock is recent; retry after it expires';
  END IF;

  -- Serialise this migration with calls to the new function made immediately
  -- after it becomes visible. The transaction releases the lock on commit.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('bua_summary_rebuild', 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_rebuild_running()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  -- A successful probe is held only until this short RPC transaction ends.
  -- The rebuild function takes the same transaction-scoped lock for its full run.
  RETURN NOT pg_try_advisory_xact_lock(
    hashtextextended('bua_summary_rebuild', 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rebuild_all_bua_summaries(
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE(progress text)
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = 0
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_bad_geometry_count integer;
  v_missing_geometry_count integer;
  v_duplicate_geometry_count integer;
  v_orphan_geometry_count integer;
  v_has_store_location_index boolean;
  v_pair_count bigint;
  v_presence_count bigint;
  v_nearby_count bigint;
  v_invariant_failures bigint;
BEGIN
  -- p_user_id is retained for RPC compatibility. Advisory locking does not need
  -- a user id and works for both admin and scheduled service-role calls.
  IF NOT pg_try_advisory_xact_lock(
    hashtextextended('bua_summary_rebuild', 0)
  ) THEN
    RETURN QUERY SELECT 'Rebuild already in progress - skipping'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'Validating BUA geometry inputs...'::text;

  SELECT count(*)::integer
  INTO v_bad_geometry_count
  FROM public.built_up_area_geometries AS bg
  WHERE bg.geom IS NULL
     OR ST_SRID(bg.geom) <> 4326
     OR GeometryType(bg.geom) NOT IN ('POLYGON', 'MULTIPOLYGON')
     OR NOT ST_IsValid(bg.geom);

  IF v_bad_geometry_count > 0 THEN
    RAISE EXCEPTION
      'Cannot rebuild BUA summaries: % geometries are null, invalid, non-polygonal, or not SRID 4326',
      v_bad_geometry_count;
  END IF;

  SELECT count(*)::integer
  INTO v_missing_geometry_count
  FROM public.built_up_areas AS b
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.built_up_area_geometries AS bg
    WHERE bg.gsscode = b.gsscode
  );

  SELECT count(*)::integer
  INTO v_duplicate_geometry_count
  FROM (
    SELECT bg.gsscode
    FROM public.built_up_area_geometries AS bg
    GROUP BY bg.gsscode
    HAVING count(*) > 1
  ) AS duplicates;

  SELECT count(*)::integer
  INTO v_orphan_geometry_count
  FROM public.built_up_area_geometries AS bg
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.built_up_areas AS b
    WHERE b.gsscode = bg.gsscode
  );

  IF v_missing_geometry_count > 0
     OR v_duplicate_geometry_count > 0
     OR v_orphan_geometry_count > 0 THEN
    RAISE EXCEPTION
      'Cannot rebuild BUA summaries: % BUAs lack geometry, % GSS codes have duplicate geometry rows, and % geometry rows lack a BUA',
      v_missing_geometry_count,
      v_duplicate_geometry_count,
      v_orphan_geometry_count;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'stores'
      AND indexdef ILIKE '%USING gist%'
      AND indexdef ILIKE '%location%'
  )
  INTO v_has_store_location_index;

  IF NOT v_has_store_location_index THEN
    RAISE EXCEPTION
      'Cannot rebuild BUA summaries: stores.location needs a GiST index for the boundary-distance join';
  END IF;

  CREATE TEMP TABLE next_bua_store_presence
    (LIKE public.bua_store_presence INCLUDING DEFAULTS)
    ON COMMIT DROP;

  CREATE TEMP TABLE next_bua_store_nearby
    (LIKE public.bua_store_nearby INCLUDING DEFAULTS)
    ON COMMIT DROP;

  CREATE TEMP TABLE bua_store_pairs (
    bua_gsscode text NOT NULL,
    store_id uuid NOT NULL,
    brand_id uuid,
    fascia_id uuid NOT NULL,
    is_inside boolean NOT NULL,
    boundary_distance_m double precision NOT NULL
  ) ON COMMIT DROP;

  RETURN QUERY SELECT 'Calculating stores within 10km of BUA boundaries...'::text;

  -- Calculate each BUA/store distance once. Restricting with ST_DWithin first lets
  -- PostGIS use the stores.location spatial index and bounds the temporary table.
  INSERT INTO pg_temp.bua_store_pairs (
    bua_gsscode,
    store_id,
    brand_id,
    fascia_id,
    is_inside,
    boundary_distance_m
  )
  SELECT
    bg.gsscode,
    s.id,
    s.brand_id,
    s.fascia_id,
    ST_Covers(bg.geom, s.location::geometry),
    ST_Distance(bg.geom::geography, s.location)
  FROM public.built_up_area_geometries AS bg
  JOIN public.stores AS s
    ON ST_DWithin(bg.geom::geography, s.location, 10000)
  WHERE s.location IS NOT NULL
    AND s.fascia_id IS NOT NULL;

  GET DIAGNOSTICS v_pair_count = ROW_COUNT;
  CREATE INDEX bua_store_pairs_distance_idx
    ON pg_temp.bua_store_pairs (boundary_distance_m);
  ANALYZE pg_temp.bua_store_pairs;

  -- Preserve the existing category-shaped summary schema. COUNT(DISTINCT) also
  -- prevents future subdivided BUA geometry rows from inflating store counts.
  INSERT INTO pg_temp.next_bua_store_presence (
    bua_gsscode,
    category_id,
    brand_id,
    fascia_id,
    store_count
  )
  SELECT
    pair.bua_gsscode,
    fc.category_id,
    pair.brand_id,
    pair.fascia_id,
    count(DISTINCT pair.store_id)
  FROM pg_temp.bua_store_pairs AS pair
  JOIN public.fascia_categories AS fc
    ON fc.fascia_id = pair.fascia_id
  WHERE pair.is_inside
  GROUP BY pair.bua_gsscode, fc.category_id, pair.brand_id, pair.fascia_id;

  GET DIAGNOSTICS v_presence_count = ROW_COUNT;

  INSERT INTO pg_temp.next_bua_store_nearby (
    bua_gsscode,
    distance_m,
    category_id,
    brand_id,
    fascia_id,
    store_count
  )
  SELECT
    pair.bua_gsscode,
    band.distance_m,
    fc.category_id,
    pair.brand_id,
    pair.fascia_id,
    count(DISTINCT pair.store_id)
  FROM pg_temp.bua_store_pairs AS pair
  CROSS JOIN (
    VALUES (1000), (3000), (5000), (10000)
  ) AS band(distance_m)
  JOIN public.fascia_categories AS fc
    ON fc.fascia_id = pair.fascia_id
  WHERE pair.boundary_distance_m <= band.distance_m
  GROUP BY
    pair.bua_gsscode,
    band.distance_m,
    fc.category_id,
    pair.brand_id,
    pair.fascia_id;

  GET DIAGNOSTICS v_nearby_count = ROW_COUNT;

  -- Every in-town summary must exist in the first proximity band.
  SELECT count(*)
  INTO v_invariant_failures
  FROM pg_temp.next_bua_store_presence AS presence
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_temp.next_bua_store_nearby AS nearby
    WHERE nearby.bua_gsscode = presence.bua_gsscode
      AND nearby.distance_m = 1000
      AND nearby.category_id = presence.category_id
      AND nearby.brand_id IS NOT DISTINCT FROM presence.brand_id
      AND nearby.fascia_id = presence.fascia_id
  );

  IF v_invariant_failures > 0 THEN
    RAISE EXCEPTION
      'Refusing summary swap: % in-town rows are absent from the 1km proximity band',
      v_invariant_failures;
  END IF;

  -- Each narrower cumulative band must be present, with at least the same count,
  -- in the next wider band.
  SELECT count(*)
  INTO v_invariant_failures
  FROM pg_temp.next_bua_store_nearby AS narrower
  WHERE narrower.distance_m <> 10000
    AND NOT EXISTS (
      SELECT 1
      FROM pg_temp.next_bua_store_nearby AS wider
      WHERE wider.bua_gsscode = narrower.bua_gsscode
        AND wider.distance_m = CASE narrower.distance_m
          WHEN 1000 THEN 3000
          WHEN 3000 THEN 5000
          WHEN 5000 THEN 10000
        END
        AND wider.category_id = narrower.category_id
        AND wider.brand_id IS NOT DISTINCT FROM narrower.brand_id
        AND wider.fascia_id = narrower.fascia_id
        AND wider.store_count >= narrower.store_count
    );

  IF v_invariant_failures > 0 THEN
    RAISE EXCEPTION
      'Refusing summary swap: % rows violate cumulative proximity-band nesting',
      v_invariant_failures;
  END IF;

  RETURN QUERY SELECT format(
    'Staged %s BUA/store pairs, %s presence rows, and %s proximity rows',
    v_pair_count,
    v_presence_count,
    v_nearby_count
  );

  -- This is the only point that takes ACCESS EXCLUSIVE locks on the live caches.
  TRUNCATE TABLE public.bua_store_presence, public.bua_store_nearby;

  INSERT INTO public.bua_store_presence (
    bua_gsscode,
    category_id,
    brand_id,
    fascia_id,
    store_count,
    created_at
  )
  SELECT
    bua_gsscode,
    category_id,
    brand_id,
    fascia_id,
    store_count,
    created_at
  FROM pg_temp.next_bua_store_presence;

  INSERT INTO public.bua_store_nearby (
    bua_gsscode,
    distance_m,
    category_id,
    brand_id,
    fascia_id,
    store_count,
    created_at
  )
  SELECT
    bua_gsscode,
    distance_m,
    category_id,
    brand_id,
    fascia_id,
    store_count,
    created_at
  FROM pg_temp.next_bua_store_nearby;

  ANALYZE public.bua_store_presence;
  ANALYZE public.bua_store_nearby;

  RETURN QUERY SELECT 'Rebuild complete!'::text;
END;
$$;

-- Keep the historic child RPCs compatible, but route them through the atomic full
-- rebuild so neither can expose a partially refreshed pair of summary tables.
CREATE OR REPLACE FUNCTION public.rebuild_bua_store_presence()
RETURNS TABLE(progress text)
LANGUAGE sql
SECURITY DEFINER
SET statement_timeout = 0
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT * FROM public.rebuild_all_bua_summaries(NULL::uuid);
$$;

CREATE OR REPLACE FUNCTION public.rebuild_bua_store_nearby()
RETURNS TABLE(progress text)
LANGUAGE sql
SECURITY DEFINER
SET statement_timeout = 0
SET search_path = pg_catalog, public, extensions
AS $$
  SELECT * FROM public.rebuild_all_bua_summaries(NULL::uuid);
$$;

-- Remove the stale table lock left by the old NULL-user path. Advisory transaction
-- locks release automatically and cannot poison later rebuild attempts.
DELETE FROM public.rebuild_lock
WHERE lock_name = 'bua_summary_rebuild';

COMMENT ON TABLE public.rebuild_lock IS
  'Legacy BUA rebuild lock table. Superseded by a transaction-scoped advisory lock.';

COMMENT ON COLUMN public.cache_rebuild_queue.processed_at IS
  'Timestamp when the BUA summary rebuild completed successfully. NULL means retryable/pending.';
COMMENT ON COLUMN public.cache_rebuild_queue.rebuild_started_at IS
  'Timestamp of the most recent attempt to call rebuild_all_bua_summaries().';

REVOKE ALL ON FUNCTION public.is_rebuild_running()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rebuild_all_bua_summaries(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rebuild_bua_store_presence()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rebuild_bua_store_nearby()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.acquire_rebuild_lock(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.release_rebuild_lock()
  FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.is_rebuild_running() TO service_role;
GRANT EXECUTE ON FUNCTION public.rebuild_all_bua_summaries(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.rebuild_bua_store_presence() TO service_role;
GRANT EXECUTE ON FUNCTION public.rebuild_bua_store_nearby() TO service_role;

COMMENT ON FUNCTION public.is_rebuild_running() IS
  'Reports whether another transaction holds the BUA summary advisory lock.';
COMMENT ON FUNCTION public.rebuild_all_bua_summaries(uuid) IS
  'Atomically rebuilds BUA presence and cumulative 1km, 3km, 5km and 10km boundary-distance summaries. The user id argument is retained for RPC compatibility.';
COMMENT ON FUNCTION public.rebuild_bua_store_presence() IS
  'Compatibility RPC that performs the atomic full BUA summary rebuild.';
COMMENT ON FUNCTION public.rebuild_bua_store_nearby() IS
  'Compatibility RPC that performs the atomic full BUA summary rebuild.';
