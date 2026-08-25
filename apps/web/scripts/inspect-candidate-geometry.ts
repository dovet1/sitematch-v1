/**
 * M6 gate report: derived-geometry coverage (approximate frontage + nearest
 * significant junction/roundabout distance) for the candidate-site universe.
 *
 * Prints TWO funnels, kept SEPARATE (the two-funnel rule):
 *   (1) enrichment universe — all sites >= --min-acres (default 0.3 ac): frontage
 *       unknown-vs-measured split, frontage bands + distribution, junction proximity.
 *   (2) drive-thru subset — 0.3–0.7 ac: frontage >= --frontage-min and junction
 *       within --junction-max, as an OCCUPIER search signal shown against the reusable
 *       dataset, not baked into it.
 *
 * Crucial distinction preserved throughout: frontage is UNKNOWN when no road was
 * associated (missing data), and a real measured ZERO ("no abutting edge") only when a
 * road IS nearby — the two are never conflated.
 *
 * Counts are computed CLIENT-SIDE from paged pulls of candidate_sites (id + area) and
 * candidate_site_geometry, deliberately NOT via the candidate_geometry_coverage() RPC:
 * that RPC re-scans the 74k-row candidate_sites table per sub-metric and hits the
 * statement timeout at this data scale (the same lesson as M5's land-use coverage RPC).
 *
 * Run from apps/web (after associate:candidate-geometry):
 *   npm run inspect:candidate-geometry -- \
 *     [--site-source hmlr_inspire] [--min-acres 0.3] [--frontage-min 20] [--junction-max 100]
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
const frontageMinM = arg('frontage-min') ? Number(arg('frontage-min')) : 20
const junctionMaxM = arg('junction-max') ? Number(arg('junction-max')) : 100

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
interface GeomRow {
  candidate_site_id: string
  has_associated_road: boolean
  frontage_m: number | null
  primary_frontage_m: number | null
  nearest_junction_m: number | null
  nearest_roundabout_m: number | null
}

function n(v: unknown): number | null {
  if (v == null) return null
  const x = Number(v)
  return Number.isFinite(x) ? x : null
}

// Paged pulls with a stable ORDER BY (the M2 lesson: unpaged/unordered .range() repeats/skips).
async function fetchUniverse(): Promise<SiteRow[]> {
  const out: SiteRow[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('candidate_sites')
      .select('id, area_acres')
      .eq('source', siteSource)
      .gte('area_acres', minAcres)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const page = data ?? []
    for (const r of page) out.push({ id: r.id as string, area_acres: n(r.area_acres) })
    if (page.length < PAGE) break
  }
  return out
}

async function fetchGeometry(): Promise<Map<string, GeomRow>> {
  const map = new Map<string, GeomRow>()
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('candidate_site_geometry')
      .select('candidate_site_id, has_associated_road, frontage_m, primary_frontage_m, nearest_junction_m, nearest_roundabout_m')
      .order('candidate_site_id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const page = data ?? []
    for (const r of page) {
      map.set(r.candidate_site_id as string, {
        candidate_site_id: r.candidate_site_id as string,
        has_associated_road: Boolean(r.has_associated_road),
        frontage_m: n(r.frontage_m),
        primary_frontage_m: n(r.primary_frontage_m),
        nearest_junction_m: n(r.nearest_junction_m),
        nearest_roundabout_m: n(r.nearest_roundabout_m),
      })
    }
    if (page.length < PAGE) break
  }
  return map
}

function pct(x: number, d: number): string {
  return d > 0 ? `${Math.round((100 * x) / d)}%` : '—'
}
function pctile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))
  return sorted[idx]
}
function m(v: number | null): string {
  return v == null ? '—' : `${v.toFixed(1)}m`
}

function report(tag: string, isDriveThru: boolean, sites: SiteRow[], geom: Map<string, GeomRow>) {
  const universe = sites.length
  const rows = sites.map((s) => geom.get(s.id)).filter((g): g is GeomRow => g != null)
  const enriched = rows.length

  const measured = rows.filter((g) => g.has_associated_road && g.frontage_m != null)
  const frontageUnknown = enriched - measured.length + (universe - enriched) // no geom row = unknown too
  const frontageNone = measured.filter((g) => (g.frontage_m as number) <= 1).length
  const frontageGeMin = measured.filter((g) => (g.frontage_m as number) >= frontageMinM).length
  const positive = measured.map((g) => g.frontage_m as number).filter((x) => x > 1).sort((a, b) => a - b)
  const bands = {
    none: measured.filter((g) => (g.frontage_m as number) <= 1).length,
    narrow: measured.filter((g) => (g.frontage_m as number) > 1 && (g.frontage_m as number) < 10).length,
    moderate: measured.filter((g) => (g.frontage_m as number) >= 10 && (g.frontage_m as number) < 40).length,
    wide: measured.filter((g) => (g.frontage_m as number) >= 40).length,
  }
  const primaryMeasured = rows.filter((g) => g.primary_frontage_m != null).length
  const primaryGeMin = rows.filter((g) => (g.primary_frontage_m ?? -1) >= frontageMinM).length

  const withJunction = rows.filter((g) => g.nearest_junction_m != null)
  const junctionWithin = withJunction.filter((g) => (g.nearest_junction_m as number) <= junctionMaxM).length
  const jSorted = withJunction.map((g) => g.nearest_junction_m as number).sort((a, b) => a - b)
  const jBands = {
    at: withJunction.filter((g) => (g.nearest_junction_m as number) <= 25).length,
    near: withJunction.filter((g) => (g.nearest_junction_m as number) > 25 && (g.nearest_junction_m as number) <= 100).length,
    moderate: withJunction.filter((g) => (g.nearest_junction_m as number) > 100 && (g.nearest_junction_m as number) <= 300).length,
    far: withJunction.filter((g) => (g.nearest_junction_m as number) > 300).length,
  }
  const withRoundabout = rows.filter((g) => g.nearest_roundabout_m != null).length

  console.info(`\n[${tag}] ${isDriveThru ? 'Drive-thru subset (0.3–0.7 ac)' : `Enrichment universe: sites ≥ ${minAcres} ac`} = ${universe.toLocaleString()}`)
  console.info(`  Enriched (candidate_site_geometry rows): ${enriched.toLocaleString()} (${pct(enriched, universe)})`)
  console.info(
    `  Frontage: unknown (no road associated) ${frontageUnknown.toLocaleString()} (${pct(frontageUnknown, universe)});  ` +
      `measured ${measured.length.toLocaleString()} (${pct(measured.length, universe)}) — of which none/no-abutting-edge ${frontageNone.toLocaleString()}`,
  )
  console.info(`  Measured frontage (positive only): p50=${m(pctile(positive, 0.5))}  p90=${m(pctile(positive, 0.9))}`)
  console.info('  Frontage bands (of measured):')
  console.info(`    none (≤1 m)        ${String(bands.none).padStart(6)}  ${pct(bands.none, measured.length)}`)
  console.info(`    narrow (<10 m)     ${String(bands.narrow).padStart(6)}  ${pct(bands.narrow, measured.length)}`)
  console.info(`    moderate (10–40 m) ${String(bands.moderate).padStart(6)}  ${pct(bands.moderate, measured.length)}`)
  console.info(`    wide (≥40 m)       ${String(bands.wide).padStart(6)}  ${pct(bands.wide, measured.length)}`)
  console.info(
    `  Frontage ≥ ${frontageMinM}m: ${frontageGeMin.toLocaleString()} (${pct(frontageGeMin, universe)} of universe);  ` +
      `onto a classified road: ${primaryGeMin.toLocaleString()} (of ${primaryMeasured.toLocaleString()} with a classified road)`,
  )
  console.info(
    `  Nearest significant junction: present ${withJunction.length.toLocaleString()} (${pct(withJunction.length, universe)});  ` +
      `within ${junctionMaxM}m ${junctionWithin.toLocaleString()} (${pct(junctionWithin, universe)})`,
  )
  console.info(`  Junction distance: p50=${m(pctile(jSorted, 0.5))}  p90=${m(pctile(jSorted, 0.9))};  with a roundabout nearby: ${withRoundabout.toLocaleString()}`)
  console.info('  Junction proximity bands:')
  console.info(`    at (≤25 m)         ${String(jBands.at).padStart(6)}  ${pct(jBands.at, withJunction.length)}`)
  console.info(`    near (≤100 m)      ${String(jBands.near).padStart(6)}  ${pct(jBands.near, withJunction.length)}`)
  console.info(`    moderate (≤300 m)  ${String(jBands.moderate).padStart(6)}  ${pct(jBands.moderate, withJunction.length)}`)
  console.info(`    far (>300 m)       ${String(jBands.far).padStart(6)}  ${pct(jBands.far, withJunction.length)}`)
}

async function main() {
  console.info(`\nM6 derived-geometry coverage  (site-source=${siteSource})\n${'='.repeat(60)}`)
  const [universe, geom] = await Promise.all([fetchUniverse(), fetchGeometry()])

  report('Funnel 1', false, universe, geom)
  const driveThru = universe.filter((s) => s.area_acres != null && s.area_acres >= 0.3 && s.area_acres < 0.7)
  report('Funnel 2', true, driveThru, geom)

  console.info(
    '\nReminders: frontage + junction distance are DOCUMENTED APPROXIMATIONS from open ' +
      'centreline data — screening signals for review, never a surveyed frontage or a ' +
      'highways/access claim. Frontage "unknown" (no road) is distinct from a measured zero.',
  )
  console.info('Eyeball a geographically varied sample:  npm run export:geometry-debug-map\n')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
