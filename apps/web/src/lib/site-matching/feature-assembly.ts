// M9 search-service assembly — the PURE bridge from stored M2–M8 enrichment rows to
// the engine's normalised `SiteFeaturesRaw`.
//
// The search service (scripts/find-sites-search.ts) fetches the raw rows from the
// candidate_site_* tables + the search-time same-brand RPC, groups them per site, and
// calls `assembleSiteFeatures` here. Keeping the mapping PURE (no IO, no PostGIS) means
// the load-bearing product rules — unknown ≠ zero, "no MAPPED road" ≠ "no access",
// AADF attributed via the road the parcel fronts (M4's via_road verdict) — are unit-
// testable in Jest, exactly like the rest of the engine.
//
// Design rules encoded here (all evidenced in M3–M8):
// - `roads = null` ONLY when road association never ran for the site (no road rows AND
//   no geometry row). For our fully-enriched universe, a site with no mapped road within
//   the M3 radius yields `roads = []` — "association ran, found no mapped road", which the
//   road_proximity evaluator reads as a miss, NOT unknown. This is why road_proximity is
//   configured `preferred` (never eliminating) in a recall-favouring search: OS Open Roads
//   omits minor/private/farm tracks, so `[]` is a screening negative, not an access verdict.
// - Traffic AADF is attached to the SAME road the parcel relates to, via M4's `via_road`
//   linking method (count point snapped to the site's associated road link) — the method
//   M4 chose as primary. `count_point_direct` rows are ignored here (kept in the DB as a
//   cross-check); the engine reasons about the road the site fronts, not the nearest blip.
// - Land use / frontage / junction / constraints / same-brand distance are mapped through
//   the already-tested M5–M8 pure modules so their interpretation is shared, not re-derived.

import { toBrandDistanceFeatures, type BrandEstateRaw } from './brand-distance'
import { toSiteConstraintFeatures, type SiteConstraintRaw } from './constraint-screening'
import { toSiteGeometryFeatures, type SiteGeometryRaw } from './geometry-screening'
import type { LandUseConfidence, RoadFeature, SiteFeaturesRaw } from './types'

/** candidate_sites row (only the columns the engine needs). */
export interface CandidateSiteRow {
  id: string
  name: string | null
  area_acres: number | null
  current_land_use: string | null
  land_use_confidence: string | null
}

/** candidate_site_roads row (M3). */
export interface RoadRow {
  road_link_id: string
  distance_m: number | null
  road_classification: string | null
  road_number: string | null
  is_nearest_overall?: boolean | null
  is_nearest_in_primary_class?: boolean | null
}

/** candidate_site_traffic row (M4). */
export interface TrafficRow {
  method: string // 'count_point_direct' | 'via_road'
  via_road_link_id: string | null
  aadf_all_motor_vehicles: number | null
  aadf_year: number | null
  estimation_method: string | null
  road_number?: string | null
  is_best_for_method?: boolean | null
  /** Denormalised source label, e.g. 'DfT AADF'. Defaults when absent. */
  traffic_source?: string | null
}

/** candidate_site_geometry row (M6). */
export interface GeometryRow {
  has_associated_road: boolean | null
  frontage_m: number | null
  primary_frontage_m: number | null
  nearest_junction_m: number | null
  nearest_junction_form: string | null
  nearest_roundabout_m: number | null
}

/** candidate_site_constraints row (M8). */
export interface ConstraintRow {
  constraint_type: string
  category: string | null
  overlap_fraction: number | null
  overlap_area_sqm?: number | null
  feature_count?: number | null
}

/** The per-site raw bundle the service groups from its paged pulls. */
export interface SiteEnrichmentBundle {
  site: CandidateSiteRow
  roads: RoadRow[]
  traffic: TrafficRow[]
  geometry: GeometryRow | null
  constraints: ConstraintRow[]
  /** Same-brand estate measurement from the M7 search-time RPC, or null when the search
   *  is brand-agnostic (then same_brand_distance is treated as satisfied). */
  brand: BrandEstateRaw | null
}

const DEFAULT_TRAFFIC_SOURCE = 'DfT AADF'

