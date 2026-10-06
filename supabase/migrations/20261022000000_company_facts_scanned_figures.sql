-- Figures read from scanned accounts (Brand Matcher trading facts).
--
-- Accounts CH holds only as a PDF carry no iXBRL tags. A vision model now reads turnover and net
-- assets from them (apps/web/src/lib/companies-house/scanned-accounts.ts). Those figures get their
-- own status, 'extracted', so they are never confused with tagged 'filed' figures, and keep the
-- PDF page they were read from and the model that read them.

-- The original CHECKs were declared inline, so their names were generated; drop them by definition.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.company_facts'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ~ '(turnover|net_assets)_status'
  LOOP
    EXECUTE format('ALTER TABLE public.company_facts DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

-- Every constraint below is named and declared once (an inline column CHECK would be given an
-- auto-generated name that clashes with these), and dropped first so the migration can re-run.
ALTER TABLE public.company_facts
  ADD COLUMN IF NOT EXISTS turnover_page   integer,
  ADD COLUMN IF NOT EXISTS net_assets_page integer,
  ADD COLUMN IF NOT EXISTS figures_model   text,
  DROP CONSTRAINT IF EXISTS company_facts_turnover_value_check,
  DROP CONSTRAINT IF EXISTS company_facts_net_assets_value_check,
  DROP CONSTRAINT IF EXISTS company_facts_turnover_page_check,
  DROP CONSTRAINT IF EXISTS company_facts_net_assets_page_check,
  ADD CONSTRAINT company_facts_turnover_status_check
    CHECK (turnover_status IN ('filed', 'extracted', 'not_published', 'unread')),
  ADD CONSTRAINT company_facts_net_assets_status_check
    CHECK (net_assets_status IN ('filed', 'extracted', 'not_published', 'unread')),
  ADD CONSTRAINT company_facts_turnover_value_check
    CHECK ((turnover_status IN ('filed', 'extracted')) = (turnover IS NOT NULL)),
  ADD CONSTRAINT company_facts_net_assets_value_check
    CHECK ((net_assets_status IN ('filed', 'extracted')) = (net_assets IS NOT NULL)),
  ADD CONSTRAINT company_facts_turnover_page_check
    CHECK ((turnover_status = 'extracted') = (turnover_page IS NOT NULL) AND (turnover_page IS NULL OR turnover_page >= 1)),
  ADD CONSTRAINT company_facts_net_assets_page_check
    CHECK ((net_assets_status = 'extracted') = (net_assets_page IS NOT NULL) AND (net_assets_page IS NULL OR net_assets_page >= 1));

COMMENT ON COLUMN public.company_facts.turnover_page IS
  'For an extracted turnover: the 1-based page of the accounts PDF it was read from.';
COMMENT ON COLUMN public.company_facts.net_assets_page IS
  'For extracted net assets: the 1-based page of the accounts PDF it was read from.';
COMMENT ON COLUMN public.company_facts.figures_model IS
  'The model that read extracted figures from a scanned filing; null for iXBRL-tagged figures.';

-- Periods already checked and found to hold nothing readable were PDF-only filings (or failed
-- reads). Clear the marker so the next refresh reads them again, now with the scan fallback.
UPDATE public.company_facts
SET figures_period_end = NULL
WHERE turnover_status = 'unread' AND net_assets_status = 'unread' AND figures_period_end IS NOT NULL;
