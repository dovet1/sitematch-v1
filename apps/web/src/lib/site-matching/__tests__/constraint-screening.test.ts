import {
  normaliseConstraintType,
  constraintCategory,
  classifyOverlap,
  screenSiteConstraints,
  toSiteConstraintFeatures,
  DEFAULT_OVERLAP_THRESHOLDS,
  type SiteConstraintRaw,
} from '../constraint-screening'

function row(overrides: Partial<SiteConstraintRaw> = {}): SiteConstraintRaw {
  return {
    constraintType: 'green_belt',
    category: null,
    overlapFraction: 0.5,
    overlapAreaSqm: null,
    featureCount: 1,
    ...overrides,
  }
}

describe('normaliseConstraintType', () => {
  it('passes through already-normalised tokens', () => {
    expect(normaliseConstraintType('flood_zone_2')).toBe('flood_zone_2')
    expect(normaliseConstraintType('flood_zone_3')).toBe('flood_zone_3')
    expect(normaliseConstraintType('green_belt')).toBe('green_belt')
  })

  it('maps EA Flood Map variants to the right zone token', () => {
    expect(normaliseConstraintType('Flood Zone 3')).toBe('flood_zone_3')
    expect(normaliseConstraintType('flood zone 2')).toBe('flood_zone_2')
    expect(normaliseConstraintType('FZ3')).toBe('flood_zone_3')
    expect(normaliseConstraintType('zone_2')).toBe('flood_zone_2')
    expect(normaliseConstraintType('3')).toBe('flood_zone_3')
    expect(normaliseConstraintType('2')).toBe('flood_zone_2')
  })

  it('maps green belt variants', () => {
    expect(normaliseConstraintType('Green Belt')).toBe('green_belt')
    expect(normaliseConstraintType('greenbelt')).toBe('green_belt')
    expect(normaliseConstraintType('GREEN-BELT')).toBe('green_belt')
  })

  it('returns null for the unmappable (unknown stays out, never guessed)', () => {
    expect(normaliseConstraintType(null)).toBeNull()
    expect(normaliseConstraintType('')).toBeNull()
    expect(normaliseConstraintType('   ')).toBeNull()
    expect(normaliseConstraintType('conservation_area')).toBeNull()
    expect(normaliseConstraintType('flood zone 1')).toBeNull() // FZ1 is "outside", not a constraint layer we load
  })
})

describe('constraintCategory', () => {
  it('groups flood + green belt + other', () => {
    expect(constraintCategory('flood_zone_3')).toBe('flood')
    expect(constraintCategory('flood_zone_2')).toBe('flood')
    expect(constraintCategory('green_belt')).toBe('green_belt')
    expect(constraintCategory('conservation_area')).toBe('other')
  })
})

describe('classifyOverlap — bands, with none as a real measured ~zero', () => {
  it('null or sub-epsilon → none (edge/point clip)', () => {
    expect(classifyOverlap(null)).toBe('none')
    expect(classifyOverlap(0)).toBe('none')
    expect(classifyOverlap(DEFAULT_OVERLAP_THRESHOLDS.zeroEpsilon)).toBe('none')
  })
  it('grades a positive overlap', () => {
    expect(classifyOverlap(0.05)).toBe('marginal')
    expect(classifyOverlap(0.3)).toBe('partial')
    expect(classifyOverlap(0.8)).toBe('majority')
    expect(classifyOverlap(0.99)).toBe('within')
    expect(classifyOverlap(1)).toBe('within')
  })
})

describe('screenSiteConstraints — tokens fed to the engine', () => {
  it('no rows → clear, no tokens, honest absence note (not a "no flood risk" claim)', () => {
    const s = screenSiteConstraints([])
    expect(s.clear).toBe(true)
    expect(s.constraints).toEqual([])
    expect(s.hasFloodZone3).toBe(false)
    expect(s.notes.join(' ')).toMatch(/not a claim of "no flood risk"/i)
  })

  it('a real overlap contributes its token; ordering puts flood_zone_3 first', () => {
    const s = screenSiteConstraints([
      row({ constraintType: 'green_belt', overlapFraction: 1 }),
      row({ constraintType: 'flood_zone_2', overlapFraction: 0.4 }),
      row({ constraintType: 'flood_zone_3', overlapFraction: 0.2 }),
    ])
    expect(s.constraints).toEqual(['flood_zone_3', 'flood_zone_2', 'green_belt'])
    expect(s.hasFloodZone3).toBe(true)
    expect(s.hasGreenBelt).toBe(true)
    expect(s.clear).toBe(false)
  })

  it('an edge/point clip (sub-epsilon) is NOT a constraint token but IS kept as a none-band detail', () => {
    const s = screenSiteConstraints([row({ constraintType: 'flood_zone_3', overlapFraction: 0.002 })])
    expect(s.constraints).toEqual([]) // near-miss, not an intersecting constraint
    expect(s.clear).toBe(true)
    expect(s.details).toHaveLength(1)
    expect(s.details[0].band).toBe('none')
    expect(s.details[0].note).toMatch(/near-miss/i)
  })

  it('flags the FZ3-within-FZ2 nesting when both present', () => {
    const s = screenSiteConstraints([
      row({ constraintType: 'flood_zone_2', overlapFraction: 0.6 }),
      row({ constraintType: 'flood_zone_3', overlapFraction: 0.5 }),
    ])
    expect(s.notes.join(' ')).toMatch(/Flood Zone 3 sits within Flood Zone 2/i)
  })

  it('de-duplicates a repeated type, keeping the largest overlap', () => {
    const s = screenSiteConstraints([
      row({ constraintType: 'green_belt', overlapFraction: 0.2 }),
      row({ constraintType: 'green_belt', overlapFraction: 0.9 }),
    ])
    expect(s.constraints).toEqual(['green_belt'])
    const gb = s.details.find((d) => d.constraintType === 'green_belt')!
    expect(gb.band).toBe('majority')
  })

  it('every screening carries the no-verdict hedge', () => {
    const s = screenSiteConstraints([row({ constraintType: 'flood_zone_3', overlapFraction: 0.5 })])
    expect(s.notes.join(' ')).toMatch(/never a suitability, developability or planning-permission verdict/i)
  })
})

describe('toSiteConstraintFeatures — the engine bridge', () => {
  it('produces exactly the screened token list', () => {
    const rows = [
      row({ constraintType: 'green_belt', overlapFraction: 0.8 }),
      row({ constraintType: 'flood_zone_3', overlapFraction: 0.3 }),
    ]
    expect(toSiteConstraintFeatures(rows).constraints).toEqual(['flood_zone_3', 'green_belt'])
  })

  it('drops near-miss clips so a marginal touch never fabricates a constraint', () => {
    expect(toSiteConstraintFeatures([row({ constraintType: 'flood_zone_2', overlapFraction: 0.001 })]).constraints).toEqual([])
  })
})
