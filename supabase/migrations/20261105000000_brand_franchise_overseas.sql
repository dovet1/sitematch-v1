-- Overseas brands in Brand Matcher.
--
-- A brand run from abroad, with no UK company that files accounts at Companies House, is in the
-- same position as a franchise: no UK record represents it, so it would otherwise score 0 for
-- turnover. brand_franchise now records why a brand has no UK record: 'franchise' (sites run by
-- franchisees) or 'overseas'. Brand Matcher shows "Franchise" or "Overseas" in place of the
-- financials and leaves turnover out of the score, as before; only confidence = 'high' counts.

ALTER TABLE public.brand_franchise
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'franchise'
  CHECK (kind IN ('franchise', 'overseas'));

COMMENT ON TABLE public.brand_franchise IS
  'Brands no single UK Companies House record represents: run by franchisees (kind = franchise) or from overseas (kind = overseas). Only confidence = high is shown in Brand Matcher, in place of Companies House financials.';
