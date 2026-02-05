/**
 * Calculate Affluence Scores for Scottish Data Zones (Census-Only Version)
 *
 * This version uses only census data (no income blending) to calculate affluence scores.
 * Replicates the England/Wales methodology using 6 census indicators:
 *
 * 1. Employment rate (25% weight) - economically active excluding students
 * 2. High-skill occupations (20%) - managers + professionals + associate professionals
 * 3. Degree qualifications (20%) - level 4+ qualifications
 * 4. Owner-occupied housing (15%) - owned + mortgaged
 * 5. Good health (10%) - very good + good health
 * 6. Detached/semi-detached homes (10%)
 *
 * Formula: 50 + weighted sum of deviations from Scotland averages
 * Result: 0-100 scale, converted to percentiles within Scotland
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface DataZoneMetric {
  geo_code: string;
  geo_name: string;
  component_id: string;
  value_pct: number;
}

interface AffluenceScore {
  geo_code: string;
  geo_name: string;
  raw_score: number;
  affluence_score_100: number;
  affluence_score_with_income: number; // Same as affluence_score_100 for census-only
  category: string;
}

/**
 * Fetch all Data Zone metrics needed for affluence calculation
 */
async function fetchAffluenceMetrics(): Promise<Map<string, Map<string, number>>> {
  console.log('Fetching affluence-related metrics from database...');

  const requiredComponents = [
    // Employment (economically active excluding students)
    'economically_economically_active_excluding_full_time_students_total',

    // Occupations (managers, professionals, associate professionals)
    'managers_directors_and_senior_officials',
    'professional_occupations',
    'associate_professional_and_technical_occupations',

    // Qualifications (level 4+ = degree level)
    'degree_level_qualifications_or_above',

    // Tenure (owned, mortgaged)
    'owned_owned_outright',
    'owned_owned_with_a_mortgage_or_loan',

    // Health (very good, good)
    'very_good',
    'good',

    // Accommodation (detached, semi-detached)
    'accom_whole_house_or_bungalow_detached',
    'accom_whole_house_or_bungalow_semi_detached',
  ];

  // Fetch in batches due to Supabase limits
  let allData: DataZoneMetric[] = [];
  const BATCH_SIZE = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('data_zone_metrics')
      .select('geo_code, geo_name, component_id, value_pct')
      .in('component_id', requiredComponents)
      .eq('edition', '2022')
      .not('value_pct', 'is', null)
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error('Error fetching metrics:', error);
      throw new Error(`Failed to fetch metrics: ${error.message}`);
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allData = allData.concat(data as DataZoneMetric[]);
      offset += BATCH_SIZE;
      console.log(`Fetched ${allData.length} records so far...`);

      if (data.length < BATCH_SIZE) {
        hasMore = false;
      }
    }
  }

  console.log(`Fetched ${allData.length} metric records total`);

  // Organize by Data Zone code
  const dzMetrics = new Map<string, Map<string, number>>();

  allData.forEach((row: DataZoneMetric) => {
    if (!dzMetrics.has(row.geo_code)) {
      dzMetrics.set(row.geo_code, new Map());
    }
    dzMetrics.get(row.geo_code)!.set(row.component_id, row.value_pct);
  });

  console.log(`Organized metrics for ${dzMetrics.size} Data Zones`);
  return dzMetrics;
}

/**
 * Calculate Scotland national averages for each component
 */
function calculateNationalAverages(dzMetrics: Map<string, Map<string, number>>): Map<string, number> {
  console.log('Calculating Scotland national averages...');

  const componentSums = new Map<string, number>();
  const componentCounts = new Map<string, number>();

  dzMetrics.forEach((metrics) => {
    metrics.forEach((value, componentId) => {
      componentSums.set(componentId, (componentSums.get(componentId) || 0) + value);
      componentCounts.set(componentId, (componentCounts.get(componentId) || 0) + 1);
    });
  });

  const nationalAverages = new Map<string, number>();
  componentSums.forEach((sum, componentId) => {
    const count = componentCounts.get(componentId) || 1;
    nationalAverages.set(componentId, sum / count);
  });

  console.log('National averages calculated:');
  nationalAverages.forEach((avg, componentId) => {
    console.log(`  ${componentId}: ${avg.toFixed(2)}%`);
  });

  return nationalAverages;
}

