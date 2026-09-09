jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))

const classifyPlanningBatch = jest.fn()
jest.mock('@/lib/planning-intelligence/classify', () => ({
  classifyPlanningBatch: (...args: unknown[]) => classifyPlanningBatch(...args),
}))
jest.mock('@/lib/planning-intelligence/db', () => ({ createPlanningAdminClient: () => ({}) }))

import { GET } from '../route'

function request(token = 'test-secret', search = '') {
  return {
    headers: { get: (key: string) => key === 'authorization' ? `Bearer ${token}` : null },
    nextUrl: new URL(`https://example.test/api/cron/classify-planning${search}`),
  } as unknown as Parameters<typeof GET>[0]
}

describe('GET /api/cron/classify-planning', () => {
  const originalEnv = process.env
  beforeEach(() => {
    jest.clearAllMocks()
    process.env = {
      ...originalEnv,
      CRON_SECRET: 'test-secret',
      OPENROUTER_API_KEY: 'openrouter-key',
      PLANNING_CLASSIFICATION_ENABLED: 'false',
    }
  })
  afterEach(() => { process.env = originalEnv })

  it('cannot spend OpenRouter credit while the kill switch is off', async () => {
    const response = await GET(request())
    expect(response.status).toBe(503)
    expect(classifyPlanningBatch).not.toHaveBeenCalled()
  })

  it('passes a bounded batch to the worker when enabled', async () => {
    process.env.PLANNING_CLASSIFICATION_ENABLED = 'true'
    classifyPlanningBatch.mockResolvedValue({ considered: 2, classified: 2, failed: 0, deferredBudget: 0 })
    const response = await GET(request('test-secret', '?limit=2'))
    expect(response.status).toBe(200)
    expect(classifyPlanningBatch).toHaveBeenCalledWith(expect.objectContaining({ limit: 2 }))
  })
})

