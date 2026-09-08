-- Migration: the matching queue, as a function rather than a table.
--
-- The queue is derived: a store with no row in store_floor_areas has never been
-- attempted, because the matcher writes a row for every store it considers — including
-- confidence='none' when the register holds nothing admissible for it.
--
-- Expressing that as an anti-join in the worker would mean pulling 43,070 store ids and
-- 43,070 match ids over PostgREST and differencing them in memory on every run, because
-- PostgREST has no NOT EXISTS. It also puts the definition of "needs matching" in
-- application code, where the retry rule would drift away from the columns it depends on.
-- Both belong here.
--
-- Two populations, in priority order:
--   1. Never attempted. Newly imported stores. The reason this exists.
--   2. Attempted and errored, under the attempt limit. A row carrying last_error means
--      the matcher broke, which is a different thing from the register having nothing —
--      and only one of those is worth trying again. Past the limit a row stops being
--      retried and becomes a dead letter the admin page can show.
CREATE OR REPLACE FUNCTION public.epc_stores_awaiting_match(
  p_limit        integer DEFAULT 200,
  p_max_attempts integer DEFAULT 3
) RETURNS TABLE (
  id             uuid,
  brand_id       uuid,
  fascia_id      uuid,
  address_line_1 text,
  address_line_2 text,
  town           text,
  county         text,
  postcode       text,
  attempts       integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT s.id, s.brand_id, s.fascia_id, s.address_line_1, s.address_line_2,
         s.town, s.county, s.postcode,
         COALESCE(f.match_attempts, 0) AS attempts
  FROM public.stores s
  LEFT JOIN public.store_floor_areas f ON f.store_id = s.id
  WHERE s.postcode IS NOT NULL
    AND btrim(s.postcode) <> ''
    AND (
          f.store_id IS NULL
       OR (f.last_error IS NOT NULL AND f.match_attempts < p_max_attempts)
    )
  -- Never-attempted first: a new import is the case this exists to serve, and a
  -- persistent error should not be able to starve it.
  ORDER BY (f.store_id IS NOT NULL), s.id
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.epc_stores_awaiting_match(integer, integer) IS
  'Stores needing a floor-area match: never attempted first, then retryable failures under the attempt limit. Stores with no postcode are excluded — the matcher looks up candidates by postcode and has nothing to offer them.';

REVOKE ALL ON FUNCTION public.epc_stores_awaiting_match(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.epc_stores_awaiting_match(integer, integer) TO service_role;

-- Supports the anti-join above; without it every run seq-scans store_floor_areas.
CREATE INDEX IF NOT EXISTS idx_stores_postcode_notnull
  ON public.stores (id) WHERE postcode IS NOT NULL;
