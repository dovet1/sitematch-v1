/**
 * Import land-use EVIDENCE features into public.land_use_features for "Find Sites" M5.
 *
 * M5 fuses land use from MANY open sources (no single comprehensive open UK land-use
 * dataset exists). This importer reads a GeoJSON FeatureCollection, normalises each
 * feature to one broad class + a source-level confidence using the SHARED, unit-tested
 * classifier (src/lib/site-matching/land-use-classification.ts), and upserts it. Only
 * features we can confidently classify are stored — an unclassifiable feature (e.g. a
 * bare building=yes) is skipped, because unknown must never masquerade as a class.
 *
 * SOURCES + how to prepare them (bbox = Canterbury, same as the rest of the pipeline):
 *   OSM (the workhorse; © OpenStreetMap contributors, ODbL): download an extract
 *     (Geofabrik england-latest.osm.pbf, or Overpass for the bbox), then convert each
 *     relevant layer to WGS84 GeoJSON, clipped to Canterbury:
 *       ogr2ogr -f GeoJSON -t_srs EPSG:4326 -spat 1.00 51.22 1.20 51.32 \
 *         canterbury_osm_multipolygons.geojson england-latest.osm.pbf multipolygons
 *       ogr2ogr -f GeoJSON -t_srs EPSG:4326 -spat 1.00 51.22 1.20 51.32 \
 *         canterbury_osm_points.geojson england-latest.osm.pbf points
 *     Import each with --source osm (the classifier reads landuse/amenity/shop/building/…,
 *     merging GDAL's promoted columns with the other_tags hstore).
 *   Brownfield register (OGL; Canterbury City Council publishes one as CSV/GeoJSON):
 *     import with --source brownfield_register (every feature → vacant_or_brownfield).
 *   Any single-class layer: --source <name> --fixed-class <class> --fixed-confidence high.
 *
 * The existing SiteMatcher estate is a source too, but needs no file: run
 *   npm run sync:store-land-use   (turns live stores into point evidence).
 *
 * Run from apps/web (after applying 20260728000000_create_land_use_features.sql):
 *   npm run import:land-use -- --file /abs/path/canterbury_osm_multipolygons.geojson --source osm \
 *     [--dataset "OpenStreetMap"] [--version 2026-08] [--licence "..."]
 *
 * Re-running is safe: rows upsert on (source, source_reference).
 */

import fs from 'node:fs'
import path from 'node:path'
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import {
  brownfieldClassification,
  classifyOsmTags,
  type LandUseClass,
  type SourceClassification,
} from '../src/lib/site-matching/land-use-classification'
import type { LandUseConfidence } from '../src/lib/site-matching/types'

loadEnvConfig(process.cwd())

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const filePath = arg('file') ? path.resolve(arg('file') as string) : ''
const source = arg('source') ?? 'osm'
const dataset = arg('dataset') ?? (source === 'osm' ? 'OpenStreetMap' : source)
const version = arg('version') ?? null
const fixedClass = arg('fixed-class') as LandUseClass | undefined
const fixedConfidence = (arg('fixed-confidence') as LandUseConfidence | undefined) ?? 'high'
const defaultLicence =
  source === 'osm'
    ? '© OpenStreetMap contributors, ODbL 1.0'
    : source === 'brownfield_register'
      ? 'Open Government Licence v3'
      : null
const licence = arg('licence') ?? defaultLicence

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!filePath || !fs.existsSync(filePath)) {
  console.error('Provide --file /abs/path/to/land_use.geojson')
  process.exit(1)
}
if (!supabaseUrl || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  process.exit(1)
}
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// OSM tag columns GDAL promotes to top-level properties (the rest live in other_tags).
const OSM_PROMOTED = [
  'landuse', 'amenity', 'shop', 'building', 'leisure', 'man_made', 'natural', 'office',
  'tourism', 'aeroway', 'aerodrome', 'military', 'historic', 'craft', 'power', 'railway',
  'waterway', 'highway', 'name',
]

/** Parse GDAL's hstore-style other_tags string: "k"=>"v","k2"=>"v2". */
function parseOtherTags(s: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!s) return out
  const re = /"((?:[^"\\]|\\.)*)"\s*=>\s*"((?:[^"\\]|\\.)*)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    out[m[1].replace(/\\"/g, '"')] = m[2].replace(/\\"/g, '"')
  }
  return out
}

