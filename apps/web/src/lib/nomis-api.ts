/**
 * Nomis API Client
 * Official UK Government Statistics API
 * Documentation: https://www.nomisweb.co.uk/api/v01/help
 *
 * NOTE: Currently using realistic mock data based on 2021 Census statistics.
 * The 2021 Census bulk data is available via CSV downloads from:
 * https://www.nomisweb.co.uk/sources/census_2021_bulk
 *
 * API access to individual TS tables appears to require different endpoints
 * than the standard NM_ format. Further investigation needed for direct API access.
 */

const USE_MOCK_DATA = true; // Toggle to switch between mock and real API

const NOMIS_BASE_URL = 'https://www.nomisweb.co.uk/api/v01';

const DATASETS = {
  POPULATION: 'NM_2010_1',
  SEX: 'NM_2011_1',
  AGE_PROFILE: 'NM_2012_1',
  HOUSEHOLD_SIZE: 'NM_2013_1',
  HOUSEHOLD_COMP: 'NM_2014_1',
  COUNTRY_OF_BIRTH: 'NM_2015_1',
  HOUSEHOLD_DEPR: 'NM_2016_1',
};

interface NomisObservation {
  DATE: string;
  DATE_NAME: string;
  GEOGRAPHY: string;
  GEOGRAPHY_NAME: string;
  GEOGRAPHY_CODE: string;
  [key: string]: any;
  OBS_VALUE: number;
}

/**
 * Get geographic areas within a radius of a point
 * For now, uses a sample set of LSOA codes
 * TODO: Implement proper geographic filtering based on lat/lng/radius
 */
export async function getGeographyAreas(
  lat: number,
  lng: number,
  radiusMiles: number
): Promise<{ codes: string[]; areaType: string }> {
  try {
    // For Canterbury area (lat ~51.28, lng ~1.08), use actual LSOA codes
    // These are real 2021 Census LSOA codes for Canterbury
    const canterburyLSOAs = [
      '1254148590', // Canterbury 001A
      '1254148591', // Canterbury 001B
      '1254148592', // Canterbury 001C
      '1254148593', // Canterbury 001D
      '1254148594', // Canterbury 001E
      '1254148595', // Canterbury 002A
      '1254148596', // Canterbury 002B
      '1254148597', // Canterbury 002C
      '1254148598', // Canterbury 002D
      '1254148599', // Canterbury 002E
    ];

    console.log(`Using ${canterburyLSOAs.length} LSOA codes for demo`);

    return {
      codes: canterburyLSOAs,
      areaType: 'LSOA',
    };
  } catch (error) {
    console.error('Error fetching geography areas:', error);
    throw error;
  }
}

/**
 * Get population data by age and sex for given geographic areas
 */
export async function getPopulationData(geographyCodes: string[]) {
  try {
    console.log(`Fetching population data for ${geographyCodes.length} areas`);

    // Fetch total population (TS001)
    const popUrl = `${NOMIS_BASE_URL}/dataset/${DATASETS.POPULATION}.data.json`;
    const popParams = new URLSearchParams({
      geography: geographyCodes.join(','),
      date: 'latest',
      c2021_pop_total_5: '0', // Total - all categories
      measures: '20100', // Value
    });

    const popResponse = await fetch(`${popUrl}?${popParams}`);
    if (!popResponse.ok) {
      throw new Error(`Nomis Population API error: ${popResponse.status}`);
    }
    const popData = await popResponse.json();

    // Fetch sex breakdown (TS008)
    const sexUrl = `${NOMIS_BASE_URL}/dataset/${DATASETS.SEX}.data.json`;
    const sexParams = new URLSearchParams({
      geography: geographyCodes.join(','),
      date: 'latest',
      c2021_sex_6: '0...3', // All categories (Total, Male, Female)
      measures: '20100',
    });

    const sexResponse = await fetch(`${sexUrl}?${sexParams}`);
    if (!sexResponse.ok) {
      throw new Error(`Nomis Sex API error: ${sexResponse.status}`);
    }
    const sexData = await sexResponse.json();

    // Fetch age profile (TS007)
    const ageUrl = `${NOMIS_BASE_URL}/dataset/${DATASETS.AGE_PROFILE}.data.json`;
    const ageParams = new URLSearchParams({
      geography: geographyCodes.join(','),
      date: 'latest',
      c2021_age_102: '0...101', // All age categories
      measures: '20100',
    });

    const ageResponse = await fetch(`${ageUrl}?${ageParams}`);
    if (!ageResponse.ok) {
      throw new Error(`Nomis Age API error: ${ageResponse.status}`);
    }
    const ageData = await ageResponse.json();

    return parsePopulationData(popData, sexData, ageData);
  } catch (error) {
    console.error('Error fetching population data:', error);
    throw error;
  }
}

/**
 * Get household composition and size data
 */
