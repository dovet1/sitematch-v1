/**
 * M8 gate report: constraint coverage (EA Flood Zones 2/3 + English Green Belt) across the
 * candidate-site universe.
 *
 * Prints TWO funnels, kept SEPARATE (the two-funnel rule):
 *   (1) enrichment universe — all sites >= --min-acres (default 0.3 ac): how many intersect
 *       each constraint type, the overlap-band distribution, flood/green-belt combinations,
 *       and how many are CLEAR of every loaded layer.
 *   (2) drive-thru subset — 0.3–0.7 ac: the same, as an OCCUPIER view against the reusable
 *       dataset (constraints do not eliminate here — severity is a search-time decision).
 *
 * Honest-absence framing preserved: a site with no intersecting feature is "not within the
 * mapped Flood Zone 2/3 / Green Belt", NOT a "no flood risk / no nearby designation" claim.
 * The report also lists which constraint layers were actually loaded, so an absent layer is
 * never mistaken for a clean site.
 *
 * Counts are computed CLIENT-SIDE from paged pulls (candidate_sites id+area +
 * candidate_site_constraints), deliberately NOT via a coverage RPC — every prior enrichment
 * coverage RPC (M5 land use, M6 geometry) re-scanned the 74k candidate_sites table per
 * sub-metric and hit the statement timeout.
 *
 * Run from apps/web (after associate:candidate-constraints):
 *   npm run inspect:candidate-constraints -- [--site-source hmlr_inspire] [--min-acres 0.3]
 */

import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { classifyOverlap, type OverlapBand } from '../src/lib/site-matching/constraint-screening'

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

interface SiteRow { id: string; area_acres: number | null }
interface ConstraintRow {
  candidate_site_id: string
  constraint_type: string
  category: string
  overlap_fraction: number | null
}

function n(v: unknown): number | null {
  if (v == null) return null
  const x = Number(v)
  return Number.isFinite(x) ? x : null
}

// KEYSET pagination on the PK (id > :last) — NOT offset .range(): a deep OFFSET over the
// 74k candidate_sites table is O(offset) and blows the statement timeout (the M7 lesson).
// Seed with the zero-UUID (NOT '', which is an invalid uuid).
const ZERO_UUID = '00000000-0000-0000-0000-000000000000'

async function fetchUniverse(): Promise<SiteRow[]> {
  const out: SiteRow[] = []
  const PAGE = 1000
  let last = ZERO_UUID
  for (;;) {
    const { data, error } = await supabase
      .from('candidate_sites')
      .select('id, area_acres')
      .eq('source', siteSource)
      .gte('area_acres', minAcres)
      .gt('id', last)
      .order('id', { ascending: true })
      .limit(PAGE)
    if (error) throw new Error(error.message)
    const page = data ?? []
    for (const r of page) out.push({ id: r.id as string, area_acres: n(r.area_acres) })
    if (page.length < PAGE) break
    last = page[page.length - 1].id as string
  }
  return out
}

async function fetchConstraints(): Promise<Map<string, ConstraintRow[]>> {
  const map = new Map<string, ConstraintRow[]>()
  const PAGE = 1000
  let last = ZERO_UUID
  for (;;) {
    const { data, error } = await supabase
      .from('candidate_site_constraints')
      .select('id, candidate_site_id, constraint_type, category, overlap_fraction')
      .gt('id', last)
      .order('id', { ascending: true })
      .limit(PAGE)
    if (error) throw new Error(error.message)
    const page = data ?? []
    for (const r of page) {
      const row: ConstraintRow = {
        candidate_site_id: r.candidate_site_id as string,
        constraint_type: r.constraint_type as string,
        category: r.category as string,
        overlap_fraction: n(r.overlap_fraction),
      }
      const list = map.get(row.candidate_site_id)
      if (list) list.push(row)
      else map.set(row.candidate_site_id, [row])
    }
    if (page.length < PAGE) break
    last = page[page.length - 1].id as string
  }
  return map
}

// Which constraint layers were actually loaded (so an absent layer ≠ a clean site).
async function fetchLoadedLayers(): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  const PAGE = 1000
  let last = ZERO_UUID
  for (;;) {
    const { data, error } = await supabase
      .from('constraint_features')
      .select('id, constraint_type')
      .gt('id', last)
      .order('id', { ascending: true })
      .limit(PAGE)
    if (error) throw new Error(error.message)
    const page = data ?? []
    for (const r of page) {
      const t = r.constraint_type as string
      counts.set(t, (counts.get(t) ?? 0) + 1)
    }
    if (page.length < PAGE) break
    last = page[page.length - 1].id as string
  }
  return counts
}

