#!/usr/bin/env tsx
/**
 * Export LSOA boundaries to CSV format for manual upload to Supabase
 *
 * This creates a CSV file that you can upload directly via Supabase Table Editor.
 * Note: For geometry data, we'll export as WKT (Well-Known Text) format.
 *
 * Usage: npx tsx scripts/export-lsoa-to-csv.ts
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

function escapeCSV(str: string): string {
  // Escape quotes and wrap in quotes if contains comma, newline, or quote
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
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

async function exportToCSV() {
  console.log('🚀 Exporting LSOA boundaries to CSV...\n');

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

  // Create output file
  const outputPath = path.join(process.cwd(), 'lsoa_boundaries.csv');
  const writeStream = fs.createWriteStream(outputPath);

  // Write CSV header
  writeStream.write('lsoa_code,lsoa_name,lat,lng,geometry\n');

  // Write data rows
  console.log('📝 Writing CSV rows...');
  let count = 0;

  for (const feature of geoJSON.features) {
    const wkt = geometryToWKT(feature);

    const row = [
      escapeCSV(feature.properties.LSOA21CD),
      escapeCSV(feature.properties.LSOA21NM),
      feature.properties.LAT,
      feature.properties.LONG,
      escapeCSV(`SRID=4326;${wkt}`)
    ].join(',');

    writeStream.write(row + '\n');
    count++;

    if (count % 1000 === 0) {
      process.stdout.write(`\r   Progress: ${count.toLocaleString()}/${geoJSON.features.length.toLocaleString()}`);
    }
  }

  writeStream.end();
  console.log(`\n\n✨ Export complete!`);
  console.log(`📁 File saved to: ${outputPath}`);
  console.log(`📊 Total records: ${count.toLocaleString()}`);

  // Get file size
  const stats = fs.statSync(outputPath);
  const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`💾 File size: ${fileSizeMB} MB`);

  console.log('\n⚠️  WARNING: CSV file is very large and Supabase UI may not handle it.');
  console.log('   Better option: Use the SQL import method instead.');
  console.log('   See: SETUP_INSTRUCTIONS.md');
}

// Run the export
exportToCSV().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
