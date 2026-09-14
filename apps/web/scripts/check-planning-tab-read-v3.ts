/** Read-only: time planning_tab_applications_v3 against v2 and account for every difference.
 * v3 decides "inside" with the planar test v2 already used for its inside_boundary flag, so only
 * points within metres of the drawn line may differ; everything else must match in order.
 * Run from apps/web after applying 20261005000000_planar_prefilter_planning_tab_read.sql:
 * ../../node_modules/.bin/tsx scripts/check-planning-tab-read-v3.ts [--only=balham]
 * Each function is read the way stored.ts reads it: three ordered pages of a 2,001-row limit.
 */
import { loadEnvConfig } from '@next/env'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

loadEnvConfig(process.cwd())

const CASES: Array<[string, number, number, number, number]> = [
  ['Cotswolds rural', -1.80, 51.90, -1.66, 51.98],
  ['Birmingham centre', -1.94, 52.46, -1.86, 52.51],
  ['Canterbury', 1.04, 51.25, 1.13, 51.31],
  ['Leeds centre', -1.57, 53.78, -1.52, 53.81],
  ['Manchester centre', -2.26, 53.46, -2.21, 53.49],
  ['Bristol centre', -2.62, 51.44, -2.56, 51.47],
  ['Edinburgh centre', -3.22, 55.94, -3.17, 55.96],
  ['Balham', -0.17, 51.43, -0.12, 51.47],
  ['Wandsworth wider area (cap check)', -0.30, 51.39, -0.10, 51.50],
]

type Row = Record<string, unknown> & { sort_rank: number; id: string }

function describe(error: unknown): string {
  const message = (error as { message?: unknown })?.message
  return typeof message === 'string' ? message : JSON.stringify(error)
}

async function read(db: SupabaseClient, fn: string, boundary: unknown): Promise<{ ms: number; rows?: Row[]; error?: string }> {
  const started = Date.now()
  const rows: Row[] = []
  try {
    for (const [from, to] of [[0, 999], [1000, 1999], [2000, 2000]] as const) {
      const { data, error } = await db.rpc(fn, { p_boundary: boundary, p_limit: 2001 })
        .order('sort_rank', { ascending: true }).range(from, to)
      if (error) throw error
      rows.push(...((data ?? []) as Row[]))
      if ((data ?? []).length < to - from + 1) break
    }
    return { ms: Date.now() - started, rows }
  } catch (error) {
    return { ms: Date.now() - started, error: describe(error) }
  }
}

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const only = process.argv.find(arg => arg.startsWith('--only='))?.slice('--only='.length)
  for (const [name, west, south, east, north] of CASES) {
    if (only && !name.toLowerCase().includes(only.toLowerCase())) continue
    const boundary = { type: 'Polygon', coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]] }
    // v3 first, then v2, then v3 again: the repeat shows how much of the first read was cache warm-up.
    const v3 = await read(db, 'planning_tab_applications_v3', boundary)
    const v2 = await read(db, 'planning_tab_applications_v2', boundary)
    const v3Warm = await read(db, 'planning_tab_applications_v3', boundary)
    let comparison: unknown = 'not compared'
    if (v2.rows && v3.rows) {
      const v2Ids = new Set(v2.rows.map(row => row.id))
      const v3Ids = new Set(v3.rows.map(row => row.id))
      const detail = (row: Row) => ({ id: row.id, provenance: row.location_provenance,
        insideFlag: row.inside_boundary, lng: row.longitude, lat: row.latitude, rank: row.sort_rank })
      const onlyV2 = v2.rows.filter(row => !v3Ids.has(row.id))
      const onlyV3 = v3.rows.filter(row => !v2Ids.has(row.id))
      // Rows in both must carry the same data and keep the same relative order; rank numbers
      // shift when an edge row enters or leaves, so compare without them.
      const strip = ({ sort_rank: _rank, ...rest }: Row) => JSON.stringify(rest)
      const commonV2 = v2.rows.filter(row => v3Ids.has(row.id))
      const commonV3 = v3.rows.filter(row => v2Ids.has(row.id))
      const sameOrder = commonV2.every((row, i) => row.id === commonV3[i].id)
      const dataChanged = sameOrder ? commonV2.filter((row, i) => strip(row) !== strip(commonV3[i])).length : null
      comparison = { v2Rows: v2.rows.length, v3Rows: v3.rows.length, sameOrder, dataChanged,
        onlyV2: onlyV2.length, onlyV3: onlyV3.length,
        examples: [...onlyV2.slice(0, 3).map(detail), ...onlyV3.slice(0, 3).map(detail)] }
    }
    const rankContinuous = v3.rows ? v3.rows.every((row, i) => Number(row.sort_rank) === i + 1) : null
    console.log(JSON.stringify({
      name,
      v3: { ms: v3.ms, rows: v3.rows?.length, error: v3.error, warmMs: v3Warm.ms },
      v2: { ms: v2.ms, rows: v2.rows?.length, error: v2.error },
      comparison, rankContinuous,
    }))
  }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
