/**
 * The review handler's job is no longer "write some columns" but "decide what a human's
 * verdict means for money already committed". These tests pin the reconciliation rules,
 * because every one of them is a spending decision and none is obvious from the code.
 *
 * The handler delegates the whole review to `apply_planning_review`, so what is asserted here
 * is that it delegates correctly and passes reviewer identity through. The SQL rules
 * themselves are documented in 20260925000000_transactional_planning_review.sql and are
 * exercised against a real database, not mocked here.
 */
// next/server pulls in a Request implementation jsdom does not provide, so it is stubbed
// exactly as the cron route tests do.
jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))

const mockRequireAdminUser = jest.fn()
const mockRpc = jest.fn()

jest.mock('@/lib/admin-auth', () => ({
  requireAdminUser: () => mockRequireAdminUser(),
  adminClient: () => ({ rpc: (...args: unknown[]) => mockRpc(...args) }),
  adminError: (context: string) => ({ status: 500, json: async () => ({ error: context }) }),
}))

import { PATCH } from '../route'

const asRequest = (body: unknown) => ({ json: async () => body }) as never
const DEVELOPMENT = '11111111-1111-4111-8111-111111111111'

describe('planning review reconciliation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireAdminUser.mockResolvedValue({ user: { id: 'reviewer-7', role: 'admin' } })
    mockRpc.mockResolvedValue({ data: { research_state: 'not_eligible' }, error: null })
  })

  it('refuses anyone who is not an admin', async () => {
    mockRequireAdminUser.mockResolvedValue({ error: { status: 403 } })
    const response = await PATCH(asRequest({ developmentId: DEVELOPMENT, decision: 'approved' }))
    expect(response).toEqual({ status: 403 })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('applies the whole review in a single call, so it cannot half-succeed', async () => {
    await PATCH(asRequest({
      developmentId: DEVELOPMENT, decision: 'corrected', relevance: 'low',
      brandSignals: [{ id: '22222222-2222-4222-8222-222222222222', reviewState: 'rejected' }],
    }))
    expect(mockRpc).toHaveBeenCalledTimes(1)
    expect(mockRpc).toHaveBeenCalledWith('apply_planning_review', expect.objectContaining({
      p_development_id: DEVELOPMENT,
      p_decision: 'corrected',
      p_relevance: 'low',
    }))
  })

  // Without this the audit trail cannot say who disagreed with the model, which is most of
  // the value of collecting corrections at all.
  it('records which reviewer made the call', async () => {
    await PATCH(asRequest({ developmentId: DEVELOPMENT, decision: 'rejected' }))
    expect(mockRpc.mock.calls[0][1]).toMatchObject({ p_reviewer_id: 'reviewer-7' })
  })

  it('passes an absent relevance as null rather than omitting it', async () => {
    await PATCH(asRequest({ developmentId: DEVELOPMENT, decision: 'approved' }))
    expect(mockRpc.mock.calls[0][1]).toMatchObject({ p_relevance: null, p_summary: null })
  })

  // A correction that leaves research already in flight has NOT stopped the spend, and a
  // reviewer needs to be told that rather than left assuming it did.
  it('reports back what happened to the research queue', async () => {
    mockRpc.mockResolvedValue({
      data: { research_state: 'processing', research_state_before: 'processing', escalate_for_research: false },
      error: null,
    })
    const response = await PATCH(asRequest({ developmentId: DEVELOPMENT, decision: 'corrected', relevance: 'low' }))
    await expect(response.json()).resolves.toMatchObject({
      success: true, research_state: 'processing', escalate_for_research: false,
    })
  })

  it('surfaces a failure instead of reporting success', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('locked') })
    const response = await PATCH(asRequest({ developmentId: DEVELOPMENT, decision: 'approved' }))
    expect(response.status).toBe(500)
  })

  it('rejects a malformed review before touching the database', async () => {
    const response = await PATCH(asRequest({ developmentId: 'not-a-uuid', decision: 'approved' }))
    expect(response.status).toBe(400)
    expect(mockRpc).not.toHaveBeenCalled()
  })
})
