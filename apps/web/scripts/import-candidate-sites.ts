/**
 * Import candidate-site polygons from a GeoJSON file into public.candidate_sites.
 *
 * This is SiteMatcher's source-agnostic candidate ingestion path. HMLR INSPIRE is
 * the first real source for the Canterbury MVP, but the same importer takes OS
 * land-use polygons, brownfield sites, manually drawn polygons, etc.
 *
 * Run from apps/web:
 *   npm run import:candidate-sites -- \
 *     --file /abs/path/canterbury_inspire.geojson \
 *     --source hmlr_inspire \
 *     --ref-property INSPIREID \
 *     [--name-property NAME] \
 *     [--srid 27700] \                # reproject to WGS84 if the file isn't 4326
 *     [--bbox minLon,minLat,maxLon,maxLat] \
 *     [--dataset "HMLR INSPIRE Index Polygons"] [--version 2026-08]
 *
 * Preparing HMLR INSPIRE (GML → GeoJSON, clipped to Canterbury) with GDAL:
 *   ogr2ogr -f GeoJSON -t_srs EPSG:4326 \
 *     -clipsrc <minLon> <minLat> <maxLon> <maxLat> \
 *     canterbury_inspire.geojson Land_Registry_Cadastral_Parcels.gml
 * (then --srid can be omitted because ogr2ogr already reprojected to 4326)
 *
 * Re-running is safe: rows upsert on (source, source_reference).
 *
 * LICENCE / ATTRIBUTION (HMLR INSPIRE): reusable under the Open Government Licence
 * with required attribution "© Crown copyright and database right {year}. This
 * information is licensed under the terms of the Open Government Licence." Reuse of
 * the polygon geometry also requires the Ordnance Survey attribution "© Crown
 * copyright and database rights {year} OS {licence number}." The importer records
 * this in each row's provenance so it travels with the data.
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
const source = arg('source') ?? 'geojson'
const refProperty = arg('ref-property')
const nameProperty = arg('name-property')
const landUseProperty = arg('land-use-property')
const srid = arg('srid') ? Number(arg('srid')) : 4326
const bbox = arg('bbox')?.split(',').map(Number)
const dataset = arg('dataset') ?? source
const version = arg('version') ?? null

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!filePath || !fs.existsSync(filePath)) {
  console.error('Provide --file /abs/path/to.geojson')
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

// EPSG:27700 (British National Grid) definition for proj4.
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

function reprojectRings(rings: Position[][]): Position[][] {
  return rings.map((ring) => ring.map(reprojectPosition))
}

function reprojectGeometry(geom: GeoJSON.Geometry): GeoJSON.Geometry {
  if (srid === 4326) return geom
  if (geom.type === 'Polygon') {
    return { type: 'Polygon', coordinates: reprojectRings(geom.coordinates as Position[][]) }
  }
  if (geom.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: (geom.coordinates as Position[][][]).map(reprojectRings),
    }
  }
  return geom
}

function firstCoord(geom: GeoJSON.Geometry): [number, number] | null {
  if (geom.type === 'Polygon') {
    const c = (geom.coordinates as Position[][])[0]?.[0]
    return c ? [c[0], c[1]] : null
  }
  if (geom.type === 'MultiPolygon') {
    const c = (geom.coordinates as Position[][][])[0]?.[0]?.[0]
    return c ? [c[0], c[1]] : null
  }
  return null
}

function inBbox(lon: number, lat: number): boolean {
  if (!bbox) return true
  const [minLon, minLat, maxLon, maxLat] = bbox
  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat
}

async function importBatch(features: GeoJSON.Feature[]): Promise<number> {
  const { data, error } = await supabase.rpc('import_candidate_sites', {
    p_features: features,
    p_source: source,
    p_provenance: {
      dataset,
      version,
      imported_at: new Date().toISOString(),
      licence: source === 'hmlr_inspire' ? 'OGL v3 (HMLR + OS attribution required)' : null,
    },
    p_source_srid: srid,
  })
  if (error) throw new Error(error.message)
  return typeof data === 'number' ? data : features.length
}

async function main() {
  console.info(`Reading ${filePath} …`)
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as GeoJSON.FeatureCollection
  const inputFeatures = raw.features ?? []
  console.info(`  ${inputFeatures.length.toLocaleString()} features in file (source SRID ${srid}).`)

  const BATCH = 400
  let batch: GeoJSON.Feature[] = []
  let imported = 0
  let skippedNoGeom = 0
  let skippedBbox = 0

  const flush = async () => {
    if (batch.length === 0) return
    imported += await importBatch(batch)
    batch = []
    if (imported % 4000 === 0) console.info(`  imported ${imported.toLocaleString()}…`)
  }

  for (const feature of inputFeatures) {
    const geom = feature.geometry
    if (!geom || (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon')) {
      skippedNoGeom++
      continue
    }
    // bbox filter uses a representative source coordinate reprojected to 4326.
    const rep = firstCoord(geom)
    if (rep) {
      const [lon, lat] = reprojectPosition(rep as Position)
      if (!inBbox(lon, lat)) {
        skippedBbox++
        continue
      }
    }

    const props = (feature.properties ?? {}) as Record<string, unknown>
    const sourceRef = refProperty ? props[refProperty] : undefined
    const name = nameProperty ? props[nameProperty] : undefined
    const landUse = landUseProperty ? props[landUseProperty] : undefined

    batch.push({
      type: 'Feature',
      geometry: reprojectGeometry(geom),
      properties: {
        source_reference: sourceRef != null ? String(sourceRef) : null,
        name: name != null ? String(name) : null,
        current_land_use: landUse != null ? String(landUse) : null,
        metadata: props,
      },
    })
    if (batch.length >= BATCH) await flush()
  }
  await flush()

  console.info(
    `Candidate-site import complete: ${imported.toLocaleString()} imported/updated; ` +
      `${skippedBbox.toLocaleString()} outside bbox; ${skippedNoGeom.toLocaleString()} non-polygon skipped.`,
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
