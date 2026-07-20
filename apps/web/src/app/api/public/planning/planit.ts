// Core logic for /api/public/planning: validates an inbound boundary, queries
// the PlanIt API (https://www.planit.org.uk) for commercial-relevant planning
// applications inside it, and maps records to the workspace shape.
//
// PlanIt facts this module is built around (measured, not assumed):
// - `boundary` accepts a GeoJSON Polygon/MultiPolygon up to 4,000 points, but
//   only via a form-encoded POST (a JSON body 403s on Django CSRF).
// - Query cost scales with area scanned, not result count; a wide bbox can hit
//   PlanIt's own 45s upstream timeout, so large areas are tiled by bbox.
// - Responses cap at ~1MB, so pages stay at pg_sz=100 with zero-based `index`
//   pagination (`offset` works but is undocumented).
// - 429s carry a ~163s cooldown, so tiles are fetched with concurrency 2.

import area from '@turf/area'
import buffer from '@turf/buffer'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import simplify from '@turf/simplify'
import { point, polygon } from '@turf/helpers'
import { createHash } from 'crypto'
import {
  geometryBounds,
  pointInGeometry,
} from '@/app/sitematcher-unified/lib/geo'
import type { PlanningApplication } from '@/app/sitematcher-unified/types/unified-workspace'

export const PLANIT_BASE = 'https://www.planit.org.uk/api/applics/json'

// 0.25° × 0.16° measured at 8.9s; at UK latitudes (~53°N, lon ≈ 66.9 km/°,
// lat ≈ 111.3 km/°) that is ≈ 16.7 km × 17.8 km ≈ 3.0e8 m².
export const MAX_BOUNDARY_AREA_M2 = 3e8 // 300 km² — boundary-vs-tiling switch
export const MAX_REQUEST_AREA_M2 = 5e9 // 5,000 km² — reject outright
export const MAX_INBOUND_VERTICES = 50_000
export const MAX_BODY_BYTES = 1_000_000
export const MAX_OUTBOUND_VERTICES = 3_500 // under PlanIt's 4,000-point cap
export const SIMPLIFY_TARGET_VERTICES = 3_000 // headroom for the outward buffer
export const MAX_TILES = 24
export const UK_LON: [number, number] = [-9, 3]
export const UK_LAT: [number, number] = [49, 61]

export const PAGE_SIZE = 100
export const MAX_PAGES_PER_QUERY = 10 // per boundary/tile query unit
export const MAX_TOTAL_RECORDS = 2_000
const UPSTREAM_TIMEOUT_MS = 55_000
const CACHE_TTL_MS = 12 * 60 * 60 * 1000 // PlanIt re-scrapes daily

// Fixed global tile grid (snapped to origin 0,0) so overlapping requests reuse
// cached tiles. 0.2° lon × 0.15° lat ≈ 14.6 km × 16.7 km ≈ 2.4e8 m² at the UK's
// southern extreme — under MAX_BOUNDARY_AREA_M2 everywhere in UK bounds.
const TILE_LON_DEG = 0.2
const TILE_LAT_DEG = 0.15

export type Boundary = GeoJSON.Polygon | GeoJSON.MultiPolygon

export interface PlanningResult {
  applications: PlanningApplication[]
  total: number
  truncated: boolean
}

export class RateLimitError extends Error {
  constructor() {
    super('PlanIt rate limit reached')
    this.name = 'RateLimitError'
  }
}

// ---------------------------------------------------------------------------
// Validation (fail closed, before any simplification or upstream fan-out)
// ---------------------------------------------------------------------------

function eachRing(geom: Boundary, visit: (ring: number[][]) => void) {
  if (geom.type === 'Polygon') {
    ;(geom.coordinates as number[][][]).forEach(visit)
  } else {
    ;(geom.coordinates as number[][][][]).forEach((poly) => poly.forEach(visit))
  }
}

