jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))

const runPlotaSync = jest.fn()
const createPlanningAdminClient = jest.fn(() => ({}))
jest.mock('@/lib/planning-intelligence/ingest', () => ({
  runPlotaSync: (...args: unknown[]) => runPlotaSync(...args),
}))
jest.mock('@/lib/planning-intelligence/db', () => ({
  createPlanningAdminClient: () => createPlanningAdminClient(),
}))

import { GET } from '../route'

function request(token = 'test-secret', search = '') {
  return {
    headers: { get: (key: string) => key === 'authorization' ? `Bearer ${token}` : null },
    nextUrl: new URL(`https://example.test/api/cron/sync-plota${search}`),
  } as unknown as Parameters<typeof GET>[0]
}

describe('GET /api/cron/sync-plota', () => {
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
    expect(runPlotaSync).not.toHaveBeenCalled()
  })

  it('cannot spend the Plota allowance while the kill switch is off', async () => {
    const response = await GET(request())
    expect(response.status).toBe(503)
    expect(runPlotaSync).not.toHaveBeenCalled()
  })

  it('defaults a Demo run to one page of ten and reduced scope', async () => {
    process.env.PLOTA_SYNC_ENABLED = 'true'
    runPlotaSync.mockResolvedValue({ runId: 'run-1', status: 'partial' })
    const response = await GET(request('test-secret', '?date_from=2026-09-01&date_to=2026-09-02'))
    expect(response.status).toBe(200)
    expect(runPlotaSync).toHaveBeenCalledWith(expect.objectContaining({
      scope: 'reduced', pageSize: 10, maxPages: 1,
      dateFrom: '2026-09-01', dateTo: '2026-09-02',
    }))
  })

  it('refuses to claim a complete reduced-census archive backfill', async () => {
    process.env.PLOTA_SYNC_ENABLED = 'true'
    const response = await GET(request(
      'test-secret', '?kind=backfill&date_from=2025-11-01&date_to=2025-11-30'
    ))
    expect(response.status).toBe(409)
    expect(runPlotaSync).not.toHaveBeenCalled()
  })
})
