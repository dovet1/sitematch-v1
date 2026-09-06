-- Migration: demote concession / host-building matches in store_floor_areas.
--
-- The defect
-- ----------
-- A concession is a unit trading inside somebody else's building: a Benugo café inside
-- John Lewis, a Vets4Pets inside a Pets at Home, an MFG EV charger in a Morrisons car
-- park. All three share one postal address with their host, and the host is the party
-- that lodges an EPC for the building. The matcher finds that certificate, agrees on the
-- street number, and grades the row `high` — because on its own terms the evidence is
-- good. The area it records is the host's.
--
--   "Benugo John Lewis Oxford"   139,360 sq ft   (the John Lewis, not the café)
--   "Vets4Pets Inside Pets At Home, 159 Sir Henry Parkes Rd"   41,086 sq ft
--   "Mfg Ev Power Morrisons Weybridge"   123,322 sq ft
--
-- `confidence` cannot catch this, and is not wrong not to: it grades whether the
-- certificate identifies the premises at that address, and the certificate does. What it
-- does not ask is whether the resulting number is credible for the format. That question
-- is what `size_plausibility` exists for.
--
-- The matcher does already answer it, partially: it demotes a row whose area falls outside
-- 3x its brand/fascia median, and 2,027 rows carry 'implausible_for_format' from that gate.
-- It cannot see a concession, because it anchors on the fascia's own median and a fascia
-- polluted by concessions inflates the very baseline meant to catch them. Hence the
-- category ceiling in rule B below, and hence the iteration.
--
-- Those 2,027 rows also mean the column arrived carrying two vocabularies for one idea.
-- Normalised to 'plausible' | 'implausible' below, and constrained, so it cannot drift a
-- third time — the original column was declared as bare text with only a comment
-- describing its values, which is what allowed the collision.
--
-- Where this rule belongs
-- -----------------------
-- In the matcher, which lives outside this repository. This migration is a corrective
-- pass over the output of matcher run `epc-2026.09.05-allbrands`; the rule below should
-- be ported into the matcher so the next run does not reintroduce the same rows.
--
-- The rule
-- --------
-- A high-confidence row is implausible when the certificate does not name our brand AND
-- the area is grossly out of scale for the format. Two ways of establishing scale, in
-- order of preference:
--
--   A. Against the store's own format. The fascia profile's median, requiring at least
--      20 stores behind it, and a 4x multiple. Fascia, never brand: Morrisons' brand-level
--      median is 2,669 sq ft because 660 Morrisons Daily shops outvote the supermarkets,
--      so every genuine Morrisons supermarket looks like a 46x outlier against it.
--
--   B. For a store with no trusted format baseline, against its category's 99th
--      percentile, at an 8x multiple. Deliberately extreme, because this is the weak test
--      and a wrong demotion destroys real data. At 8x it catches Benugo (21x its
--      category's p99) and leaves the genuine giants alone: IKEA Oxford Street is 4.8x,
--      UNIQLO Manchester 1.5x, Costco Leicester 1.03x. Category ceilings are computed
--      only from stores that DO have a trusted format baseline, so concessions cannot
--      inflate the ceiling that is meant to catch them.
--
-- `brand_on_certificate` does the load-bearing discrimination in both. A certificate that
-- names our brand and reports a large area is describing a large store of ours. IKEA
-- Wembley (461,244 sq ft) is untouched for exactly this reason.
--
-- Rejected: matching the host's name inside our own store name ("Benugo John Lewis
-- Oxford"). It reads as the obvious signal and it is not safe — "TK Maxx, Willow Place
-- Shopping Centre" matches the brand Willow, "Co-op Wells Next The Sea" matches Next,
-- "Tesco Lichfield Three Spires Express" matches Three. The harm is only ever an
-- implausible area, so the test is anchored on area.
--
-- Why it iterates
-- ---------------
-- Rule A judges a row against a median computed from rows that include the bad ones. A
-- 123,322 sq ft EV charger drags its own fascia median up and helps hide its neighbours.
-- So each pass demotes, rebuilds the affected profiles, and looks again, until a pass
-- finds nothing. On the data as it stands it converges after two demoting passes: 47
-- rows, then 4 more that only became visible once the first 47 stopped inflating the
-- medians ("Sainsbury's Smart Charge North Cheam", 115,572 sq ft, is an EV bay on its
-- host supermarket's certificate). The loop is bounded at 5 passes; convergence is the
-- expected exit.
--
-- Effect, measured against the data as it stands
-- ---------------------------------------------
--   51 of 19,111 high-confidence rows demoted (0.27%), over two passes.
--   Every flagged row was inspected: all are host-building matches.
--   No profile falls below the 5-store floor; 157 brands keep a distribution, as before.
--   Worked examples of the correction:
--     Vets4Pets      median 2,917 -> 2,142 sq ft, max 41,086 -> 10,053
--     MFG EV Power   median 1,459 -> 1,189 sq ft, max 123,322 -> 4,941
--   Benugo is left with no high-confidence measurement at all, so the product reports it
--   as "size not on record" — which is the true answer, and the one it should have given.
--
-- Rows are demoted to `low` — "a certificate was found but the evidence does not identify
-- the premises" — rather than deleted, and `matcher_version` records that this pass, not
-- the register, is what changed them.

-- =============================================================================
-- 1. One vocabulary for size_plausibility, enforced rather than described.
--
-- The matcher's own gate wrote 'implausible_for_format'; this migration writes
-- 'implausible'. They are the same judgement — the area is not credible for the format —
-- reached by different thresholds, and both act identically by demoting the row. The
-- direction of the failure is not encoded because it is derivable: compare floor_area_m2
-- against the brand/fascia profile median. The matcher's rows are predominantly too SMALL
-- (a neighbouring unit); this migration's are all too LARGE (the host building).
--
-- What is lost is being able to tell from this column alone which rule demoted a row.
-- That identity belongs to the matcher, which is committed and re-runnable at
-- scripts/epc, not to a snapshot column; preserving it here would mean a third value.
-- If it is ever needed at query time, the honest shape is a separate demoted_by column.
--
-- The two sets are disjoint, so order does not matter: this migration only demotes rows
-- that are currently `high`, and every 'implausible_for_format' row is already `low`.
-- =============================================================================
UPDATE public.store_floor_areas
SET size_plausibility = 'implausible'
WHERE size_plausibility = 'implausible_for_format';

ALTER TABLE public.store_floor_areas
  DROP CONSTRAINT IF EXISTS store_floor_areas_size_plausibility_valid;
ALTER TABLE public.store_floor_areas
  ADD CONSTRAINT store_floor_areas_size_plausibility_valid
  CHECK (size_plausibility IS NULL
      OR size_plausibility IN ('plausible', 'implausible'));

-- property_class had the same gap: free text, no constraint. The permitted set is what
-- the matcher's classifier can emit (scripts/epc/index_all_brands.py), which is wider
-- than what the current data happens to contain — 'institution' and 'other' have no rows
-- today but a later run can produce them, and a constraint that forbids them would fail
-- that run rather than catch a defect.
ALTER TABLE public.store_floor_areas
  DROP CONSTRAINT IF EXISTS store_floor_areas_property_class_valid;
ALTER TABLE public.store_floor_areas
  ADD CONSTRAINT store_floor_areas_property_class_valid
  CHECK (property_class IS NULL
      OR property_class IN ('retail','food','warehouse','industrial','office',
                            'hotel','leisure','institution','other'));

-- =============================================================================
-- 2. The correction, applied to a fixed point.
--
-- Everything below is idempotent: re-running the migration finds no `high` row that
-- fails the test and exits on the first pass.
-- =============================================================================
DO $concession$
DECLARE
  v_pass  int := 0;
  v_hits  int;
BEGIN
  -- Created once and refilled per pass. Creating and dropping a temp table inside a
  -- PL/pgSQL loop invites stale cached plans on the second iteration.
  CREATE TEMPORARY TABLE _format_baseline (
    store_id uuid PRIMARY KEY,
    baseline_median_m2 numeric,
    baseline_sample_count integer
  );
  CREATE TEMPORARY TABLE _fascia_category (
    fascia_id uuid PRIMARY KEY,
    category_id uuid
  );
  CREATE TEMPORARY TABLE _category_ceiling (
    category_id uuid PRIMARY KEY,
    p99_m2 double precision
  );
  CREATE TEMPORARY TABLE _concession_matches (store_id uuid PRIMARY KEY);
  CREATE TEMPORARY TABLE _affected_profiles (brand_id uuid, fascia_id uuid);

  LOOP
    v_pass := v_pass + 1;
    TRUNCATE _format_baseline, _fascia_category, _category_ceiling,
             _concession_matches, _affected_profiles;

    -- The baseline each store is judged against: its own fascia's profile, falling back
    -- to the brand-level profile only when the store has no fascia. Fascia, never brand:
    -- Morrisons' brand-level median is 2,669 sq ft because 660 Morrisons Daily shops
    -- outvote the supermarkets, so every genuine supermarket looks like a 46x outlier.
    INSERT INTO _format_baseline
    SELECT
      s.id                                          AS store_id,
      COALESCE(fp.median_m2, bp.median_m2)          AS baseline_median_m2,
      COALESCE(fp.sample_count, bp.sample_count, 0) AS baseline_sample_count
    FROM public.stores s
    LEFT JOIN public.brand_floor_area_profiles fp
           ON fp.brand_id = s.brand_id
          AND fp.fascia_id = s.fascia_id
    LEFT JOIN public.brand_floor_area_profiles bp
           ON bp.brand_id = s.brand_id
          AND bp.fascia_id IS NULL;

    -- One category per fascia, preferring the primary mapping.
    INSERT INTO _fascia_category
    SELECT DISTINCT ON (fc.fascia_id) fc.fascia_id, fc.category_id
    FROM public.fascia_categories fc
    ORDER BY fc.fascia_id, fc.is_primary DESC NULLS LAST, fc.category_id;

    -- Category ceilings, built ONLY from stores that have a trusted format baseline.
    -- Including the rest would let concessions raise the ceiling meant to catch them.
    INSERT INTO _category_ceiling
    SELECT
      fc.category_id,
      percentile_cont(0.99) WITHIN GROUP (ORDER BY sfa.floor_area_m2) AS p99_m2
    FROM public.store_floor_areas sfa
    JOIN public.stores s     ON s.id = sfa.store_id
    JOIN _format_baseline fb ON fb.store_id = s.id
    JOIN _fascia_category fc ON fc.fascia_id = s.fascia_id
    WHERE sfa.confidence = 'high'
      AND sfa.floor_area_m2 IS NOT NULL
      AND fb.baseline_sample_count >= 20
    GROUP BY fc.category_id
    HAVING count(*) >= 50;

    -- The rows that fail the test on this pass.
    INSERT INTO _concession_matches
    SELECT sfa.store_id
    FROM public.store_floor_areas sfa
    JOIN public.stores s           ON s.id = sfa.store_id
    JOIN _format_baseline fb       ON fb.store_id = s.id
    LEFT JOIN _fascia_category fc  ON fc.fascia_id = s.fascia_id
    LEFT JOIN _category_ceiling cc ON cc.category_id = fc.category_id
    WHERE sfa.confidence = 'high'
      AND sfa.floor_area_m2 IS NOT NULL
      -- A certificate naming our brand is describing our store, however large. This is
      -- what leaves IKEA Wembley (461,244 sq ft) alone.
      AND sfa.brand_on_certificate IS NOT TRUE
      AND (
            -- A. against the store's own format
            (fb.baseline_sample_count >= 20
             AND sfa.floor_area_m2 > fb.baseline_median_m2 * 4)
            -- B. no trusted format baseline: against the category, at a deliberately
            --    extreme multiple, because this is the weak test and a wrong demotion
            --    destroys real data
         OR (fb.baseline_sample_count < 20
             AND cc.p99_m2 IS NOT NULL
             AND sfa.floor_area_m2 > cc.p99_m2 * 8)
      );

    SELECT count(*) INTO v_hits FROM _concession_matches;

    IF v_hits > 0 THEN
      -- (brand, fascia) pairs whose profile this pass invalidates, plus the brand-level row.
      INSERT INTO _affected_profiles
      SELECT DISTINCT s.brand_id, s.fascia_id
      FROM _concession_matches c
      JOIN public.stores s ON s.id = c.store_id
      UNION
      SELECT DISTINCT s.brand_id, NULL::uuid
      FROM _concession_matches c
      JOIN public.stores s ON s.id = c.store_id;

      -- Demote. The area is kept: it is a real measurement of a real building, just not
      -- of our unit, and deleting it would hide the failure mode from the next person to
      -- look — the same reason `low` rows are kept at all.
      UPDATE public.store_floor_areas sfa
      SET confidence        = 'low',
          size_plausibility = 'implausible',
          matcher_version   = CASE
                                WHEN sfa.matcher_version LIKE '%+concession-2026.09.06'
                                  THEN sfa.matcher_version
                                ELSE sfa.matcher_version || '+concession-2026.09.06'
                              END,
          computed_at       = now()
      FROM _concession_matches c
      WHERE sfa.store_id = c.store_id;

      -- Rebuild the profiles this pass invalidated, from the rows that survived.
      --
      -- This recomputation reproduces all 330 existing profiles exactly when run over the
      -- uncorrected data, which is what licenses using it here: percentile_cont over
      -- confidence='high' rows grouped by (brand, fascia), a brand-level row over the same
      -- rows, and coefficient_of_variation as sample stddev over mean. Only the affected
      -- pairs are touched, so untouched profiles are left alone rather than rewritten by a
      -- second implementation of the same formula.
      DELETE FROM public.brand_floor_area_profiles p
      USING _affected_profiles a
      WHERE p.brand_id = a.brand_id
        AND p.fascia_key = COALESCE(a.fascia_id, '00000000-0000-0000-0000-000000000000'::uuid);

      INSERT INTO public.brand_floor_area_profiles (
        brand_id, fascia_id,
        p25_m2, median_m2, p75_m2, min_m2, max_m2,
        sample_count, coefficient_of_variation,
        measurement_basis, matcher_version, generated_at
      )
      WITH measured AS (
        SELECT s.brand_id, s.fascia_id, sfa.floor_area_m2 AS m2
        FROM public.store_floor_areas sfa
        JOIN public.stores s ON s.id = sfa.store_id
        WHERE sfa.confidence = 'high'
          AND sfa.floor_area_m2 IS NOT NULL
      ),
      grain AS (
        SELECT brand_id, fascia_id, m2 FROM measured WHERE fascia_id IS NOT NULL
        UNION ALL
        SELECT brand_id, NULL::uuid, m2 FROM measured
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
        'epc-2026.09.05-allbrands+concession-2026.09.06',
        now()
      FROM grain g
      JOIN _affected_profiles a
        ON a.brand_id = g.brand_id
       AND COALESCE(a.fascia_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = COALESCE(g.fascia_id, '00000000-0000-0000-0000-000000000000'::uuid)
      GROUP BY g.brand_id, g.fascia_id
      -- Below five stores there is no distribution to publish. A profile that falls under
      -- the floor stays deleted; the product then reads that brand from its individual
      -- measured shops instead, which is the honest fallback.
      HAVING count(*) >= 5;

    END IF;

    RAISE NOTICE 'concession pass %: demoted % row(s)', v_pass, v_hits;
    EXIT WHEN v_hits = 0 OR v_pass >= 5;
  END LOOP;

  DROP TABLE _affected_profiles, _concession_matches, _category_ceiling,
             _fascia_category, _format_baseline;
END
$concession$;

-- Everything that survived the test, and had never been assessed, is plausible on this
-- rule. Recorded so a reader can tell "checked and fine" from "never checked".
UPDATE public.store_floor_areas
SET size_plausibility = 'plausible'
WHERE confidence = 'high'
  AND floor_area_m2 IS NOT NULL
  AND size_plausibility IS NULL;

COMMENT ON COLUMN public.store_floor_areas.size_plausibility IS
  'plausible | implausible, enforced by store_floor_areas_size_plausibility_valid. Whether the area is credible for the store''s format. ''implausible'' means the certificate is real and correctly located but does not measure our unit — either the host building a concession sits inside (migration 20260908000000) or a smaller neighbouring unit (the matcher''s own 3x gate, scripts/epc). Such rows are demoted to confidence=''low''. The direction is not recorded here: compare floor_area_m2 against the brand/fascia profile median.';

COMMENT ON COLUMN public.store_floor_areas.property_class IS
  'Coarse use class the matcher grouped the certificate''s property_type into, and the unit of its per-brand admissibility rule: a Screwfix trade counter is certificated ''warehouse'', a Premier Inn ''hotel''. Enforced against the classifier''s full output set, which is wider than the values currently present.';
