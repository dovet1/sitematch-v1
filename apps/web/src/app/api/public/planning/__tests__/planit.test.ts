import {
  AuthorityLookupError,
  MAX_AUTHORITIES,
  MAX_TOTAL_RECORDS,
  PAGE_SIZE,
  PLANIT_AREAS_BASE,
  PLANIT_BASE,
  RateLimitError,
  __clearCaches,
  classifyUpstream,
  fetchAuthorities,
  fetchPlanningApplications,
  mapRecord,
  startDateUTC,
  validateBoundary,
  type Boundary,
} from '../planit'
import type { PlanningProgress } from '@/app/sitematcher-unified/types/unified-workspace'

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

function areaRecord(id: number, name: string, type = 'English District') {
  return { area_id: id, area_name: name, area_type: type }
}

function envelope(records: unknown[], total = records.length) {
  return { from: 0, to: records.length, total, secs_taken: 0.5, records }
}

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

// PlanIt signals failure with a 400 plus a body that says which failure it is.
function errorResponse(status: number, body: unknown = {}): Response {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  return {
    ok: false,
    status,
    json: async () => (typeof body === 'string' ? {} : body),
    text: async () => text,
  } as unknown as Response
}

const BUSY_BODY = '{"error": "PGRST003: Timed out acquiring connection from connection pool."}'
const TIMEOUT_BODY = '{"error": "Timeout (45s) from data source"}'

function status429(): Response {
  return errorResponse(429)
}

function callUrl(call: unknown): URL {
  return new URL((call as [string])[0])
}

function isAreasCall(call: unknown): boolean {
  return (call as [string])[0].startsWith(PLANIT_AREAS_BASE)
}

function applicsCalls() {
  return fetchMock.mock.calls.filter((c) => !isAreasCall(c))
}

/**
 * Routes the two PlanIt endpoints this module talks to. `apps` receives the
 * numeric authority id and the zero-based page index.
 */
function mockPlanIt(options: {
  areas?: unknown[]
  apps?: (authId: string, index: number) => Response | Promise<Response>
}) {
  const areas = options.areas ?? [areaRecord(1, 'Testshire')]
  fetchMock.mockImplementation(async (url: string) => {
    if (url.startsWith(PLANIT_AREAS_BASE)) return okResponse(envelope(areas))
    const params = new URL(url).searchParams
    const authId = params.get('auth')!
    const index = Number(params.get('index') ?? '0')
    if (!options.apps) return okResponse(envelope([]))
    return options.apps(authId, index)
  })
}

const fetchMock = jest.fn()

