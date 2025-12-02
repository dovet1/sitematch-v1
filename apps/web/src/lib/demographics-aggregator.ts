import type {
  LSOADemographics,
  DemographicsResult,
  PopulationData,
  HouseholdData,
  AgeGroup,
  CountryData,
  HouseholdSizeData,
  HouseholdCompositionData,
  DeprivationData,
} from './types/demographics';

/**
 * Aggregates demographics data for a subset of selected LSOAs
 */
export function aggregateDemographics(
  byLsoa: Record<string, LSOADemographics>,
  selectedCodes: string[]
): DemographicsResult {
  const selectedData = selectedCodes
    .map(code => byLsoa[code])
    .filter(Boolean);

  if (selectedData.length === 0) {
    throw new Error('No LSOA data available for selected codes');
  }

  const population = aggregatePopulation(selectedData);
  const households = aggregateHouseholds(selectedData);
  const age_profile = aggregateAgeProfile(selectedData, population.total);
  const country_of_birth = aggregateCountryOfBirth(selectedData, population.total);
  const household_size = aggregateHouseholdSize(selectedData, households.total);
  const household_composition = aggregateHouseholdComposition(selectedData, households.total);
  const household_deprivation = aggregateHouseholdDeprivation(selectedData, households.total);

  return {
    query_info: {
      geography_codes: selectedCodes,
      total_population: population.total,
      area_covered_sq_km: 0, // Not recalculated client-side
    },
    population,
    households,
    age_profile,
    country_of_birth,
    household_size,
    household_composition,
    household_deprivation,
  };
}

function aggregatePopulation(data: LSOADemographics[]): PopulationData {
  const totals = data.reduce(
    (acc, lsoa) => ({
      total: acc.total + lsoa.population.total,
      male: acc.male + lsoa.population.male,
      female: acc.female + lsoa.population.female,
    }),
    { total: 0, male: 0, female: 0 }
  );

  return {
    ...totals,
    male_percentage: totals.total > 0 ? (totals.male / totals.total) * 100 : 0,
    female_percentage: totals.total > 0 ? (totals.female / totals.total) * 100 : 0,
  };
}

function aggregateHouseholds(data: LSOADemographics[]): HouseholdData {
  const totalPopulation = data.reduce((sum, lsoa) => sum + lsoa.population.total, 0);
  const totalHouseholds = data.reduce((sum, lsoa) => sum + lsoa.households.total, 0);

  return {
    total: totalHouseholds,
    average_size: totalHouseholds > 0 ? totalPopulation / totalHouseholds : 0,
  };
}

function aggregateAgeProfile(data: LSOADemographics[], totalPopulation: number): AgeGroup[] {
  const ageTotals: Record<string, number> = {};

  data.forEach(lsoa => {
    Object.entries(lsoa.age_groups).forEach(([group, count]) => {
      ageTotals[group] = (ageTotals[group] || 0) + count;
    });
  });

  return Object.entries(ageTotals)
    .map(([age_group, count]) => ({
      age_group,
      count,
      percentage: totalPopulation > 0 ? (count / totalPopulation) * 100 : 0,
    }))
    .sort((a, b) => {
      // Sort by age group order
      const order = ['0-15', '16-29', '30-44', '45-64', '65+'];
      return order.indexOf(a.age_group) - order.indexOf(b.age_group);
    });
}

function aggregateCountryOfBirth(data: LSOADemographics[], totalPopulation: number): CountryData[] {
  const countryTotals: Record<string, number> = {};

  data.forEach(lsoa => {
    Object.entries(lsoa.country_of_birth).forEach(([country, count]) => {
      countryTotals[country] = (countryTotals[country] || 0) + count;
    });
  });

  return Object.entries(countryTotals)
    .map(([country, count]) => ({
      country,
      count,
      percentage: totalPopulation > 0 ? (count / totalPopulation) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count); // Sort by count descending
}

function aggregateHouseholdSize(data: LSOADemographics[], totalHouseholds: number): HouseholdSizeData[] {
  const sizeTotals: Record<string, number> = {};

  data.forEach(lsoa => {
    Object.entries(lsoa.household_sizes).forEach(([size, count]) => {
      sizeTotals[size] = (sizeTotals[size] || 0) + count;
    });
  });

  return Object.entries(sizeTotals)
    .map(([size, count]) => ({
      size,
      count,
      percentage: totalHouseholds > 0 ? (count / totalHouseholds) * 100 : 0,
    }))
    .sort((a, b) => {
      // Sort by household size
      const sizeA = parseInt(a.size.match(/\d+/)?.[0] || '0');
      const sizeB = parseInt(b.size.match(/\d+/)?.[0] || '0');
      return sizeA - sizeB;
    });
}

function aggregateHouseholdComposition(data: LSOADemographics[], totalHouseholds: number): HouseholdCompositionData[] {
  const compTotals: Record<string, number> = {};

  data.forEach(lsoa => {
    Object.entries(lsoa.household_composition).forEach(([type, count]) => {
      compTotals[type] = (compTotals[type] || 0) + count;
    });
  });

  return Object.entries(compTotals)
    .map(([type, count]) => ({
      type,
      count,
      percentage: totalHouseholds > 0 ? (count / totalHouseholds) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count); // Sort by count descending
}

function aggregateHouseholdDeprivation(data: LSOADemographics[], totalHouseholds: number): DeprivationData {
  const deprivation = data.reduce(
    (acc, lsoa) => ({
      employment: acc.employment + lsoa.household_deprivation.employment_deprived,
      education: acc.education + lsoa.household_deprivation.education_deprived,
      health: acc.health + lsoa.household_deprivation.health_deprived,
      housing: acc.housing + lsoa.household_deprivation.housing_deprived,
    }),
    { employment: 0, education: 0, health: 0, housing: 0 }
  );

  return {
    employment: {
      deprived_count: deprivation.employment,
      percentage: totalHouseholds > 0 ? (deprivation.employment / totalHouseholds) * 100 : 0,
    },
    education: {
      deprived_count: deprivation.education,
      percentage: totalHouseholds > 0 ? (deprivation.education / totalHouseholds) * 100 : 0,
    },
    health: {
      deprived_count: deprivation.health,
      percentage: totalHouseholds > 0 ? (deprivation.health / totalHouseholds) * 100 : 0,
    },
    housing: {
      deprived_count: deprivation.housing,
      percentage: totalHouseholds > 0 ? (deprivation.housing / totalHouseholds) * 100 : 0,
    },
  };
}
