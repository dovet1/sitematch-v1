/**
 * M7 gate report: same-brand distance (existing estate) for the candidate-site
 * universe, computed at SEARCH TIME against a chosen brand's live `stores` estate.
 *
 * Unlike M3–M6 there is NO enrichment table — same-brand distance depends on WHICH
 * brand is searching, so nothing is precomputed. This script picks a brand, calls the
 * nearest_same_brand_store() RPC in batches over the 8,226 universe, and reports the
 * distance distribution client-side (the RPC never re-scans the 74k table, so no
 * timeout — the M5/M6 lesson). Two funnels are kept SEPARATE.
 *
 * "Same brand" = the PARENT-GROUP estate (nearest store of ANY fascia the brand runs).
 *
 * Run from apps/web (after applying 20260732000000_same_brand_distance.sql):
 *   npm run inspect:candidate-brand -- --list-brands          # brands present near Canterbury (pick one)
 *   npm run inspect:candidate-brand -- --brand-name "costa"   # resolve a brand by name, then report
 *   npm run inspect:candidate-brand -- --brand <uuid> [--fascia <uuid,uuid>] \
 *     [--site-source hmlr_inspire] [--min-acres 0.3] [--min-miles 1] [--batch 500] [--bbox 1.00,51.22,1.20,51.32]
 */

import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import {
  classifyBrandDistance,
  METRES_PER_MILE,
  type BrandEstateRaw,
} from '../src/lib/site-matching/brand-distance'

loadEnvConfig(process.cwd())

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

const siteSource = arg('site-source') ?? 'hmlr_inspire'
const minAcres = arg('min-acres') ? Number(arg('min-acres')) : 0.3
const minMiles = arg('min-miles') ? Number(arg('min-miles')) : 1
// Each site KNN-sorts the whole materialized brand estate (~7–10 ms/site), so keep the
// per-call batch small enough to stay under the statement timeout (500 ≈ 3.6 s is at the
// edge; 150 ≈ 1.1 s is safe). Tunable via --batch.
const batchSize = arg('batch') ? Number(arg('batch')) : 150
const brandId = arg('brand')
const brandName = arg('brand-name')
const fasciaIds = arg('fascia') ? (arg('fascia') as string).split(',').map((s) => s.trim()) : null
const listBrands = flag('list-brands')
const bbox = (arg('bbox') ?? '1.00,51.22,1.20,51.32').split(',').map(Number) // minLon,minLat,maxLon,maxLat

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

function n(v: unknown): number | null {
  if (v == null) return null
  const x = Number(v)
  return Number.isFinite(x) ? x : null
}
function pct(x: number, d: number): string {
  return d > 0 ? `${Math.round((100 * x) / d)}%` : '—'
}
function pctile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))
  return sorted[idx]
}
function mi(m: number | null): string {
  return m == null ? '—' : `${(m / METRES_PER_MILE).toFixed(2)} mi`
}

// Enumerate brands with stores inside the Canterbury bbox, so we can choose a brand
// that is genuinely present locally for the M7 validation. Uses the existing
// get_stores_in_bbox() spatial helper, aggregates client-side.
async function listBrandsNearCanterbury(): Promise<void> {
  const { data, error } = await supabase.rpc('get_stores_in_bbox', {
    p_min_lon: bbox[0], p_min_lat: bbox[1], p_max_lon: bbox[2], p_max_lat: bbox[3], p_fascia_ids: null,
  })
  if (error) throw new Error(error.message)
  const stores = (data ?? []) as { brand_id: string | null; fascia_id: string | null }[]
  const byBrand = new Map<string, { stores: number; fascias: Set<string> }>()
  for (const s of stores) {
    if (!s.brand_id) continue
    if (!byBrand.has(s.brand_id)) byBrand.set(s.brand_id, { stores: 0, fascias: new Set() })
    const b = byBrand.get(s.brand_id)!
    b.stores++
    if (s.fascia_id) b.fascias.add(s.fascia_id)
  }
  const ids = Array.from(byBrand.keys())
  const names = new Map<string, string>()
  for (let i = 0; i < ids.length; i += 200) {
    const { data: bs, error: bErr } = await supabase.from('brands').select('id, name').in('id', ids.slice(i, i + 200))
    if (bErr) throw new Error(bErr.message)
    for (const b of bs ?? []) names.set(b.id as string, (b.name as string) ?? '(unnamed)')
  }
  const rows = ids
    .map((id) => ({ id, name: names.get(id) ?? '(unknown)', ...byBrand.get(id)! }))
    .sort((a, b) => b.stores - a.stores)
  console.info(`\nBrands with stores inside the Canterbury bbox [${bbox.join(',')}] — ${rows.length} brands, ${stores.length} stores:\n`)
  console.info(`  ${'stores'.padStart(6)}  ${'fascias'.padStart(7)}  brand_id                               name`)
  for (const r of rows.slice(0, 40)) {
    console.info(`  ${String(r.stores).padStart(6)}  ${String(r.fascias.size).padStart(7)}  ${r.id}  ${r.name}`)
  }
  console.info('\nPick one and re-run:  npm run inspect:candidate-brand -- --brand <brand_id>\n')
}

