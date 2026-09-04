/**
 * Import the GeoDS v4 retail-centre export into Find Gaps.
 *
 * The published GeoPackage/GeoParquet is WGS84. Convert either format first:
 *   ogr2ogr -f GeoJSON /tmp/geods-retail-centres.geojson source.gpkg -t_srs EPSG:4326
 *
 * Run from apps/web:
 *   npm run import:retail-centres -- --file /tmp/geods-retail-centres.geojson \
 *     --version 4.0 --vintage 2025-11
 *
 * Re-running is safe: centres and geometries upsert on RC_ID. Summary tables
 * rebuild only after every source feature imports successfully.
 */

import fs from 'node:fs'
import path from 'node:path'
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'

loadEnvConfig(process.cwd())

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const input = arg('file') ? path.resolve(arg('file') as string) : ''
const version = arg('version') ?? '4.0'
const vintage = arg('vintage') ?? null
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!input || !fs.existsSync(input)) {
  console.error('Provide --file /absolute/path/to/geods-retail-centres.geojson')
  process.exit(1)
}
if (!supabaseUrl || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const REQUIRED_PROPERTIES = [
  'RC_ID',
  'RC_Name',
  'Classification',
  'Country',
  'Region_NM',
  'H3_count',
  'Retail_N',
  'Area_km2',
] as const

function validateFeature(feature: GeoJSON.Feature, index: number): void {
  if (!feature.geometry || !['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) {
    throw new Error(`Feature ${index + 1} is not a Polygon or MultiPolygon`)
  }
  const properties = feature.properties ?? {}
  for (const key of REQUIRED_PROPERTIES) {
    if (!(key in properties)) throw new Error(`Feature ${index + 1} is missing ${key}`)
  }
}

async function main() {
  const collection = JSON.parse(fs.readFileSync(input, 'utf8')) as GeoJSON.FeatureCollection
  if (collection.type !== 'FeatureCollection' || !Array.isArray(collection.features)) {
    throw new Error('Input must be a GeoJSON FeatureCollection')
  }

  const ids = new Set<string>()
  collection.features.forEach((feature, index) => {
    validateFeature(feature, index)
    const id = String(feature.properties?.RC_ID ?? '')
    if (ids.has(id)) throw new Error(`Duplicate RC_ID in source: ${id}`)
    ids.add(id)
  })

  console.info(`Importing ${collection.features.length.toLocaleString()} GeoDS retail centres…`)
  const batchSize = 250
  let imported = 0
  for (let offset = 0; offset < collection.features.length; offset += batchSize) {
    const batch = collection.features.slice(offset, offset + batchSize)
    const { data, error } = await supabase.rpc('import_retail_centres', {
      p_features: batch,
      p_source_version: version,
      p_source_vintage: vintage,
    })
    if (error) throw new Error(`Import failed at row ${offset + 1}: ${error.message}`)
    imported += typeof data === 'number' ? data : batch.length
    console.info(`  ${imported.toLocaleString()} / ${collection.features.length.toLocaleString()}`)
  }

  if (imported !== collection.features.length) {
    throw new Error(`Expected ${collection.features.length} imports, received ${imported}`)
  }

  const { data: pruned, error: pruneError } = await supabase.rpc('prune_retail_centres', {
    p_current_ids: Array.from(ids),
  })
  if (pruneError) throw new Error(`Failed to prune retired source IDs: ${pruneError.message}`)
  console.info(`Removed ${Number(pruned ?? 0).toLocaleString()} centres absent from this source.`)

  console.info('Rebuilding retail-centre store summaries…')
  const { data, error } = await supabase.rpc('rebuild_retail_centre_summaries')
  if (error) throw new Error(`Summary rebuild failed: ${error.message}`)
  console.info(data)
  console.info('Retail-centre import complete.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
