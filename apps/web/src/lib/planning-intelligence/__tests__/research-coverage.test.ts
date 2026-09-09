import {
  planningDocumentCoverageRecord,
  summarizePlanningDocumentCoverage,
} from '../research-coverage'

const application = {
  id: 'one', reference: 'REF/1', authority: { slug: 'test', name: 'Test Council' },
  links: { council: 'https://example.test/online-applications/applicationDetails.do?key=1' },
}

describe('planning document coverage', () => {
  it('distinguishes a downloaded scanned application form from locally readable text', () => {
    const record = planningDocumentCoverageRecord({
      application,
      declaredDocumentCount: 4,
      collected: {
        warnings: [],
        sources: [
          { kind: 'council_page', url: application.links.council, text: 'Proposal' },
          {
            kind: 'document', url: 'https://example.test/form.pdf',
            text: 'Scanned planning document: Application Form',
            title: 'Application Form', mediaType: 'application/pdf',
            ocrFile: { filename: 'application-form.pdf', url: 'https://example.test/form.pdf' },
          },
        ],
      },
    })
    expect(record).toEqual(expect.objectContaining({
      portalFamily: 'idox_public_access', outcome: 'document_needs_ocr',
      documentsRetrieved: 1, htmlCandidatePagesRetrieved: 0, applicationFormRetrieved: true,
      locallyReadableDocuments: 0, documentsNeedingOcr: 1,
      floorspaceWordingFound: null, useClassWordingFound: null,
    }))
  })

  it('summarises application-level coverage without counting multiple documents twice', () => {
    const readable = planningDocumentCoverageRecord({
      application: { ...application, reference: 'REF/2' },
      collected: {
        warnings: [],
        sources: [
          { kind: 'council_page', url: application.links.council, text: 'Proposal' },
          {
            kind: 'document', url: 'https://example.test/form.pdf',
            text: 'Application form. Existing gross internal floorspace. Proposed Use Class B8.'.repeat(3),
            title: 'Application Form', mediaType: 'application/pdf',
          },
          {
            kind: 'document', url: 'https://example.test/statement.html',
            text: 'Planning statement '.repeat(10), mediaType: 'text/html',
          },
        ],
      },
    })
    const blocked = planningDocumentCoverageRecord({
      application: { ...application, reference: 'REF/3' },
      collected: { sources: [], warnings: ['Council page is disallowed by robots.txt'] },
    })
    expect(summarizePlanningDocumentCoverage([readable, blocked])).toEqual(expect.objectContaining({
      applications: 2, councilPagesAccessible: 1, documentsRetrieved: 1,
      applicationFormsRetrieved: 1, applicationsWithLocalText: 1,
      applicationsWithFloorspaceWording: 1, applicationsWithUseClassWording: 1,
      outcomes: expect.objectContaining({ document_text_readable: 1, council_page_unavailable: 1 }),
    }))
  })

  it('does not count an HTML documents tab as a retrieved planning document', () => {
    const record = planningDocumentCoverageRecord({
      application,
      collected: {
        warnings: [],
        sources: [
          { kind: 'council_page', url: application.links.council, text: 'Proposal', mediaType: 'text/html' },
          {
            kind: 'document', url: 'https://example.test/applicationDetails.do?activeTab=documents',
            text: 'Documents View plans and documents', title: 'Documents', mediaType: 'text/html',
          },
        ],
      },
    })
    expect(record).toEqual(expect.objectContaining({
      outcome: 'no_document_retrieved', documentsRetrieved: 0, htmlCandidatePagesRetrieved: 1,
      applicationFormRetrieved: false,
    }))
  })
})
