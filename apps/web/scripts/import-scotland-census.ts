/**
 * Import Scotland's Census 2022 into lsoa_metrics, with 2022 data zones standing in for LSOAs.
 *
 * Run from apps/web:
 *   npm run import:scotland-census -- /absolute/path/to/datazone2022 /absolute/path/to/dz2022_lookup.csv
 *
 * The first path is the unzipped "2022 data zone area data" download (Datazone2022.zip) from
 * https://www.scotlandscensus.gov.uk/documents/2022-data-zone-area-data. The lookup is the
 * 2022 Data Zone Lookup from https://data.gov.scot/dataset/2022_data_zone_lookup, for names.
 *
 * Rows are upserted on (geo_code, component_id, edition), so re-running is safe. Then apply
 * supabase/migrations/20261107000000_scotland_census_2022.sql and run the rebuilds it lists.
 */

import fs from 'node:fs'
import path from 'node:path'
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import {
  SCOTLAND_EDITION,
  SCOTLAND_MAPPING_NOTES,
  buildScotlandMetrics,
  readDataZoneNames,
} from './lib/scotland-census-2022'

loadEnvConfig(process.cwd())

const tablesDir = process.argv[2] ? path.resolve(process.argv[2]) : ''
const lookupCsv = process.argv[3] ? path.resolve(process.argv[3]) : ''
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!tablesDir || !fs.existsSync(tablesDir) || !lookupCsv || !fs.existsSync(lookupCsv)) {
  console.error('Provide the unzipped Datazone2022 folder and the 2022 data zone lookup CSV.')
  process.exit(1)
}
if (!supabaseUrl || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const BATCH_SIZE = 2000

async function main() {
  const names = readDataZoneNames(lookupCsv)
  const rows = buildScotlandMetrics(tablesDir, names)
  const zones = new Set(rows.map((r) => r.geo_code))
  console.info(`Mapped ${rows.length.toLocaleString()} metrics for ${zones.size.toLocaleString()} data zones.`)
  if (zones.size !== names.size) {
    throw new Error(`Expected ${names.size} data zones from the lookup, found ${zones.size} in the tables.`)
  }

  const calcDate = new Date().toISOString()
  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batch = rows.slice(offset, offset + BATCH_SIZE).map((r) => ({
      ...r,
      edition: SCOTLAND_EDITION,
      calc_date: calcDate,
    }))
    const { error } = await supabase
      .from('lsoa_metrics')
      .upsert(batch, { onConflict: 'geo_code,component_id,edition' })
    if (error) throw new Error(error.message)
    if ((offset / BATCH_SIZE) % 25 === 0) {
      console.info(`Upserted ${(offset + batch.length).toLocaleString()} / ${rows.length.toLocaleString()}…`)
    }
  }

  console.info('Scotland census import complete. Mapping notes:')
  for (const note of SCOTLAND_MAPPING_NOTES) console.info(`  - ${note}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
