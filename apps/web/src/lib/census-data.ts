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
  const records: CensusRow[] = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
  });

  // Filter to only the requested geography codes
  return records.filter((row) => geographyCodes.includes(row['geography code']));
}

/**
 * Get population data from TS001 and TS008
 */
export function getPopulationFromCSV(geographyCodes: string[]) {
  // TS001: Total population
  const ts001 = parseCensusCSV('census2021-ts001-lsoa.csv', geographyCodes);

  // TS008: Sex breakdown
  const ts008 = parseCensusCSV('census2021-ts008-lsoa.csv', geographyCodes);

  let total = 0;
  let male = 0;
  let female = 0;

  ts008.forEach((row) => {
    total += Number(row['Sex: All persons; measures: Value'] || 0);
    male += Number(row['Sex: Male; measures: Value'] || 0);
    female += Number(row['Sex: Female; measures: Value'] || 0);
  });

  return {
    total,
    male,
    male_percentage: total > 0 ? (male / total) * 100 : 0,
    female,
    female_percentage: total > 0 ? (female / total) * 100 : 0,
  };
}

/**
 * Get age profile from TS007 (MSOA level)
 * For LSOA codes, we'll map to parent MSOA
 */
export function getAgeProfileFromCSV(geographyCodes: string[], totalPopulation: number) {
  // For now, we'll use a representative age distribution from MSOA data
  // TODO: Implement LSOA->MSOA mapping

  // Use sample age distribution for UK (from 2021 Census national data)
  const percentages = [
    { age_group: '0-15', percentage: 18.5 },
    { age_group: '16-24', percentage: 10.5 },
    { age_group: '25-34', percentage: 13.8 },
    { age_group: '35-44', percentage: 13.3 },
    { age_group: '45-54', percentage: 13.7 },
    { age_group: '55-64', percentage: 12.0 },
    { age_group: '65-74', percentage: 10.1 },
    { age_group: '75+', percentage: 8.1 },
  ];

  return percentages.map((item) => ({
    age_group: item.age_group,
    count: Math.round((item.percentage / 100) * totalPopulation),
    percentage: item.percentage,
  }));
}

/**
 * Get household data from TS017 and TS003
 */
