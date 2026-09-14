jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))

const runPlotaLaneDiscovery = jest.fn()
jest.mock('@/lib/planning-intelligence/ingest', () => ({
  runPlotaLaneDiscovery: (...args: unknown[]) => runPlotaLaneDiscovery(...args),
}))
jest.mock('@/lib/planning-intelligence/db', () => ({
  createPlanningAdminClient: () => ({}),
}))

import { GET } from '../route'

function request(token = 'test-secret') {
  return {
    headers: { get: (key: string) => key === 'authorization' ? `Bearer ${token}` : null },
    nextUrl: new URL('https://example.test/api/cron/sync-plota-deep'),
  } as unknown as Parameters<typeof GET>[0]
}

describe('GET /api/cron/sync-plota-deep', () => {
  const originalEnv = process.env
  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv, CRON_SECRET: 'test-secret', PLOTA_API_KEY: 'starter-key', PLOTA_SYNC_ENABLED: 'true' }
  })
  afterEach(() => {
    process.env = originalEnv
    jest.useRealTimers()
  })

  it('authenticates before spending anything', async () => {
    expect((await GET(request('wrong'))).status).toBe(401)
    expect(runPlotaLaneDiscovery).not.toHaveBeenCalled()
  })

  it('reads the deep lane from the live-only floor while the year still predates it', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-13T07:00:00Z'))
    runPlotaLaneDiscovery.mockResolvedValue({ runId: 'run-1', status: 'partial' })
    expect((await GET(request())).status).toBe(200)
    expect(runPlotaLaneDiscovery).toHaveBeenCalledWith('deep', expect.objectContaining({
      dateFrom: '2026-01-01', dateTo: '2026-05-16',
    }))
  })

  it('skips without spending when the whole window predates the floor', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-01T07:00:00Z'))
    const response = await GET(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ success: true, lane: 'deep', skipped: expect.any(String) })
    expect(runPlotaLaneDiscovery).not.toHaveBeenCalled()
  })
})