beforeEach(() => {
  fetchMock.mockReset()
  __clearCaches()
  global.fetch = fetchMock as unknown as typeof fetch
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  jest.restoreAllMocks()
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
// Upstream error classification
// ---------------------------------------------------------------------------

describe('classifyUpstream', () => {
  // PlanIt returns HTTP 400 for two unrelated problems, and only the body
  // distinguishes transient load from a query that was simply too expensive.
  it('reads connection-pool exhaustion as transient upstream_busy', () => {
    expect(classifyUpstream(400, BUSY_BODY)).toBe('upstream_busy')
  })

  it('reads the data-source timeout as upstream_timeout', () => {
    expect(classifyUpstream(400, TIMEOUT_BODY)).toBe('upstream_timeout')
    expect(classifyUpstream(400, '{"error": "Timeout (30s) from data source"}')).toBe(
      'upstream_timeout'
    )
  })

  it('falls back to status for timeout codes and upstream_error otherwise', () => {
    expect(classifyUpstream(504, '')).toBe('upstream_timeout')
    expect(classifyUpstream(408, '')).toBe('upstream_timeout')
    expect(classifyUpstream(500, 'server exploded')).toBe('upstream_error')
    expect(classifyUpstream(400, 'something else')).toBe('upstream_error')
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
    // Authority queries return some unlocatable records; they cannot be placed
    // inside a boundary, so they are dropped rather than guessed at.
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
// Authority resolution
// ---------------------------------------------------------------------------

describe('fetchAuthorities', () => {
  it('resolves authorities from the boundary bbox and omits the borders field', async () => {
    mockPlanIt({
      areas: [areaRecord(296, 'Barnet', 'London Borough'), areaRecord(12, 'Camden')],
    })
    const { authorities, truncated } = await fetchAuthorities(SMALL)

    expect(truncated).toBe(false)
    expect(authorities).toEqual([
      { id: 296, name: 'Barnet', type: 'London Borough' },
      { id: 12, name: 'Camden', type: 'English District' },
    ])

    const params = callUrl(fetchMock.mock.calls[0]).searchParams
    expect(params.get('bbox')).toBe('-1.6,53,-1.55,53.04')
    // Area records embed a full authority outline; without `select` every
    // lookup would download and discard one polygon per authority.
    expect(params.get('select')).toBe('area_id,area_name,area_type')
  })

  // PlanIt's nginx 403s Node's default fetch User-Agent, so omitting this
  // header breaks every server-side request while curl and browsers still work.
  it('identifies itself with a User-Agent', async () => {
    mockPlanIt({})
    await fetchAuthorities(SMALL)
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>)['User-Agent']).toBeTruthy()
  })

  it('de-duplicates repeated area ids', async () => {
    mockPlanIt({
      areas: [areaRecord(7, 'Dupe'), areaRecord(7, 'Dupe'), areaRecord(8, 'Other')],
    })
    const { authorities } = await fetchAuthorities(SMALL)
    expect(authorities.map((a) => a.id)).toEqual([7, 8])
  })

  it('skips records missing an id or name rather than querying a bad auth', async () => {
    mockPlanIt({
      areas: [
        areaRecord(1, 'Good'),
        { area_id: null, area_name: 'No id' },
        { area_id: 2, area_name: '' },
        'not an object',
      ],
    })
    const { authorities } = await fetchAuthorities(SMALL)
    expect(authorities.map((a) => a.name)).toEqual(['Good'])
  })

  it('caps the authority count and flags truncation', async () => {
    mockPlanIt({
      areas: Array.from({ length: MAX_AUTHORITIES + 5 }, (_, i) =>
        areaRecord(i + 1, `Area ${i + 1}`)
      ),
    })
    const { authorities, truncated } = await fetchAuthorities(SMALL)
    expect(authorities).toHaveLength(MAX_AUTHORITIES)
    expect(truncated).toBe(true)
  })

  it('throws RateLimitError on a 429', async () => {
    fetchMock.mockResolvedValue(status429())
    await expect(fetchAuthorities(SMALL)).rejects.toBeInstanceOf(RateLimitError)
  })

  // Every authority query depends on this lookup, so an unretried blip here
  // would fail the whole planning tab rather than degrading one council.
  it('retries a transient PGRST003 rather than failing the whole lookup', async () => {
    let attempt = 0
    fetchMock.mockImplementation(async () => {
      attempt++
      return attempt === 1
        ? errorResponse(400, BUSY_BODY)
        : okResponse(envelope([areaRecord(5, 'Recovered')]))
    })
    const { authorities } = await fetchAuthorities(SMALL)
    expect(attempt).toBe(2)
    expect(authorities.map((a) => a.name)).toEqual(['Recovered'])
  })

  it('gives up after the retry budget with a user-facing message', async () => {
    fetchMock.mockResolvedValue(errorResponse(500, 'server exploded'))
    // The tab renders this string directly, so it must not quote a status code.
    await expect(fetchAuthorities(SMALL)).rejects.toThrow(/try again in a few minutes/)
    await expect(fetchAuthorities(SMALL)).rejects.not.toThrow(/500/)
    expect(fetchMock.mock.calls).toHaveLength(4)
  })

  // A data-source timeout is a cost signal, not a blip: retrying it would just
  // spend another 45s to fail identically.
  it('does not retry a data-source timeout', async () => {
    fetchMock.mockResolvedValue(errorResponse(400, TIMEOUT_BODY))
    await expect(fetchAuthorities(SMALL)).rejects.toThrow(AuthorityLookupError)
    expect(fetchMock.mock.calls).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Fetch orchestration
// ---------------------------------------------------------------------------

describe('fetchPlanningApplications', () => {
  it('queries each authority by numeric id with no_kin and the fixed filters', async () => {
    mockPlanIt({
      areas: [areaRecord(11, 'Alpha'), areaRecord(22, 'Beta')],
      apps: (authId) =>
        okResponse(envelope([planItRecord(`${authId}/1`, -1.57, 53.02)])),
    })
    const result = await fetchPlanningApplications(SMALL)

    const calls = applicsCalls()
    expect(calls).toHaveLength(2)
    const params = callUrl(calls[0]).searchParams
    expect(callUrl(calls[0]).origin + callUrl(calls[0]).pathname).toBe(PLANIT_BASE)
    expect(params.get('app_size')).toBe('Large')
    expect(params.get('app_state')).toBe('Undecided,Permitted,Rejected')
    expect(params.get('app_type')).toBe('Full,Outline,Amendment')
    expect(params.get('start_date')).toBe(startDateUTC())
    // Numeric ids only — "Manchester" and "Greater Manchester" are distinct
    // areas and a name would be ambiguous between them.
    expect(calls.map((c) => callUrl(c).searchParams.get('auth')).sort()).toEqual([
      '11',
      '22',
    ])
    // no_kin keeps parent and child areas from refetching each other's records.
    expect(params.get('no_kin')).toBe('1')

    expect(result.applications).toHaveLength(2)
    expect(result.truncated).toBe(false)
    expect(result.truncationReason).toBeNull()
  })

  it('paginates with zero-based index (never offset)', async () => {
    const page = (n: number, tag: string) =>
      Array.from({ length: n }, (_, i) => planItRecord(`${tag}/${i}`, -1.57, 53.02))
    mockPlanIt({
      apps: (_authId, index) => {
        if (index === 0) return okResponse(envelope(page(PAGE_SIZE, 'a'), 250))
        if (index === 100) return okResponse(envelope(page(PAGE_SIZE, 'b'), 250))
        return okResponse(envelope(page(50, 'c'), 250))
      },
    })

    const result = await fetchPlanningApplications(SMALL)
    const calls = applicsCalls()
    expect(calls.map((c) => callUrl(c).searchParams.get('index'))).toEqual([
      '0',
      '100',
      '200',
    ])
    for (const c of calls) {
      expect(callUrl(c).searchParams.get('offset')).toBeNull()
    }
    expect(result.applications).toHaveLength(250)
  })

  it('filters authority-wide results down to the requested boundary', async () => {
    // The whole point of the authority model: a council query returns records
    // well outside the requested area, and the local re-filter removes them.
    mockPlanIt({
      apps: () =>
        okResponse(
          envelope([
            planItRecord('IN/1', -1.57, 53.02),
            planItRecord('OUT/1', -1.7, 53.02), // west of the polygon
          ])
        ),
    })
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
    mockPlanIt({
      apps: (_authId, index) =>
        index === 0
          ? okResponse(
              envelope(
                Array.from({ length: PAGE_SIZE }, (_, i) =>
                  planItRecord(`M/${i}`, -1.57, 53.02)
                ),
                250
              )
            )
          : status429(),
    })
    const result = await fetchPlanningApplications(SMALL)
    expect(result.applications).toHaveLength(PAGE_SIZE)
    expect(result.truncated).toBe(true)
    expect(result.truncationReason).toBe('rate_limited')
  })

  it('sets page_cap when an authority exhausts the page budget', async () => {
    mockPlanIt({
      apps: () =>
        okResponse(
          envelope(
            Array.from({ length: PAGE_SIZE }, (_, i) =>
              planItRecord(`PAGE/${i}`, -1.57, 53.02)
            ),
            PAGE_SIZE * 20
          )
        ),
    })
    const result = await fetchPlanningApplications(SMALL)
    expect(applicsCalls()).toHaveLength(10)
    expect(result.truncated).toBe(true)
    expect(result.truncationReason).toBe('page_cap')
  })

  it('sets authority_cap when the boundary spans more councils than the budget', async () => {
    mockPlanIt({
      areas: Array.from({ length: MAX_AUTHORITIES + 3 }, (_, i) =>
        areaRecord(i + 1, `Area ${i + 1}`)
      ),
    })
    const result = await fetchPlanningApplications(SMALL)
    expect(result.truncated).toBe(true)
    expect(result.truncationReason).toBe('authority_cap')
  })

  it('sets record_cap when the fan-out hits the total record limit', async () => {
    mockPlanIt({
      areas: Array.from({ length: 15 }, (_, i) => areaRecord(i + 1, `Area ${i + 1}`)),
      apps: (authId, index) =>
        okResponse(
          envelope(
            Array.from({ length: PAGE_SIZE }, (_, i) =>
              planItRecord(`REC/${authId}/${index}/${i}`, -1.57, 53.02)
            ),
            PAGE_SIZE * 3
          )
        ),
    })
    const result = await fetchPlanningApplications(SMALL)
    expect(result.applications).toHaveLength(MAX_TOTAL_RECORDS)
    expect(result.truncated).toBe(true)
    expect(result.truncationReason).toBe('record_cap')
  })

  it('surfaces upstream_timeout for the 45s data-source timeout', async () => {
    mockPlanIt({ apps: () => errorResponse(400, TIMEOUT_BODY) })
    const result = await fetchPlanningApplications(SMALL)
    expect(result.truncated).toBe(true)
    expect(result.truncationReason).toBe('upstream_timeout')
  })

  it('does not retry a data-source timeout — a retry would just cost another 45s', async () => {
    mockPlanIt({ apps: () => errorResponse(400, TIMEOUT_BODY) })
    await fetchPlanningApplications(SMALL)
    expect(applicsCalls()).toHaveLength(1)
  })

  it('retries a transient PGRST003 and keeps the recovered result clean', async () => {
    let attempt = 0
    mockPlanIt({
      apps: () => {
        attempt++
        return attempt === 1
          ? errorResponse(400, BUSY_BODY)
          : okResponse(envelope([planItRecord('OK/1', -1.57, 53.02)]))
      },
    })
    const result = await fetchPlanningApplications(SMALL)
    expect(applicsCalls()).toHaveLength(2)
    // A single flake must not leave a warning on an otherwise complete result.
    expect(result.truncated).toBe(false)
    expect(result.truncationReason).toBeNull()
    expect(result.applications.map((a) => a.name)).toEqual(['OK/1'])
  })

  it('reports upstream_busy when retries are exhausted', async () => {
    mockPlanIt({ apps: () => errorResponse(400, BUSY_BODY) })
    const result = await fetchPlanningApplications(SMALL)
    expect(applicsCalls()).toHaveLength(2)
    expect(result.truncated).toBe(true)
    expect(result.truncationReason).toBe('upstream_busy')
  })

  it('keeps other authorities when one fails', async () => {
    mockPlanIt({
      areas: [areaRecord(1, 'Good'), areaRecord(2, 'Bad')],
      apps: (authId) =>
        authId === '2'
          ? errorResponse(400, TIMEOUT_BODY)
          : okResponse(envelope([planItRecord('KEEP/1', -1.57, 53.02)])),
    })
    const result = await fetchPlanningApplications(SMALL)
    expect(result.applications.map((a) => a.name)).toEqual(['KEEP/1'])
    expect(result.truncated).toBe(true)
    expect(result.truncationReason).toBe('upstream_timeout')
  })

  it('reports progress as each authority completes', async () => {
    mockPlanIt({
      areas: [areaRecord(1, 'Alpha'), areaRecord(2, 'Beta'), areaRecord(3, 'Gamma')],
    })
    const seen: PlanningProgress[] = []
    await fetchPlanningApplications(SMALL, { onProgress: (p) => seen.push(p) })

    expect(seen[0]).toEqual({ done: 0, total: 3, authority: null })
    expect(seen[seen.length - 1]).toMatchObject({ done: 3, total: 3 })
    expect(seen.map((p) => p.done)).toEqual([0, 1, 2, 3])
    expect(seen.every((p) => p.total === 3)).toBe(true)
  })
})

describe('caching', () => {
  it('serves a repeat identical boundary from the final cache', async () => {
    mockPlanIt({ apps: () => okResponse(envelope([planItRecord('C/1', -1.57, 53.02)])) })
    await fetchPlanningApplications(SMALL)
    const callsAfterFirst = fetchMock.mock.calls.length
    const second = await fetchPlanningApplications(SMALL)
    expect(fetchMock.mock.calls).toHaveLength(callsAfterFirst)
    expect(second.applications).toHaveLength(1)
  })

  it('reuses a cached authority across different boundaries', async () => {
    // The big win over the old boundary-hash key: two different areas in the
    // same council share the authority fetch instead of both paying for it.
    mockPlanIt({ apps: () => okResponse(envelope([planItRecord('S/1', -1.57, 53.02)])) })
    await fetchPlanningApplications(SMALL)
    const afterFirst = applicsCalls().length

    const nearby = rect(-1.599, 53.001, -1.551, 53.039)
    await fetchPlanningApplications(nearby)
    expect(applicsCalls()).toHaveLength(afterFirst)
  })

  it('does not cache a truncated authority result', async () => {
    mockPlanIt({ apps: () => errorResponse(400, TIMEOUT_BODY) })
    await fetchPlanningApplications(SMALL)
    const afterFirst = applicsCalls().length

    const nearby = rect(-1.599, 53.001, -1.551, 53.039)
    await fetchPlanningApplications(nearby)
    expect(applicsCalls().length).toBeGreaterThan(afterFirst)
  })

  it('keys on the date window: a different start_date refetches', async () => {
    mockPlanIt({})
    await fetchPlanningApplications(SMALL, { now: new Date('2026-07-19T12:00:00Z') })
    await fetchPlanningApplications(SMALL, { now: new Date('2026-09-01T12:00:00Z') })
    const dates = applicsCalls().map((c) => callUrl(c).searchParams.get('start_date'))
    expect(dates).toEqual(['2024-07-19', '2024-09-01'])
  })
})
