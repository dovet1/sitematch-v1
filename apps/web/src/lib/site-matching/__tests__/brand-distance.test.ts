import {
  classifyBrandDistance,
  toBrandDistanceFeatures,
  describeBrandDistance,
  DEFAULT_BRAND_DISTANCE_THRESHOLDS,
  METRES_PER_MILE,
  type BrandEstateRaw,
} from '../brand-distance'

function raw(overrides: Partial<BrandEstateRaw> = {}): BrandEstateRaw {
  return { nearestDistanceM: null, brandStoreCount: 0, ...overrides }
}

describe('classifyBrandDistance — no estate is satisfied, never unknown', () => {
  it('brand with zero stores → no_estate, brandHasStores false, distance null', () => {
    const s = classifyBrandDistance(raw({ brandStoreCount: 0, nearestDistanceM: null }))
    expect(s.band).toBe('no_estate')
    expect(s.brandHasStores).toBe(false)
    expect(s.nearestDistanceM).toBeNull()
  })

  it('a negative/garbage count is treated as no estate (defensive)', () => {
    expect(classifyBrandDistance(raw({ brandStoreCount: -1 })).band).toBe('no_estate')
  })

  it('there is no `unknown` band — a brand either has an estate or it does not', () => {
    const bands = [
      classifyBrandDistance(raw({ brandStoreCount: 0 })).band,
      classifyBrandDistance(raw({ brandStoreCount: 3, nearestDistanceM: 100 })).band,
    ]
    expect(bands).not.toContain('unknown')
  })
})

describe('classifyBrandDistance — distance bands (brand has an estate)', () => {
  const t = DEFAULT_BRAND_DISTANCE_THRESHOLDS

  it('at/below atMax → at', () => {
    expect(classifyBrandDistance(raw({ brandStoreCount: 5, nearestDistanceM: 250 })).band).toBe('at')
    expect(classifyBrandDistance(raw({ brandStoreCount: 5, nearestDistanceM: t.atMaxM })).band).toBe('at')
  })

  it('above atMax, at/below nearMax → near', () => {
    expect(classifyBrandDistance(raw({ brandStoreCount: 5, nearestDistanceM: t.atMaxM + 1 })).band).toBe('near')
    expect(classifyBrandDistance(raw({ brandStoreCount: 5, nearestDistanceM: t.nearMaxM })).band).toBe('near')
  })

  it('above nearMax, at/below moderateMax → moderate', () => {
    expect(classifyBrandDistance(raw({ brandStoreCount: 5, nearestDistanceM: t.nearMaxM + 1 })).band).toBe('moderate')
    expect(classifyBrandDistance(raw({ brandStoreCount: 5, nearestDistanceM: t.moderateMaxM })).band).toBe('moderate')
  })

  it('above moderateMax → clear', () => {
    expect(classifyBrandDistance(raw({ brandStoreCount: 5, nearestDistanceM: t.moderateMaxM + 1 })).band).toBe('clear')
    expect(classifyBrandDistance(raw({ brandStoreCount: 5, nearestDistanceM: 50_000 })).band).toBe('clear')
  })

  it('brand HAS stores but none within the search cap (null distance) → clear, still hasStores', () => {
    const s = classifyBrandDistance(raw({ brandStoreCount: 5, nearestDistanceM: null }))
    expect(s.band).toBe('clear')
    expect(s.brandHasStores).toBe(true)
    expect(s.nearestDistanceM).toBeNull()
  })

  it('honours custom thresholds', () => {
    const tight = { atMaxM: 100, nearMaxM: 200, moderateMaxM: 300 }
    expect(classifyBrandDistance(raw({ brandStoreCount: 1, nearestDistanceM: 250 }), tight).band).toBe('moderate')
    expect(classifyBrandDistance(raw({ brandStoreCount: 1, nearestDistanceM: 250 })).band).toBe('at') // default 400 m
  })
})

describe('toBrandDistanceFeatures — engine wiring (satisfied vs real distance)', () => {
  it('no estate → distance null + brandHasStores false (criterion reads this as satisfied, NOT unknown)', () => {
    expect(toBrandDistanceFeatures(raw({ brandStoreCount: 0, nearestDistanceM: null }))).toEqual({
      sameBrandDistanceM: null,
      brandHasStores: false,
    })
  })

  it('estate present → the real nearest distance flows through unchanged', () => {
    expect(toBrandDistanceFeatures(raw({ brandStoreCount: 12, nearestDistanceM: 843.2 }))).toEqual({
      sameBrandDistanceM: 843.2,
      brandHasStores: true,
    })
  })

  it('estate present but capped-out (null distance) → hasStores true, distance null (criterion still satisfied)', () => {
    expect(toBrandDistanceFeatures(raw({ brandStoreCount: 12, nearestDistanceM: null }))).toEqual({
      sameBrandDistanceM: null,
      brandHasStores: true,
    })
  })

  it('never coerces a null distance to zero', () => {
    expect(toBrandDistanceFeatures(raw({ brandStoreCount: 3, nearestDistanceM: null })).sameBrandDistanceM).not.toBe(0)
  })
})

describe('describeBrandDistance — hedged notes, never a suitability claim', () => {
  it('no estate reads as satisfied', () => {
    const note = describeBrandDistance(classifyBrandDistance(raw({ brandStoreCount: 0 })))
    expect(note.toLowerCase()).toContain('nothing to cannibalise')
  })

  it('clear-at-distance note reports the distance in miles and says "clear"', () => {
    const note = describeBrandDistance(classifyBrandDistance(raw({ brandStoreCount: 2, nearestDistanceM: 5 * METRES_PER_MILE })))
    expect(note.toLowerCase()).toContain('clear of the existing estate')
    expect(note).toContain('5.00 mi')
  })

  it('never asserts suitability', () => {
    const notes = [
      describeBrandDistance(classifyBrandDistance(raw({ brandStoreCount: 2, nearestDistanceM: 100 }))),
      describeBrandDistance(classifyBrandDistance(raw({ brandStoreCount: 2, nearestDistanceM: 20_000 }))),
    ]
    for (const n of notes) expect(n.toLowerCase()).not.toContain('suitable')
  })
})
