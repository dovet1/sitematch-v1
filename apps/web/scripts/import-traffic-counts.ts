/**
 * Import DfT AADF (Annual Average Daily Flow) count points into public.traffic_counts
 * for "Find Sites" M4. Source-agnostic like the road/candidate importers.
 *
 * DfT publishes AADF as CSV (one row per count point per year) from
 *   https://roadtraffic.dft.gov.uk/downloads
 * Use the site's filters to download the Canterbury / Kent local-authority AADF CSV
 * ("AADF data" — not the raw counts), which already carries Latitude/Longitude (WGS84)
 * plus Easting/Northing (BNG). The headline flow is the All_motor_vehicles column;
 * Estimation_method (Counted vs Estimated) is preserved — never collapsed into a score.
 *
 * Run from apps/web:
 *   npm run import:traffic-counts -- \
 *     --file /abs/path/dft_aadf_canterbury.csv \
 *     --source dft_aadf \
 *     [--la "Canterbury"]          # keep rows whose Local_authority_name contains this
 *     [--bbox 1.00,51.22,1.20,51.32] \
 *     [--year 2023]                # keep only this AADF year (default: all years in file)
 *     [--use-bng]                  # build geometry from Easting/Northing instead of lon/lat
 *     [--dataset "DfT AADF"] [--version 2023]
 *
 * Re-running is safe: rows upsert on (source, source_reference = count_point_id:year).
 *
 * LICENCE / ATTRIBUTION (DfT road traffic statistics): OGL v3, attribution
 *   "Contains DfT road traffic statistics data © Crown copyright and database right {year}."
 * Recorded in each row's provenance so it travels with the data.
 */

import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import proj4 from 'proj4'

loadEnvConfig(process.cwd())

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

const filePath = arg('file') ? path.resolve(arg('file') as string) : ''
const source = arg('source') ?? 'dft_aadf'
const laFilter = arg('la')?.toLowerCase()
const bbox = arg('bbox')?.split(',').map(Number)
const yearFilter = arg('year') ? Number(arg('year')) : null
const useBng = hasFlag('use-bng')
const dataset = arg('dataset') ?? 'DfT AADF'
const version = arg('version') ?? null

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!filePath || !fs.existsSync(filePath)) {
  console.error('Provide --file /abs/path/to/dft_aadf.csv')
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

// --- minimal RFC4180 splitter for ONE CSV line (quoted fields, embedded commas, doubled
// quotes). DfT AADF fields never contain newlines, so we can stream line-by-line and split
// each line independently — this keeps a 150 MB / 600k-row national file off the heap.
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      out.push(field); field = ''
    } else if (c !== '\r') {
      field += c
    }
  }
  out.push(field)
  return out
}

// Case-insensitive column lookup with alternative DfT header spellings.
function pick(row: Record<string, string>, ...names: string[]): string | undefined {
  for (const n of names) {
    if (row[n] != null && row[n] !== '') return row[n]
    const hit = Object.keys(row).find((k) => k.toLowerCase() === n.toLowerCase())
    if (hit && row[hit] !== '') return row[hit]
  }
  return undefined
}

