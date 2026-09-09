const mockClassifyWithOpenRouter = jest.fn()
jest.mock('../openrouter', () => {
  const actual = jest.requireActual('../openrouter')
  return { ...actual, classifyWithOpenRouter: (...args: unknown[]) => mockClassifyWithOpenRouter(...args) }
})

import { DEFAULT_CLASSIFICATION_RESERVATION_USD } from '../budget'
import {
  CLASSIFICATION_ITEM_TIMEOUT_MS,
  CLASSIFICATION_LEASE_MS,
  classifyPlanningBatch,
} from '../classify'

type Result = { data: unknown; error: unknown }
type Write = { table: string; op: string; payload: unknown }

class Builder implements PromiseLike<Result> {
  private op = ''
  constructor(private table: string, private writes: Write[]) {}
  select() { if (!this.op) this.op = 'select'; return this }
  insert(payload: unknown) { this.op = 'insert'; this.writes.push({ table: this.table, op: this.op, payload }); return this }
  upsert(payload: unknown) { this.op = 'upsert'; this.writes.push({ table: this.table, op: this.op, payload }); return this }
  update(payload: unknown) { this.op = 'update'; this.writes.push({ table: this.table, op: this.op, payload }); return this }
  delete() { this.op = 'delete'; return this }
  eq() { return this }
  single() { return this }
  then<A, B>(
    onfulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null
  ): PromiseLike<A | B> {
    let result: Result = { data: null, error: null }
    if (this.table === 'development_applications' && this.op === 'select') {
      result = { data: { development_id: 'development-1' }, error: null }
    } else if (this.table === 'planning_classification_runs' && this.op === 'upsert') {
      result = { data: { id: 'run-1', status: 'running' }, error: null }
    }
    return Promise.resolve(result).then(onfulfilled, onrejected)
  }
}

function application(state: string, startedAt: string | null = null) {
  return {
    id: `${state}-application`, provider_id: `${state}-provider`, input_hash: `${state}-hash`,
    state, startedAt,
    raw: {
      id: `${state}-provider`, reference: `${state}-reference`,
      authority: { slug: 'test', name: 'Test Council' },
      description: 'Construction of a new foodstore', stage: 'pending',
    },
  }
}

function makeDb(candidates: ReturnType<typeof application>[]) {
  const writes: Write[] = []
  const claimed = new Set<string>()
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = []
  const db = {
    from: (table: string) => new Builder(table, writes),
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args })
      if (name === 'reserve_planning_ai_usage') return { data: 'usage-1', error: null }
      const staleBefore = Date.parse(String(args.p_stale_before))
      const candidate = candidates.find((row) => {
        if (claimed.has(row.id)) return false
        if (['queued', 'failed', 'deferred_budget'].includes(row.state)) return true
        return row.state === 'processing' && (
          row.startedAt === null || Date.parse(row.startedAt) < staleBefore
        )
      })
      if (!candidate) return { data: null, error: null }
      claimed.add(candidate.id)
      return {
        data: {
          id: candidate.id,
          provider_id: candidate.provider_id,
          input_hash: candidate.input_hash,
          raw: candidate.raw,
          reclaimed: candidate.state === 'processing',
        },
        error: null,
      }
    },
  }
  return { db: db as never, writes, rpcCalls }
}

const result = {
  classification: {
    relevance: 'high', confidence: 0.9, substantiveProposal: 'A new foodstore is proposed.',
    commercialSpace: { creates: 'yes', useClasses: ['E(a)'], evidence: 'new foodstore', confidence: 0.9 },
    dwellings: { count: 0, basis: 'stated', evidence: 'foodstore', confidence: 0.9 },
    brandMentions: [], observations: [], reasons: [], uncertainties: [], unansweredQuestions: [],
  },
  model: 'openai/gpt-oss-120b', inputTokens: 100, outputTokens: 50, costUsd: 0.0004,
}

describe('classification worker leases', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockClassifyWithOpenRouter.mockResolvedValue(result)
  })

  it.each(['queued', 'failed', 'deferred_budget'])('still processes a %s record', async (state) => {
    const { db } = makeDb([application(state)])
    const batch = await classifyPlanningBatch({ db, apiKey: 'key', limit: 1 })
    expect(batch).toEqual({ considered: 1, classified: 1, failed: 0, deferredBudget: 0 })
  })

  it('picks up a processing record whose lease is stale', async () => {
    const stale = new Date(Date.now() - CLASSIFICATION_LEASE_MS - 1_000).toISOString()
    const { db } = makeDb([application('processing', stale)])
    const batch = await classifyPlanningBatch({ db, apiKey: 'key', limit: 1 })
    expect(batch.classified).toBe(1)
    expect(mockClassifyWithOpenRouter).toHaveBeenCalledTimes(1)
  })

  it('leaves a processing record with a fresh lease alone', async () => {
    const fresh = new Date().toISOString()
    const { db } = makeDb([application('processing', fresh)])
    const batch = await classifyPlanningBatch({ db, apiKey: 'key', limit: 1 })
    expect(batch.considered).toBe(0)
    expect(mockClassifyWithOpenRouter).not.toHaveBeenCalled()
  })

  it('passes a bounded signal and keeps the lease beyond the worst-case call', async () => {
    const { db } = makeDb([application('queued')])
    await classifyPlanningBatch({ db, apiKey: 'key', limit: 1 })
    expect(CLASSIFICATION_LEASE_MS).toBeGreaterThan(CLASSIFICATION_ITEM_TIMEOUT_MS)
    expect(mockClassifyWithOpenRouter).toHaveBeenCalledWith(
      expect.anything(), expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('settles the run and usage reservation when the model call times out', async () => {
    const timeout = new Error('OpenRouter classification request timed out')
    timeout.name = 'TimeoutError'
    mockClassifyWithOpenRouter.mockRejectedValue(timeout)
    const { db, writes } = makeDb([application('queued')])

    const batch = await classifyPlanningBatch({ db, apiKey: 'key', limit: 1 })

    expect(batch.failed).toBe(1)
    expect(writes).toContainEqual(expect.objectContaining({
      table: 'planning_classification_runs', op: 'update',
      payload: expect.objectContaining({ status: 'failed', finished_at: expect.any(String) }),
    }))
    // Charged at the configured reservation, whatever it is, rather than a hardcoded figure:
    // the constant tracks the model in use and changed when the default model did.
    expect(writes).toContainEqual({
      table: 'planning_ai_usage', op: 'update',
      payload: { status: 'complete', actual_usd: DEFAULT_CLASSIFICATION_RESERVATION_USD },
    })
    expect(writes).toContainEqual({
      table: 'planning_applications', op: 'update',
      payload: { classification_state: 'failed', classification_started_at: null },
    })
  })
})
