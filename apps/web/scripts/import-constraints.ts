/**
 * Import CONSTRAINT polygons into public.constraint_features for "Find Sites" M8
 * (constraints: EA Flood Zones 2/3 + English Green Belt).
 *
 * Reads a GeoJSON FeatureCollection, normalises each feature to one constraint TOKEN
 * (flood_zone_2 / flood_zone_3 / green_belt / …) + a broad category using the SHARED,
 * unit-tested classifier (src/lib/site-matching/constraint-screening.ts), and upserts it.
 * Constraints are AREAS — non-polygon features are skipped. A feature we cannot confidently
 * map to a token is skipped (unknown stays out; never guessed).
 *
 * The constraint type is normally FIXED per file (each EA/Green Belt download is a single
 * layer), so pass --constraint-type; the importer also tries to read it per-feature from a
 * property named by --type-property (e.g. EA's "flood_zone" / "layer") for mixed files.
 *
 * SOURCES + how to prepare them (bbox = Canterbury, same as the rest of the pipeline):
 *   EA Flood Map for Planning — Flood Zones 2 & 3 (OGL v3; © Environment Agency).
 *     Download from the DEFRA Data Services Platform / environment.data.gov.uk (Flood Map
 *     for Planning: Flood Zone 2, and Flood Zone 3), each a separate layer. Reproject +
 *     clip to Canterbury (source is usually EPSG:27700):
 *       ogr2ogr -f GeoJSON -t_srs EPSG:4326 -spat 1.00 51.22 1.20 51.32 \
 *         canterbury_flood_zone_3.geojson "Flood Map for Planning Rivers and Sea Flood Zone 3.shp"
 *       ogr2ogr -f GeoJSON -t_srs EPSG:4326 -spat 1.00 51.22 1.20 51.32 \
 *         canterbury_flood_zone_2.geojson "Flood Map for Planning Rivers and Sea Flood Zone 2.shp"
 *     Import each with its own --constraint-type flood_zone_3 / flood_zone_2 --source ea_flood_map.
 *   English Green Belt (OGL v3; © Crown copyright / MHCLG). Download the national Green Belt
 *     dataset, reproject + clip to Canterbury, import --constraint-type green_belt --source green_belt.
 *
 * Run from apps/web (after applying 20260734000000_create_constraint_features.sql):
 *   npm run import:constraints -- --file /abs/path/canterbury_flood_zone_3.geojson \
 *     --constraint-type flood_zone_3 --source ea_flood_map [--dataset "EA Flood Map for Planning"] [--version 2026-08]
 *
 * Re-running is safe: rows upsert on (source, constraint_type, source_reference).
 */

import fs from 'node:fs'
import path from 'node:path'
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { normaliseConstraintType, constraintCategory } from '../src/lib/site-matching/constraint-screening'

loadEnvConfig(process.cwd())

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const filePath = arg('file') ? path.resolve(arg('file') as string) : ''
const fixedType = arg('constraint-type') // normally set; the file is one layer
const typeProperty = arg('type-property') // fallback: read the raw type from this property
const source = arg('source') ?? 'ea_flood_map'
const dataset = arg('dataset') ?? source
const version = arg('version') ?? null
const defaultLicence =
  source === 'green_belt'
    ? 'Open Government Licence v3 (© Crown copyright / MHCLG)'
    : 'Open Government Licence v3 (© Environment Agency)'
const licence = arg('licence') ?? defaultLicence

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!filePath || !fs.existsSync(filePath)) {
  console.error('Provide --file /abs/path/to/constraint.geojson')
  process.exit(1)
}
if (!fixedType && !typeProperty) {
  console.error('Provide --constraint-type <token> (e.g. flood_zone_3) or --type-property <prop> for mixed files.')
  process.exit(1)
}
if (!supabaseUrl || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  process.exit(1)
}
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function geometryIsPolygon(geom: GeoJSON.Geometry): boolean {
  return geom.type === 'Polygon' || geom.type === 'MultiPolygon' || geom.type === 'GeometryCollection'
}

function featureRef(props: Record<string, unknown>, fallback: string | number | undefined): string | null {
  const id = props.fid ?? props.OBJECTID ?? props.objectid ?? props.gid ?? props.id ?? props.reference ?? fallback
  return id != null ? String(id) : null
}

interface NormFeature {
  type: 'Feature'
  geometry: GeoJSON.Geometry
  properties: Record<string, unknown>
}

async function importBatch(features: NormFeature[]): Promise<number> {
  const { data, error } = await supabase.rpc('import_constraint_features', {
    p_features: features,
    p_source: source,
    p_provenance: { dataset, version, imported_at: new Date().toISOString(), licence },
    p_source_srid: 4326,
  })
  if (error) throw new Error(error.message)
  return typeof data === 'number' ? data : features.length
}

async function main() {
  console.info(`Reading ${filePath} (source=${source}${fixedType ? `, constraint-type=${fixedType}` : `, type-property=${typeProperty}`}) …`)
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as GeoJSON.FeatureCollection
  const feats = raw.features ?? []
  console.info(`  ${feats.length.toLocaleString()} source features.`)

  const BATCH = 200 // constraint polygons can be large; keep the RPC payload modest
  let batch: NormFeature[] = []
  let imported = 0
  let skippedUnmapped = 0
  let skippedNoGeom = 0
  const typeHist = new Map<string, number>()

  const flush = async () => {
    if (batch.length === 0) return
    imported += await importBatch(batch)
    batch = []
    if (imported % 1000 === 0) console.info(`  imported ${imported.toLocaleString()}…`)
  }

  for (const f of feats) {
    if (!f.geometry || !geometryIsPolygon(f.geometry)) { skippedNoGeom++; continue }
    const props = (f.properties ?? {}) as Record<string, unknown>
    const rawType = fixedType ?? (typeProperty ? (props[typeProperty] as string | undefined) : undefined)
    const token = normaliseConstraintType(rawType)
    if (!token) { skippedUnmapped++; continue }
    typeHist.set(token, (typeHist.get(token) ?? 0) + 1)

    batch.push({
      type: 'Feature',
      geometry: f.geometry,
      properties: {
        constraint_type: token,
        category: constraintCategory(token),
        name: (props.name ?? props.NAME ?? props.type ?? null) as string | null,
        source_reference: featureRef(props, (f as { id?: string | number }).id),
        source_tags: props,
      },
    })
    if (batch.length >= BATCH) await flush()
  }
  await flush()

  console.info(
    `\nConstraint import complete: ${imported.toLocaleString()} features imported/updated; ` +
      `${skippedUnmapped.toLocaleString()} unmappable (skipped, unknown stays out); ` +
      `${skippedNoGeom.toLocaleString()} non-polygon/no-geometry skipped.`,
  )
  const hist = Array.from(typeHist.entries()).sort((a, b) => b[1] - a[1])
  console.info('  By constraint token:')
  for (const [k, v] of hist) console.info(`    ${k.padEnd(16)} ${String(v).padStart(7)}`)
  console.info('\nNext: import the other constraint layers, then  npm run associate:candidate-constraints')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
