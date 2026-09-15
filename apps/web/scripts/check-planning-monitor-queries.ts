/** Read-only Phase 2 gate for the Planning Monitor: time the shared predicate's count, list and
 * cluster reads on the live store, and check that the three agree.
 * Run from apps/web after applying 20261012000000_planning_monitor.sql:
 *   ../../node_modules/.bin/tsx scripts/check-planning-monitor-queries.ts [--only=leeds] [--repeat=3]
 *
 * Targets from the plan (to be validated, not assumed): p95 normal viewport under 1.5 s, count under 1 s.
 * Clusters mirror the service: no viewport box below zoom 7 (NATIONAL_CLUSTER_ZOOM in service.ts).
 * Each case runs cold then `repeat` warm times. Agreement: totals.applications must equal the number of
 * rows paged in applications mode, and the cluster units must sum to the viewport totals.
 */
import { loadEnvConfig } from '@next/env'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { buildPredicate, defaultCriteria, type MonitorCriteria } from '../src/lib/planning-monitor/criteria'

loadEnvConfig(process.cwd())

type Case = { name: string; bbox: [number, number, number, number]; zoom: number; patch: boolean; criteria?: (c: MonitorCriteria) => void }

const box = (w: number, s: number, e: number, n: number): GeoJSON.Polygon => ({ type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] })

const CASES: Case[] = [
  { name: 'All UK national view, 30 days', bbox: [-8.5, 49.8, 2.0, 60.9], zoom: 5, patch: false },
  { name: 'All UK national view, this year', bbox: [-8.5, 49.8, 2.0, 60.9], zoom: 5, patch: false, criteria: (c) => { c.dates.preset = 'this_year' } },
  { name: 'Leeds patch, 30 days', bbox: [-1.70, 53.74, -1.44, 53.87], zoom: 11, patch: true },
  { name: 'Leeds patch, all history', bbox: [-1.70, 53.74, -1.44, 53.87], zoom: 11, patch: true, criteria: (c) => { c.dates.preset = 'all' } },
  { name: 'Central London dense patch, 90 days', bbox: [-0.20, 51.46, 0.00, 51.54], zoom: 12, patch: true, criteria: (c) => { c.dates.preset = '90d' } },
  { name: 'Cotswolds rural patch, all history', bbox: [-1.80, 51.90, -1.66, 51.98], zoom: 12, patch: true, criteria: (c) => { c.dates.preset = 'all' } },
  { name: 'Edinburgh patch, this year', bbox: [-3.30, 55.90, -3.10, 55.99], zoom: 11, patch: true, criteria: (c) => { c.dates.preset = 'this_year' } },
  { name: 'Cardiff patch, this year', bbox: [-3.28, 51.44, -3.10, 51.54], zoom: 11, patch: true, criteria: (c) => { c.dates.preset = 'this_year' } },
  { name: 'Belfast patch, this year', bbox: [-6.02, 54.55, -5.85, 54.65], zoom: 11, patch: true, criteria: (c) => { c.dates.preset = 'this_year' } },
]

async function timed<T>(fn: () => PromiseLike<{ data: T; error: unknown }>): Promise<{ ms: number; data?: T; error?: string }> {
  const started = Date.now()
  const { data, error } = await fn()
  const ms = Date.now() - started
  if (error) return { ms, error: (error as { message?: string; code?: string }).code + ' ' + (error as { message?: string }).message }
  return { ms, data }
}

async function pagedCount(db: SupabaseClient, p: unknown): Promise<{ rows: number; ms: number; error?: string }> {
  const started = Date.now()
  let afterDate: string | null = null
  let afterKey: string | null = null
  let rows = 0
  for (let page = 0; page < 200; page++) {
    const { data, error } = await db.rpc('planning_monitor_rows', { p, p_grouping: 'applications', p_after_date: afterDate, p_after_key: afterKey, p_limit: 200 })
    if (error) return { rows, ms: Date.now() - started, error: error.message }
    const records = (data ?? []) as Array<{ sort_date: string | null; row_key: string }>
    rows += records.length
    if (records.length < 200) break
    afterDate = records[records.length - 1].sort_date ?? '0001-01-01'
    afterKey = records[records.length - 1].row_key
  }
  return { rows, ms: Date.now() - started }
}

function p95(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)]
}

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7)?.toLowerCase()
  const repeat = Number(process.argv.find((a) => a.startsWith('--repeat='))?.slice(9) ?? 3)
  const countTimes: number[] = []
  const viewTimes: number[] = []

  for (const c of CASES) {
    if (only && !c.name.toLowerCase().includes(only)) continue
    const criteria = defaultCriteria()
    c.criteria?.(criteria)
    const [w, s, e, n] = c.bbox
    const predicate = buildPredicate(criteria, { boundary: c.patch ? box(w, s, e, n) : null })
    const runs = []
    for (let i = 0; i <= repeat; i++) {
      const count = await timed(() => db.rpc('planning_monitor_count', { p: predicate, p_viewport: c.bbox }))
      const clusters = await timed(() => db.rpc('planning_monitor_clusters', { p: c.zoom < 7 ? predicate : { ...predicate, bbox: c.bbox }, p_zoom: c.zoom, p_grouping: 'developments' }))
      const firstPage = await timed(() => db.rpc('planning_monitor_rows', { p: predicate, p_grouping: 'developments', p_limit: 51 }))
      if (i > 0) {
        if (!count.error) countTimes.push(count.ms)
        if (!clusters.error && !firstPage.error) viewTimes.push(clusters.ms + firstPage.ms)
      }
      runs.push({ warm: i > 0, countMs: count.ms, clustersMs: clusters.ms, firstPageMs: firstPage.ms, errors: [count.error, clusters.error, firstPage.error].filter(Boolean) })
      if (i === 0 && count.data && clusters.data) {
        const totals = (count.data as Array<Record<string, number>>)[0]
        const clusterUnits = (clusters.data as Array<{ count: number }>).reduce((sum, cell) => sum + Number(cell.count), 0)
        const paged = Number(totals.applications) <= 20_000 ? await pagedCount(db, predicate) : null
        console.log(JSON.stringify({
          case: c.name,
          totals,
          agreement: {
            clusterUnitsEqualViewportDevelopments: clusterUnits === Number(totals.viewport_developments),
            clusterUnits,
            pagedApplications: paged?.rows ?? 'skipped (over 20,000)',
            pagedEqualsCount: paged ? paged.rows === Number(totals.applications) : null,
            pagedMs: paged?.ms,
          },
        }))
      }
    }
    console.log(JSON.stringify({ case: c.name, runs }))
  }
  console.log(JSON.stringify({ summary: { warmCountP95Ms: p95(countTimes), warmViewP95Ms: p95(viewTimes), targets: { countMs: 1000, viewMs: 1500 } } }))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