function fin(v: number | null | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function landUseConfidence(raw: string | null): LandUseConfidence | null {
  return raw === 'high' || raw === 'medium' || raw === 'low' ? raw : null
}

/**
 * Build a map road_link_id → its via_road AADF snapshot, so each road the parcel relates
 * to carries the traffic measured ON that road (M4's primary linking method). Only
 * `via_road` rows are used; `count_point_direct` is a cross-check kept in the DB.
 */
function viaRoadAadf(
  traffic: TrafficRow[]
): Map<string, Pick<RoadFeature, 'aadf' | 'aadfYear' | 'aadfSource' | 'estimationMethod'>> {
  const map = new Map<
    string,
    Pick<RoadFeature, 'aadf' | 'aadfYear' | 'aadfSource' | 'estimationMethod'>
  >()
  for (const t of traffic) {
    if (t.method !== 'via_road' || !t.via_road_link_id) continue
    const aadf = fin(t.aadf_all_motor_vehicles)
    if (aadf == null) continue
    const existing = map.get(t.via_road_link_id)
    // Prefer the flagged representative point; else the first with a real AADF.
    if (existing && !t.is_best_for_method) continue
    map.set(t.via_road_link_id, {
      aadf,
      aadfYear: fin(t.aadf_year),
      aadfSource: t.traffic_source ?? DEFAULT_TRAFFIC_SOURCE,
      estimationMethod: t.estimation_method ?? null,
    })
  }
  return map
}

/**
 * Assemble one site's normalised `SiteFeaturesRaw` from its grouped enrichment rows.
 * PURE — the search service supplies already-fetched rows.
 */
export function assembleSiteFeatures(bundle: SiteEnrichmentBundle): SiteFeaturesRaw {
  const { site, roads, traffic, geometry, constraints, brand } = bundle

  // roads: null = association never ran (unknown); [] = ran, no mapped road within radius.
  const roadAssociationRan = roads.length > 0 || geometry != null
  let roadFeatures: RoadFeature[] | null = null
  if (roadAssociationRan) {
    const aadfByLink = viaRoadAadf(traffic)
    roadFeatures = roads.map((r) => {
      const t = aadfByLink.get(r.road_link_id)
      return {
        roadClass: r.road_classification ?? '(unclassified)',
        roadNumber: r.road_number ?? null,
        distanceM: fin(r.distance_m) ?? 0,
        aadf: t?.aadf ?? null,
        aadfYear: t?.aadfYear ?? null,
        aadfSource: t?.aadfSource ?? null,
        estimationMethod: t?.estimationMethod ?? null,
      }
    })
  }

  const geom = geometry
    ? toSiteGeometryFeatures(toSiteGeometryRaw(geometry))
    : { frontageM: null, nearestJunctionDistanceM: null, junctionType: null }

  const { constraints: constraintTokens } = toSiteConstraintFeatures(
    constraints.map(toSiteConstraintRaw)
  )

  const brandFeatures = brand
    ? toBrandDistanceFeatures(brand)
    : { sameBrandDistanceM: null, brandHasStores: false }

  return {
    siteId: site.id,
    name: site.name,
    areaAcres: fin(site.area_acres),
    currentLandUse: site.current_land_use ?? null,
    landUseConfidence: landUseConfidence(site.land_use_confidence),
    roads: roadFeatures,
    frontageM: geom.frontageM,
    nearestJunctionDistanceM: geom.nearestJunctionDistanceM,
    junctionType: geom.junctionType,
    sameBrandDistanceM: brandFeatures.sameBrandDistanceM,
    brandHasStores: brandFeatures.brandHasStores,
    constraints: constraintTokens,
  }
}

function toSiteGeometryRaw(g: GeometryRow): SiteGeometryRaw {
  return {
    frontageM: fin(g.frontage_m),
    primaryFrontageM: fin(g.primary_frontage_m),
    hasAssociatedRoad: !!g.has_associated_road,
    nearestJunctionM: fin(g.nearest_junction_m),
    nearestJunctionForm: g.nearest_junction_form ?? null,
    nearestRoundaboutM: fin(g.nearest_roundabout_m),
  }
}

function toSiteConstraintRaw(c: ConstraintRow): SiteConstraintRaw {
  return {
    constraintType: c.constraint_type,
    category: c.category ?? null,
    overlapFraction: fin(c.overlap_fraction),
    overlapAreaSqm: fin(c.overlap_area_sqm ?? null),
    featureCount: fin(c.feature_count ?? null),
  }
}

// ---------------------------------------------------------------------------
// Land-use × road-coverage cross-tab — the cheap queued M9 input. Answers: does the
// land-use-classified subset concentrate on the roadside parcels (the ones that also
// carry road/traffic/frontage), so the well-covered core is bigger than the blended
// 48%/50% headline coverage suggests?
// ---------------------------------------------------------------------------

export interface LandUseRoadCrossTab {
  total: number
  classifiedRoadside: number
  classifiedNoRoad: number
  unknownRoadside: number
  unknownNoRoad: number
  classified: number
  unknown: number
  roadside: number
  noRoad: number
  /** P(classified | roadside) as a 0–100 %. */
  pctClassifiedGivenRoadside: number
  /** P(classified | no mapped road) as a 0–100 %. */
  pctClassifiedGivenNoRoad: number
}

/** A site is "roadside" here iff road association produced at least one mapped road. */
export function hasMappedRoad(f: SiteFeaturesRaw): boolean {
  return f.roads != null && f.roads.length > 0
}

export function crossTabLandUseRoad(features: SiteFeaturesRaw[]): LandUseRoadCrossTab {
  let classifiedRoadside = 0
  let classifiedNoRoad = 0
  let unknownRoadside = 0
  let unknownNoRoad = 0
  for (const f of features) {
    const classified = f.currentLandUse != null
    const roadside = hasMappedRoad(f)
    if (classified && roadside) classifiedRoadside++
    else if (classified && !roadside) classifiedNoRoad++
    else if (!classified && roadside) unknownRoadside++
    else unknownNoRoad++
  }
  const roadside = classifiedRoadside + unknownRoadside
  const noRoad = classifiedNoRoad + unknownNoRoad
  const pct = (a: number, b: number) => (b > 0 ? Math.round((100 * a) / b) : 0)
  return {
    total: features.length,
    classifiedRoadside,
    classifiedNoRoad,
    unknownRoadside,
    unknownNoRoad,
    classified: classifiedRoadside + classifiedNoRoad,
    unknown: unknownRoadside + unknownNoRoad,
    roadside,
    noRoad,
    pctClassifiedGivenRoadside: pct(classifiedRoadside, roadside),
    pctClassifiedGivenNoRoad: pct(classifiedNoRoad, noRoad),
  }
}
