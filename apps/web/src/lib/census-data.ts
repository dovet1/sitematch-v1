/**
 * Census 2021 CSV Data Parser
 * Reads locally stored Census 2021 bulk data from Nomis
 */

import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { calculateDistance } from './geography-utils';

const CENSUS_DATA_DIR = path.join(process.cwd(), 'data', 'census2021');

interface CensusRow {
  'geography code': string;
  [key: string]: string | number;
}

interface LSOACentroid {
  LSOA21CD: string;
  x: string; // longitude
  y: string; // latitude
}

// Cache for LSOA centroids (loaded once)
let lsoaCentroids: LSOACentroid[] | null = null;

/**
 * Load LSOA centroids from the ONS PWC file
 */
function loadLSOACentroids(): LSOACentroid[] {
  if (lsoaCentroids) {
    return lsoaCentroids;
  }

  const filePath = path.join(CENSUS_DATA_DIR, 'LLSOA_Dec_2021_PWC_for_England_and_Wales_2022.csv');

  if (!fs.existsSync(filePath)) {
    console.error('LSOA centroids file not found:', filePath);
    return [];
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  lsoaCentroids = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
  });

  console.log(`Loaded ${lsoaCentroids.length} LSOA centroids`);
  return lsoaCentroids;
}

/**
 * Get LSOA codes within a radius of a point
 * Uses real LSOA population-weighted centroids from ONS
 */
export function getLSOACodesInRadius(
  lat: number,
  lng: number,
  radiusMiles: number
): string[] {
  const centroids = loadLSOACentroids();
  const withinRadius: string[] = [];

  for (const lsoa of centroids) {
    const lsoaLat = parseFloat(lsoa.y);
    const lsoaLng = parseFloat(lsoa.x);

    const distance = calculateDistance(lat, lng, lsoaLat, lsoaLng);

    if (distance <= radiusMiles) {
      withinRadius.push(lsoa.LSOA21CD);
    }
  }

  console.log(`Found ${withinRadius.length} LSOAs within ${radiusMiles} miles of (${lat}, ${lng})`);
  return withinRadius;
}

/**
 * Parse a Census CSV file and return rows for specific geography codes
 */
function parseCensusCSV(filename: string, geographyCodes: string[]): CensusRow[] {
  const filePath = path.join(CENSUS_DATA_DIR, filename);

  if (!fs.existsSync(filePath)) {
    console.warn(`Census file not found: ${filename}`);
    return [];
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');

  // New format files have metadata headers - skip lines until we find the column header row
  // Column header rows have "mnemonic" at the end
  const lines = fileContent.split('\n');
  let headerLineIndex = -1;

  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    if (lines[i].includes('mnemonic') || lines[i].includes('geography code')) {
      headerLineIndex = i;
      break;
    }
  }

  let contentToParse = fileContent;
  if (headerLineIndex > 0) {
    // Skip metadata lines and start from the header row
    contentToParse = lines.slice(headerLineIndex).join('\n');
  }

  const records: CensusRow[] = parse(contentToParse, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true, // Allow rows with different column counts (handles footer text)
    skip_records_with_error: true, // Skip rows that can't be parsed
  });

  // Filter to only the requested geography codes
  // Handle both old format (geography code) and new format (mnemonic)
  return records.filter((row) => {
    const geoCode = row['geography code'] || row['mnemonic'];
    return geographyCodes.includes(geoCode);
  });
}

/**
 * Extract values from a single row by matching column name patterns
 */
function extractValuesFromRow(row: CensusRow, pattern: string): Record<string, number> {
  const values: Record<string, number> = {};

  for (const key in row) {
    if (key.includes(pattern) && key.includes('measures: Value')) {
      let cleanKey = key
        .replace(pattern, '')
        .replace('; measures: Value', '')
        .trim();

      // Remove leading colon
      cleanKey = cleanKey.replace(/^:\s*/, '');

      if (cleanKey && !cleanKey.toLowerCase().includes('total') && !cleanKey.toLowerCase().includes('all')) {
        values[cleanKey] = Number(row[key] || 0);
      }
    }
  }

  return values;
}

