// Shared Find Sites search service — the read layer + pure-engine orchestration that both the
// CLI (find-sites-search.ts) and the read-only HTTP route (api/public/sites/search) run.
//
// Lifted from the M9 CLI so there is ONE implementation of: keyset-paginated universe +
// enrichment fetch, batched same-brand distance, feature assembly, scoring + tiering, funnel,
// cross-tab and known-site recall. It is READ-ONLY — every call is a SELECT or a read-only
// (STABLE) RPC; nothing here writes. Every number is a screening signal; `unknown` is preserved.
//
// The one addition over the CLI is `fetchGeometry`: the ranked shortlist's registered-title
// polygons for the map, read via the existing `debug_site_road_map` RPC (site features only) so
// no new migration is needed.

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  assembleSiteFeatures,
  crossTabLandUseRoad,
  type CandidateSiteRow,
  type ConstraintRow,
  type GeometryRow,
  type RoadRow,
  type SiteEnrichmentBundle,
  type TrafficRow,
} from './feature-assembly'
import { knownSiteRecall, type KnownSite, type RecallReport } from './search-analysis'
import { buildFunnel } from './diagnostics'
import { scoreSite } from './scoring'
import { rankTiered, tierDistribution, type TieredResult } from './tiering'
import { getPreset, withSameBrand } from './requirement-presets'
import type { BrandEstateRaw } from './brand-distance'
import type { OccupierRequirement, SiteFeaturesRaw } from './types'
import type {
  FindSitesEvidence,
  FindSitesItem,
  FindSitesResponse,
  FindSitesSearchParams,
} from './find-sites-dto'

const ZERO_UUID = '00000000-0000-0000-0000-000000000000'
const DEFAULT_BBOX: [number, number, number, number] = [1.0, 51.22, 1.2, 51.32] // Canterbury

function n(v: unknown): number | null {
  if (v == null) return null
  const x = Number(v)
  return Number.isFinite(x) ? x : null
}

