-- Add Google Places validation columns (compliance-safe approach per Codex review)
-- This stores only the place_id and a review flag, not Google-derived distance metrics
-- Compliant with Google ToS: place_id storage is allowed, coordinate caching is restricted

ALTER TABLE stores
  ADD COLUMN google_place_id TEXT,
  ADD COLUMN geocode_needs_review BOOLEAN DEFAULT FALSE;

-- Index for place_id lookups
CREATE INDEX idx_stores_google_place_id ON stores(google_place_id)
  WHERE google_place_id IS NOT NULL;

-- Index for finding stores needing manual review
CREATE INDEX idx_stores_geocode_needs_review ON stores(geocode_needs_review)
  WHERE geocode_needs_review = TRUE;

-- Documentation
COMMENT ON COLUMN stores.google_place_id IS 'Google Places API place_id for reference (from validation, not used for coordinates). Coordinates are always from Mapbox Permanent Geocoding for ToS compliance.';
COMMENT ON COLUMN stores.geocode_needs_review IS 'Flag indicating Mapbox and Google coordinates differed significantly (>10m) during validation. Manual review recommended.';