/**
 * Calculate raw affluence score for a Data Zone
 */
function calculateRawScore(
  metrics: Map<string, number>,
  nationalAverages: Map<string, number>
): number {
  // Get component values (with fallback to 0 if missing)
  const employmentRate = metrics.get('economically_economically_active_excluding_full_time_students_total') || 0;

  const managers = metrics.get('managers_directors_and_senior_officials') || 0;
  const professionals = metrics.get('professional_occupations') || 0;
  const associateProfessionals = metrics.get('associate_professional_and_technical_occupations') || 0;
  const highSkillOccupations = managers + professionals + associateProfessionals;

  const degreeQualifications = metrics.get('degree_level_qualifications_or_above') || 0;

  const ownedOutright = metrics.get('owned_owned_outright') || 0;
  const ownedMortgage = metrics.get('owned_owned_with_a_mortgage_or_loan') || 0;
  const ownerOccupied = ownedOutright + ownedMortgage;

  const veryGoodHealth = metrics.get('very_good') || 0;
  const goodHealth = metrics.get('good') || 0;
  const goodHealthTotal = veryGoodHealth + goodHealth;

  const detached = metrics.get('accom_whole_house_or_bungalow_detached') || 0;
  const semiDetached = metrics.get('accom_whole_house_or_bungalow_semi_detached') || 0;
  const detachedSemiDetached = detached + semiDetached;

  // Get national averages
  const natEmployment = nationalAverages.get('economically_economically_active_excluding_full_time_students_total') || 50;

  const natManagers = nationalAverages.get('managers_directors_and_senior_officials') || 0;
  const natProfessionals = nationalAverages.get('professional_occupations') || 0;
  const natAssociateProfessionals = nationalAverages.get('associate_professional_and_technical_occupations') || 0;
  const natHighSkillOccupations = natManagers + natProfessionals + natAssociateProfessionals;

  const natDegreeQualifications = nationalAverages.get('degree_level_qualifications_or_above') || 20;

  const natOwnedOutright = nationalAverages.get('owned_owned_outright') || 0;
  const natOwnedMortgage = nationalAverages.get('owned_owned_with_a_mortgage_or_loan') || 0;
  const natOwnerOccupied = natOwnedOutright + natOwnedMortgage;

  const natVeryGoodHealth = nationalAverages.get('very_good') || 0;
  const natGoodHealth = nationalAverages.get('good') || 0;
  const natGoodHealthTotal = natVeryGoodHealth + natGoodHealth;

  const natDetached = nationalAverages.get('accom_whole_house_or_bungalow_detached') || 0;
  const natSemiDetached = nationalAverages.get('accom_whole_house_or_bungalow_semi_detached') || 0;
  const natDetachedSemiDetached = natDetached + natSemiDetached;

  // Calculate deviations from national averages
  const employmentDeviation = employmentRate - natEmployment;
  const occupationDeviation = highSkillOccupations - natHighSkillOccupations;
  const qualificationDeviation = degreeQualifications - natDegreeQualifications;
  const tenureDeviation = ownerOccupied - natOwnerOccupied;
  const healthDeviation = goodHealthTotal - natGoodHealthTotal;
  const accommodationDeviation = detachedSemiDetached - natDetachedSemiDetached;

  // Apply weights and calculate score
  const weightedScore =
    0.25 * employmentDeviation +
    0.20 * occupationDeviation +
    0.20 * qualificationDeviation +
    0.15 * tenureDeviation +
    0.10 * healthDeviation +
    0.10 * accommodationDeviation;

  // Base of 50 + weighted score, clamped to [0, 100]
  const rawScore = Math.max(0, Math.min(100, 50 + weightedScore));

  return rawScore;
}

