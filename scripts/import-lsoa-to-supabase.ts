#!/usr/bin/env tsx
/**
 * Import LSOA boundaries from GeoJSON into Supabase PostGIS
 *
 * This script directly inserts LSOA data into Supabase using the client library.
 * It processes the data in batches to avoid memory issues.
 *
 * Usage: npx tsx scripts/import-lsoa-to-supabase.ts
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables from apps/web/.env.local
dotenv.config({ path: path.join(process.cwd(), 'apps/web/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing Supabase credentials');
  console.error('   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface LSOAFeature {
  type: 'Feature';
  properties: {
    LSOA21CD: string;
    LSOA21NM: string;
    LAT: number;
    LONG: number;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: any;
  };
}

interface LSOAGeoJSON {
  type: 'FeatureCollection';
  features: LSOAFeature[];
}

function geometryToGeoJSON(feature: LSOAFeature): any {
  // Convert all geometries to MultiPolygon for consistency
  if (feature.geometry.type === 'Polygon') {
    // Convert Polygon to MultiPolygon
    return {
      type: 'MultiPolygon',
      coordinates: [feature.geometry.coordinates]
    };
  }
  // Already MultiPolygon
  return feature.geometry;
}

async function importBoundaries() {
  console.log('🚀 Starting LSOA boundaries import to Supabase...\n');

  // Load GeoJSON file
  const filePath = path.join(
    process.cwd(),
    'apps/web/data/census2021',
    'Lower_layer_Super_Output_Areas_December_2021_Boundaries_EW_WGS84.geojson'
  );

  if (!fs.existsSync(filePath)) {
    console.error('❌ Error: GeoJSON file not found:', filePath);
    console.error('   Expected at:', filePath);
    process.exit(1);
  }

  console.log('📂 Reading GeoJSON file...');
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const geoJSON: LSOAGeoJSON = JSON.parse(fileContent);
  console.log(`✅ Loaded ${geoJSON.features.length.toLocaleString()} LSOA features\n`);

  // Clear existing data (optional - remove if you want to keep existing data)
  console.log('🗑️  Clearing existing data...');
  const { error: deleteError } = await supabase
    .from('lsoa_boundaries')
    .delete()
    .neq('id', 0); // Delete all rows

  if (deleteError) {
    console.error('⚠️  Warning: Could not clear existing data:', deleteError.message);
  } else {
    console.log('✅ Cleared existing data\n');
  }

  // Process in batches
  const BATCH_SIZE = 100; // Smaller batches to avoid timeouts
  const totalFeatures = geoJSON.features.length;
  let successCount = 0;
  let errorCount = 0;

  console.log(`📊 Importing in batches of ${BATCH_SIZE}...\n`);

  for (let i = 0; i < totalFeatures; i += BATCH_SIZE) {
    const batch = geoJSON.features.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(totalFeatures / BATCH_SIZE);

    process.stdout.write(`\r🔄 Batch ${batchNumber}/${totalBatches} (${successCount.toLocaleString()}/${totalFeatures.toLocaleString()} completed)`);

    // Prepare batch data
    const records = batch.map(feature => ({
      lsoa_code: feature.properties.LSOA21CD,
      lsoa_name: feature.properties.LSOA21NM,
      lat: feature.properties.LAT,
      lng: feature.properties.LONG,
      // Store as GeoJSON - PostGIS will convert it
      geometry: JSON.stringify(geometryToGeoJSON(feature))
    }));

    try {
      // Insert batch
      const { error } = await supabase
        .from('lsoa_boundaries')
        .insert(records);

      if (error) {
        console.error(`\n   ❌ Error in batch ${batchNumber}:`, error.message);
        errorCount += batch.length;
      } else {
        successCount += batch.length;
      }
    } catch (error) {
      console.error(`\n   ❌ Exception in batch ${batchNumber}:`, error);
      errorCount += batch.length;
    }

    // Brief pause to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n\n' + '='.repeat(60));
  console.log('📈 Import Summary:');
  console.log(`   ✅ Successfully imported: ${successCount.toLocaleString()}`);
  console.log(`   ❌ Failed: ${errorCount.toLocaleString()}`);
  console.log(`   📊 Total features: ${totalFeatures.toLocaleString()}`);
  console.log('='.repeat(60));

  // Verify import
  console.log('\n🔍 Verifying import...');
  const { count, error: countError } = await supabase
    .from('lsoa_boundaries')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Could not verify import:', countError.message);
  } else {
    console.log(`✅ Database contains ${count?.toLocaleString()} records`);
  }

  if (errorCount > 0) {
    console.log('\n⚠️  Some records failed to import. You may need to retry those batches.');
    process.exit(1);
  }

  console.log('\n✨ Import completed successfully!');
  console.log('\n📝 Next steps:');
  console.log('   1. Test locally: npm run dev');
  console.log('   2. Try a search in SiteDemographer');
  console.log('   3. Deploy to production when ready');
}

// Run the import
importBoundaries().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
