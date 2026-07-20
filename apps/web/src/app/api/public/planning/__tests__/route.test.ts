jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status || 200,
      json: async () => body,
    }),
  },
}))

const { POST } = require('../route')
const { __clearCaches } = require('../planit')

const fetchMock = jest.fn()

function makeRequest(body: unknown) {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  return { text: async () => text }
}

function rect(minLon: number, minLat: number, maxLon: number, maxLat: number) {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [minLon, minLat],
        [maxLon, minLat],
        [maxLon, maxLat],
        [minLon, maxLat],
        [minLon, minLat],
      ],
    ],
  }
}

beforeEach(() => {
  fetchMock.mockReset()
  __clearCaches()
  global.fetch = fetchMock as unknown as typeof fetch
})

describe('POST /api/public/planning validation (fails closed, no upstream fetch)', () => {
  const cases: [string, unknown][] = [
    ['a LineString', { boundary: { type: 'LineString', coordinates: [[0, 51], [1, 51]] } }],
    ['a missing boundary', {}],
    ['out-of-UK coordinates', { boundary: rect(10, 53, 10.1, 53.1) }],
    ['an oversized area', { boundary: rect(-8, 50, 2, 60) }],
  ]
  it.each(cases)('rejects %s with 400 before any fetch', async (_label, body) => {
    const res = await POST(makeRequest(body) as any)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBeTruthy()
    expect(data.applications).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects too many vertices with 400 before any fetch', async () => {
    const ring: [number, number][] = []
    for (let i = 0; i <= 50_001; i++) {
      ring.push([-1.5 + 0.000001 * i, 53.0])
    }
    ring.push(ring[0])
    const res = await POST(
      makeRequest({ boundary: { type: 'Polygon', coordinates: [ring] } }) as any
    )
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects an oversized body with 400 before any fetch', async () => {
    const res = await POST(makeRequest('x'.repeat(1_000_001)) as any)
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects malformed JSON with 400', async () => {
    const res = await POST(makeRequest('{not json') as any)
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('POST /api/public/planning responses', () => {
  const SMALL = rect(-1.6, 53.0, -1.55, 53.04)

  it('returns applications with no retryAfter on success', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        total: 1,
        records: [
          {
            name: 'Leeds/26/1/FU',
            uid: '26/1/FU',
            address: '1 High St',
            app_size: 'Large',
            app_state: 'Permitted',
            app_type: 'Full',
            description: 'A scheme.',
            url: 'https://example.org/app',
            location_x: -1.57,
            location_y: 53.02,
            other_fields: {},
          },
        ],
      }),
    })
    const res = await POST(makeRequest({ boundary: SMALL }) as any)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.applications).toHaveLength(1)
    expect(data.truncated).toBe(false)
    expect(data).not.toHaveProperty('retryAfter')
  })

  it('returns 503 with a generic message (no retryAfter) on a first-request 429', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429, json: async () => ({}) })
    const res = await POST(makeRequest({ boundary: SMALL }) as any)
    expect(res.status).toBe(503)
    const data = await res.json()
    expect(data.error).toMatch(/rate-limited/)
    expect(data).not.toHaveProperty('retryAfter')
  })
})

export {}
