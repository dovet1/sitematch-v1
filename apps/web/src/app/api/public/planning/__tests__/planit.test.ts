import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import area from '@turf/area'
import { point, polygon as turfPolygon } from '@turf/helpers'
import {
  MAX_BOUNDARY_AREA_M2,
  MAX_OUTBOUND_VERTICES,
  PAGE_SIZE,
  PLANIT_BASE,
  RateLimitError,
  __clearCaches,
  buildTiles,
  fetchPlanningApplications,
  mapRecord,
  planQuery,
  startDateUTC,
  validateBoundary,
  vertexCount,
  type Boundary,
} from '../planit'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function rect(
  minLon: number,
  minLat: number,
  maxLon: number,
  maxLat: number
): GeoJSON.Polygon {
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

// A many-vertex ellipse (degree-space circle, lat-corrected) around a centre.
function circleOf(
  cx: number,
  cy: number,
  radiusDeg: number,
  points: number
): GeoJSON.Polygon {
  const ring: [number, number][] = []
  const lonScale = 1 / Math.cos((cy * Math.PI) / 180)
  for (let i = 0; i <= points; i++) {
    const t = (i / points) * 2 * Math.PI
    ring.push([cx + radiusDeg * lonScale * Math.cos(t), cy + radiusDeg * Math.sin(t)])
  }
  return { type: 'Polygon', coordinates: [ring] }
}

// Structure mirrors a real PlanIt record (fields verified live during planning).
function planItRecord(
  name: string,
  lng: number,
  lat: number,
  extra: Record<string, unknown> = {},
  otherFields: Record<string, unknown> | null = {}
) {
  return {
    name,
    uid: name.split('/').slice(1).join('/'),
    address: '1 High Street, Testtown',
    app_size: 'Large',
    app_state: 'Undecided',
    app_type: 'Full',
    description: 'Erection of a mixed-use development.',
    url: `https://planning.example/${encodeURIComponent(name)}`,
    location_x: lng,
    location_y: lat,
    decided_date: null,
    other_fields: otherFields,
    ...extra,
  }
}

function envelope(records: unknown[], total = records.length) {
  return { from: 0, to: records.length, total, secs_taken: 0.5, records }
}

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response
}

function status429(): Response {
  return { ok: false, status: 429, json: async () => ({}) } as unknown as Response
}

// Reads the query params of a mocked fetch call, whether it went as a
// form-encoded POST (boundary) or a GET with a query string (bbox tile).
function callParams(call: [unknown, unknown?]): URLSearchParams {
  const [url, init] = call as [string, RequestInit | undefined]
  if (init?.method === 'POST') return init.body as URLSearchParams
  return new URL(url).searchParams
}

const fetchMock = jest.fn()

beforeEach(() => {
  fetchMock.mockReset()
  __clearCaches()
  global.fetch = fetchMock as unknown as typeof fetch
})

