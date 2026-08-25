/**
 * M9 (Find Sites): the first REAL recall-favouring search over the Canterbury candidate
 * universe, end-to-end on real data.
 *
 * This is the search SERVICE the whole MVP was building toward. It:
 *   1. Fetches the M2 candidate universe + all M3–M8 enrichment (roads, traffic, geometry,
 *      constraints, land use) with keyset pagination, and the M7 same-brand distance per
 *      the chosen brand via its search-time RPC (batched).
 *   2. Assembles each site's normalised SiteFeaturesRaw via the PURE feature-assembly
 *      module and runs the PURE engine (scoreAndRank + buildFunnel) over a recall-favouring
 *      drive-thru requirement: ONLY hard criteria (area, an excluding flood zone,
 *      same-brand cannibalisation) eliminate; road/traffic/frontage/junction/land-use are
 *      preferred, so they rank but never drop a site, and unknowns stay in.
 *   3. Runs the KNOWN-SITE RECALL TEST: maps existing brand stores (ground-truth viable
 *      drive-thru locations) to candidate parcels via find_candidate_sites_for_stores() and
 *      checks whether the pipeline would have found & ranked them.
 *   4. Computes the queued land-use × road-coverage CROSS-TAB.
 *   5. Writes an explicit FEASIBILITY findings report (universe, coverage, funnel, result
 *      quality, recall, failure modes, biggest next improvement, go/no-go) — a qualified or
 *      negative result is an acceptable outcome.
 *
 * Read-only. Nothing here is a suitability/planning/access verdict — every number is a
 * screening signal, and `unknown` is preserved throughout.
 *
 * Run from apps/web (after applying the M2–M8 migrations + 20260737000000_find_sites_search_helpers.sql
 * and running the M3–M8 associate steps):
 *   npm run find-sites-search -- --list-brands
 *   npm run find-sites-search -- --brand-name "mcdonald" [--fascia <uuid,uuid>] \
 *     [--site-source hmlr_inspire] [--min-acres 0.3] [--dt-min 0.3] [--dt-max 0.7] \
 *     [--min-aadf 10000] [--min-miles 1] [--top 20] [--batch 150] \
 *     [--bbox 1.00,51.22,1.20,51.32] [--out <dir>]
 */

import fs from 'node:fs'
import path from 'node:path'
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import {
  assembleSiteFeatures,
  crossTabLandUseRoad,
  type CandidateSiteRow,
  type ConstraintRow,
  type GeometryRow,
  type RoadRow,
  type SiteEnrichmentBundle,
  type TrafficRow,
} from '../src/lib/site-matching/feature-assembly'
import { knownSiteRecall, type KnownSite } from '../src/lib/site-matching/search-analysis'
import { buildFunnel } from '../src/lib/site-matching/diagnostics'
import { scoreSite } from '../src/lib/site-matching/scoring'
import { rankTiered, tierDistribution, TIER_LABELS, type SiteTier, type TieredResult } from '../src/lib/site-matching/tiering'
import { getPreset, withSameBrand, REQUIREMENT_PRESETS } from '../src/lib/site-matching/requirement-presets'
import type { BrandEstateRaw } from '../src/lib/site-matching/brand-distance'
import type { OccupierRequirement, SiteFeaturesRaw } from '../src/lib/site-matching/types'

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
const presetKey = arg('preset') ?? 'drive-thru'
const minMiles = arg('min-miles') ? Number(arg('min-miles')) : 1
const topN = arg('top') ? Number(arg('top')) : 20
const batchSize = arg('batch') ? Number(arg('batch')) : 150
const brandIdArg = arg('brand')
const brandNameArg = arg('brand-name')
const fasciaIds = arg('fascia') ? (arg('fascia') as string).split(',').map((s) => s.trim()) : null
const listBrands = flag('list-brands')
const bbox = (arg('bbox') ?? '1.00,51.22,1.20,51.32').split(',').map(Number) // minLon,minLat,maxLon,maxLat
const outDir = arg('out')
  ? path.resolve(arg('out') as string)
  : path.resolve(process.cwd(), '../../artifacts/find-sites-m9')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  process.exit(1)
}
const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const ZERO_UUID = '00000000-0000-0000-0000-000000000000'

