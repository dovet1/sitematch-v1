#!/usr/bin/env tsx
/**
 * Import LSOA boundaries from GeoJSON into Supabase PostGIS
 *
 * This script reads the LSOA boundaries GeoJSON file and imports it into
 * the Supabase database with PostGIS geometry support.
 *
 * Usage: npx tsx scripts/import-lsoa-boundaries.ts
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing Supabase credentials');
  console.error('   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
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

async function importBoundaries() {
  console.log('🚀 Starting LSOA boundaries import...\n');

  // Load GeoJSON file
  const filePath = path.join(
    process.cwd(),
    'apps/web/data/census2021',
    'Lower_layer_Super_Output_Areas_December_2021_Boundaries_EW_WGS84.geojson'
  );

  if (!fs.existsSync(filePath)) {
    console.error('❌ Error: GeoJSON file not found:', filePath);
    process.exit(1);
  }

  console.log('📂 Reading GeoJSON file...');
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const geoJSON: LSOAGeoJSON = JSON.parse(fileContent);
  console.log(`✅ Loaded ${geoJSON.features.length.toLocaleString()} LSOA features\n`);

  // Process in batches to avoid memory/timeout issues
  const BATCH_SIZE = 500;
  const totalFeatures = geoJSON.features.length;
  let processedCount = 0;
  let errorCount = 0;

  console.log(`📊 Processing in batches of ${BATCH_SIZE}...\n`);

  for (let i = 0; i < totalFeatures; i += BATCH_SIZE) {
    const batch = geoJSON.features.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(totalFeatures / BATCH_SIZE);

    console.log(`🔄 Processing batch ${batchNumber}/${totalBatches} (${batch.length} features)...`);

    // Prepare batch data
    const records = batch.map(feature => {
      // Convert geometry to WKT (Well-Known Text) format for PostGIS
      let geometryWKT: string;

      if (feature.geometry.type === 'Polygon') {
        // Convert to MultiPolygon for consistency
        const coords = feature.geometry.coordinates;
        geometryWKT = `MULTIPOLYGON((${coords.map((ring: any) =>
          `(${ring.map((point: any) => `${point[0]} ${point[1]}`).join(', ')})`
        ).join(', ')}))`;
      } else {
        // Already MultiPolygon
        const coords = feature.geometry.coordinates;
        geometryWKT = `MULTIPOLYGON(${coords.map((polygon: any) =>
          `(${polygon.map((ring: any) =>
            `(${ring.map((point: any) => `${point[0]} ${point[1]}`).join(', ')})`
          ).join(', ')})`
        ).join(', ')})`;
      }

      return {
        lsoa_code: feature.properties.LSOA21CD,
        lsoa_name: feature.properties.LSOA21NM,
        lat: feature.properties.LAT,
        lng: feature.properties.LONG,
        geometry: geometryWKT,
      };
    });

    // Insert batch - we'll use individual inserts with upsert for simplicity
    // In production, you might want to use a custom RPC function for better performance
    try {
      for (const record of records) {
        const { error } = await supabase
          .from('lsoa_boundaries')
          .upsert({
            lsoa_code: record.lsoa_code,
            lsoa_name: record.lsoa_name,
            lat: record.lat,
            lng: record.lng,
            geometry: `SRID=4326;${record.geometry}`, // PostGIS Extended WKT format
          }, {
            onConflict: 'lsoa_code',
            ignoreDuplicates: true,
          });

        if (error) {
          console.error(`      ⚠️  Error inserting ${record.lsoa_code}:`, error.message);
          errorCount++;
        } else {
          processedCount++;
        }
      }

      console.log(`   ✅ Batch ${batchNumber} complete (${processedCount.toLocaleString()}/${totalFeatures.toLocaleString()} total)`);
    } catch (error) {
      console.error(`   ❌ Exception in batch ${batchNumber}:`, error);
      errorCount += batch.length;
    }

    // Brief pause between batches to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n' + '='.repeat(60));
  console.log('📈 Import Summary:');
  console.log(`   ✅ Successfully processed: ${processedCount.toLocaleString()}`);
  console.log(`   ❌ Errors: ${errorCount.toLocaleString()}`);
  console.log(`   📊 Total features: ${totalFeatures.toLocaleString()}`);
  console.log('='.repeat(60));

  if (errorCount > 0) {
    console.log('\n⚠️  Some records failed to import. Check the errors above.');
    process.exit(1);
  }

  console.log('\n✨ Import completed successfully!');
}

// Run the import
importBoundaries().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