// A small rectangle near Sheffield: ~5 km × ~4 km, well under every threshold.
const SMALL = rect(-1.6, 53.0, -1.55, 53.04)

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('validateBoundary', () => {
  it('rejects non-polygon geometry types', () => {
    expect(
      validateBoundary({ type: 'LineString', coordinates: [[0, 51], [1, 51]] })
    ).toMatch(/Polygon/)
    expect(validateBoundary({ type: 'Point', coordinates: [0, 51] })).toMatch(
      /Polygon/
    )
    expect(validateBoundary(null)).toBeTruthy()
    expect(validateBoundary('boundary')).toBeTruthy()
  })

  it('rejects non-finite and out-of-UK coordinates', () => {
    const nan = rect(-1.6, 53.0, -1.55, 53.04)
    nan.coordinates[0][1][0] = NaN
    expect(validateBoundary(nan)).toMatch(/finite/)

    expect(validateBoundary(rect(10, 53, 10.1, 53.1))).toMatch(/within the UK/)
    expect(validateBoundary(rect(-1.6, 30, -1.55, 30.1))).toMatch(/within the UK/)
  })

  it('rejects a polygon with too many vertices', () => {
    expect(validateBoundary(circleOf(-1.5, 53.5, 0.01, 50_001))).toMatch(
      /too many vertices/
    )
  })

  it('rejects an oversized area but accepts a small polygon', () => {
    // ~10° × 10° inside UK bounds — far over MAX_REQUEST_AREA_M2.
    expect(validateBoundary(rect(-8, 50, 2, 60))).toMatch(/area is too large/)
    expect(validateBoundary(SMALL)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Query planning: verbatim → simplify+buffer → tiles
// ---------------------------------------------------------------------------

describe('planQuery', () => {
  it('sends a small polygon verbatim (no simplify, no buffer)', () => {
    const plan = planQuery(SMALL)
    expect(plan.kind).toBe('boundary')
    if (plan.kind === 'boundary') expect(plan.geometry).toBe(SMALL)
  })

  it('simplifies + buffers an over-limit polygon into a verified superset', () => {
    const original = circleOf(-1.5, 53.5, 0.04, 4000) // ~62 km², 4001 vertices
    expect(vertexCount(original)).toBeGreaterThan(MAX_OUTBOUND_VERTICES)
    const plan = planQuery(original)
    expect(plan.kind).toBe('boundary')
    if (plan.kind !== 'boundary') return
    expect(plan.geometry).not.toBe(original)
    expect(vertexCount(plan.geometry)).toBeLessThanOrEqual(MAX_OUTBOUND_VERTICES)
    // Superset guarantee: every original vertex lies inside the sent geometry.
    for (const [lng, lat] of original.coordinates[0]) {
      expect(
        booleanPointInPolygon(point([lng, lat]), {
          type: 'Feature',
          properties: {},
          geometry: plan.geometry,
        })
      ).toBe(true)
    }
  })

  it('falls back to bbox tiles for a polygon over the area threshold', () => {
    const big = rect(-2.0, 53.0, -1.5, 53.3) // ~1.1e9 m²
    expect(area(big)).toBeGreaterThan(MAX_BOUNDARY_AREA_M2)
    const plan = planQuery(big)
    expect(plan.kind).toBe('tiles')
    if (plan.kind !== 'tiles') return
    expect(plan.tiles.length).toBeGreaterThan(1)
    for (const [minLon, minLat, maxLon, maxLat] of plan.tiles) {
      const tilePoly = turfPolygon([
        [
          [minLon, minLat],
          [maxLon, minLat],
          [maxLon, maxLat],
          [minLon, maxLat],
          [minLon, minLat],
        ],
      ])
      expect(area(tilePoly)).toBeLessThanOrEqual(MAX_BOUNDARY_AREA_M2)
    }
  })

  it('caps the tile count and flags truncation for a sprawling bbox', () => {
    // A thin diagonal band: modest polygon area, but a bbox spanning ~6°.
    const sliver: Boundary = {
      type: 'Polygon',
      coordinates: [
        [
          [-7, 50],
          [-6.98, 50],
          [-1, 55.9],
          [-1.02, 55.9],
          [-7, 50],
        ],
      ],
    }
    const { tiles, tilesTruncated } = buildTiles(sliver)
    expect(tilesTruncated).toBe(true)
    expect(tiles).toHaveLength(24)
  })
})

// ---------------------------------------------------------------------------
// Record mapping
// ---------------------------------------------------------------------------

describe('mapRecord', () => {
  it('maps top-level and other_fields values', () => {
    const app = mapRecord(
      planItRecord(
        'Leeds/26/03912/LI',
        -1.55,
        53.8,
        { decided_date: '2026-05-01' },
        {
          date_validated: '2026-01-10',
          n_dwellings: '42',
          applicant_address: '2 Applicant Way',
          agent_address: '3 Agent Row',
          applicant_name: 'See source',
          agent_name: 'See source',
        }
      )
    )
    expect(app).toMatchObject({
      name: 'Leeds/26/03912/LI',
      uid: '26/03912/LI',
      address: '1 High Street, Testtown',
      appSize: 'Large',
      appState: 'Undecided',
      appType: 'Full',
      lng: -1.55,
      lat: 53.8,
      decidedDate: '2026-05-01',
      dateValidated: '2026-01-10',
      nDwellings: 42,
      applicantAddress: '2 Applicant Way',
      agentAddress: '3 Agent Row',
    })
    // The placeholder applicant/agent names are never surfaced anywhere.
    expect(JSON.stringify(app)).not.toContain('See source')
  })

  it('drops records without numeric coordinates and normalises absences to null', () => {
    expect(
      mapRecord(planItRecord('X/1', -1.55, 53.8, { location_x: null }))
    ).toBeNull()
    expect(
      mapRecord(planItRecord('X/2', -1.55, 53.8, { location_y: 'not-a-number' }))
    ).toBeNull()
    expect(mapRecord({ description: 'no name or coords' })).toBeNull()

    const sparse = mapRecord(planItRecord('X/3', -1.55, 53.8, {}, null))
    expect(sparse).toMatchObject({
      decidedDate: null,
      dateValidated: null,
      nDwellings: null,
      applicantAddress: null,
      agentAddress: null,
    })
  })
})

// ---------------------------------------------------------------------------
// Fetch orchestration
// ---------------------------------------------------------------------------

describe('fetchPlanningApplications', () => {
  it('POSTs the boundary form-encoded (never a JSON body) with the fixed filters', async () => {
    fetchMock.mockResolvedValue(
      okResponse(envelope([planItRecord('A/1', -1.57, 53.02)]))
    )
    const result = await fetchPlanningApplications(SMALL)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(PLANIT_BASE)
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(URLSearchParams)
    const params = init.body as URLSearchParams
    expect(params.get('app_size')).toBe('Large')
    expect(params.get('app_state')).toBe('Undecided,Permitted,Rejected')
    expect(params.get('app_type')).toBe('Full,Outline,Amendment')
    expect(params.get('start_date')).toBe(startDateUTC())
    expect(JSON.parse(params.get('boundary')!)).toEqual(SMALL)
    expect(result.applications).toHaveLength(1)
    expect(result.truncated).toBe(false)
  })

  it('paginates with zero-based index (never offset)', async () => {
    const page = (n: number) =>
      Array.from({ length: n }, (_, i) =>
        planItRecord(`P/${Math.random()}/${i}`, -1.57, 53.02)
      )
    fetchMock
      .mockResolvedValueOnce(okResponse(envelope(page(PAGE_SIZE), 250)))
      .mockResolvedValueOnce(okResponse(envelope(page(PAGE_SIZE), 250)))
      .mockResolvedValueOnce(okResponse(envelope(page(50), 250)))

    const result = await fetchPlanningApplications(SMALL)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    const indexes = fetchMock.mock.calls.map(
      (c) => callParams(c as [string, RequestInit]).get('index')
    )
    expect(indexes).toEqual(['0', '100', '200'])
    for (const c of fetchMock.mock.calls) {
      expect(callParams(c as [string, RequestInit]).get('offset')).toBeNull()
    }
    expect(result.applications).toHaveLength(250)
  })

  it('filters results to the requested boundary', async () => {
    fetchMock.mockResolvedValue(
      okResponse(
        envelope([
          planItRecord('IN/1', -1.57, 53.02),
          planItRecord('OUT/1', -1.7, 53.02), // west of the polygon
        ])
      )
    )
    const result = await fetchPlanningApplications(SMALL)
    expect(result.applications.map((a) => a.name)).toEqual(['IN/1'])
  })

  it('throws RateLimitError on a first-request 429', async () => {
    fetchMock.mockResolvedValue(status429())
    await expect(fetchPlanningApplications(SMALL)).rejects.toBeInstanceOf(
      RateLimitError
    )
  })

  it('keeps fetched pages and truncates on a mid-pagination 429', async () => {
    fetchMock
      .mockResolvedValueOnce(
        okResponse(
          envelope(
            Array.from({ length: PAGE_SIZE }, (_, i) =>
              planItRecord(`M/${i}`, -1.57, 53.02)
            ),
            250
          )
        )
      )
      .mockResolvedValue(status429())
    const result = await fetchPlanningApplications(SMALL)
    expect(result.applications).toHaveLength(PAGE_SIZE)
    expect(result.truncated).toBe(true)
  })

  describe('tiling path', () => {
    const BIG = rect(-2.0, 53.0, -1.5, 53.3)

    it('queries bbox tiles and survives a per-tile failure as truncated', async () => {
      fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
        expect(init?.method).toBeUndefined() // tiles use the measured GET form
        const bbox = new URL(url).searchParams.get('bbox')!
        const [minLon] = bbox.split(',').map(Number)
        if (Math.abs(minLon - -2.0) < 1e-6) {
          throw Object.assign(new Error('timeout'), { name: 'TimeoutError' })
        }
        return okResponse(envelope([]))
      })
      const result = await fetchPlanningApplications(BIG)
      expect(result.truncated).toBe(true)
      // All tiles were still attempted despite the failures in column -2.0.
      expect(fetchMock.mock.calls.length).toBeGreaterThan(1)
    })

    it('keeps partial results on a mid-run 429 across tiles', async () => {
      let first = true
      fetchMock.mockImplementation(async () => {
        if (first) {
          first = false
          return okResponse(envelope([planItRecord('T/1', -1.9, 53.05)]))
        }
        return status429()
      })
      const result = await fetchPlanningApplications(BIG)
      expect(result.truncated).toBe(true)
      expect(result.applications.map((a) => a.name)).toEqual(['T/1'])
    })
  })

  describe('caching', () => {
    it('serves a repeat identical boundary from the final cache', async () => {
      fetchMock.mockResolvedValue(
        okResponse(envelope([planItRecord('C/1', -1.57, 53.02)]))
      )
      await fetchPlanningApplications(SMALL)
      const second = await fetchPlanningApplications(SMALL)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(second.applications).toHaveLength(1)
    })

    it('never shares entries between nearby but non-identical boundaries', async () => {
      fetchMock.mockResolvedValue(okResponse(envelope([])))
      await fetchPlanningApplications(SMALL)
      const tweaked = rect(-1.6, 53.0, -1.55, 53.0401)
      await fetchPlanningApplications(tweaked)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('keys on the date window: a different start_date refetches', async () => {
      fetchMock.mockResolvedValue(okResponse(envelope([])))
      await fetchPlanningApplications(SMALL, new Date('2026-07-19T12:00:00Z'))
      await fetchPlanningApplications(SMALL, new Date('2026-09-01T12:00:00Z'))
      expect(fetchMock).toHaveBeenCalledTimes(2)
      const dates = fetchMock.mock.calls.map(
        (c) => callParams(c as [string, RequestInit]).get('start_date')
      )
      expect(dates).toEqual(['2024-07-19', '2024-09-01'])
    })

    it('reuses cached upstream tiles across requests, re-filtered per boundary', async () => {
      // A and B overlap on the middle grid tile [-1.8, 52.5, -1.6, 52.65].
      const A = rect(-1.99, 52.51, -1.61, 52.64) // tiles -2.0…-1.8, -1.8…-1.6
      const B = rect(-1.79, 52.51, -1.41, 52.64) // tiles -1.8…-1.6, -1.6…-1.4
      const r1 = planItRecord('R/1', -1.9, 52.55) // west tile, A only
      const r2 = planItRecord('R/2', -1.795, 52.55) // shared tile, inside A only
      const r3 = planItRecord('R/3', -1.5, 52.55) // east tile, B only
      const r4 = planItRecord('R/4', -1.7, 52.55) // shared tile, inside both

      fetchMock.mockImplementation(async (url: string) => {
        const [minLon] = new URL(url).searchParams
          .get('bbox')!
          .split(',')
          .map(Number)
        if (Math.abs(minLon - -2.0) < 1e-6) return okResponse(envelope([r1]))
        if (Math.abs(minLon - -1.8) < 1e-6) return okResponse(envelope([r2, r4]))
        if (Math.abs(minLon - -1.6) < 1e-6) return okResponse(envelope([r3]))
        return okResponse(envelope([]))
      })

      const resultA = await fetchPlanningApplications(A)
      expect(resultA.applications.map((a) => a.name).sort()).toEqual([
        'R/1',
        'R/2',
        'R/4',
      ])
      const callsAfterA = fetchMock.mock.calls.length

      const resultB = await fetchPlanningApplications(B)
      // The shared tile came from the upstream cache: only the new east tile hits.
      expect(fetchMock.mock.calls.length).toBe(callsAfterA + 1)
      // …but its candidates are re-filtered to B, so R/2 is correctly excluded.
      expect(resultB.applications.map((a) => a.name).sort()).toEqual(['R/3', 'R/4'])
    })
  })
})
