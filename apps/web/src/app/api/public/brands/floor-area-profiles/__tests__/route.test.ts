// The route is the only way this data reaches a browser — the tables behind it
// are service_role-only — so what it must get right is the access gate, the
// m2 -> sq ft conversion, and not trusting the brand ids it is handed. Shapes
// here mirror real rows from brand_floor_area_profiles.

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))

const requireGapFinderAccess = jest.fn()
jest.mock('@/lib/gapfinder-access', () => ({
  requireGapFinderAccess: () => requireGapFinderAccess(),
}))

// One `from()` per table, each resolving whatever the test queued.
const profileRows: { data: unknown[]; error: unknown } = { data: [], error: null }
const fasciaRows: { data: unknown[]; error: unknown } = { data: [], error: null }
const inCalls: { table: string; ids: string[] }[] = []

jest.mock('@/lib/supabase', () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => ({
        in: (_col: string, ids: string[]) => {
          inCalls.push({ table, ids })
          return Promise.resolve(table === 'fascias' ? fasciaRows : profileRows)
        },
      }),
    }),
  }),
}))

import { POST } from '../route'

const BRAND = '85d19d56-0a15-53b9-b6ad-63c01896eef8'
const FASCIA = '2a042524-1c1b-5640-afc6-c96e2b844a4a'

function request(body: unknown) {
  return { json: async () => body } as unknown as Parameters<typeof POST>[0]
}

function profileRow(over: Record<string, unknown> = {}) {
  return {
    brand_id: BRAND,
    fascia_id: FASCIA,
    min_m2: 577,
    p25_m2: 1466,
    median_m2: 1690.5,
    p75_m2: 1803.2,
    max_m2: 3583,
    sample_count: 648,
    coefficient_of_variation: 0.176,
    ...over,
  }
}

describe('POST /api/public/brands/floor-area-profiles', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    inCalls.length = 0
    profileRows.data = []
    profileRows.error = null
    fasciaRows.data = []
    fasciaRows.error = null
    requireGapFinderAccess.mockResolvedValue({ authorized: true, userId: 'u1' })
  })

  it('refuses a caller without GapFinder access, and reads nothing', async () => {
    const denied = { status: 403, json: async () => ({ error: 'no' }) }
    requireGapFinderAccess.mockResolvedValue({ authorized: false, response: denied })

    const res = await POST(request({ brandIds: [BRAND] }))

    expect(res).toBe(denied)
    expect(inCalls).toHaveLength(0)
  })

  it('converts square metres to square feet once, at the boundary', async () => {
    profileRows.data = [profileRow()]
    fasciaRows.data = [{ id: FASCIA, name: 'Aldi' }]

    const res = await POST(request({ brandIds: [BRAND] }))
    const body = (await res.json()) as { profiles: Record<string, any[]> }

    expect(body.profiles[BRAND]).toEqual([
      {
        brandId: BRAND,
        fasciaId: FASCIA,
        fasciaName: 'Aldi',
        minSqFt: 6211,
        p25SqFt: 15780,
        medianSqFt: 18196,
        p75SqFt: 19409,
        maxSqFt: 38567,
        sampleCount: 648,
        coefficientOfVariation: 0.176,
      },
    ])
  })

  it('groups a multi-format brand into its fascias, each with a name', async () => {
    const other = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
    profileRows.data = [
      profileRow(),
      profileRow({ fascia_id: other, p25_m2: 836, p75_m2: 1208, sample_count: 7 }),
    ]
    fasciaRows.data = [
      { id: FASCIA, name: 'Aldi' },
      { id: other, name: 'Aldi Local' },
    ]

    const res = await POST(request({ brandIds: [BRAND] }))
    const body = (await res.json()) as { profiles: Record<string, any[]> }

    expect(body.profiles[BRAND].map((p: any) => p.fasciaName)).toEqual([
      'Aldi',
      'Aldi Local',
    ])
  })

  it('leaves a brand-level row unnamed rather than inventing a fascia', async () => {
    profileRows.data = [profileRow({ fascia_id: null })]

    const res = await POST(request({ brandIds: [BRAND] }))
    const body = (await res.json()) as { profiles: Record<string, any[]> }

    expect(body.profiles[BRAND][0].fasciaId).toBeNull()
    expect(body.profiles[BRAND][0].fasciaName).toBeNull()
    // No fascia lookup is worth making when nothing carries a fascia.
    expect(inCalls.some((c) => c.table === 'fascias')).toBe(false)
  })

  it('drops anything that is not a uuid before it reaches the query', async () => {
    const res = await POST(
      request({ brandIds: [BRAND, 'not-a-uuid', '', null, 42] })
    )
    await res.json()

    expect(inCalls[0].ids).toEqual([BRAND])
  })

  it('de-duplicates repeated brand ids', async () => {
    await POST(request({ brandIds: [BRAND, BRAND, BRAND] }))
    expect(inCalls[0].ids).toEqual([BRAND])
  })

  it('queries nothing when no id survives validation', async () => {
    const res = await POST(request({ brandIds: ['nope'] }))
    const body = (await res.json()) as { profiles: Record<string, unknown> }

    expect(body.profiles).toEqual({})
    expect(inCalls).toHaveLength(0)
  })

  it('rejects a malformed body', async () => {
    const res = await POST(request({ brandIds: 'all of them' }))
    expect(res.status).toBe(400)
    expect(inCalls).toHaveLength(0)
  })

  it('rejects a request larger than any real catchment', async () => {
    const ids = Array.from(
      { length: 601 },
      (_, i) => `85d19d56-0a15-53b9-b6ad-${String(i).padStart(12, '0')}`
    )
    const res = await POST(request({ brandIds: ids }))
    expect(res.status).toBe(400)
    expect(inCalls).toHaveLength(0)
  })

  it('chunks the id list so the query never outgrows the URL', async () => {
    const ids = Array.from(
      { length: 320 },
      (_, i) => `85d19d56-0a15-53b9-b6ad-${String(i).padStart(12, '0')}`
    )
    await POST(request({ brandIds: ids }))

    const chunks = inCalls.filter((c) => c.table === 'brand_floor_area_profiles')
    expect(chunks.map((c) => c.ids.length)).toEqual([150, 150, 20])
  })

  // A read failure must not read as "these brands have no size on record" —
  // the caller hides the whole filter on an error and shows it on an empty
  // result, and those are different answers.
  it('fails loudly on a database error instead of returning an empty estate', async () => {
    // PostgREST errors arrive as plain objects, not Errors, so the client gets
    // the generic message and the detail stays in the server log.
    profileRows.error = { message: 'relation "brand_floor_area_profiles" does not exist' }
    jest.spyOn(console, 'error').mockImplementation(() => {})

    const res = await POST(request({ brandIds: [BRAND] }))
    const body = (await res.json()) as { profiles: unknown; error: string }

    expect(res.status).toBe(500)
    expect(body.profiles).toEqual({})
    expect(body.error).not.toContain('brand_floor_area_profiles')
  })
})
