jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))

const runPlotaLaneDiscovery = jest.fn()
const runPlotaDiscovery = jest.fn()
jest.mock('@/lib/planning-intelligence/ingest', () => ({
  runPlotaLaneDiscovery: (...args: unknown[]) => runPlotaLaneDiscovery(...args),
  runPlotaDiscovery: (...args: unknown[]) => runPlotaDiscovery(...args),
}))
jest.mock('@/lib/planning-intelligence/db', () => ({
  createPlanningAdminClient: () => ({}),
}))

import { GET } from '../route'

function request(token = 'test-secret') {
  return {
    headers: { get: (key: string) => key === 'authorization' ? `Bearer ${token}` : null },
    nextUrl: new URL('https://example.test/api/cron/sync-plota-late'),
  } as unknown as Parameters<typeof GET>[0]
}

describe('GET /api/cron/sync-plota-late', () => {
  const originalEnv = process.env
  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      CRON_SECRET: 'test-secret',
      PLOTA_API_KEY: 'starter-key',
      PLOTA_SYNC_ENABLED: 'true',
      PLOTA_MAX_PAGES_PER_RUN: '20',
      PLOTA_PAGE_SIZE: '50',
    }
  })
  afterEach(() => {
    process.env = originalEnv
    jest.useRealTimers()
  })

  it('authenticates before spending anything', async () => {
    expect((await GET(request('wrong'))).status).toBe(401)
    expect(runPlotaLaneDiscovery).not.toHaveBeenCalled()
  })

  it('cannot spend the Plota allowance while the kill switch is off', async () => {
    process.env.PLOTA_SYNC_ENABLED = 'false'
    expect((await GET(request())).status).toBe(503)
    expect(runPlotaLaneDiscovery).not.toHaveBeenCalled()
  })

  it('re-reads receipt dates from one to seventeen weeks ago, never main discovery', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-13T07:00:00Z'))
    runPlotaLaneDiscovery.mockResolvedValue({ runId: 'run-1', status: 'partial' })
    expect((await GET(request())).status).toBe(200)
    expect(runPlotaLaneDiscovery).toHaveBeenCalledWith('late', expect.objectContaining({
      dateFrom: '2026-05-16', dateTo: '2026-09-06', pageSize: 50, maxPages: 20,
    }))
    expect(runPlotaDiscovery).not.toHaveBeenCalled()
  })

  it('reports a failed run as an error rather than success', async () => {
    runPlotaLaneDiscovery.mockRejectedValue(new Error('Plota request failed (502)'))
    const response = await GET(request())
    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({ success: false, lane: 'late', error: 'Plota request failed (502)' })
  })
})
