-- GeoDS retail centres for Find Gaps.
--
-- This deliberately mirrors the existing BUA path instead of changing it. GeoDS v4
-- does not include census data, so retail centres support store presence/proximity,
-- planning boundaries, classification filters and retail-unit ranking only.

CREATE TABLE public.retail_centre_classifications (
  label text PRIMARY KEY,
  form text NOT NULL CHECK (form IN ('high_street', 'retail_park', 'shopping_centre')),
  form_label text NOT NULL,
  display_order smallint NOT NULL UNIQUE
);

INSERT INTO public.retail_centre_classifications (label, form, form_label, display_order)
VALUES
  ('Regional Centre',       'high_street',     'High street',      10),
  ('Major Town Centre',     'high_street',     'High street',      20),
  ('Town Centre',           'high_street',     'High street',      30),
  ('Market Town',           'high_street',     'High street',      40),
  ('District Centre',       'high_street',     'High street',      50),
  ('Local Centre',          'high_street',     'High street',      60),
  ('Small Local Centre',    'high_street',     'High street',      70),
  ('Large Retail Park',     'retail_park',     'Retail park',      80),
  ('Small Retail Park',     'retail_park',     'Retail park',      90),
  ('Large Shopping Centre', 'shopping_centre', 'Shopping centre', 100),
  ('Small Shopping Centre', 'shopping_centre', 'Shopping centre', 110);

CREATE TABLE public.retail_centres (
  rc_id text PRIMARY KEY,
  name text NOT NULL,
  classification text NOT NULL REFERENCES public.retail_centre_classifications(label),
  country text,
  region_name text,
  h3_count integer,
  retail_count integer,
  area_km2 double precision,
  centroid geography(Point, 4326) NOT NULL,
  centroid_lat double precision NOT NULL,
  centroid_lon double precision NOT NULL,
  source_version text NOT NULL DEFAULT '4.0',
  source_vintage text,
  source_properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (retail_count IS NULL OR retail_count >= 0),
  CHECK (area_km2 IS NULL OR area_km2 >= 0)
);

CREATE INDEX retail_centres_centroid_gix ON public.retail_centres USING gist (centroid);
CREATE INDEX retail_centres_classification_idx ON public.retail_centres (classification);
CREATE INDEX retail_centres_retail_count_idx ON public.retail_centres (retail_count DESC NULLS LAST);

CREATE TABLE public.retail_centre_geometries (
  rc_id text PRIMARY KEY REFERENCES public.retail_centres(rc_id) ON DELETE CASCADE,
  geom geometry(MultiPolygon, 4326) NOT NULL
);

CREATE INDEX retail_centre_geometries_geom_gix
  ON public.retail_centre_geometries USING gist (geom);

-- The summary rows are target-shaped. This keeps stores whose fascia has no
-- category mapping queryable by fascia while also supporting category rules.
CREATE TABLE public.retail_centre_store_presence (
  rc_id text NOT NULL REFERENCES public.retail_centres(rc_id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('fascia', 'category')),
  target_id uuid NOT NULL,
  store_count integer NOT NULL CHECK (store_count > 0),
  PRIMARY KEY (rc_id, target_type, target_id)
);

CREATE INDEX retail_centre_presence_target_idx
  ON public.retail_centre_store_presence (target_type, target_id, rc_id);

CREATE TABLE public.retail_centre_store_nearby (
  rc_id text NOT NULL REFERENCES public.retail_centres(rc_id) ON DELETE CASCADE,
  distance_m integer NOT NULL CHECK (distance_m IN (1000, 3000, 5000, 10000)),
  target_type text NOT NULL CHECK (target_type IN ('fascia', 'category')),
  target_id uuid NOT NULL,
  store_count integer NOT NULL CHECK (store_count > 0),
  PRIMARY KEY (rc_id, distance_m, target_type, target_id)
);

CREATE INDEX retail_centre_nearby_target_idx
  ON public.retail_centre_store_nearby (distance_m, target_type, target_id, rc_id);

ALTER TABLE public.retail_centre_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_centres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_centre_geometries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_centre_store_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retail_centre_store_nearby ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Retail centre classifications are readable" ON public.retail_centre_classifications
  FOR SELECT USING (true);
CREATE POLICY "Retail centres are readable" ON public.retail_centres
  FOR SELECT USING (true);

