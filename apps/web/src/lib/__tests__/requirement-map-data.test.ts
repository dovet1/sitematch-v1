import {
  getRequirementMapFeatures,
  getRequirementMapFeaturesFromRequirements,
  normalizeRequirementCoordinates,
} from '@/lib/requirement-map-data'

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

describe('getRequirementMapFeaturesFromRequirements', () => {
  const OLD_TOKEN = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN

  beforeAll(() => {
    process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN = 'test-token'
  })
  afterAll(() => {
    process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN = OLD_TOKEN
  })

  function createQueryMock(result: unknown) {
    const query: any = {
      select: jest.fn(() => query),
      in: jest.fn(() => query),
      range: jest.fn(() => query),
      eq: jest.fn(() => query),
      ilike: jest.fn(() => query),
      or: jest.fn(() => query),
      gte: jest.fn(() => query),
      lte: jest.fn(() => query),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve(result)),
    }
    return query
  }

  function requirementRow(overrides: Record<string, unknown>) {
    return {
      id: 'req-1',
      brand_id: null,
      company_name: 'Acme',
      title: null,
      listing_type: 'commercial',
      company_domain: null,
      clearbit_logo: false,
      logo_url: null,
      site_size_min: null,
      site_size_max: null,
      site_acreage_min: null,
      site_acreage_max: null,
      dwelling_count_min: null,
      dwelling_count_max: null,
      is_featured_free: true,
      requirement_sectors: [],
      requirement_use_classes: [],
      requirement_locations: [
        { id: 'loc-1', place_name: null, formatted_address: null, coordinates: [-0.12, 51.5] },
      ],
      ...overrides,
    }
  }

  function supabaseWith(rows: unknown[]) {
    const query = createQueryMock({ data: rows, error: null })
    return { from: jest.fn(() => query) }
  }

  it('emits uploaded_logo_url from the raw uploaded logo_url', async () => {
    const supabase = supabaseWith([
      requirementRow({ company_domain: 'acme.com', logo_url: 'https://cdn/acme.png' }),
    ])
    const [feature] = await getRequirementMapFeaturesFromRequirements(supabase, {
      isFreeTier: false,
    })
    expect(feature.properties.uploaded_logo_url).toBe('https://cdn/acme.png')
    expect(feature.properties.company_domain).toBe('acme.com')
    // Existing resolved logo_url is still emitted for existing consumers.
    expect(feature.properties.logo_url).toBe('https://cdn/acme.png')
  })

  it('keeps resolved logo_url as logo.dev while uploaded_logo_url stays null', async () => {
    const supabase = supabaseWith([
      requirementRow({ company_domain: 'acme.com', clearbit_logo: true, logo_url: null }),
    ])
    const [feature] = await getRequirementMapFeaturesFromRequirements(supabase, {
      isFreeTier: false,
    })
    // No uploaded logo → raw field is null...
    expect(feature.properties.uploaded_logo_url).toBeNull()
    // ...but the existing resolved field still serves consumers via logo.dev.
    expect(feature.properties.logo_url).toContain('img.logo.dev/acme.com')
  })
})
