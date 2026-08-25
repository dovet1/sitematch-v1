import { DEFAULT_SCORING_CONFIG, labelForScore, rankSites, scoreAndRank, scoreSite } from '../scoring'
import type { OccupierRequirement, RoadFeature, SiteFeaturesRaw } from '../types'

// Canonical Canterbury drive-thru requirement profile used across the suite.
const DRIVE_THRU: OccupierRequirement = {
  id: 'req-drivethru',
  brandId: 'brand-1',
  name: 'Drive-thru',
  profileType: 'drive-thru',
  description: null,
  criteria: [
    { key: 'site_area', mode: 'required', params: { minAcres: 0.3, maxAcres: 0.7 } },
    { key: 'road_proximity', mode: 'required', params: { roadClasses: ['A Road'], maxDistanceM: 50 } },
    { key: 'traffic_aadf', mode: 'required', params: { minAadf: 15000, roadClasses: ['A Road'] } },
    { key: 'road_frontage', mode: 'required', params: { minM: 25 } },
    { key: 'same_brand_distance', mode: 'required', params: { minMiles: 2 } },
    { key: 'junction_distance', mode: 'preferred', params: { maxM: 500 } },
    { key: 'land_use', mode: 'preferred', params: { preferred: ['pub', 'petrol_station', 'car_park', 'showroom', 'vacant'], excluded: ['residential'] } },
    { key: 'planning_constraints', mode: 'warning', params: { exclusions: ['flood_zone_3'], warnings: ['conservation_area', 'green_belt'] } },
    { key: 'access', mode: 'warning', params: {} },
  ],
}

function road(overrides: Partial<RoadFeature> = {}): RoadFeature {
  return { roadClass: 'A Road', roadNumber: 'A28', distanceM: 12, aadf: 21800, aadfYear: 2025, aadfSource: 'DfT', estimationMethod: 'Counted', ...overrides }
}

function features(overrides: Partial<SiteFeaturesRaw> = {}): SiteFeaturesRaw {
  return {
    siteId: 'site',
    name: 'Site',
    areaAcres: 0.52,
    currentLandUse: 'pub',
    landUseConfidence: 'high',
    roads: [road()],
    frontageM: 31,
    nearestJunctionDistanceM: 240,
    junctionType: 'roundabout',
    sameBrandDistanceM: 4506, // ~2.8 miles
    brandHasStores: true,
    constraints: ['conservation_area'],
    shape: null,
    ...overrides,
  }
}

describe('labelForScore', () => {
  it('maps scores to Strong / Potential / Weak', () => {
    expect(labelForScore(95)).toBe('strong')
    expect(labelForScore(DEFAULT_SCORING_CONFIG.strongThreshold)).toBe('strong')
    expect(labelForScore(60)).toBe('potential')
    expect(labelForScore(40)).toBe('weak')
  })
})

describe('scoreSite — worked drive-thru example', () => {
  const result = scoreSite(DRIVE_THRU, features())

  it('is eligible with all seven measurable criteria matched', () => {
    expect(result.eligible).toBe(true)
    expect(result.matched).toBe(7)
    expect(result.measurable).toBe(7)
    expect(result.score).toBe(100)
    expect(result.label).toBe('strong')
  })

  it('surfaces the conservation-area warning without harming the score', () => {
    expect(result.warnings.some((w) => /planning constraints/i.test(w))).toBe(true)
  })

  it('reports highways access as unknown — never a suitability claim', () => {
    const access = result.criteria.find((c) => c.criterion === 'access')
    expect(access?.status).toBe('unknown')
    expect(access?.message).toMatch(/highways review/i)
  })

  it('treats unknown criteria as neutral (excluded from the measurable denominator)', () => {
    // access is unknown → not counted; planning is a warning → not counted.
    expect(result.measurable).toBe(7)
  })
})

describe('scoreSite — required failure', () => {
  it('marks the site ineligible when a required criterion fails', () => {
    const tooSmall = scoreSite(DRIVE_THRU, features({ areaAcres: 0.1 }))
    expect(tooSmall.eligible).toBe(false)
  })

  it('does not eliminate on missing data (required criterion unknown stays eligible)', () => {
    const noArea = scoreSite(DRIVE_THRU, features({ areaAcres: null }))
    expect(noArea.eligible).toBe(true)
  })
})

describe('scoreSite — preferred criteria affect ranking, not eligibility', () => {
  it('lowers the score but keeps the site eligible when a preferred criterion fails', () => {
    const farJunction = scoreSite(DRIVE_THRU, features({ nearestJunctionDistanceM: 900 }))
    expect(farJunction.eligible).toBe(true)
    expect(farJunction.score).toBeLessThan(100)
    expect(farJunction.matched).toBe(6)
    expect(farJunction.measurable).toBe(7)
    expect(farJunction.score).toBe(Math.round((100 * 6) / 7)) // 86
  })
})

describe('rankSites', () => {
  it('orders eligible-first, then by score, then by evidence breadth', () => {
    const strong = scoreSite(DRIVE_THRU, features({ siteId: 'strong' }))
    const partial = scoreSite(DRIVE_THRU, features({ siteId: 'partial', nearestJunctionDistanceM: 900 }))
    const ineligible = scoreSite(DRIVE_THRU, features({ siteId: 'ineligible', frontageM: 5 }))
    const ranked = rankSites([ineligible, partial, strong])
    expect(ranked.map((r) => r.siteId)).toEqual(['strong', 'partial', 'ineligible'])
  })
})

describe('scoreAndRank — mixed universe produces varied labels', () => {
  it('yields strong / potential/weak / ineligible outcomes', () => {
    const sites = [
      features({ siteId: 'a' }), // strong, 100
      features({ siteId: 'b', nearestJunctionDistanceM: 900, currentLandUse: null }), // junction fail + land use unknown
      features({ siteId: 'c', areaAcres: 0.1 }), // below-min area → required fail → ineligible
    ]
    const ranked = scoreAndRank(DRIVE_THRU, sites)
    expect(ranked[0].siteId).toBe('a')
    expect(ranked[0].label).toBe('strong')
    expect(ranked.find((r) => r.siteId === 'c')?.eligible).toBe(false)
    // b: land use unknown drops a measurable criterion; junction fail → 5/6
    const b = ranked.find((r) => r.siteId === 'b')!
    expect(b.eligible).toBe(true)
    expect(b.measurable).toBe(6)
    expect(b.matched).toBe(5)
  })
})