function n(v: unknown): number | null {
  if (v == null) return null
  const x = Number(v)
  return Number.isFinite(x) ? x : null
}
function pct(x: number, d: number): string {
  return d > 0 ? `${Math.round((100 * x) / d)}%` : '—'
}

// -------------------------------------------------------------------------------------
// The requirement comes from a generic preset brief (drive-thru | roadside | retail |
// industrial), with the same-brand gate appended ONLY when a brand is chosen. ONLY hard
// criteria are `required` (they eliminate); everything else is `preferred` (ranks, never
// eliminates) or `warning`. Oversized titles are retained (M9.1), not failed.
// -------------------------------------------------------------------------------------
function buildRequirement(brandId: string | null): OccupierRequirement {
  const base = getPreset(presetKey)
  if (!base) {
    console.error(`Unknown --preset "${presetKey}". Options: ${Object.keys(REQUIREMENT_PRESETS).join(', ')}.`)
    process.exit(1)
  }
  return brandId ? withSameBrand(base, brandId, minMiles) : base
}

/** Read the [min,max] acres of a requirement's site_area criterion, for display. */
function areaBand(req: OccupierRequirement): { min: number | null; max: number | null } {
  const p = req.criteria.find((c) => c.key === 'site_area')?.params as Record<string, unknown> | undefined
  const num = (k: string) => (typeof p?.[k] === 'number' ? (p[k] as number) : null)
  return { min: num('minAcres'), max: num('maxAcres') }
}

// -------------------------------------------------------------------------------------
// Brand resolution (mirrors inspect-candidate-brand).
// -------------------------------------------------------------------------------------
async function listBrandsNearCanterbury(): Promise<void> {
  const { data, error } = await supabase.rpc('get_stores_in_bbox', {
    p_min_lon: bbox[0], p_min_lat: bbox[1], p_max_lon: bbox[2], p_max_lat: bbox[3], p_fascia_ids: null,
  })
  if (error) throw new Error(error.message)
  const stores = (data ?? []) as { brand_id: string | null }[]
  const byBrand = new Map<string, number>()
  for (const s of stores) {
    if (!s.brand_id) continue
    byBrand.set(s.brand_id, (byBrand.get(s.brand_id) ?? 0) + 1)
  }
  const ids = Array.from(byBrand.keys())
  const names = new Map<string, string>()
  for (let i = 0; i < ids.length; i += 200) {
    const { data: bs } = await supabase.from('brands').select('id, name').in('id', ids.slice(i, i + 200))
    for (const b of bs ?? []) names.set(b.id as string, (b.name as string) ?? '(unnamed)')
  }
  const rows = ids.map((id) => ({ id, name: names.get(id) ?? '(unknown)', stores: byBrand.get(id)! })).sort((a, b) => b.stores - a.stores)
  console.info(`\nBrands with stores inside the Canterbury bbox [${bbox.join(',')}]:\n`)
  console.info(`  ${'stores'.padStart(6)}  brand_id                               name`)
  for (const r of rows.slice(0, 40)) console.info(`  ${String(r.stores).padStart(6)}  ${r.id}  ${r.name}`)
  console.info('\nPick one and re-run:  npm run find-sites-search -- --brand <brand_id>\n')
}

async function resolveBrand(): Promise<{ id: string; name: string } | null> {
  if (brandIdArg) {
    const { data } = await supabase.from('brands').select('id, name').eq('id', brandIdArg).maybeSingle()
    return { id: brandIdArg, name: (data?.name as string) ?? '(unknown)' }
  }
  if (brandNameArg) {
    const { data, error } = await supabase.from('brands').select('id, name').ilike('name', `%${brandNameArg}%`).limit(20)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as { id: string; name: string }[]
    if (rows.length === 0) throw new Error(`No brand matches "${brandNameArg}".`)
    if (rows.length > 1) {
      console.info(`Multiple brands match "${brandNameArg}" — pass --brand <id>:`)
      for (const r of rows) console.info(`  ${r.id}  ${r.name}`)
      process.exit(1)
    }
    console.info(`Resolved brand "${brandNameArg}" → ${rows[0].name} (${rows[0].id})`)
    return rows[0]
  }
  return null // brand-agnostic search (same_brand_distance treated as satisfied everywhere)
}

