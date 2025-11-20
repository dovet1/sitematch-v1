-- Create table for LSOA boundaries with PostGIS geometry
CREATE TABLE IF NOT EXISTS public.lsoa_boundaries (
  id BIGSERIAL PRIMARY KEY,
  lsoa_code TEXT NOT NULL UNIQUE,
  lsoa_name TEXT NOT NULL,
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  geometry GEOMETRY(MultiPolygon, 4326) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create spatial index for fast geographic queries
CREATE INDEX IF NOT EXISTS lsoa_boundaries_geometry_idx
  ON public.lsoa_boundaries
  USING GIST (geometry);

-- Create index on lsoa_code for lookups
CREATE INDEX IF NOT EXISTS lsoa_boundaries_code_idx
  ON public.lsoa_boundaries (lsoa_code);

-- Add comment explaining the table
COMMENT ON TABLE public.lsoa_boundaries IS
  'LSOA (Lower Layer Super Output Area) boundary polygons for England and Wales.
   Geometries are in WGS84 (EPSG:4326) coordinate system.';

-- Enable Row Level Security
ALTER TABLE public.lsoa_boundaries ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access (no authentication required)
CREATE POLICY "Allow public read access to LSOA boundaries"
  ON public.lsoa_boundaries
  FOR SELECT
  TO public
  USING (true);
