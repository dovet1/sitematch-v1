import { collectCouncilResearchSources } from '../research-sources'

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

  it('accepts an Online Register disclaimer and reads its base64 application form', async () => {
    const formText = 'Existing gross internal floorspace 450 square metres'
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => 'User-agent: *\nAllow: /' })
      .mockResolvedValueOnce({
        ok: true, status: 200,
        headers: new Headers({ 'set-cookie': '.AspNetCore.Antiforgery=test-cookie; Path=/; Secure' }),
        text: async () => '<form method="post" action="/Disclaimer/AcceptDisclaimer"><input name="__RequestVerificationToken" type="hidden" value="form-token"></form>',
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
})