async function resolveBrandByName(name: string): Promise<string> {
  const { data, error } = await supabase.from('brands').select('id, name').ilike('name', `%${name}%`).limit(20)
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as { id: string; name: string }[]
  if (rows.length === 0) throw new Error(`No brand matches "${name}".`)
  if (rows.length > 1) {
    console.info(`Multiple brands match "${name}" — pass --brand <id>:`)
    for (const r of rows) console.info(`  ${r.id}  ${r.name}`)
    process.exit(1)
  }
  console.info(`Resolved brand "${name}" → ${rows[0].name} (${rows[0].id})`)
  return rows[0].id
}

// KEYSET pagination on the PK (id > lastId), NOT offset .range(): a deep OFFSET over the
// 74k-row table is O(offset) and one page can blow the statement timeout (measured ~17 s
// for the full offset walk). Keyset streams the id index at constant per-page cost.
async function fetchUniverseIds(): Promise<SiteRow[]> {
  const out: SiteRow[] = []
  const PAGE = 1000
  let last = '00000000-0000-0000-0000-000000000000'
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

// Field names MUST match BrandEstateRaw so the pure classifier reads them (a mismatch
// casts silently to undefined→null and nulls every distance).
interface Measured { nearestDistanceM: number | null; brandStoreCount: number }

async function measureUniverse(ids: string[]): Promise<Map<string, Measured>> {
  const map = new Map<string, Measured>()
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize)
    const { data, error } = await supabase.rpc('nearest_same_brand_store', {
      p_site_ids: batch,
      p_brand_id: brandId,
      p_fascia_ids: fasciaIds,
      p_max_dist_m: null, // uncapped: we want the TRUE nearest for the >= N-mile test
    })
    if (error) throw new Error(error.message)
    for (const r of (data ?? []) as { site_id: string; distance_m: unknown; brand_store_count: unknown }[]) {
      map.set(r.site_id, { nearestDistanceM: n(r.distance_m), brandStoreCount: Number(r.brand_store_count) || 0 })
    }
    if ((i + batch.length) % 2000 === 0 || i + batch.length >= ids.length) {
      console.info(`  measured ${Math.min(i + batch.length, ids.length).toLocaleString()}/${ids.length.toLocaleString()} sites…`)
    }
  }
  return map
}