export function vertexCount(geom: Boundary): number {
  let n = 0
  eachRing(geom, (ring) => {
    n += ring.length
  })
  return n
}

// Returns an error message, or null when the geometry is acceptable.
export function validateBoundary(geom: unknown): string | null {
  if (!geom || typeof geom !== 'object') return 'Missing boundary geometry'
  const g = geom as { type?: string; coordinates?: unknown }
  if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') {
    return 'Boundary must be a GeoJSON Polygon or MultiPolygon'
  }
  if (!Array.isArray(g.coordinates)) return 'Boundary has no coordinates'

  let vertices = 0
  let coordsOk = true
  try {
    eachRing(g as Boundary, (ring) => {
      if (!Array.isArray(ring)) throw new Error('bad ring')
      for (const pos of ring) {
        if (!Array.isArray(pos) || pos.length < 2) throw new Error('bad position')
        const [lng, lat] = pos
        if (
          typeof lng !== 'number' ||
          typeof lat !== 'number' ||
          !Number.isFinite(lng) ||
          !Number.isFinite(lat) ||
          lng < UK_LON[0] ||
          lng > UK_LON[1] ||
          lat < UK_LAT[0] ||
          lat > UK_LAT[1]
        ) {
          coordsOk = false
        }
        vertices++
      }
    })
  } catch {
    return 'Boundary coordinates are malformed'
  }
  if (!coordsOk) return 'Boundary coordinates must be finite lon/lat within the UK'
  if (vertices === 0) return 'Boundary has no coordinates'
  if (vertices > MAX_INBOUND_VERTICES) return 'Boundary has too many vertices'
  if (area(geom as Boundary) > MAX_REQUEST_AREA_M2) return 'Boundary area is too large'
  return null
}

// ---------------------------------------------------------------------------
// Boundary preparation: verbatim → simplify + outward buffer → bbox tiling
// ---------------------------------------------------------------------------

export type QueryPlan =
  | { kind: 'boundary'; geometry: Boundary }
  | { kind: 'tiles'; tiles: [number, number, number, number][]; tilesTruncated: boolean }

// Simplify until under the vertex target, then buffer the result *outward* by
// 2× the final tolerance (Douglas–Peucker bounds deviation by the tolerance).
// Containment of every original vertex is verified rather than trusted; any
// failure means the caller falls back to bbox tiling, which is inherently a
// superset. The buffered polygon is never re-simplified — that could cut back
// inside the original and silently lose records PlanIt would never return.
function simplifyAndBuffer(geom: Boundary): Boundary | null {
  let tolerance = 0.0001
  let simplified: Boundary | null = null
  for (let i = 0; i < 12; i++) {
    const candidate = simplify(
      { type: 'Feature' as const, properties: {}, geometry: geom },
      { tolerance, highQuality: false, mutate: false }
    ).geometry as Boundary
    if (vertexCount(candidate) <= SIMPLIFY_TARGET_VERTICES) {
      simplified = candidate
      break
    }
    tolerance *= 2
  }
  if (!simplified) return null

  const bufferKm = Math.max((2 * tolerance * 111_320) / 1000, 0.1)
  let buffered: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | undefined
  try {
    buffered = buffer(simplified, bufferKm, { units: 'kilometers' })
  } catch {
    return null
  }
  if (!buffered || vertexCount(buffered.geometry as Boundary) > MAX_OUTBOUND_VERTICES) {
    return null
  }

  let contained = true
  eachRing(geom, (ring) => {
    if (!contained) return
    for (const [lng, lat] of ring) {
      if (!booleanPointInPolygon(point([lng, lat]), buffered!)) {
        contained = false
        return
      }
    }
  })
  return contained ? (buffered.geometry as Boundary) : null
}

function tileAreaM2(bbox: [number, number, number, number]): number {
  const [minLon, minLat, maxLon, maxLat] = bbox
  return area(
    polygon([
      [
        [minLon, minLat],
        [maxLon, minLat],
        [maxLon, maxLat],
        [minLon, maxLat],
        [minLon, minLat],
      ],
    ])
  )
}

