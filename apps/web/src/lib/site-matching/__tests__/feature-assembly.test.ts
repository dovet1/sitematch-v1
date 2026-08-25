import {
  assembleSiteFeatures,
  crossTabLandUseRoad,
  hasMappedRoad,
  type SiteEnrichmentBundle,
  type CandidateSiteRow,
} from '../feature-assembly'
import type { SiteFeaturesRaw } from '../types'

function site(overrides: Partial<CandidateSiteRow> = {}): CandidateSiteRow {
  return {
    id: 'site-1',
    name: 'Test parcel',
    area_acres: 0.5,
    current_land_use: null,
    land_use_confidence: null,
    ...overrides,
  }
}

function bundle(overrides: Partial<SiteEnrichmentBundle> = {}): SiteEnrichmentBundle {
  return {
    site: site(),
    roads: [],
    traffic: [],
    geometry: null,
    constraints: [],
    brand: null,
    ...overrides,
  }
}

describe('assembleSiteFeatures — roads: null (unknown) vs [] (computed none)', () => {
  it('no road rows and no geometry row → roads null (association never ran = unknown)', () => {
    const f = assembleSiteFeatures(bundle())
    expect(f.roads).toBeNull()
  })

  it('geometry row present but no road rows → roads [] (ran, no mapped road within radius)', () => {
    const f = assembleSiteFeatures(
      bundle({
        geometry: {
          has_associated_road: false,
          frontage_m: null,
          primary_frontage_m: null,
          nearest_junction_m: null,
          nearest_junction_form: null,
          nearest_roundabout_m: null,
        },
      })
    )
    expect(f.roads).toEqual([])
  })

  it('road rows present → mapped RoadFeature[] carrying class/number/distance', () => {
    const f = assembleSiteFeatures(
      bundle({
        roads: [
          {
            road_link_id: 'rl-a',
            distance_m: 12.4,
            road_classification: 'A Road',
            road_number: 'A28',
            is_nearest_overall: false,
            is_nearest_in_primary_class: true,
          },
        ],
      })
    )
    expect(f.roads).toHaveLength(1)
    expect(f.roads![0]).toMatchObject({ roadClass: 'A Road', roadNumber: 'A28', distanceM: 12.4 })
  })

  it('null road_classification maps to (unclassified), not a crash', () => {
    const f = assembleSiteFeatures(
      bundle({ roads: [{ road_link_id: 'x', distance_m: 5, road_classification: null, road_number: null }] })
    )
    expect(f.roads![0].roadClass).toBe('(unclassified)')
  })
})

describe('assembleSiteFeatures — AADF attributed via M4 via_road', () => {
  const roadRow = {
    road_link_id: 'rl-a',
    distance_m: 10,
    road_classification: 'A Road',
    road_number: 'A28',
  }

  it('attaches AADF from a via_road traffic row keyed on the same road link', () => {
    const f = assembleSiteFeatures(
      bundle({
        roads: [roadRow],
        traffic: [
          {
            method: 'via_road',
            via_road_link_id: 'rl-a',
            aadf_all_motor_vehicles: 28801,
            aadf_year: 2023,
            estimation_method: 'Estimated',
            is_best_for_method: true,
            traffic_source: 'DfT AADF',
          },
        ],
      })
    )
    expect(f.roads![0].aadf).toBe(28801)
    expect(f.roads![0].aadfYear).toBe(2023)
    expect(f.roads![0].estimationMethod).toBe('Estimated')
    expect(f.roads![0].aadfSource).toBe('DfT AADF')
  })

  it('ignores count_point_direct rows (M4 chose via_road as primary)', () => {
    const f = assembleSiteFeatures(
      bundle({
        roads: [roadRow],
        traffic: [
          {
            method: 'count_point_direct',
            via_road_link_id: null,
            aadf_all_motor_vehicles: 8739,
            aadf_year: 2023,
            estimation_method: 'Counted',
            is_best_for_method: true,
          },
        ],
      })
    )
    expect(f.roads![0].aadf).toBeNull()
  })

  it('road with no via_road count point keeps aadf null (unknown), not 0', () => {
    const f = assembleSiteFeatures(bundle({ roads: [roadRow] }))
    expect(f.roads![0].aadf).toBeNull()
  })
})