// -------------------------------------------------------------------------------------
// Keyset-paginated fetchers (the M7/M8 lesson: offset over 74k rows blows the timeout).
// -------------------------------------------------------------------------------------
async function fetchUniverse(): Promise<CandidateSiteRow[]> {
  const out: CandidateSiteRow[] = []
  const PAGE = 1000
  let last = ZERO_UUID
  for (;;) {
    const { data, error } = await supabase
      .from('candidate_sites')
      .select('id, name, area_acres, current_land_use, land_use_confidence')
      .eq('source', siteSource)
      .gte('area_acres', minAcres)
      .gt('id', last)
      .order('id', { ascending: true })
      .limit(PAGE)
    if (error) throw new Error(error.message)
    const page = data ?? []
    for (const r of page) {
      out.push({
        id: r.id as string,
        name: (r.name as string) ?? null,
        area_acres: n(r.area_acres),
        current_land_use: (r.current_land_use as string) ?? null,
        land_use_confidence: (r.land_use_confidence as string) ?? null,
      })
    }
    if (page.length < PAGE) break
    last = page[page.length - 1].id as string
  }
  return out
}

async function fetchGrouped<T>(
  table: string,
  select: string,
  map: (r: Record<string, unknown>) => { siteId: string; row: T }
): Promise<Map<string, T[]>> {
  const grouped = new Map<string, T[]>()
  const PAGE = 1000
  let last = ZERO_UUID
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .gt('id', last)
      .order('id', { ascending: true })
      .limit(PAGE)
    if (error) throw new Error(error.message)
    const page = (data ?? []) as unknown as Record<string, unknown>[]
    for (const r of page) {
      const { siteId, row } = map(r)
      const list = grouped.get(siteId)
      if (list) list.push(row)
      else grouped.set(siteId, [row])
    }
    if (page.length < PAGE) break
    last = page[page.length - 1].id as string
  }
  return grouped
}

async function measureBrand(ids: string[], brandId: string): Promise<Map<string, BrandEstateRaw>> {
  const map = new Map<string, BrandEstateRaw>()
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize)
    const { data, error } = await supabase.rpc('nearest_same_brand_store', {
      p_site_ids: batch,
      p_brand_id: brandId,
      p_fascia_ids: fasciaIds,
      p_max_dist_m: null, // uncapped: the TRUE nearest for the ≥ N-mile test
    })
    if (error) throw new Error(error.message)
    for (const r of (data ?? []) as { site_id: string; distance_m: unknown; brand_store_count: unknown }[]) {
      map.set(r.site_id, { nearestDistanceM: n(r.distance_m), brandStoreCount: Number(r.brand_store_count) || 0 })
    }
    if (i + batch.length >= ids.length || (i + batch.length) % 2000 === 0) {
      console.info(`  same-brand distance: ${Math.min(i + batch.length, ids.length).toLocaleString()}/${ids.length.toLocaleString()}…`)
    }
  }
  return map
}

async function fetchKnownSites(brandId: string): Promise<KnownSite[]> {
  const { data, error } = await supabase.rpc('find_candidate_sites_for_stores', {
    p_brand_id: brandId,
    p_min_lon: bbox[0], p_min_lat: bbox[1], p_max_lon: bbox[2], p_max_lat: bbox[3],
    p_fascia_ids: fasciaIds,
    p_site_source: siteSource,
    p_min_acres: minAcres,
    p_max_dist_m: 150,
  })
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    label: `${(r.store_name as string) ?? (r.store_ref as string) ?? 'store'}${r.store_town ? ` (${r.store_town})` : ''}`,
    siteId: (r.candidate_site_id as string) ?? null,
    contained: !!r.contained,
    distanceM: n(r.distance_m),
    lon: n(r.lon),
    lat: n(r.lat),
  }))
}

