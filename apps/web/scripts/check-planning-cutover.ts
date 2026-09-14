/** Read-only cutover measurement against the settled national store. No feature flags change.
 * Run from apps/web: ../../node_modules/.bin/tsx --require ./scripts/lib/server-only-stub.cjs scripts/check-planning-cutover.ts
 * The stub lets the tab's real server-only read path run outside Next.
 */
import { loadEnvConfig } from '@next/env'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { validateBoundary, type Boundary } from '../src/app/api/public/planning/boundary'
import { fetchStoredPlanningApplications } from '../src/app/api/public/planning/stored'

loadEnvConfig(process.cwd())

interface RankedRow {
  id: string
  sort_rank: number
  relevance: string | null
  date_received: string | null
  inside_boundary: boolean
}

const RANKED_READ = 'planning_tab_applications_v3' // what stored.ts calls

// Comparison boxes, not estates. The first four repeat the 10 September pilot; the rest add
// other authorities, all four nations and a rural area now that the national store is loaded.
const CASES: Array<[string, number, number, number, number]> = [
  ['Balham', -0.17, 51.43, -0.12, 51.47],
  ['Birmingham centre', -1.94, 52.46, -1.86, 52.51],
  ['Canterbury', 1.04, 51.25, 1.13, 51.31],
  ['Wandsworth wider area (cap check)', -0.30, 51.39, -0.10, 51.50],
  ['Manchester centre', -2.26, 53.46, -2.21, 53.49],
  ['Leeds centre', -1.57, 53.78, -1.52, 53.81],
  ['Bristol centre', -2.62, 51.44, -2.56, 51.47],
  ['Cardiff centre', -3.20, 51.46, -3.15, 51.50],
  ['Edinburgh centre', -3.22, 55.94, -3.17, 55.96],
  ['Belfast centre', -5.95, 54.58, -5.91, 54.61],
  ['Cotswolds rural', -1.80, 51.90, -1.66, 51.98],
]

async function rankedRows(db: SupabaseClient, boundary: Boundary, limit: number) {
  const rows: RankedRow[] = []
  for (let from = 0; from < limit; from += 1000) {
    const to = Math.min(from + 999, limit - 1)
    const result = await db.rpc(RANKED_READ, { p_boundary: boundary, p_limit: limit })
      .order('sort_rank', { ascending: true }).range(from, to)
    if (result.error) throw result.error
    rows.push(...((result.data ?? []) as RankedRow[]))
    if ((result.data ?? []).length < to - from + 1) break
  }
  return rows
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message
  const message = (error as { message?: unknown })?.message
  return typeof message === 'string' ? message : JSON.stringify(error)
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase credentials are not configured')
  const db = createClient(url, key, { auth: { persistSession: false } })
  const only = process.argv.find(arg => arg.startsWith('--only='))?.slice('--only='.length)
  // A cap proof needs every match; raise this for very dense boundaries (--full-read-limit=60001).
  const fullReadLimit = Number(process.argv.find(arg => arg.startsWith('--full-read-limit='))?.split('=')[1] ?? 20001)
  const relevanceOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
  const compare = (a: RankedRow, b: RankedRow) => {
    const band = (relevanceOrder[a.relevance ?? ''] ?? 3) - (relevanceOrder[b.relevance ?? ''] ?? 3)
    if (band) return band
    if (a.date_received !== b.date_received) {
      if (a.date_received === null) return 1
      if (b.date_received === null) return -1
      return a.date_received > b.date_received ? -1 : 1
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  }

  for (const [name, west, south, east, north] of CASES) {
    if (only && !name.toLowerCase().includes(only.toLowerCase())) continue
    const boundary: Boundary = { type: 'Polygon', coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]] }
    const invalid = validateBoundary(boundary)
    if (invalid) throw new Error(`${name}: ${invalid}`)

    // 1. The tab's own read, timed end to end, including its freshness caption.
    let tab: Record<string, unknown>
    let started = Date.now()
    try {
      const result = await fetchStoredPlanningApplications(boundary)
      tab = { ms: Date.now() - started, shown: result.total, truncated: result.truncated,
        freshness: result.freshness?.stale ? result.freshness.staleReason : 'current' }
    } catch (error) {
      tab = { ms: Date.now() - started, error: describe(error) }
    }

    // 2. Ordering and cap proof on the same ranked read.
    let rows: RankedRow[]
    started = Date.now()
    try {
      rows = await rankedRows(db, boundary, 2001)
    } catch (error) {
      console.log(JSON.stringify({ name, tab, stored: { ms: Date.now() - started, error: describe(error) } }))
      continue
    }
    const rankedMs = Date.now() - started
    const ordered = rows.every((row, i) => Number(row.sort_rank) === i + 1 &&
      (i === 0 || compare(rows[i - 1], row) <= 0)) && new Set(rows.map(row => row.id)).size === rows.length
    let capProof: unknown = null
    if (rows.length > 2000) {
      const all = await rankedRows(db, boundary, fullReadLimit).catch((error: unknown) => {
        console.log(JSON.stringify({ name, capProofError: describe(error) }))
        return null
      })
      if (!all) continue
      const complete = all.length < fullReadLimit
      const expected = [...all].sort(compare).slice(0, 2000)
      const newest = new Set([...all].sort((a, b) =>
        (b.date_received ?? '').localeCompare(a.date_received ?? '') || a.id.localeCompare(b.id))
        .slice(0, 2000).map(row => row.id))
      capProof = { fullCount: all.length, fullReadComplete: complete,
        matchesFullSort: complete && expected.every((row, i) => row.id === rows[i].id),
        rankedRecordsANewest2000CutWouldDrop: complete ? expected.filter(row =>
          row.relevance !== null && !newest.has(row.id)).length : null }
    }
    const shown = rows.slice(0, 2000)

    console.log(JSON.stringify({ name, tab, stored: {
      rankedMs,
      matched: rows.length > 2000 ? '2000+' : rows.length,
      overlapOnly: shown.filter(row => row.inside_boundary === false).length,
      relevance: Object.fromEntries(['high', 'medium', 'low', 'unclassified'].map(band =>
        [band, shown.filter(row => (row.relevance ?? 'unclassified') === band).length])),
      newestReceived: shown.map(row => row.date_received).filter(Boolean).sort().at(-1) ?? null,
      ordered, capProof,
    } }))
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
