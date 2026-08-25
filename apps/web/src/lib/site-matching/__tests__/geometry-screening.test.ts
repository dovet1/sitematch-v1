import {
  classifyFrontage,
  classifyJunction,
  screenSiteGeometry,
  toSiteGeometryFeatures,
  DEFAULT_FRONTAGE_THRESHOLDS,
  DEFAULT_JUNCTION_THRESHOLDS,
  type SiteGeometryRaw,
} from '../geometry-screening'

function raw(overrides: Partial<SiteGeometryRaw> = {}): SiteGeometryRaw {
  return {
    frontageM: null,
    primaryFrontageM: null,
    hasAssociatedRoad: false,
    nearestJunctionM: null,
    nearestJunctionForm: null,
    nearestRoundaboutM: null,
    ...overrides,
  }
}

describe('classifyFrontage — unknown is never zero', () => {
  it('no associated road → unknown, not measured (frontage stays null)', () => {
    const f = classifyFrontage(null, false)
    expect(f.band).toBe('unknown')
    expect(f.measured).toBe(false)
    expect(f.frontageM).toBeNull()
  })

  it('a road IS associated but a null frontage → still unknown (defensive)', () => {
    const f = classifyFrontage(null, true)
    expect(f.band).toBe('unknown')
    expect(f.measured).toBe(false)
  })

  it('a road is nearby but the parcel presents ~no edge → measured `none`, NOT unknown', () => {
    const f = classifyFrontage(0, true)
    expect(f.band).toBe('none')
    expect(f.measured).toBe(true)
    expect(f.frontageM).toBe(0)
  })

  it('a sub-epsilon frontage counts as none (buffer noise, not an edge)', () => {
    const f = classifyFrontage(0.6, true) // < 1 m zeroEpsilon
    expect(f.band).toBe('none')
    expect(f.measured).toBe(true)
  })
})

describe('classifyFrontage — positive-frontage bands', () => {
  it('below narrowMax → narrow', () => {
    expect(classifyFrontage(6, true).band).toBe('narrow')
  })
  it('at narrowMax boundary → moderate (inclusive lower)', () => {
    expect(classifyFrontage(DEFAULT_FRONTAGE_THRESHOLDS.narrowMaxM, true).band).toBe('moderate')
  })
  it('mid range → moderate', () => {
    expect(classifyFrontage(25, true).band).toBe('moderate')
  })
  it('at moderateMax boundary → wide (inclusive lower)', () => {
    expect(classifyFrontage(DEFAULT_FRONTAGE_THRESHOLDS.moderateMaxM, true).band).toBe('wide')
  })
  it('large frontage → wide', () => {
    expect(classifyFrontage(120, true).band).toBe('wide')
  })
  it('respects custom thresholds', () => {
    const t = { narrowMaxM: 5, moderateMaxM: 15, zeroEpsilonM: 0.5 }
    expect(classifyFrontage(4, true, t).band).toBe('narrow')
    expect(classifyFrontage(10, true, t).band).toBe('moderate')
    expect(classifyFrontage(20, true, t).band).toBe('wide')
  })
})

describe('classifyJunction — proximity bands + kind', () => {
  it('no junction distance → unknown', () => {
    const j = classifyJunction(null, null)
    expect(j.band).toBe('unknown')
    expect(j.nearestKind).toBeNull()
  })
  it('very close → at', () => {
    expect(classifyJunction(10, null).band).toBe('at')
  })
  it('atMax boundary is inclusive → at', () => {
    expect(classifyJunction(DEFAULT_JUNCTION_THRESHOLDS.atMaxM, null).band).toBe('at')
  })
  it('near band', () => {
    expect(classifyJunction(60, null).band).toBe('near')
  })
  it('moderate band', () => {
    expect(classifyJunction(200, null).band).toBe('moderate')
  })
  it('far band', () => {
    expect(classifyJunction(500, null).band).toBe('far')
  })
  it('nearest node kind is junction by default', () => {
    expect(classifyJunction(40, 250, 'junction').nearestKind).toBe('junction')
  })
  it('explicit roundabout form → roundabout', () => {
    expect(classifyJunction(40, 40, 'roundabout').nearestKind).toBe('roundabout')
  })
  it('infers roundabout when nearest node distance equals the nearest roundabout distance', () => {
    expect(classifyJunction(40, 40, null).nearestKind).toBe('roundabout')
  })
  it('keeps junction when a roundabout exists but is further than the nearest junction', () => {
    const j = classifyJunction(40, 180, 'junction')
    expect(j.nearestKind).toBe('junction')
    expect(j.roundaboutM).toBe(180)
  })
})

