-- Migration: DfT AADF traffic counts for "Find Sites" M4.
--
-- M4 attaches REAL traffic (DfT Annual Average Daily Flow) to the enrichment
-- universe so a candidate site can carry a screening AADF signal alongside its road
-- association (M3). As with roads, this is OCCUPIER-AGNOSTIC enrichment of the reusable
-- dataset: we store the raw DfT count points with FULL provenance and never invent a
-- High/Med/Low "traffic score" — the occupier search funnel decides what AADF it wants.
--
-- What a DfT AADF row is:
--   * DfT publishes one row per COUNT POINT per YEAR (a time series). A count point is a
--     POINT on a road link with lat/long, the road number/category/type, the estimation
--     method (Counted vs Estimated — critical honesty flag), and per-vehicle AADFs. The
--     headline figure is All_motor_vehicles.
--   * We keep EVERY year (source_reference = count_point_id:year), so trend/provenance
--     survive; the association step (M4b) picks the latest year per point for matching.
--   * DfT calls the road number column "Road_name" (e.g. 'A2','M2','U'); we store it as
--     road_number to match road_links.road_number so the two can be linked by identity.
--
-- Design notes:
--   * Source-agnostic like road_links: source='dft_aadf', but the schema is not DfT-
--     specific. Geometry is WGS84 (4326); the importer reprojects Easting/Northing if the
--     CSV is used in BNG, else it takes the Longitude/Latitude columns directly.
--   * NO association is stored here — parcel->road->AADF is a separate enrichment step
--     (20260727000000_associate_candidate_traffic.sql), so the linking method can be
--     designed and COMPARED (OS-Open-Roads-mediated vs raw count-point proximity vs, if
--     imported, DfT Major Roads geometry) against real Canterbury layouts, not assumed.
--
-- LICENCE / ATTRIBUTION (DfT road traffic statistics): Open Government Licence v3,
--   "Contains DfT road traffic statistics data © Crown copyright and database right {year}."
-- The importer records this in each row's provenance so it travels with the data.

