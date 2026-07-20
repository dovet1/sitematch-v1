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

const { POST } = require('../route')
const { __clearCaches } = require('../planit')

const fetchMock = jest.fn()

function makeRequest(body: unknown) {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  return { text: async () => text }
}

// The route streams NDJSON, so responses are read line by line rather than
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

async function terminalLine(res: Response) {
  const lines = await readStream(res)
  return lines[lines.length - 1]
}

function okResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

// Routes the areas lookup and the per-authority applications query.
function mockPlanIt(records: unknown[]) {
  fetchMock.mockImplementation(async (url: string) => {
    if (url.startsWith('https://www.planit.org.uk/api/areas/json')) {
      return okResponse({
        total: 1,
        records: [{ area_id: 1, area_name: 'Testshire', area_type: 'English District' }],
      })
    }
    return okResponse({ total: records.length, records })
  })
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

  it('streams progress lines then a terminal result line', async () => {
    mockPlanIt([
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
    ])
    const res = await POST(makeRequest({ boundary: SMALL }) as any)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toMatch(/x-ndjson/)
    // A streamed response must never be handed to a shared cache the way the
    // old single-shot JSON body was.
    expect(res.headers.get('Cache-Control')).toBe('no-store')

    const lines = await readStream(res)
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.slice(0, -1).every((l) => l.type === 'progress')).toBe(true)

    const result = lines[lines.length - 1]
    expect(result.type).toBe('result')
    expect(result.applications).toHaveLength(1)
    expect(result.truncated).toBe(false)
    expect(result.truncationReason).toBeNull()
    expect(result).not.toHaveProperty('retryAfter')
  })

  it('emits a terminal error line on a first-request 429', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({}),
      text: async () => '',
    })
    const res = await POST(makeRequest({ boundary: SMALL }) as any)
    // The stream has already committed 200 by the time the fan-out fails, so
    // the failure arrives as a line rather than a status code.
    expect(res.status).toBe(200)
    const last = await terminalLine(res)
    expect(last.type).toBe('error')
    expect(last.error).toMatch(/rate-limited/)
  })
})

export {}
