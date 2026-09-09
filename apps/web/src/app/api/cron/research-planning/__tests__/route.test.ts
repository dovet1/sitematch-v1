jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))

const researchPlanningBatch = jest.fn()
jest.mock('@/lib/planning-intelligence/research', () => ({
  researchPlanningBatch: (...args: unknown[]) => researchPlanningBatch(...args),
}))
jest.mock('@/lib/planning-intelligence/db', () => ({ createPlanningAdminClient: () => ({}) }))

import { GET } from '../route'

function request(token = 'test-secret', search = '') {
  return {
    headers: { get: (key: string) => key === 'authorization' ? `Bearer ${token}` : null },
    nextUrl: new URL(`https://example.test/api/cron/research-planning${search}`),
  } as unknown as Parameters<typeof GET>[0]
}

describe('GET /api/cron/research-planning', () => {
  const originalEnv = process.env
  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      CRON_SECRET: 'test-secret', OPENROUTER_API_KEY: 'openrouter-key',
      PLANNING_RESEARCH_ENABLED: 'false',
    }
  })
  afterEach(() => { process.env = originalEnv })

  it('cannot spend research credit while the kill switch is off', async () => {
    const response = await GET(request())
    expect(response.status).toBe(503)
    expect(researchPlanningBatch).not.toHaveBeenCalled()
  })

  it('requires the cron bearer token before checking the flag', async () => {
    const response = await GET(request('wrong'))
    expect(response.status).toBe(401)
  })

  it('passes the requested batch size when enabled', async () => {
    process.env.PLANNING_RESEARCH_ENABLED = 'true'
    researchPlanningBatch.mockResolvedValue({
      considered: 2, researched: 2, failed: 0, deferredBudget: 0, operatorsFound: 1,
    })
    const response = await GET(request('test-secret', '?limit=2'))
    expect(response.status).toBe(200)
    expect(researchPlanningBatch).toHaveBeenCalledWith(expect.objectContaining({ limit: 2 }))
  })
})

