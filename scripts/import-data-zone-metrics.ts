/**
 * Import Scottish Census 2022 Data Zone Metrics
 * Processes 14 CSV files and imports them into the data_zone_metrics table
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

interface ScottishCensusTable {
  filename: string;
  ts_code: string;
  componentIdPrefix?: string;
  denominatorStrategy: 'sum_row' | 'population' | 'none';
  geoCodeColumn?: string; // Optional: specify which column contains the Data Zone code
}

const SCOTTISH_CENSUS_TABLES: ScottishCensusTable[] = [
  {
    filename: 'population_data_zones.csv',
    ts_code: 'SC001',
    componentIdPrefix: 'population',
    denominatorStrategy: 'none',
    geoCodeColumn: 'Data zone code',
  },
  {
    filename: 'total_household_count_by_data_zone.csv',
    ts_code: 'SC041',
    componentIdPrefix: 'hhc',
    denominatorStrategy: 'none',
    geoCodeColumn: 'Data zone code',
  },
  {
    filename: 'household_count_by_occupant_number.csv',
    ts_code: 'SC003',
    componentIdPrefix: 'hhc',
    denominatorStrategy: 'sum_row',
    geoCodeColumn: 'Data zone code',
  },
  {
    filename: 'ethnic_groups_by_data_zone.csv',
    ts_code: 'SC021',
    componentIdPrefix: null,
    denominatorStrategy: 'sum_row',
    geoCodeColumn: 'Intermediate Zone - Data Zone 2011',
  },
  {
    filename: 'economic_activity_data_zone.csv',
    ts_code: 'SC066',
    componentIdPrefix: 'economically',
    denominatorStrategy: 'population',
    geoCodeColumn: 'Data Zone 2011',
  },
  {
    filename: 'occupations_by_data_zone.csv',
    ts_code: 'SC063',
    componentIdPrefix: null,
    denominatorStrategy: 'sum_row',
    geoCodeColumn: 'Data Zone 2011',
  },
  {
    filename: 'qualifications_by_data_zone.csv',
    ts_code: 'SC067',
    componentIdPrefix: null,
    denominatorStrategy: 'sum_row',
    geoCodeColumn: 'Data Zone 2011',
  },
  {
    filename: 'method_of_travel_to_work_by_data_zone.csv',
    ts_code: 'SC061',
    componentIdPrefix: null,
    denominatorStrategy: 'sum_row',
    geoCodeColumn: 'Data Zone 2011',
  },
  {
    filename: 'distance_travelled_to_work_by_data_zone.csv',
    ts_code: 'SC058',
    componentIdPrefix: 'ts058',
    denominatorStrategy: 'sum_row',
    geoCodeColumn: 'Data Zone 2011',
  },
  {
    filename: 'general_health_by_data_zone.csv',
    ts_code: 'SC037',
    componentIdPrefix: null,
    denominatorStrategy: 'sum_row',
    geoCodeColumn: 'Data Zone 2011',
  },
  {
    filename: 'disability_by_data_zone.csv',
    ts_code: 'SC038',
    componentIdPrefix: null,
    denominatorStrategy: 'population',
    geoCodeColumn: 'Data Zone 2011',
  },
  {
    filename: 'religion_data_zone.csv',
    ts_code: 'SC030',
    componentIdPrefix: null,
    denominatorStrategy: 'sum_row',
    geoCodeColumn: 'Data Zone 2011',
  },
  {
    filename: 'tenure_data_zone.csv',
    ts_code: 'SC054',
    componentIdPrefix: null,
    denominatorStrategy: 'sum_row',
    geoCodeColumn: 'Data Zone 2011',
  },
  {
    filename: 'type_of_accommodation_by_data_zone.csv',
    ts_code: 'SC044',
    componentIdPrefix: 'accom',
    denominatorStrategy: 'sum_row',
    geoCodeColumn: 'Data Zone 2011',
  },
];

interface PopulationCache {
  [dzCode: string]: number;
}

/**
 * Load population data into a cache for use with 'population' denominator strategy
 */
async function loadPopulationCache(): Promise<PopulationCache> {
  console.log('[Population Cache] Loading population data...');

  const csvPath = path.join(process.cwd(), 'apps/web/data/scottishcensus2022/population_data_zones.csv');

  if (!fs.existsSync(csvPath)) {
    throw new Error(`Population CSV not found at: ${csvPath}`);
  }

  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(fileContent, { columns: true, skip_empty_lines: true });

  const cache: PopulationCache = {};

  records.forEach((row: any) => {
    const dzCode = row['Data zone code'];
    const population = parseInt(row['Total population'], 10) || 0;

    if (dzCode) {
      cache[dzCode] = population;
    }
  });

  console.log(`[Population Cache] Loaded ${Object.keys(cache).length} Data Zone populations`);
  return cache;
}

