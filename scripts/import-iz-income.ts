/**
 * Import Intermediate Zone Income Data for Scotland
 * Source: Scottish Government - Small Area Income Estimates for Scotland 2020
 * URL: https://www.gov.scot/publications/small-area-income-estimates-scotland-2020/
 *
 * REQUIRED CSV FORMAT:
 * - IZ Code (e.g., S02000001)
 * - IZ Name
 * - LA Code (Local Authority)
 * - LA Name
 * - Total Annual Income (£)
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

async function importIZIncome() {
  console.log('=== IZ Income Import ===\n');

  const csvPath = path.join(process.cwd(), 'apps/web/data/scottishcensus2022/iz_income_2020.csv');

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found at: ${csvPath}`);
    console.error('\nPlease download the file from:');
    console.error('https://www.gov.scot/publications/small-area-income-estimates-scotland-2020/');
    console.error('\nAnd save it as: apps/web/data/scottishcensus2022/iz_income_2020.csv');
    console.error('\nExpected CSV columns:');
    console.error('- IZ Code (or Intermediate Zone Code)');
    console.error('- IZ Name (or Intermediate Zone Name)');
    console.error('- LA Code (or Local Authority Code)');
    console.error('- LA Name (or Local Authority Name)');
    console.error('- Total Annual Income');
    process.exit(1);
  }

  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(fileContent, { columns: true, skip_empty_lines: true });

  console.log(`Loaded ${records.length} IZ income records`);

  // Detect column names (handle variations)
  const firstRow = records[0];
  const izCodeCol = Object.keys(firstRow).find(key =>
    key.toLowerCase().includes('iz code') || key.toLowerCase().includes('intermediate zone code')
  );
  const izNameCol = Object.keys(firstRow).find(key =>
    key.toLowerCase().includes('iz name') || key.toLowerCase().includes('intermediate zone name')
  );
  const laCodeCol = Object.keys(firstRow).find(key =>
    key.toLowerCase().includes('la code') || key.toLowerCase().includes('local authority code')
  );
  const laNameCol = Object.keys(firstRow).find(key =>
    key.toLowerCase().includes('la name') || key.toLowerCase().includes('local authority name')
  );
  const incomeCol = Object.keys(firstRow).find(key =>
    key.toLowerCase().includes('total annual income') || key.toLowerCase().includes('income')
  );

  if (!izCodeCol || !incomeCol) {
    console.error('Could not find required columns in CSV');
    console.error('Available columns:', Object.keys(firstRow));
    process.exit(1);
  }

  console.log(`Using columns: ${izCodeCol}, ${izNameCol}, ${incomeCol}`);

  const incomeData = records
    .filter((row: any) => row[izCodeCol] && row[izCodeCol].startsWith('S02')) // IZ codes start with S02
    .map((row: any) => ({
      iz_code: row[izCodeCol],
      iz_name: row[izNameCol] || row[izCodeCol],
      la_code: laCodeCol ? row[laCodeCol] : null,
      la_name: laNameCol ? row[laNameCol] : null,
      total_annual_income: parseFloat(row[incomeCol]?.replace(/,/g, '') || '0'),
      source_year: 2020,
    }));

  console.log(`Prepared ${incomeData.length} income records for import`);

  // Insert into database
  const { data, error } = await supabase
    .from('iz_income')
    .insert(incomeData);

  if (error) {
    console.error('Error inserting income data:', error);
    throw error;
  }

  console.log(`\n✓ Import complete: ${incomeData.length} IZ income records imported`);
}

importIZIncome().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
