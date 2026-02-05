/**
 * Export Data Zone Boundaries as GeoJSON for Mapbox
 *
 * This script exports Scottish Data Zone 2022 boundaries from Supabase
 * in GeoJSON format ready for upload to Mapbox Studio as a vector tileset.
 *
 * Output: data_zones_for_mapbox.geojson
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface DataZoneBoundary {
  dz_code: string;
  dz_name: string;
  geometry: string; // PostGIS geometry as text
}

async function exportDataZones() {
  console.log('=== Export Data Zones for Mapbox ===\n');
  console.log('Fetching Data Zone boundaries from Supabase...');

  // Fetch all Data Zone boundaries in batches
  let allBoundaries: DataZoneBoundary[] = [];
  const BATCH_SIZE = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('data_zone_boundaries')
      .select('dz_code, dz_name, geometry')
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error('Error fetching boundaries:', error);
      throw new Error(`Failed to fetch boundaries: ${error.message}`);
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allBoundaries = allBoundaries.concat(data as DataZoneBoundary[]);
      offset += BATCH_SIZE;
      console.log(`Fetched ${allBoundaries.length} Data Zones so far...`);

      if (data.length < BATCH_SIZE) {
        hasMore = false;
      }
    }
  }

  console.log(`\nTotal Data Zones fetched: ${allBoundaries.length}`);
  console.log('Converting to GeoJSON format...');

  // Convert to GeoJSON FeatureCollection
  const features = allBoundaries.map(dz => {
    // Parse the PostGIS geometry (it's already in GeoJSON format internally)
    let geometry;
    try {
      // The geometry field from PostGIS might be in WKT or GeoJSON format
      // Try parsing as JSON first
      if (typeof dz.geometry === 'string') {
        // If it starts with MULTIPOLYGON, it's WKT - we need the ST_AsGeoJSON version
        if (dz.geometry.startsWith('MULTIPOLYGON') || dz.geometry.startsWith('POLYGON')) {
          console.warn(`Data Zone ${dz.dz_code} has WKT geometry, need to fetch as GeoJSON`);
          return null;
        }
        geometry = JSON.parse(dz.geometry);
      } else {
        geometry = dz.geometry;
      }
    } catch (error) {
      console.error(`Failed to parse geometry for ${dz.dz_code}:`, error);
      return null;
    }

    return {
      type: 'Feature',
      properties: {
        code: dz.dz_code,
        name: dz.dz_name || dz.dz_code,
      },
      geometry: geometry,
    };
  }).filter(f => f !== null);

  const geojson = {
    type: 'FeatureCollection',
    features: features,
  };

  console.log(`Converted ${features.length} features to GeoJSON`);

  // Check if we need to re-fetch with ST_AsGeoJSON
  if (features.length === 0 && allBoundaries.length > 0) {
    console.log('\nGeometry appears to be in WKT format. Re-fetching with ST_AsGeoJSON...');
    return await exportDataZonesAsGeoJSON();
  }

  // Write to file
  const outputPath = path.join(process.cwd(), 'data_zones_for_mapbox.geojson');
  fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));

  console.log(`\n✓ Export complete!`);
  console.log(`Output file: ${outputPath}`);
  console.log(`File size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);
  console.log('\nNext steps:');
  console.log('1. Go to https://studio.mapbox.com/tilesets/');
  console.log('2. Click "New tileset"');
  console.log('3. Upload data_zones_for_mapbox.geojson');
  console.log('4. Name it "Scotland Data Zones 2022"');
  console.log('5. Note the tileset ID (e.g., dovet.scotland_dz_2022)');
  console.log('6. Update DemographicsMap.tsx with the new tileset ID');
}

/**
 * Alternative export method using ST_AsGeoJSON for WKT geometries
 */
async function exportDataZonesAsGeoJSON() {
  console.log('Fetching Data Zone boundaries with ST_AsGeoJSON...');

  // Use RPC function to get geometries as GeoJSON
  const { data, error } = await supabase.rpc('get_data_zones_geojson');

  if (error) {
    // If RPC doesn't exist, fetch manually with PostGIS function
    console.log('RPC function not found, using direct query...');

    let allBoundaries: any[] = [];
    const BATCH_SIZE = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: batchData, error: batchError } = await supabase
        .from('data_zone_boundaries')
        .select('dz_code, dz_name')
        .range(offset, offset + BATCH_SIZE - 1);

      if (batchError) {
        throw new Error(`Failed to fetch boundaries: ${batchError.message}`);
      }

      if (!batchData || batchData.length === 0) {
        hasMore = false;
      } else {
        // For each boundary, fetch the geometry as GeoJSON
        for (const dz of batchData) {
          const { data: geomData } = await supabase
            .rpc('st_asgeojson_dz', { dz_code_param: dz.dz_code });

          if (geomData) {
            allBoundaries.push({
              dz_code: dz.dz_code,
              dz_name: dz.dz_name,
              geometry_json: geomData,
            });
          }
        }

        offset += BATCH_SIZE;
        console.log(`Processed ${allBoundaries.length} Data Zones...`);

        if (batchData.length < BATCH_SIZE) {
          hasMore = false;
        }
      }
    }

    const features = allBoundaries.map(dz => ({
      type: 'Feature',
      properties: {
        code: dz.dz_code,
        name: dz.dz_name || dz.dz_code,
      },
      geometry: typeof dz.geometry_json === 'string'
        ? JSON.parse(dz.geometry_json)
        : dz.geometry_json,
    }));

    const geojson = {
      type: 'FeatureCollection',
      features: features,
    };

    const outputPath = path.join(process.cwd(), 'data_zones_for_mapbox.geojson');
    fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));

    console.log(`\n✓ Export complete!`);
    console.log(`Output file: ${outputPath}`);
    console.log(`File size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);
  }
}

exportDataZones().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
