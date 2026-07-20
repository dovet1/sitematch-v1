// Core logic for /api/public/planning: validates an inbound boundary, queries
// the PlanIt API (https://www.planit.org.uk) for commercial-relevant planning
// applications inside it, and maps records to the workspace shape.
//
// PlanIt facts this module is built around (measured, not assumed):
// - Spatial queries (`bbox`/`boundary`) cost scales with the area scanned, and
//   PlanIt's data source gives up at 45s with an HTTP 400 body of
//   "Timeout (45s) from data source". Any bbox over a town or city exceeds this
//   — measured down to ~3.7 x 4.2 km — so spatial scanning is unusable here.
//   Querying by planning authority (`auth`) is indexed and returns in seconds.
// - `/api/areas/` accepts the same spatial params, so the authorities covering
//   a boundary are resolved with one bbox call, then queried by numeric id.
//   Area records embed a full `borders` polygon, hence the `select`.
// - `no_kin` restricts an authority to its own applications, so parent/child
//   areas returned by the same bbox lookup stay disjoint instead of refetching
//   each other's records.
// - Responses cap at ~1MB, so pages stay at pg_sz=100 with zero-based `index`
//   pagination (`offset` works but is undocumented).
// - PlanIt is a small free service and sheds load with an HTTP 400 body of
//   "PGRST003: Timed out acquiring connection from connection pool." That is
//   transient and retryable — distinct from the 45s timeout above — so it is
//   classified separately and the fan-out stays deliberately narrow.
// - 429s carry a ~163s cooldown, so authorities are fetched with concurrency 2.

import area from '@turf/area'
import { createHash } from 'crypto'
import {
  geometryBounds,
  pointInGeometry,
} from '@/app/sitematcher-unified/lib/geo'
import type {
  PlanningApplication,
  PlanningProgress,
  PlanningTruncationReason,
} from '@/app/sitematcher-unified/types/unified-workspace'

export const PLANIT_BASE = 'https://www.planit.org.uk/api/applics/json'
export const PLANIT_AREAS_BASE = 'https://www.planit.org.uk/api/areas/json'

export const MAX_REQUEST_AREA_M2 = 5e9 // 5,000 km² — reject outright
export const MAX_INBOUND_VERTICES = 50_000
export const MAX_BODY_BYTES = 1_000_000
export const MAX_AUTHORITIES = 20
export const UK_LON: [number, number] = [-9, 3]
export const UK_LAT: [number, number] = [49, 61]

export const PAGE_SIZE = 100
export const MAX_PAGES_PER_QUERY = 10 // per authority
export const MAX_TOTAL_RECORDS = 2_000
// PlanIt's nginx returns a bare 403 to Node's default fetch User-Agent, so a
// descriptive one is required, not merely polite — without it every request
// from the server fails while the same URL works fine from curl or a browser.
const USER_AGENT = 'commercial-directory/1.0 (+planning tab; https://www.planit.org.uk API client)'

const UPSTREAM_TIMEOUT_MS = 55_000
const CACHE_TTL_MS = 12 * 60 * 60 * 1000 // PlanIt re-scrapes daily
const MAX_ATTEMPTS = 2 // one retry after a transient upstream failure
const RETRY_BACKOFF_MS = 1_500
const CONCURRENCY = 2

export type Boundary = GeoJSON.Polygon | GeoJSON.MultiPolygon

export interface PlanningAuthority {
  id: number
  name: string
  type: string
}

export interface PlanningResult {
  applications: PlanningApplication[]
  total: number
  truncated: boolean
  truncationReason: PlanningTruncationReason
}

export class RateLimitError extends Error {
  constructor() {
    super('PlanIt rate limit reached')
    this.name = 'RateLimitError'
  }
}

// The authority lookup gates every other query, so when it fails there is no
// partial result to show — only an honest error. PlanIt sheds load fairly
// often, so this message is user-facing and suggests the fix that works.
export class AuthorityLookupError extends Error {
  constructor() {
    super(
      "Couldn't reach PlanIt to work out which councils cover this area — try again in a few minutes."
    )
    this.name = 'AuthorityLookupError'
  }
}

