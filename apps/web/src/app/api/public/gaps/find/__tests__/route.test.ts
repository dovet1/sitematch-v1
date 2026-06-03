jest.mock('@/lib/supabase')
jest.mock('@/lib/subscription')
jest.mock('@/lib/stores-service')
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status || 200,
      json: async () => body
    })
  }
}))

const { POST } = require('../route')
const { createServerClient } = require('@/lib/supabase')
const { checkSubscriptionAccess } = require('@/lib/subscription')
const { createStoreService } = require('@/lib/stores-service')

const mockSupabase = {
  auth: {
    getUser: jest.fn()
  }
}

const mockStoreService = {
  findGaps: jest.fn()
}

describe('/api/public/gaps/find', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(createServerClient as jest.Mock).mockResolvedValue(mockSupabase)
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    ;(checkSubscriptionAccess as jest.Mock).mockResolvedValue(true)
    ;(createStoreService as jest.Mock).mockResolvedValue(mockStoreService)
    mockStoreService.findGaps.mockResolvedValue({
      results: [{ gsscode: 'E34000001', name: 'Example BUA' }],
      total: 1
    })
  })

  const makeRequest = () => ({
    json: async () => ({
      minPop: 5001,
      maxPop: 1200000,
      filterSet: { rules: [] }
    })
  })

  it('rejects unauthenticated users', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

    const response = await POST(makeRequest() as any)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Authentication required')
    expect(checkSubscriptionAccess).not.toHaveBeenCalled()
    expect(createStoreService).not.toHaveBeenCalled()
  })

  it('rejects authenticated users without subscription access', async () => {
    ;(checkSubscriptionAccess as jest.Mock).mockResolvedValue(false)

    const response = await POST(makeRequest() as any)
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toBe('Subscription required')
    expect(checkSubscriptionAccess).toHaveBeenCalledWith('user-1')
    expect(createStoreService).not.toHaveBeenCalled()
  })

  it('allows trialing users with subscription access', async () => {
    const response = await POST(makeRequest() as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(checkSubscriptionAccess).toHaveBeenCalledWith('user-1')
    expect(data).toEqual({
      results: [{ gsscode: 'E34000001', name: 'Example BUA' }],
      total: 1,
      showing: 1
    })
  })

  it('allows active paid users with subscription access', async () => {
    const response = await POST(makeRequest() as any)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(checkSubscriptionAccess).toHaveBeenCalledWith('user-1')
    expect(data.total).toBe(1)
  })
})

export {}