/**
 * Convert score to category (A-E)
 */
function scoreToCategory(score: number): string {
  if (score >= 70) return 'A';
  if (score >= 55) return 'B';
  if (score >= 40) return 'C';
  if (score >= 25) return 'D';
  return 'E';
}

/**
 * Main calculation function
 */
async function calculateAffluenceScores() {
  console.log('=== Scottish Affluence Score Calculation (Census-Only) ===\n');

  // Step 1: Fetch metrics
  const dzMetrics = await fetchAffluenceMetrics();

  // Step 2: Calculate national averages
  const nationalAverages = calculateNationalAverages(dzMetrics);

  // Step 3: Calculate raw scores for each Data Zone
  console.log('\nCalculating raw affluence scores...');
  const rawScores: Array<{ geo_code: string; geo_name: string; raw_score: number }> = [];

  // Get Data Zone names from first metric
  const dzNames = new Map<string, string>();
  const { data: nameData } = await supabase
    .from('data_zone_metrics')
    .select('geo_code, geo_name')
    .eq('edition', '2022')
    .limit(10000);

  nameData?.forEach((row: any) => {
    if (!dzNames.has(row.geo_code)) {
      dzNames.set(row.geo_code, row.geo_name || row.geo_code);
    }
  });

  dzMetrics.forEach((metrics, geoCode) => {
    const rawScore = calculateRawScore(metrics, nationalAverages);
    rawScores.push({
      geo_code: geoCode,
      geo_name: dzNames.get(geoCode) || geoCode,
      raw_score: rawScore,
    });
  });

  console.log(`Calculated ${rawScores.length} raw scores`);

  // Step 4: Convert to percentiles (rank within Scotland)
  console.log('Converting to percentiles...');
  const sortedScores = [...rawScores].sort((a, b) => a.raw_score - b.raw_score);

  const affluenceScores: AffluenceScore[] = sortedScores.map((score, index) => {
    const percentile = (index / sortedScores.length) * 100;
    return {
      geo_code: score.geo_code,
      geo_name: score.geo_name,
      raw_score: score.raw_score,
      affluence_score_100: percentile,
      affluence_score_with_income: percentile, // Same as census-only for now
      category: scoreToCategory(percentile),
    };
  });

  console.log('Score distribution:');
  console.log(`  Category A (70-100): ${affluenceScores.filter(s => s.category === 'A').length}`);
  console.log(`  Category B (55-69): ${affluenceScores.filter(s => s.category === 'B').length}`);
  console.log(`  Category C (40-54): ${affluenceScores.filter(s => s.category === 'C').length}`);
  console.log(`  Category D (25-39): ${affluenceScores.filter(s => s.category === 'D').length}`);
  console.log(`  Category E (0-24): ${affluenceScores.filter(s => s.category === 'E').length}`);

  // Step 5: Insert into database
  console.log('\nInserting affluence scores into database...');

  const BATCH_SIZE = 1000;
  for (let i = 0; i < affluenceScores.length; i += BATCH_SIZE) {
    const batch = affluenceScores.slice(i, i + BATCH_SIZE);

    const { error } = await supabase
      .from('data_zone_affluence_scores')
      .insert(batch);

    if (error) {
      console.error(`Error inserting batch ${i}-${i + batch.length}:`, error);
      throw error;
    }

    console.log(`Inserted ${Math.min(i + BATCH_SIZE, affluenceScores.length)}/${affluenceScores.length}`);
  }

  console.log('\n✓ Affluence calculation complete!');
  console.log(`\nTotal Data Zones: ${affluenceScores.length}`);
  console.log(`Average raw score: ${(rawScores.reduce((sum, s) => sum + s.raw_score, 0) / rawScores.length).toFixed(2)}`);
  console.log(`Min raw score: ${Math.min(...rawScores.map(s => s.raw_score)).toFixed(2)}`);
  console.log(`Max raw score: ${Math.max(...rawScores.map(s => s.raw_score)).toFixed(2)}`);
}

calculateAffluenceScores().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
