#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "Usage: npm run build:retail-centre-tiles -- /path/source.gpkg layer_name /path/retail-centres.mbtiles"
  exit 1
fi

source_file="$1"
source_layer="$2"
output_file="$3"
tile_tmp="$(mktemp -d)"
trap 'rm -rf "$tile_tmp"' EXIT

common_fields="CAST(RC_ID AS TEXT) AS rc_id, RC_Name AS name, Classification AS classification, Region_NM AS region_name, Retail_N AS retail_count, CASE WHEN Classification LIKE '%Retail Park' THEN 'retail_park' WHEN Classification LIKE '%Shopping Centre' THEN 'shopping_centre' ELSE 'high_street' END AS form, ST_X(ST_PointOnSurface(geom)) AS centroid_lon, ST_Y(ST_PointOnSurface(geom)) AS centroid_lat"

ogr2ogr -f GeoJSONSeq "$tile_tmp/polygons.geojsonseq" "$source_file" \
  -t_srs EPSG:4326 -dialect SQLite \
  -sql "SELECT $common_fields, geom FROM \"$source_layer\""

ogr2ogr -f GeoJSONSeq "$tile_tmp/points.geojsonseq" "$source_file" \
  -t_srs EPSG:4326 -dialect SQLite \
  -sql "SELECT $common_fields, ST_PointOnSurface(geom) AS geom FROM \"$source_layer\""

tippecanoe --force --output="$tile_tmp/polygons.mbtiles" \
  --minimum-zoom=8 --maximum-zoom=14 --no-feature-limit --no-tile-size-limit \
  -L"retail_centres:$tile_tmp/polygons.geojsonseq"

tippecanoe --force --output="$tile_tmp/points.mbtiles" \
  --minimum-zoom=4 --maximum-zoom=9 --no-feature-limit --no-tile-size-limit \
  -L"retail_centres_points:$tile_tmp/points.geojsonseq"

tile-join --force --no-tile-size-limit --output="$output_file" \
  "$tile_tmp/polygons.mbtiles" "$tile_tmp/points.mbtiles"

echo "Built $output_file with retail_centres and retail_centres_points layers."
