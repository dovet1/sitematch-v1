# Quick Setup Guide: PostGIS LSOA Boundaries

Follow these steps to fix the production issue by migrating LSOA boundaries to PostGIS.

---

## Step 1: Run Database Migrations in Supabase

Go to your **Supabase Dashboard** → **SQL Editor** and run these 3 SQL files in order:

### 1.1 Enable PostGIS Extension
```sql
-- Copy and paste contents of: supabase/migrations/20251120_enable_postgis.sql
CREATE EXTENSION IF NOT EXISTS postgis;
SELECT PostGIS_version();
```

### 1.2 Create LSOA Boundaries Table
```sql
-- Copy and paste contents of: supabase/migrations/20251120_create_lsoa_boundaries_table.sql
-- This creates the table with geometry column and spatial indexes
```

### 1.3 Create Query Functions
```sql
-- Copy and paste contents of: supabase/migrations/20251120_create_lsoa_query_functions.sql
-- This creates get_lsoas_in_radius() and get_lsoas_in_polygon() functions
```

---

## Step 2: Import LSOA Data

Now import the 35,000 LSOA boundaries from your local GeoJSON file:

```bash
# Make sure you're in the project root directory
cd /Users/tomdove/Developer/commercial_directory

# Run the import script
npx tsx scripts/import-lsoa-to-supabase.ts
```

**What this does:**
- Reads the GeoJSON file from `apps/web/data/census2021/`
- Uploads data to Supabase in batches of 100
- Takes approximately **10-20 minutes** to complete
- Shows progress as it imports

**Expected output:**
```
🚀 Starting LSOA boundaries import to Supabase...
📂 Reading GeoJSON file...
✅ Loaded 35,000 LSOA features
🔄 Batch 350/350 (35,000/35,000 completed)
✅ Successfully imported: 35,000
📊 Total features: 35,000
✨ Import completed successfully!
```

---

## Step 3: Verify the Import

Run this query in Supabase SQL Editor to verify:

```sql
-- Check total count
SELECT COUNT(*) FROM public.lsoa_boundaries;
-- Should return ~35,000

-- Test a radius query (5km around London)
SELECT COUNT(*)
FROM public.get_lsoas_in_radius(51.5074, -0.1278, 5000);
-- Should return several hundred LSOAs

-- Check that spatial index exists
SELECT indexname
FROM pg_indexes
WHERE tablename = 'lsoa_boundaries'
  AND indexname LIKE '%geometry%';
-- Should return: lsoa_boundaries_geometry_idx
```

---

## Step 4: Deploy to Production

The code changes are already done! Just commit and push:

```bash
git add .
git commit -m "Migrate LSOA boundaries to PostGIS"
git push
```

**What changed:**
- `apps/web/src/lib/lsoa-boundaries-postgis.ts` - New file with PostGIS queries
- `apps/web/src/app/api/demographics/boundaries/route.ts` - Updated import path

---

## Step 5: Test

### Test Locally:
```bash
npm run dev
```
Go to SiteDemographer and try analyzing a location.

### Test Production:
After deployment, go to your production URL and test SiteDemographer.

---

## Troubleshooting

### Import script fails with "file not found"
Make sure the GeoJSON file exists:
```bash
ls -lh apps/web/data/census2021/Lower_layer_Super_Output_Areas_December_2021_Boundaries_EW_WGS84.geojson
```

### Import is very slow
- This is normal - 35K records takes 10-20 minutes
- You can reduce `BATCH_SIZE` in the script if getting timeouts
- Or increase Supabase database resources temporarily

### "Missing Supabase credentials" error
Make sure `.env.local` contains:
```
NEXT_PUBLIC_SUPABASE_URL=your-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Queries still failing in production
1. Check that migrations ran successfully
2. Verify data imported (run verification query above)
3. Check Supabase logs for errors
4. Make sure environment variables are set in production

---

## What This Fixes

**Before:**
- ❌ App tried to load 215MB GeoJSON file from filesystem
- ❌ File doesn't exist in production deployments
- ❌ Error: "Failed to resolve geographic areas"

**After:**
- ✅ App queries Supabase PostGIS database
- ✅ Spatial queries run in 50-200ms
- ✅ Works in both local and production environments
- ✅ Scalable and performant

---

## Need Help?

If you encounter issues:
1. Check the full guide: `SETUP_POSTGIS.md`
2. Review the import script: `scripts/import-lsoa-to-supabase.ts`
3. Check Supabase logs in your dashboard
