-- Migration: BUA catchment geography helpers
-- Description:
--   get_lsoas_for_bua          - every LSOA whose geometry intersects a BUA polygon
--   get_bua_boundary_geojson   - BUA polygon as GeoJSON for the catchment outline

CREATE OR REPLACE FUNCTION public.get_lsoas_for_bua(
  bua_gsscode text
)
RETURNS TABLE (
  lsoa_code text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT lb.lsoa_code
  FROM public.built_up_area_geometries bg
  JOIN public.lsoa_boundaries lb
    ON ST_Intersects(bg.geom, lb.geometry)
  WHERE bg.gsscode = bua_gsscode
  ORDER BY lb.lsoa_code;
$$;

COMMENT ON FUNCTION public.get_lsoas_for_bua(text) IS
  'Returns every LSOA whose geometry intersects a built-up area polygon. No minimum overlap threshold is applied.';

CREATE OR REPLACE FUNCTION public.get_bua_boundary_geojson(
  bua_gsscode text
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT ST_AsGeoJSON(bg.geom)::jsonb
  FROM public.built_up_area_geometries bg
  WHERE bg.gsscode = bua_gsscode
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_bua_boundary_geojson(text) IS
  'Returns a built-up area polygon geometry as GeoJSON for catchment boundary rendering.';

GRANT EXECUTE ON FUNCTION public.get_lsoas_for_bua(text) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.get_bua_boundary_geojson(text) TO authenticated, anon, service_role;
