/** Pilot completion plan, step 3a: how many development assessments a grouped run needs.
 *
 * Read-only; no provider or model calls and no writes. For each council it links the stored
 * applications in memory and plans assessments two ways:
 * - `tierNow`: the applications in the intelligence tier today (what a re-grade covers);
 * - `withArchiveBacklog`: the tier plus archive records from 2025-09-10 to 2025-12-31 that the
 *   description-based commercial limbs would admit (what the 1 October backlog adds).
 * It reports applications against separate assessments, paperwork joining timelines, schemes
 * waiting for parent retrieval and uncertain links kept separate.
 *
 * Run from apps/web:
 *   ../../node_modules/.bin/tsx scripts/report-grouped-assessments.ts [--councils=a,b]
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { countAssessments, planCouncilAssessments, type AssessableApplication, type AssessmentCounts } from '../src/lib/planning-intelligence/assessment-groups'
import { decideEligibility } from '../src/lib/planning-intelligence/eligibility'
import { linkCouncilApplications } from '../src/lib/planning-intelligence/linking'
import type { PlotaApplication } from '../src/lib/planning-intelligence/types'

loadEnvConfig(process.cwd())

const args = new Map(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=') as [string, string]))
const BACKLOG_FROM = '2025-09-10'
const BACKLOG_TO = '2025-12-31'

type Row = {
  id: string; reference: string; description: string | null; procedure: string | null; address: string | null
  postcode: string | null; uprn: string | null; intelligence_tier: boolean; date_received: string | null
  source_kind: string | null; commercial_work: string | null; stated_dwelling_count: number | null; classification_state: string
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
  global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(30000) }) },
})

async function withRetry<T>(label: string, run: () => PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const { data, error } = await run()
    if (!error && data) return data
    if (attempt >= 4) throw new Error(`${label}: ${JSON.stringify(error)}`)
    await new Promise(resolve => setTimeout(resolve, 2000 * attempt))
  }
}

async function councilRows(council: string): Promise<Row[]> {
  const rows: Row[] = []
  for (let from = 0; ; from += 1000) {
    const page = await withRetry(`${council}@${from}`, () => db.from('planning_applications')
      .select('id,reference,description,procedure,address,postcode,uprn,intelligence_tier,date_received,source_kind,commercial_work,stated_dwelling_count,classification_state')
      .eq('authority_slug', council).order('id').range(from, from + 999))
    rows.push(...(page as Row[]))
    if (page.length < 1000) return rows
  }
}

function backlogAdmits(row: Row): boolean {
  if (row.intelligence_tier || row.source_kind !== 'historical' || row.classification_state !== 'not_eligible') return false
  if (!row.date_received || row.date_received < BACKLOG_FROM || row.date_received > BACKLOG_TO) return false
  const decision = decideEligibility({
    id: row.id, reference: row.reference, authority: { slug: '', name: '' },
    description: row.description, procedure: row.procedure, source: row.source_kind,
    commercial_work: row.commercial_work, dwelling_count: row.stated_dwelling_count,
  } as PlotaApplication)
  return decision.intelligenceTier && decision.limbs.some(limb => limb.endsWith('-described'))
}

function add(total: AssessmentCounts, part: AssessmentCounts) {
  for (const key of Object.keys(part) as Array<keyof AssessmentCounts>) total[key] += part[key]
}
const zero = (): AssessmentCounts => ({
  tierApplications: 0, assessments: 0, tierReadInsideAnotherAssessment: 0, tierPaperworkOnTimeline: 0,
  tierAwaitingParent: 0, assessmentsAlsoRequestingParent: 0, uncertainKeptSeparate: 0, nonTierInTierFamilies: 0,
})

async function main() {
  const councils = args.get('councils')?.split(',')
    ?? (await withRetry('councils', () => db.from('planning_authority_coverage').select('authority_slug').order('authority_slug')))
      .map((row: { authority_slug: string }) => row.authority_slug)
  const totals = { councils: 0, applications: 0, tierNow: zero(), withArchiveBacklog: zero(), backlogAdmitted: 0 }
  const perCouncil: Record<string, unknown>[] = []

  for (const council of councils) {
    const rows = await councilRows(council)
    const applications = rows.map(row => ({ ...row, description: row.description ?? '' }))
    const linked = linkCouncilApplications(applications)
    const now: AssessableApplication[] = applications
    const withBacklog: AssessableApplication[] = applications.map(row => backlogAdmits(row) ? { ...row, intelligence_tier: true } : row)
    const tierNow = countAssessments(now, planCouncilAssessments(now, linked))
    const backlog = countAssessments(withBacklog, planCouncilAssessments(withBacklog, linked))
    const admitted = withBacklog.filter(row => row.intelligence_tier).length - tierNow.tierApplications

    totals.councils++
    totals.applications += rows.length
    totals.backlogAdmitted += admitted
    add(totals.tierNow, tierNow)
    add(totals.withArchiveBacklog, backlog)
    perCouncil.push({ council, applications: rows.length, tierNow, withArchiveBacklog: backlog, backlogAdmitted: admitted })
    if (totals.councils % 25 === 0) console.log(JSON.stringify({ through: council, ...totals }))
  }

  mkdirSync('reports', { recursive: true })
  const file = `reports/grouped-assessments-${new Date().toISOString().slice(0, 10)}.json`
  writeFileSync(file, JSON.stringify({ at: new Date().toISOString(), totals, perCouncil }, null, 2))
  console.log(JSON.stringify(totals, null, 2))
  console.log(`wrote ${file}`)
}

main().catch(error => { console.error(error); process.exitCode = 1 })
