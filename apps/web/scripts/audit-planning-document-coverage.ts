/**
 * Read-only audit of council planning-document access for stored high-relevance records.
 * It makes no model calls and writes no database rows. JSON and CSV files are local reports.
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { collectCouncilResearchSources } from '../src/lib/planning-intelligence/research-sources'
import {
  planningDocumentCoverageRecord,
  summarizePlanningDocumentCoverage,
  type PlanningDocumentCoverageRecord,
} from '../src/lib/planning-intelligence/research-coverage'
import type { PlotaApplication } from '../src/lib/planning-intelligence/types'

loadEnvConfig(process.cwd())

function argument(name: string): string | null {
  const prefix = `--${name}=`
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? null
}

function percent(value: number, total: number) {
  return total === 0 ? 0 : Number(((value / total) * 100).toFixed(1))
}

function csvValue(value: unknown): string {
  const text = Array.isArray(value) ? value.join(' | ') : value == null ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

function csv(records: PlanningDocumentCoverageRecord[]) {
  const columns: Array<keyof PlanningDocumentCoverageRecord> = [
    'reference', 'authority', 'councilHost', 'portalFamily', 'declaredDocumentCount',
    'councilPageAccessible', 'documentsRetrieved', 'applicationFormRetrieved',
    'htmlCandidatePagesRetrieved',
    'locallyReadableDocuments', 'documentsNeedingOcr', 'floorspaceWordingFound',
    'useClassWordingFound', 'outcome', 'failureReason', 'warnings', 'councilUrl',
  ]
  return [
    columns.join(','),
    ...records.map((record) => columns.map((column) => csvValue(record[column])).join(',')),
  ].join('\n') + '\n'
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Supabase service credentials are not configured')
  const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const requestedLimit = Number(argument('limit') ?? '')
  const limit = Number.isInteger(requestedLimit) && requestedLimit > 0 ? requestedLimit : null
  const outBase = resolve(argument('out') ?? `reports/planning-document-coverage-${new Date().toISOString().slice(0, 10)}`)

  let developmentsQuery = db.from('developments').select('id').eq('relevance', 'high').order('id')
  if (limit) developmentsQuery = developmentsQuery.limit(limit)
  const { data: developments, error: developmentsError } = await developmentsQuery
  if (developmentsError) throw developmentsError
  const developmentIds = (developments ?? []).map((row) => row.id as string)
  if (developmentIds.length === 0) throw new Error('No high-relevance developments are available')

  const { data: links, error: linksError } = await db.from('development_applications')
    .select('planning_application_id').in('development_id', developmentIds)
  if (linksError) throw linksError
  const applicationIds = [...new Set((links ?? []).map((row) => row.planning_application_id as string))]
  const { data: storedApplications, error: applicationsError } = await db.from('planning_applications')
    .select('id,reference,authority_name,documents_count,raw').in('id', applicationIds)
    .order('authority_name').order('reference')
  if (applicationsError) throw applicationsError

  const selectedApplications = argument('reference')
    ? (storedApplications ?? []).filter(row => row.reference === argument('reference'))
    : storedApplications ?? []
  if (selectedApplications.length === 0) throw new Error('No applications matched the selected sample/reference')
  const evidence: Array<{ reference: string; sources: Array<{ url: string; title?: string; text: string }> }> = []
  const records: PlanningDocumentCoverageRecord[] = []
  for (const [index, stored] of selectedApplications.entries()) {
    const raw = stored.raw as PlotaApplication | null
    if (!raw) continue
    const application: PlotaApplication = {
      ...raw,
      reference: raw.reference || String(stored.reference),
      authority: raw.authority ?? { slug: '', name: String(stored.authority_name ?? 'Unknown authority') },
    }
    console.info(`[${index + 1}/${selectedApplications.length}] ${application.authority.name}: ${application.reference}`)
    const collected = await collectCouncilResearchSources(application)
    if (process.argv.includes('--include-evidence')) evidence.push({ reference: application.reference,
      sources: collected.sources.filter(source => source.kind === 'document' && !source.ocrFile)
        .map(({ url, title, text }) => ({ url, title, text })),
    })
    records.push(planningDocumentCoverageRecord({
      application,
      declaredDocumentCount: stored.documents_count as number | null,
      collected,
    }))
  }

  const summary = summarizePlanningDocumentCoverage(records)
  const declaredDocumentRecords = records.filter((record) => (record.declaredDocumentCount ?? 0) > 0)
  const declaredDocumentSummary = summarizePlanningDocumentCoverage(declaredDocumentRecords)
  const failureReasons = Object.entries(records.reduce<Record<string, number>>((counts, record) => {
    const reason = record.failureReason ?? 'Success: planning PDF retrieved'
    counts[reason] = (counts[reason] ?? 0) + 1
    return counts
  }, {})).map(([reason, applications]) => ({ reason, applications }))
    .sort((a, b) => b.applications - a.applications || a.reason.localeCompare(b.reason))
  const groups = Object.values(records.reduce<Record<string, { portalFamily: string; councilHost: string | null; records: PlanningDocumentCoverageRecord[] }>>(
    (result, record) => {
      const key = `${record.portalFamily}|${record.councilHost ?? 'none'}`
      result[key] ??= { portalFamily: record.portalFamily, councilHost: record.councilHost, records: [] }
      result[key].records.push(record)
      return result
    }, {}
  )).map((group) => ({
    portalFamily: group.portalFamily,
    councilHost: group.councilHost,
    ...summarizePlanningDocumentCoverage(group.records),
  })).sort((a, b) => b.applications - a.applications || String(a.councilHost).localeCompare(String(b.councilHost)))

  const report = {
    generatedAt: new Date().toISOString(),
    population: 'Stored developments with relevance = high and their linked planning applications',
    method: 'Read-only council source collection; no AI, OCR provider, web research, or database writes',
    interpretation: {
      councilPageCoveragePercent: percent(summary.councilPagesAccessible, summary.applications),
      documentRetrievalCoveragePercent: percent(summary.documentsRetrieved, summary.applications),
      applicationFormRetrievalCoveragePercent: percent(summary.applicationFormsRetrieved, summary.applications),
      localTextCoveragePercent: percent(summary.applicationsWithLocalText, summary.applications),
      declaredDocumentPopulation: declaredDocumentSummary.applications,
      declaredDocumentRetrievalCoveragePercent: percent(
        declaredDocumentSummary.documentsRetrieved, declaredDocumentSummary.applications
      ),
      note: 'documentsNeedingOcr were downloaded but their content was not assessed in this no-cost audit.',
    },
    summary,
    declaredDocumentSummary,
    failureReasons,
    groups,
    applications: records,
    ...(process.argv.includes('--include-evidence') ? { evidence } : {}),
  }
  mkdirSync(dirname(outBase), { recursive: true })
  writeFileSync(`${outBase}.json`, JSON.stringify(report, null, 2) + '\n')
  writeFileSync(`${outBase}.csv`, csv(records))
  console.info(JSON.stringify({ report: `${outBase}.json`, csv: `${outBase}.csv`, ...report.interpretation, summary }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Planning document coverage audit failed')
  process.exit(1)
})
