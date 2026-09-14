const mockCollectSources = jest.fn()
const mockResearchOperator = jest.fn()
jest.mock('../research-sources', () => ({
  collectCouncilResearchSources: (...args: unknown[]) => mockCollectSources(...args),
}))
jest.mock('../research-openrouter', () => {
  const actual = jest.requireActual('../research-openrouter')
  return { ...actual, researchOperatorWithOpenRouter: (...args: unknown[]) => mockResearchOperator(...args) }
})

import { researchPlanningBatch } from '../research'

type Result = { data: unknown; error: unknown }
type Write = { table: string; op: string; payload: unknown }

class Builder implements PromiseLike<Result> {
  private op = ''
  constructor(private table: string, private writes: Write[]) {}
  select() { if (!this.op) this.op = 'select'; return this }
  insert(payload: unknown) { this.op = 'insert'; this.writes.push({ table: this.table, op: this.op, payload }); return this }
  upsert(payload: unknown) { this.op = 'upsert'; this.writes.push({ table: this.table, op: this.op, payload }); return this }
  update(payload: unknown) { this.op = 'update'; this.writes.push({ table: this.table, op: this.op, payload }); return this }
  delete() { this.op = 'delete'; this.writes.push({ table: this.table, op: this.op, payload: null }); return this }
  eq() { return this }
  in() { return this }
  not() { return this }
  single() { return this }
  then<A, B>(
    onfulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null
  ): PromiseLike<A | B> {
    const result = this.table === 'planning_classification_runs' && this.op === 'upsert'
      ? { data: { id: 'research-run-1' }, error: null }
      : { data: null, error: null }
    return Promise.resolve(result).then(onfulfilled, onrejected)
  }
}

function row(id: string, escalated = true) {
  return {
    development_id: `development-${id}`, planning_application_id: `application-${id}`,
    input_hash: `hash-${id}`, escalated,
    raw: {
      id: id, reference: `REF-${id}`, authority: { slug: 'test', name: 'Test Council' },
      description: 'Change of use to a gymnasium', stage: 'pending',
      links: { council: `https://council.test/${id}` },
    },
  }
}

function makeDb(rows: Array<ReturnType<typeof row> & { attempt?: number; attempt_limit?: number }>, refuseReservation = false) {
  const writes: Write[] = []
  let queueIndex = 0
  const rpcCalls: string[] = []
  const rpcArgs: Array<{ name: string; args: Record<string, unknown> }> = []
  const db = {
    from: (table: string) => new Builder(table, writes),
    rpc: async (name: string, args: Record<string, unknown> = {}) => {
      rpcCalls.push(name)
      rpcArgs.push({ name, args })
      if (name === 'reserve_planning_ai_usage') {
        return { data: refuseReservation ? null : 'usage-1', error: null }
      }
      if (name !== 'claim_next_planning_research') return { data: 1, error: null }
      while (queueIndex < rows.length) {
        const candidate = rows[queueIndex++]
        if (candidate.escalated) return { data: candidate, error: null }
      }
      return { data: null, error: null }
    },
  }
  return { db: db as never, writes, rpcCalls, rpcArgs }
}