/**
 * Get per-LSOA census data for all datasets
 */
export function getPerLSOADataFromCSV(geographyCodes: string[]): Record<string, any> {
  const byLsoa: Record<string, any> = {};

  // Initialize all LSOAs
  geographyCodes.forEach(code => {
    byLsoa[code] = {
      lsoa_code: code,
      // Population & Households
      population_total: 0,
      households_total: 0,
      household_composition: {},
      accommodation_type: {},
      tenure: {},
      // Demographics
      age_groups: {},
      ethnicity: {},
      country_of_birth: {},
      religion: {},
      // Employment
      economic_activity: {},
      occupation: {},
      // Education
      qualifications: {},
      // Mobility
      travel_to_work: {},
      distance_to_work: {},
      // Health
      general_health: {},
      disability: {},
    };
  });

  // Helper to get code from row (handles both old and new format)
  const getCode = (row: CensusRow) => row['geography code'] || row['mnemonic'];

  // TS001: Population (total)
  const ts001 = parseCensusCSV('census2021-ts001-lsoa.csv', geographyCodes);
  console.log(`TS001: Loaded ${ts001.length} rows for ${geographyCodes.length} geography codes`);

  if (ts001.length > 0) {
    const firstRow = ts001[0];
    console.log('TS001 First row code:', getCode(firstRow));
    console.log('TS001 First row columns:', Object.keys(firstRow).slice(0, 5));
    const totalKey = Object.keys(firstRow).find(k =>
      (k.includes('Residence type: Total') || k.includes('Usual residents')) &&
      k.includes('measures: Value')
    );
    console.log('TS001 Found total key:', totalKey);
    if (totalKey) {
      console.log('TS001 Sample value:', firstRow[totalKey]);
    }
  }

  ts001.forEach((row) => {
    const code = getCode(row);
    if (byLsoa[code]) {
      // Look for "Residence type: Total" or "Usual residents"
      const totalKey = Object.keys(row).find(k =>
        (k.includes('Residence type: Total') || k.includes('Usual residents')) &&
        k.includes('measures: Value')
      );
      const value = totalKey ? Number(row[totalKey] || 0) : 0;
      byLsoa[code].population_total = value;
      if (value > 0) {
        console.log(`TS001: Set ${code} population to ${value}`);
      }
    }
  });

  // TS041: Number of Households
  const ts041 = parseCensusCSV('number-of-households-ts041.csv', geographyCodes);
  console.log(`TS041: Loaded ${ts041.length} rows`);

  if (ts041.length > 0) {
    const firstRow = ts041[0];
    console.log('TS041 First row code:', getCode(firstRow));
    console.log('TS041 First row columns:', Object.keys(firstRow));
    console.log('TS041 Has "Total" column:', 'Total' in firstRow);
    console.log('TS041 Has "2021" column:', '2021' in firstRow);
    const value = Number(firstRow['2021'] || firstRow['Number of households'] || firstRow['Total'] || 0);
    console.log('TS041 Sample value:', value);
  }

  ts041.forEach((row) => {
    const code = getCode(row);
    if (byLsoa[code]) {
      // TS041 has a single value column - it's the first column (key "2021")
      // Or it might have "Number of households" column
      const value = Number(row['2021'] || row['Number of households'] || row['Total'] || 0);
      byLsoa[code].households_total = value;
      if (value > 0) {
        console.log(`TS041: Set ${code} households to ${value}`);
      }
    }
  });

  // TS003: Household composition
  const ts003 = parseCensusCSV('census2021-ts003-lsoa.csv', geographyCodes);
  ts003.forEach((row) => {
    const code = getCode(row);
    if (byLsoa[code]) {
      byLsoa[code].household_composition = extractValuesFromRow(row, 'Household composition:');
    }
  });

  // TS044: Accommodation type
  const ts044 = parseCensusCSV('accommodation-type-ts044.csv', geographyCodes);
  ts044.forEach((row) => {
    const code = getCode(row);
    if (byLsoa[code]) {
      // Extract columns that aren't Total or %
      const values: Record<string, number> = {};
      Object.keys(row).forEach(key => {
        if (key !== 'Total' && key !== 'mnemonic' && key !== '2021 super output area - lower layer' && !key.includes('%')) {
          values[key] = Number(row[key] || 0);
        }
      });
      byLsoa[code].accommodation_type = values;
    }
  });

  // TS054: Tenure
  const ts054 = parseCensusCSV('tenure-ts054.csv', geographyCodes);
  ts054.forEach((row) => {
    const code = getCode(row);
    if (byLsoa[code]) {
      const values: Record<string, number> = {};
      Object.keys(row).forEach(key => {
        if (key !== 'Total' && key !== 'mnemonic' && key !== '2021 super output area - lower layer' && !key.includes('%')) {
          values[key] = Number(row[key] || 0);
        }
      });
      byLsoa[code].tenure = values;
    }
  });

  // TS007A: Age profile
  const ts007a = parseCensusCSV('age-by-five-year-age-bands-ts007a.csv', geographyCodes);
  ts007a.forEach((row) => {
    const code = getCode(row);
    if (byLsoa[code]) {
      const values: Record<string, number> = {};
      Object.keys(row).forEach(key => {
        if (key !== 'Total' && key !== 'mnemonic' && key !== '2021 super output area - lower layer' && !key.includes('%')) {
          values[key] = Number(row[key] || 0);
        }
      });
      byLsoa[code].age_groups = values;
    }
  });

  // TS021: Ethnic group
  const ts021 = parseCensusCSV('ethnic-groups-ts021.csv', geographyCodes);
  ts021.forEach((row) => {
    const code = getCode(row);
    if (byLsoa[code]) {
      const values: Record<string, number> = {};
      Object.keys(row).forEach(key => {
        if (key !== 'Total: All usual residents' && key !== 'mnemonic' && key !== '2021 super output area - lower layer' && !key.includes('%')) {
          values[key] = Number(row[key] || 0);
        }
      });
      byLsoa[code].ethnicity = values;
    }
  });

  // TS004: Country of birth
  const ts004 = parseCensusCSV('country-of-birth-ts004.csv', geographyCodes);
  ts004.forEach((row) => {
    const code = getCode(row);
    if (byLsoa[code]) {
      const values: Record<string, number> = {};
      Object.keys(row).forEach(key => {
        // Skip Total, metadata columns, and percentage columns
        if (key !== 'Total: All usual residents' && key !== 'Total' && key !== 'mnemonic' &&
            key !== '2021 super output area - lower layer' && !key.includes('%')) {
          values[key] = Number(row[key] || 0);
        }
      });
      byLsoa[code].country_of_birth = values;
    }
  });

  // TS030: Religion
  const ts030 = parseCensusCSV('religion-ts030.csv', geographyCodes);
  ts030.forEach((row) => {
    const code = getCode(row);
    if (byLsoa[code]) {
      const values: Record<string, number> = {};
      Object.keys(row).forEach(key => {
        if (key !== 'Total: All usual residents' && key !== 'mnemonic' && key !== '2021 super output area - lower layer' && !key.includes('%')) {
          values[key] = Number(row[key] || 0);
        }
      });
      byLsoa[code].religion = values;
    }
  });

  // TS066: Economic activity status
  const ts066 = parseCensusCSV('economic-activity-status-ts066.csv', geographyCodes);
  ts066.forEach((row) => {
    const code = getCode(row);
    if (byLsoa[code]) {
      const values: Record<string, number> = {};
      Object.keys(row).forEach(key => {
        if (key !== 'Total: All usual residents aged 16 years and over' && key !== 'mnemonic' && key !== '2021 super output area - lower layer' && !key.includes('%')) {
          values[key] = Number(row[key] || 0);
        }
      });
      byLsoa[code].economic_activity = values;
    }
  });

  // TS063: Occupation
  const ts063 = parseCensusCSV('occupation-ts063.csv', geographyCodes);
  ts063.forEach((row) => {
    const code = getCode(row);
    if (byLsoa[code]) {
      const values: Record<string, number> = {};
      Object.keys(row).forEach(key => {
        if (key !== 'Total: All usual residents aged 16 years and over in employment the week before the census' && key !== 'mnemonic' && key !== '2021 super output area - lower layer' && !key.includes('%')) {
          values[key] = Number(row[key] || 0);
        }
      });
      byLsoa[code].occupation = values;
    }
  });

  // TS067: Highest level of qualification
  const ts067 = parseCensusCSV('highest-level-of-qualification-ts067.csv', geographyCodes);
  ts067.forEach((row) => {
    const code = getCode(row);
    if (byLsoa[code]) {
      const values: Record<string, number> = {};
      Object.keys(row).forEach(key => {
        if (key !== 'Total: All usual residents aged 16 years and over' && key !== 'mnemonic' && key !== '2021 super output area - lower layer' && !key.includes('%')) {
          values[key] = Number(row[key] || 0);
        }
      });
      byLsoa[code].qualifications = values;
    }
  });

  // TS061: Method used to travel to work
  const ts061 = parseCensusCSV('method-used-to-travel-to-work-ts061.csv', geographyCodes);
  ts061.forEach((row) => {
    const code = getCode(row);
    if (byLsoa[code]) {
      const values: Record<string, number> = {};
      Object.keys(row).forEach(key => {
        if (key !== 'Total: All usual residents aged 16 years and over in employment the week before the census' && key !== 'mnemonic' && key !== '2021 super output area - lower layer' && !key.includes('%')) {
          values[key] = Number(row[key] || 0);
        }
      });
      byLsoa[code].travel_to_work = values;
    }
  });

  // TS058: Distance travelled to work
  const ts058 = parseCensusCSV('distance-travelled-to-work-ts058.csv', geographyCodes);
  ts058.forEach((row) => {
    const code = getCode(row);
    if (byLsoa[code]) {
      const values: Record<string, number> = {};
      Object.keys(row).forEach(key => {
        if (key !== 'Total: All usual residents aged 16 years and over in employment the week before the census' && key !== 'mnemonic' && key !== '2021 super output area - lower layer' && !key.includes('%')) {
          values[key] = Number(row[key] || 0);
        }
      });
      byLsoa[code].distance_to_work = values;
    }
  });

  // TS037: General health
  const ts037 = parseCensusCSV('general-health-ts037.csv', geographyCodes);
  ts037.forEach((row) => {
    const code = getCode(row);
    if (byLsoa[code]) {
      const values: Record<string, number> = {};
      Object.keys(row).forEach(key => {
        if (key !== 'Total: All usual residents' && key !== 'mnemonic' && key !== '2021 super output area - lower layer' && !key.includes('%')) {
          values[key] = Number(row[key] || 0);
        }
      });
      byLsoa[code].general_health = values;
    }
  });

  // TS038: Disability
  const ts038 = parseCensusCSV('disability-ts038.csv', geographyCodes);
  ts038.forEach((row) => {
    const code = getCode(row);
    if (byLsoa[code]) {
      const values: Record<string, number> = {};
      Object.keys(row).forEach(key => {
        if (key !== 'Total: All usual residents' && key !== 'mnemonic' && key !== '2021 super output area - lower layer' && !key.includes('%')) {
          values[key] = Number(row[key] || 0);
        }
      });
      byLsoa[code].disability = values;
    }
  });

  return byLsoa;
}

/**
 * Get geography codes from Census API
 * For now, we use the centroid-based approach
 */
export function getGeographyCodesFromCSV(
  lat: number,
  lng: number,
  radiusMiles: number
): { geography_codes: string[] } {
  const codes = getLSOACodesInRadius(lat, lng, radiusMiles);
  return { geography_codes: codes };
}
