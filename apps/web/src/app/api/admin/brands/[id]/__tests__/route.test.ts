jest.mock('@/lib/auth')
jest.mock('@/lib/brand-estate')
jest.mock('@supabase/supabase-js')
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status || 200,
      json: async () => body
    })
  }
}))

const { PATCH } = require('../route')
const { getCurrentUser } = require('@/lib/auth')
const { createClient } = require('@supabase/supabase-js')

let capturedUpdate: any = null

const single = jest.fn(async () => ({ data: { id: 'b1', ...capturedUpdate }, error: null }))
const select = jest.fn(() => ({ single }))
const eq = jest.fn(() => ({ select }))
const update = jest.fn((payload: any) => {
  capturedUpdate = payload
  return { eq }
})
const mockClient = { from: jest.fn(() => ({ update })) }

const makeRequest = (body: unknown) => ({ json: async () => body })
const params = Promise.resolve({ id: 'b1' })

describe('PATCH /api/admin/brands/[id] domain normalization', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    capturedUpdate = null
    ;(getCurrentUser as jest.Mock).mockResolvedValue({ id: 'u1', role: 'admin' })
    ;(createClient as jest.Mock).mockReturnValue(mockClient)
  })

  it('normalizes a full URL down to a bare domain before storing', async () => {
    const response = await PATCH(
      makeRequest({ domain: 'https://www.boots.com/stores/123' }) as any,
      { params } as any
    )

    expect(response.status).toBe(200)
    expect(capturedUpdate.domain).toBe('boots.com')
  })

  it('rejects an invalid domain with 400 and does not update', async () => {
    const response = await PATCH(
      makeRequest({ domain: 'not a domain!!' }) as any,
      { params } as any
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid domain')
    expect(update).not.toHaveBeenCalled()
  })

  it('stores null when the domain is cleared', async () => {
    const response = await PATCH(
      makeRequest({ domain: '' }) as any,
      { params } as any
    )

    expect(response.status).toBe(200)
    expect(capturedUpdate.domain).toBeNull()
  })
})

export {}
