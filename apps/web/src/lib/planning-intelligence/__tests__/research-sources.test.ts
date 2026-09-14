import { fetchCompletingChain } from '../incomplete-chain-fetch'
import { collectCouncilResearchSources } from '../research-sources'

jest.mock('../incomplete-chain-fetch', () => ({
  ...jest.requireActual('../incomplete-chain-fetch'),
  fetchCompletingChain: jest.fn(),
}))

// PDF.js is ESM and does not load under Jest. This stand-in keeps its behaviour that matters here:
// it detaches the buffer it is given, and reads the text drawn by the test PDFs below.
jest.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  getDocument: ({ data }: { data: Uint8Array }) => {
    const source = Buffer.from(data).toString('latin1')
    ;(data.buffer as ArrayBuffer & { transfer: () => ArrayBuffer }).transfer()
    const text = source.match(/\((.*)\) Tj/)?.[1] ?? ''
    return { promise: Promise.resolve({
      numPages: 1,
      getPage: async () => ({ getTextContent: async () => ({ items: text ? [{ str: text }] : [] }) }),
    }) }
  },
}), { virtual: true })

describe('council research source collection', () => {
  const originalFetch = global.fetch
  afterEach(() => { global.fetch = originalFetch })

  const application = {
    id: 'one', reference: 'REF/1', authority: { slug: 'test', name: 'Test Council' },
    links: { council: 'https://council.test/application/1' },
  }

  function pdfBase64(text: string) {
    const escaped = text.replace(/([()\\])/g, '\\$1')
    const stream = `BT /F1 12 Tf 50 700 Td (${escaped}) Tj ET\n`
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
      `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ]
    let pdf = '%PDF-1.4\n'
    const offsets = [0]
    objects.forEach((object, index) => {
      offsets.push(Buffer.byteLength(pdf))
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
    })
    const xref = Buffer.byteLength(pdf)
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
    pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
    return Buffer.from(pdf).toString('base64')
  }

  it('follows a document listing to the application form before unrelated drawings', async () => {
    const htmlResponse = (html: string) => ({ ok: true, status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () => html, arrayBuffer: async () => new Uint8Array(Buffer.from(html)).buffer,
    })
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(htmlResponse('User-agent: *'))
      .mockResolvedValueOnce(htmlResponse('<a href="/documents/list">Documents</a>'))
      .mockResolvedValueOnce(htmlResponse('<a href="/files/drawing">Drawing</a><a href="/files/form">Application Form</a>'))
      .mockResolvedValueOnce(htmlResponse('Existing commercial floorspace 200 sqm; site area 0.5 hectares'))
      .mockResolvedValueOnce(htmlResponse('Site drawing'))
    global.fetch = fetchMock as unknown as typeof fetch
    const result = await collectCouncilResearchSources(application)
    expect(String(fetchMock.mock.calls[3][0])).toBe('https://council.test/files/form')
    expect(result.sources[1].text).toContain('site area 0.5 hectares')
    expect(result.sources.some(source => source.url.endsWith('/documents/list'))).toBe(false)
    expect(result.sources).toHaveLength(3)
  })

  it('follows a labelled document button without executing its JavaScript', async () => {
    const html = `<input type="button" value="View Documents" onclick="window.open('/documents/list', '_top')">`
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => 'User-agent: *' })
      .mockResolvedValueOnce({ ok: true, text: async () => html })
      .mockResolvedValueOnce({ ok: true, headers: new Headers({ 'content-type': 'text/html' }),
        arrayBuffer: async () => new Uint8Array(Buffer.from('Document listing')).buffer })
    global.fetch = fetchMock as unknown as typeof fetch
    await collectCouncilResearchSources(application)
    expect(String(fetchMock.mock.calls[2][0])).toBe('https://council.test/documents/list')
  })

  it('uses the portal’s public Continue Browsing flow and retains its session', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => 'User-agent: *' })
      .mockResolvedValueOnce({ ok: true, headers: new Headers(), text: async () =>
        '<title>UnsupportedWebBrowser</title><button id="ContinueBrowsing" data-url-ignore="/NECSWS/ES/Presentation/Home/IgnoreBrowserValidation">Continue Browsing</button>' })
      .mockResolvedValueOnce({ ok: true, headers: new Headers({ 'set-cookie': 'IgnoreBrowserValidation=true; Path=/' }) })
      .mockResolvedValueOnce({ ok: true, text: async () => '<main>Planning reference REF/1</main>' })
    global.fetch = fetchMock as unknown as typeof fetch
    const result = await collectCouncilResearchSources(application)
    expect(String(fetchMock.mock.calls[2][0])).toContain('/Home/IgnoreBrowserValidation')
    expect(fetchMock.mock.calls[3][1].headers.Cookie).toBe('IgnoreBrowserValidation=true')
    expect(result.sources[0].text).toBe('Planning reference REF/1')
  })

  it('does not count an unsupported-browser screen as an application page', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => 'User-agent: *' })
      .mockResolvedValueOnce({ ok: true, text: async () => '<title>UnsupportedWebBrowser</title>' }) as unknown as typeof fetch
    const result = await collectCouncilResearchSources(application)
    expect(result.sources).toEqual([])
    expect(result.warnings[0]).toContain('unsupported-browser')
  })

  it('carries the accepted public session into same-origin document downloads', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => 'User-agent: *' })
      .mockResolvedValueOnce({ ok: true, headers: new Headers(), text: async () =>
        '<form action="/Disclaimer/Accept?returnUrl=%2FPlanning" method="post"><button>Agree</button></form>' })
      .mockResolvedValueOnce({ status: 302, headers: new Headers({ 'set-cookie': 'DisclaimerAccepted=true; Path=/' }) })
      .mockResolvedValueOnce({ ok: true, text: async () => '<a href="/Document/Download?id=1">Application Form</a>' })
      .mockResolvedValueOnce({ ok: true, headers: new Headers({ 'content-type': 'text/html' }),
        arrayBuffer: async () => new Uint8Array(Buffer.from('Public application form evidence')).buffer })
    global.fetch = fetchMock as unknown as typeof fetch
    const result = await collectCouncilResearchSources(application)
    expect(fetchMock.mock.calls[4][1].headers.Cookie).toBe('DisclaimerAccepted=true')
    expect(result.sources[1].text).toContain('Public application form evidence')
  })

  it('does not fetch a council page disallowed by robots.txt', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true, status: 200, text: async () => 'User-agent: *\nDisallow: /application/',
    })
    global.fetch = fetchMock as unknown as typeof fetch
    const result = await collectCouncilResearchSources(application)
    expect(result.sources).toEqual([])
    expect(result.warnings).toContain('Council page is disallowed by robots.txt')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('extracts visible council text and same-origin document links', async () => {
    const documentBytes = new Uint8Array(Buffer.from('<p>Example Fitness will operate the gym</p>'))
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => 'User-agent: *\nAllow: /' })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        text: async () => '<html><script>ignore()</script><body>Example Fitness proposal <a href="/documents/operator.html">Statement</a></body></html>',
      })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        arrayBuffer: async () => documentBytes.buffer,
      })
    global.fetch = fetchMock as unknown as typeof fetch

    const result = await collectCouncilResearchSources(application)
    expect(result.sources).toEqual([
      expect.objectContaining({ kind: 'council_page', text: expect.stringContaining('Example Fitness proposal') }),
      expect.objectContaining({ kind: 'document', text: 'Example Fitness will operate the gym' }),
    ])
  })

  it('follows an explicitly labelled cross-origin Plan Portal link and prioritises the application form', async () => {
    const formBytes = new Uint8Array(Buffer.from(
      '<p>Existing gross internal floorspace 1409 square metres; proposed 1836 square metres</p>'
    ))
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => 'User-agent: *\nAllow: /' })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        text: async () => '<a href="https://rotherham.planportal.co.uk/?id=RB2026/1058">View plans and documents</a>',
      })
      .mockResolvedValueOnce({ ok: false, status: 404, text: async () => '' })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => ({
          result: { NewDataSet: { data1: [
            {
              ID_PhysicalDoc: 'other', ID_AppRef: 'RB2026/1058',
              Description: 'Coal Mining Report', DocumentType: 'Document', FileName: 'mining.pdf',
            },
            {
              ID_PhysicalDoc: 'form', ID_AppRef: 'RB2026/1058',
              Description: 'Application Form', DocumentType: 'Form', FileName: 'application.pdf',
            },
          ] } },
        }),
      })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        arrayBuffer: async () => formBytes.buffer,
      })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        arrayBuffer: async () => new Uint8Array(Buffer.from('<p>Mining report</p>')).buffer,
      })
    global.fetch = fetchMock as unknown as typeof fetch

    const result = await collectCouncilResearchSources(application)
    expect(result.sources[1]).toEqual(expect.objectContaining({
      kind: 'document', url: expect.stringContaining('docid=form'),
      text: expect.stringContaining('Existing gross internal floorspace 1409'),
    }))
    const directCall = fetchMock.mock.calls[3]
    expect(String(directCall[0])).toContain('/services/DirectService.ashx')
    expect(JSON.parse(String(directCall[1].body))[0]).toEqual(expect.objectContaining({
      method: 'GetPagedRelatedDocuments', data: expect.arrayContaining(['RB2026/1058']),
    }))
  })

  it('does not treat ordinary planning navigation as documents', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => 'User-agent: *\nAllow: /' })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        text: async () => '<main>Proposal</main><a href="/Planning/WeeklyList">Weekly List</a><a href="/Planning/PreApplication">Apply for pre-application advice</a>',
      })
    global.fetch = fetchMock as unknown as typeof fetch

    const result = await collectCouncilResearchSources(application)
    expect(result.sources).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it.each([
    '<form method="post" action="/Disclaimer/AcceptDisclaimer"><input name="__RequestVerificationToken" type="hidden" value="form-token"></form>',
    '<form action="/Disclaimer/Accept?returnUrl=%2FPlanning%2FDisplay%2FREF" method="post"><button>Agree</button></form>',
  ])('accepts an Online Register disclaimer and reads its base64 application form: %s', async disclaimer => {
    const formText = 'Existing gross internal floorspace 450 square metres'
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => 'User-agent: *\nAllow: /' })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        headers: new Headers({ 'set-cookie': '.AspNetCore.Antiforgery=test-cookie; Path=/; Secure' }),
        text: async () => disclaimer,
      })
      .mockResolvedValueOnce({
        ok: false, status: 302,
        headers: new Headers({ 'set-cookie': 'DisclaimerAccepted=true; Path=/; Secure' }),
      })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        text: async () => `<main>Storage proposal</main><table class="documentGrid"><tr class="grid-dataRow" data-module="PLA" data-recordNumber="58661" data-planID="12572.0000" data-imageID="22572.0000" data-storedInDatabase="True" data-fileName="ApplicationFormRedacted.pdf"><td>Application Form - Without Personal Data</td></tr></table>`,
      })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        json: async () => pdfBase64(formText),
      })
    global.fetch = fetchMock as unknown as typeof fetch

    const result = await collectCouncilResearchSources({
      ...application,
      links: { council: 'https://planning.northwarks.test/Planning/Display?applicationNumber=2026%2F0682%2FFUL' },
    })
    expect(result.warnings).toEqual([])
    expect(result.sources).toEqual([
      expect.objectContaining({ kind: 'council_page', text: expect.stringContaining('Storage proposal') }),
      expect.objectContaining({
        kind: 'document', text: expect.stringContaining('Application Form'),
        ocrFile: expect.objectContaining({ url: expect.stringMatching(/^data:application\/pdf;base64,/) }),
      }),
    ])
    expect(fetchMock.mock.calls[2][1]).toEqual(expect.objectContaining({
      method: 'POST', redirect: 'manual',
    }))
    expect(fetchMock.mock.calls[4][1].headers).toEqual(expect.objectContaining({
      'X-Requested-With': 'XMLHttpRequest',
      Cookie: expect.stringContaining('DisclaimerAccepted=true'),
    }))
  })

  const byUrl = (responses: Record<string, () => unknown>) => jest.fn(async (url: URL | string) => {
    const key = String(url).replace('https://council.test', '')
    const respond = responses[key]
    if (!respond) throw new Error(`Unexpected fetch ${key}`)
    return respond()
  })
  const html = (body: string) => () => ({ ok: true, status: 200, headers: new Headers({ 'content-type': 'text/html' }),
    text: async () => body, arrayBuffer: async () => new Uint8Array(Buffer.from(body)).buffer })
  const pdf = (text: string) => () => ({ ok: true, status: 200, headers: new Headers({ 'content-type': 'application/pdf' }),
    arrayBuffer: async () => new Uint8Array(Buffer.from(pdfBase64(text), 'base64')).buffer })

  it('builds the OCR payload for a scanned PDF downloaded inside a public session', async () => {
    // PDF.js detaches the buffer it reads; the session download must still be encodable afterwards.
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, text: async () => 'User-agent: *' })
      .mockResolvedValueOnce({ ok: true, headers: new Headers(), text: async () =>
        '<form action="/Disclaimer/Accept?returnUrl=%2FPlanning" method="post"><button>Agree</button></form>' })
      .mockResolvedValueOnce({ status: 302, headers: new Headers({ 'set-cookie': 'DisclaimerAccepted=true; Path=/' }) })
      .mockResolvedValueOnce({ ok: true, text: async () => '<a href="/Document/Download?id=1">Planning Statement</a>' })
      .mockImplementationOnce(pdf('')) as unknown as typeof fetch
    const result = await collectCouncilResearchSources(application)
    expect(result.warnings.filter(warning => /could not be read/.test(warning))).toEqual([])
    expect(result.sources[1].ocrFile?.url).toMatch(/^data:application\/pdf;base64,JVBERi0/)
  })

  it('reads an Online Register PDF’s text layer instead of sending it to OCR', async () => {
    const formText = 'Existing gross internal floorspace 450 square metres. Proposed gross internal floorspace 900 square metres. Site area 0.2 hectares.'
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => 'User-agent: *' })
      .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers(), text: async () =>
        '<main>Storage proposal</main><table><tr data-module="PLA" data-recordNumber="1" data-planID="2" data-imageID="3" data-storedInDatabase="True" data-fileName="form.pdf"><td>Application Form</td></tr></table>' })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => pdfBase64(formText) }) as unknown as typeof fetch
    const result = await collectCouncilResearchSources(application)
    expect(result.sources[1]).toEqual(expect.objectContaining({ kind: 'document', text: expect.stringContaining('Site area 0.2 hectares') }))
    expect(result.sources[1].ocrFile).toBeUndefined()
  })

  it('skips a Word document instead of reading its bytes as text', async () => {
    const zipSignature = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('binary')])
    global.fetch = byUrl({
      '/robots.txt': html('User-agent: *'),
      '/application/1': html('<a href="/Document/Download?id=9">Site Notice document</a>'),
      '/Document/Download?id=9': () => ({ ok: true, status: 200,
        headers: new Headers({ 'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
        arrayBuffer: async () => new Uint8Array(zipSignature).buffer }),
    }) as unknown as typeof fetch
    const result = await collectCouncilResearchSources(application)
    expect(result.sources).toHaveLength(1)
    expect(result.warnings.some(warning => warning.startsWith('Skipped unsupported document format'))).toBe(true)
  })

  it('reads a document once when two listings link to it', async () => {
    const fetchMock = byUrl({
      '/robots.txt': html('User-agent: *'),
      '/application/1': html('<a href="/documents/list">Documents</a><a href="/documents/all">All documents</a>'),
      '/documents/list': html('<a href="/files/statement.pdf">Planning Statement</a>'),
      '/documents/all': html('<a href="/files/statement.pdf">Planning Statement</a>'),
      '/files/statement.pdf': pdf('Planning statement text describing the proposed commercial floorspace of 300 square metres in detail.'),
    })
    global.fetch = fetchMock as unknown as typeof fetch
    const result = await collectCouncilResearchSources(application)
    expect(result.sources.filter(source => source.url.endsWith('/files/statement.pdf'))).toHaveLength(1)
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/files/statement.pdf'))).toHaveLength(1)
  })

  it('completes a council server’s missing intermediate certificate and still obeys its robots.txt', async () => {
    const chainError = Object.assign(new TypeError('fetch failed'), { cause: { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' } })
    global.fetch = jest.fn().mockRejectedValue(chainError) as unknown as typeof fetch
    jest.mocked(fetchCompletingChain).mockResolvedValueOnce({ ok: true, status: 200, text: async () => 'User-agent: *\nDisallow: /' } as unknown as Response)
    const result = await collectCouncilResearchSources(application)
    expect(String(jest.mocked(fetchCompletingChain).mock.calls[0][0])).toBe('https://council.test/robots.txt')
    expect(result.warnings).toEqual(['Council page is disallowed by robots.txt'])
  })

  it.each([
    ['cannot be reached', () => Promise.reject(new TypeError('fetch failed'))],
    ['returns a server error', () => Promise.resolve({ ok: false, status: 503 })],
  ])('treats a council as disallowed when its robots.txt %s', async (_, robots) => {
    const fetchMock = jest.fn().mockImplementationOnce(robots)
    global.fetch = fetchMock as unknown as typeof fetch
    const result = await collectCouncilResearchSources(application)
    expect(result.sources).toEqual([])
    expect(result.warnings).toContain('Council page is disallowed by robots.txt')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('allows a council whose robots.txt does not exist', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => '<main>Proposal REF/1</main>' }) as unknown as typeof fetch
    const result = await collectCouncilResearchSources(application)
    expect(result.sources[0].text).toContain('Proposal REF/1')
  })
})
