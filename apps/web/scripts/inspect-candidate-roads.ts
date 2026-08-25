/**
 * M3 gate report: road-association coverage for the candidate-site universe.
 *
 * Prints TWO funnels, kept SEPARATE (the two-funnel rule):
 *   (1) enrichment universe — all sites >= --min-acres (default 0.3 ac): overall road
 *       coverage, nearest-road distance distribution, best-class distribution.
 *   (2) drive-thru subset — 0.3–0.7 ac: how many have a qualifying A/B road within
 *       --qualifying-distance (default 100 m). This is an OCCUPIER search signal shown
 *       against the reusable dataset, not baked into it.
 *
 * Numbers come from the candidate_road_coverage() SQL RPC (authoritative counts, not a
 * paged pull — the M2 undercount lesson). Record them in docs/find_sites_mvp.md.
 *
 * Run from apps/web (after associate:candidate-roads):
 *   npm run inspect:candidate-roads -- \
 *     [--site-source hmlr_inspire] [--min-acres 0.3] [--qualifying-distance 100]
 */

import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'

loadEnvConfig(process.cwd())

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const siteSource = arg('site-source') ?? 'hmlr_inspire'
const minAcres = arg('min-acres') ? Number(arg('min-acres')) : 0.3
const qualifyingDistanceM = arg('qualifying-distance') ? Number(arg('qualifying-distance')) : 100

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  process.exit(1)
}
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

interface Coverage {
  universe: number
  with_any_road: number
  without_any_road: number
  nearest_distance_p50: number | null
  nearest_distance_p90: number | null
  best_class_counts: Record<string, number>
  nearest_within_bands: Record<string, number>
  qualifying_ab_within: number
  qualifying_distance_m: number
}

async function coverage(minA: number, maxA: number | null): Promise<Coverage> {
  const { data, error } = await supabase.rpc('candidate_road_coverage', {
    p_min_acres: minA,
    p_max_acres: maxA,
    p_qualifying_distance_m: qualifyingDistanceM,
    p_site_source: siteSource,
  })
  if (error) throw new Error(error.message)
  return data as Coverage
}

function pct(n: number, d: number): string {
  return d > 0 ? `${Math.round((100 * n) / d)}%` : '—'
}

function printBands(c: Coverage) {
  const b = c.nearest_within_bands ?? {}
  const order: Array<[string, string]> = [
    ['le_10m', '≤ 10 m'],
    ['le_30m', '≤ 30 m'],
    ['le_50m', '≤ 50 m'],
    ['le_100m', '≤ 100 m'],
    ['le_200m', '≤ 200 m'],
  ]
  console.info('  Nearest road within (cumulative, of the whole band):')
  for (const [key, label] of order) {
    const n = b[key] ?? 0
    console.info(`    ${label.padEnd(9)} ${String(n).padStart(6)}  ${pct(n, c.universe)}`)
  }
}

function printBestClass(c: Coverage) {
  const entries = Object.entries(c.best_class_counts ?? {}).sort((a, b) => b[1] - a[1])
  console.info('  Best (nearest-overall) road class:')
  for (const [cls, n] of entries) {
    console.info(`    ${cls.padEnd(22)} ${String(n).padStart(6)}  ${pct(n, c.universe)}`)
  }
}

async function main() {
  console.info(`\nM3 road-association coverage  (site-source=${siteSource})\n${'='.repeat(60)}`)

  // (1) Enrichment universe — all >= min-acres, reported as the reusable dataset.
  const uni = await coverage(minAcres, null)
  console.info(`\n[Funnel 1] Enrichment universe: sites ≥ ${minAcres} ac = ${uni.universe.toLocaleString()}`)
  console.info(
    `  With a road nearby (within the association search radius): ` +
      `${uni.with_any_road.toLocaleString()} (${pct(uni.with_any_road, uni.universe)});  ` +
      `no road nearby: ${uni.without_any_road.toLocaleString()} (${pct(uni.without_any_road, uni.universe)})`,
  )
  const p50 = uni.nearest_distance_p50
  const p90 = uni.nearest_distance_p90
  console.info(
    `  Nearest-road distance: p50=${p50 == null ? '—' : `${Number(p50).toFixed(1)}m`}  ` +
      `p90=${p90 == null ? '—' : `${Number(p90).toFixed(1)}m`}`,
  )
  printBands(uni)
  printBestClass(uni)

  // (2) Drive-thru subset — 0.3–0.7 ac — occupier signal, reported SEPARATELY.
  const dt = await coverage(0.3, 0.7)
  console.info(`\n[Funnel 2] Drive-thru subset (0.3–0.7 ac) = ${dt.universe.toLocaleString()}  — occupier signal, NOT baked into the dataset`)
  console.info(
    `  With a road nearby: ${dt.with_any_road.toLocaleString()} (${pct(dt.with_any_road, dt.universe)})`,
  )
  console.info(
    `  With a qualifying A/B road ≤ ${qualifyingDistanceM}m: ` +
      `${dt.qualifying_ab_within.toLocaleString()} (${pct(dt.qualifying_ab_within, dt.universe)})`,
  )
  printBestClass(dt)

  console.info(
    '\nReminders: distance/class are screening signals (never a suitability/access claim); ' +
      '"no road nearby" is a real result, not a data gap once association has run.',
  )
  console.info('Eyeball a geographically varied sample:  npm run export:road-debug-map\n')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