// Grid cells (snapped to the fixed global grid) covering the geometry's bbox.
// Every cell is verified with @turf/area; a cell over the threshold (cannot
// happen inside UK bounds, but verified rather than assumed) is quad-split.
export function buildTiles(geom: Boundary): {
  tiles: [number, number, number, number][]
  tilesTruncated: boolean
} {
  const [minLon, minLat, maxLon, maxLat] = geometryBounds(geom)
  const cells: [number, number, number, number][] = []
  const iMin = Math.floor(minLon / TILE_LON_DEG)
  const iMax = Math.floor(maxLon / TILE_LON_DEG)
  const jMin = Math.floor(minLat / TILE_LAT_DEG)
  const jMax = Math.floor(maxLat / TILE_LAT_DEG)

  const push = (cell: [number, number, number, number], depth: number) => {
    if (tileAreaM2(cell) <= MAX_BOUNDARY_AREA_M2 || depth >= 3) {
      cells.push(cell)
      return
    }
    const midLon = (cell[0] + cell[2]) / 2
    const midLat = (cell[1] + cell[3]) / 2
    push([cell[0], cell[1], midLon, midLat], depth + 1)
    push([midLon, cell[1], cell[2], midLat], depth + 1)
    push([cell[0], midLat, midLon, cell[3]], depth + 1)
    push([midLon, midLat, cell[2], cell[3]], depth + 1)
  }
  for (let i = iMin; i <= iMax; i++) {
    for (let j = jMin; j <= jMax; j++) {
      push(
        [
          i * TILE_LON_DEG,
          j * TILE_LAT_DEG,
          (i + 1) * TILE_LON_DEG,
          (j + 1) * TILE_LAT_DEG,
        ],
        0
      )
    }
  }
  const tilesTruncated = cells.length > MAX_TILES
  return { tiles: cells.slice(0, MAX_TILES), tilesTruncated }
}

export function planQuery(geom: Boundary): QueryPlan {
  if (area(geom) > MAX_BOUNDARY_AREA_M2) {
    const { tiles, tilesTruncated } = buildTiles(geom)
    return { kind: 'tiles', tiles, tilesTruncated }
  }
  if (vertexCount(geom) <= MAX_OUTBOUND_VERTICES) {
    return { kind: 'boundary', geometry: geom }
  }
  const prepared = simplifyAndBuffer(geom)
  if (prepared) return { kind: 'boundary', geometry: prepared }
  const { tiles, tilesTruncated } = buildTiles(geom)
  return { kind: 'tiles', tiles, tilesTruncated }
}

// ---------------------------------------------------------------------------
// Record mapping
// ---------------------------------------------------------------------------

interface PlanItRecord {
  name?: unknown
  uid?: unknown
  address?: unknown
  app_size?: unknown
  app_state?: unknown
  app_type?: unknown
  description?: unknown
  url?: unknown
  location_x?: unknown
  location_y?: unknown
  decided_date?: unknown
  other_fields?: Record<string, unknown> | null
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return null
}

// PlanIt only ever returns the placeholder "See source" for applicant/agent
// names, so they are omitted entirely; the url link-out reaches the parties.
export function mapRecord(raw: unknown): PlanningApplication | null {
  if (!raw || typeof raw !== 'object') return null
  const rec = raw as PlanItRecord
  const name = asString(rec.name)
  const lng = asNumber(rec.location_x)
  const lat = asNumber(rec.location_y)
  if (!name || lng === null || lat === null) return null
  const other = (rec.other_fields ?? {}) as Record<string, unknown>
  return {
    name,
    uid: asString(rec.uid) ?? name,
    address: asString(rec.address) ?? '',
    appSize: asString(rec.app_size) ?? '',
    appState: asString(rec.app_state) ?? '',
    appType: asString(rec.app_type) ?? '',
    description: asString(rec.description) ?? '',
    url: asString(rec.url) ?? '',
    lat,
    lng,
    decidedDate: asString(rec.decided_date),
    dateValidated: asString(other.date_validated),
    nDwellings: asNumber(other.n_dwellings),
    applicantAddress: asString(other.applicant_address),
    agentAddress: asString(other.agent_address),
  }
}

