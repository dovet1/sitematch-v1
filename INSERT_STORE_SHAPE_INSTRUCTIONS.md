# Store Shape Database Insertion Instructions

## Summary

Successfully optimized the GeoJSON file from **8.06 MB → 3.86 MB** (53% reduction) with 70.9% coordinate reduction (222,018 → 64,214 coordinates).

The optimized file preserves all 69 architectural features (internal walls, lines, room layouts) and is ready for database insertion.

## Files Generated

1. **optimized-store-shape.geojson** (3.8 MB, minified) - For database insertion
2. **optimized-store-shape.pretty.geojson** (9.8 MB, formatted) - For viewing/debugging
3. **insert-store-shape.sql** (3.8 MB) - Complete SQL INSERT statement

## Next Steps

### Option 1: Direct SQL Insertion (Recommended)

1. Open **Supabase SQL Editor**
2. Copy the contents of `insert-store-shape.sql`
3. Paste into SQL Editor
4. Click **Run**

### Option 2: Manual Insertion

If the SQL file is too large for the web editor:

1. Install Supabase CLI: `brew install supabase/tap/supabase`
2. Link to your project: `supabase link`
3. Run the SQL file: `supabase db execute -f insert-store-shape.sql`

### Option 3: Use psql

If you have direct database access:

```bash
psql <your-connection-string> -f insert-store-shape.sql
```

## Verify the Insertion

After inserting, verify the shape was added:

```sql
SELECT
  id,
  name,
  company_name,
  is_active,
  jsonb_array_length(geojson->'features') as feature_count,
  pg_size_pretty(pg_column_size(geojson)) as geojson_size
FROM store_shapes
WHERE name = 'LD(15)-PL-06 - Proposed Building Plan';
```

Expected output:
- **Feature count**: 69
- **GeoJSON size**: ~3.8 MB

## Test in UI

Once inserted, the shape should appear in the SiteSketcher "Store Shapes" section:

1. Navigate to SiteSketcher (`/sitesketcher`)
2. Look for "Store Shapes" section in the controls
3. Click "LD(15)-PL-06 - Proposed Building Plan"
4. Click anywhere on the map to place the shape
5. Verify all internal walls and architectural details render correctly

## Troubleshooting

### "Payload too large" error in SQL Editor

The web-based SQL editor might reject files >4MB. Use Supabase CLI or psql instead.

### Shape doesn't appear in UI

Check that:
- `is_active = true` in the database
- The API route is working: `curl http://localhost:3000/api/sitesketcher/store-shapes`
- Browser console for any errors

### Internal walls don't render

Check the browser console for Mapbox errors. The map rendering code expects:
- Valid GeoJSON FeatureCollection
- Coordinates normalized to [0, 0] center (already done by optimization script)
- Mixed geometry types (LineString, Polygon, GeometryCollection)

## Optimization Details

- **Original file**: 8.06 MB, 222,018 coordinates
- **Optimized file**: 3.86 MB, 64,214 coordinates
- **Tolerance used**: 0.01 (balanced detail vs. size)
- **Features preserved**: All 69 architectural features
- **Coordinate precision**: 6 decimal places (~11cm accuracy)
- **Normalization**: Centered at [0, 0]

## Next Development Steps

After database insertion works:

1. ✅ Database migration (already done)
2. ✅ Type definitions (already updated)
3. ✅ Service layer (already created)
4. ✅ State management (already updated)
5. ✅ Map rendering (already implemented)
6. ✅ Optimization script (already created and tested)
7. 🔄 **Database insertion** (current step - ready for you to execute)
8. ⏸️ Export utilities update (optional enhancement)

## Contact

For questions about adding more store shapes:
**rob@sitematcher.co.uk**
