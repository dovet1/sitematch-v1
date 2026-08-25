/**
 * Import OS Open Roads (RoadLink / RoadNode) into public.road_links / public.road_nodes
 * for "Find Sites" M3. Source-agnostic like the candidate importer.
 *
 * Run from apps/web:
 *   # road centrelines
 *   npm run import:road-network -- \
 *     --file /abs/path/canterbury_roadlink.geojson \
 *     --layer link --source os_open_roads \
 *     [--srid 27700] [--bbox minLon,minLat,maxLon,maxLat] \
 *     [--dataset "OS Open Roads"] [--version 2025-10]
 *
 *   # junction / node points
 *   npm run import:road-network -- \
 *     --file /abs/path/canterbury_roadnode.geojson \
 *     --layer node --source os_open_roads [...]
 *
 * Preparing OS Open Roads (GeoPackage / GML -> GeoJSON, clipped to Canterbury) with GDAL.
 * OS Open Roads ships as a GeoPackage (oproad_gb.gpkg) with RoadLink + RoadNode layers,
 * in EPSG:27700 (British National Grid):
 *   ogr2ogr -f GeoJSON -t_srs EPSG:4326 -clipsrc 1.00 51.22 1.20 51.32 \
 *     canterbury_roadlink.geojson oproad_gb.gpkg RoadLink
 *   ogr2ogr -f GeoJSON -t_srs EPSG:4326 -clipsrc 1.00 51.22 1.20 51.32 \
 *     canterbury_roadnode.geojson oproad_gb.gpkg RoadNode
 * (then --srid can be omitted because ogr2ogr already reprojected to 4326)
 *
 * Re-running is safe: rows upsert on (source, source_reference).
 *
 * LICENCE / ATTRIBUTION (OS Open Roads): OGL v3, attribution
 *   "Contains OS data © Crown copyright and database right {year}."
 * The importer records this in each row's provenance so it travels with the data.
 */

import fs from 'node:fs'
import path from 'node:path'
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import proj4 from 'proj4'

loadEnvConfig(process.cwd())