/** Merge promoted OSM columns + parsed other_tags into one tag dict for the classifier. */
function osmTags(props: Record<string, unknown>): Record<string, string> {
  const tags: Record<string, string> = {}
  for (const k of OSM_PROMOTED) {
    const v = props[k]
    if (v != null && String(v).trim() !== '') tags[k] = String(v)
  }
  Object.assign(tags, parseOtherTags(props.other_tags as string | undefined))
  return tags
}

function osmRef(props: Record<string, unknown>, fallback: string | number | undefined): string | null {
  const id = props.osm_id ?? props.osm_way_id ?? props['@id'] ?? fallback
  return id != null ? String(id) : null
}

function geometryKind(geom: GeoJSON.Geometry): 'polygon' | 'point' | null {
  const t = geom.type
  if (t === 'Polygon' || t === 'MultiPolygon') return 'polygon'
  if (t === 'Point' || t === 'MultiPoint') return 'point'
  return null // lines etc. are not land-use evidence
}

function classifyFeature(
  props: Record<string, unknown>,
  kind: 'polygon' | 'point',
): { classification: SourceClassification; tags: Record<string, string> } | null {
  if (fixedClass) return { classification: { landUseClass: fixedClass, confidence: fixedConfidence }, tags: props as Record<string, string> }
  if (source === 'brownfield_register') return { classification: brownfieldClassification(), tags: props as Record<string, string> }
  // default: OSM tag classification (geometry-aware — see classifyOsmTags for why)
  const tags = osmTags(props)
  const classification = classifyOsmTags(tags, kind)
  return classification ? { classification, tags } : null
}

interface NormFeature {
  type: 'Feature'
  geometry: GeoJSON.Geometry
  properties: Record<string, unknown>
}

async function importBatch(features: NormFeature[]): Promise<number> {
  const { data, error } = await supabase.rpc('import_land_use_features', {
    p_features: features,
    p_source: source,
    p_provenance: { dataset, version, imported_at: new Date().toISOString(), licence },
    p_source_srid: 4326,
  })
  if (error) throw new Error(error.message)
  return typeof data === 'number' ? data : features.length
}

async function main() {
  console.info(`Reading ${filePath} (source=${source}${fixedClass ? `, fixed-class=${fixedClass}` : ''}) …`)
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as GeoJSON.FeatureCollection
  const feats = raw.features ?? []
  console.info(`  ${feats.length.toLocaleString()} source features.`)

  const BATCH = 500
  let batch: NormFeature[] = []
  let imported = 0
  let skippedUnclassified = 0
  let skippedNoGeom = 0
  const classHist = new Map<string, number>()

  const flush = async () => {
    if (batch.length === 0) return
    imported += await importBatch(batch)
    batch = []
    if (imported % 5000 === 0) console.info(`  imported ${imported.toLocaleString()}…`)
  }

  for (const f of feats) {
    if (!f.geometry) { skippedNoGeom++; continue }
    const kind = geometryKind(f.geometry)
    if (!kind) { skippedNoGeom++; continue }
    const props = (f.properties ?? {}) as Record<string, unknown>
    const result = classifyFeature(props, kind)
    if (!result) { skippedUnclassified++; continue }
    const { classification, tags } = result
    classHist.set(classification.landUseClass, (classHist.get(classification.landUseClass) ?? 0) + 1)

    batch.push({
      type: 'Feature',
      geometry: f.geometry,
      properties: {
        normalised_class: classification.landUseClass,
        class_confidence: classification.confidence,
        name: (props.name as string) ?? null,
        source_reference: source === 'osm' ? osmRef(props, (f as { id?: string | number }).id) : ((props.reference ?? props.ref ?? props.id ?? (f as { id?: string | number }).id) as string | null),
        source_tags: tags,
        metadata: props,
      },
    })
    if (batch.length >= BATCH) await flush()
  }
  await flush()

  console.info(
    `\nLand-use import complete: ${imported.toLocaleString()} features imported/updated; ` +
      `${skippedUnclassified.toLocaleString()} unclassifiable (skipped, unknown stays unknown); ` +
      `${skippedNoGeom.toLocaleString()} no-geometry skipped.`,
  )
  const hist = [...classHist.entries()].sort((a, b) => b[1] - a[1])
  console.info('  Classified by broad class:')
  for (const [k, v] of hist) console.info(`    ${k.padEnd(22)} ${String(v).padStart(7)}`)
  console.info('\nNext: npm run sync:store-land-use  (optional) then  npm run associate:candidate-land-use')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