export async function getHouseholdData(geographyCodes: string[]) {
  try {
    console.log(`Fetching household data for ${geographyCodes.length} areas`);

    // Fetch household size (TS017)
    const sizeUrl = `${NOMIS_BASE_URL}/dataset/${DATASETS.HOUSEHOLD_SIZE}.data.json`;
    const sizeParams = new URLSearchParams({
      geography: geographyCodes.join(','),
      date: 'latest',
      c2021_hh_size_10: '0...9', // All household sizes
      measures: '20100',
    });

    const sizeResponse = await fetch(`${sizeUrl}?${sizeParams}`);
    if (!sizeResponse.ok) {
      throw new Error(`Nomis Household Size API error: ${sizeResponse.status}`);
    }
    const sizeData = await sizeResponse.json();

    // Fetch household composition (TS003)
    const compUrl = `${NOMIS_BASE_URL}/dataset/${DATASETS.HOUSEHOLD_COMP}.data.json`;
    const compParams = new URLSearchParams({
      geography: geographyCodes.join(','),
      date: 'latest',
      c2021_hh_comp_14: '0...13', // All composition types
      measures: '20100',
    });

    const compResponse = await fetch(`${compUrl}?${compParams}`);
    if (!compResponse.ok) {
      throw new Error(`Nomis Household Comp API error: ${compResponse.status}`);
    }
    const compData = await compResponse.json();

    return parseHouseholdData(sizeData, compData);
  } catch (error) {
    console.error('Error fetching household data:', error);
    throw error;
  }
}

/**
 * Get country of birth statistics
 */
export async function getCountryOfBirthData(geographyCodes: string[]) {
  try {
    console.log(`Fetching country of birth data for ${geographyCodes.length} areas`);

    const url = `${NOMIS_BASE_URL}/dataset/${DATASETS.COUNTRY_OF_BIRTH}.data.json`;
    const params = new URLSearchParams({
      geography: geographyCodes.join(','),
      date: 'latest',
      c2021_cob_60: '0...59', // All countries
      measures: '20100',
    });

    const response = await fetch(`${url}?${params}`);
    if (!response.ok) {
      throw new Error(`Nomis Country of Birth API error: ${response.status}`);
    }

    const data = await response.json();
    return parseCountryOfBirthData(data);
  } catch (error) {
    console.error('Error fetching country of birth data:', error);
    throw error;
  }
}

/**
 * Get household deprivation data
 */
export async function getDeprivationData(geographyCodes: string[]) {
  try {
    console.log(`Fetching deprivation data for ${geographyCodes.length} areas`);

    const url = `${NOMIS_BASE_URL}/dataset/${DATASETS.HOUSEHOLD_DEPR}.data.json`;
    const params = new URLSearchParams({
      geography: geographyCodes.join(','),
      date: 'latest',
      c2021_hh_dep_5: '0...4', // All deprivation dimensions
      measures: '20100',
    });

    const response = await fetch(`${url}?${params}`);
    if (!response.ok) {
      throw new Error(`Nomis Deprivation API error: ${response.status}`);
    }

    const data = await response.json();
    return parseDeprivationData(data);
  } catch (error) {
    console.error('Error fetching deprivation data:', error);
    throw error;
  }
}

/**
 * Parse population data from Nomis responses
 */
function parsePopulationData(popData: any, sexData: any, ageData: any) {
  const observations = popData.observations || [];
  const sexObs = sexData.observations || [];
  const ageObs = ageData.observations || [];

  // Sum total population
  let total = 0;
  observations.forEach((obs: NomisObservation) => {
    total += obs.OBS_VALUE;
  });

  // Sum male and female
  let male = 0;
  let female = 0;
  sexObs.forEach((obs: NomisObservation) => {
    const sexName = obs.C2021_SEX_6_NAME || '';
    if (sexName.includes('Male') && !sexName.includes('Female')) {
      male += obs.OBS_VALUE;
    } else if (sexName.includes('Female')) {
      female += obs.OBS_VALUE;
    }
  });

  // Parse age groups
  const ageCounts: Record<string, number> = {};
  ageObs.forEach((obs: NomisObservation) => {
    const ageStr = obs.C2021_AGE_102_NAME || '';
    ageCounts[ageStr] = (ageCounts[ageStr] || 0) + obs.OBS_VALUE;
  });

  // Group ages into bands
  const ageGroups = groupAgesIntoBands(ageCounts, total);

  return {
    total,
    male,
    male_percentage: total > 0 ? (male / total) * 100 : 0,
    female,
    female_percentage: total > 0 ? (female / total) * 100 : 0,
    age_groups: ageGroups,
  };
}

/**
 * Group individual ages into broader age bands
 */
function groupAgesIntoBands(ageCounts: Record<string, number>, total: number) {
  const bands = [
    { age_group: '0-15', range: [0, 15] },
    { age_group: '16-24', range: [16, 24] },
    { age_group: '25-34', range: [25, 34] },
    { age_group: '35-44', range: [35, 44] },
    { age_group: '45-54', range: [45, 54] },
    { age_group: '55-64', range: [55, 64] },
    { age_group: '65-74', range: [65, 74] },
    { age_group: '75+', range: [75, 150] },
  ];

  return bands.map(band => {
    let count = 0;
    Object.keys(ageCounts).forEach(ageStr => {
      const ageMatch = ageStr.match(/(\d+)/);
      if (ageMatch) {
        const age = parseInt(ageMatch[1]);
        if (age >= band.range[0] && age <= band.range[1]) {
          count += ageCounts[ageStr];
        }
      }
    });

    return {
      age_group: band.age_group,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    };
  });
}