// -------------------------------------------------------------------------------------
// Report assembly.
// -------------------------------------------------------------------------------------
function topLine(r: TieredResult, rank: number): string {
  const names = (list: { label: string }[]) => list.map((c) => c.label).join(', ')
  return [
    `#${String(rank).padStart(2)}  ${r.tierLabel.toUpperCase().padEnd(20)} ${r.name ?? r.siteId}${r.oversized ? '  [oversized title]' : ''}`,
    `      ${r.siteId} · signal ${r.signal} · completeness ${r.completeness}`,
    r.evidence.passed.length ? `      ✓ passed:  ${names(r.evidence.passed)}` : '',
    r.evidence.partial.length ? `      ~ partial: ${names(r.evidence.partial)}` : '',
    r.evidence.failed.length ? `      ✗ failed:  ${names(r.evidence.failed)}` : '',
    r.evidence.unknown.length ? `      ? unknown: ${names(r.evidence.unknown)}` : '',
  ].filter(Boolean).join('\n')
}

async function main() {
  console.info(`\nFind Sites — M9 first real search  (site-source=${siteSource})\n${'='.repeat(64)}`)

  if (listBrands) {
    await listBrandsNearCanterbury()
    return
  }

  const brand = await resolveBrand()
  const requirement = buildRequirement(brand?.id ?? null)
  console.info(
    brand
      ? `Brand: ${brand.name} (${brand.id})${fasciaIds ? ` fascias ${fasciaIds.join(',')}` : ''}`
      : 'Brand: none (brand-agnostic — same-brand distance treated as satisfied everywhere)',
  )
  const band = areaBand(requirement)
  console.info(`Requirement: ${requirement.name} (preset "${presetKey}") — area ${band.min ?? '—'}–${band.max ?? '—'} ac (oversized retained), exclude flood_zone_3 (hard)${brand ? `, ≥${minMiles} mi same-brand (hard)` : ''}.\n`)

  // 1. Fetch universe + enrichment.
  console.info('Fetching candidate universe + M3–M8 enrichment…')
  const [universe, roads, traffic, geometry, constraints] = await Promise.all([
    fetchUniverse(),
    fetchGrouped<RoadRow>('candidate_site_roads', 'id, candidate_site_id, road_link_id, distance_m, road_classification, road_number, is_nearest_overall, is_nearest_in_primary_class', (r) => ({
      siteId: r.candidate_site_id as string,
      row: {
        road_link_id: r.road_link_id as string,
        distance_m: n(r.distance_m),
        road_classification: (r.road_classification as string) ?? null,
        road_number: (r.road_number as string) ?? null,
        is_nearest_overall: (r.is_nearest_overall as boolean) ?? null,
        is_nearest_in_primary_class: (r.is_nearest_in_primary_class as boolean) ?? null,
      },
    })),
    fetchGrouped<TrafficRow>('candidate_site_traffic', 'id, candidate_site_id, method, via_road_link_id, aadf_all_motor_vehicles, aadf_year, estimation_method, road_number, is_best_for_method', (r) => ({
      siteId: r.candidate_site_id as string,
      row: {
        method: r.method as string,
        via_road_link_id: (r.via_road_link_id as string) ?? null,
        aadf_all_motor_vehicles: n(r.aadf_all_motor_vehicles),
        aadf_year: n(r.aadf_year),
        estimation_method: (r.estimation_method as string) ?? null,
        road_number: (r.road_number as string) ?? null,
        is_best_for_method: (r.is_best_for_method as boolean) ?? null,
      },
    })),
    fetchGrouped<GeometryRow>('candidate_site_geometry', 'id, candidate_site_id, has_associated_road, frontage_m, primary_frontage_m, nearest_junction_m, nearest_junction_form, nearest_roundabout_m', (r) => ({
      siteId: r.candidate_site_id as string,
      row: {
        has_associated_road: (r.has_associated_road as boolean) ?? null,
        frontage_m: n(r.frontage_m),
        primary_frontage_m: n(r.primary_frontage_m),
        nearest_junction_m: n(r.nearest_junction_m),
        nearest_junction_form: (r.nearest_junction_form as string) ?? null,
        nearest_roundabout_m: n(r.nearest_roundabout_m),
      },
    })),
    fetchGrouped<ConstraintRow>('candidate_site_constraints', 'id, candidate_site_id, constraint_type, category, overlap_fraction, overlap_area_sqm, feature_count', (r) => ({
      siteId: r.candidate_site_id as string,
      row: {
        constraint_type: r.constraint_type as string,
        category: (r.category as string) ?? null,
        overlap_fraction: n(r.overlap_fraction),
        overlap_area_sqm: n(r.overlap_area_sqm),
        feature_count: n(r.feature_count),
      },
    })),
  ])
  console.info(
    `  universe ${universe.length.toLocaleString()} sites · roads for ${roads.size.toLocaleString()} · traffic for ${traffic.size.toLocaleString()} · geometry for ${geometry.size.toLocaleString()} · constraints for ${constraints.size.toLocaleString()}`,
  )

  // 2. Same-brand distance per site (search-time, per brand).
  let brandMap = new Map<string, BrandEstateRaw>()
  if (brand) {
    console.info('Measuring same-brand distance…')
    brandMap = await measureBrand(universe.map((s) => s.id), brand.id)
  }

  // 3. Assemble features (pure) + run the engine (pure).
  const features: SiteFeaturesRaw[] = universe.map((site) => {
    const bundle: SiteEnrichmentBundle = {
      site,
      roads: roads.get(site.id) ?? [],
      traffic: traffic.get(site.id) ?? [],
      geometry: (geometry.get(site.id) ?? [])[0] ?? null,
      constraints: constraints.get(site.id) ?? [],
      brand: brand ? (brandMap.get(site.id) ?? { nearestDistanceM: null, brandStoreCount: 0 }) : null,
    }
    return assembleSiteFeatures(bundle)
  })

  const scored = features.map((f) => scoreSite(requirement, f))
  const ranked = rankTiered(scored) // TieredResult[] — ordered by tier, then signal
  const funnel = buildFunnel(features, requirement)
  const dist = tierDistribution(ranked)
  const crossTab = crossTabLandUseRoad(features)

  // 4. Known-site recall (TieredResult extends SiteMatchResult).
  const recall = brand ? knownSiteRecall(ranked, await fetchKnownSites(brand.id), topN) : null

  // 5. Report — console + files.
  printReport(brand, universe.length, funnel, dist, crossTab, recall, ranked)
  writeFindings(brand, requirement, funnel, dist, crossTab, recall, ranked)
}

