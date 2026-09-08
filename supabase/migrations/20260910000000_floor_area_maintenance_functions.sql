-- Migration: make the floor-area aggregate maintainable.
--
-- Why this exists
-- ---------------
-- Two things currently only happen when a person runs Python on a laptop:
--
--   1. `brand_floor_area_profiles` is computed by `scripts/epc/finalise_all.py` and
--      loaded by `load_to_db.py`. So a store matched by any other route — the import
--      queue this plan adds — would never reach a user, because the profile it belongs
--      to would not change until the next manual run.
--
--   2. The concession rule lives inside migration `20260908000000`, which says so
--      itself: "the rule below should be ported into the matcher so the next run does
--      not reintroduce the same rows". Ported into the *matcher* it would still be
--      absent from every other writer. Both matchers write here, so here is where it
--      belongs.
--
-- This migration only DEFINES the functions. It does not run them. See the note at the
-- foot for the self-test, which is worth performing precisely because the data is
-- already at this rule's fixed point.
--
-- The rule itself is unchanged and is documented in full in `20260908000000`; that
-- migration's header is the reference and is not repeated here. What changes is where it
-- lives and two defects found while lifting it.
--
-- Defect 1 — the rebuild must be able to DELETE.
-- `brand_floor_area_profiles` carries CHECK (sample_count >= 5). When demotions push a
-- fascia below five measured stores, an upsert violates that constraint and takes the
-- whole rebuild down with it. `20260908000000` got this right by deleting first and
-- re-inserting with HAVING count(*) >= 5, and that shape is preserved here: a profile
-- that no longer qualifies is removed, so the UI shows the brand's individual measured
-- shops rather than a stale distribution.
--
-- Defect 2 — order, and repetition.
-- Demote, then rebuild, then demote again. A concession match carries its host
-- building's area, and that inflated row raises the very fascia median it would be
-- judged against. Rebuilding profiles before demoting bakes the bad row into the
-- baseline; demoting once and stopping leaves the rows that only become visible after
-- the first correction. Convergence, not a fixed pass count, is the exit — bounded at 5.