function pct(x: number, d: number): string {
  return d > 0 ? `${Math.round((100 * x) / d)}%` : '—'
}

const BANDS: OverlapBand[] = ['none', 'marginal', 'partial', 'majority', 'within']

function report(tag: string, isDriveThru: boolean, sites: SiteRow[], constraints: Map<string, ConstraintRow[]>) {
  const universe = sites.length
  // Real intersections only (constraint-screening drops sub-epsilon clips from the token list).
  const perType = new Map<string, number>() // sites intersecting each type (band !== none)
  const bandDist = new Map<string, Map<OverlapBand, number>>()
  let anyConstraint = 0
  let clear = 0
  let floodAny = 0
  let greenBelt = 0
  let floodAndGreenBelt = 0
  let fz3 = 0
  let fz3AndFz2 = 0

  for (const s of sites) {
    const rows = (constraints.get(s.id) ?? []).filter((r) => classifyOverlap(r.overlap_fraction) !== 'none')
    const types = new Set(rows.map((r) => r.constraint_type))
    if (types.size === 0) { clear++; continue }
    anyConstraint++
    const hasFlood = Array.from(types).some((t) => t.startsWith('flood'))
    const hasGb = types.has('green_belt')
    if (hasFlood) floodAny++
    if (hasGb) greenBelt++
    if (hasFlood && hasGb) floodAndGreenBelt++
    if (types.has('flood_zone_3')) fz3++
    if (types.has('flood_zone_3') && types.has('flood_zone_2')) fz3AndFz2++
    for (const r of rows) {
      perType.set(r.constraint_type, (perType.get(r.constraint_type) ?? 0) + 1)
      const band = classifyOverlap(r.overlap_fraction)
      if (!bandDist.has(r.constraint_type)) bandDist.set(r.constraint_type, new Map())
      const bm = bandDist.get(r.constraint_type)!
      bm.set(band, (bm.get(band) ?? 0) + 1)
    }
  }

  console.info(`\n[${tag}] ${isDriveThru ? 'Drive-thru subset (0.3–0.7 ac)' : `Enrichment universe: sites ≥ ${minAcres} ac`} = ${universe.toLocaleString()}`)
  console.info(`  Any constraint intersecting: ${anyConstraint.toLocaleString()} (${pct(anyConstraint, universe)});  clear of all loaded layers: ${clear.toLocaleString()} (${pct(clear, universe)})`)
  console.info('  Per constraint type (sites with a real intersection):')
  for (const t of Array.from(perType.keys()).sort()) {
    const c = perType.get(t) ?? 0
    const bm = bandDist.get(t) ?? new Map<OverlapBand, number>()
    const bands = BANDS.map((b) => `${b} ${bm.get(b) ?? 0}`).join(', ')
    console.info(`    ${t.padEnd(16)} ${String(c).padStart(6)}  ${pct(c, universe).padStart(4)}   [${bands}]`)
  }
  console.info(
    `  Flood zone (any): ${floodAny.toLocaleString()} (${pct(floodAny, universe)});  ` +
      `Flood Zone 3: ${fz3.toLocaleString()} (${pct(fz3, universe)});  Green Belt: ${greenBelt.toLocaleString()} (${pct(greenBelt, universe)})`,
  )
  console.info(`  Both flood + green belt: ${floodAndGreenBelt.toLocaleString()};  FZ3 within FZ2 (both present): ${fz3AndFz2.toLocaleString()}`)
}

async function main() {
  console.info(`\nM8 constraint coverage  (site-source=${siteSource})\n${'='.repeat(60)}`)
  const [universe, constraints, loaded] = await Promise.all([fetchUniverse(), fetchConstraints(), fetchLoadedLayers()])

  console.info('\nConstraint layers loaded (constraint_features):')
  if (loaded.size === 0) console.info('  (none — run import:constraints first; every site will report as "clear", which would be misleading)')
  for (const [t, c] of Array.from(loaded.entries()).sort()) console.info(`  ${t.padEnd(16)} ${c.toLocaleString()} features`)

  report('Funnel 1', false, universe, constraints)
  const driveThru = universe.filter((s) => s.area_acres != null && s.area_acres >= 0.3 && s.area_acres < 0.7)
  report('Funnel 2', true, driveThru, constraints)

  console.info(
    '\nReminders: a constraint intersection is a SCREENING FLAG requiring review — never a ' +
      'suitability / developability / planning-permission verdict. "Clear" means "not within ' +
      'the mapped Flood Zone 2/3 / Green Belt", NOT "no flood risk / no nearby designation". ' +
      'Severity (exclude/warn/prefer) is applied per occupier at search time.',
  )
  console.info('Eyeball a geographically varied sample:  npm run export:constraint-debug-map\n')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
