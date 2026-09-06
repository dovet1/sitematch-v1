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
const storeRows: { data: unknown[]; error: unknown } = { data: [], error: null }
const areaRows: { data: unknown[]; error: unknown } = { data: [], error: null }
const inCalls: { table: string; ids: string[]; eq?: [string, unknown] }[] = []

const queued = (table: string) =>
  table === 'fascias'
    ? fasciaRows
    : table === 'stores'
      ? storeRows
      : table === 'store_floor_areas'
        ? areaRows
        : profileRows

jest.mock('@/lib/supabase', () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => {
        const builder = {
          eqPair: undefined as [string, unknown] | undefined,
          eq(col: string, val: unknown) {
            builder.eqPair = [col, val]
            return builder
          },
          in(_col: string, ids: string[]) {
            inCalls.push({ table, ids, eq: builder.eqPair })
            return Promise.resolve(queued(table))
          },
        }
        return builder
      },
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

function reset() {
  jest.clearAllMocks()
  inCalls.length = 0
  for (const q of [profileRows, fasciaRows, storeRows, areaRows]) {
    q.data = []
    q.error = null
  }
  requireGapFinderAccess.mockResolvedValue({ authorized: true, userId: 'u1' })
}

describe('POST /api/public/brands/floor-area-profiles', () => {
  beforeEach(reset)

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

// Brands the profiles table will not summarise still have something to say: the
// shops we measured. The route returns those together with the estate size, so
// the panel can show figures without implying a distribution and the reader can
// see what share of the estate they cover.
describe('brands with measurements but no distribution', () => {
  beforeEach(reset)

  const SMALL = '11111111-2222-3333-4444-555555555555'
  const BIG = '66666666-7777-8888-9999-aaaaaaaaaaaa'

  it('returns the measured shops and the size of the estate they came from', async () => {
    storeRows.data = [
      { id: 's1', brand_id: SMALL },
      { id: 's2', brand_id: SMALL },
      { id: 's3', brand_id: SMALL },
    ]
    areaRows.data = [
      { store_id: 's3', floor_area_sqft: 872 },
      { store_id: 's1', floor_area_sqft: 840 },
    ]

    const res = await POST(request({ brandIds: [SMALL] }))
    const body = (await res.json()) as { measured: Record<string, any> }

    expect(body.measured[SMALL]).toEqual({
      brandId: SMALL,
      totalStores: 3,
      measuredSqFt: [840, 872],
    })
  })

  it('only reads high-confidence measurements', async () => {
    storeRows.data = [{ id: 's1', brand_id: SMALL }]
    areaRows.data = [{ store_id: 's1', floor_area_sqft: 840 }]

    await POST(request({ brandIds: [SMALL] }))

    const areaCall = inCalls.find((c) => c.table === 'store_floor_areas')
    expect(areaCall?.eq).toEqual(['confidence', 'high'])
  })

  it('covers a large estate too, carrying the fraction that qualifies it', async () => {
    storeRows.data = Array.from({ length: 30 }, (_, i) => ({
      id: `b${i}`,
      brand_id: BIG,
    }))
    areaRows.data = [
      { store_id: 'b7', floor_area_sqft: 9500 },
      { store_id: 'b2', floor_area_sqft: 8000 },
    ]

    const res = await POST(request({ brandIds: [BIG] }))
    const body = (await res.json()) as { measured: Record<string, any> }

    // Two of thirty is thin, and the denominator is what says so — the route
    // reports both rather than deciding for the reader.
    expect(body.measured[BIG]).toEqual({
      brandId: BIG,
      totalStores: 30,
      measuredSqFt: [8000, 9500],
    })
  })

  it('omits a small brand with no measurement at all', async () => {
    storeRows.data = [{ id: 's1', brand_id: SMALL }]
    areaRows.data = []

    const res = await POST(request({ brandIds: [SMALL] }))
    const body = (await res.json()) as { measured: Record<string, unknown> }

    expect(body.measured).toEqual({})
  })

  it('does not look up brands that already have a distribution', async () => {
    profileRows.data = [profileRow()]

    await POST(request({ brandIds: [BRAND] }))

    expect(inCalls.some((c) => c.table === 'stores')).toBe(false)
  })
})