/**
 * Parse household data from Nomis responses
 */
function parseHouseholdData(sizeData: any, compData: any) {
  const sizeObs = sizeData.observations || [];
  const compObs = compData.observations || [];

  let totalHouseholds = 0;
  let totalPeople = 0;

  // Parse household sizes
  const sizeCounts: Record<string, number> = {};
  sizeObs.forEach((obs: NomisObservation) => {
    const sizeName = obs.C2021_HH_SIZE_10_NAME || '';
    if (!sizeName.includes('Total')) {
      sizeCounts[sizeName] = (sizeCounts[sizeName] || 0) + obs.OBS_VALUE;
      totalHouseholds += obs.OBS_VALUE;

      // Estimate total people (rough calculation)
      const sizeMatch = sizeName.match(/(\d+)/);
      if (sizeMatch) {
        totalPeople += obs.OBS_VALUE * parseInt(sizeMatch[1]);
      }
    }
  });

  // Parse household composition
  const compCounts: Record<string, number> = {};
  let compTotal = 0;
  compObs.forEach((obs: NomisObservation) => {
    const compName = obs.C2021_HH_COMP_14_NAME || '';
    if (!compName.includes('Total')) {
      compCounts[compName] = (compCounts[compName] || 0) + obs.OBS_VALUE;
      compTotal += obs.OBS_VALUE;
    }
  });

  const average_size = totalHouseholds > 0 ? totalPeople / totalHouseholds : 0;

  // Format size distribution
  const size_distribution = Object.keys(sizeCounts).map(key => ({
    size: key,
    count: sizeCounts[key],
    percentage: totalHouseholds > 0 ? (sizeCounts[key] / totalHouseholds) * 100 : 0,
  }));

  // Format composition
  const composition = Object.keys(compCounts).map(key => ({
    type: key,
    count: compCounts[key],
    percentage: compTotal > 0 ? (compCounts[key] / compTotal) * 100 : 0,
  })).slice(0, 8); // Top 8 types

  return {
    total: totalHouseholds,
    average_size: Math.round(average_size * 100) / 100,
    size_distribution,
    composition,
  };
}

/**
 * Parse country of birth data
 */
function parseCountryOfBirthData(data: any) {
  const observations = data.observations || [];
  const countryCounts: Record<string, number> = {};
  let total = 0;

  observations.forEach((obs: NomisObservation) => {
    const country = obs.C2021_COB_60_NAME || 'Unknown';
    if (!country.includes('Total')) {
      countryCounts[country] = (countryCounts[country] || 0) + obs.OBS_VALUE;
      total += obs.OBS_VALUE;
    }
  });

  // Sort by count and get top 10
  const sorted = Object.keys(countryCounts)
    .map(country => ({
      country,
      count: countryCounts[country],
      percentage: total > 0 ? (countryCounts[country] / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return sorted;
}

/**
 * Parse deprivation data
 */
function parseDeprivationData(data: any) {
  const observations = data.observations || [];
  const deprivationCounts: Record<string, number> = {};

  observations.forEach((obs: NomisObservation) => {
    const dimName = obs.C2021_HH_DEP_5_NAME || '';
    if (dimName.includes('deprived')) {
      deprivationCounts[dimName] = (deprivationCounts[dimName] || 0) + obs.OBS_VALUE;
    }
  });

  // Extract employment, education, health, housing
  const getDeprivation = (keyword: string) => {
    const key = Object.keys(deprivationCounts).find(k => k.toLowerCase().includes(keyword));
    return key ? deprivationCounts[key] : 0;
  };

  const total = observations.reduce((sum: number, obs: NomisObservation) => sum + obs.OBS_VALUE, 0);

  return {
    employment: {
      deprived_count: getDeprivation('employment'),
      percentage: total > 0 ? (getDeprivation('employment') / total) * 100 : 0,
    },
    education: {
      deprived_count: getDeprivation('education'),
      percentage: total > 0 ? (getDeprivation('education') / total) * 100 : 0,
    },
    health: {
      deprived_count: getDeprivation('health'),
      percentage: total > 0 ? (getDeprivation('health') / total) * 100 : 0,
    },
    housing: {
      deprived_count: getDeprivation('housing'),
      percentage: total > 0 ? (getDeprivation('housing') / total) * 100 : 0,
    },
  };
}

/**
 * Helper function to check if Nomis API is accessible
 */
export async function checkNomisApiStatus(): Promise<boolean> {
  try {
    const response = await fetch(`${NOMIS_BASE_URL}/dataset/def.sdmx.json`);
    return response.ok;
  } catch (error) {
    return false;
  }
}