-- =============================================================================
-- traffic_counts — one row per DfT AADF count point per year
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.traffic_counts (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geom                      geometry(Point, 4326) NOT NULL,
  count_point_id            text,        -- DfT Count_point_id (stable across years)
  year                      integer,     -- DfT Year (AADF applies to this year)
  road_number               text,        -- DfT Road_name, e.g. 'A2','M2','U' (matches road_links.road_number)
  road_category             text,        -- DfT Road_category, e.g. 'TA','PA','TM','PM','PU','MCU','MB'
  road_type                 text,        -- DfT Road_type: 'Major' | 'Minor'
  start_junction            text,        -- DfT Start_junction_road_name
  end_junction              text,        -- DfT End_junction_road_name
  link_length_km            numeric,     -- DfT Link_length_km (the link this point represents)
  estimation_method         text,        -- 'Counted' | 'Estimated' (headline honesty flag)
  estimation_method_detailed text,       -- e.g. 'Counted','Dependent on a nearby count','Estimated using previous years data'
  direction                 text,        -- present only in by-direction datasets; NULL for the combined AADF
  aadf_all_motor_vehicles   numeric,     -- headline AADF (All_motor_vehicles)
  aadf_all_hgvs             numeric,     -- All_HGVs
  aadf_cars_and_taxis       numeric,
  aadf_lgvs                 numeric,
  aadf_buses_and_coaches    numeric,
  aadf_two_wheeled_mv       numeric,     -- Two_wheeled_motor_vehicles
  pedal_cycles              numeric,     -- Pedal_cycles (not a motor vehicle; kept for completeness)
  source                    text NOT NULL,          -- 'dft_aadf'
  source_reference          text,                   -- count_point_id || ':' || year (idempotent unit)
  source_geometry_srid      integer,
  metadata                  jsonb NOT NULL DEFAULT '{}'::jsonb, -- full source row (every DfT column, incl. HGV axle breakdown)
  provenance                jsonb NOT NULL DEFAULT '{}'::jsonb, -- {dataset, version, imported_at, licence}
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.traffic_counts IS 'DfT AADF count points (one row per count point per year), source-agnostic. Raw traffic with full provenance for candidate->road->AADF enrichment. estimation_method (Counted vs Estimated) is preserved; no invented High/Med/Low score.';
COMMENT ON COLUMN public.traffic_counts.road_number IS 'DfT Road_name (the road identifier, e.g. A2/M2/U). Named road_number to align with road_links.road_number for identity linking.';
COMMENT ON COLUMN public.traffic_counts.aadf_all_motor_vehicles IS 'Headline AADF = DfT All_motor_vehicles. A screening signal only; read together with estimation_method and year.';
COMMENT ON COLUMN public.traffic_counts.estimation_method IS 'Counted vs Estimated. Estimated AADFs are modelled, not observed — never hide this behind a score.';

CREATE INDEX IF NOT EXISTS idx_traffic_counts_geom ON public.traffic_counts USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_traffic_counts_cp ON public.traffic_counts (count_point_id);
CREATE INDEX IF NOT EXISTS idx_traffic_counts_year ON public.traffic_counts (year);
CREATE INDEX IF NOT EXISTS idx_traffic_counts_number ON public.traffic_counts (road_number);
CREATE INDEX IF NOT EXISTS idx_traffic_counts_source ON public.traffic_counts (source);
CREATE UNIQUE INDEX IF NOT EXISTS uq_traffic_counts_source_ref
  ON public.traffic_counts (source, source_reference) WHERE source_reference IS NOT NULL;

DROP TRIGGER IF EXISTS update_traffic_counts_updated_at ON public.traffic_counts;
CREATE TRIGGER update_traffic_counts_updated_at
  BEFORE UPDATE ON public.traffic_counts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- RLS: public SELECT, admin manage; bulk writes via the service-role RPC below.
-- =============================================================================
ALTER TABLE public.traffic_counts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view traffic counts" ON public.traffic_counts;
CREATE POLICY "Public can view traffic counts" ON public.traffic_counts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage traffic counts" ON public.traffic_counts;
CREATE POLICY "Admins can manage traffic counts" ON public.traffic_counts
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'));

-- =============================================================================
-- import_traffic_counts() — bulk upsert of DfT AADF count points from GeoJSON point
-- features (WGS84) whose properties the importer has normalised to snake_case.
-- Upserts on (source, source_reference). service_role only.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.import_traffic_counts(
  p_features   jsonb,
  p_source     text,
  p_provenance jsonb    DEFAULT '{}'::jsonb,
  p_source_srid integer DEFAULT 4326
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  feat   jsonb;
  props  jsonb;
  g4326  geometry;
  v_ref  text;
  v_cnt  integer := 0;
BEGIN
  FOR feat IN SELECT * FROM jsonb_array_elements(coalesce(p_features, '[]'::jsonb))
  LOOP
    g4326 := ST_GeomFromGeoJSON(feat->'geometry');
    CONTINUE WHEN g4326 IS NULL OR ST_IsEmpty(g4326) OR GeometryType(g4326) <> 'POINT';
    g4326 := ST_SetSRID(g4326, 4326);
    props := coalesce(feat->'properties', '{}'::jsonb);
    v_ref := nullif(props->>'source_reference', '');

    INSERT INTO public.traffic_counts (
      geom, count_point_id, year, road_number, road_category, road_type,
      start_junction, end_junction, link_length_km, estimation_method,
      estimation_method_detailed, direction, aadf_all_motor_vehicles, aadf_all_hgvs,
      aadf_cars_and_taxis, aadf_lgvs, aadf_buses_and_coaches, aadf_two_wheeled_mv,
      pedal_cycles, source, source_reference, source_geometry_srid, metadata, provenance
    )
    VALUES (
      g4326,
      nullif(props->>'count_point_id',''),
      CASE WHEN nullif(props->>'year','') IS NOT NULL THEN (props->>'year')::integer END,
      nullif(props->>'road_number',''),
      nullif(props->>'road_category',''),
      nullif(props->>'road_type',''),
      nullif(props->>'start_junction',''),
      nullif(props->>'end_junction',''),
      CASE WHEN nullif(props->>'link_length_km','') IS NOT NULL THEN (props->>'link_length_km')::numeric END,
      nullif(props->>'estimation_method',''),
      nullif(props->>'estimation_method_detailed',''),
      nullif(props->>'direction',''),
      CASE WHEN nullif(props->>'aadf_all_motor_vehicles','') IS NOT NULL THEN (props->>'aadf_all_motor_vehicles')::numeric END,
      CASE WHEN nullif(props->>'aadf_all_hgvs','') IS NOT NULL THEN (props->>'aadf_all_hgvs')::numeric END,
      CASE WHEN nullif(props->>'aadf_cars_and_taxis','') IS NOT NULL THEN (props->>'aadf_cars_and_taxis')::numeric END,
      CASE WHEN nullif(props->>'aadf_lgvs','') IS NOT NULL THEN (props->>'aadf_lgvs')::numeric END,
      CASE WHEN nullif(props->>'aadf_buses_and_coaches','') IS NOT NULL THEN (props->>'aadf_buses_and_coaches')::numeric END,
      CASE WHEN nullif(props->>'aadf_two_wheeled_mv','') IS NOT NULL THEN (props->>'aadf_two_wheeled_mv')::numeric END,
      CASE WHEN nullif(props->>'pedal_cycles','') IS NOT NULL THEN (props->>'pedal_cycles')::numeric END,
      p_source, v_ref, p_source_srid,
      coalesce(props->'metadata','{}'::jsonb),
      p_provenance
    )
    ON CONFLICT (source, source_reference) WHERE source_reference IS NOT NULL
    DO UPDATE SET
      geom = EXCLUDED.geom,
      count_point_id = EXCLUDED.count_point_id,
      year = EXCLUDED.year,
      road_number = EXCLUDED.road_number,
      road_category = EXCLUDED.road_category,
      road_type = EXCLUDED.road_type,
      start_junction = EXCLUDED.start_junction,
      end_junction = EXCLUDED.end_junction,
      link_length_km = EXCLUDED.link_length_km,
      estimation_method = EXCLUDED.estimation_method,
      estimation_method_detailed = EXCLUDED.estimation_method_detailed,
      direction = EXCLUDED.direction,
      aadf_all_motor_vehicles = EXCLUDED.aadf_all_motor_vehicles,
      aadf_all_hgvs = EXCLUDED.aadf_all_hgvs,
      aadf_cars_and_taxis = EXCLUDED.aadf_cars_and_taxis,
      aadf_lgvs = EXCLUDED.aadf_lgvs,
      aadf_buses_and_coaches = EXCLUDED.aadf_buses_and_coaches,
      aadf_two_wheeled_mv = EXCLUDED.aadf_two_wheeled_mv,
      pedal_cycles = EXCLUDED.pedal_cycles,
      source_geometry_srid = EXCLUDED.source_geometry_srid,
      metadata = EXCLUDED.metadata,
      provenance = EXCLUDED.provenance,
      updated_at = now();

    v_cnt := v_cnt + 1;
  END LOOP;
  RETURN v_cnt;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.import_traffic_counts(jsonb, text, jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_traffic_counts(jsonb, text, jsonb, integer) TO service_role;

COMMENT ON FUNCTION public.import_traffic_counts(jsonb, text, jsonb, integer) IS 'Bulk upsert of DfT AADF count points from GeoJSON point features (WGS84), one per count point per year. service_role only.';