// ---------------------------------------------------------------------------------------
// Keyset-paginated fetchers (the M7/M8 lesson: offset over 74k rows blows the timeout).
// ---------------------------------------------------------------------------------------
async function fetchUniverse(
  sb: SupabaseClient,
  siteSource: string,
  minAcres: number
): Promise<CandidateSiteRow[]> {
  const out: CandidateSiteRow[] = []
  const PAGE = 1000
  let last = ZERO_UUID
  for (;;) {
    const { data, error } = await sb
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
  sb: SupabaseClient,
  table: string,
  select: string,
  map: (r: Record<string, unknown>) => { siteId: string; row: T }
): Promise<Map<string, T[]>> {
  const grouped = new Map<string, T[]>()
  const PAGE = 1000
  let last = ZERO_UUID
  for (;;) {
    const { data, error } = await sb
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

async function measureBrand(
  sb: SupabaseClient,
  ids: string[],
  brandId: string,
  fasciaIds: string[] | null,
  batchSize: number
): Promise<Map<string, BrandEstateRaw>> {
  const map = new Map<string, BrandEstateRaw>()
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize)
    const { data, error } = await sb.rpc('nearest_same_brand_store', {
      p_site_ids: batch,
      p_brand_id: brandId,
      p_fascia_ids: fasciaIds,
      p_max_dist_m: null, // uncapped: the TRUE nearest for the ≥ N-mile test
    })
    if (error) throw new Error(error.message)
    for (const r of (data ?? []) as { site_id: string; distance_m: unknown; brand_store_count: unknown }[]) {
      map.set(r.site_id, { nearestDistanceM: n(r.distance_m), brandStoreCount: Number(r.brand_store_count) || 0 })
    }
  }
  return map
}

async function fetchKnownSites(
  sb: SupabaseClient,
  brandId: string,
  bbox: [number, number, number, number],
  fasciaIds: string[] | null,
  siteSource: string,
  minAcres: number
): Promise<KnownSite[]> {
  const { data, error } = await sb.rpc('find_candidate_sites_for_stores', {
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

/** Rough polygon centroid = centre of the coordinate bounding box. Good enough for flyTo. */
function geometryCentroid(geom: GeoJSON.Geometry | null): [number, number] | null {
  if (!geom) return null
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const visit = (coords: unknown): void => {
    if (typeof (coords as number[])[0] === 'number' && typeof (coords as number[])[1] === 'number') {
      const [x, y] = coords as number[]
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
      return
    }
    for (const c of coords as unknown[]) visit(c)
  }
  if ('coordinates' in geom) visit((geom as { coordinates: unknown }).coordinates)
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null
  return [(minX + maxX) / 2, (minY + maxY) / 2]
}

/**
 * Registered-title polygons for a set of sites, via the existing read-only `debug_site_road_map`
 * RPC (site features only). Chunked to 20 ids per call — the M8 lesson that large multi-site
 * GeoJSON responses can fail the fetch. Returns siteId → GeoJSON geometry.
 */
async function fetchGeometry(sb: SupabaseClient, siteIds: string[]): Promise<Map<string, GeoJSON.Geometry>> {
  const geoms = new Map<string, GeoJSON.Geometry>()
  const CHUNK = 20
  for (let i = 0; i < siteIds.length; i += CHUNK) {
    const chunk = siteIds.slice(i, i + CHUNK)
    const { data, error } = await sb.rpc('debug_site_road_map', { p_site_ids: chunk, p_radius_m: 0 })
    if (error) throw new Error(error.message)
    const fc = data as { features?: { geometry: GeoJSON.Geometry; properties?: Record<string, unknown> }[] } | null
    for (const f of fc?.features ?? []) {
      if (f.properties?.layer !== 'site') continue
      const id = f.properties?.id as string | undefined
      if (id && f.geometry) geoms.set(id, f.geometry)
    }
  }
  return geoms
}

// ---------------------------------------------------------------------------------------
// Universe + enrichment bundle, with an in-process TTL cache. The bundle depends ONLY on
// (siteSource, minAcres) — never on the brief/brand — so a warm instance serves criteria-only
// re-searches instantly instead of re-walking ~8k sites + ~40k enrichment rows each time. The
// universe walk (the slow, unindexed source+area scan) runs on its own; the four light
// enrichment tables then run concurrently — avoiding the 5-way contention that tipped a
// candidate_sites page past the statement timeout.
// ---------------------------------------------------------------------------------------
interface UniverseBundle {
  universe: CandidateSiteRow[]
  roads: Map<string, RoadRow[]>
  traffic: Map<string, TrafficRow[]>
  geometry: Map<string, GeometryRow[]>
  constraints: Map<string, ConstraintRow[]>
}

const BUNDLE_TTL_MS = 10 * 60 * 1000
const bundleCache = new Map<string, { at: number; bundle: UniverseBundle }>()

async function getUniverseBundle(
  sb: SupabaseClient,
  siteSource: string,
  minAcres: number
): Promise<UniverseBundle> {
  const cacheKey = `${siteSource}|${minAcres}`
  const cached = bundleCache.get(cacheKey)
  if (cached && Date.now() - cached.at < BUNDLE_TTL_MS) return cached.bundle

  const universe = await fetchUniverse(sb, siteSource, minAcres)
  const [roads, traffic, geometry, constraints] = await Promise.all([
    fetchGrouped<RoadRow>(sb, 'candidate_site_roads', 'id, candidate_site_id, road_link_id, distance_m, road_classification, road_number, is_nearest_overall, is_nearest_in_primary_class', (r) => ({
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
    fetchGrouped<TrafficRow>(sb, 'candidate_site_traffic', 'id, candidate_site_id, method, via_road_link_id, aadf_all_motor_vehicles, aadf_year, estimation_method, road_number, is_best_for_method', (r) => ({
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
    fetchGrouped<GeometryRow>(sb, 'candidate_site_geometry', 'id, candidate_site_id, has_associated_road, frontage_m, primary_frontage_m, nearest_junction_m, nearest_junction_form, nearest_roundabout_m', (r) => ({
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
    fetchGrouped<ConstraintRow>(sb, 'candidate_site_constraints', 'id, candidate_site_id, constraint_type, category, overlap_fraction, overlap_area_sqm, feature_count', (r) => ({
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

  const bundle: UniverseBundle = { universe, roads, traffic, geometry, constraints }
  bundleCache.set(cacheKey, { at: Date.now(), bundle })
  return bundle
}

// ---------------------------------------------------------------------------------------
// Requirement assembly + result mapping.
// ---------------------------------------------------------------------------------------
function buildRequirement(preset: string, brandId: string | null, minMiles: number): OccupierRequirement {
  const base = getPreset(preset)
  if (!base) throw new Error(`Unknown preset "${preset}".`)
  return brandId ? withSameBrand(base, brandId, minMiles) : base
}

function toEvidence(r: TieredResult): FindSitesEvidence {
  return {
    passed: r.evidence.passed.map((c) => c.label),
    partial: r.evidence.partial.map((c) => ({ label: c.label, note: c.message ?? c.value ?? null })),
    failed: r.evidence.failed.map((c) => c.label),
    unknown: r.evidence.unknown.map((c) => c.label),
  }
}

export interface RunFindSitesOptions {
  /** Resolve a brand id → display name (the endpoint passes a Supabase-backed lookup). */
  resolveBrandName?: (brandId: string) => Promise<string | null>
  batchSize?: number
}

/**
 * Run the whole read-only Find Sites pipeline and return the serialisable response DTO.
 * Fetches the universe + M3–M8 enrichment (keyset), measures same-brand distance per the chosen
 * brand (batched), assembles features (pure), scores + tiers (pure), builds the funnel + cross-tab,
 * runs known-site recall (brand only), then attaches title geometry for the returned shortlist.
 */
export async function runFindSitesSearch(
  sb: SupabaseClient,
  params: FindSitesSearchParams,
  opts: RunFindSitesOptions = {}
): Promise<FindSitesResponse> {
  const bbox = params.bbox ?? DEFAULT_BBOX
  const siteSource = params.siteSource ?? 'hmlr_inspire'
  const minAcres = params.minAcres ?? 0.3
  const topN = params.topN ?? 60
  const brandId = params.brandId ?? null
  const fasciaIds = params.fasciaIds ?? null
  const minMiles = params.minMiles ?? 1
  const batchSize = opts.batchSize ?? 150

  const requirement = buildRequirement(params.preset, brandId, minMiles)

  // 1. Universe + enrichment (cached in-process; walks the slow universe scan on its own).
  const { universe, roads, traffic, geometry, constraints } = await getUniverseBundle(sb, siteSource, minAcres)

  // 2. Same-brand distance (search-time, per brand).
  let brandMap = new Map<string, BrandEstateRaw>()
  if (brandId) brandMap = await measureBrand(sb, universe.map((s) => s.id), brandId, fasciaIds, batchSize)

  // 3. Assemble features (pure) + run the engine (pure).
  const features: SiteFeaturesRaw[] = universe.map((site) => {
    const bundle: SiteEnrichmentBundle = {
      site,
      roads: roads.get(site.id) ?? [],
      traffic: traffic.get(site.id) ?? [],
      geometry: (geometry.get(site.id) ?? [])[0] ?? null,
      constraints: constraints.get(site.id) ?? [],
      brand: brandId ? (brandMap.get(site.id) ?? { nearestDistanceM: null, brandStoreCount: 0 }) : null,
    }
    return assembleSiteFeatures(bundle)
  })
  const featureById = new Map(features.map((f) => [f.siteId, f]))

  const scored = features.map((f) => scoreSite(requirement, f))
  const ranked = rankTiered(scored)
  const funnel = buildFunnel(features, requirement)
  const tiers = tierDistribution(ranked)
  const crossTab = crossTabLandUseRoad(features)

  // 4. Known-site recall (brand only).
  const recall: RecallReport | null = brandId
    ? knownSiteRecall(ranked, await fetchKnownSites(sb, brandId, bbox, fasciaIds, siteSource, minAcres), topN)
    : null

  // 5. Build the returned shortlist page (ranked, non-`unlikely`, capped) + attach geometry.
  const eligibleRanked = ranked.filter((r) => r.tier !== 'unlikely')
  const page = eligibleRanked.slice(0, topN)
  const geoms = await fetchGeometry(sb, page.map((r) => r.siteId))

  const items: FindSitesItem[] = page.map((r, i) => {
    const geom = geoms.get(r.siteId) ?? null
    return {
      rank: i + 1,
      siteId: r.siteId,
      name: r.name,
      tier: r.tier,
      tierLabel: r.tierLabel,
      signal: r.signal,
      completeness: r.completeness,
      oversized: r.oversized,
      eligible: r.eligible,
      features: featureById.get(r.siteId)!,
      evidence: toEvidence(r),
      criteria: r.criteria,
      centroid: geometryCentroid(geom),
      geometry: geom,
    }
  })

  const brandName = brandId && opts.resolveBrandName ? await opts.resolveBrandName(brandId) : null

  return {
    params: {
      preset: params.preset,
      siteSource,
      minAcres,
      topN,
      bbox,
      brandId,
      brandName,
      minMiles: brandId ? minMiles : null,
    },
    universeSize: universe.length,
    eligibleCount: eligibleRanked.length,
    funnel,
    tiers,
    crossTab,
    recall,
    items,
    truncated: eligibleRanked.length > page.length,
  }
}