const TIER_ORDER: SiteTier[] = ['strong', 'potential', 'review', 'unlikely']

function printReport(
  brand: { id: string; name: string } | null,
  universeSize: number,
  funnel: ReturnType<typeof buildFunnel>,
  dist: Record<SiteTier, number>,
  crossTab: ReturnType<typeof crossTabLandUseRoad>,
  recall: ReturnType<typeof knownSiteRecall> | null,
  ranked: TieredResult[],
) {
  console.info(`\n${'─'.repeat(64)}\nFUNNEL (required gates; unknowns retained → missing data never eliminates)`)
  console.info(`  universe: ${funnel.universe.toLocaleString()}`)
  for (const g of funnel.funnel) {
    console.info(`  ${g.label.padEnd(22)} enter ${String(g.entering).padStart(6)} → pass ${String(g.pass).padStart(6)}  fail ${String(g.fail).padStart(6)}  unknown ${String(g.unknown).padStart(6)}  → surviving ${g.surviving.toLocaleString()}`)
  }
  console.info(`  survivors (eligible): ${funnel.survivors.toLocaleString()} (${pct(funnel.survivors, funnel.universe)})`)

  console.info(`\nDATA COVERAGE (of the ${universeSize.toLocaleString()}-site universe)`)
  for (const c of funnel.coverage) console.info(`  ${c.field.padEnd(12)} ${String(c.present).padStart(6)}  ${c.pct}%`)

  console.info(`\nRESULT TIERS (transparent — replaces the saturating suitability %)`)
  for (const t of TIER_ORDER) console.info(`  ${TIER_LABELS[t].padEnd(20)} ${String(dist[t]).padStart(6)}  ${pct(dist[t], ranked.length)}`)
  const oversizedRetained = ranked.filter((r) => r.oversized && r.tier !== 'unlikely').length
  console.info(`  (${oversizedRetained.toLocaleString()} oversized titles retained — larger than the requested footprint, honestly labelled, not eliminated)`)

  console.info(`\nLAND-USE × ROAD CROSS-TAB`)
  console.info(`                    roadside(mapped road)   no mapped road`)
  console.info(`  classified LU     ${String(crossTab.classifiedRoadside).padStart(10)}            ${String(crossTab.classifiedNoRoad).padStart(10)}`)
  console.info(`  unknown LU        ${String(crossTab.unknownRoadside).padStart(10)}            ${String(crossTab.unknownNoRoad).padStart(10)}`)
  console.info(`  P(classified | roadside) = ${crossTab.pctClassifiedGivenRoadside}%  vs  P(classified | no road) = ${crossTab.pctClassifiedGivenNoRoad}%`)

  if (recall) {
    console.info(`\nKNOWN-SITE RECALL (existing ${brand?.name ?? 'brand'} stores as ground-truth locations)`)
    console.info(`  known stores in bbox: ${recall.known} · mapped to a parcel: ${recall.mappedToParcel} · in searched universe: ${recall.inUniverse}`)
    console.info(`  of those in-universe: eligible ${recall.eligible} · in top-${recall.topN} ${recall.inTopN} · median rank ${recall.medianRank ?? '—'}`)
    console.info(`  NOTE: an existing store sits ON its brand, so same_brand_distance flags it as cannibalising — recall reads PHYSICAL fit + universe coverage, not that gate.`)
    for (const o of recall.outcomes) {
      const where = o.siteId ? (o.contained ? 'in parcel' : `~${Math.round(o.distanceM ?? 0)}m`) : 'NO PARCEL (universe miss)'
      const rk = o.rank != null ? `rank #${o.rank}${o.inTopN ? ' ★top' : ''} · ${o.eligible ? 'eligible' : 'ineligible'}` : '—'
      console.info(`    ${o.label.padEnd(38)} ${where.padEnd(22)} ${o.inUniverse ? rk : ''}`)
    }
  }

  console.info(`\nTOP-${topN} SHORTLIST`)
  const shortlist = ranked.filter((r) => r.tier !== 'unlikely').slice(0, topN)
  shortlist.forEach((r, i) => console.info(topLine(r, i + 1)))
  if (shortlist.length === 0) console.info('  (no eligible sites — every candidate failed a hard gate; review criteria)')

  console.info(`\nReminder: results are TIERS + an evidence summary, never a definitive "% suitable". Every signal is`)
  console.info(`screening-only; unknowns are retained; nothing here is a planning/highways/availability/suitability verdict.`)
  console.info(`Findings + shortlist written under ${path.relative(process.cwd(), outDir)}/.\n`)
}