// DfT uses the literal 'NA' (and occasionally 'N/A' / '-') for missing numerics — coerce
// those to null so they don't reach the numeric casts in the RPC.
function num(v: string | undefined): number | null {
  if (v == null) return null
  const s = v.trim()
  if (s === '' || s.toUpperCase() === 'NA' || s.toUpperCase() === 'N/A' || s === '-') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function toLonLat(row: Record<string, string>): [number, number] | null {
  if (!useBng) {
    const lon = num(pick(row, 'Longitude', 'longitude', 'lon'))
    const lat = num(pick(row, 'Latitude', 'latitude', 'lat'))
    if (lon != null && lat != null) return [lon, lat]
  }
  const e = num(pick(row, 'Easting', 'easting'))
  const n = num(pick(row, 'Northing', 'northing'))
  if (e != null && n != null) {
    const [lon, lat] = proj4('EPSG:27700', 'EPSG:4326', [e, n])
    return [lon, lat]
  }
  return null
}

function inBbox(lon: number, lat: number): boolean {
  if (!bbox) return true
  const [minLon, minLat, maxLon, maxLat] = bbox
  return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat
}

function normalise(row: Record<string, string>, lon: number, lat: number): GeoJSON.Feature {
  const countPoint = pick(row, 'Count_point_id', 'count_point_id', 'CP')
  const year = pick(row, 'Year', 'year')
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: {
      source_reference: countPoint && year ? `${countPoint}:${year}` : (countPoint ?? null),
      count_point_id: countPoint ?? null,
      year: num(year),
      road_number: pick(row, 'Road_name', 'road_name') ?? null,
      road_category: pick(row, 'Road_category', 'road_category') ?? null,
      road_type: pick(row, 'Road_type', 'road_type') ?? null,
      start_junction: pick(row, 'Start_junction_road_name', 'start_junction_road_name') ?? null,
      end_junction: pick(row, 'End_junction_road_name', 'end_junction_road_name') ?? null,
      link_length_km: num(pick(row, 'Link_length_km', 'link_length_km')),
      estimation_method: pick(row, 'Estimation_method', 'estimation_method') ?? null,
      estimation_method_detailed: pick(row, 'Estimation_method_detailed', 'estimation_method_detailed') ?? null,
      direction: pick(row, 'Direction_of_travel', 'direction_of_travel', 'direction') ?? null,
      aadf_all_motor_vehicles: num(pick(row, 'All_motor_vehicles', 'all_motor_vehicles')),
      aadf_all_hgvs: num(pick(row, 'All_HGVs', 'all_hgvs', 'All_HGV')),
      aadf_cars_and_taxis: num(pick(row, 'Cars_and_taxis', 'cars_and_taxis')),
      aadf_lgvs: num(pick(row, 'LGVs', 'lgvs', 'LGV')),
      aadf_buses_and_coaches: num(pick(row, 'Buses_and_coaches', 'buses_and_coaches')),
      aadf_two_wheeled_mv: num(pick(row, 'Two_wheeled_motor_vehicles', 'two_wheeled_motor_vehicles')),
      pedal_cycles: num(pick(row, 'Pedal_cycles', 'pedal_cycles')),
      metadata: row, // keep every source column, incl. the HGV axle breakdown
    },
  }
}

async function importBatch(features: GeoJSON.Feature[]): Promise<number> {
  const { data, error } = await supabase.rpc('import_traffic_counts', {
    p_features: features,
    p_source: source,
    p_provenance: {
      dataset,
      version,
      imported_at: new Date().toISOString(),
      licence: source === 'dft_aadf'
        ? 'OGL v3 (Contains DfT road traffic statistics data © Crown copyright and database right)'
        : null,
    },
    p_source_srid: useBng ? 27700 : 4326,
  })
  if (error) throw new Error(error.message)
  return typeof data === 'number' ? data : features.length
}

async function main() {
  console.info(`Streaming ${filePath} …`)

  const BATCH = 500
  let batch: GeoJSON.Feature[] = []
  let header: string[] | null = null
  let seen = 0
  let imported = 0
  let skippedNoGeom = 0
  let skippedBbox = 0
  let skippedLa = 0
  let skippedYear = 0

  const flush = async () => {
    if (batch.length === 0) return
    imported += await importBatch(batch)
    batch = []
    if (imported % 5000 === 0) console.info(`  imported ${imported.toLocaleString()}…`)
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, 'utf8'),
    crlfDelay: Infinity,
  })

  for await (const line of rl) {
    if (line.trim() === '') continue
    const cells = splitCsvLine(line)
    if (!header) {
      header = cells.map((h) => h.trim())
      continue
    }
    const row: Record<string, string> = {}
    header.forEach((h, idx) => { row[h] = (cells[idx] ?? '').trim() })
    seen++

    if (laFilter) {
      const la = (pick(row, 'Local_authority_name', 'local_authority_name') ?? '').toLowerCase()
      if (!la.includes(laFilter)) { skippedLa++; continue }
    }
    if (yearFilter != null) {
      const y = num(pick(row, 'Year', 'year'))
      if (y !== yearFilter) { skippedYear++; continue }
    }
    const lonlat = toLonLat(row)
    if (!lonlat) { skippedNoGeom++; continue }
    const [lon, lat] = lonlat
    if (!inBbox(lon, lat)) { skippedBbox++; continue }

    batch.push(normalise(row, lon, lat))
    if (batch.length >= BATCH) await flush()
  }
  await flush()

  console.info(`  ${seen.toLocaleString()} data rows scanned.`)
  console.info(
    `Traffic import complete: ${imported.toLocaleString()} count-point rows imported/updated; ` +
      `${skippedBbox.toLocaleString()} outside bbox; ${skippedLa.toLocaleString()} outside LA; ` +
      `${skippedYear.toLocaleString()} other years; ${skippedNoGeom.toLocaleString()} no-geometry skipped.`,
  )
  console.info('Next: npm run associate:candidate-traffic')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
