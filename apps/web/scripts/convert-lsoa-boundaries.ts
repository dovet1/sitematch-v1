/**
 * One-time script to convert LSOA boundaries from EPSG:27700 to WGS84
 * Run this once to pre-convert the data, then use the converted file
 *
 * Usage: npx tsx scripts/convert-lsoa-boundaries.ts
 */

import fs from 'fs';
import path from 'path';
import proj4 from 'proj4';

// Define British National Grid (EPSG:27700) projection
proj4.defs('EPSG:27700', '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 +units=m +no_defs');

const CENSUS_DATA_DIR = path.join(process.cwd(), 'data', 'census2021');

interface LSOAFeature {
  type: 'Feature';
  id: number;
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

/**
 * Convert coordinates from EPSG:27700 (British National Grid) to WGS84
 */
function convertCoordinates(coords: any, geomType: string): any {
  if (geomType === 'Polygon') {
    return coords.map((ring: any[]) =>
      ring.map((point: number[]) => {
        const [lng, lat] = proj4('EPSG:27700', 'EPSG:4326', point);
        return [lng, lat];
      })
    );
  } else if (geomType === 'MultiPolygon') {
    return coords.map((polygon: any[]) =>
      polygon.map((ring: any[]) =>
        ring.map((point: number[]) => {
          const [lng, lat] = proj4('EPSG:27700', 'EPSG:4326', point);
          return [lng, lat];
        })
      )
    );
  }
  return coords;
}

async function main() {
  const inputFile = path.join(
    CENSUS_DATA_DIR,
    'Lower_layer_Super_Output_Areas_December_2021_Boundaries_EW_BGC_V5.geojson'
  );

  const outputFile = path.join(
    CENSUS_DATA_DIR,
    'Lower_layer_Super_Output_Areas_December_2021_Boundaries_EW_WGS84.geojson'
  );

  if (!fs.existsSync(inputFile)) {
    console.error('❌ Input file not found:', inputFile);
    process.exit(1);
  }

  console.log('📖 Reading source file...');
  const fileContent = fs.readFileSync(inputFile, 'utf-8');
  const geoJSON: LSOAGeoJSON = JSON.parse(fileContent);

  console.log(`📊 Found ${geoJSON.features.length} LSOA boundaries`);
  console.log('🔄 Converting coordinates from EPSG:27700 to WGS84...');

  const startTime = Date.now();
  let processed = 0;

  geoJSON.features = geoJSON.features.map((feature) => {
    const convertedCoords = convertCoordinates(
      feature.geometry.coordinates,
      feature.geometry.type
    );

    processed++;
    if (processed % 5000 === 0) {
      console.log(`   Processed ${processed}/${geoJSON.features.length}...`);
    }

    return {
      ...feature,
      geometry: {
        ...feature.geometry,
        coordinates: convertedCoords,
      },
    };
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✅ Converted ${processed} features in ${duration}s`);

  console.log('💾 Writing converted file...');
  fs.writeFileSync(outputFile, JSON.stringify(geoJSON, null, 2));

  const inputSize = (fs.statSync(inputFile).size / 1024 / 1024).toFixed(2);
  const outputSize = (fs.statSync(outputFile).size / 1024 / 1024).toFixed(2);

  console.log('✅ Conversion complete!');
  console.log(`   Input:  ${inputFile} (${inputSize} MB)`);
  console.log(`   Output: ${outputFile} (${outputSize} MB)`);
  console.log('');
  console.log('Next steps:');
  console.log('1. Update lsoa-boundaries.ts to use the WGS84 file');
  console.log('2. Remove the coordinate conversion logic from loadLSOABoundaries()');
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
