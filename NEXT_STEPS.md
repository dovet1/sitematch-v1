# Next Steps - Store Shape Database Insertion

## Current Status ✅

All conversion and optimization is complete:
- ✅ DXF converted to GeoJSON with proper scale
- ✅ GeoJSON optimized (1.33 KB minified)
- ✅ Metadata files created
- ✅ Database migration ran successfully
- ✅ All TypeScript code updated to use metadata

## Ready to Insert into Database

### Files Ready
1. `store-dwg-files/lidl_site.optimized.geojson` (1.33 KB)
2. `store-dwg-files/lidl_site.optimized.metadata.json` (metadata with scale_factor)

### Insert Command

Run this command to insert the Lidl site plan with metadata:

```bash
python3 scripts/insert-store-shape-with-metadata.py \
  store-dwg-files/lidl_site.optimized.geojson \
  --name "Lidl Site Plan - Full Layout" \
  --company "Lidl" \
  --description "Complete site plan (149m × 75m) including building, parking lot, and landscaping. Auto-scaled from DXF with metadata." \
  --metadata store-dwg-files/lidl_site.optimized.metadata.json
```

### What Will Happen

The script will:
1. Read the optimized GeoJSON (7 features, 1.33 KB)
2. Read the metadata (includes `scale_factor: 3.6e-09`)
3. Insert into `store_shapes` table with metadata
4. Display confirmation with the new record ID

### Verify After Insert

1. **Check in Supabase Dashboard:**
   - Go to Table Editor → `store_shapes`
   - Look for "Lidl Site Plan - Full Layout"
   - Verify `metadata` column has JSON with `scale_factor`

2. **Test on Map:**
   ```bash
   npm run dev
   ```
   - Navigate to SiteSketcher
   - Open "Store Shapes" section
   - Click on "Lidl Site Plan"
   - Click on map to place it
   - **Expected:** Shape appears at ~60m × 30m (scaled from 149m full site to 60m target)

### Expected Scale

The building will appear at **60m wide** (as specified in `--target-width 60`), even though the original DXF is 149m wide. This is because:

- Original DXF: 149.26m × 75.29m (full site plan)
- Target width: 60m (specified during conversion)
- Scale factor: 3.6e-09 (calculated automatically)
- Result on map: ~60m × 30m

If you want the **full site** at original scale (149m), reconvert with:
```bash
python3 scripts/convert-dwg-to-geojson.py \
  store-dwg-files/lidl_site.dxf \
  --target-width 150
```

## Metadata in Database

The `metadata` column will contain:

```json
{
  "source_filename": "lidl_site.dxf",
  "source_units": "Millimeters",
  "scale_factor": 3.6111536144560183e-09,
  "conversion_method": "metadata",
  "target_width_meters": 60.0,
  "bbox": {
    "width_meters": 149.26,
    "height_meters": 75.29
  },
  "optimized_feature_count": 7
}
```

This metadata is **automatically used** by the frontend when placing shapes - no more hardcoded scale factors!

## Troubleshooting

### Error: "metadata column doesn't exist"
**Solution:** Re-run the migration
```bash
# Check if supabase CLI is available
supabase db reset

# OR use Supabase dashboard SQL editor:
# Paste contents of: supabase/migrations/038_add_store_shapes_metadata.sql
```

### Shape appears wrong size on map
**Causes:**
1. Frontend cache - do a hard refresh (Cmd+Shift+R)
2. Old shape in database without metadata - delete and re-insert
3. Scale factor seems wrong - check conversion with different `--target-width`

### Script fails with "module not found"
**Solution:**
```bash
pip3 install requests
```

## For Future Store Shapes

Use the same pipeline for any DWG/DXF files:

```bash
# 1. Convert DWG to DXF (ODA File Converter)
# 2. Convert DXF to GeoJSON
python3 scripts/convert-dwg-to-geojson.py your-store.dxf --target-width <meters>

# 3. Optimize
node scripts/optimize-store-shape.js \
  store-dwg-files/your-store.raw.geojson \
  store-dwg-files/your-store.optimized.geojson

# 4. Insert with metadata
python3 scripts/insert-store-shape-with-metadata.py \
  store-dwg-files/your-store.optimized.geojson \
  --name "Store Name" \
  --company "Company" \
  --metadata store-dwg-files/your-store.optimized.metadata.json
```

All done! 🎉
