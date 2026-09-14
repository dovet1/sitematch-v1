/** Which councils' planning documents research can actually read.
 *
 * For each council, samples recent intelligence-tier applications (received 30–150 days ago, so
 * documents have had time to be published; declared documents and commercial work preferred) and
 * runs the research document collector on each. The collector only fetches public pages, obeys
 * robots.txt and paces requests per host. No model, OCR or Plota requests, and no database writes.
 *
 * Each council is labelled:
 * - documents_readable: an application PDF was read as text (the source of floor and site areas);
 * - documents_need_ocr: PDFs retrieved but scanned, so research would pay for OCR;
 * - page_only: the application page was read (it names the reference) but no document;
 * - page_unverified: a page was fetched but never names the reference (a script shell or landing page);
 * - blocked: robots.txt disallows the page or documents, or the page could not be retrieved;
 * - no_council_url / no_sample.
 *
 * Progress is appended to a JSONL file, so an interrupted run resumes where it stopped.
 * Run from apps/web:
 *   ../../node_modules/.bin/tsx scripts/audit-council-access.ts [--councils=a,b] [--per-council=3] [--concurrency=8] [--out=name]
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { collectCouncilResearchSources } from '../src/lib/planning-intelligence/research-sources'
import { planningDocumentCoverageRecord, type PlanningDocumentCoverageRecord } from '../src/lib/planning-intelligence/research-coverage'
import type { PlotaApplication } from '../src/lib/planning-intelligence/types'

loadEnvConfig(process.cwd())

const args = new Map(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=') as [string, string]))
const PER_COUNCIL = Number(args.get('per-council') ?? 3)
const CONCURRENCY = Number(args.get('concurrency') ?? 8)
const DAY = new Date().toISOString().slice(0, 10)
const OUT = args.get('out') ?? `council-access-${DAY}`
const progressFile = `reports/${OUT}.jsonl`

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
  global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(60000) }) },
})

type Label = 'documents_readable' | 'documents_need_ocr' | 'page_only' | 'page_unverified' | 'blocked' | 'no_council_url' | 'no_sample'

interface CouncilResult {
  council: string
  label: Label
  sampled: number
  pagesRead: number
  pagesNamingReference: number
  pdfsRead: number
  formsRead: number
  needOcr: number
  blockedBy: string | null
  councilHost: string | null
  portalFamily: string | null
  applications: Array<Pick<PlanningDocumentCoverageRecord, 'reference' | 'outcome' | 'applicationFormRetrieved' | 'locallyReadableDocuments' | 'documentsNeedingOcr' | 'failureReason' | 'councilHost' | 'portalFamily'>>
}

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)

async function sample(council: string) {
  const { data, error } = await db.from('planning_applications')
    .select('reference,documents_count,commercial_work,raw')
    .eq('authority_slug', council).eq('intelligence_tier', true)
    .gte('date_received', daysAgo(150)).lte('date_received', daysAgo(30))
    .order('date_received', { ascending: false }).limit(40)
  if (error) throw error
  return (data ?? [])
    .filter(row => (row.raw as PlotaApplication | null)?.links?.council)
    .sort((a, b) => Number((b.documents_count ?? 0) > 0) - Number((a.documents_count ?? 0) > 0)
      || Number(Boolean(b.commercial_work)) - Number(Boolean(a.commercial_work)))
    .slice(0, PER_COUNCIL)
}

function label(records: PlanningDocumentCoverageRecord[], hadUrl: boolean): { label: Label; blockedBy: string | null } {
  if (records.length === 0) return { label: hadUrl ? 'no_sample' : 'no_council_url', blockedBy: null }
  if (records.some(r => r.locallyReadableDocuments > 0)) return { label: 'documents_readable', blockedBy: null }
  if (records.some(r => r.documentsNeedingOcr > 0)) return { label: 'documents_need_ocr', blockedBy: null }
  const reason = records.map(r => r.failureReason).find(Boolean) ?? null
  // The application page alone still gives research the proposal, parties and often use classes.
  if (records.some(r => r.councilPageMentionsReference)) return { label: 'page_only', blockedBy: reason }
  if (records.some(r => r.councilPageAccessible)) return { label: 'page_unverified', blockedBy: reason }
  return { label: 'blocked', blockedBy: reason }
}

async function auditCouncil(council: string): Promise<CouncilResult> {
  const rows = await sample(council)
  const records: PlanningDocumentCoverageRecord[] = []
  for (const row of rows) {
    const application = row.raw as PlotaApplication
    try {
      const collected = await collectCouncilResearchSources(application)
      records.push(planningDocumentCoverageRecord({ application, declaredDocumentCount: row.documents_count, collected }))
    } catch (error) {
      records.push(planningDocumentCoverageRecord({
        application, declaredDocumentCount: row.documents_count,
        collected: { sources: [], warnings: [`Council page could not be read: ${error instanceof Error ? error.message : 'unknown error'}`] },
      }))
    }
  }
  const { label: councilLabel, blockedBy } = label(records, rows.length > 0)
  return {
    council, label: councilLabel, sampled: records.length,
    pagesRead: records.filter(r => r.councilPageAccessible).length,
    pagesNamingReference: records.filter(r => r.councilPageMentionsReference).length,
    pdfsRead: records.filter(r => r.locallyReadableDocuments > 0).length,
    formsRead: records.filter(r => r.applicationFormRetrieved).length,
    needOcr: records.filter(r => r.documentsNeedingOcr > 0).length,
    blockedBy,
    councilHost: records[0]?.councilHost ?? null,
    portalFamily: records[0]?.portalFamily ?? null,
    applications: records.map(r => ({
      reference: r.reference, outcome: r.outcome, applicationFormRetrieved: r.applicationFormRetrieved,
      locallyReadableDocuments: r.locallyReadableDocuments, documentsNeedingOcr: r.documentsNeedingOcr,
      failureReason: r.failureReason, councilHost: r.councilHost, portalFamily: r.portalFamily,
    })),
  }
}

async function main() {
  mkdirSync('reports', { recursive: true })
  const councils: string[] = args.get('councils')?.split(',') ?? ((await db.from('planning_authority_coverage')
    .select('authority_slug').order('authority_slug')).data ?? []).map((row: { authority_slug: string }) => row.authority_slug)
  const done = new Map<string, CouncilResult>()
  if (existsSync(progressFile)) {
    for (const line of readFileSync(progressFile, 'utf8').split('\n').filter(Boolean)) {
      const result = JSON.parse(line) as CouncilResult
      done.set(result.council, result)
    }
  }
  const queue = councils.filter(council => !done.has(council))
  console.log(JSON.stringify({ councils: councils.length, alreadyDone: done.size, remaining: queue.length }))

  let finished = done.size
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    for (let council = queue.shift(); council; council = queue.shift()) {
      const result = await auditCouncil(council)
      appendFileSync(progressFile, JSON.stringify(result) + '\n')
      done.set(council, result)
      finished++
      if (finished % 20 === 0) console.log(`${finished}/${councils.length}`)
    }
  }))

  const results = councils.map(council => done.get(council)!).filter(Boolean)
  const byLabel = results.reduce<Record<string, number>>((counts, r) => ({ ...counts, [r.label]: (counts[r.label] ?? 0) + 1 }), {})
  const byPortal = results.reduce<Record<string, Record<string, number>>>((groups, r) => {
    const key = r.portalFamily ?? 'unknown'
    groups[key] ??= {}
    groups[key][r.label] = (groups[key][r.label] ?? 0) + 1
    return groups
  }, {})
  const blockReasons = results.filter(r => r.blockedBy).reduce<Record<string, number>>((counts, r) => {
    const reason = r.blockedBy!.replace(/: .*$/, '').replace(/https?:\/\/\S+/g, '<url>')
    return { ...counts, [reason]: (counts[reason] ?? 0) + 1 }
  }, {})
  const summary = {
    at: new Date().toISOString(), perCouncil: PER_COUNCIL, councils: results.length, byLabel, byPortal,
    blockReasons: Object.entries(blockReasons).sort((a, b) => b[1] - a[1]).slice(0, 15),
    applications: results.reduce((n, r) => n + r.sampled, 0),
    applicationsWithReadablePdf: results.reduce((n, r) => n + r.pdfsRead, 0),
    applicationsWithForm: results.reduce((n, r) => n + r.formsRead, 0),
  }
  writeFileSync(`reports/${OUT}.json`, JSON.stringify({ summary, councils: results }, null, 2))
  console.log(JSON.stringify(summary, null, 2))
}

main().catch(error => { console.error(error); process.exit(1) })