describe('assembleSiteFeatures — land use, geometry, constraints, brand pass through the M5–M8 modules', () => {
  it('maps land use + confidence, coercing an invalid confidence to null', () => {
    const good = assembleSiteFeatures(bundle({ site: site({ current_land_use: 'residential', land_use_confidence: 'high' }) }))
    expect(good.currentLandUse).toBe('residential')
    expect(good.landUseConfidence).toBe('high')
    const bad = assembleSiteFeatures(bundle({ site: site({ current_land_use: 'retail', land_use_confidence: 'garbage' }) }))
    expect(bad.landUseConfidence).toBeNull()
  })

  it('unknown geometry (no row) → frontage/junction null, never zero', () => {
    const f = assembleSiteFeatures(bundle())
    expect(f.frontageM).toBeNull()
    expect(f.nearestJunctionDistanceM).toBeNull()
  })

  it('geometry with no associated road → frontage stays null (unknown ≠ zero)', () => {
    const f = assembleSiteFeatures(
      bundle({
        geometry: {
          has_associated_road: false,
          frontage_m: 0,
          primary_frontage_m: null,
          nearest_junction_m: 30,
          nearest_junction_form: 'junction',
          nearest_roundabout_m: null,
        },
      })
    )
    expect(f.frontageM).toBeNull()
    expect(f.nearestJunctionDistanceM).toBe(30)
  })

  it('a real above-epsilon flood overlap becomes a constraint token; a sub-epsilon clip does not', () => {
    const f = assembleSiteFeatures(
      bundle({
        constraints: [
          { constraint_type: 'flood_zone_3', category: 'flood', overlap_fraction: 0.6 },
          { constraint_type: 'flood_zone_2', category: 'flood', overlap_fraction: 0.0005 },
        ],
      })
    )
    expect(f.constraints).toContain('flood_zone_3')
    expect(f.constraints).not.toContain('flood_zone_2')
  })

  it('no brand supplied → brandHasStores false, distance null (same_brand treated as satisfied)', () => {
    const f = assembleSiteFeatures(bundle())
    expect(f.brandHasStores).toBe(false)
    expect(f.sameBrandDistanceM).toBeNull()
  })

  it('brand with an estate → real nearest distance and brandHasStores true', () => {
    const f = assembleSiteFeatures(bundle({ brand: { nearestDistanceM: 4830, brandStoreCount: 1497 } }))
    expect(f.brandHasStores).toBe(true)
    expect(f.sameBrandDistanceM).toBe(4830)
  })

  it('brand with no estate anywhere → satisfied, not unknown', () => {
    const f = assembleSiteFeatures(bundle({ brand: { nearestDistanceM: null, brandStoreCount: 0 } }))
    expect(f.brandHasStores).toBe(false)
    expect(f.sameBrandDistanceM).toBeNull()
  })
})

describe('crossTabLandUseRoad — the queued land-use × road cross-tab', () => {
  function feat(currentLandUse: string | null, roads: SiteFeaturesRaw['roads']): SiteFeaturesRaw {
    return {
      siteId: 'x',
      name: null,
      areaAcres: 0.5,
      currentLandUse,
      landUseConfidence: currentLandUse ? 'high' : null,
      roads,
      frontageM: null,
      nearestJunctionDistanceM: null,
      junctionType: null,
      sameBrandDistanceM: null,
      brandHasStores: false,
      constraints: [],
    }
  }
  const road = [{ roadClass: 'A Road', roadNumber: 'A28', distanceM: 10, aadf: null, aadfYear: null, aadfSource: null, estimationMethod: null }]

  it('hasMappedRoad: null and [] are both "no road"; a populated list is roadside', () => {
    expect(hasMappedRoad(feat(null, null))).toBe(false)
    expect(hasMappedRoad(feat(null, []))).toBe(false)
    expect(hasMappedRoad(feat(null, road))).toBe(true)
  })

  it('counts the four cells and conditional classified rates', () => {
    const features = [
      feat('retail', road), // classified + roadside
      feat('residential', road), // classified + roadside
      feat(null, road), // unknown + roadside
      feat('agricultural', null), // classified + no road
      feat(null, null), // unknown + no road
      feat(null, []), // unknown + no road
    ]
    const x = crossTabLandUseRoad(features)
    expect(x.total).toBe(6)
    expect(x.classifiedRoadside).toBe(2)
    expect(x.unknownRoadside).toBe(1)
    expect(x.classifiedNoRoad).toBe(1)
    expect(x.unknownNoRoad).toBe(2)
    expect(x.roadside).toBe(3)
    expect(x.noRoad).toBe(3)
    expect(x.pctClassifiedGivenRoadside).toBe(67) // 2/3
    expect(x.pctClassifiedGivenNoRoad).toBe(33) // 1/3
  })
})
