-- Extra stand-ins needed by 20261018000000_postcode_centre_locations_strict_areas.sql. Test use only.
-- Apply after stubs.sql and the 20261012-20261017 migrations, before 20261018.
ALTER TABLE public.planning_applications
  ADD COLUMN IF NOT EXISTS postcode text,
  ADD COLUMN IF NOT EXISTS location_precision text,
  ADD COLUMN IF NOT EXISTS intelligence_tier boolean,
  ADD COLUMN IF NOT EXISTS stated_floorspace_sqm numeric;
ALTER TABLE public.developments
  ADD COLUMN IF NOT EXISTS location geography(Point,4326),
  ADD COLUMN IF NOT EXISTS location_provenance text,
  ADD COLUMN IF NOT EXISTS postcode text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS relevance text,
  ADD COLUMN IF NOT EXISTS summary text;
CREATE TABLE IF NOT EXISTS public.uk_postcode_centroids (
  postcode text PRIMARY KEY,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  location geography(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography) STORED,
  is_live boolean NOT NULL DEFAULT true
);