-- Import a page of GeoDS GeoJSON features. The published v4 files are EPSG:4326;
-- ST_Force2D/ST_Multi normalise Polygon and MultiPolygon inputs defensively.
CREATE OR REPLACE FUNCTION public.import_retail_centres(
  p_features jsonb,
  p_source_version text DEFAULT '4.0',
  p_source_vintage text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_feature jsonb;
  v_properties jsonb;
  v_geom geometry;
  v_rc_id text;
  v_count integer := 0;
BEGIN
  IF jsonb_typeof(p_features) <> 'array' THEN
    RAISE EXCEPTION 'p_features must be a JSON array of GeoJSON Features';
  END IF;

  FOR v_feature IN SELECT value FROM jsonb_array_elements(p_features)
  LOOP
    v_properties := COALESCE(v_feature->'properties', '{}'::jsonb);
    v_rc_id := NULLIF(trim(v_properties->>'RC_ID'), '');
    IF v_rc_id IS NULL THEN
      RAISE EXCEPTION 'GeoDS feature is missing RC_ID';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.retail_centre_classifications
      WHERE label = v_properties->>'Classification'
    ) THEN
      RAISE EXCEPTION 'Unknown GeoDS classification for %: %',
        v_rc_id, v_properties->>'Classification';
    END IF;

    v_geom := ST_Multi(ST_Force2D(ST_SetSRID(ST_GeomFromGeoJSON(v_feature->'geometry'), 4326)));
    IF GeometryType(v_geom) <> 'MULTIPOLYGON' OR NOT ST_IsValid(v_geom) THEN
      RAISE EXCEPTION 'Invalid polygon geometry for %', v_rc_id;
    END IF;

    INSERT INTO public.retail_centres (
      rc_id, name, classification, country, region_name, h3_count,
      retail_count, area_km2, centroid, centroid_lat, centroid_lon,
      source_version, source_vintage, source_properties, updated_at
    )
    VALUES (
      v_rc_id,
      COALESCE(NULLIF(trim(v_properties->>'RC_Name'), ''), v_rc_id),
      v_properties->>'Classification',
      NULLIF(trim(v_properties->>'Country'), ''),
      NULLIF(trim(v_properties->>'Region_NM'), ''),
      NULLIF(v_properties->>'H3_count', '')::integer,
      NULLIF(v_properties->>'Retail_N', '')::integer,
      NULLIF(v_properties->>'Area_km2', '')::double precision,
      ST_PointOnSurface(v_geom)::geography,
      ST_Y(ST_PointOnSurface(v_geom)),
      ST_X(ST_PointOnSurface(v_geom)),
      p_source_version,
      p_source_vintage,
      v_properties,
      now()
    )
    ON CONFLICT (rc_id) DO UPDATE SET
      name = EXCLUDED.name,
      classification = EXCLUDED.classification,
      country = EXCLUDED.country,
      region_name = EXCLUDED.region_name,
      h3_count = EXCLUDED.h3_count,
      retail_count = EXCLUDED.retail_count,
      area_km2 = EXCLUDED.area_km2,
      centroid = EXCLUDED.centroid,
      centroid_lat = EXCLUDED.centroid_lat,
      centroid_lon = EXCLUDED.centroid_lon,
      source_version = EXCLUDED.source_version,
      source_vintage = EXCLUDED.source_vintage,
      source_properties = EXCLUDED.source_properties,
      updated_at = now();

    INSERT INTO public.retail_centre_geometries (rc_id, geom)
    VALUES (v_rc_id, v_geom)
    ON CONFLICT (rc_id) DO UPDATE SET geom = EXCLUDED.geom;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Evaluate one store rule for one retail centre. Negative rules intentionally
