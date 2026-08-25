/**
 * M4 gate report: DfT AADF traffic-association coverage for the candidate-site universe,
 * plus the core M4 comparison — do the two linking methods (count_point_direct vs
 * via_road) AGREE, and where they diverge, which is more reliable?
 *
 * Prints TWO funnels, kept SEPARATE (the two-funnel rule):
 *   (1) enrichment universe — all sites >= --min-acres (default 0.3 ac): traffic coverage
 *       under each method, AADF distribution, Counted-vs-Estimated mix, and the method
 *       comparison (agreement, divergence, which method finds higher AADF).
 *   (2) drive-thru subset — 0.3–0.7 ac: same, plus how many have a best via_road AADF
 *       >= --min-aadf (an OCCUPIER signal against the reusable dataset, not baked in).
 *
 * Numbers come from candidate_traffic_coverage() (authoritative SQL counts, not a paged
 * pull — the M2 undercount lesson). Record them in docs/find_sites_mvp.md.
 *
 * Run from apps/web (after associate:candidate-traffic):
 *   npm run inspect:candidate-traffic -- \
 *     [--site-source hmlr_inspire] [--min-acres 0.3] [--min-aadf 10000]
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
const minAadf = arg('min-aadf') ? Number(arg('min-aadf')) : null

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  process.exit(1)
}
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

interface MethodComparison {
  both_methods: number
  same_count_point: number
  different_count_point: number
  via_higher_aadf: number
  direct_higher_aadf: number
  median_abs_aadf_diff: number | null
}
interface Coverage {
  universe: number
  with_traffic_direct: number
  with_traffic_via_road: number
  with_traffic_any: number
  via_aadf_p50: number | null
  via_aadf_p90: number | null
  direct_aadf_p50: number | null
  direct_aadf_p90: number | null
  via_estimation_counts: Record<string, number>
  via_road_category_counts: Record<string, number>
  method_comparison: MethodComparison
  min_aadf: number | null
  qualifying_aadf: number
}

async function coverage(minA: number, maxA: number | null): Promise<Coverage> {
  const { data, error } = await supabase.rpc('candidate_traffic_coverage', {
    p_min_acres: minA,
    p_max_acres: maxA,
    p_min_aadf: minAadf,
    p_site_source: siteSource,
  })
  if (error) throw new Error(error.message)
  return data as Coverage
}

function pct(n: number, d: number): string {
  return d > 0 ? `${Math.round((100 * n) / d)}%` : '—'
}
function n0(v: number | null): string {
  return v == null ? '—' : Math.round(v).toLocaleString()
}
function printCounts(label: string, counts: Record<string, number>) {
  const entries = Object.entries(counts ?? {}).sort((a, b) => b[1] - a[1])
  console.info(`  ${label}`)
  if (entries.length === 0) { console.info('    (none)'); return }
  for (const [k, v] of entries) console.info(`    ${k.padEnd(24)} ${String(v).padStart(6)}`)
}

function printBlock(c: Coverage) {
  console.info(
    `  With traffic — via_road: ${c.with_traffic_via_road.toLocaleString()} (${pct(c.with_traffic_via_road, c.universe)});  ` +
      `direct: ${c.with_traffic_direct.toLocaleString()} (${pct(c.with_traffic_direct, c.universe)});  ` +
      `either: ${c.with_traffic_any.toLocaleString()} (${pct(c.with_traffic_any, c.universe)})`,
  )
  console.info(
    `  Best-pick AADF (All motor vehicles) — via_road p50=${n0(c.via_aadf_p50)} p90=${n0(c.via_aadf_p90)};  ` +
      `direct p50=${n0(c.direct_aadf_p50)} p90=${n0(c.direct_aadf_p90)}`,
  )
  const m = c.method_comparison
  console.info('  Method comparison (sites with a best pick under BOTH methods):')
  console.info(`    both methods:          ${m.both_methods.toLocaleString()}`)
  console.info(`    same count point:      ${m.same_count_point.toLocaleString()} (${pct(m.same_count_point, m.both_methods)})`)
  console.info(`    different count point: ${m.different_count_point.toLocaleString()} (${pct(m.different_count_point, m.both_methods)})`)
  console.info(`      via_road higher AADF:  ${m.via_higher_aadf.toLocaleString()}`)
  console.info(`      direct  higher AADF:  ${m.direct_higher_aadf.toLocaleString()}`)
  console.info(`    median |AADF diff|:    ${n0(m.median_abs_aadf_diff)}`)
  printCounts('via_road best-pick estimation method (Counted vs Estimated):', c.via_estimation_counts)
  printCounts('via_road best-pick DfT road category:', c.via_road_category_counts)
}

async function main() {
  console.info(`\nM4 traffic-association coverage  (site-source=${siteSource})\n${'='.repeat(64)}`)

  // (1) Enrichment universe — all >= min-acres, reported as the reusable dataset.
  const uni = await coverage(minAcres, null)
  console.info(`\n[Funnel 1] Enrichment universe: sites ≥ ${minAcres} ac = ${uni.universe.toLocaleString()}`)
  printBlock(uni)

  // (2) Drive-thru subset — 0.3–0.7 ac — occupier signal, reported SEPARATELY.
  const dt = await coverage(0.3, 0.7)
  console.info(`\n[Funnel 2] Drive-thru subset (0.3–0.7 ac) = ${dt.universe.toLocaleString()}  — occupier signal, NOT baked into the dataset`)
  printBlock(dt)
  if (minAadf != null) {
    console.info(
      `  With a best via_road AADF ≥ ${minAadf.toLocaleString()}: ` +
        `${dt.qualifying_aadf.toLocaleString()} (${pct(dt.qualifying_aadf, dt.universe)})`,
    )
  }

  console.info(
    '\nReminders: AADF is a screening signal, never a traffic-adequacy claim; Counted vs ' +
      'Estimated is preserved (Estimated = modelled, not observed); "no count point nearby" ' +
      'is a real result — DfT AADF samples major roads densely and minor roads sparsely.',
  )
  console.info('Eyeball direct-vs-via divergence on a varied sample:  npm run export:traffic-debug-map\n')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
