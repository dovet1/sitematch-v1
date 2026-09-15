-- Minimal stand-ins for the production tables the Planning Monitor migration reads. Test use only.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE TABLE public.users (id uuid PRIMARY KEY, email text);
CREATE TABLE public.brands (id uuid PRIMARY KEY, name text);
CREATE TABLE public.stores (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), brand_id uuid, location geography(Point,4326));
CREATE TABLE public.planning_alert_subscriptions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, enabled boolean, updated_at timestamptz);
CREATE FUNCTION public.planning_location_uncertainty_m(p text) RETURNS double precision LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p WHEN 'source_exact' THEN 0 WHEN 'source_centroid' THEN 1500 WHEN 'postcode_centroid' THEN 200 ELSE 0 END::double precision $$;
CREATE TABLE public.planning_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider_id text DEFAULT 'x', authority_name text DEFAULT 'Leeds', reference text,
  address text, description text NOT NULL DEFAULT '', status text, stage text, procedure text, planning_route text,
  commercial_work text, links jsonb DEFAULT '{}', stated_dwelling_count integer, eligibility_limbs text[] NOT NULL DEFAULT '{}',
  location geography(Point,4326), location_provenance text NOT NULL DEFAULT 'source_exact',
  date_received date, date_validated date, date_decided date, source_changed_at timestamptz);
CREATE INDEX ON public.planning_applications USING gist ((location::geometry));
CREATE TABLE public.developments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), review_state text NOT NULL DEFAULT 'pending',
  model_dwelling_count integer, model_dwelling_basis text, creates_commercial_space text, family_state text);
CREATE TABLE public.development_applications (development_id uuid REFERENCES public.developments(id), planning_application_id uuid UNIQUE REFERENCES public.planning_applications(id), role text DEFAULT 'primary');
CREATE TABLE public.feature_flags (key text PRIMARY KEY, enabled boolean NOT NULL DEFAULT false, description text);