-- mean "none of these targets", matching the corrected BUA behavior.
CREATE OR REPLACE FUNCTION public.retail_centre_matches_rule(
  p_rc_id text,
  p_rule jsonb
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_operator text := p_rule->>'operator';
  v_target_type text := p_rule->>'targetType';
  v_logic text := COALESCE(p_rule->>'matchingLogic', 'any');
  v_distance integer := NULLIF(p_rule->>'distance', '')::integer;
  v_ids uuid[];
  v_matched integer;
BEGIN
  IF v_operator IS NULL OR v_operator NOT IN ('has', 'has_not', 'has_within', 'has_not_within') THEN
    RAISE EXCEPTION 'Invalid retail-centre operator: %', v_operator;
  END IF;
  IF v_target_type IS NULL OR v_target_type NOT IN ('fascia', 'category') THEN
    RAISE EXCEPTION 'Invalid retail-centre target type: %', v_target_type;
  END IF;
  IF v_operator LIKE '%within' AND v_distance NOT IN (1000, 3000, 5000, 10000) THEN
    RAISE EXCEPTION 'Invalid retail-centre distance: %', v_distance;
  END IF;

  SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[])
  INTO v_ids
  FROM jsonb_array_elements_text(COALESCE(p_rule->'targetIds', '[]'::jsonb));

  IF v_target_type = 'category' AND cardinality(v_ids) > 0 THEN
    v_ids := public.get_category_descendants(v_ids);
  END IF;

  IF cardinality(v_ids) = 0 THEN
    RETURN true;
  END IF;

  IF v_operator IN ('has', 'has_not') THEN
    SELECT count(DISTINCT target_id) INTO v_matched
    FROM public.retail_centre_store_presence
    WHERE rc_id = p_rc_id
      AND target_type = v_target_type
      AND target_id = ANY(v_ids);
  ELSE
    SELECT count(DISTINCT target_id) INTO v_matched
    FROM public.retail_centre_store_nearby
    WHERE rc_id = p_rc_id
      AND distance_m = v_distance
      AND target_type = v_target_type
      AND target_id = ANY(v_ids);
  END IF;

  IF v_operator IN ('has_not', 'has_not_within') THEN
    RETURN v_matched = 0;
  END IF;
  RETURN CASE WHEN v_logic = 'all' THEN v_matched = cardinality(v_ids) ELSE v_matched > 0 END;
END;
$$;

