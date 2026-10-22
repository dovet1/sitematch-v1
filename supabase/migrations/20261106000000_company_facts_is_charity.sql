-- Charities in Brand Matcher.
--
-- A charitable company files at Companies House like any other, but the figure we read as its
-- turnover is total income, mostly donations and grants rather than trading. is_charity marks
-- these companies: Brand Matcher labels the figure "Income (charity)" and leaves it out of the
-- turnover score. Set by an admin; profile refreshes never write it.

ALTER TABLE public.company_facts
  ADD COLUMN IF NOT EXISTS is_charity boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.company_facts.is_charity IS
  'Registered charity: turnover holds total income. Shown as income and left out of the Brand Matcher turnover score.';
