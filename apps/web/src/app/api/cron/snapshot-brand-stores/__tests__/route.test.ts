// Covers what the SQL tests cannot: the route's auth gate, which months it asks for, and
// how it reports a partial failure. The RPC itself is exercised in
// supabase/tests/brand_store_snapshots_test.sql against a real database.

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))

const rpc = jest.fn()
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ rpc }),
}))

import { GET } from '../route'

type RpcResult = { data: unknown; error: { message: string } | null }

function request(token = 'test-secret') {
  return {
    headers: { get: (k: string) => (k === 'authorization' ? `Bearer ${token}` : null) },
  } as unknown as Parameters<typeof GET>[0]
}

describe('GET /api/cron/snapshot-brand-stores', () => {
  const env = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...env,
      CRON_SECRET: 'test-secret',
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    }
    rpc.mockResolvedValue({ data: 12, error: null } satisfies RpcResult)
  })

  afterEach(() => {
    process.env = env
    jest.useRealTimers()
  })

  it('rejects a request without the cron secret', async () => {
    const res = await GET(request('wrong-secret'))
    expect(res.status).toBe(401)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('refuses to run when service credentials are missing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const res = await GET(request())
    expect(res.status).toBe(500)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('snapshots the previous month before the current one', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-14T03:00:00Z'))

    const res = await GET(request())

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true })
    expect(rpc.mock.calls).toEqual([
      ['snapshot_brand_stores', { p_month: '2026-08-01' }],
      ['snapshot_brand_stores', { p_month: '2026-09-01' }],
    ])
  })

  // A run on 1 January must reach back into the previous year, not month -1 of this one.
  it('crosses a year boundary correctly', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2027-01-01T03:00:00Z'))

    await GET(request())

    expect(rpc.mock.calls[0]).toEqual(['snapshot_brand_stores', { p_month: '2026-12-01' }])
    expect(rpc.mock.calls[1]).toEqual(['snapshot_brand_stores', { p_month: '2027-01-01' }])
  })

  // Late on the last day of a month in British Summer Time, UTC and local time disagree
  // about which month it is. The snapshot key has to match the database's UTC view.
  it('uses UTC to decide the month', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-31T23:30:00Z'))

    await GET(request())

    expect(rpc.mock.calls[1]).toEqual(['snapshot_brand_stores', { p_month: '2026-07-01' }])
  })

  it('reports a failed month without abandoning the other', async () => {
    rpc
      .mockResolvedValueOnce({ data: null, error: { message: 'deadlock detected' } })
      .mockResolvedValueOnce({ data: 12, error: null })
    jest.spyOn(console, 'error').mockImplementation(() => {})

    const res = await GET(request())

    // One month landed, so this is a partial success, not a 500 — the next daily run
    // will overwrite the month that failed.
    expect(res.status).toBe(200)
    const body = (await res.json()) as { success: boolean; results: { status: string }[] }
    expect(body.success).toBe(false)
    expect(body.results.map((r) => r.status)).toEqual(['failed', 'ok'])
    expect(rpc).toHaveBeenCalledTimes(2)
  })

  it('returns 500 when every month fails', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'connection refused' } })
    jest.spyOn(console, 'error').mockImplementation(() => {})

    const res = await GET(request())

    expect(res.status).toBe(500)
  })
})
