-- Development linking, step 3: link applications to their families as they are stored.
-- See docs/planning-development-linking-plan.md.
--
-- This migration only adds storage for link evidence and a queue of missing families. It does
-- not change Development membership, classification or the planning tab: step 5 does that, and
-- the two are released together. Ingestion writes here only when PLANNING_LINKING_ENABLED is on.

-- 1. Keys the linker resolves citations against.
--
-- A description cites "24/01333/FUL"; the stored reference may differ in case or spacing, and a
-- follow-on can carry only its parent's case number ("24/01333/CND2"). Both keys are computed by
-- the application code (linking.ts), the single source of the rules, and written at ingestion;
-- existing rows are filled by scripts/seed-planning-links.ts through planning_set_reference_keys.
-- They are plain columns, not generated ones, because a stored generated column would rewrite the
-- whole ~614,000-row table under an exclusive lock.
ALTER TABLE public.planning_applications
  ADD COLUMN IF NOT EXISTS reference_normalised text,
  ADD COLUMN IF NOT EXISTS reference_core text;

COMMENT ON COLUMN public.planning_applications.reference_normalised IS
  'Council reference upper-cased with whitespace removed, as linking.ts normalises citations. Written by application code.';
COMMENT ON COLUMN public.planning_applications.reference_core IS
  'Case number of a suffixed reference ("21/03456" for 21/03456/CONDA), or NULL when the reference has no such form. Written by application code.';

CREATE INDEX IF NOT EXISTS planning_applications_authority_reference_normalised_idx
  ON public.planning_applications (authority_slug, reference_normalised)
  WHERE reference_normalised IS NOT NULL;
CREATE INDEX IF NOT EXISTS planning_applications_authority_reference_core_idx
  ON public.planning_applications (authority_slug, reference_core)
  WHERE reference_core IS NOT NULL;

-- 2. Per-council linking profile.
--
-- Which reference formats a council uses, and which follow-on suffix families reuse their parent's
-- case number, are properties of the whole council's references. Ingestion reads them rather than
-- recomputing them from every stored application for each page.
CREATE TABLE IF NOT EXISTS public.planning_council_link_profiles (
  authority_slug          text PRIMARY KEY,
  reference_shapes        text[] NOT NULL DEFAULT '{}',
  reusing_suffix_families text[] NOT NULL DEFAULT '{}',
  application_count       integer NOT NULL DEFAULT 0,
  computed_at             timestamptz NOT NULL DEFAULT now()
);

-- 3. Link evidence.
--
-- One row per piece of evidence that an application follows on from, or accompanies, another. A
-- link is evidence, not membership: step 5 decides what joins a Development. Removing a link sets
-- removed_at and keeps the row, so neither the linker nor a later Plota family recreates it.
CREATE TABLE IF NOT EXISTS public.planning_application_links (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  authority_slug         text NOT NULL,
  child_application_id   uuid NOT NULL REFERENCES public.planning_applications(id) ON DELETE CASCADE,
  parent_application_id  uuid REFERENCES public.planning_applications(id) ON DELETE SET NULL,
  -- The reference as cited, or the case number for a case-number link, normalised.
  parent_reference       text NOT NULL,
  -- The family key: the case number where the reference has one, else the normalised reference.
  parent_key             text NOT NULL,
  kind                   text NOT NULL,
  strength               text NOT NULL,
  source                 text NOT NULL,
  evidence               text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  removed_at             timestamptz,
  removed_by             text,
  removed_reason         text,
  CONSTRAINT planning_application_links_kind CHECK (
    kind IN ('condition', 'amendment', 'reserved_matters', 'companion', 'cited')
  ),
  CONSTRAINT planning_application_links_strength CHECK (strength IN ('strong', 'weak')),
  CONSTRAINT planning_application_links_source CHECK (
    source IN ('cited_reference', 'reference_core', 'plota_associated', 'manual')
  ),
  CONSTRAINT planning_application_links_not_self CHECK (child_application_id <> parent_application_id),
  CONSTRAINT planning_application_links_removal CHECK (
    (removed_at IS NULL AND removed_by IS NULL AND removed_reason IS NULL) OR removed_at IS NOT NULL
  ),
  UNIQUE (child_application_id, parent_key, source)
);

CREATE INDEX IF NOT EXISTS planning_application_links_parent_idx
  ON public.planning_application_links (parent_application_id)
  WHERE parent_application_id IS NOT NULL;
-- Resolving earlier children when their parent arrives.
CREATE INDEX IF NOT EXISTS planning_application_links_unresolved_idx
  ON public.planning_application_links (authority_slug, parent_key)
  WHERE parent_application_id IS NULL AND removed_at IS NULL;

-- 4. Missing families waiting for a Plota family lookup (step 4 spends on them).
--
-- One row per missing family per council, however many stored follow-ons cite it. A family already
-- fetched stays 'complete' when another follow-on arrives, so it is not fetched again; a parent that
-- turns up through ordinary ingestion marks it 'resolved_locally'.
CREATE TABLE IF NOT EXISTS public.planning_family_lookups (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  authority_slug      text NOT NULL,
  parent_key          text NOT NULL,
  parent_reference    text NOT NULL,
  status              text NOT NULL DEFAULT 'queued',
  priority            integer NOT NULL DEFAULT 0,
  child_count         integer NOT NULL DEFAULT 0,
  first_requested_at  timestamptz NOT NULL DEFAULT now(),
  last_requested_at   timestamptz NOT NULL DEFAULT now(),
  attempts            integer NOT NULL DEFAULT 0,
  fetched_at          timestamptz,
  last_error          text,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT planning_family_lookups_status CHECK (
    status IN ('queued', 'processing', 'complete', 'resolved_locally', 'failed', 'deferred')
  ),
  UNIQUE (authority_slug, parent_key)
);

