import { filterGapStorePins } from '../store-pin-filter'
import type { NearbyStore } from '../services/gaps-service'

function store(
  overrides: Partial<NearbyStore> & { brand_id: string; fascia_id: string }
): NearbyStore {
  return {
    id: `store-${Math.random()}`,
    name: 'Store',
    brand_name: null,
    fascia_name: null,
    logo_domain: null,
    logo_url: null,
    lat: 51.5,
    lon: -0.12,
    town: null,
    postcode: null,
    ...overrides,
  }
}

// brand A has two fascias (a1 -> food, a2 -> fashion); brand B has one (b1 -> food).
const fasciaCategoryIds = new Map<string, string[]>([
  ['a1', ['food']],
  ['a2', ['fashion']],
  ['b1', ['food']],
])

const pins: NearbyStore[] = [
  store({ id: 's1', brand_id: 'A', fascia_id: 'a1' }),
  store({ id: 's2', brand_id: 'A', fascia_id: 'a2' }),
  store({ id: 's3', brand_id: 'B', fascia_id: 'b1' }),
]

const ids = (result: NearbyStore[]) => result.map((s) => s.id).sort()

describe('filterGapStorePins', () => {
  it('returns the same array reference when no filters are active', () => {
    const result = filterGapStorePins(pins, new Set(), new Set(), fasciaCategoryIds)
    expect(result).toBe(pins)
  })

  it('keeps only stores whose brand_id is selected', () => {
    const result = filterGapStorePins(
      pins,
      new Set(),
      new Set(['A']),
      fasciaCategoryIds
    )
    expect(ids(result)).toEqual(['s1', 's2'])
  })

  it('keeps only stores whose fascia maps into a selected category', () => {
    const result = filterGapStorePins(
      pins,
      new Set(['food']),
      new Set(),
      fasciaCategoryIds
    )
    expect(ids(result)).toEqual(['s1', 's3'])
  })

  it('filters a multi-fascia brand to only its matching-fascia pins', () => {
    const result = filterGapStorePins(
      pins,
      new Set(['fashion']),
      new Set(),
      fasciaCategoryIds
    )
    expect(ids(result)).toEqual(['s2'])
  })

  it('requires both brand and category to pass when both are set', () => {
    const result = filterGapStorePins(
      pins,
      new Set(['food']),
      new Set(['A']),
      fasciaCategoryIds
    )
    // brand A + food category -> only s1 (a1). s2 is fashion, s3 is brand B.
    expect(ids(result)).toEqual(['s1'])
  })

  it('drops stores whose fascia has no category mapping under a category filter', () => {
    const orphan = store({ id: 's4', brand_id: 'C', fascia_id: 'unknown' })
    const result = filterGapStorePins(
      [...pins, orphan],
      new Set(['food']),
      new Set(),
      fasciaCategoryIds
    )
    expect(ids(result)).toEqual(['s1', 's3'])
  })
})