-- =============================================================================
-- 1. rebuild_brand_floor_area_profiles
--
-- The one implementation of the aggregate. `finalise_all.py` should stop computing
-- profiles and `load_to_db.py` should call this instead, so the figure the admin screen
-- reads back is the figure the product serves, computed once.
--
-- The formula is not new: it is lifted verbatim from `20260908000000`, which recorded
-- that it reproduces all 330 existing profiles exactly when run over the uncorrected
-- data. That is what licenses reusing it rather than writing a second implementation of
-- the same percentiles.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.rebuild_brand_floor_area_profiles(
  p_brand_ids uuid[] DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE v_rows integer;
BEGIN
  -- Scoped by brand, not by (brand, fascia): a demotion can remove a fascia's last
  -- measured store, and a pair-scoped rebuild would never visit the row that now has to
  -- disappear. Deleting every profile for the affected brands and rebuilding from what
  -- survives cannot leave an orphan behind.
  DELETE FROM public.brand_floor_area_profiles p
  WHERE p_brand_ids IS NULL OR p.brand_id = ANY(p_brand_ids);

  INSERT INTO public.brand_floor_area_profiles (
    brand_id, fascia_id,
    p25_m2, median_m2, p75_m2, min_m2, max_m2,
    sample_count, coefficient_of_variation,
    measurement_basis, matcher_version, generated_at
  )
  WITH measured AS (
    SELECT s.brand_id, s.fascia_id, sfa.floor_area_m2 AS m2, sfa.matcher_version
    FROM public.store_floor_areas sfa
    JOIN public.stores s ON s.id = sfa.store_id
    WHERE sfa.confidence = 'high'
      AND sfa.floor_area_m2 IS NOT NULL
      AND (p_brand_ids IS NULL OR s.brand_id = ANY(p_brand_ids))
  ),
  -- A NULL fascia_id is the brand-level profile, computed over every measured store of
  -- the brand — not a rollup of the fascia rows, so a store with no fascia still counts.
  grain AS (
    SELECT brand_id, fascia_id, m2, matcher_version FROM measured WHERE fascia_id IS NOT NULL
    UNION ALL
    SELECT brand_id, NULL::uuid, m2, matcher_version FROM measured
  )
  SELECT
    g.brand_id,
    g.fascia_id,
    percentile_cont(0.25) WITHIN GROUP (ORDER BY g.m2),
    percentile_cont(0.50) WITHIN GROUP (ORDER BY g.m2),
    percentile_cont(0.75) WITHIN GROUP (ORDER BY g.m2),
    min(g.m2),
    max(g.m2),
    count(*)::int,
    CASE WHEN count(*) > 1 AND avg(g.m2) > 0
         THEN stddev_samp(g.m2) / avg(g.m2) END,
    'gross_internal_area',
    -- Rows behind one profile can now come from several matchers — a quarterly full run
    -- plus whatever the import queue matched since — and the column holds one value. The
    -- lexicographic max is taken as a marker, not as a claim that one matcher produced
    -- the whole profile; it is deliberately not meaningful enough to compute from. The
    -- per-row truth is on store_floor_areas.matcher_version, which is where any question
    -- about provenance should be answered.
    max(g.matcher_version),
    now()
  FROM grain g
  GROUP BY g.brand_id, g.fascia_id
  -- Below five stores there is no distribution to publish; the product falls back to the
  -- brand's individual measured shops, which is the honest answer.
  HAVING count(*) >= 5;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END $$;

COMMENT ON FUNCTION public.rebuild_brand_floor_area_profiles(uuid[]) IS
  'Rebuilds brand_floor_area_profiles from confidence=''high'' rows. NULL rebuilds every brand; an array scopes it to those brands after an incremental match. Deletes as well as inserts: a fascia that drops below the 5-store floor loses its profile rather than keeping a stale one. Returns rows written.';

-- =============================================================================
-- 2. demote_implausible_floor_area_matches
--
-- The concession rule from 20260908000000, as a function. Rules A and B, their
-- thresholds and their justification are documented there in full.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.demote_implausible_floor_area_matches(
  p_version_tag text DEFAULT 'concession'
) RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_pass    int := 0;
  v_hits    int;
  v_total   int := 0;
  v_brands  uuid[];
BEGIN
  CREATE TEMPORARY TABLE _fb (
    store_id uuid PRIMARY KEY,
    baseline_median_m2 numeric,
    baseline_sample_count integer
  ) ON COMMIT DROP;
  CREATE TEMPORARY TABLE _fc (fascia_id uuid PRIMARY KEY, category_id uuid) ON COMMIT DROP;
  CREATE TEMPORARY TABLE _cc (category_id uuid PRIMARY KEY, p99_m2 double precision) ON COMMIT DROP;
  CREATE TEMPORARY TABLE _hits (store_id uuid PRIMARY KEY) ON COMMIT DROP;

  LOOP
    v_pass := v_pass + 1;
    TRUNCATE _fb, _fc, _cc, _hits;

    -- Each store's baseline: its own fascia's profile, falling back to brand level only
    -- when it has no fascia. Fascia, never brand — see 20260908000000 for why Morrisons
    -- makes this non-negotiable.
    INSERT INTO _fb
    SELECT s.id,
           COALESCE(fp.median_m2, bp.median_m2),
           COALESCE(fp.sample_count, bp.sample_count, 0)
    FROM public.stores s
    LEFT JOIN public.brand_floor_area_profiles fp
           ON fp.brand_id = s.brand_id AND fp.fascia_id = s.fascia_id
    LEFT JOIN public.brand_floor_area_profiles bp
           ON bp.brand_id = s.brand_id AND bp.fascia_id IS NULL;

    INSERT INTO _fc
    SELECT DISTINCT ON (fc.fascia_id) fc.fascia_id, fc.category_id
    FROM public.fascia_categories fc
    ORDER BY fc.fascia_id, fc.is_primary DESC NULLS LAST, fc.category_id;

    -- Ceilings built only from stores that DO have a trusted format baseline, so
    -- concessions cannot inflate the ceiling meant to catch them.
    INSERT INTO _cc
    SELECT fc.category_id,
           percentile_cont(0.99) WITHIN GROUP (ORDER BY sfa.floor_area_m2)
    FROM public.store_floor_areas sfa
    JOIN public.stores s ON s.id = sfa.store_id
    JOIN _fb fb ON fb.store_id = s.id
    JOIN _fc fc ON fc.fascia_id = s.fascia_id
    WHERE sfa.confidence = 'high'
      AND sfa.floor_area_m2 IS NOT NULL
      AND fb.baseline_sample_count >= 20
    GROUP BY fc.category_id
    HAVING count(*) >= 50;

    INSERT INTO _hits
    SELECT sfa.store_id
    FROM public.store_floor_areas sfa
    JOIN public.stores s      ON s.id = sfa.store_id
    JOIN _fb fb               ON fb.store_id = s.id
    LEFT JOIN _fc fc          ON fc.fascia_id = s.fascia_id
    LEFT JOIN _cc cc          ON cc.category_id = fc.category_id
    WHERE sfa.confidence = 'high'
      AND sfa.floor_area_m2 IS NOT NULL
      -- A certificate naming our brand describes our store, however large. This is what
      -- leaves IKEA Wembley (461,244 sq ft) alone.
      AND sfa.brand_on_certificate IS NOT TRUE
      AND (
            (fb.baseline_sample_count >= 20
             AND sfa.floor_area_m2 > fb.baseline_median_m2 * 4)
         OR (fb.baseline_sample_count < 20
             AND cc.p99_m2 IS NOT NULL
             AND sfa.floor_area_m2 > cc.p99_m2 * 8)
      );

    SELECT count(*) INTO v_hits FROM _hits;
    EXIT WHEN v_hits = 0 OR v_pass > 5;

    SELECT array_agg(DISTINCT s.brand_id) INTO v_brands
    FROM _hits h JOIN public.stores s ON s.id = h.store_id;

    -- The area is kept. It is a real measurement of a real building, just not of our
    -- unit, and deleting it would hide the failure mode from the next person to look.
    UPDATE public.store_floor_areas sfa
    SET confidence        = 'low',
        size_plausibility = 'implausible',
        matcher_version   = CASE
                              WHEN sfa.matcher_version LIKE '%+' || p_version_tag
                                THEN sfa.matcher_version
                              ELSE sfa.matcher_version || '+' || p_version_tag
                            END,
        computed_at       = now()
    FROM _hits h
    WHERE sfa.store_id = h.store_id;

    v_total := v_total + v_hits;

    -- Rebuild before looking again, or the next pass judges against medians the rows we
    -- just demoted are still inflating.
    PERFORM public.rebuild_brand_floor_area_profiles(v_brands);

    RAISE NOTICE 'demote pass %: % row(s)', v_pass, v_hits;
  END LOOP;

  -- Checked and found credible, as distinct from never checked.
  UPDATE public.store_floor_areas
  SET size_plausibility = 'plausible'
  WHERE confidence = 'high'
    AND floor_area_m2 IS NOT NULL
    AND size_plausibility IS NULL;

  RETURN v_total;
END $$;

COMMENT ON FUNCTION public.demote_implausible_floor_area_matches(text) IS
  'Demotes high-confidence rows whose area is not credible for the format — almost always a concession recorded with its host building''s certificate. Iterates to a fixed point, rebuilding affected profiles between passes because a bad row inflates the median it is judged against. Returns rows demoted; 0 means the data is already at the fixed point. Rule and thresholds documented in migration 20260908000000.';

-- =============================================================================
-- 3. Permissions — same posture as the tables these read and write.
-- =============================================================================
REVOKE ALL ON FUNCTION public.rebuild_brand_floor_area_profiles(uuid[])   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.demote_implausible_floor_area_matches(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_brand_floor_area_profiles(uuid[])   TO service_role;
GRANT EXECUTE ON FUNCTION public.demote_implausible_floor_area_matches(text) TO service_role;

-- =============================================================================
-- 4. Self-test, worth running once after applying.
--
-- Migration 20260908000000 already brought the data to this rule's fixed point, and
-- recorded that the rebuild formula reproduces the profiles it replaced exactly. So on
-- current data:
--
--   SELECT public.demote_implausible_floor_area_matches();   -- expect 0
--   SELECT count(*) FROM public.brand_floor_area_profiles;   -- note it, then
--   SELECT public.rebuild_brand_floor_area_profiles();       -- expect the same count
--
-- A non-zero demote count means this port is not faithful to 20260908000000. A changed
-- profile count means the rebuild is not faithful to finalise_all.py. Either is a reason
-- to stop rather than proceed.
-- =============================================================================
