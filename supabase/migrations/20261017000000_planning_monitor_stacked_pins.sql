-- Planning Monitor: mark map cells whose applications all share one point.
--
-- Why: applications given the same coordinates (commonly one postcode centre) never separate
-- however far the map zooms, so clicking their cluster only re-centred the map. A cell now says
-- when every unit in it sits within about a metre of the others; the client draws it as a stacked
-- pin and opens a list of its applications instead of zooming.
--
-- Change: planning_monitor_clusters gains a `colocated` column. The return type changes, so the
-- function is dropped and recreated with its grants. The body is otherwise the 20261012 version.
BEGIN;
SET LOCAL lock_timeout = '5s';

DROP FUNCTION IF EXISTS public.planning_monitor_clusters(jsonb, double precision, text, integer);

CREATE FUNCTION public.planning_monitor_clusters(
  p jsonb,
  p_zoom double precision,
  p_grouping text DEFAULT 'developments',
  p_max_cells integer DEFAULT 1500
)
RETURNS TABLE (
  cell_key text,
  lng double precision,
  lat double precision,
  count bigint,
  residential bigint,
  commercial bigint,
  possible bigint,
  single_id uuid,
  single_key text,
  single_exact boolean,
  colocated boolean
)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  -- Degrees of longitude per 64 px at this zoom on a 512 px tile.
  v_cell double precision := 360.0 / power(2, LEAST(GREATEST(COALESCE(p_zoom, 5), 0), 22)) * 64.0 / 512.0;
BEGIN
  IF p_grouping NOT IN ('applications', 'developments') THEN
    RAISE EXCEPTION 'Unknown grouping %', p_grouping USING ERRCODE = '22023';
  END IF;
  RETURN QUERY EXECUTE format($q$
    WITH m AS (%1$s),
    units AS (
      -- One unit per counted thing: every application, or one per development at its representative point.
      SELECT DISTINCT ON (CASE WHEN %2$L = 'applications' THEN m.id::text ELSE m.group_key END)
        CASE WHEN %2$L = 'applications' THEN m.id::text ELSE m.group_key END AS unit_key,
        m.id, m.lng, m.lat, m.is_residential, m.is_commercial, m.inside, m.location_provenance
      FROM m
      ORDER BY CASE WHEN %2$L = 'applications' THEN m.id::text ELSE m.group_key END,
               m.paperwork,
               CASE m.development_role WHEN 'principal' THEN 0 WHEN 'primary' THEN 1 ELSE 2 END,
               m.sort_date DESC NULLS LAST, m.id
    )
    SELECT
      floor(u.lng / %3$s)::bigint || ':' || floor(u.lat / %3$s)::bigint AS cell_key,
      avg(u.lng), avg(u.lat), count(*),
      count(*) FILTER (WHERE u.is_residential),
      count(*) FILTER (WHERE u.is_commercial),
      count(*) FILTER (WHERE NOT u.inside),
      CASE WHEN count(*) = 1 THEN (array_agg(u.id))[1] END,
      CASE WHEN count(*) = 1 THEN (array_agg(u.unit_key))[1] END,
      CASE WHEN count(*) = 1 THEN bool_and(u.location_provenance = 'source_exact') END,
      -- 0.00001 degrees is about a metre: closer than any zoom level can separate.
      count(*) > 1 AND max(u.lng) - min(u.lng) <= 0.00001 AND max(u.lat) - min(u.lat) <= 0.00001
    FROM units u
    GROUP BY 1
    ORDER BY count(*) DESC
    LIMIT %4$s
  $q$, public.planning_monitor_match_sql(p), p_grouping, v_cell, LEAST(GREATEST(COALESCE(p_max_cells, 1500), 1), 5000));
END $$;

REVOKE ALL ON FUNCTION public.planning_monitor_clusters(jsonb, double precision, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.planning_monitor_clusters(jsonb, double precision, text, integer) TO service_role;

-- The API reads this through PostgREST, which caches function signatures.
NOTIFY pgrst, 'reload schema';

COMMIT;
