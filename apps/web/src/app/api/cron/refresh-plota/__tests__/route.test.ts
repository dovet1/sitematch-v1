jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))

const runPlotaRefresh = jest.fn()
jest.mock('@/lib/planning-intelligence/ingest', () => ({
  runPlotaRefresh: (...args: unknown[]) => runPlotaRefresh(...args),
}))
jest.mock('@/lib/planning-intelligence/db', () => ({
  createPlanningAdminClient: () => ({}),
}))

import { GET } from '../route'

function request(token = 'test-secret', search = '') {
  return {
    headers: { get: (key: string) => key === 'authorization' ? `Bearer ${token}` : null },
    nextUrl: new URL(`https://example.test/api/cron/refresh-plota${search}`),
  } as unknown as Parameters<typeof GET>[0]
}

describe('GET /api/cron/refresh-plota', () => {
  const originalEnv = process.env
  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      CRON_SECRET: 'test-secret',
      PLOTA_API_KEY: 'demo-key',
      PLOTA_SYNC_ENABLED: 'false',
    }
  })
  afterEach(() => { process.env = originalEnv })

  it('authenticates before checking configuration', async () => {
    const response = await GET(request('wrong'))
    expect(response.status).toBe(401)
    expect(runPlotaRefresh).not.toHaveBeenCalled()
  })

  it('cannot spend the Plota allowance while the kill switch is off', async () => {
    const response = await GET(request())
    expect(response.status).toBe(503)
    expect(runPlotaRefresh).not.toHaveBeenCalled()
  })

  it('re-checks three cohorts by default, under the same page limits as discovery', async () => {
    process.env.PLOTA_SYNC_ENABLED = 'true'
    runPlotaRefresh.mockResolvedValue({ cycleKey: '2026-09-10', cohorts: [], skipped: [] })
    const response = await GET(request())
    expect(response.status).toBe(200)
    expect(runPlotaRefresh).toHaveBeenCalledWith(expect.objectContaining({
      scope: 'reduced', cohortLimit: 3, pageSize: 10, maxPages: 1,
    }))
  })

  it('takes a cohort count from the request, bounded so one run cannot walk the whole store', async () => {
    process.env.PLOTA_SYNC_ENABLED = 'true'
    runPlotaRefresh.mockResolvedValue({ cycleKey: '2026-09-10', cohorts: [], skipped: [] })
    await GET(request('test-secret', '?cohorts=500'))
    expect(runPlotaRefresh).toHaveBeenCalledWith(expect.objectContaining({ cohortLimit: 24 }))
  })

  it('reports a failure rather than a silent success', async () => {
    process.env.PLOTA_SYNC_ENABLED = 'true'
    runPlotaRefresh.mockRejectedValue(new Error('Plota is unreachable'))
    const response = await GET(request())
    expect(response.status).toBe(500)
    expect((await response.json() as { success: boolean }).success).toBe(false)
  })
})
