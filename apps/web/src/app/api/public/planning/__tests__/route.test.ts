// jsdom lacks the web streaming primitives the route uses; Node provides them
// and the Next.js runtime has them natively, so this only closes a test-env gap.
import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'util'
import { ReadableStream as NodeReadableStream } from 'stream/web'

if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = NodeTextEncoder as unknown as typeof globalThis.TextEncoder
}
if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = NodeTextDecoder as unknown as typeof globalThis.TextDecoder
}
if (typeof globalThis.ReadableStream === 'undefined') {
  globalThis.ReadableStream =
    NodeReadableStream as unknown as typeof globalThis.ReadableStream
}
// Minimal stand-in for the streaming Response the route returns. Only the
// pieces the route sets and the tests read are modelled.
if (typeof globalThis.Response === 'undefined') {
  globalThis.Response = class {
    body: unknown
    status = 200
    headers: { get: (k: string) => string | null }
    constructor(body: unknown, init?: { headers?: Record<string, string> }) {
      this.body = body
      const headers = init?.headers ?? {}
      const lower = Object.fromEntries(
        Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
      )
      this.headers = { get: (k: string) => lower[k.toLowerCase()] ?? null }
    }
  } as unknown as typeof globalThis.Response
}

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status || 200,
      json: async () => body,
    }),
  },
}))

const fetchStored = jest.fn()
jest.mock('../stored', () => ({
  fetchStoredPlanningApplications: (...args: unknown[]) => fetchStored(...args),
}))

const { POST } = require('../route')

function makeRequest(body: unknown) {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  return { text: async () => text }
}

// The route answers in NDJSON, so responses are read line by line rather than
// with res.json(). Returns every emitted message in order.
async function readStream(res: Response): Promise<Record<string, unknown>[]> {
  const reader = (res.body as ReadableStream<Uint8Array>).getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
  }
  return buffer
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l))
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
  fetchStored.mockReset()
})

describe('POST /api/public/planning validation (fails closed, no database read)', () => {
  const cases: [string, unknown][] = [
    ['a LineString', { boundary: { type: 'LineString', coordinates: [[0, 51], [1, 51]] } }],
    ['a missing boundary', {}],
    ['out-of-UK coordinates', { boundary: rect(10, 53, 10.1, 53.1) }],
    ['an oversized area', { boundary: rect(-8, 50, 2, 60) }],
  ]
  it.each(cases)('rejects %s with 400 before any read', async (_label, body) => {
    const res = await POST(makeRequest(body) as any)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBeTruthy()
    expect(data.applications).toEqual([])
    expect(fetchStored).not.toHaveBeenCalled()
  })

  it('rejects too many vertices with 400 before any read', async () => {
    const ring: [number, number][] = []
    for (let i = 0; i <= 50_001; i++) {
      ring.push([-1.5 + 0.000001 * i, 53.0])
    }
    ring.push(ring[0])
    const res = await POST(
      makeRequest({ boundary: { type: 'Polygon', coordinates: [ring] } }) as any
    )
    expect(res.status).toBe(400)
    expect(fetchStored).not.toHaveBeenCalled()
  })

  it('rejects an oversized body with 400 before any read', async () => {
    const res = await POST(makeRequest('x'.repeat(1_000_001)) as any)
    expect(res.status).toBe(400)
    expect(fetchStored).not.toHaveBeenCalled()
  })

  it('rejects malformed JSON with 400', async () => {
    const res = await POST(makeRequest('{not json') as any)
    expect(res.status).toBe(400)
    expect(fetchStored).not.toHaveBeenCalled()
  })
})

describe('POST /api/public/planning responses', () => {
  const SMALL = rect(-1.6, 53.0, -1.55, 53.04)

  it('answers from the stored census with a single result line', async () => {
    const freshness = { stale: false, staleReason: null }
    fetchStored.mockResolvedValue({
      applications: [{ name: 'Leeds/26/1/FU' }],
      total: 1,
      truncated: false,
      truncationReason: null,
      freshness,
    })
    const res = await POST(makeRequest({ boundary: SMALL }) as any)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toMatch(/x-ndjson/)
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(fetchStored).toHaveBeenCalledWith(SMALL)

    const lines = await readStream(res)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({
      type: 'result',
      applications: [{ name: 'Leeds/26/1/FU' }],
      truncated: false,
      truncationReason: null,
      freshness,
    })
  })

  it('emits a terminal error line when the stored read fails', async () => {
    fetchStored.mockRejectedValue(new Error('canceling statement due to statement timeout'))
    const res = await POST(makeRequest({ boundary: SMALL }) as any)
    // The stream has already committed 200 by the time the read fails, so the
    // failure arrives as a line rather than a status code.
    expect(res.status).toBe(200)
    const lines = await readStream(res)
    expect(lines).toEqual([{ type: 'error', error: 'canceling statement due to statement timeout' }])
  })
})

export {}
