import { evaluateCriterion, relevantRoad } from '../criteria'
import type { CriterionConfig, RoadFeature, SiteFeaturesRaw } from '../types'

function features(overrides: Partial<SiteFeaturesRaw> = {}): SiteFeaturesRaw {
  return {
    siteId: 'site-1',
    name: 'Test site',
    areaAcres: 0.5,
    currentLandUse: null,
    landUseConfidence: null,
    roads: null,
    frontageM: null,
    nearestJunctionDistanceM: null,
    junctionType: null,
    sameBrandDistanceM: null,
    brandHasStores: false,
    constraints: [],
    shape: null,
    ...overrides,
  }
}

function road(overrides: Partial<RoadFeature> = {}): RoadFeature {
  return {
    roadClass: 'A Road',
    roadNumber: 'A28',
    distanceM: 12,
    aadf: 21800,
    aadfYear: 2025,
    aadfSource: 'DfT',
    estimationMethod: 'Counted',
    ...overrides,
  }
}

const cfg = (key: CriterionConfig['key'], params: Record<string, unknown>, mode: CriterionConfig['mode'] = 'required'): CriterionConfig =>
  ({ key, mode, params })

describe('relevantRoad', () => {
  it('picks the nearest road among accepted classes', () => {
    const f = features({
      roads: [road({ roadClass: 'A Road', distanceM: 40 }), road({ roadClass: 'B Road', distanceM: 5 })],
    })
    expect(relevantRoad(f, ['A Road'])?.distanceM).toBe(40)
    expect(relevantRoad(f, ['A Road', 'B Road'])?.distanceM).toBe(5)
  })

  it('returns null when no road data or no accepted class present', () => {
    expect(relevantRoad(features({ roads: null }), ['A Road'])).toBeNull()
    expect(relevantRoad(features({ roads: [road({ roadClass: 'B Road' })] }), ['A Road'])).toBeNull()
  })
})

describe('site_area', () => {
  it('passes within range, fails below min, unknown when missing', () => {
    const c = cfg('site_area', { minAcres: 0.3, maxAcres: 0.7 })
    expect(evaluateCriterion(c, features({ areaAcres: 0.52 })).status).toBe('pass')
    expect(evaluateCriterion(c, features({ areaAcres: 0.1 })).status).toBe('fail') // below min
    expect(evaluateCriterion(c, features({ areaAcres: null })).status).toBe('unknown')
  })

  it('oversized title is RETAINED (warning + oversized flag), not failed, and keeps its real area', () => {
    const c = cfg('site_area', { minAcres: 0.3, maxAcres: 0.7 })
    const r = evaluateCriterion(c, features({ areaAcres: 4.32 }))
    expect(r.status).toBe('warning') // not a fail → the site stays eligible
    expect(r.oversized).toBe(true)
    expect(r.value).toBe('4.32 acres') // actual title area preserved
    expect(r.message).toMatch(/larger than requested footprint/i)
  })

  it('failOversized:true restores the strict hard-fail for a caller that wants it', () => {
    const c = cfg('site_area', { minAcres: 0.3, maxAcres: 0.7, failOversized: true })
    expect(evaluateCriterion(c, features({ areaAcres: 4.32 })).status).toBe('fail')
  })
})

describe('road_proximity', () => {
  const c = cfg('road_proximity', { roadClasses: ['A Road'], maxDistanceM: 50 })
  it('passes an A-road within distance', () => {
    const r = evaluateCriterion(c, features({ roads: [road({ distanceM: 12 })] }))
    expect(r.status).toBe('pass')
    expect(r.value).toContain('A28')
  })
  it('fails when the qualifying road is too far', () => {
    expect(evaluateCriterion(c, features({ roads: [road({ distanceM: 120 })] })).status).toBe('fail')
  })
  it('fails when computed but no accepted-class road nearby', () => {
    expect(evaluateCriterion(c, features({ roads: [road({ roadClass: 'B Road' })] })).status).toBe('fail')
  })
  it('is unknown when no road data was computed at all', () => {
    expect(evaluateCriterion(c, features({ roads: null })).status).toBe('unknown')
  })
})

