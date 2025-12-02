/**
 * Pre-calculate LSOA adjacency table
 * This script processes all LSOA boundaries and determines which LSOAs share a border.
 *
 * Run with: npx tsx scripts/calculate-lsoa-adjacency.ts
 *
 * Expected runtime: 30-60 minutes
 * Output: data/census2021/lsoa-adjacency.json (~2-5MB)
 */

import fs from 'fs';
import path from 'path';
import * as turf from '@turf/turf';

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

interface GridCell {
  features: Array<{ code: string; feature: LSOAFeature }>;
}

const CELL_SIZE = 0.1; // degrees (~11km)

function getGridKey(lng: number, lat: number): string {
  const x = Math.floor(lng / CELL_SIZE);
  const y = Math.floor(lat / CELL_SIZE);
  return `${x},${y}`;
}

async function calculateAdjacencies() {
  console.log('🔍 Loading LSOA boundaries...');

  const boundariesPath = path.join(process.cwd(), 'apps', 'web', 'data', 'census2021', 'Lower_layer_Super_Output_Areas_December_2021_Boundaries_EW_BGC_V5.geojson');

  if (!fs.existsSync(boundariesPath)) {
    console.error('❌ Error: LSOA boundaries file not found at:', boundariesPath);
    process.exit(1);
  }

  const geoJSON = JSON.parse(fs.readFileSync(boundariesPath, 'utf-8'));
  const totalFeatures = geoJSON.features.length;

  console.log(`✓ Loaded ${totalFeatures} LSOA boundaries`);
  console.log('📊 Building spatial index...');

  // Build grid-based spatial index
  const grid: Record<string, GridCell> = {};

  for (const feature of geoJSON.features) {
    const centroid = turf.centroid(feature);
    const [lng, lat] = centroid.geometry.coordinates;
    const key = getGridKey(lng, lat);

    if (!grid[key]) {
      grid[key] = { features: [] };
    }

    grid[key].features.push({
      code: feature.properties.LSOA21CD,
      feature: feature,
    });
  }

  console.log(`✓ Built spatial index with ${Object.keys(grid).length} grid cells`);
  console.log('🔄 Calculating adjacencies (this will take 30-60 minutes)...');

  const adjacencyMap: Record<string, string[]> = {};
  let processed = 0;
  const startTime = Date.now();

  for (const cellKey in grid) {
    const cell = grid[cellKey];

    // Get neighboring cells (9 cells total including current)
    const [x, y] = cellKey.split(',').map(Number);
    const neighborKeys = [
      `${x-1},${y-1}`, `${x},${y-1}`, `${x+1},${y-1}`,
      `${x-1},${y}`,   cellKey,        `${x+1},${y}`,
      `${x-1},${y+1}`, `${x},${y+1}`, `${x+1},${y+1}`,
    ];

    // Collect all features from neighboring cells
    const candidates: Array<{ code: string; feature: LSOAFeature }> = [];
    for (const nKey of neighborKeys) {
      if (grid[nKey]) {
        candidates.push(...grid[nKey].features);
      }
    }

    // Check each feature in current cell against candidates
    for (const item1 of cell.features) {
      adjacencyMap[item1.code] = [];

      for (const item2 of candidates) {
        if (item1.code === item2.code) continue;

        try {
          // Buffer each geometry slightly (0.0001 degrees ~= 11 meters) to catch shared boundaries
          // LSOAs that share a border will have their buffers overlap
          const buffer1 = turf.buffer(item1.feature, 0.01, { units: 'meters' });
          const buffer2 = turf.buffer(item2.feature, 0.01, { units: 'meters' });

          if (buffer1 && buffer2) {
            const intersects = turf.booleanIntersects(buffer1, buffer2);

            if (intersects) {
              adjacencyMap[item1.code].push(item2.code);
            }
          }
        } catch (error) {
          // Skip invalid geometries
          continue;
        }
      }

      processed++;

      // Progress logging
      if (processed % 500 === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = processed / elapsed;
        const remaining = (totalFeatures - processed) / rate;
        const percentComplete = Math.round((processed / totalFeatures) * 100);

        console.log(
          `  Progress: ${processed}/${totalFeatures} (${percentComplete}%) - ` +
          `${Math.round(rate)} LSOAs/sec - ` +
          `ETA: ${Math.round(remaining / 60)} minutes`
        );
      }
    }
  }

  const totalTime = Math.round((Date.now() - startTime) / 1000);
  console.log(`✓ Finished calculating adjacencies in ${Math.round(totalTime / 60)} minutes ${totalTime % 60} seconds`);

  // Calculate statistics
  const adjacencyCounts = Object.values(adjacencyMap).map(arr => arr.length);
  const avgAdjacent = Math.round(adjacencyCounts.reduce((a, b) => a + b, 0) / adjacencyCounts.length);
  const maxAdjacent = Math.max(...adjacencyCounts);
  const minAdjacent = Math.min(...adjacencyCounts);

  console.log(`📈 Statistics:`);
  console.log(`  Total LSOAs: ${Object.keys(adjacencyMap).length}`);
  console.log(`  Average adjacent LSOAs: ${avgAdjacent}`);
  console.log(`  Min adjacent LSOAs: ${minAdjacent}`);
  console.log(`  Max adjacent LSOAs: ${maxAdjacent}`);

  // Save to JSON file
  const outputPath = path.join(process.cwd(), 'apps', 'web', 'data', 'census2021', 'lsoa-adjacency.json');
  console.log('💾 Saving adjacency data...');

  fs.writeFileSync(outputPath, JSON.stringify(adjacencyMap, null, 2));

  const fileSize = Math.round(fs.statSync(outputPath).size / 1024 / 1024 * 10) / 10;
  console.log(`✅ Done! Adjacency map saved to ${outputPath} (${fileSize}MB)`);
}

// Run the calculation
calculateAdjacencies().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
