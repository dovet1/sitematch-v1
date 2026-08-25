/**
 * M5 gate report: land-use coverage for the candidate-site universe — the pivotal
 * uncertainty. Answers the honest questions the experiment turns on:
 *   - How much of the universe carries ANY land-use signal?
 *   - How much is confidently classified (high/medium/low)?  How much stays unknown?
 *   - What is the class distribution, and which sources contributed?
 *   - Where >=2 sources overlap, do they AGREE on the class or conflict (→ 'mixed')?
 *
 * Prints TWO funnels, kept SEPARATE (the two-funnel rule):
 *   (1) enrichment universe — all sites >= --min-acres (default 0.3 ac).
 *   (2) drive-thru subset — 0.3–0.7 ac.
 *
 * Numbers are computed CLIENT-SIDE from lightweight paged pulls of candidate_sites (the
 * fused class/confidence) + candidate_site_land_use (the evidence), rather than one heavy
 * coverage RPC that re-scans the 74k-row polygon table many times and hits the statement
 * timeout. Every count below is exact (full pages, stable ORDER BY — the M2 lesson).
 *
 * Run from apps/web (after associate:candidate-land-use):
 *   npm run inspect:candidate-land-use -- [--site-source hmlr_inspire] [--min-acres 0.3]
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  process.exit(1)
}
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

interface SiteRow {
  id: string
  area_acres: number | null
  current_land_use: string | null
  land_use_confidence: string | null
}
interface AssocRow {
  candidate_site_id: string
  source: string
  normalised_class: string
  class_confidence: string | null
  relation: string
}

const STRONG_CONF = new Set(['high', 'medium'])
const STRONG_REL = new Set(['covers', 'point_inside'])

async function fetchUniverse(): Promise<SiteRow[]> {
  const out: SiteRow[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('candidate_sites')
      .select('id, area_acres, current_land_use, land_use_confidence')
      .eq('source', siteSource)
      .gte('area_acres', minAcres)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as SiteRow[]
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

async function fetchAssociations(): Promise<AssocRow[]> {
  const out: AssocRow[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('candidate_site_land_use')
      .select('candidate_site_id, source, normalised_class, class_confidence, relation')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as AssocRow[]
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

function pct(n: number, d: number): string {
  return d > 0 ? `${Math.round((100 * n) / d)}%` : '—'
}
function printCounts(label: string, counts: Map<string, number>) {
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1])
  console.info(`  ${label}`)
  if (entries.length === 0) { console.info('    (none)'); return }
  for (const [k, v] of entries) console.info(`    ${k.padEnd(22)} ${String(v).padStart(6)}`)
}

function inc(m: Map<string, number>, k: string) {
  m.set(k, (m.get(k) ?? 0) + 1)
}

function report(
  band: string,
  sites: SiteRow[],
  assocBySite: Map<string, AssocRow[]>,
) {
  const universe = sites.length
  let classified = 0
  let unknown = 0
  const confidence = new Map<string, number>()
  const classDist = new Map<string, number>()
  let withAny = 0
  const sourceContribution = new Map<string, number>()
  let multiSource = 0
  let agree = 0
  let conflict = 0

  for (const s of sites) {
    if (s.current_land_use == null) unknown++
    else {
      classified++
      inc(confidence, s.land_use_confidence ?? '(null)')
      inc(classDist, s.current_land_use)
    }
    const rows = assocBySite.get(s.id)
    if (rows && rows.length) {
      withAny++
      const sources = new Set(rows.map((r) => r.source))
      for (const src of sources) inc(sourceContribution, src)
      if (sources.size >= 2) {
        multiSource++
        const strongClasses = new Set(
          rows
            .filter((r) => STRONG_CONF.has(r.class_confidence ?? '') && STRONG_REL.has(r.relation))
            .map((r) => r.normalised_class),
        )
        if (strongClasses.size === 1) agree++
        else if (strongClasses.size >= 2) conflict++
      }
    }
  }

  const evidenceRows = sites.reduce((a, s) => a + (assocBySite.get(s.id)?.length ?? 0), 0)
  console.info(`\n[${band}] universe = ${universe.toLocaleString()}`)
  console.info(`  Any land-use signal: ${withAny.toLocaleString()} (${pct(withAny, universe)})  from ${evidenceRows.toLocaleString()} evidence rows`)
  console.info(`  Classified:          ${classified.toLocaleString()} (${pct(classified, universe)})`)
  console.info(`  Unknown (retained):  ${unknown.toLocaleString()} (${pct(unknown, universe)})`)
  printCounts('Confidence of classified sites:', confidence)
  printCounts('Class distribution (classified):', classDist)
  printCounts('Source contribution (sites with evidence from each source):', sourceContribution)
  console.info('  Multi-source agreement (sites with >=2 evidence sources):')
  console.info(`    multi-source sites: ${multiSource.toLocaleString()}`)
  console.info(`    agree (one strong class):      ${agree.toLocaleString()} (${pct(agree, multiSource)})`)
  console.info(`    conflict (>=2 strong → mixed): ${conflict.toLocaleString()} (${pct(conflict, multiSource)})`)
}

async function main() {
  console.info(`\nM5 land-use coverage  (site-source=${siteSource})\n${'='.repeat(64)}`)
  const sites = await fetchUniverse()
  const assoc = await fetchAssociations()
  const assocBySite = new Map<string, AssocRow[]>()
  for (const r of assoc) {
    const list = assocBySite.get(r.candidate_site_id)
    if (list) list.push(r)
    else assocBySite.set(r.candidate_site_id, [r])
  }

  report(`Funnel 1] Enrichment universe: sites ≥ ${minAcres} ac`, sites, assocBySite)

  const driveThru = sites.filter((s) => s.area_acres != null && s.area_acres >= 0.3 && s.area_acres < 0.7)
  report('Funnel 2] Drive-thru subset (0.3–0.7 ac), reported SEPARATELY', driveThru, assocBySite)

  console.info(
    '\nReminders: land use is FUSED evidence, not an authoritative source; `unknown` is a ' +
      'real result (retained, never a fail); a class is never a suitability/planning claim; ' +
      'store evidence is broad (retail) — brand-category refinement deferred.',
  )
  console.info('Eyeball classifications against the ground on a varied sample:  npm run export:land-use-debug-map\n')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