// ---------------------------------------------------------------------------
// Validation (fail closed, before any upstream fan-out)
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
//
// Records without a location are dropped. Authority queries return some of
// these (measured: 73/74 located for Westminster, 7/11 for Birmingham) whereas
// a spatial query could never return them at all, so this is not a regression
// — and an unlocatable application cannot honestly be placed inside a boundary.
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
// Caching: authority results are keyed by area id + filters, so they are shared
// across every boundary and every caller — a second lookup anywhere in the same
// city is a cache hit. The final cache keeps exact repeat requests free.
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
  truncationReason: PlanningTruncationReason
}

const finalCache = new TtlLru<PlanningResult>(200)
const authorityCache = new TtlLru<UpstreamPage>(500)
const areasCache = new TtlLru<PlanningAuthority[]>(200)

export function __clearCaches() {
  finalCache.clear()
  authorityCache.clear()
  areasCache.clear()
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

// Ordered least → most severe. A run reports the worst reason it hit.
const TRUNCATION_PRIORITY: Exclude<PlanningTruncationReason, null>[] = [
  'authority_cap',
  'page_cap',
  'record_cap',
  'upstream_busy',
  'upstream_error',
  'upstream_timeout',
  'rate_limited',
]

// Reasons are collected as they occur and reduced at the end rather than
// merged into a running variable: the fan-out below assigns from inside
// closures, which control-flow analysis cannot see, so a running variable
// stays wrongly narrowed to its initializer type at the point of use.
export function worstReason(
  reasons: Exclude<PlanningTruncationReason, null>[]
): PlanningTruncationReason {
  let worst: PlanningTruncationReason = null
  for (const reason of reasons) {
    if (
      worst === null ||
      TRUNCATION_PRIORITY.indexOf(reason) > TRUNCATION_PRIORITY.indexOf(worst)
    ) {
      worst = reason
    }
  }
  return worst
}

function mergeTruncationReason(
  current: PlanningTruncationReason,
  next: Exclude<PlanningTruncationReason, null>
): Exclude<PlanningTruncationReason, null> {
  if (!current) return next
  return TRUNCATION_PRIORITY.indexOf(next) > TRUNCATION_PRIORITY.indexOf(current)
    ? next
    : current
}

function upstreamFailureReason(error: unknown): Exclude<PlanningTruncationReason, null> {
  if (
    error &&
    typeof error === 'object' &&
    'name' in error &&
    (error as { name?: unknown }).name === 'TimeoutError'
  ) {
    return 'upstream_timeout'
  }
  return 'upstream_error'
}

// PlanIt signals two very different problems with the same HTTP 400, and only
// the body tells them apart: connection-pool exhaustion is transient load and
// worth retrying, whereas the 45s data-source timeout means the query itself
// was too expensive and a retry would just cost another 45s.
export function classifyUpstream(
  status: number,
  body: string
): Exclude<PlanningTruncationReason, null> {
  if (body.includes('PGRST003')) return 'upstream_busy'
  if (/Timeout \(\d+s\) from data source/i.test(body)) return 'upstream_timeout'
  if (status === 408 || status === 504) return 'upstream_timeout'
  return 'upstream_error'
}

function isRetryable(reason: Exclude<PlanningTruncationReason, null>): boolean {
  return reason === 'upstream_busy' || reason === 'upstream_error'
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function readBody(res: Response): Promise<string> {
  try {
    return await res.text()
  } catch {
    return ''
  }
}

// The planning authorities whose boundaries intersect the request's bbox. The
// bbox is a superset of the boundary, so this can only over-select — every
// application is re-filtered against the true geometry before it is returned.
export async function fetchAuthorities(
  boundary: Boundary
): Promise<{ authorities: PlanningAuthority[]; truncated: boolean }> {
  const [minLon, minLat, maxLon, maxLat] = geometryBounds(boundary)
  const bbox = [minLon, minLat, maxLon, maxLat].join(',')
  const cacheKey = `areas:${bbox}`
  const cached = areasCache.get(cacheKey)
  if (cached) {
    return {
      authorities: cached.slice(0, MAX_AUTHORITIES),
      truncated: cached.length > MAX_AUTHORITIES,
    }
  }

  const params = new URLSearchParams({
    bbox,
    // Area records embed a full `borders` polygon; without this we would
    // download and discard an authority outline per area on every lookup.
    select: 'area_id,area_name,area_type',
    pg_sz: String(PAGE_SIZE),
  })

  // This lookup gates the whole request — every authority query depends on it —
  // so a transient PGRST003 here must not fail the entire planning tab the way
  // an unretried single point of failure would.
  let res: Response | null = null
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(RETRY_BACKOFF_MS * attempt)
    res = await fetch(`${PLANIT_AREAS_BASE}?${params.toString()}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: timeoutSignal(UPSTREAM_TIMEOUT_MS),
    })
    if (res.status === 429) throw new RateLimitError()
    if (res.ok) break

    const body = await readBody(res)
    const reason = classifyUpstream(res.status, body)
    console.error(
      `[planning] areas lookup failed (${res.status}, ${reason}, attempt ${attempt + 1}) ` +
        `for bbox ${bbox}: ${body.slice(0, 200)}`
    )
    if (!isRetryable(reason) || attempt === MAX_ATTEMPTS - 1) {
      // Surfaced directly in the Planning tab, so it reads for a user rather
      // than quoting a status code; the technical detail is logged above.
      throw new AuthorityLookupError()
    }
  }
  const data = (await res!.json()) as PlanItEnvelope
  const records = Array.isArray(data.records) ? data.records : []

  const seen = new Set<number>()
  const authorities: PlanningAuthority[] = []
  for (const raw of records) {
    if (!raw || typeof raw !== 'object') continue
    const rec = raw as Record<string, unknown>
    const id = asNumber(rec.area_id)
    const name = asString(rec.area_name)
    if (id === null || !name || seen.has(id)) continue
    seen.add(id)
    authorities.push({ id, name, type: asString(rec.area_type) ?? '' })
  }

  areasCache.set(cacheKey, authorities)
  return {
    authorities: authorities.slice(0, MAX_AUTHORITIES),
    truncated: authorities.length > MAX_AUTHORITIES,
  }
}

// One paginated authority query. `no_kin` keeps each authority to its own
// applications so parent and child areas from the same bbox stay disjoint.
async function fetchAuthorityPages(
  authorityId: number,
  startDate: string
): Promise<UpstreamPage> {
  const applications: PlanningApplication[] = []
  let truncationReason: PlanningTruncationReason = null
  let index = 0

  for (let page = 0; page < MAX_PAGES_PER_QUERY; page++) {
    const params = new URLSearchParams({
      ...filterParams(startDate),
      auth: String(authorityId),
      no_kin: '1',
      index: String(index),
    })
    let res: Response
    try {
      res = await fetch(`${PLANIT_BASE}?${params.toString()}`, {
        headers: { 'User-Agent': USER_AGENT },
        signal: timeoutSignal(UPSTREAM_TIMEOUT_MS),
      })
    } catch (error) {
      return {
        applications,
        truncated: true,
        truncationReason: upstreamFailureReason(error),
      }
    }
    if (res.status === 429) {
      // A 429 mid-pagination keeps the pages already fetched; only a 429
      // before anything arrived propagates for the caller to surface.
      if (applications.length > 0) {
        return { applications, truncated: true, truncationReason: 'rate_limited' }
      }
      throw new RateLimitError()
    }
    if (!res.ok) {
      const body = await readBody(res)
      const reason = classifyUpstream(res.status, body)
      console.error(
        `[planning] auth=${authorityId} page ${page} failed (${res.status}, ${reason}): ${body.slice(0, 200)}`
      )
      truncationReason = mergeTruncationReason(truncationReason, reason)
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
      return {
        applications,
        truncated: Boolean(truncationReason),
        truncationReason,
      }
    }
  }
  // Ran out of page budget with records still unfetched.
  return {
    applications,
    truncated: true,
    truncationReason: mergeTruncationReason(truncationReason, 'page_cap'),
  }
}

// Retries only transient failures (pool exhaustion, network blips). A 45s
// data-source timeout is a cost signal, not a blip, so retrying it would just
// spend another 45s to fail identically.
async function fetchAuthorityCached(
  authority: PlanningAuthority,
  startDate: string,
  filters: string
): Promise<UpstreamPage> {
  const cacheKey = `auth:${authority.id}|${filters}`
  const cached = authorityCache.get(cacheKey)
  if (cached) return cached

  let result = await fetchAuthorityPages(authority.id, startDate)
  for (
    let attempt = 1;
    attempt < MAX_ATTEMPTS &&
    result.truncationReason &&
    isRetryable(result.truncationReason);
    attempt++
  ) {
    await sleep(RETRY_BACKOFF_MS * attempt)
    const retried = await fetchAuthorityPages(authority.id, startDate)
    // Keep the better outcome — a retry that fails differently should not
    // discard records the first attempt already collected.
    if (!retried.truncated || retried.applications.length > result.applications.length) {
      result = retried
    }
    if (!result.truncated) break
  }

  // Don't cache pages that were cut short — a later retry may complete them.
  if (!result.truncated) authorityCache.set(cacheKey, result)
  return result
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export interface FetchOptions {
  now?: Date
  onProgress?: (progress: PlanningProgress) => void
}

export async function fetchPlanningApplications(
  boundary: Boundary,
  options: FetchOptions = {}
): Promise<PlanningResult> {
  const { now = new Date(), onProgress } = options
  const startDate = startDateUTC(now)
  const filters = filterKey(startDate)
  const finalKey = `${boundaryHash(boundary)}|${filters}`
  const cached = finalCache.get(finalKey)
  if (cached) {
    onProgress?.({ done: 1, total: 1, authority: null })
    return cached
  }

  const { authorities, truncated: authoritiesTruncated } =
    await fetchAuthorities(boundary)
  const reasons: Exclude<PlanningTruncationReason, null>[] = []
  if (authoritiesTruncated) reasons.push('authority_cap')

  const byName = new Map<string, PlanningApplication>()
  const total = authorities.length
  let done = 0
  onProgress?.({ done: 0, total, authority: null })

  // A mid-run 429 stops the fan-out but keeps what already arrived; the
  // caller only sees RateLimitError when nothing at all was fetched.
  let rateLimited = false
  const queue = [...authorities]
  const worker = async () => {
    for (;;) {
      const authority = queue.shift()
      if (!authority || rateLimited) return
      try {
        const page = await fetchAuthorityCached(authority, startDate, filters)
        if (page.truncationReason) reasons.push(page.truncationReason)
        for (const app of page.applications) byName.set(app.name, app)
      } catch (err) {
        if (err instanceof RateLimitError) {
          rateLimited = true
          reasons.push('rate_limited')
        } else {
          reasons.push(upstreamFailureReason(err))
        }
      }
      done++
      onProgress?.({ done, total, authority: authority.name })
      if (byName.size >= MAX_TOTAL_RECORDS) {
        reasons.push('record_cap')
        return
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, Math.max(total, 1)) }, worker)
  )
  if (rateLimited && byName.size === 0) throw new RateLimitError()

  // Authority queries cover whole council areas, so re-filtering against the
  // request's own full-resolution boundary is what makes the result correct —
  // it can only remove applications outside it, never lose one inside.
  const filteredApplications = Array.from(byName.values()).filter((app) =>
    pointInGeometry(app.lng, app.lat, boundary)
  )
  const finalReason = worstReason(reasons)
  const applications =
    finalReason === 'record_cap'
      ? filteredApplications.slice(0, MAX_TOTAL_RECORDS)
      : filteredApplications

  const result: PlanningResult = {
    applications,
    total: applications.length,
    truncated: Boolean(finalReason),
    truncationReason: finalReason,
  }
  // A truncated result (rate limit, timeout, authority cap) is not cached — a
  // later retry may complete where this request could not.
  if (!result.truncated) finalCache.set(finalKey, result)
  return result
}
