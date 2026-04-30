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
      place_name: 'Manchester',
      formatted_address: 'Manchester, UK'
    }
  }
]

describe('/api/public/gapfinder/requirement-locations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createServerClient as jest.Mock).mockResolvedValue(mockSupabase)
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    ;(checkSubscriptionAccess as jest.Mock).mockResolvedValue(true)
    ;(getRequirementMapFeatures as jest.Mock).mockResolvedValue(mockFeatures)
  })

  it('uses the shared requirement map data source with subscription access', async () => {
    const request = { url: 'http://localhost/api/public/gapfinder/requirement-locations?minLat=49&minLon=-8&maxLat=59&maxLon=2&limit=1' } as any
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(getRequirementMapFeatures).toHaveBeenCalledWith(mockSupabase, {
      isFreeTier: false
    })
    expect(data.total).toBe(2)
    expect(data.results).toEqual([
      {
        id: 'location-1',
        listingId: 'listing-1',
        companyName: 'Alpha Retail',
        title: 'Alpha Requirement',
        listingType: 'commercial',
        placeName: 'London',
        formattedAddress: 'London, UK',
        coordinates: { lng: -0.1278, lat: 51.5074 }
      },
      {
        id: 'location-2',
        listingId: 'listing-2',
        companyName: 'Beta Homes',
        title: 'Beta Requirement',
        listingType: 'residential',
        placeName: 'Manchester',
        formattedAddress: 'Manchester, UK',
        coordinates: { lng: -2.2426, lat: 53.4808 }
      }
    ])
    expect(data.debug).toEqual({
      totalBeforeFilter: 2,
      totalAfterFilter: 2,
      sampleLocationIds: ['location-1', 'location-2'],
      isFreeTier: false
    })
  })

  it('applies free-tier filtering through the shared source for unauthenticated users', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

    const request = { url: 'http://localhost/api/public/gapfinder/requirement-locations?minLat=49&minLon=-8&maxLat=59&maxLon=2' } as any
    await GET(request)

    expect(checkSubscriptionAccess).not.toHaveBeenCalled()
    expect(getRequirementMapFeatures).toHaveBeenCalledWith(mockSupabase, {
      isFreeTier: true
    })
  })

  it('filters by single listing ID', async () => {
    const request = { url: 'http://localhost/api/public/gapfinder/requirement-locations?minLat=49&minLon=-8&maxLat=59&maxLon=2&listingIds=listing-2' } as any
    const response = await GET(request)
    const data = await response.json()

    expect(data.total).toBe(1)
    expect(data.results[0].listingId).toBe('listing-2')
    expect(data.results[0].companyName).toBe('Beta Homes')
    expect(data.debug.totalBeforeFilter).toBe(2)
    expect(data.debug.totalAfterFilter).toBe(1)
    expect(data.debug.sampleLocationIds).toEqual(['location-2'])
    expect(data.debug.isFreeTier).toBe(false)
    expect(data.debug.requestedListingIds).toEqual(['listing-2'])
    expect(data.debug.matchedListingIds).toEqual(['listing-2'])
  })

  it('filters by multiple listing IDs', async () => {
    const request = { url: 'http://localhost/api/public/gapfinder/requirement-locations?minLat=49&minLon=-8&maxLat=59&maxLon=2&listingIds=listing-1,listing-2' } as any
    const response = await GET(request)
    const data = await response.json()

    expect(data.total).toBe(2)
    expect(data.results[0].listingId).toBe('listing-1')
    expect(data.results[1].listingId).toBe('listing-2')
    expect(data.debug.totalBeforeFilter).toBe(2)
    expect(data.debug.totalAfterFilter).toBe(2)
    expect(data.debug.isFreeTier).toBe(false)
    expect(data.debug.requestedListingIds).toEqual(['listing-1', 'listing-2'])
    expect(data.debug.matchedListingIds).toEqual(['listing-1', 'listing-2'])
  })

  it('handles listing IDs with whitespace trimming', async () => {
    const request = { url: 'http://localhost/api/public/gapfinder/requirement-locations?minLat=49&minLon=-8&maxLat=59&maxLon=2&listingIds=%20listing-1%20,%20listing-2%20' } as any
    const response = await GET(request)
    const data = await response.json()

    expect(data.total).toBe(2)
    expect(data.debug.requestedListingIds).toEqual(['listing-1', 'listing-2'])
  })

  it('returns no results for non-existent listing IDs', async () => {
    const request = { url: 'http://localhost/api/public/gapfinder/requirement-locations?minLat=49&minLon=-8&maxLat=59&maxLon=2&listingIds=non-existent-id' } as any
    const response = await GET(request)
    const data = await response.json()

    expect(data.total).toBe(0)
    expect(data.debug.totalBeforeFilter).toBe(2)
    expect(data.debug.totalAfterFilter).toBe(0)
    expect(data.debug.requestedListingIds).toEqual(['non-existent-id'])
    expect(data.debug.matchedListingIds).toEqual([])
  })

  it('rejects requests without viewport parameters', async () => {
    const request = { url: 'http://localhost/api/public/gapfinder/requirement-locations' } as any
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('Missing required viewport coordinates')
    expect(getRequirementMapFeatures).not.toHaveBeenCalled()
  })
})

export {}
