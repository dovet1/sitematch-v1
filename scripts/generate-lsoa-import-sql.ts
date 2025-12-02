#!/usr/bin/env tsx
/**
 * Generate SQL INSERT statements for LSOA boundaries
 *
 * This script reads the LSOA boundaries GeoJSON file and generates SQL INSERT
 * statements that can be run directly in Supabase.
 *
 * Usage: npx tsx scripts/generate-lsoa-import-sql.ts > import.sql
 */

import fs from 'fs';
import path from 'path';

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

function escapeString(str: string): string {
  return str.replace(/'/g, "''");
}

function geometryToWKT(feature: LSOAFeature): string {
  if (feature.geometry.type === 'Polygon') {
    // Convert Polygon to MultiPolygon for consistency
    const coords = feature.geometry.coordinates;
    const rings = coords.map((ring: any) =>
      `(${ring.map((point: any) => `${point[0]} ${point[1]}`).join(', ')})`
    ).join(', ');
    return `MULTIPOLYGON(((${rings})))`;
  } else {
    // Already MultiPolygon
    const coords = feature.geometry.coordinates;
    const polygons = coords.map((polygon: any) =>
      `(${polygon.map((ring: any) =>
        `(${ring.map((point: any) => `${point[0]} ${point[1]}`).join(', ')})`
      ).join(', ')})`
    ).join(', ');
    return `MULTIPOLYGON(${polygons})`;
  }
}

async function generateSQL() {
  console.error('🚀 Generating LSOA boundaries SQL import...\n');

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

  console.error('📂 Reading GeoJSON file...');
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const geoJSON: LSOAGeoJSON = JSON.parse(fileContent);
  console.error(`✅ Loaded ${geoJSON.features.length.toLocaleString()} LSOA features\n`);

  // Output SQL header
  console.log('-- LSOA Boundaries Import');
  console.log(`-- Generated: ${new Date().toISOString()}`);
  console.log(`-- Total features: ${geoJSON.features.length}\n`);
  console.log('BEGIN;\n');

  // Generate INSERT statements in batches
  const BATCH_SIZE = 100;
  let batchCount = 0;

  for (let i = 0; i < geoJSON.features.length; i += BATCH_SIZE) {
    const batch = geoJSON.features.slice(i, i + BATCH_SIZE);
    batchCount++;

    console.log(`-- Batch ${batchCount} (${i + 1} to ${Math.min(i + BATCH_SIZE, geoJSON.features.length)})`);
    console.log('INSERT INTO public.lsoa_boundaries (lsoa_code, lsoa_name, lat, lng, geometry)');
    console.log('VALUES');

    const values = batch.map((feature, idx) => {
      const geomWKT = geometryToWKT(feature);
      const isLast = idx === batch.length - 1;

      return `  ('${escapeString(feature.properties.LSOA21CD)}', '${escapeString(feature.properties.LSOA21NM)}', ${feature.properties.LAT}, ${feature.properties.LONG}, ST_GeomFromText('${geomWKT}', 4326))${isLast ? '' : ','}`;
    });

    console.log(values.join('\n'));
    console.log('ON CONFLICT (lsoa_code) DO NOTHING;\n');

    // Progress to stderr
    if ((i + BATCH_SIZE) % 1000 === 0) {
      console.error(`   Progress: ${Math.min(i + BATCH_SIZE, geoJSON.features.length).toLocaleString()}/${geoJSON.features.length.toLocaleString()}`);
    }
  }

  console.log('COMMIT;\n');
  console.log('-- Verify import');
  console.log('SELECT COUNT(*) FROM public.lsoa_boundaries;');

  console.error('\n✨ SQL generation complete!');
  console.error(`📊 Generated ${batchCount} batches with ${geoJSON.features.length} features total`);
}

// Run the generator
generateSQL().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
