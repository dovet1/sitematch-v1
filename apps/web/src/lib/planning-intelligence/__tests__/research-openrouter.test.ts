import { researchOperatorWithOpenRouter } from '../research-openrouter'

describe('OpenRouter planning research', () => {
  const originalFetch = global.fetch
  afterEach(() => { global.fetch = originalFetch })

  const application = {
    id: 'one', reference: 'REF/1', authority: { slug: 'test', name: 'Test Council' },
    address: '1 High Street', description: 'Change of use to a gymnasium',
    links: { council: 'https://council.test/application/1' },
  }
  const source = {
    kind: 'council_page' as const,
    url: 'https://council.test/application/1',
    text: 'The proposed gymnasium will be operated by Example Fitness Limited.',
  }

  function response(
    signals: unknown[], annotations: unknown[] = [],
    commercialFloorspace: unknown[] = [], useClasses: unknown[] = []
  ) {
    return {
      ok: true, status: 200,
      json: async () => ({
        model: 'openai/gpt-5.2',
        choices: [{ message: {
          content: JSON.stringify({ signals, commercialFloorspace, useClasses, noOperatorReason: '' }),
          annotations,
        } }],
        usage: {
          prompt_tokens: 600, completion_tokens: 100, cost: 0.012,
          server_tool_use: { web_search_requests: 1 },
        },
      }),
    }
  }

  it('retains site areas and private applicant clues separately from operator signals', async () => {
    const text = 'Existing site area 0.25 hectares. Proposed site area 3000 Sq. metres. Applicant Mr Test Person. Agent Example Planning Ltd.'
    const findings = {
      signals: [], commercialFloorspace: [], useClasses: [], noOperatorReason: 'No operator named',
      siteAreas: [
        { phase: 'existing', value: 0.25, unit: 'hectares', evidenceExcerpt: 'Existing site area 0.25 hectares' },
        { phase: 'proposed', value: 3000, unit: 'sqm', evidenceExcerpt: 'Proposed site area 3000 Sq. metres' },
        { phase: 'proposed', value: 25, unit: 'acres', evidenceExcerpt: 'Existing site area 0.25 hectares' },
      ].map(finding => ({ ...finding, evidenceSource: source.kind, evidenceUrl: source.url, evidencePage: null, confidence: 0.9 })),
      partyClues: [
        { name: 'Mr Test Person', role: 'applicant', evidenceExcerpt: 'Applicant Mr Test Person' },
        { name: 'Example Planning Ltd', role: 'agent', evidenceExcerpt: 'Agent Example Planning Ltd' },
        { name: 'Mr Test Person', role: 'developer', evidenceExcerpt: 'Applicant Mr Test Person' },
      ].map(finding => ({ ...finding, evidenceSource: source.kind, evidenceUrl: source.url, evidencePage: null, confidence: 0.9 })),
    }
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({
      choices: [{ message: { content: JSON.stringify(findings) } }],
    }) }) as unknown as typeof fetch
    const result = await researchOperatorWithOpenRouter({ application, sources: [{ ...source, text }], apiKey: 'key' })
    expect(result.siteAreas?.map(area => [area.phase, area.value, area.unit])).toEqual([
      ['existing', 0.25, 'hectares'], ['proposed', 3000, 'sqm'],
    ])
    expect(result.partyClues?.map(clue => clue.role)).toEqual(['applicant', 'agent'])
    expect(result.signals).toEqual([])
  })

  it('uses retrieved evidence when the web memo is empty without repeating the web request', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        choices: [{ finish_reason: 'length', message: { content: null } }],
        usage: { completion_tokens: 1000, cost: 0.01 },
      }) })
      .mockResolvedValueOnce(response([])) as unknown as typeof fetch
    const result = await researchOperatorWithOpenRouter({ application, sources: [source], apiKey: 'key' })
    expect(global.fetch).toHaveBeenCalledTimes(2)
    expect(result.researchWarnings?.[0]).toContain('finish_reason=length')
    expect(result.costUsd).toBeCloseTo(0.022)
  })

  it('fails with diagnostics when neither a memo nor retrievable evidence exists', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({
      choices: [{ finish_reason: 'length', message: { content: null } }],
    }) }) as unknown as typeof fetch
    await expect(researchOperatorWithOpenRouter({ application, sources: [], apiKey: 'key' }))
      .rejects.toThrow('finish_reason=length')
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('grounds a signal in the fetched council text', async () => {
    global.fetch = jest.fn().mockResolvedValue(response([{
      name: 'Example Fitness Limited', role: 'proposed_operator',
      evidenceSource: 'council_page', evidenceUrl: source.url,
      evidenceExcerpt: 'will be operated by Example Fitness Limited', confidence: 0.95,
    }])) as unknown as typeof fetch

    const result = await researchOperatorWithOpenRouter({
      application, sources: [source], apiKey: 'key',
    })
    expect(result.signals).toHaveLength(1)
    const researchBody = JSON.parse(String((global.fetch as jest.Mock).mock.calls[0][1].body))
    const extractionBody = JSON.parse(String((global.fetch as jest.Mock).mock.calls[1][1].body))
    expect(researchBody.messages[0].content).toContain('untrusted data')
    expect(researchBody.plugins[0]).toEqual(expect.objectContaining({
      id: 'web', engine: 'exa', max_results: 6,
      exclude_domains: expect.arrayContaining(['planning.org.uk', 'planning-records.uk']),
    }))
    expect(extractionBody.response_format.json_schema.strict).toBe(true)
    expect(result.webSearchRequests).toBe(1)
  })

  it('drops a confident operator whose evidence URL was not supplied or cited', async () => {
    global.fetch = jest.fn().mockResolvedValue(response([{
      name: 'Invented Gym', role: 'proposed_operator', evidenceSource: 'web',
      evidenceUrl: 'https://invented.test/claim',
      evidenceExcerpt: 'Invented Gym will occupy the unit', confidence: 0.99,
    }])) as unknown as typeof fetch

    const result = await researchOperatorWithOpenRouter({
      application, sources: [source], apiKey: 'key',
    })
    expect(result.signals).toEqual([])
  })

  it('accepts exact evidence from a cited web result', async () => {
    const webUrl = 'https://news.test/example-gym'
    global.fetch = jest.fn().mockResolvedValue(response([{
      name: 'Example Gym', role: 'proposed_occupier', evidenceSource: 'web',
      evidenceUrl: webUrl, evidenceExcerpt: 'Example Gym has signed for the new unit', confidence: 0.9,
    }], [{
      type: 'url_citation',
      url_citation: { url: webUrl, content: 'Example Gym has signed for the new unit at 1 High Street.' },
    }])) as unknown as typeof fetch

    const result = await researchOperatorWithOpenRouter({
      application, sources: [], apiKey: 'key',
    })
    const extractionBody = JSON.parse(String((global.fetch as jest.Mock).mock.calls[1][1].body))
    expect(extractionBody.messages[1].content).toContain('Cited web evidence:')
    expect(extractionBody.messages[1].content).toContain(`[WEB SOURCE; url=${webUrl}]`)
    expect(extractionBody.messages[1].content)
      .toContain('Example Gym has signed for the new unit at 1 High Street.')
    expect(result.signals).toHaveLength(1)
    expect(result.costUsd).toBe(0.024)
  })

  it('drops web evidence when the citation has no excerpt content to verify', async () => {
    const webUrl = 'https://news.test/unverifiable'
    global.fetch = jest.fn().mockResolvedValue(response([{
      name: 'Unverifiable Gym', role: 'proposed_occupier', evidenceSource: 'web',
      evidenceUrl: webUrl, evidenceExcerpt: 'Unverifiable Gym has signed for the unit', confidence: 0.99,
    }], [{ type: 'url_citation', url_citation: { url: webUrl } }])) as unknown as typeof fetch

    const result = await researchOperatorWithOpenRouter({
      application, sources: [], apiKey: 'key',
    })
    expect(result.signals).toEqual([])
  })

  it('rejects planning agents and titled private applicants as developers', async () => {
    const agentSource = {
      ...source,
      text: 'Applicant Name & Address: Mr L Ahmed Agent Name & Address: Clean-slate Developments Ltd',
    }
    global.fetch = jest.fn().mockResolvedValue(response([
      {
        name: 'Mr L Ahmed', role: 'applicant_developer', evidenceSource: 'council_page',
        evidenceUrl: source.url, evidenceExcerpt: 'Applicant Name & Address: Mr L Ahmed', confidence: 0.95,
      },
      {
        name: 'Clean-slate Developments Ltd', role: 'applicant_developer', evidenceSource: 'council_page',
        evidenceUrl: source.url,
        evidenceExcerpt: 'Agent Name & Address: Clean-slate Developments Ltd', confidence: 0.95,
      },
    ])) as unknown as typeof fetch

    const result = await researchOperatorWithOpenRouter({
      application, sources: [agentSource], apiKey: 'key',
    })
    expect(result.signals).toEqual([])
  })

  it('records one guaranteed search when the plugin response omits tool-usage metadata', async () => {
    const withoutSearch = response([])
    const originalJson = withoutSearch.json
    withoutSearch.json = async () => {
      const body = await originalJson()
      delete (body.usage as { server_tool_use?: { web_search_requests: number } }).server_tool_use
      return body
    }
    global.fetch = jest.fn().mockResolvedValue(withoutSearch) as unknown as typeof fetch

    const result = await researchOperatorWithOpenRouter({
      application, sources: [source], apiKey: 'key',
    })
    expect(result.webSearchRequests).toBe(1)
  })

  it('grounds directional use classes and commercial floor areas in supplied evidence', async () => {
    const commercialSource = {
      ...source,
      text: 'Conversion of former B2 joinery workshop to B8 use. Existing gross internal floorspace (square metres): 1409. Total gross new internal floorspace proposed (square metres): 1836. Net additional gross internal floorspace following development (square metres): 427.',
    }
    global.fetch = jest.fn().mockResolvedValue(response([], [], [
      {
        scope: 'existing', sqm: 1409, measurementBasis: 'gross_internal',
        evidenceSource: 'council_page', evidenceUrl: source.url,
        evidenceExcerpt: 'Existing gross internal floorspace (square metres): 1409',
        evidencePage: '10', confidence: 0.99,
      },
      {
        scope: 'proposed', sqm: 1836, measurementBasis: 'gross_internal',
        evidenceSource: 'council_page', evidenceUrl: source.url,
        evidenceExcerpt: 'Total gross new internal floorspace proposed (square metres): 1836',
        evidencePage: '10', confidence: 0.99,
      },
      {
        scope: 'net', sqm: 427, measurementBasis: 'gross_internal',
        evidenceSource: 'council_page', evidenceUrl: source.url,
        evidenceExcerpt: 'Net additional gross internal floorspace following development (square metres): 427',
        evidencePage: '10', confidence: 0.99,
      },
    ], [
      {
        phase: 'existing', useClass: 'B2', evidenceSource: 'council_page',
        evidenceUrl: source.url, evidenceExcerpt: 'Conversion of former B2 joinery workshop to B8 use',
        evidencePage: null, confidence: 0.98,
      },
      {
        phase: 'proposed', useClass: 'B8', evidenceSource: 'council_page',
        evidenceUrl: source.url, evidenceExcerpt: 'Conversion of former B2 joinery workshop to B8 use',
        evidencePage: null, confidence: 0.98,
      },
    ])) as unknown as typeof fetch

    const result = await researchOperatorWithOpenRouter({
      application, sources: [commercialSource], apiKey: 'key',
    })
    expect(result.commercialFloorspace.map((finding) => [finding.scope, finding.sqm]))
      .toEqual([['existing', 1409], ['proposed', 1836], ['net', 427]])
    expect(result.useClasses.map((finding) => [finding.phase, finding.useClass]))
      .toEqual([['existing', 'B2'], ['proposed', 'B8']])
  })

  it('drops a site area and an invented use class even when confidence is high', async () => {
    const siteSource = { ...source, text: 'Existing site area is 4013 square metres.' }
    global.fetch = jest.fn().mockResolvedValue(response([], [], [{
      scope: 'existing', sqm: 4013, measurementBasis: 'unspecified',
      evidenceSource: 'council_page', evidenceUrl: source.url,
      evidenceExcerpt: 'Existing site area is 4013 square metres', evidencePage: '4', confidence: 0.99,
    }], [{
      phase: 'proposed', useClass: 'E', evidenceSource: 'council_page', evidenceUrl: source.url,
      evidenceExcerpt: 'Existing site area is 4013 square metres', evidencePage: '4', confidence: 0.99,
    }])) as unknown as typeof fetch

    const result = await researchOperatorWithOpenRouter({
      application, sources: [siteSource], apiKey: 'key',
    })
    expect(result.commercialFloorspace).toEqual([])
    expect(result.useClasses).toEqual([])
  })

  it('parses a scanned application form before the separate web-search call', async () => {
    const formSource = {
      kind: 'document' as const,
      url: 'https://council.test/view.aspx?docid=form',
      text: 'Scanned planning document: Application Form',
      ocrFile: { filename: 'application-form.pdf', url: 'https://council.test/view.aspx?docid=form' },
    }
    const ocrAnnotation = {
      type: 'file',
      file: {
        name: 'application-form.pdf', hash: 'hash',
        content: [{ type: 'text', text: 'Existing gross internal floorspace (square metres): 1409' }],
      },
    }
    global.fetch = jest.fn()
      .mockResolvedValueOnce(response([], [ocrAnnotation]))
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response([], [], [{
        scope: 'existing', sqm: 1409, measurementBasis: 'gross_internal',
        evidenceSource: 'document', evidenceUrl: formSource.url,
        evidenceExcerpt: 'Existing gross internal floorspace (square metres): 1409',
        evidencePage: '10', confidence: 0.99,
      }])) as unknown as typeof fetch

    const result = await researchOperatorWithOpenRouter({
      application, sources: [formSource], apiKey: 'key',
    })
    const ocrBody = JSON.parse(String((global.fetch as jest.Mock).mock.calls[0][1].body))
    const webBody = JSON.parse(String((global.fetch as jest.Mock).mock.calls[1][1].body))
    expect(ocrBody.plugins).toEqual([{ id: 'file-parser', pdf: { engine: 'mistral-ocr' } }])
    expect(ocrBody.messages[1].content[1].file.file_data).toBe(formSource.url)
    expect(webBody.plugins[0].id).toBe('web')
    expect(result.commercialFloorspace[0]).toEqual(expect.objectContaining({ sqm: 1409 }))
    expect(result.costUsd).toBeCloseTo(0.036)
  })
})