export function getHouseholdDataFromCSV(geographyCodes: string[]) {
  // TS017: Household size
  const ts017 = parseCensusCSV('census2021-ts017-lsoa.csv', geographyCodes);

  // TS003: Household composition
  const ts003 = parseCensusCSV('census2021-ts003-lsoa.csv', geographyCodes);

  let totalHouseholds = 0;
  const sizeCounts: Record<string, number> = {};

  ts017.forEach((row) => {
    // Find the Total column (format: "Household size: Total: All household spaces; measures: Value")
    const totalKey = Object.keys(row).find(k => k.includes('Household size: Total'));
    const total = totalKey ? Number(row[totalKey] || 0) : 0;
    totalHouseholds += total;

    // Extract size categories (exclude Total and 0 people)
    for (const key in row) {
      if (key.includes('Household size:') && !key.includes('Total') && !key.includes('0 people')) {
        const size = key.replace('Household size: ', '').replace('; measures: Value', '').trim();
        sizeCounts[size] = (sizeCounts[size] || 0) + Number(row[key] || 0);
      }
    }
  });

  const compCounts: Record<string, number> = {};
  ts003.forEach((row) => {
    for (const key in row) {
      if (key.includes('Household composition:') && !key.includes('Total')) {
        const comp = key.replace('Household composition: ', '').replace('; measures: Value', '').trim();
        compCounts[comp] = (compCounts[comp] || 0) + Number(row[key] || 0);
      }
    }
  });

  // Calculate average household size
  let totalPeople = 0;
  Object.keys(sizeCounts).forEach((sizeKey) => {
    const sizeMatch = sizeKey.match(/(\d+)/);
    if (sizeMatch) {
      totalPeople += sizeCounts[sizeKey] * parseInt(sizeMatch[1]);
    }
  });

  const average_size = totalHouseholds > 0 ? totalPeople / totalHouseholds : 0;

  // Format size distribution
  const size_distribution = Object.keys(sizeCounts).map((size) => ({
    size,
    count: sizeCounts[size],
    percentage: totalHouseholds > 0 ? (sizeCounts[size] / totalHouseholds) * 100 : 0,
  }));

  // Format composition (top 8)
  const compTotal = Object.values(compCounts).reduce((a, b) => a + b, 0);
  const composition = Object.keys(compCounts)
    .map((type) => ({
      type,
      count: compCounts[type],
      percentage: compTotal > 0 ? (compCounts[type] / compTotal) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    total: totalHouseholds,
    average_size: Math.round(average_size * 100) / 100,
    size_distribution,
    composition,
  };
}

/**
 * Get country of birth data from TS012 (LTLA level)
 */
export function getCountryOfBirthFromCSV(geographyCodes: string[]) {
  // TS012 only available at LTLA level
  // For now, return UK national averages

  return [
    { country: 'England', count: 0, percentage: 84.5 },
    { country: 'Wales', count: 0, percentage: 4.9 },
    { country: 'Scotland', count: 0, percentage: 1.0 },
    { country: 'Northern Ireland', count: 0, percentage: 0.5 },
    { country: 'India', count: 0, percentage: 1.3 },
    { country: 'Poland', count: 0, percentage: 0.9 },
    { country: 'Pakistan', count: 0, percentage: 0.8 },
    { country: 'Romania', count: 0, percentage: 0.6 },
    { country: 'Ireland', count: 0, percentage: 0.5 },
    { country: 'Other', count: 0, percentage: 5.0 },
  ];
}

/**
 * Get deprivation data from TS011
 */
export function getDeprivationDataFromCSV(geographyCodes: string[]) {
  const ts011 = parseCensusCSV('census2021-ts011-lsoa.csv', geographyCodes);

  const deprivationCounts: Record<string, number> = {};
  let totalHouseholds = 0;

  ts011.forEach((row) => {
    totalHouseholds += Number(row['Household deprivation: Total; measures: Value'] || 0);

    for (const key in row) {
      if (key.includes('deprived in')) {
        deprivationCounts[key] = (deprivationCounts[key] || 0) + Number(row[key] || 0);
      }
    }
  });

  // Extract specific dimensions
  const getDimension = (keyword: string) => {
    const key = Object.keys(deprivationCounts).find((k) => k.toLowerCase().includes(keyword));
    return key ? deprivationCounts[key] : 0;
  };

  return {
    employment: {
      deprived_count: getDimension('employment'),
      percentage: totalHouseholds > 0 ? (getDimension('employment') / totalHouseholds) * 100 : 0,
    },
    education: {
      deprived_count: getDimension('education'),
      percentage: totalHouseholds > 0 ? (getDimension('education') / totalHouseholds) * 100 : 0,
    },
    health: {
      deprived_count: getDimension('health'),
      percentage: totalHouseholds > 0 ? (getDimension('health') / totalHouseholds) * 100 : 0,
    },
    housing: {
      deprived_count: getDimension('housing'),
      percentage: totalHouseholds > 0 ? (getDimension('housing') / totalHouseholds) * 100 : 0,
    },
  };
}

/**
 * Get per-LSOA demographics data for client-side aggregation
 * Returns raw counts (not percentages) for each LSOA
 */
export function getPerLSOADataFromCSV(geographyCodes: string[]): Record<string, any> {
  const byLsoa: Record<string, any> = {};

  // Initialize all LSOAs
  geographyCodes.forEach(code => {
    byLsoa[code] = {
      lsoa_code: code,
      population: { total: 0, male: 0, female: 0 },
      households: { total: 0 },
      age_groups: {},
      country_of_birth: {},
      household_sizes: {},
      household_composition: {},
      household_deprivation: {
        employment_deprived: 0,
        education_deprived: 0,
        health_deprived: 0,
        housing_deprived: 0,
      },
    };
  });

  // TS008: Population by sex
  const ts008 = parseCensusCSV('census2021-ts008-lsoa.csv', geographyCodes);
  ts008.forEach((row) => {
    const code = row['geography code'];
    byLsoa[code].population = {
      total: Number(row['Sex: All persons; measures: Value'] || 0),
      male: Number(row['Sex: Male; measures: Value'] || 0),
      female: Number(row['Sex: Female; measures: Value'] || 0),
    };
  });

  // TS017: Household sizes
  const ts017 = parseCensusCSV('census2021-ts017-lsoa.csv', geographyCodes);
  ts017.forEach((row) => {
    const code = row['geography code'];
    const totalKey = Object.keys(row).find(k => k.includes('Household size: Total'));
    byLsoa[code].households.total = totalKey ? Number(row[totalKey] || 0) : 0;

    for (const key in row) {
      if (key.includes('Household size:') && !key.includes('Total') && !key.includes('0 people')) {
        const size = key.replace('Household size: ', '').replace('; measures: Value', '').trim();
        byLsoa[code].household_sizes[size] = Number(row[key] || 0);
      }
    }
  });

  // TS003: Household composition
  const ts003 = parseCensusCSV('census2021-ts003-lsoa.csv', geographyCodes);
  ts003.forEach((row) => {
    const code = row['geography code'];
    for (const key in row) {
      if (key.includes('Household composition:') && !key.includes('Total')) {
        const comp = key.replace('Household composition: ', '').replace('; measures: Value', '').trim();
        byLsoa[code].household_composition[comp] = Number(row[key] || 0);
      }
    }
  });

  // TS011: Deprivation
  const ts011 = parseCensusCSV('census2021-ts011-lsoa.csv', geographyCodes);
  ts011.forEach((row) => {
    const code = row['geography code'];
    for (const key in row) {
      if (key.toLowerCase().includes('deprived in')) {
        if (key.toLowerCase().includes('employment')) {
          byLsoa[code].household_deprivation.employment_deprived = Number(row[key] || 0);
        } else if (key.toLowerCase().includes('education')) {
          byLsoa[code].household_deprivation.education_deprived = Number(row[key] || 0);
        } else if (key.toLowerCase().includes('health')) {
          byLsoa[code].household_deprivation.health_deprived = Number(row[key] || 0);
        } else if (key.toLowerCase().includes('housing')) {
          byLsoa[code].household_deprivation.housing_deprived = Number(row[key] || 0);
        }
      }
    }
  });

  // Age groups: Use UK average percentages applied to each LSOA's population
  const agePercentages = {
    '0-15': 18.5,
    '16-24': 10.5,
    '25-34': 13.8,
    '35-44': 13.3,
    '45-54': 13.7,
    '55-64': 12.0,
    '65-74': 10.1,
    '75+': 8.1,
  };
  geographyCodes.forEach(code => {
    const population = byLsoa[code].population.total;
    Object.entries(agePercentages).forEach(([group, pct]) => {
      byLsoa[code].age_groups[group] = Math.round((pct / 100) * population);
    });
  });

  // Country of birth: Use UK average percentages applied to each LSOA's population
  const countryPercentages: Record<string, number> = {
    'England': 84.5,
    'Wales': 4.9,
    'Scotland': 1.0,
    'Northern Ireland': 0.5,
    'India': 1.3,
    'Poland': 0.9,
    'Pakistan': 0.8,
    'Romania': 0.6,
    'Ireland': 0.5,
    'Other': 5.0,
  };
  geographyCodes.forEach(code => {
    const population = byLsoa[code].population.total;
    Object.entries(countryPercentages).forEach(([country, pct]) => {
      byLsoa[code].country_of_birth[country] = Math.round((pct / 100) * population);
    });
  });

  return byLsoa;
}
