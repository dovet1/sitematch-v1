-- Minimal stand-ins for the production tables the Brand Matcher demographic migrations read.
-- Throwaway database only. Order: this file, the migrations, fixtures.sql.
--
--   createdb bdp && psql -v ON_ERROR_STOP=1 -d bdp -f supabase/tests/brand-demographics/stubs.sql \
--     -f supabase/migrations/20261023000000_brand_demographic_profiles.sql \
--     -f supabase/migrations/20261023020000_size_adjusted_demographic_ranks.sql \
--     -f supabase/migrations/20261023030000_size_bands_limit_population_spread.sql \
--     -f supabase/migrations/20261023040000_brand_demographic_backtest.sql \
--     -f supabase/tests/brand-demographics/fixtures.sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF;
END $$;
CREATE TABLE public.brands (id uuid PRIMARY KEY, name text);
CREATE TABLE public.fascias (id uuid PRIMARY KEY, brand_id uuid REFERENCES public.brands(id), name text);
CREATE TABLE public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid, fascia_id uuid, name text, location geography(Point,4326)
);
CREATE TABLE public.built_up_areas (gsscode text PRIMARY KEY, name text NOT NULL, pop_final integer);
CREATE TABLE public.built_up_area_geometries (gsscode text PRIMARY KEY, geom geometry(MultiPolygon,4326));
CREATE INDEX ON public.built_up_area_geometries USING gist (geom);
CREATE TABLE public.demographic_signal_mappings (signal_name text PRIMARY KEY, signal_category text NOT NULL);
CREATE TABLE public.bua_demographic_signals (
  bua_gsscode text, signal_name text, index_score numeric(6,2), UNIQUE (bua_gsscode, signal_name)
);
