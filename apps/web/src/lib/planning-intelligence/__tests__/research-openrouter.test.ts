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
    expect(researchBody.plugins[0]).toEqual(expect.objectContaining({ id: 'web', max_results: 6 }))
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
