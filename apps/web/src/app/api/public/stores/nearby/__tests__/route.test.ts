jest.mock('@/lib/supabase')
jest.mock('@/lib/stores-service')
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
const { createStoreService } = require('@/lib/stores-service')

const tableData: Record<string, any[]> = {}

const mockSupabase = {
  from: jest.fn((table: string) => ({
    select: () => ({
      in: async () => ({ data: tableData[table] || [] })
    })
  }))
}

const mockStoreService = {
  getStoresNearPoint: jest.fn()
}

const makeRequest = () => ({
  url: 'http://localhost/api/public/stores/nearby?lat=51.5&lon=-0.12&radius=5000'
})

describe('/api/public/stores/nearby enrichment', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createServerClient as jest.Mock).mockResolvedValue(mockSupabase)
    ;(createStoreService as jest.Mock).mockResolvedValue(mockStoreService)

    tableData.fascias = [
      { id: 'fascia-1', name: 'Boots Pharmacy' },
      { id: 'fascia-2', name: 'Local Shop' }
    ]
    tableData.brands = [
      { id: 'brand-1', name: 'Boots', domain: 'boots.com', logo_url: 'https://cdn/boots.png' },
      { id: 'brand-2', name: 'Greggs', domain: null, logo_url: 'https://cdn/greggs.png' },
      { id: 'brand-3', name: 'Local', domain: null, logo_url: null }
    ]

    mockStoreService.getStoresNearPoint.mockResolvedValue([
      { id: 'store-1', name: 'Boots Oxford St', brand_id: 'brand-1', fascia_id: 'fascia-1', lat: 51.5, lon: -0.12 },
      { id: 'store-2', name: 'Greggs Soho', brand_id: 'brand-2', fascia_id: 'fascia-1', lat: 51.51, lon: -0.13 },
      { id: 'store-3', name: 'Corner Store', brand_id: 'brand-3', fascia_id: 'fascia-2', lat: 51.52, lon: -0.14 }
    ])
  })

  it('enriches stores with brand_name, logo_domain and logo_url from the joined brand', async () => {
    const response = await GET(makeRequest() as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    const byId = Object.fromEntries(data.stores.map((s: any) => [s.id, s]))
    expect(byId['store-1']).toMatchObject({
      brand_name: 'Boots',
      logo_domain: 'boots.com',
      logo_url: 'https://cdn/boots.png'
    })
  })

  it('falls back to logo_url when the brand has no domain', async () => {
    const response = await GET(makeRequest() as any)
    const data = await response.json()

    const store = data.stores.find((s: any) => s.id === 'store-2')
    expect(store.logo_domain).toBeNull()
    expect(store.logo_url).toBe('https://cdn/greggs.png')
    expect(store.brand_name).toBe('Greggs')
  })

  it('returns null domain and logo_url when the brand has neither (initial-badge fallback)', async () => {
    const response = await GET(makeRequest() as any)
    const data = await response.json()

    const store = data.stores.find((s: any) => s.id === 'store-3')
    expect(store.logo_domain).toBeNull()
    expect(store.logo_url).toBeNull()
    expect(store.brand_name).toBe('Local')
  })
})

export {}