/**
 * Sanitize column names to create component_id values
 * "White: Total" -> "white_total"
 * "Asian, Asian Scottish or Asian British: Total" -> "asian_asian_scottish_or_asian_british_total"
 */
function sanitizeColumnName(column: string): string {
  return column
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Detect which column contains the Data Zone code
 */
function detectGeoCodeColumn(row: any, configuredColumn?: string): string {
  // Try configured column first
  if (configuredColumn && row[configuredColumn]) {
    return configuredColumn;
  }

  // Fallback: Try common column names
  const possibleColumns = [
    'Data zone code',
    'Data Zone 2011',
    'Intermediate Zone - Data Zone 2011',
  ];

  for (const colName of possibleColumns) {
    if (row[colName] !== undefined) {
      return colName;
    }
  }

  throw new Error(`Could not find Data Zone code column in row: ${JSON.stringify(Object.keys(row))}`);
}

/**
 * Import a single census table
 */
async function importTable(table: ScottishCensusTable, populationCache: PopulationCache) {
  console.log(`\n[${table.filename}] Starting import...`);

  const csvPath = path.join(process.cwd(), 'apps/web/data/scottishcensus2022', table.filename);

  if (!fs.existsSync(csvPath)) {
    console.error(`[${table.filename}] File not found at: ${csvPath}`);
    return;
  }

  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(fileContent, { columns: true, skip_empty_lines: true });

  console.log(`[${table.filename}] Loaded ${records.length} records`);

  const metrics = [];

  for (const row of records) {
    // Detect geo code column
    const geoCodeColumn = detectGeoCodeColumn(row, table.geoCodeColumn);
    const dzCode = row[geoCodeColumn];
    const dzName = row['Data zone name'] || dzCode;

    if (!dzCode || !dzCode.startsWith('S01')) {
      // Skip invalid or header rows
      continue;
    }

    // Get metric columns (skip code/name columns)
    const skipColumns = [
      'Data zone code',
      'Data zone name',
      'Data Zone 2011',
      'Intermediate Zone - Data Zone 2011',
      'Intermediate Zone Name',
      'Council area name',
      'Council Area 2019',
      'Council Area Name',
    ];

    const metricColumns = Object.keys(row).filter(col => !skipColumns.includes(col));

    // Calculate denominator based on strategy
    let denominator: number | null = null;

    if (table.denominatorStrategy === 'sum_row') {
      denominator = metricColumns.reduce((sum, col) => {
        const value = parseFloat(row[col]);
        return sum + (isNaN(value) ? 0 : value);
      }, 0);
    } else if (table.denominatorStrategy === 'population') {
      denominator = populationCache[dzCode] || null;
      if (denominator === null) {
        console.warn(`[${table.filename}] No population found for ${dzCode}`);
      }
    }
    // else denominatorStrategy === 'none', leave as null

    // Create metric for each column
    for (const column of metricColumns) {
      const numeratorStr = row[column];
      const numerator = parseFloat(numeratorStr);

      if (isNaN(numerator)) {
        continue; // Skip non-numeric values
      }

      const componentId = table.componentIdPrefix
        ? `${table.componentIdPrefix}_${sanitizeColumnName(column)}`
        : sanitizeColumnName(column);

      const valuePct = denominator && denominator > 0 ? (numerator / denominator) * 100 : null;

      metrics.push({
        geo_code: dzCode,
        geo_name: dzName,
        component_id: componentId,
        ts_code: table.ts_code,
        numerator: numerator,
        denominator: denominator,
        value_pct: valuePct,
        edition: '2022',
      });
    }
  }

  console.log(`[${table.filename}] Created ${metrics.length} metrics`);

  // Batch insert
  const BATCH_SIZE = 1000;
  for (let i = 0; i < metrics.length; i += BATCH_SIZE) {
    const batch = metrics.slice(i, i + BATCH_SIZE);

    const { error } = await supabase.from('data_zone_metrics').insert(batch);

    if (error) {
      console.error(`[${table.filename}] Error inserting batch ${i}-${i + batch.length}:`, error);
      throw error;
    }

    console.log(`[${table.filename}] Imported ${Math.min(i + BATCH_SIZE, metrics.length)}/${metrics.length}`);
  }

  console.log(`[${table.filename}] ✓ Import complete`);
}

/**
 * Main execution
 */
async function main() {
  console.log('=== Scottish Census 2022 Import ===\n');
  console.log(`Processing ${SCOTTISH_CENSUS_TABLES.length} tables...`);

  // Load population cache
  const populationCache = await loadPopulationCache();

  // Import each table sequentially
  for (const table of SCOTTISH_CENSUS_TABLES) {
    try {
      await importTable(table, populationCache);
    } catch (error) {
      console.error(`[${table.filename}] Failed:`, error);
      process.exit(1);
    }
  }

  console.log('\n=== Import Complete ===');
  console.log('All Scottish Census 2022 data has been imported successfully!');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
