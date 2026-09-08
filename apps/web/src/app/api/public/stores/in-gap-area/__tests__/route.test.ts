jest.mock('@/lib/stores-service')
jest.mock('@/lib/store-enrichment')
jest.mock('@/lib/gapfinder-access', () => ({
  requireGapFinderAccess: jest.fn().mockResolvedValue({ authorized: true }),
}))
jest.mock('@/lib/feature-flags', () => ({
  isRetailCentreGapsEnabled: jest.fn().mockResolvedValue(true),
}))
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status || 200,
      json: async () => body,
    }),
  },
}))

const { GET } = require('../route')
const { createStoreService } = require('@/lib/stores-service')
const { enrichStores } = require('@/lib/store-enrichment')

const rawStores = [
  {
    id: 'store-1',
    name: 'Boots High Street',
    brand_id: 'brand-1',
    fascia_id: 'fascia-1',
    lat: 51.5,
    lon: -0.12,
  },
]

const enrichedStores = [
  {
    ...rawStores[0],
    brand_name: 'Boots',
    logo_domain: 'boots.com',
    logo_url: 'https://cdn.example.com/boots.png',
  },
]

const mockStoreService = {
  getStoresInBua: jest.fn(),
  getStoresInRetailCentre: jest.fn(),
}

function makeRequest(geography = 'town', areaId = 'E63000001') {
  return {
    nextUrl: {
      searchParams: new URLSearchParams({ geography, areaId }),
    },
  }
}

describe('/api/public/stores/in-gap-area', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createStoreService as jest.Mock).mockResolvedValue(mockStoreService)
    mockStoreService.getStoresInBua.mockResolvedValue(rawStores)
    ;(enrichStores as jest.Mock).mockResolvedValue(enrichedStores)
  })

  it('enriches selected-area stores with the logo fields used by map badges', async () => {
    const response = await GET(makeRequest() as any)
    const data = await response.json()

    expect(mockStoreService.getStoresInBua).toHaveBeenCalledWith('E63000001')
    expect(enrichStores).toHaveBeenCalledWith(rawStores)
    expect(data.stores).toEqual(enrichedStores)
  })
})

export {}
