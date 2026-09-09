import type { CouncilResearchSources } from './research-sources'
import type { PlotaApplication } from './types'

export type PlanningPortalFamily =
  | 'plan_portal'
  | 'online_register'
  | 'idox_public_access'
  | 'generic'
  | 'unknown'

export type DocumentCoverageOutcome =
  | 'document_text_readable'
  | 'document_needs_ocr'
  | 'no_document_retrieved'
  | 'council_page_unavailable'
  | 'no_council_url'

export interface PlanningDocumentCoverageRecord {
  reference: string
  authority: string
  councilUrl: string | null
  councilHost: string | null
  portalFamily: PlanningPortalFamily
  declaredDocumentCount: number | null
  councilPageAccessible: boolean
  documentsRetrieved: number
  htmlCandidatePagesRetrieved: number
  applicationFormRetrieved: boolean
  locallyReadableDocuments: number
  documentsNeedingOcr: number
  floorspaceWordingFound: boolean | null
  useClassWordingFound: boolean | null
  outcome: DocumentCoverageOutcome
  failureReason: string | null
  warnings: string[]
}

export interface PlanningDocumentCoverageSummary {
  applications: number
  councilPagesAccessible: number
  documentsRetrieved: number
  applicationFormsRetrieved: number
  applicationsWithLocalText: number
  applicationsNeedingOcr: number
  applicationsWithFloorspaceWording: number
  applicationsWithUseClassWording: number
  outcomes: Record<DocumentCoverageOutcome, number>
}

function safeUrl(value: string | null | undefined): URL | null {
  try {
    return value ? new URL(value) : null
  } catch {
    return null
  }
}

function portalFamily(application: PlotaApplication, collected: CouncilResearchSources): PlanningPortalFamily {
  const councilUrl = safeUrl(application.links?.council)
  const documentUrls = collected.sources
    .filter((source) => source.kind === 'document')
    .map((source) => safeUrl(source.url))
    .filter((url): url is URL => Boolean(url))
  if (documentUrls.some((url) => url.hostname.toLowerCase().endsWith('.planportal.co.uk'))) {
    return 'plan_portal'
  }
  if (documentUrls.some((url) => url.hash.startsWith('#document='))
    || collected.warnings.some((warning) => warning.startsWith('Online Register '))
    || councilUrl?.pathname.toLowerCase() === '/planning/display') {
    return 'online_register'
  }
  if (councilUrl?.pathname.toLowerCase().includes('/online-applications/')) {
    return 'idox_public_access'
  }
  return councilUrl ? 'generic' : 'unknown'
}

function failureReason(application: PlotaApplication, collected: CouncilResearchSources): string | null {
  if (!safeUrl(application.links?.council)) return 'No safe public council URL'
  const warning = collected.warnings.find((value) =>
    /disallowed by robots|certificate|unable_to_verify|timed out|could not be read|returned \d{3}|no verification token|did not establish/i.test(value)
  )
  if (warning) return warning
  if (!collected.sources.some((source) => source.kind === 'council_page')) {
    return collected.warnings[0] ?? 'Council page was not retrieved'
  }
  const retrievedPdf = collected.sources.some((source) => source.kind === 'document'
    && (source.mediaType === 'application/pdf'
      || source.ocrFile?.url.startsWith('data:application/pdf')
      || safeUrl(source.url)?.pathname.toLowerCase().endsWith('.pdf')))
  if (!retrievedPdf) {
    const candidatePage = collected.sources.some((source) => source.kind === 'document')
    return collected.warnings[0] ?? (candidatePage
      ? 'A document-list or candidate HTML page was reached, but no planning PDF was retrieved'
      : 'No supported document link was discovered and retrieved')
  }
  return null
}

export function planningDocumentCoverageRecord(input: {
  application: PlotaApplication
  declaredDocumentCount?: number | null
  collected: CouncilResearchSources
}): PlanningDocumentCoverageRecord {
  const { application, collected } = input
  const councilUrl = safeUrl(application.links?.council)
  const candidates = collected.sources.filter((source) => source.kind === 'document')
  const documents = candidates.filter((source) => source.mediaType === 'application/pdf'
    || source.ocrFile?.url.startsWith('data:application/pdf')
    || safeUrl(source.url)?.pathname.toLowerCase().endsWith('.pdf'))
  const htmlCandidatePages = candidates.filter((source) => !documents.includes(source))
  const readable = documents.filter((source) => !source.ocrFile && source.text.trim().length >= 100)
  const needsOcr = documents.filter((source) => Boolean(source.ocrFile))
  const readableText = readable.map((source) => source.text).join('\n')
  const pageAccessible = collected.sources.some((source) => source.kind === 'council_page')
  const applicationFormRetrieved = documents.some((source) => {
    const evidence = `${source.title ?? ''} ${source.url} ${source.ocrFile?.filename ?? ''} ${source.text.slice(0, 2_000)}`
    return /application\s*(?:form|submission)|planning portal reference/i.test(evidence)
  })
  const outcome: DocumentCoverageOutcome = !councilUrl
    ? 'no_council_url'
    : !pageAccessible
      ? 'council_page_unavailable'
      : documents.length === 0
        ? 'no_document_retrieved'
        : readable.length > 0
          ? 'document_text_readable'
          : 'document_needs_ocr'

  return {
    reference: application.reference,
    authority: application.authority.name,
    councilUrl: councilUrl?.href ?? null,
    councilHost: councilUrl?.hostname.toLowerCase() ?? null,
    portalFamily: portalFamily(application, collected),
    declaredDocumentCount: input.declaredDocumentCount ?? application.documents_count ?? null,
    councilPageAccessible: pageAccessible,
    documentsRetrieved: documents.length,
    htmlCandidatePagesRetrieved: htmlCandidatePages.length,
    applicationFormRetrieved,
    locallyReadableDocuments: readable.length,
    documentsNeedingOcr: needsOcr.length,
    floorspaceWordingFound: readable.length > 0
      ? /floor\s*space|floorspace|gross internal|net internal|\bGIA\b|\bNIA\b/i.test(readableText)
      : null,
    useClassWordingFound: readable.length > 0
      ? /use\s*class|class\s+[A-E]\d?(?:\([^)]*\))?|sui\s+generis/i.test(readableText)
      : null,
    outcome,
    failureReason: failureReason(application, collected),
    warnings: collected.warnings,
  }
}

export function summarizePlanningDocumentCoverage(
  records: PlanningDocumentCoverageRecord[]
): PlanningDocumentCoverageSummary {
  const outcomes: PlanningDocumentCoverageSummary['outcomes'] = {
    document_text_readable: 0,
    document_needs_ocr: 0,
    no_document_retrieved: 0,
    council_page_unavailable: 0,
    no_council_url: 0,
  }
  for (const record of records) outcomes[record.outcome] += 1
  return {
    applications: records.length,
    councilPagesAccessible: records.filter((record) => record.councilPageAccessible).length,
    documentsRetrieved: records.filter((record) => record.documentsRetrieved > 0).length,
    applicationFormsRetrieved: records.filter((record) => record.applicationFormRetrieved).length,
    applicationsWithLocalText: records.filter((record) => record.locallyReadableDocuments > 0).length,
    applicationsNeedingOcr: records.filter((record) => record.documentsNeedingOcr > 0).length,
    applicationsWithFloorspaceWording: records.filter((record) => record.floorspaceWordingFound === true).length,
    applicationsWithUseClassWording: records.filter((record) => record.useClassWordingFound === true).length,
    outcomes,
  }
}
