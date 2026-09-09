import { CLASSIFICATION_ATTEMPT_TIMEOUT_MS, classifyWithOpenRouter } from '../openrouter'

const validClassification = {
  relevance: 'high',
  confidence: 0.8,
  substantiveProposal: 'A new foodstore',
  commercialSpace: {
    creates: 'yes',
    useClasses: ['E(a)'],
    evidence: 'construction of a new foodstore',
    confidence: 0.9,
  },
  dwellings: { count: null, basis: 'not_stated', evidence: '', confidence: 0.9 },
  brandMentions: [],
  observations: [],
  reasons: ['Creates commercial space'],
  uncertainties: [],
  unansweredQuestions: ['Who will occupy it?'],
}

describe('classifyWithOpenRouter', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('requests strict structured output and records reported cost', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        model: 'openai/gpt-oss-120b',
        choices: [{ message: { content: JSON.stringify(validClassification) } }],
        usage: { prompt_tokens: 300, completion_tokens: 80, cost: 0.00003 },
      }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const result = await classifyWithOpenRouter({
      id: 'p1', reference: 'R1', authority: { slug: 'x', name: 'X' },
      description: 'Construction of a new foodstore',
    }, { apiKey: 'openrouter-secret' })

    const init = fetchMock.mock.calls[0][1]
    const request = JSON.parse(String(init?.body))
    expect(request.response_format.json_schema.strict).toBe(true)
    expect(request.messages[0].content).toContain('untrusted data')
    expect(result.costUsd).toBe(0.00003)
    expect(result.classification.relevance).toBe('high')
  })

  it('rejects a structurally invalid model answer', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ ...validClassification, relevance: 'urgent' }) } }],
      }),
    }) as unknown as typeof fetch

    await expect(classifyWithOpenRouter({
      id: 'p1', reference: 'R1', authority: { slug: 'x', name: 'X' },
    }, { apiKey: 'openrouter-secret' })).rejects.toThrow()
  })
})

describe('schema-compliance retries', () => {
  const originalFetch = global.fetch
  afterEach(() => { global.fetch = originalFetch })

  const application = {
    id: 'p1', reference: 'R1', authority: { slug: 'x', name: 'X' },
    description: 'Construction of a new foodstore',
  } as never

  const reply = (content: unknown, cost = 0.0002) => ({
    ok: true, status: 200,
    json: async () => ({
      model: 'openai/gpt-oss-120b',
      choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) } }],
      usage: { prompt_tokens: 300, completion_tokens: 80, cost },
    }),
  })

  // The exact shape the live model invented instead of obeying strict: true.
  const offSchema = { applicationType: 'Change of Use', proposedUse: 'Residential' }

  it('recovers when the first reply ignores the schema', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(reply(offSchema))
      .mockResolvedValueOnce(reply(validClassification))
    global.fetch = fetchMock as unknown as typeof fetch

    const result = await classifyWithOpenRouter(application, { apiKey: 'k' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.classification.relevance).toBe('high')
  })

  it('bills every attempt, not just the successful one', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(reply(offSchema, 0.0002))
      .mockResolvedValueOnce(reply(validClassification, 0.0003))
    global.fetch = fetchMock as unknown as typeof fetch

    const result = await classifyWithOpenRouter(application, { apiKey: 'k' })
    expect(result.costUsd).toBeCloseTo(0.0005, 10)
  })

  it('tells the model what went wrong only on a retry', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(reply(offSchema))
      .mockResolvedValueOnce(reply(validClassification))
    global.fetch = fetchMock as unknown as typeof fetch

    await classifyWithOpenRouter(application, { apiKey: 'k' })
    const first = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body)
    const second = JSON.parse((fetchMock.mock.calls[1][1] as { body: string }).body)
    expect(first.messages.some((m: { content: string }) => m.content.includes('did not match'))).toBe(false)
    expect(second.messages.some((m: { content: string }) => m.content.includes('did not match'))).toBe(true)
  })

  it('retries unparseable content as well as off-schema content', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(reply('{ this is not json'))
      .mockResolvedValueOnce(reply(validClassification))
    global.fetch = fetchMock as unknown as typeof fetch

    await expect(classifyWithOpenRouter(application, { apiKey: 'k' })).resolves.toBeDefined()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('gives up after three attempts rather than looping', async () => {
    const fetchMock = jest.fn().mockResolvedValue(reply(offSchema))
    global.fetch = fetchMock as unknown as typeof fetch

    await expect(classifyWithOpenRouter(application, { apiKey: 'k' }))
      .rejects.toThrow(/after 3 attempts/)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('does not retry a provider error, which would only repeat', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false, status: 429,
      json: async () => ({ error: { message: 'rate limited' } }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    await expect(classifyWithOpenRouter(application, { apiKey: 'k' })).rejects.toThrow('rate limited')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('adds a transport deadline to every provider attempt', async () => {
    const fetchMock = jest.fn().mockResolvedValue(reply(validClassification))
    global.fetch = fetchMock as unknown as typeof fetch

    await classifyWithOpenRouter(application, { apiKey: 'k' })
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal).toBeInstanceOf(AbortSignal)
    expect(CLASSIFICATION_ATTEMPT_TIMEOUT_MS).toBe(60_000)
  })
})
