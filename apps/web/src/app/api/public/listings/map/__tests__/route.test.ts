jest.mock('@/lib/supabase')
jest.mock('@/lib/subscription')
jest.mock('@/lib/requirement-map-data')
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status || 200,
      json: async () => body
    })
  }
}))

const { GET } = require('../route')
const { createServerClient } = require('@/lib/supabase')
const { checkSubscriptionAccess } = require('@/lib/subscription')
const { getRequirementMapFeatures } = require('@/lib/requirement-map-data')

const mockSupabase = {
  auth: {
    getUser: jest.fn()
  }
}

const mockFeatures = [
  {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [-0.1278, 51.5074]
    },
    properties: {
      id: 'listing-1',
      location_id: 'location-1',
      company_name: 'Alpha Retail',
      title: 'Alpha Requirement',
      listing_type: 'commercial',
      clearbit_logo: null,
      company_domain: null,
      logo_url: null,
      sector: null,
      use_class: null,
      site_size_min: null,
      site_size_max: null,
      site_acreage_min: null,
      site_acreage_max: null,
      dwelling_count_min: null,
      dwelling_count_max: null,
      place_name: 'London',
      formatted_address: 'London, UK'
    }
  },
  {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [-2.2426, 53.4808]
    },
    properties: {
      id: 'listing-2',
      location_id: 'location-2',
      company_name: 'Beta Homes',
      title: 'Beta Requirement',
      listing_type: 'residential',
      clearbit_logo: null,
      company_domain: null,
      logo_url: null,
      sector: null,
      use_class: null,
      site_size_min: null,
      site_size_max: null,
      site_acreage_min: null,
      site_acreage_max: null,
      dwelling_count_min: null,
      dwelling_count_max: null,
      place_name: 'Manchester',
      formatted_address: 'Manchester, UK'
    }
  }
]

describe('/api/public/listings/map', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createServerClient as jest.Mock).mockResolvedValue(mockSupabase)
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    ;(checkSubscriptionAccess as jest.Mock).mockResolvedValue(true)
    ;(getRequirementMapFeatures as jest.Mock).mockResolvedValue(mockFeatures)
  })

  it('exposes debug metadata from the shared requirement map source', async () => {
    const request = { nextUrl: new URL('http://localhost/api/public/listings/map?north=59&south=49&east=2&west=-8') } as any
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.total).toBe(2)
    expect(data.geojson.features).toEqual(mockFeatures)
    expect(data.metadata.debug).toEqual({
      totalFeatures: 2,
      sampleLocationIds: ['location-1', 'location-2'],
      isFreeTier: false
    })
  })
})

export {}
