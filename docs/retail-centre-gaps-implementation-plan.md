# Find Gaps — GeoDS retail centres

## Implemented scope

Find Gaps supports two mutually exclusive geographies behind the
`retail_centre_gaps_enabled` feature flag:

- **Towns** keep the existing BUA database, population filters, population rank,
  map layers and API behavior.
- **Retail centres** use GeoDS boundaries, store-presence/proximity summaries,
  form/classification filters and retail-unit rank.

Retail centres intentionally have **no Census/Catchment tab or census data** in
this version. Their selected-area inspector contains Missing Brands, Present
Brands and Planning. Present stores and Planning both use the exact GeoDS polygon.

## Confirmed GeoDS v4 contract

The compact export has 9,623 WGS84 features and these fields:

`RC_ID`, `RC_Name`, `Classification`, `Country`, `Region_NM`, `H3_count`,
`Retail_N`, `Area_km2`, `geometry`.

Classifications are grouped into three user-facing forms:

- High street: Regional Centre, Major Town Centre, Town Centre, Market Town,
  District Centre, Local Centre, Small Local Centre.
- Retail park: Large Retail Park, Small Retail Park.
- Shopping centre: Large Shopping Centre, Small Shopping Centre.

The default retail-centre sort is `Retail_N` descending. Population is never sent
to or applied by the retail-centre query.

## Deployment sequence

1. Apply `20260904000000_create_retail_centre_gaps.sql`.
2. Convert the downloaded GeoDS GeoPackage/GeoParquet to GeoJSON and run
   `npm run import:retail-centres`. The importer validates required fields,
   classifications, duplicate IDs and geometry before rebuilding summaries.
3. Run `npm run build:retail-centre-tiles` and upload the resulting MBTiles as one
   Mapbox tileset containing `retail_centres` and `retail_centres_points` layers.
4. Set `NEXT_PUBLIC_MAPBOX_RETAIL_CENTRES_TILESET_ID`. The source-layer names can
   be overridden with `NEXT_PUBLIC_MAPBOX_RETAIL_CENTRES_POLYGON_LAYER` and
   `NEXT_PUBLIC_MAPBOX_RETAIL_CENTRES_POINT_LAYER`.
5. Validate counts, a selection from each form, exact polygon stores, Planning,
   CSV export and town-mode regressions in staging.
6. Enable `retail_centre_gaps_enabled` only after both the database import and
   tileset are live. The API and UI both fail closed while it is off.

## Deferred

- Retail-centre census/demographic data and a Census/Catchment tab.
- Scheduled GeoDS refresh automation; the importer is safe to rerun when a new
  source vintage is approved.
- Cursor pagination in the inspector. The API and export cover all current GeoDS
  rows, while the interactive result list is capped at 1,000 like town mode.