CREATE INDEX IF NOT EXISTS planning_family_lookups_queue_idx
  ON public.planning_family_lookups (status, priority DESC, last_requested_at DESC)
  WHERE status IN ('queued', 'deferred', 'failed');

-- 5. Writes the application layer makes in bulk.

-- Sets the linking keys for many applications in one statement. Touches only the two key columns,
-- so no location or Development trigger fires.
CREATE OR REPLACE FUNCTION public.planning_set_reference_keys(p_rows jsonb)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH input AS (
    SELECT * FROM jsonb_to_recordset(p_rows) AS r(id uuid, reference_normalised text, reference_core text)
  ), updated AS (
    UPDATE public.planning_applications a
    SET reference_normalised = input.reference_normalised,
        reference_core = input.reference_core
    FROM input
    WHERE a.id = input.id
      AND (a.reference_normalised IS DISTINCT FROM input.reference_normalised
        OR a.reference_core IS DISTINCT FROM input.reference_core)
    RETURNING 1
  )
  SELECT count(*)::integer FROM updated;
$$;

-- Requests lookups for missing families. A new family is queued; an existing one records the new
-- request and its current follow-on count, but a completed or locally resolved family is never
-- re-queued by a request.
CREATE OR REPLACE FUNCTION public.planning_request_family_lookups(p_rows jsonb)
RETURNS integer LANGUAGE sql SECURITY INVOKER SET search_path = public AS $$
  WITH input AS (
    SELECT DISTINCT ON (authority_slug, parent_key) *
    FROM jsonb_to_recordset(p_rows) AS r(authority_slug text, parent_key text, parent_reference text)
    ORDER BY authority_slug, parent_key, length(parent_reference) DESC
  ), counted AS (
    SELECT input.*, (
      SELECT count(DISTINCT l.child_application_id)::integer
      FROM public.planning_application_links l
      WHERE l.authority_slug = input.authority_slug AND l.parent_key = input.parent_key
        AND l.strength = 'strong' AND l.removed_at IS NULL
    ) AS child_count
    FROM input
  ), upserted AS (
    INSERT INTO public.planning_family_lookups (authority_slug, parent_key, parent_reference, child_count)
    SELECT authority_slug, parent_key, parent_reference, child_count FROM counted
    ON CONFLICT (authority_slug, parent_key) DO UPDATE SET
      child_count = EXCLUDED.child_count,
      last_requested_at = now(),
      updated_at = now(),
      parent_reference = CASE
        WHEN length(EXCLUDED.parent_reference) > length(planning_family_lookups.parent_reference)
        THEN EXCLUDED.parent_reference ELSE planning_family_lookups.parent_reference END
    RETURNING 1
  )
  SELECT count(*)::integer FROM upserted;
$$;

-- Attaches earlier follow-ons to a parent that has just been stored, and marks its lookup resolved.
-- A follow-on citing the exact reference always attaches; one known only by case number attaches
-- only to an application that can head a family (the caller passes reference_core only for those).
CREATE OR REPLACE FUNCTION public.planning_resolve_family_parents(p_rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_resolved integer;
BEGIN
  WITH input AS (
    SELECT * FROM jsonb_to_recordset(p_rows)
      AS r(id uuid, authority_slug text, reference_normalised text, reference_core text)
  ), matched AS (
    SELECT DISTINCT ON (l.id) l.id AS link_id, input.id AS parent_id
    FROM input
    JOIN public.planning_application_links l
      ON l.authority_slug = input.authority_slug
     AND l.parent_application_id IS NULL
     AND l.removed_at IS NULL
     AND l.child_application_id <> input.id
     AND (l.parent_reference = input.reference_normalised
       OR (input.reference_core IS NOT NULL AND l.parent_key = input.reference_core))
    -- An exact reference match wins over a case-number match.
    ORDER BY l.id, (l.parent_reference = input.reference_normalised) DESC
  ), updated AS (
    UPDATE public.planning_application_links l
    SET parent_application_id = matched.parent_id, updated_at = now()
    FROM matched
    WHERE l.id = matched.link_id
    RETURNING l.authority_slug, l.parent_key
  ), keys AS (
    SELECT DISTINCT authority_slug, parent_key FROM updated
  )
  UPDATE public.planning_family_lookups f
  SET status = 'resolved_locally', updated_at = now()
  FROM keys
  WHERE f.authority_slug = keys.authority_slug AND f.parent_key = keys.parent_key
    AND f.status IN ('queued', 'deferred', 'failed');
  GET DIAGNOSTICS v_resolved = ROW_COUNT;
  RETURN v_resolved;
END $$;

ALTER TABLE public.planning_council_link_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_application_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_family_lookups ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.planning_council_link_profiles, public.planning_application_links,
  public.planning_family_lookups FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_council_link_profiles,
  public.planning_application_links, public.planning_family_lookups TO service_role;

REVOKE ALL ON FUNCTION public.planning_set_reference_keys(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.planning_request_family_lookups(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.planning_resolve_family_parents(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.planning_set_reference_keys(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.planning_request_family_lookups(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.planning_resolve_family_parents(jsonb) TO service_role;
