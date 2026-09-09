-- Make the paid research pass's commercial facts queryable and preserve their direction.
-- `commercial_use_classes` remains the initial classifier's combined reading; these two
-- fields come only from source-grounded council/document/web research.

ALTER TABLE public.developments
  ADD COLUMN existing_commercial_use_classes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN proposed_commercial_use_classes text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.developments.existing_commercial_use_classes IS
  'Existing or former planning use classes explicitly grounded by the paid research pass.';
COMMENT ON COLUMN public.developments.proposed_commercial_use_classes IS
  'Proposed planning use classes explicitly grounded by the paid research pass.';

-- GIA, NIA and GEA are not interchangeable. Keeping the basis beside the observation stops
-- a later market-size query from silently summing unlike measurements.
ALTER TABLE public.development_observations
  ADD COLUMN measurement_basis text;

ALTER TABLE public.development_observations
  ADD CONSTRAINT development_observations_measurement_basis CHECK (
    measurement_basis IS NULL
    OR measurement_basis IN ('gross_internal', 'net_internal', 'gross_external', 'unspecified')
  );

COMMENT ON COLUMN public.development_observations.measurement_basis IS
  'Area basis for researched commercial floorspace: gross_internal, net_internal, gross_external or unspecified.';
