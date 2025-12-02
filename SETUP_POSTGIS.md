# PostGIS Setup for LSOA Boundaries

This guide explains how to set up PostGIS in Supabase for storing and querying LSOA boundary data.

## Prerequisites

- Supabase project with database access
- LSOA GeoJSON file at `apps/web/data/census2021/Lower_layer_Super_Output_Areas_December_2021_Boundaries_EW_WGS84.geojson`
- Environment variables set:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

## Step 1: Run Database Migrations

Run the following migrations in order in your Supabase SQL Editor (or via command line):

```bash
# 1. Enable PostGIS extension
cat supabase/migrations/20251120_enable_postgis.sql | supabase db execute

# 2. Create LSOA boundaries table
cat supabase/migrations/20251120_create_lsoa_boundaries_table.sql | supabase db execute

# 3. Create query functions
cat supabase/migrations/20251120_create_lsoa_query_functions.sql | supabase db execute
```

Or manually copy and paste each SQL file into the Supabase SQL Editor.

## Step 2: Generate Import SQL

Generate the SQL import file from the GeoJSON data:

```bash
npx tsx scripts/generate-lsoa-import-sql.ts > import-lsoa-data.sql
```

This will create a ~400MB SQL file with INSERT statements for all ~35,000 LSOAs.

⚠️ **Warning:** This file is LARGE and will take time to generate (~2-5 minutes).

## Step 3: Import LSOA Data

### Option A: Via Supabase SQL Editor (Recommended)

1. Open Supabase SQL Editor
2. The file is too large to paste directly, so you'll need to split it or use Option B

### Option B: Via Command Line (Faster)

If you have direct database access:

```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres" < import-lsoa-data.sql
```

### Option C: Import in Batches (Most Reliable)

For large imports, it's better to import in smaller batches:

```bash
# Generate SQL in smaller batches
npx tsx scripts/generate-lsoa-import-sql-batched.ts

# This creates multiple files: batch-0001.sql, batch-0002.sql, etc.
# Import each one via SQL Editor or psql
```

## Step 4: Verify Import

Run this query to verify the import:

```sql
-- Check total count
SELECT COUNT(*) FROM public.lsoa_boundaries;
-- Should return ~35,000

-- Test spatial query
SELECT COUNT(*) FROM public.get_lsoas_in_radius(51.5074, -0.1278, 5000);
-- Should return LSOAs within 5km of London

-- Check indexes
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'lsoa_boundaries';
```

## Step 5: Update Application Code

The application code has been updated to use PostGIS instead of file system:

- ✅ `apps/web/src/lib/lsoa-boundaries-postgis.ts` - New PostGIS query functions
- ✅ `apps/web/src/app/api/demographics/boundaries/route.ts` - Updated to use PostGIS

## Performance Notes

- **Radius queries** use `ST_DWithin` with geography type for accurate distance
- **Isochrone queries** use `ST_Intersects` for polygon intersection
- **Spatial indexes** (GIST) are automatically created for fast queries
- Expected query time: **50-200ms** for typical radius/isochrone queries

## Troubleshooting

### PostGIS not installed

```sql
-- Check if PostGIS is installed
SELECT PostGIS_version();
```

If not installed, run:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

### Import fails with "out of memory"

- Import in smaller batches (500-1000 records per batch)
- Increase database resources temporarily
- Use `psql` command line instead of SQL Editor

### Queries are slow

```sql
-- Rebuild spatial index
REINDEX INDEX lsoa_boundaries_geometry_idx;

-- Analyze table for query optimization
ANALYZE public.lsoa_boundaries;
```

## File Sizes

- **GeoJSON file:** ~215MB
- **Generated SQL:** ~400MB
- **Database storage:** ~180MB (compressed)
- **Total LSOAs:** ~35,000

## Next Steps

After successful setup:

1. Test locally with `npm run dev`
2. Deploy to production
3. The app will now query Supabase instead of loading local files
4. Production deployments will work correctly

## Alternative: Simplified Geometries

If database size is a concern, you can simplify the geometries:

```sql
-- Simplify geometries (reduces size by ~60%)
UPDATE public.lsoa_boundaries
SET geometry = ST_Simplify(geometry, 0.0001);

-- Rebuild spatial index after simplification
REINDEX INDEX lsoa_boundaries_geometry_idx;
```

This reduces accuracy slightly but significantly improves storage and query performance.
