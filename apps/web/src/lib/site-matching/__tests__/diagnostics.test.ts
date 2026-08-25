import { buildFunnel } from '../diagnostics'
import type { OccupierRequirement, RoadFeature, SiteFeaturesRaw } from '../types'

const REQUIREMENT: OccupierRequirement = {
  id: 'req',
  brandId: 'b',
  name: 'Drive-thru',
  profileType: 'drive-thru',
  description: null,
  criteria: [
    { key: 'site_area', mode: 'required', params: { minAcres: 0.3, maxAcres: 0.7 } },
    { key: 'traffic_aadf', mode: 'required', params: { minAadf: 15000, roadClasses: ['A Road'] } },
    { key: 'junction_distance', mode: 'preferred', params: { maxM: 500 } }, // preferred: excluded from funnel
  ],
}

function road(overrides: Partial<RoadFeature> = {}): RoadFeature {
  return { roadClass: 'A Road', roadNumber: 'A28', distanceM: 12, aadf: 21800, aadfYear: 2025, aadfSource: 'DfT', estimationMethod: 'Counted', ...overrides }
}

function features(overrides: Partial<SiteFeaturesRaw> = {}): SiteFeaturesRaw {
  return {
    siteId: 'x', name: null, areaAcres: 0.5, currentLandUse: null, landUseConfidence: null,
    roads: [road()], frontageM: 30, nearestJunctionDistanceM: 200, junctionType: null,
    sameBrandDistanceM: null, brandHasStores: false, constraints: [], shape: null, ...overrides,
  }
}

describe('buildFunnel', () => {
  const universe: SiteFeaturesRaw[] = [
    features({ siteId: 'good' }), // passes area + traffic
    features({ siteId: 'too-small', areaAcres: 0.1 }), // fails area (below min; oversized would be retained)
    features({ siteId: 'low-traffic', roads: [road({ aadf: 5000 })] }), // fails traffic
    features({ siteId: 'no-traffic-data', roads: [road({ aadf: null })] }), // UNKNOWN traffic
    features({ siteId: 'no-area-data', areaAcres: null }), // UNKNOWN area
  ]
  const diag = buildFunnel(universe, REQUIREMENT)

  it('only builds gates for required criteria', () => {
    expect(diag.funnel.map((g) => g.criterion)).toEqual(['site_area', 'traffic_aadf'])
  })

  it('separates fail from unknown at each gate', () => {
    const area = diag.funnel[0]
    expect(area.entering).toBe(5)
    expect(area.fail).toBe(1) // too-small (below min)
    expect(area.unknown).toBe(1) // no-area-data
    expect(area.pass).toBe(3)
    expect(area.retainedUnknown).toBe(true)
    expect(area.surviving).toBe(4) // fail dropped, unknown retained
  })

  it('carries unknowns into subsequent gates', () => {
    const traffic = diag.funnel[1]
    expect(traffic.entering).toBe(4) // area survivors
    expect(traffic.fail).toBe(1) // low-traffic
    expect(traffic.unknown).toBe(1) // no-traffic-data
    // survivors: good, no-area-data (still unknown area), no-traffic-data
    expect(traffic.surviving).toBe(3)
  })

  it('reports final survivors distinctly from a coverage-driven drop', () => {
    expect(diag.universe).toBe(5)
    expect(diag.survivors).toBe(3)
  })

  it('reports data-coverage so poor coverage is not mistaken for tight criteria', () => {
    const traffic = diag.coverage.find((c) => c.field === 'traffic')!
    // 4 of 5 have a real AADF (only 'no-traffic-data' has aadf=null)
    expect(traffic.present).toBe(4)
    expect(traffic.total).toBe(5)
    expect(traffic.pct).toBe(80)
    const landUse = diag.coverage.find((c) => c.field === 'land_use')!
    expect(landUse.present).toBe(0) // all null in this universe
  })
})
