import { getRequirementMapFeatures, normalizeRequirementCoordinates } from '@/lib/requirement-map-data'

describe('normalizeRequirementCoordinates', () => {
  it('accepts GeoJSON-style coordinate arrays', () => {
    expect(normalizeRequirementCoordinates([-0.1278, 51.5074])).toEqual({
      lng: -0.1278,
      lat: 51.5074
    })
  })

  it('accepts lat/lng coordinate objects', () => {
    expect(normalizeRequirementCoordinates({ lat: 53.4808, lng: -2.2426 })).toEqual({
      lat: 53.4808,
      lng: -2.2426
    })
  })

  it('accepts stringified GeoJSON-style coordinate arrays', () => {
    expect(normalizeRequirementCoordinates('[-1.8904,52.4862]')).toEqual({
      lng: -1.8904,
      lat: 52.4862
    })
  })

  it('rejects null and malformed coordinates', () => {
    expect(normalizeRequirementCoordinates(null)).toBeNull()
    expect(normalizeRequirementCoordinates('[1]')).toBeNull()
    expect(normalizeRequirementCoordinates({ latitude: 51.5, longitude: -0.1 })).toBeNull()
    expect(normalizeRequirementCoordinates('not json')).toBeNull()
  })

  it('rejects out-of-range coordinates', () => {
    expect(normalizeRequirementCoordinates([-0.1278, 91])).toBeNull()
    expect(normalizeRequirementCoordinates([-181, 51.5074])).toBeNull()
  })
})

describe('getRequirementMapFeatures', () => {
  function createQueryMock(result: unknown) {
    const query: any = {
      select: jest.fn(() => query),
      in: jest.fn(() => query),
      range: jest.fn(() => query),
      eq: jest.fn(() => query),
      ilike: jest.fn(() => query),
      or: jest.fn(() => query),
      neq: jest.fn(() => query),
      not: jest.fn(() => query),
      gte: jest.fn(() => query),
      lte: jest.fn(() => query),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve(result))
    }

    return query
  }

  it('uses directory-map listing eligibility for statuses and free-tier access', async () => {
    const listingsQuery = createQueryMock({ data: [], error: null })
    const fileUploadsQuery = createQueryMock({ data: [], error: null })
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === 'listings') {
          return listingsQuery
        }
        if (table === 'file_uploads') {
          return fileUploadsQuery
        }
        throw new Error(`Unexpected table: ${table}`)
      })
    }

    await getRequirementMapFeatures(supabase, { isFreeTier: true })

    expect(supabase.from).toHaveBeenCalledWith('listings')
    expect(listingsQuery.in).toHaveBeenCalledWith('status', ['approved', 'pending', 'draft'])
    expect(listingsQuery.eq).toHaveBeenCalledWith('is_featured_free', true)
  })
})
