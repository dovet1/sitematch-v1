/**
 * Import Data Zone to Intermediate Zone Lookup
 * Source: National Records of Scotland geography lookup tables
 * URL: https://www.nrscotland.gov.uk/statistics-and-data/geography/our-products/scottish-postcode-directory/
 *
 * REQUIRED CSV FORMAT:
 * - DataZone2022 (or Data Zone 2022 Code) - e.g., S01000001
 * - DataZone2022Name (or Data Zone 2022 Name)
 * - IntermediateZone2011 (or Intermediate Zone 2011 Code) - e.g., S02000001
 */

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function importDZIZLookup() {
  console.log('=== DZ-to-IZ Lookup Import ===\n');

  const csvPath = path.join(process.cwd(), 'apps/web/data/scottishcensus2022/dz2022_iz2011_lookup.csv');

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found at: ${csvPath}`);
    console.error('\nPlease download the file from:');
    console.error('https://www.nrscotland.gov.uk/statistics-and-data/geography/our-products/scottish-postcode-directory/');
    console.error('\nOr from the geography lookups section.');
    console.error('\nAnd save it as: apps/web/data/scottishcensus2022/dz2022_iz2011_lookup.csv');
    console.error('\nExpected CSV columns:');
    console.error('- DataZone2022 (or Data Zone 2022 Code) - DZ code starting with S01');
    console.error('- DataZone2022Name (or Data Zone 2022 Name)');
    console.error('- IntermediateZone2011 (or Intermediate Zone 2011 Code) - IZ code starting with S02');
    process.exit(1);
  }

  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(fileContent, { columns: true, skip_empty_lines: true });

  console.log(`Loaded ${records.length} lookup records`);

  // Detect column names (handle variations)
  const firstRow = records[0];
  const dzCodeCol = Object.keys(firstRow).find(key =>
    key.toLowerCase().includes('datazone2022') ||
    key.toLowerCase().includes('data zone 2022') ||
    key.toLowerCase().includes('dz_code') ||
    key.toLowerCase().includes('dzcode')
  );
  const dzNameCol = Object.keys(firstRow).find(key =>
    key.toLowerCase().includes('datazone2022name') ||
    key.toLowerCase().includes('data zone 2022 name') ||
    key.toLowerCase().includes('dz_name') ||
    key.toLowerCase().includes('dzname')
  );
  const izCodeCol = Object.keys(firstRow).find(key =>
    key.toLowerCase().includes('intermediatezone2011') ||
    key.toLowerCase().includes('intermediate zone 2011') ||
    key.toLowerCase().includes('iz_code') ||
    key.toLowerCase().includes('izcode')
  );

  if (!dzCodeCol || !izCodeCol) {
    console.error('Could not find required columns in CSV');
    console.error('Available columns:', Object.keys(firstRow));
    console.error('\nRequired: DZ code column (starting with S01) and IZ code column (starting with S02)');
    process.exit(1);
  }

  console.log(`Using columns: DZ=${dzCodeCol}, IZ=${izCodeCol}, Name=${dzNameCol}`);

  const lookupData = records
    .filter((row: any) => {
      const dzCode = row[dzCodeCol];
      const izCode = row[izCodeCol];
      return dzCode && dzCode.startsWith('S01') && izCode && izCode.startsWith('S02');
    })
    .map((row: any) => ({
      dz_code: row[dzCodeCol],
      dz_name: dzNameCol ? row[dzNameCol] : row[dzCodeCol],
      iz_code: row[izCodeCol],
    }));

  console.log(`Prepared ${lookupData.length} lookup records for import`);

  // Validate we have all ~7,392 Data Zones
  const uniqueDZs = new Set(lookupData.map(r => r.dz_code));
  console.log(`Unique Data Zones: ${uniqueDZs.size}`);

  if (uniqueDZs.size < 6900) {
    console.warn(`WARNING: Expected ~7,392 Data Zones, found ${uniqueDZs.size}`);
    console.warn('Some Data Zones may be missing from the lookup table');
  }

  // Insert into database
  const BATCH_SIZE = 1000;
  for (let i = 0; i < lookupData.length; i += BATCH_SIZE) {
    const batch = lookupData.slice(i, i + BATCH_SIZE);

    const { error } = await supabase
      .from('data_zone_iz_lookup')
      .insert(batch);

    if (error) {
      console.error(`Error inserting batch ${i}-${i + batch.length}:`, error);
      throw error;
    }

    console.log(`Imported ${Math.min(i + BATCH_SIZE, lookupData.length)}/${lookupData.length}`);
  }

  console.log(`\n✓ Import complete: ${lookupData.length} DZ-to-IZ mappings imported`);
}

importDZIZLookup().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