function writeFindings(
  brand: { id: string; name: string } | null,
  requirement: OccupierRequirement,
  funnel: ReturnType<typeof buildFunnel>,
  dist: Record<SiteTier, number>,
  crossTab: ReturnType<typeof crossTabLandUseRoad>,
  recall: ReturnType<typeof knownSiteRecall> | null,
  ranked: TieredResult[],
) {
  fs.mkdirSync(outDir, { recursive: true })
  const shortlist = ranked.filter((r) => r.tier !== 'unlikely').slice(0, topN)
  const band = areaBand(requirement)
  // Machine-readable result set for downstream inspection / the results debug map.
  fs.writeFileSync(
    path.join(outDir, 'results.json'),
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        brand,
        requirement,
        params: { siteSource, minAcres, preset: presetKey, areaBand: band, minMiles, topN, bbox },
        funnel,
        tiers: dist,
        crossTab,
        recall,
        shortlist: shortlist.map((r, i) => ({
          rank: i + 1,
          siteId: r.siteId,
          name: r.name,
          tier: r.tier,
          tierLabel: r.tierLabel,
          signal: r.signal,
          completeness: r.completeness,
          oversized: r.oversized,
          evidence: {
            passed: r.evidence.passed.map((c) => c.label),
            partial: r.evidence.partial.map((c) => ({ label: c.label, note: c.message ?? c.value })),
            failed: r.evidence.failed.map((c) => c.label),
            unknown: r.evidence.unknown.map((c) => c.label),
          },
          criteria: r.criteria,
        })),
      },
      null,
      2,
    ),
    'utf8',
  )

  const lines: string[] = []
  const p = (s = '') => lines.push(s)
  p(`# Find Sites — feasibility findings (M9.1 tiered)`)
  p()
  p(`_Generated ${new Date().toISOString()} · preset \`${presetKey}\` · brand ${brand ? `${brand.name} (${brand.id})` : 'none (brand-agnostic)'} · Canterbury._`)
  p()
  p(`## Candidate universe & coverage`)
  p(`- Universe: **${funnel.universe.toLocaleString()}** sites (source \`${siteSource}\`, ≥ ${minAcres} ac). Area band ${band.min ?? '—'}–${band.max ?? '—'} ac (oversized retained).`)
  for (const c of funnel.coverage) p(`- Coverage — ${c.field}: ${c.present.toLocaleString()} (${c.pct}%).`)
  p()
  p(`## Funnel (recall-favouring — only hard gates eliminate; unknowns retained)`)
  p(`| Gate | entering | pass | fail | unknown | surviving |`)
  p(`|---|---:|---:|---:|---:|---:|`)
  for (const g of funnel.funnel) p(`| ${g.label} | ${g.entering} | ${g.pass} | ${g.fail} | ${g.unknown} | ${g.surviving} |`)
  p(`- **Eligible survivors: ${funnel.survivors.toLocaleString()}** (${pct(funnel.survivors, funnel.universe)} of the universe).`)
  p()
  p(`## Result tiers (transparent — no surfaced suitability %)`)
  p(`| Tier | count | % |`)
  p(`|---|---:|---:|`)
  for (const t of TIER_ORDER) p(`| ${TIER_LABELS[t]} | ${dist[t]} | ${pct(dist[t], ranked.length)} |`)
  p(`- Oversized titles retained (not eliminated): **${ranked.filter((r) => r.oversized && r.tier !== 'unlikely').length.toLocaleString()}** — larger than the requested footprint, honestly labelled.`)
  p()
  p(`## Land-use × road cross-tab`)
  p(`| | roadside (mapped road) | no mapped road |`)
  p(`|---|---:|---:|`)
  p(`| classified land use | ${crossTab.classifiedRoadside} | ${crossTab.classifiedNoRoad} |`)
  p(`| unknown land use | ${crossTab.unknownRoadside} | ${crossTab.unknownNoRoad} |`)
  p(`- P(classified land use \\| roadside) = **${crossTab.pctClassifiedGivenRoadside}%** vs P(classified \\| no mapped road) = **${crossTab.pctClassifiedGivenNoRoad}%**.`)
  p()
  if (recall) {
    p(`## Known-site recall test`)
    p(`Existing ${brand?.name ?? 'brand'} stores taken as ground-truth locations, mapped to candidate parcels.`)
    p(`- Known stores in bbox: ${recall.known}; mapped to a parcel: ${recall.mappedToParcel}; in searched universe: ${recall.inUniverse}.`)
    p(`- Of those in-universe: eligible ${recall.eligible}; in top-${recall.topN}: ${recall.inTopN}; median rank ${recall.medianRank ?? '—'}.`)
    p(`- Note: an existing store sits ON its brand, so same_brand_distance would (correctly) flag it as cannibalising; recall reads physical fit + universe coverage, not that gate.`)
    p()
    p(`| Known store | parcel | rank | eligible |`)
    p(`|---|---|---:|---|`)
    for (const o of recall.outcomes) {
      const where = o.siteId ? (o.contained ? 'in parcel' : `~${Math.round(o.distanceM ?? 0)}m`) : 'universe miss'
      p(`| ${o.label} | ${where} | ${o.rank ?? '—'} | ${o.eligible == null ? '—' : o.eligible} |`)
    }
    p()
  }
  p(`## Top-${topN} shortlist`)
  p(`| # | tier | site | signal | oversized | passed / partial / failed / unknown |`)
  p(`|---:|---|---|---:|---|---|`)
  shortlist.forEach((r, i) =>
    p(
      `| ${i + 1} | ${r.tierLabel} | ${r.name ?? r.siteId} (\`${r.siteId}\`) | ${r.signal} | ${r.oversized ? 'yes' : ''} | ${r.evidence.passed.length} / ${r.evidence.partial.length} / ${r.evidence.failed.length} / ${r.evidence.unknown.length} |`,
    ),
  )
  p()
  p(`> Results are TIERS + a passed/partial/failed/unknown evidence summary, never a definitive "% suitable". Every signal is screening-only; unknowns are retained; a registered title is an indicative freehold extent, never an exact development plot; availability, access, planning and viability stay unknown.`)

  fs.writeFileSync(path.join(outDir, 'findings.md'), lines.join('\n'), 'utf8')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
