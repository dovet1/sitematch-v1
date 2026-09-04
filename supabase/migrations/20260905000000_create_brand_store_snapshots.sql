-- Migration: brand_store_snapshots — monthly history of each brand's recorded estate.
--
-- Why this exists
-- ---------------
-- Store counts are derived live everywhere in the product: directory_brand_cards()
-- aggregates public.stores on every call, and fetchBrandStoreEstate() counts rows per
-- request. Nothing retains what an estate looked like last month, so "is this brand
-- opening or closing stores?" — the strongest cheap signal that a brand is worth
-- contacting — cannot be answered, and cannot be answered retrospectively either.
-- History only starts accruing once something writes it down. This is that thing.
--
-- Grain
-- -----
-- (snapshot_month, brand_id, county). National figures are the sum across counties, so
-- no rolled-up "all counties" row is stored and the two can never drift apart. Stores
-- with no county are bucketed as 'Unknown' rather than dropped, so the sum stays whole.
-- County is the coarsest geography already present on every store row; it is good enough
-- to say "nine openings in Kent" without inventing a region model first.
--
-- Honest counts
-- -------------
-- A naive store_count delta conflates two very different events: a brand opening shops,
-- and us importing a CSV. The four counts separate them:
--
--   store_count       rows held for the brand in that county at capture time
--   opened_in_period  stores whose open_date falls inside the month — real expansion
--   added_in_period   rows first created inside the month — our own import activity
--   with_open_date    rows carrying an open_date at all — coverage for the above
--
-- A month where added_in_period dwarfs opened_in_period is a backfill, not growth. Any
-- trend shown to a user has to say so rather than report a false net gain; open_date is
-- frequently null on imported stores, so with_open_date is what tells a consumer whether
-- opened_in_period can be trusted at all.
--
-- No history is backfilled here. It could be approximated from open_date alone, but that
-- silently ignores closures and every store imported without a date, producing a curve
-- that looks authoritative and is not.

-- =============================================================================
-- 1. Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.brand_store_snapshots (
  snapshot_month   date        NOT NULL,
  brand_id         uuid        NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  county           text        NOT NULL,
  store_count      integer     NOT NULL,
  opened_in_period integer     NOT NULL DEFAULT 0,
  added_in_period  integer     NOT NULL DEFAULT 0,
  with_open_date   integer     NOT NULL DEFAULT 0,
  captured_at      timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (snapshot_month, brand_id, county),

  CONSTRAINT brand_store_snapshots_month_is_first_of_month
    CHECK (snapshot_month = date_trunc('month', snapshot_month)::date),
  CONSTRAINT brand_store_snapshots_counts_non_negative
    CHECK (store_count >= 0 AND opened_in_period >= 0
       AND added_in_period >= 0 AND with_open_date >= 0),
  CONSTRAINT brand_store_snapshots_subcounts_within_total
    CHECK (opened_in_period <= store_count
       AND added_in_period <= store_count
       AND with_open_date <= store_count)
);

COMMENT ON TABLE public.brand_store_snapshots IS
  'Monthly, county-grained history of each brand''s recorded store estate. Written by snapshot_brand_stores(); national totals are the SUM across counties.';
COMMENT ON COLUMN public.brand_store_snapshots.county IS
  '''Unknown'' where the store carries no county, so summing counties always reproduces the national total.';
COMMENT ON COLUMN public.brand_store_snapshots.opened_in_period IS
  'Stores whose open_date falls in the month — genuine expansion. Only meaningful in proportion to with_open_date.';
COMMENT ON COLUMN public.brand_store_snapshots.added_in_period IS
  'Rows first created in the month — our import activity, not the brand''s. A large value here explains a store_count jump that is not growth.';
COMMENT ON COLUMN public.brand_store_snapshots.captured_at IS
  'When the row was last written. The current month is refreshed daily, so its counts are partial until the month closes.';

-- The primary key serves (snapshot_month, ...) lookups. Per-brand trend reads walk one
-- brand across many months, which is the opposite order.
CREATE INDEX IF NOT EXISTS idx_brand_store_snapshots_brand_month
  ON public.brand_store_snapshots (brand_id, snapshot_month DESC);

-- =============================================================================
-- 2. RLS — service_role only.
--
-- The trend this table accumulates is the product, not a public fact: it is exactly
-- what a competitor would want and cannot rebuild without waiting as long as we did.
-- No policies are defined, so with RLS enabled every anon and authenticated read is
-- refused; service_role bypasses RLS and is the only intended reader.
-- =============================================================================
ALTER TABLE public.brand_store_snapshots ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.brand_store_snapshots FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_store_snapshots TO service_role;

-- =============================================================================
-- 3. snapshot_brand_stores(p_month) — idempotent capture of one month.
--
-- Safe to run repeatedly: the current month is overwritten in place, so a run that is
-- missed, retried, or duplicated costs nothing. The cron refreshes both the current and
-- the previous month on every run, which closes out a month exactly at its boundary
-- instead of leaving it frozen at whatever the last run before midnight saw.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.snapshot_brand_stores(p_month date DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_month date    := date_trunc('month', coalesce(p_month, current_date))::date;
  v_next  date    := (v_month + interval '1 month')::date;
  v_rows  integer;
BEGIN
  INSERT INTO public.brand_store_snapshots AS bss (
    snapshot_month, brand_id, county,
    store_count, opened_in_period, added_in_period, with_open_date, captured_at
  )
  SELECT
    v_month,
    s.brand_id,
    coalesce(nullif(btrim(s.county), ''), 'Unknown'),
    count(*)::integer,
    count(*) FILTER (WHERE s.open_date >= v_month AND s.open_date < v_next)::integer,
    count(*) FILTER (WHERE s.created_at >= v_month AND s.created_at < v_next)::integer,
    count(*) FILTER (WHERE s.open_date IS NOT NULL)::integer,
    now()
  FROM public.stores s
  WHERE s.brand_id IS NOT NULL
    -- A store known to open after the month being captured was not part of the estate
    -- then. Without this, importing a pipeline of future openings would retroactively
    -- inflate every historic month it touches.
    AND (s.open_date IS NULL OR s.open_date < v_next)
  GROUP BY s.brand_id, coalesce(nullif(btrim(s.county), ''), 'Unknown')
  ON CONFLICT (snapshot_month, brand_id, county) DO UPDATE SET
    store_count      = EXCLUDED.store_count,
    opened_in_period = EXCLUDED.opened_in_period,
    added_in_period  = EXCLUDED.added_in_period,
    with_open_date   = EXCLUDED.with_open_date,
    captured_at      = EXCLUDED.captured_at;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  -- A brand/county pair that has fallen to zero stores since the last run would otherwise
  -- keep its stale row forever, and an estate could never appear to shrink. Absence of a
  -- row means zero, which is also what makes SUM-across-counties correct.
  DELETE FROM public.brand_store_snapshots d
  WHERE d.snapshot_month = v_month
    AND NOT EXISTS (
      SELECT 1
      FROM public.stores s
      WHERE s.brand_id = d.brand_id
        AND coalesce(nullif(btrim(s.county), ''), 'Unknown') = d.county
        AND (s.open_date IS NULL OR s.open_date < v_next)
    );

  RETURN v_rows;
END;
$$;

COMMENT ON FUNCTION public.snapshot_brand_stores(date) IS
  'Captures every brand''s store estate for the given month (default: current), grained by county. Idempotent — re-running overwrites the month in place. Returns the number of rows written.';

REVOKE EXECUTE ON FUNCTION public.snapshot_brand_stores(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.snapshot_brand_stores(date) TO service_role;