// ---------------------------------------------------------------------------
// Caching: exact keys only — a rounded key could serve one boundary's filtered
// results for a nearby different boundary. The upstream cache stores raw
// candidates that are re-filtered per request, so shared entries stay correct.
// ---------------------------------------------------------------------------

class TtlLru<V> {
  private map = new Map<string, { value: V; expires: number }>()
  constructor(private max: number) {}
  get(key: string): V | undefined {
    const entry = this.map.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expires) {
      this.map.delete(key)
      return undefined
    }
    // Refresh recency.
    this.map.delete(key)
    this.map.set(key, entry)
    return entry.value
  }
  set(key: string, value: V) {
    this.map.delete(key)
    this.map.set(key, { value, expires: Date.now() + CACHE_TTL_MS })
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value as string
      this.map.delete(oldest)
    }
  }
  clear() {
    this.map.clear()
  }
}

interface UpstreamPage {
  applications: PlanningApplication[]
  truncated: boolean
}

const finalCache = new TtlLru<PlanningResult>(200)
const upstreamCache = new TtlLru<UpstreamPage>(500)

export function __clearCaches() {
  finalCache.clear()
  upstreamCache.clear()
}

// Two-year window, computed in UTC so it is deterministic across regions.
export function startDateUTC(now = new Date()): string {
  const d = new Date(
    Date.UTC(now.getUTCFullYear() - 2, now.getUTCMonth(), now.getUTCDate())
  )
  return d.toISOString().slice(0, 10)
}

export function filterParams(startDate: string): Record<string, string> {
  return {
    app_size: 'Large',
    app_state: 'Undecided,Permitted,Rejected',
    app_type: 'Full,Outline,Amendment',
    start_date: startDate,
    pg_sz: String(PAGE_SIZE),
  }
}

function filterKey(startDate: string): string {
  const p = filterParams(startDate)
  return Object.keys(p)
    .sort()
    .map((k) => `${k}=${p[k]}`)
    .join('&')
}

export function boundaryHash(geom: Boundary): string {
  return createHash('sha256').update(JSON.stringify(geom)).digest('hex')
}

// ---------------------------------------------------------------------------
// Upstream fetching
// ---------------------------------------------------------------------------

interface PlanItEnvelope {
  total?: number
  records?: unknown[]
}

// AbortSignal.timeout is a Node 17.3+ / modern-browser API; jsdom (jest) lacks
// it, so fall back to no signal rather than crashing.
function timeoutSignal(ms: number): AbortSignal | undefined {
  return typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(ms)
    : undefined
}