describe('screenSiteGeometry — hedged summary, unknown preserved', () => {
  it('landlocked interior parcel (no road) → frontage unknown, junction unknown, hedged notes', () => {
    const s = screenSiteGeometry(raw({ hasAssociatedRoad: false }))
    expect(s.frontage.band).toBe('unknown')
    expect(s.junction.band).toBe('unknown')
    expect(s.notes.some((n) => /Frontage unknown/i.test(n))).toBe(true)
    // Never an access/suitability claim.
    expect(s.notes.some((n) => /not a highways\/access assessment/i.test(n))).toBe(true)
    expect(s.notes.join(' ')).not.toMatch(/suitable/i)
  })

  it('roadside parcel with wide frontage near a junction → measured bands + notes', () => {
    const s = screenSiteGeometry(
      raw({
        frontageM: 55,
        primaryFrontageM: 55,
        hasAssociatedRoad: true,
        nearestJunctionM: 30,
        nearestJunctionForm: 'junction',
        nearestRoundaboutM: 220,
      }),
    )
    expect(s.frontage.band).toBe('wide')
    expect(s.junction.band).toBe('near')
    expect(s.notes.some((n) => /road-facing boundary \(wide\)/i.test(n))).toBe(true)
  })

  it('surfaces a larger classified-road frontage when it exceeds the nearest-overall frontage', () => {
    const s = screenSiteGeometry(
      raw({ frontageM: 8, primaryFrontageM: 45, hasAssociatedRoad: true, nearestJunctionM: 500 }),
    )
    expect(s.frontage.band).toBe('narrow')
    expect(s.primaryFrontage.band).toBe('wide')
    expect(s.notes.some((n) => /classified \(A\/B\/Motorway\) road/i.test(n))).toBe(true)
  })

  it('a road nearby but no abutting edge → `none`, and no fabricated "unknown"', () => {
    const s = screenSiteGeometry(raw({ frontageM: 0, hasAssociatedRoad: true, nearestJunctionM: 90 }))
    expect(s.frontage.band).toBe('none')
    expect(s.notes.some((n) => /set back/i.test(n))).toBe(true)
  })
})

describe('toSiteGeometryFeatures — maps into the engine features, unknown≠zero', () => {
  it('no associated road → frontage null (unknown), junction null', () => {
    const f = toSiteGeometryFeatures(raw({ frontageM: null, hasAssociatedRoad: false }))
    expect(f.frontageM).toBeNull()
    expect(f.nearestJunctionDistanceM).toBeNull()
  })
  it('measured zero frontage flows through as 0, not null', () => {
    const f = toSiteGeometryFeatures(raw({ frontageM: 0, hasAssociatedRoad: true, nearestJunctionM: 45 }))
    expect(f.frontageM).toBe(0)
    expect(f.nearestJunctionDistanceM).toBe(45)
  })
  it('passes the junction form through as junctionType', () => {
    const f = toSiteGeometryFeatures(
      raw({ frontageM: 20, hasAssociatedRoad: true, nearestJunctionM: 15, nearestJunctionForm: 'roundabout' }),
    )
    expect(f.frontageM).toBe(20)
    expect(f.junctionType).toBe('roundabout')
  })
})
