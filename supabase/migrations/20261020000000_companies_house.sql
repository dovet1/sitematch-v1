-- Companies House trading facts for Brand Matcher (docs/design_handoff_contact_brands).
--
-- Three service-role-only tables (RLS on, no policies; reads go through Plus/admin-gated routes):
--   company_facts              — one row per company number, the CH profile as last fetched.
--   brand_companies            — the confirmed link from a brand to its UK trading company.
--                                Only an admin creates one; nothing shows in Brand Matcher before.
--   brand_company_suggestions  — ranked CH search candidates offered to the admin.
--
-- Turnover and net assets live here but stay 'unread' until the accounts (iXBRL) parser lands.
-- 'unread' and 'not_published' are different facts: "Not disclosed" may only be shown for
-- 'not_published' (the filing carries no figure), never because we have not read one.
-- SiteMatcher never rates or scores these figures; nothing here feeds a match score.

CREATE TABLE IF NOT EXISTS public.company_facts (
  company_number          text PRIMARY KEY CHECK (company_number ~ '^[A-Z0-9]{8}$'),
  company_name            text NOT NULL,
  company_status          text,
  company_type            text,
  date_of_creation        date,
  registered_office       text,
  sic_codes               text[] NOT NULL DEFAULT '{}',
  last_accounts_made_up_to date,
  last_accounts_type      text,
  accounts_overdue        boolean NOT NULL DEFAULT false,
  next_accounts_due       date,
  turnover                numeric,
  turnover_status         text NOT NULL DEFAULT 'unread'
    CHECK (turnover_status IN ('filed', 'not_published', 'unread')),
  net_assets              numeric,
  net_assets_status       text NOT NULL DEFAULT 'unread'
    CHECK (net_assets_status IN ('filed', 'not_published', 'unread')),
  -- The balance-sheet date the two figures relate to, once they are read from a filing.
  figures_period_end      date,
  -- The CH company profile exactly as fetched, so a later parser change can re-derive columns.
  profile                 jsonb NOT NULL,
  fetched_at              timestamptz NOT NULL DEFAULT now(),
  CHECK ((turnover_status = 'filed') = (turnover IS NOT NULL)),
  CHECK ((net_assets_status = 'filed') = (net_assets IS NOT NULL))
);

COMMENT ON TABLE public.company_facts IS
  'Companies House profile facts per company, refreshed weekly. Figures shown as filed; never scored.';

CREATE TABLE IF NOT EXISTS public.brand_companies (
  brand_id       uuid PRIMARY KEY REFERENCES public.brands(id) ON DELETE CASCADE,
  company_number text NOT NULL REFERENCES public.company_facts(company_number),
  confirmed_by   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  confirmed_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_companies_company_number
  ON public.brand_companies(company_number);

COMMENT ON TABLE public.brand_companies IS
  'Admin-confirmed link from a brand to its UK trading company (the operator that signs leases, not the parent group).';

CREATE TABLE IF NOT EXISTS public.brand_company_suggestions (
  brand_id         uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  company_number   text NOT NULL,
  company_name     text NOT NULL,
  company_status   text,
  company_type     text,
  address_snippet  text,
  date_of_creation date,
  rank             integer NOT NULL,
  score            numeric NOT NULL,
  query            text NOT NULL,
  searched_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (brand_id, company_number)
);

ALTER TABLE public.company_facts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_companies           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_company_suggestions ENABLE ROW LEVEL SECURITY;
