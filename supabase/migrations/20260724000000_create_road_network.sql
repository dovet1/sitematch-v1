-- Migration: road network (OS Open Roads: RoadLink + RoadNode) for "Find Sites" M3.
--
-- M3 associates every candidate site in the ENRICHMENT UNIVERSE (all HMLR polygons
-- >= 0.3 ac) with the road network, so later milestones can measure road proximity,
-- class, frontage (M6) and junction distance (M6), and attach traffic (M4).
--
-- Design notes:
--  * Source-agnostic like candidate_sites: we store OS Open Roads first, but the
--    schema is not OS-specific — a road_link is any classified road centreline.
--  * We keep OS attributes we actually need for matching + provenance: classification,
--    function, number, name, form-of-way, primary/trunk flags, and start/end node TOIDs
--    so junction topology survives.
--  * Geometry is WGS84 (4326); metric length is computed via geography at import.
--  * NO association is stored here — that is a separate enrichment step (candidate ->
--    road) authored once real OS geometry is imported, so the association method can be
--    designed and compared against real Canterbury road layouts (parallel roads, dual
--    carriageways, shared numbers) rather than assumed.

-- =============================================================================
-- road_links — classified road centrelines (OS Open Roads RoadLink)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.road_links (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geom                 geometry(MultiLineString, 4326) NOT NULL,
  road_classification  text,        -- OS roadClassification: 'A Road','B Road','Motorway','Classified Unnumbered','Unclassified','Unknown', ...
  road_function        text,        -- OS roadFunction: 'A Road','Minor Road','Motorway','Restricted Local Access Road', ...
  road_number          text,        -- OS roadClassificationNumber: e.g. 'A28' (NULL when unnumbered)
  name                 text,        -- OS name1
  form_of_way          text,        -- OS formOfWay: 'Single Carriageway','Dual Carriageway','Roundabout','Slip Road', ...
  primary_route        boolean,     -- OS primaryRoute
  trunk_road           boolean,     -- OS trunkRoad
  length_m             numeric,     -- computed via geography (source length kept in metadata)
  start_node_ref       text,        -- OS startNode TOID (junction topology)
  end_node_ref         text,        -- OS endNode TOID
  source               text NOT NULL,          -- e.g. 'os_open_roads'
  source_reference     text,                   -- RoadLink TOID / gml id
  source_geometry_srid integer,
  metadata             jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance           jsonb NOT NULL DEFAULT '{}'::jsonb,  -- {dataset, version, imported_at, licence}
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.road_links IS 'Classified road centrelines (OS Open Roads RoadLink first). Source-agnostic; used for candidate->road association, proximity, class, frontage and junction distance.';
COMMENT ON COLUMN public.road_links.road_number IS 'OS roadClassificationNumber (e.g. A28). NULL = unnumbered; not the same as unclassified.';

CREATE INDEX IF NOT EXISTS idx_road_links_geom ON public.road_links USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_road_links_classification ON public.road_links (road_classification);
CREATE INDEX IF NOT EXISTS idx_road_links_number ON public.road_links (road_number);
CREATE INDEX IF NOT EXISTS idx_road_links_source ON public.road_links (source);
CREATE UNIQUE INDEX IF NOT EXISTS uq_road_links_source_ref
  ON public.road_links (source, source_reference) WHERE source_reference IS NOT NULL;

-- =============================================================================
-- road_nodes — junctions / road ends (OS Open Roads RoadNode)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.road_nodes (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geom                 geometry(Point, 4326) NOT NULL,
  form_of_road_node    text,        -- OS formOfRoadNode: 'junction','roundabout','road end','pseudo node','enclosed traffic area', ...
  source               text NOT NULL,
  source_reference     text,                   -- RoadNode TOID / gml id
  source_geometry_srid integer,
  metadata             jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.road_nodes IS 'Road network nodes (OS Open Roads RoadNode). Used for junction/roundabout proximity (M6). Real junctions only where formOfRoadNode indicates one.';

CREATE INDEX IF NOT EXISTS idx_road_nodes_geom ON public.road_nodes USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_road_nodes_form ON public.road_nodes (form_of_road_node);
CREATE INDEX IF NOT EXISTS idx_road_nodes_source ON public.road_nodes (source);
CREATE UNIQUE INDEX IF NOT EXISTS uq_road_nodes_source_ref
  ON public.road_nodes (source, source_reference) WHERE source_reference IS NOT NULL;

-- updated_at triggers
DROP TRIGGER IF EXISTS update_road_links_updated_at ON public.road_links;
CREATE TRIGGER update_road_links_updated_at
  BEFORE UPDATE ON public.road_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_road_nodes_updated_at ON public.road_nodes;
CREATE TRIGGER update_road_nodes_updated_at
  BEFORE UPDATE ON public.road_nodes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- RLS: public SELECT, admin manage; bulk writes via service-role RPCs.
-- =============================================================================
ALTER TABLE public.road_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.road_nodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view road links" ON public.road_links;
CREATE POLICY "Public can view road links" ON public.road_links FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage road links" ON public.road_links;
CREATE POLICY "Admins can manage road links" ON public.road_links
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'));

DROP POLICY IF EXISTS "Public can view road nodes" ON public.road_nodes;
CREATE POLICY "Public can view road nodes" ON public.road_nodes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage road nodes" ON public.road_nodes;
CREATE POLICY "Admins can manage road nodes" ON public.road_nodes
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'));

-- =============================================================================
-- Bulk import RPCs (service_role only). Accept GeoJSON `features` already in WGS84.
-- Property names are normalised by the importer to snake_case before calling.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.import_road_links(
  p_features jsonb,
  p_source text,
  p_provenance jsonb DEFAULT '{}'::jsonb,
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
    g4326 := ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_GeomFromGeoJSON(feat->'geometry')), 2)); -- 2 = lines
    CONTINUE WHEN g4326 IS NULL OR ST_IsEmpty(g4326);
    g4326 := ST_SetSRID(g4326, 4326);
    props := coalesce(feat->'properties', '{}'::jsonb);
    v_ref := nullif(props->>'source_reference', '');

    INSERT INTO public.road_links (
      geom, road_classification, road_function, road_number, name, form_of_way,
      primary_route, trunk_road, length_m, start_node_ref, end_node_ref,
      source, source_reference, source_geometry_srid, metadata, provenance
    )
    VALUES (
      g4326,
      nullif(props->>'road_classification',''),
      nullif(props->>'road_function',''),
      nullif(props->>'road_number',''),
      nullif(props->>'name',''),
      nullif(props->>'form_of_way',''),
      CASE WHEN props ? 'primary_route' THEN (props->>'primary_route')::boolean END,
      CASE WHEN props ? 'trunk_road' THEN (props->>'trunk_road')::boolean END,
      ST_Length(g4326::geography),
      nullif(props->>'start_node_ref',''),
      nullif(props->>'end_node_ref',''),
      p_source, v_ref, p_source_srid,
      coalesce(props->'metadata','{}'::jsonb),
      p_provenance
    )
    ON CONFLICT (source, source_reference) WHERE source_reference IS NOT NULL
    DO UPDATE SET
      geom = EXCLUDED.geom,
      road_classification = EXCLUDED.road_classification,
      road_function = EXCLUDED.road_function,
      road_number = EXCLUDED.road_number,
      name = EXCLUDED.name,
      form_of_way = EXCLUDED.form_of_way,
      primary_route = EXCLUDED.primary_route,
      trunk_road = EXCLUDED.trunk_road,
      length_m = EXCLUDED.length_m,
      start_node_ref = EXCLUDED.start_node_ref,
      end_node_ref = EXCLUDED.end_node_ref,
      source_geometry_srid = EXCLUDED.source_geometry_srid,
      metadata = EXCLUDED.metadata,
      provenance = EXCLUDED.provenance,
      updated_at = now();

    v_cnt := v_cnt + 1;
  END LOOP;
  RETURN v_cnt;
