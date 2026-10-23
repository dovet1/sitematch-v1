-- Co-operative societies in Brand Matcher.
--
-- A co-operative society is listed at Companies House (an IP… or SP… number) but files its
-- accounts with the FCA Mutuals Public Register, so Companies House has no turnover or net assets
-- for it. figures_source = 'fca_mutuals' marks figures read from the society's accounts on the
-- FCA register: Brand Matcher names that register as the source, and a profile refresh keeps the
-- figures rather than clearing them for want of Companies House accounts. null means Companies House.

ALTER TABLE public.company_facts
  ADD COLUMN IF NOT EXISTS figures_source text
  CHECK (figures_source IN ('fca_mutuals'));

COMMENT ON COLUMN public.company_facts.figures_source IS
  'Where turnover and net assets were read from when not Companies House: fca_mutuals (FCA Mutuals Public Register). null = Companies House.';