CREATE OR REPLACE FUNCTION public.retail_centre_matches_expression(
  p_rc_id text,
  p_filter_expression jsonb
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_rules jsonb := COALESCE(p_filter_expression->'rules', '[]'::jsonb);
  v_rule jsonb;
  v_result boolean := true;
  v_first boolean := true;
  v_previous_connector text := 'and';
BEGIN
  FOR v_rule IN SELECT value FROM jsonb_array_elements(v_rules)
  LOOP
    IF v_first THEN
      v_result := public.retail_centre_matches_rule(p_rc_id, v_rule);
      v_first := false;
    ELSIF v_previous_connector = 'or' THEN
      v_result := v_result OR public.retail_centre_matches_rule(p_rc_id, v_rule);
    ELSE
      v_result := v_result AND public.retail_centre_matches_rule(p_rc_id, v_rule);
    END IF;
    v_previous_connector := COALESCE(v_rule->>'connector', 'and');
    IF v_previous_connector NOT IN ('and', 'or') THEN
      RAISE EXCEPTION 'Invalid retail-centre connector: %', v_previous_connector;
    END IF;
  END LOOP;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.prune_retail_centres(p_current_ids text[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  IF p_current_ids IS NULL OR cardinality(p_current_ids) = 0 THEN
    RAISE EXCEPTION 'Refusing to prune retail centres without source IDs';
  END IF;
  DELETE FROM public.retail_centres WHERE NOT (rc_id = ANY(p_current_ids));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

CREATE OR REPLACE FUNCTION public.filter_retail_centres_with_expression(
  p_filter_expression jsonb,
  p_forms text[] DEFAULT NULL,
  p_classifications text[] DEFAULT NULL
)
RETURNS TABLE (
  rc_id text,
  name text,
  classification text,
  form text,
  form_label text,
  country text,
  region_name text,
  retail_count integer,
  area_km2 double precision,
  centroid_lat double precision,
  centroid_lon double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    rc.rc_id, rc.name, rc.classification, c.form, c.form_label,
    rc.country, rc.region_name, rc.retail_count, rc.area_km2,
    rc.centroid_lat, rc.centroid_lon
  FROM public.retail_centres rc
  JOIN public.retail_centre_classifications c ON c.label = rc.classification
  WHERE (p_forms IS NULL OR c.form = ANY(p_forms))
    AND (p_classifications IS NULL OR rc.classification = ANY(p_classifications))
    AND public.retail_centre_matches_expression(rc.rc_id, p_filter_expression)
  ORDER BY rc.retail_count DESC NULLS LAST, rc.name, rc.rc_id;
$$;

CREATE OR REPLACE FUNCTION public.get_stores_in_retail_centre(p_rc_id text)
RETURNS TABLE (
  id uuid, store_id text, brand_id uuid, fascia_id uuid, name text,
  lon double precision, lat double precision, location geography,
  postcode text, town text, suburb text, county text,
  address_line_1 text, address_line_2 text, created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.store_id, s.brand_id, s.fascia_id, s.name, s.lon, s.lat,
    s.location, s.postcode, s.town, s.suburb, s.county,
    s.address_line_1, s.address_line_2, s.created_at
  FROM public.stores s
  JOIN public.retail_centre_geometries g
    ON g.rc_id = p_rc_id
   AND ST_Covers(g.geom, s.location::geometry);
$$;

CREATE OR REPLACE FUNCTION public.get_retail_centre_boundary(p_rc_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ST_AsGeoJSON(g.geom)::jsonb
  FROM public.retail_centre_geometries g
  WHERE g.rc_id = p_rc_id;
$$;

-- Build into transaction-local shadow tables, then replace live summaries only
-- after both spatial passes succeed. A transaction advisory lock cannot expire.
CREATE OR REPLACE FUNCTION public.rebuild_retail_centre_summaries()
RETURNS TABLE(progress text)
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = 0
SET search_path = public, pg_temp
AS $$
DECLARE
  v_distance integer;
  v_rows bigint;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('retail_centre_summary_rebuild')) THEN
    RETURN QUERY SELECT 'Retail-centre summary rebuild already running'::text;
    RETURN;
  END IF;

  CREATE TEMP TABLE next_retail_presence
    (LIKE public.retail_centre_store_presence INCLUDING DEFAULTS) ON COMMIT DROP;
  CREATE TEMP TABLE next_retail_nearby
    (LIKE public.retail_centre_store_nearby INCLUDING DEFAULTS) ON COMMIT DROP;

  INSERT INTO next_retail_presence (rc_id, target_type, target_id, store_count)
  SELECT g.rc_id, 'fascia', s.fascia_id, count(*)::integer
  FROM public.retail_centre_geometries g
  JOIN public.stores s ON ST_Covers(g.geom, s.location::geometry)
  WHERE s.fascia_id IS NOT NULL
  GROUP BY g.rc_id, s.fascia_id;

  INSERT INTO next_retail_presence (rc_id, target_type, target_id, store_count)
  SELECT g.rc_id, 'category', fc.category_id, count(*)::integer
  FROM public.retail_centre_geometries g
  JOIN public.stores s ON ST_Covers(g.geom, s.location::geometry)
  JOIN public.fascia_categories fc ON fc.fascia_id = s.fascia_id
  GROUP BY g.rc_id, fc.category_id;

  FOREACH v_distance IN ARRAY ARRAY[1000, 3000, 5000, 10000]
  LOOP
    INSERT INTO next_retail_nearby (rc_id, distance_m, target_type, target_id, store_count)
    SELECT rc.rc_id, v_distance, 'fascia', s.fascia_id, count(*)::integer
    FROM public.retail_centres rc
    JOIN public.stores s ON ST_DWithin(rc.centroid, s.location, v_distance)
    WHERE s.fascia_id IS NOT NULL
    GROUP BY rc.rc_id, s.fascia_id;

    INSERT INTO next_retail_nearby (rc_id, distance_m, target_type, target_id, store_count)
    SELECT rc.rc_id, v_distance, 'category', fc.category_id, count(*)::integer
    FROM public.retail_centres rc
    JOIN public.stores s ON ST_DWithin(rc.centroid, s.location, v_distance)
    JOIN public.fascia_categories fc ON fc.fascia_id = s.fascia_id
    GROUP BY rc.rc_id, fc.category_id;
  END LOOP;

  TRUNCATE public.retail_centre_store_presence, public.retail_centre_store_nearby;
  INSERT INTO public.retail_centre_store_presence SELECT * FROM next_retail_presence;
  INSERT INTO public.retail_centre_store_nearby SELECT * FROM next_retail_nearby;

  SELECT count(*) INTO v_rows FROM public.retail_centre_store_presence;
  RETURN QUERY SELECT format('Retail-centre summaries rebuilt: %s presence rows', v_rows);
END;
$$;

GRANT SELECT ON public.retail_centre_classifications, public.retail_centres
  TO authenticated, anon, service_role;
REVOKE ALL ON FUNCTION public.import_retail_centres(jsonb, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prune_retail_centres(text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rebuild_retail_centre_summaries() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_retail_centres(jsonb, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.prune_retail_centres(text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.filter_retail_centres_with_expression(jsonb, text[], text[])
  TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_stores_in_retail_centre(text)
  TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_retail_centre_boundary(text)
  TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rebuild_retail_centre_summaries() TO service_role;

INSERT INTO public.feature_flags (key, enabled, description)
VALUES (
  'retail_centre_gaps_enabled',
  false,
  'Enables GeoDS retail-centre geography in Find Gaps after data and map layers are deployed.'
)
ON CONFLICT (key) DO NOTHING;