END;
$$;

CREATE OR REPLACE FUNCTION public.import_road_nodes(
  p_features jsonb,
  p_source text,
  p_provenance jsonb DEFAULT '{}'::jsonb,
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

    INSERT INTO public.road_nodes (
      geom, form_of_road_node, source, source_reference, source_geometry_srid, metadata, provenance
    )
    VALUES (
      g4326,
      nullif(props->>'form_of_road_node',''),
      p_source, v_ref, p_source_srid,
      coalesce(props->'metadata','{}'::jsonb),
      p_provenance
    )
    ON CONFLICT (source, source_reference) WHERE source_reference IS NOT NULL
    DO UPDATE SET
      geom = EXCLUDED.geom,
      form_of_road_node = EXCLUDED.form_of_road_node,
      source_geometry_srid = EXCLUDED.source_geometry_srid,
      metadata = EXCLUDED.metadata,
      provenance = EXCLUDED.provenance,
      updated_at = now();

    v_cnt := v_cnt + 1;
  END LOOP;
  RETURN v_cnt;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.import_road_links(jsonb, text, jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_road_links(jsonb, text, jsonb, integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.import_road_nodes(jsonb, text, jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_road_nodes(jsonb, text, jsonb, integer) TO service_role;

COMMENT ON FUNCTION public.import_road_links(jsonb, text, jsonb, integer) IS 'Bulk upsert of road centrelines from GeoJSON line features (WGS84); computes metric length. service_role only.';
COMMENT ON FUNCTION public.import_road_nodes(jsonb, text, jsonb, integer) IS 'Bulk upsert of road nodes from GeoJSON point features (WGS84). service_role only.';