describe('traffic_aadf', () => {
  const c = cfg('traffic_aadf', { minAadf: 15000, roadClasses: ['A Road'] })
  it('passes when the relevant road AADF meets the threshold', () => {
    const r = evaluateCriterion(c, features({ roads: [road({ aadf: 21800 })] }))
    expect(r.status).toBe('pass')
    expect(r.value).toContain('21,800')
    expect(r.value).toContain('Counted')
  })
  it('fails below the threshold', () => {
    expect(evaluateCriterion(c, features({ roads: [road({ aadf: 8000 })] })).status).toBe('fail')
  })
  it('is unknown when the relevant road has no AADF (missing data, not a fail)', () => {
    expect(evaluateCriterion(c, features({ roads: [road({ aadf: null })] })).status).toBe('unknown')
    expect(evaluateCriterion(c, features({ roads: null })).status).toBe('unknown')
  })
})

describe('road_frontage', () => {
  const c = cfg('road_frontage', { minM: 25 })
  it('passes/fails/unknown', () => {
    expect(evaluateCriterion(c, features({ frontageM: 31 })).status).toBe('pass')
    expect(evaluateCriterion(c, features({ frontageM: 18 })).status).toBe('fail')
    expect(evaluateCriterion(c, features({ frontageM: null })).status).toBe('unknown')
  })
})

describe('junction_distance', () => {
  const c = cfg('junction_distance', { maxM: 500 }, 'preferred')
  it('passes/fails/unknown', () => {
    expect(evaluateCriterion(c, features({ nearestJunctionDistanceM: 240 })).status).toBe('pass')
    expect(evaluateCriterion(c, features({ nearestJunctionDistanceM: 900 })).status).toBe('fail')
    expect(evaluateCriterion(c, features({ nearestJunctionDistanceM: null })).status).toBe('unknown')
  })
})

describe('land_use', () => {
  const c = cfg('land_use', { preferred: ['pub', 'car_park'], excluded: ['residential'] }, 'preferred')
  it('passes preferred and acceptable uses', () => {
    expect(evaluateCriterion(c, features({ currentLandUse: 'pub', landUseConfidence: 'high' })).status).toBe('pass')
    expect(evaluateCriterion(c, features({ currentLandUse: 'office', landUseConfidence: 'high' })).status).toBe('pass')
  })
  it('is unknown when land use is unknown (never a fail)', () => {
    expect(evaluateCriterion(c, features({ currentLandUse: null })).status).toBe('unknown')
  })
  it('hard-fails an excluded use only with high confidence; warns otherwise', () => {
    expect(evaluateCriterion(c, features({ currentLandUse: 'residential', landUseConfidence: 'high' })).status).toBe('fail')
    expect(evaluateCriterion(c, features({ currentLandUse: 'residential', landUseConfidence: 'low' })).status).toBe('warning')
  })
})

describe('planning_constraints', () => {
  const c = cfg('planning_constraints', { exclusions: ['flood_zone_3'], warnings: ['conservation_area'] }, 'warning')
  it('passes when no constraints detected', () => {
    expect(evaluateCriterion(c, features({ constraints: [] })).status).toBe('pass')
  })
  it('warns on a warning-level constraint and reports detail', () => {
    const r = evaluateCriterion(c, features({ constraints: ['conservation_area'] }))
    expect(r.status).toBe('warning')
    expect(r.details).toEqual([{ constraint: 'conservation_area', severity: 'warning' }])
  })
  it('fails on an excluding constraint', () => {
    expect(evaluateCriterion(c, features({ constraints: ['flood_zone_3'] })).status).toBe('fail')
  })
})

describe('same_brand_distance', () => {
  const c = cfg('same_brand_distance', { minMiles: 2 })
  it('passes when far enough from an existing store', () => {
    expect(evaluateCriterion(c, features({ brandHasStores: true, sameBrandDistanceM: 4500 })).status).toBe('pass')
  })
  it('fails when too close to an existing store', () => {
    expect(evaluateCriterion(c, features({ brandHasStores: true, sameBrandDistanceM: 800 })).status).toBe('fail')
  })
  it('passes when the brand has no existing stores (nothing to cannibalise)', () => {
    expect(evaluateCriterion(c, features({ brandHasStores: false, sameBrandDistanceM: null })).status).toBe('pass')
  })
})

describe('access', () => {
  it('is always unknown and never claims suitability', () => {
    const r = evaluateCriterion(cfg('access', {}, 'warning'), features())
    expect(r.status).toBe('unknown')
    expect(r.message).toMatch(/highways review/i)
  })
})

describe('unsupported criterion', () => {
  it('yields unknown rather than throwing', () => {
    const r = evaluateCriterion({ key: 'future_criterion' as never, mode: 'preferred' }, features())
    expect(r.status).toBe('unknown')
  })
})