describe('planning research batch', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCollectSources.mockResolvedValue({
      sources: [{ kind: 'council_page', url: 'https://council.test/1', text: 'Planning evidence' }],
      warnings: [],
    })
    mockResearchOperator.mockResolvedValue({
      signals: [], commercialFloorspace: [], useClasses: [],
      noOperatorReason: 'No proposed operator is explicitly named.',
      researchMemo: '', webCitations: [], webSearchRequests: 1,
      model: 'openai/gpt-5.2', inputTokens: 500, outputTokens: 100, costUsd: 0.01,
    })
  })

  it('processes only developments selected by the escalated research queue', async () => {
    const { db } = makeDb([row('not-escalated', false), row('escalated')])
    const result = await researchPlanningBatch({ db, apiKey: 'key', limit: 2 })
    expect(result.considered).toBe(1)
    expect(mockResearchOperator).toHaveBeenCalledTimes(1)
    expect(mockResearchOperator.mock.calls[0][0].application.id).toBe('escalated')
  })

  it('stops the batch at the first budget refusal', async () => {
    const { db, rpcCalls } = makeDb([row('1'), row('2'), row('3')], true)
    const result = await researchPlanningBatch({ db, apiKey: 'key', limit: 3 })
    expect(result).toEqual({
      considered: 1, researched: 0, failed: 0, deferredBudget: 1,
      operatorsFound: 0, commercialFactsFound: 0,
    })
    expect(rpcCalls.filter((name) => name === 'claim_next_planning_research')).toHaveLength(1)
    expect(mockResearchOperator).not.toHaveBeenCalled()
  })

  it('records a grounded no-operator result without inserting a brand row', async () => {
    const { db, writes } = makeDb([row('1')])
    const result = await researchPlanningBatch({ db, apiKey: 'key', limit: 1 })
    expect(result.researched).toBe(1)
    expect(result.operatorsFound).toBe(0)
    expect(writes.some((write) => write.table === 'development_brand_signals' && write.op === 'insert'))
      .toBe(false)
    expect(writes).toContainEqual(expect.objectContaining({
      table: 'developments', op: 'update',
      payload: expect.objectContaining({ research_state: 'complete' }),
    }))
  })

  it('writes found operators as pending research evidence', async () => {
    mockResearchOperator.mockResolvedValue({
      signals: [{
        name: 'Example Gym', role: 'proposed_operator', evidenceSource: 'document',
        evidenceUrl: 'https://council.test/operator.pdf',
        evidenceExcerpt: 'Example Gym will operate the proposed gymnasium', confidence: 0.96,
      }],
      commercialFloorspace: [], useClasses: [], noOperatorReason: '',
      researchMemo: '', webCitations: [], webSearchRequests: 1,
      model: 'openai/gpt-5.2', inputTokens: 500, outputTokens: 100, costUsd: 0.01,
    })
    const { db, writes } = makeDb([row('1')])
    const result = await researchPlanningBatch({ db, apiKey: 'key', limit: 1 })
    expect(result.operatorsFound).toBe(1)
    expect(writes).toContainEqual(expect.objectContaining({
      table: 'development_brand_signals', op: 'insert',
      payload: [expect.objectContaining({
        observed_name: 'Example Gym', evidence_source: 'document', review_state: 'pending',
      })],
    }))
  })

  it.each([
    { roles: ['applicant_developer'], developmentIds: ['one'], expected: 0 },
    { roles: ['proposed_occupier', 'proposed_operator', 'applicant_developer'], developmentIds: ['one'], expected: 1 },
    { roles: ['proposed_operator'], developmentIds: ['one', 'one'], expected: 1 },
    { roles: ['proposed_occupier'], developmentIds: ['one', 'two'], expected: 2 },
  ])('counts distinct developments with occupiers/operators: $roles, $developmentIds', async ({ roles, developmentIds, expected }) => {
    mockResearchOperator.mockResolvedValue({
      signals: roles.map((role, index) => ({
        name: `Business ${index}`, role, evidenceSource: 'document',
        evidenceUrl: 'https://council.test/operator.pdf',
        evidenceExcerpt: 'The proposed business is named in the application.', confidence: 0.96,
      })),
      commercialFloorspace: [], useClasses: [], noOperatorReason: '',
      researchMemo: '', webCitations: [], webSearchRequests: 1,
      model: 'openai/gpt-5.2', inputTokens: 500, outputTokens: 100, costUsd: 0.01,
    })
    const { db } = makeDb(developmentIds.map((developmentId, index) => ({
      ...row(String(index)), development_id: developmentId,
    })))
    const result = await researchPlanningBatch({ db, apiKey: 'key', limit: developmentIds.length })
    expect(result.researched).toBe(developmentIds.length)
    expect(result.operatorsFound).toBe(expected)
  })

  it('persists site area and applicant clues in the research run without creating operator signals', async () => {
    const siteAreas = [{ phase: 'unspecified', value: 0.25, unit: 'hectares' }]
    const partyClues = [{ name: 'Mr Test Person', role: 'applicant' }]
    mockResearchOperator.mockResolvedValue({
      signals: [], commercialFloorspace: [], useClasses: [], siteAreas, partyClues,
      researchWarnings: ['Empty web memo; finish_reason=length'],
      noOperatorReason: 'No operator named', researchMemo: '', webCitations: [], webSearchRequests: 1,
      model: 'openai/gpt-5.2', inputTokens: 500, outputTokens: 100, costUsd: 0.01,
    })
    const { db, writes } = makeDb([row('1')])
    const result = await researchPlanningBatch({ db, apiKey: 'key', limit: 1 })
    expect(result.operatorsFound).toBe(0)
    expect(writes).toContainEqual(expect.objectContaining({ table: 'planning_classification_runs', op: 'update',
      payload: expect.objectContaining({ output: expect.objectContaining({ siteAreas, partyClues,
        researchWarnings: ['Empty web memo; finish_reason=length'] }) }),
    }))
  })

  it('stores grounded floor area and directional use classes without touching initial rows', async () => {
    mockResearchOperator.mockResolvedValue({
      signals: [], noOperatorReason: 'No operator named.',
      commercialFloorspace: [{
        scope: 'existing', sqm: 1409, measurementBasis: 'gross_internal',
        evidenceSource: 'document', evidenceUrl: 'https://council.test/form.pdf',
        evidenceExcerpt: 'Existing gross internal floorspace (square metres): 1409',
        evidencePage: '10', confidence: 0.99,
      }],
      useClasses: [
        {
          phase: 'existing', useClass: 'B2', evidenceSource: 'council_page',
          evidenceUrl: 'https://council.test/1',
          evidenceExcerpt: 'Conversion of former B2 workshop to B8 use', evidencePage: null, confidence: 0.98,
        },
        {
          phase: 'proposed', useClass: 'B8', evidenceSource: 'council_page',
          evidenceUrl: 'https://council.test/1',
          evidenceExcerpt: 'Conversion of former B2 workshop to B8 use', evidencePage: null, confidence: 0.98,
        },
      ],
      researchMemo: '', webCitations: [], webSearchRequests: 1,
      model: 'openai/gpt-5.2', inputTokens: 500, outputTokens: 100, costUsd: 0.02,
    })
    const { db, writes } = makeDb([row('1')])
    const result = await researchPlanningBatch({ db, apiKey: 'key', limit: 1 })

    expect(result.commercialFactsFound).toBe(3)
    expect(writes).toContainEqual(expect.objectContaining({
      table: 'development_observations', op: 'insert',
      payload: [expect.objectContaining({
        scope: 'existing', value: 1409, unit: 'sqm', measurement_basis: 'gross_internal',
        evidence_page: '10', review_state: 'pending',
      })],
    }))
    expect(writes).toContainEqual(expect.objectContaining({
      table: 'developments', op: 'update',
      payload: expect.objectContaining({
        existing_commercial_use_classes: ['B2'], proposed_commercial_use_classes: ['B8'],
      }),
    }))
  })

  it('settles the ledger row when research fails', async () => {
    mockResearchOperator.mockRejectedValue(new Error('provider timeout'))
    const { db, writes } = makeDb([row('1')])
    const result = await researchPlanningBatch({ db, apiKey: 'key', limit: 1 })
    expect(result.failed).toBe(1)
    expect(writes).toContainEqual({
      table: 'planning_ai_usage', op: 'update',
      payload: { status: 'complete', actual_usd: 0.2 },
    })
    expect(writes).toContainEqual({
      table: 'developments', op: 'update',
      payload: { research_state: 'failed', research_started_at: null },
    })
  })

  it('hands every unanswered fact to admin when the last attempt fails', async () => {
    mockResearchOperator.mockRejectedValue(new Error('provider timeout'))
    mockCollectSources.mockResolvedValue({ sources: [], warnings: ['Council page is disallowed by robots.txt'] })
    const { db, writes, rpcArgs } = makeDb([{ ...row('1'), attempt: 2, attempt_limit: 2 }])
    await researchPlanningBatch({ db, apiKey: 'key', limit: 1 })
    expect(writes).toContainEqual(expect.objectContaining({
      table: 'developments', op: 'update',
      payload: expect.objectContaining({ research_state: 'complete', research_outcome: 'attempt_limit' }),
    }))
    const recorded = rpcArgs.find(call => call.name === 'planning_record_development_facts')!
    const rows = recorded.args.p_rows as Array<{ fact: string; state: string; reason: string }>
    expect(rows).toHaveLength(7)
    expect(rows.every(fact => fact.state === 'not_found_after_research' && fact.reason === 'attempt_limit')).toBe(true)
  })

  it('names inaccessible documents as the reason when research finds nothing', async () => {
    mockCollectSources.mockResolvedValue({ sources: [], warnings: ['Council page is disallowed by robots.txt'] })
    const { db, writes, rpcArgs } = makeDb([row('1')])
    await researchPlanningBatch({ db, apiKey: 'key', limit: 1 })
    const rows = rpcArgs.find(call => call.name === 'planning_record_development_facts')!.args.p_rows as Array<{ reason: string }>
    expect(rows.every(fact => fact.reason === 'documents_inaccessible')).toBe(true)
    expect(writes).toContainEqual(expect.objectContaining({
      table: 'developments', op: 'update',
      payload: expect.objectContaining({ research_state: 'complete', research_outcome: 'facts_unresolved' }),
    }))
  })

  it('never deletes earlier research evidence or blanks use classes on an empty run', async () => {
    const { db, writes } = makeDb([row('1')])
    await researchPlanningBatch({ db, apiKey: 'key', limit: 1 })
    expect(writes.some(write => write.op === 'delete')).toBe(false)
    const update = writes.find(write => write.table === 'developments' && (write.payload as Record<string, unknown>)?.research_state === 'complete')!
    expect(update.payload).not.toHaveProperty('existing_commercial_use_classes')
    expect(update.payload).not.toHaveProperty('proposed_commercial_use_classes')
  })

  it('stops after a failure instead of paying to retry an immediately reclaimable item', async () => {
    mockResearchOperator.mockRejectedValue(new Error('OpenRouter returned no research memo'))
    const { db, rpcCalls } = makeDb([row('1'), row('1'), row('2')])
    const result = await researchPlanningBatch({ db, apiKey: 'key', limit: 3 })
    expect(result).toMatchObject({ considered: 1, failed: 1, researched: 0 })
    expect(mockResearchOperator).toHaveBeenCalledTimes(1)
    expect(rpcCalls.filter(name => name === 'claim_next_planning_research')).toHaveLength(1)
  })
})