// --- args -------------------------------------------------------------------
function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const filePath = arg('file') ? path.resolve(arg('file') as string) : ''
const layer = (arg('layer') ?? 'link').toLowerCase() // 'link' | 'node'
const source = arg('source') ?? 'os_open_roads'
const srid = arg('srid') ? Number(arg('srid')) : 4326
const bbox = arg('bbox')?.split(',').map(Number)
const dataset = arg('dataset') ?? 'OS Open Roads'
const version = arg('version') ?? null

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!filePath || !fs.existsSync(filePath)) {
  console.error('Provide --file /abs/path/to.geojson')
  process.exit(1)
}
if (layer !== 'link' && layer !== 'node') {
  console.error("--layer must be 'link' or 'node'")
  process.exit(1)
}
if (!supabaseUrl || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  process.exit(1)
}
if (bbox && bbox.length !== 4) {
  console.error('--bbox must be minLon,minLat,maxLon,maxLat')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

proj4.defs(
  'EPSG:27700',
  '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 ' +
    '+ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 +units=m +no_defs',
)

type Position = [number, number, ...number[]]

function reprojectPosition(pos: Position): Position {
  if (srid === 4326) return pos
  const [x, y] = proj4(`EPSG:${srid}`, 'EPSG:4326', [pos[0], pos[1]])
  return [x, y]
}

function reprojectGeometry(geom: GeoJSON.Geometry): GeoJSON.Geometry {
  if (srid === 4326) return geom
  if (geom.type === 'Point') {
    return { type: 'Point', coordinates: reprojectPosition(geom.coordinates as Position) }
  }
  if (geom.type === 'LineString') {
    return { type: 'LineString', coordinates: (geom.coordinates as Position[]).map(reprojectPosition) }
  }
  if (geom.type === 'MultiLineString') {
    return {
      type: 'MultiLineString',
      coordinates: (geom.coordinates as Position[][]).map((l) => l.map(reprojectPosition)),
    }
  }
  return geom
}

function firstCoord(geom: GeoJSON.Geometry): [number, number] | null {
  if (geom.type === 'Point') {
    const c = geom.coordinates as Position
    return c ? [c[0], c[1]] : null
  }
  if (geom.type === 'LineString') {
    const c = (geom.coordinates as Position[])[0]
    return c ? [c[0], c[1]] : null
  }
  if (geom.type === 'MultiLineString') {
    const c = (geom.coordinates as Position[][])[0]?.[0]
    return c ? [c[0], c[1]] : null
  }
  return null
}

function inBbox(lon: number, lat: number): boolean {
  if (!bbox) return true
  const [minLon, minLat, maxLon, maxLat] = bbox
  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat
}

// Read a property under any of several possible OS field names (GeoJSON exports vary
// in casing/prefix between GML, GeoPackage and product versions).
function pick(props: Record<string, unknown>, ...names: string[]): unknown {
  for (const n of names) {
    if (props[n] != null) return props[n]
    // case-insensitive fallback
    const hit = Object.keys(props).find((k) => k.toLowerCase() === n.toLowerCase())
    if (hit && props[hit] != null) return props[hit]
  }
  return undefined
}

function str(v: unknown): string | null {
  return v != null && String(v).trim() !== '' ? String(v) : null
}

function bool(v: unknown): boolean | null {
  if (v == null) return null
  if (typeof v === 'boolean') return v
  const s = String(v).toLowerCase()
  if (['true', 't', '1', 'yes', 'y'].includes(s)) return true
  if (['false', 'f', '0', 'no', 'n'].includes(s)) return false
  return null
}

function normaliseLinkProps(props: Record<string, unknown>): Record<string, unknown> {
  return {
    source_reference: str(pick(props, 'source_reference', 'TOID', 'toid', 'id', 'gml_id', 'fid', 'identifier')),
    road_classification: str(pick(props, 'roadClassification', 'road_classification', 'class')),
    road_function: str(pick(props, 'roadFunction', 'road_function', 'function')),
    road_number: str(pick(props, 'roadClassificationNumber', 'road_classification_number', 'road_number', 'roadNumber', 'ref')),
    name: str(pick(props, 'name1', 'name_1', 'name', 'roadName')),
    form_of_way: str(pick(props, 'formOfWay', 'form_of_way')),
    primary_route: bool(pick(props, 'primaryRoute', 'primary_route', 'primary')),
    trunk_road: bool(pick(props, 'trunkRoad', 'trunk_road', 'trunk')),
    start_node_ref: str(pick(props, 'startNode', 'start_node', 'start_node_ref', 'startnode')),
    end_node_ref: str(pick(props, 'endNode', 'end_node', 'end_node_ref', 'endnode')),
    metadata: props,
  }
}

function normaliseNodeProps(props: Record<string, unknown>): Record<string, unknown> {
  return {
    source_reference: str(pick(props, 'source_reference', 'TOID', 'toid', 'id', 'gml_id', 'fid', 'identifier')),
    form_of_road_node: str(pick(props, 'formOfRoadNode', 'form_of_road_node')),
    metadata: props,
  }
}

const rpcName = layer === 'link' ? 'import_road_links' : 'import_road_nodes'
const geomTypesOk =
  layer === 'link'
    ? new Set(['LineString', 'MultiLineString'])
    : new Set(['Point'])

async function importBatch(features: GeoJSON.Feature[]): Promise<number> {
  const { data, error } = await supabase.rpc(rpcName, {
    p_features: features,
    p_source: source,
    p_provenance: {
      dataset,
      version,
      imported_at: new Date().toISOString(),
      licence: source === 'os_open_roads' ? 'OGL v3 (Contains OS data © Crown copyright and database right)' : null,
    },
    p_source_srid: srid,
  })
  if (error) throw new Error(error.message)
  return typeof data === 'number' ? data : features.length
}

async function main() {
  console.info(`Reading ${filePath} (layer=${layer}) …`)
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as GeoJSON.FeatureCollection
  const inputFeatures = raw.features ?? []
  console.info(`  ${inputFeatures.length.toLocaleString()} features in file (source SRID ${srid}).`)

  const BATCH = 500
  let batch: GeoJSON.Feature[] = []
  let imported = 0
  let skippedNoGeom = 0
  let skippedBbox = 0

  const flush = async () => {
    if (batch.length === 0) return
    imported += await importBatch(batch)
    batch = []
    if (imported % 5000 === 0) console.info(`  imported ${imported.toLocaleString()}…`)
  }

  for (const feature of inputFeatures) {
    const geom = feature.geometry
    if (!geom || !geomTypesOk.has(geom.type)) {
      skippedNoGeom++
      continue
    }
    const rep = firstCoord(geom)
    if (rep) {
      const [lon, lat] = reprojectPosition(rep as Position)
      if (!inBbox(lon, lat)) {
        skippedBbox++
        continue
      }
    }

    const props = (feature.properties ?? {}) as Record<string, unknown>
    batch.push({
      type: 'Feature',
      geometry: reprojectGeometry(geom),
      properties: layer === 'link' ? normaliseLinkProps(props) : normaliseNodeProps(props),
    })
    if (batch.length >= BATCH) await flush()
  }
  await flush()

  console.info(
    `Road ${layer} import complete: ${imported.toLocaleString()} imported/updated; ` +
      `${skippedBbox.toLocaleString()} outside bbox; ${skippedNoGeom.toLocaleString()} wrong-geometry skipped.`,
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
