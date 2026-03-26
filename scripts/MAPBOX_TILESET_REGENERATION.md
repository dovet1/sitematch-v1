# Mapbox Tileset Regeneration Guide

## Overview

After updating the database schema to use `pop_final` instead of `pop`, you need to regenerate the Mapbox tileset to include the new fields.

## Prerequisites

- Mapbox account with access to tilesets
- Mapbox CLI (`@mapbox/mapbox-sdk-cli`) installed
- PostgreSQL access to export data
- `tippecanoe` for generating vector tiles (optional, if not using Mapbox Tiling Service)

## Step 1: Export BUA Data with New Fields

Run this SQL query in your Supabase SQL Editor to export BUA data:

```sql
COPY (
  SELECT
    gsscode,
    name,
    pop,                    -- Keep for backwards compatibility
    pop_final,              -- NEW: Use this for filtering/display
    pop_official,           -- NEW: Official data source
    pop_band,
    centroid_lat,
    centroid_lon,
    ST_AsGeoJSON(geometry)::jsonb as geometry
  FROM built_up_areas
  ORDER BY COALESCE(pop_final, pop) DESC
) TO '/tmp/bua_export.csv' WITH CSV HEADER;
```

Alternatively, export as GeoJSON:

```sql
COPY (
  SELECT jsonb_build_object(
    'type', 'Feature',
    'properties', jsonb_build_object(
      'gsscode', gsscode,
      'name', name,
      'pop', pop,
      'pop_final', pop_final,
      'pop_official', pop_official,
      'pop_band', pop_band
    ),
    'geometry', ST_AsGeoJSON(geometry)::jsonb
  )
  FROM built_up_areas
  ORDER BY COALESCE(pop_final, pop) DESC
) TO '/tmp/bua_export.geojson';
```

## Step 2: Convert to GeoJSON FeatureCollection

If you exported as CSV, convert to GeoJSON:

```bash
# Using ogr2ogr (GDAL)
ogr2ogr -f GeoJSON \
  -oo X_POSSIBLE_NAMES=centroid_lon \
  -oo Y_POSSIBLE_NAMES=centroid_lat \
  bua_features.geojson \
  /tmp/bua_export.csv
```

If you exported as GeoJSON lines, wrap in FeatureCollection:

```bash
echo '{"type":"FeatureCollection","features":[' > bua_tileset.geojson
cat /tmp/bua_export.geojson | sed 's/$/,/' | sed '$ s/,$//' >> bua_tileset.geojson
echo ']}' >> bua_tileset.geojson
```

## Step 3: Upload to Mapbox

### Option A: Using Mapbox Studio UI

1. Go to https://studio.mapbox.com/tilesets/
2. Click "New tileset"
3. Upload `bua_tileset.geojson`
4. Set tileset name and ID (e.g., `dovet.bua-tileset-v2`)
5. Wait for processing to complete
6. Update tileset ID in your code:
   ```typescript
   // In apps/web/src/components/buas/BUAMap.tsx
   const BUA_TILESET_ID = 'dovet.bua-tileset-v2' // Update this
   ```

### Option B: Using Mapbox CLI

```bash
# Install Mapbox CLI
npm install -g @mapbox/mapbox-sdk-cli

# Set your Mapbox token
export MAPBOX_ACCESS_TOKEN=your_token_here

# Upload tileset
mapbox upload dovet.bua-tileset-v2 bua_tileset.geojson
```

## Step 4: Update Application Code

The code has already been updated to use `pop_final` with fallback to `pop`:

1. **Map filtering** ([BUAMap.tsx:232-233](../apps/web/src/components/buas/BUAMap.tsx#L232-L233)):
   ```typescript
   ['>=', ['coalesce', ['get', 'pop_final'], ['get', 'pop']], minPopulation],
   ['<=', ['coalesce', ['get', 'pop_final'], ['get', 'pop']], maxPopulation]
   ```

2. **Map styling** ([BUAMap.tsx:125](../apps/web/src/components/buas/BUAMap.tsx#L125)):
   ```typescript
   ['coalesce', ['get', 'pop_final'], ['get', 'pop']]
   ```

3. **Popup display** ([BUAMap.tsx:175](../apps/web/src/components/buas/BUAMap.tsx#L175)):
   ```typescript
   formatPopulation(pop_final)  // Shows "<5k" for small BUAs
   ```

## Step 5: Deploy Database Changes

Run these SQL scripts in Supabase SQL Editor:

1. **Create index on pop_final**:
   ```bash
   # Run: scripts/add-pop-final-index.sql
   ```

2. **Update RPC function**:
   ```bash
   # Run: scripts/drop-and-recreate-bua-function.sql
   ```

## Verification

After regeneration, verify:

1. **Tileset includes new fields**:
   - Open Mapbox Studio
   - Inspect tileset
   - Confirm `pop_final` and `pop_official` are present

2. **Map filtering works**:
   - Load the Gap Analysis page
   - Adjust population slider
   - Verify BUAs filter correctly

3. **Display shows "<5k"**:
   - Click on a small BUA (population < 5000)
   - Verify popup shows "<5k" instead of exact number

## Rollback Plan

If issues occur:

1. Revert tileset ID to previous version:
   ```typescript
   const BUA_TILESET_ID = 'dovet.drwqyy89' // Old tileset
   ```

2. The code uses `coalesce` so it will fall back to `pop` if `pop_final` is missing

## Notes

- The old tileset ID is `dovet.drwqyy89`
- Keep the old tileset available as fallback
- Update tileset ID in code only after confirming new tileset works
- BUAs with `pop_final < 5000` will display as "<5k"
- All filtering and sorting now uses `pop_final` (with fallback to `pop`)