// One paginated query unit: either the whole (possibly buffered) boundary, or
// a single bbox tile. `boundary` must go as a form-encoded POST — a JSON body
// 403s on Django CSRF. bbox tiles use the measured GET form.
async function fetchQueryUnit(
  unit: { boundary?: Boundary; bbox?: [number, number, number, number] },
  startDate: string
): Promise<UpstreamPage> {
  const applications: PlanningApplication[] = []
  let truncated = false
  let index = 0
  for (let page = 0; page < MAX_PAGES_PER_QUERY; page++) {
    const params = new URLSearchParams({
      ...filterParams(startDate),
      index: String(index),
    })
    let res: Response
    if (unit.boundary) {
      params.set('boundary', JSON.stringify(unit.boundary))
      res = await fetch(PLANIT_BASE, {
        method: 'POST',
        body: params,
        signal: timeoutSignal(UPSTREAM_TIMEOUT_MS),
      })
    } else {
      params.set('bbox', unit.bbox!.join(','))
      res = await fetch(`${PLANIT_BASE}?${params.toString()}`, {
        signal: timeoutSignal(UPSTREAM_TIMEOUT_MS),
      })
    }
    if (res.status === 429) {
      // A 429 mid-pagination keeps the pages already fetched; only a 429
      // before anything arrived propagates for the caller to surface.
      if (applications.length > 0) return { applications, truncated: true }
      throw new RateLimitError()
    }
    if (!res.ok) {
      // PlanIt reports its own upstream timeouts as 400s on wide scans; treat
      // any non-OK page as a partial result rather than failing the request.
      truncated = true
      break
    }
    const data = (await res.json()) as PlanItEnvelope
    const records = Array.isArray(data.records) ? data.records : []
    for (const raw of records) {
      const app = mapRecord(raw)
      if (app) applications.push(app)
    }
    const total = typeof data.total === 'number' ? data.total : records.length
    index += PAGE_SIZE
    if (index >= total || records.length === 0) {
      return { applications, truncated }
    }
  }
  // Ran out of page budget with records still unfetched.
  return { applications, truncated: true }
}

async function fetchUnitCached(
  cacheKey: string,
  unit: { boundary?: Boundary; bbox?: [number, number, number, number] },
  startDate: string
): Promise<UpstreamPage> {
  const cached = upstreamCache.get(cacheKey)
  if (cached) return cached
  const result = await fetchQueryUnit(unit, startDate)
  // Don't cache pages that were cut short — a retry may complete them.
  if (!result.truncated) upstreamCache.set(cacheKey, result)
  return result
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export async function fetchPlanningApplications(
  boundary: Boundary,
  now = new Date()
): Promise<PlanningResult> {
  const startDate = startDateUTC(now)
  const filters = filterKey(startDate)
  const finalKey = `${boundaryHash(boundary)}|${filters}`
  const cached = finalCache.get(finalKey)
  if (cached) return cached

  const plan = planQuery(boundary)
  const byName = new Map<string, PlanningApplication>()
  let truncated = false

  if (plan.kind === 'boundary') {
    const key = `boundary:${boundaryHash(plan.geometry)}|${filters}`
    const page = await fetchUnitCached(key, { boundary: plan.geometry }, startDate)
    truncated = page.truncated
    for (const app of page.applications) byName.set(app.name, app)
  } else {
    truncated = plan.tilesTruncated
    // A mid-run 429 stops the fan-out but keeps what already arrived; the
    // caller only sees RateLimitError when nothing at all was fetched.
    let rateLimited = false
    const queue = [...plan.tiles]
    const worker = async () => {
      for (;;) {
        const tile = queue.shift()
        if (!tile || rateLimited) return
        const key = `tile:${tile.join(',')}|${filters}`
        try {
          const page = await fetchUnitCached(key, { bbox: tile }, startDate)
          if (page.truncated) truncated = true
          for (const app of page.applications) byName.set(app.name, app)
        } catch (err) {
          if (err instanceof RateLimitError) {
            rateLimited = true
            truncated = true
          } else {
            truncated = true
          }
        }
        if (byName.size >= MAX_TOTAL_RECORDS) {
          truncated = true
          return
        }
      }
    }
    await Promise.all([worker(), worker()])
    if (rateLimited && byName.size === 0) throw new RateLimitError()
  }

  // Always re-filter against the request's own full-resolution boundary: the
  // sent geometry is a verified superset (buffered boundary or bbox tiles), so
  // this can only remove false positives, never lose an inside application.
  const applications = Array.from(byName.values()).filter((app) =>
    pointInGeometry(app.lng, app.lat, boundary)
  )

  const result: PlanningResult = {
    applications,
    total: applications.length,
    truncated,
  }
  // A truncated result (rate limit, timeout, tile cap) is not cached — a
  // later retry may complete where this request could not.
  if (!truncated) finalCache.set(finalKey, result)
  return result
}