function report(tag: string, isDriveThru: boolean, sites: SiteRow[], measured: Map<string, Measured>) {
  const universe = sites.length
  const rows = sites.map((s) => measured.get(s.id)).filter((m): m is Measured => m != null)
  const minM = minMiles * METRES_PER_MILE

  const screened = rows.map((r) => classifyBrandDistance(r as BrandEstateRaw))
  const hasEstate = screened.filter((s) => s.brandHasStores)
  const withDistance = hasEstate.filter((s) => s.nearestDistanceM != null)
  const distances = withDistance.map((s) => s.nearestDistanceM as number).sort((a, b) => a - b)

  const bands = {
    at: screened.filter((s) => s.band === 'at').length,
    near: screened.filter((s) => s.band === 'near').length,
    moderate: screened.filter((s) => s.band === 'moderate').length,
    clear: screened.filter((s) => s.band === 'clear').length,
  }
  // Occupier funnel: sites that PASS a >= min-miles same-brand-distance rule. A brand
  // with no estate passes trivially; otherwise the nearest store must be >= min-miles.
  const passMinMiles = screened.filter(
    (s) => !s.brandHasStores || s.nearestDistanceM == null || (s.nearestDistanceM as number) >= minM,
  ).length
  const withinMinMiles = withDistance.filter((s) => (s.nearestDistanceM as number) < minM).length

  console.info(`\n[${tag}] ${isDriveThru ? 'Drive-thru subset (0.3–0.7 ac)' : `Enrichment universe: sites ≥ ${minAcres} ac`} = ${universe.toLocaleString()}`)
  console.info(`  Measured (RPC returned a row): ${rows.length.toLocaleString()} (${pct(rows.length, universe)})`)
  console.info(`  Nearest same-brand store found for: ${withDistance.length.toLocaleString()} (${pct(withDistance.length, universe)})`)
  console.info(`  Nearest-store distance: p50=${mi(pctile(distances, 0.5))}  p90=${mi(pctile(distances, 0.9))}  min=${mi(distances[0] ?? null)}  max=${mi(distances[distances.length - 1] ?? null)}`)
  console.info('  Distance bands (default thresholds — screening only, not asserted):')
  console.info(`    at (≤0.25 mi)      ${String(bands.at).padStart(6)}  ${pct(bands.at, universe)}`)
  console.info(`    near (≤1 mi)       ${String(bands.near).padStart(6)}  ${pct(bands.near, universe)}`)
  console.info(`    moderate (≤3 mi)   ${String(bands.moderate).padStart(6)}  ${pct(bands.moderate, universe)}`)
  console.info(`    clear (>3 mi)      ${String(bands.clear).padStart(6)}  ${pct(bands.clear, universe)}`)
  console.info(
    `  Occupier rule ≥ ${minMiles} mi from existing estate: PASS ${passMinMiles.toLocaleString()} (${pct(passMinMiles, universe)});  ` +
      `too close (<${minMiles} mi) ${withinMinMiles.toLocaleString()} (${pct(withinMinMiles, universe)})`,
  )
}

async function main() {
  if (listBrands) {
    await listBrandsNearCanterbury()
    return
  }

  let id = brandId
  if (!id && brandName) id = await resolveBrandByName(brandName)
  if (!id) {
    console.error('Pass --brand <uuid> or --brand-name <substr>, or --list-brands to choose one.')
    process.exit(1)
  }

  const bbox4 = { p_min_lon: bbox[0], p_min_lat: bbox[1], p_max_lon: bbox[2], p_max_lat: bbox[3] }
  const { data: summary, error: sErr } = await supabase.rpc('brand_estate_summary', {
    p_brand_id: id, p_fascia_ids: fasciaIds, ...bbox4,
  })
  if (sErr) throw new Error(sErr.message)
  const s = (summary ?? {}) as { brand_name?: string; store_count?: number; fascia_count?: number; store_count_in_bbox?: number }

  console.info(`\nM7 same-brand distance  (brand=${s.brand_name ?? id})\n${'='.repeat(60)}`)
  console.info(
    `  Estate: ${(s.store_count ?? 0).toLocaleString()} stores across ${s.fascia_count ?? 0} fascia(s) nationally; ` +
      `${s.store_count_in_bbox ?? 0} inside the Canterbury bbox.`,
  )
  if (fasciaIds) console.info(`  (narrowed to fascia ids: ${fasciaIds.join(', ')})`)
  if ((s.store_count ?? 0) === 0) {
    console.info('\n  This brand has NO stores — every candidate site trivially SATISFIES the same-brand-distance criterion (nothing to cannibalise). This is a valid, not-unknown result. Pick a locally-present brand for a meaningful distribution: --list-brands\n')
    return
  }

  const universe = await fetchUniverseIds()
  console.info(`  Universe: ${universe.length.toLocaleString()} candidate sites ≥ ${minAcres} ac. Measuring nearest same-brand store per site…`)
  const measured = await measureUniverse(universe.map((u) => u.id))

  report('Funnel 1', false, universe, measured)
  const driveThru = universe.filter((x) => x.area_acres != null && x.area_acres >= 0.3 && x.area_acres < 0.7)
  report('Funnel 2', true, driveThru, measured)

  console.info(
    '\nReminders: same-brand distance is a SEARCH-TIME, per-brand calculation (not enrichment). ' +
      'A brand with no estate is SATISFIED, never unknown — this criterion has no unknown state. ' +
      'A large distance means "clear of the existing estate", never "a good site".',
  )
  console.info('Eyeball a geographically varied sample:  npm run export:brand-debug-map -- --brand ' + id + '\n')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
