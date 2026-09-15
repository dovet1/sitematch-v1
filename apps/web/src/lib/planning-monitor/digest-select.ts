import type { DigestHighlight, DigestReport, MonitorRow } from './types'

/**
 * Turns a week's matched records and change events into deterministic counts, highlights and the
 * evidence packet the model may speak about. Pure: the runner loads, this decides. Every figure a
 * report shows is computed here, never by the model.
 */

export interface ChangeEvent {
  kind: 'observed' | 'stage_changed' | 'status_changed' | 'decided' | 'description_changed' | 'dwellings_changed' | 'dwellings_reviewed' | 'location_changed'
  applicationId: string | null
  developmentId: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  observedAt: string
}

export type ChangeCategory = 'approved' | 'refused' | 'withdrawn' | 'decided_other' | 'new' | 'late_discovery' | 'proposal_changed' | 'dwellings_changed'

export interface CategorisedChange {
  row: MonitorRow
  categories: ChangeCategory[]
  watched: boolean
}

/** How far before the period an application may have been received and still count as new, not a late discovery. */
export const NEW_APPLICATION_GRACE_DAYS = 14

const DECISION_STAGES = new Set(['approved', 'refused', 'withdrawn'])

const UK_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' })

/**
 * The UK calendar date (YYYY-MM-DD) of an instant. Council dates are UK calendar dates, and a
 * period boundary is local midnight, which in summer is 23:00 UTC the day before; slicing the
 * ISO string would put the whole week one day early.
 */
export function ukDate(instant: string | number): string {
  return UK_DATE.format(new Date(instant))
}

/** A calendar date moved by whole days, independent of clock changes. */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
}

/** The UK calendar dates a period [start, end) covers, as an inclusive first day and an exclusive end day. */
export function periodDates(periodStart: string, periodEnd: string): { startDate: string; endDate: string } {
  return { startDate: ukDate(periodStart), endDate: ukDate(periodEnd) }
}

/** Only the scheme's own application states its homes; follow-ons restate a permission already counted. */
const HOME_STATING_ROLES = new Set(['primary', 'principal'])

function decisionCategory(stage: string | null): ChangeCategory {
  if (stage === 'approved' || stage === 'refused' || stage === 'withdrawn') return stage
  return 'decided_other'
}

/**
 * Categorise each matched record by what happened to it in [periodStart, periodEnd).
 * `decidedInPeriod` covers records whose decision date falls in the period even if the ledger
 * holds no event for them (for example the first week after the ledger began).
 */
export function categoriseChanges(input: {
  rows: MonitorRow[]
  events: ChangeEvent[]
  periodStart: string
  periodEnd: string
  kind: 'initial' | 'preview' | 'scheduled'
}): CategorisedChange[] {
  const { startDate, endDate } = periodDates(input.periodStart, input.periodEnd)
  const graceStart = addDays(startDate, -NEW_APPLICATION_GRACE_DAYS)
  const byApplication = new Map<string, ChangeEvent[]>()
  const byDevelopment = new Map<string, ChangeEvent[]>()
  for (const event of input.events) {
    if (event.applicationId) byApplication.set(event.applicationId, [...(byApplication.get(event.applicationId) ?? []), event])
    else if (event.developmentId) byDevelopment.set(event.developmentId, [...(byDevelopment.get(event.developmentId) ?? []), event])
  }

  const result: CategorisedChange[] = []
  for (const row of input.rows) {
    const categories = new Set<ChangeCategory>()
    const events = [
      ...(byApplication.get(row.applicationId) ?? []),
      ...(row.developmentId ? byDevelopment.get(row.developmentId) ?? [] : []),
    ]
    for (const event of events) {
      switch (event.kind) {
        case 'observed':
          // A record first seen this week but received long before is newly found, not newly submitted.
          if (row.dateReceived && row.dateReceived < graceStart) categories.add('late_discovery')
          else categories.add('new')
          if (row.stage && DECISION_STAGES.has(row.stage) && row.dateDecided && row.dateDecided >= startDate) {
            categories.add(decisionCategory(row.stage))
          }
          break
        case 'stage_changed':
          if (typeof event.after?.stage === 'string' && (DECISION_STAGES.has(event.after.stage) || event.after.stage === 'decided')) {
            categories.add(decisionCategory(event.after.stage === 'decided' ? null : event.after.stage))
          }
          break
        case 'decided':
          categories.add(decisionCategory((event.after?.stage as string | undefined) ?? row.stage))
          break
        case 'description_changed':
          categories.add('proposal_changed')
          break
        case 'dwellings_changed':
        case 'dwellings_reviewed':
          categories.add('dwellings_changed')
          break
        default:
          // Status wording and location refinements are recorded but are not headline changes.
          break
      }
    }
    // Initial and preview reports are snapshots of recent activity, read from the record dates.
    if (input.kind !== 'scheduled' || events.length === 0) {
      if (row.dateDecided && row.dateDecided >= startDate && row.dateDecided < endDate) categories.add(decisionCategory(row.stage))
      if (input.kind !== 'scheduled' && row.dateReceived && row.dateReceived >= startDate && row.dateReceived < endDate) categories.add('new')
    }
    // One outcome per record: a decision supersedes the provisional decided_other.
    if (categories.has('decided_other') && [...categories].some((c) => c === 'approved' || c === 'refused' || c === 'withdrawn')) {
      categories.delete('decided_other')
    }
    if (categories.size > 0) result.push({ row, categories: [...categories], watched: row.watched })
  }
  return result
}

function groupKey(row: MonitorRow): string {
  return row.developmentId ?? `app:${row.applicationId}`
}

export function countChanges(changes: CategorisedChange[]): NonNullable<DigestReport['counts']> {
  const has = (change: CategorisedChange, category: ChangeCategory) => change.categories.includes(category)
  const newOnes = changes.filter((c) => has(c, 'new'))
  const approvals = changes.filter((c) => has(c, 'approved'))

  // Homes are counted from the approval of the scheme's own application only. Reserved matters,
  // amendments and discharges restate a permission that was counted when it was granted, possibly
  // in an earlier week, so approving them adds no homes. A standalone application has no role.
  // A family still waiting for its original permission contributes nothing to the confident total.
  const homesByDevelopment = new Map<string, number>()
  const unresolved = new Set<string>()
  for (const change of approvals) {
    const row = change.row
    if (!row.isResidential || row.dwellings == null) continue
    if (row.developmentId && !HOME_STATING_ROLES.has(row.developmentRole ?? '')) continue
    if (row.familyState === 'awaiting_original') {
      unresolved.add(groupKey(row))
      continue
    }
    homesByDevelopment.set(groupKey(row), Math.max(homesByDevelopment.get(groupKey(row)) ?? 0, row.dwellings))
  }
  for (const change of changes) if (change.row.familyState === 'awaiting_original') unresolved.add(groupKey(change.row))

  return {
    newApplications: newOnes.length,
    newDevelopments: new Set(newOnes.map((c) => groupKey(c.row))).size,
    decisions: changes.filter((c) => c.categories.some((k) => k === 'approved' || k === 'refused' || k === 'withdrawn' || k === 'decided_other')).length,
    approvals: approvals.length,
    refusals: changes.filter((c) => has(c, 'refused')).length,
    withdrawals: changes.filter((c) => has(c, 'withdrawn')).length,
    lateDiscoveries: changes.filter((c) => has(c, 'late_discovery')).length,
    knownNewDwellings: [...homesByDevelopment.values()].reduce((sum, n) => sum + n, 0),
    unresolvedFamilies: unresolved.size,
    watchedChanges: changes.filter((c) => c.watched).length,
  }
}

function priority(change: CategorisedChange): number {
  const row = change.row
  let score = 0
  if (change.categories.includes('approved')) score += 400
  if (change.categories.includes('refused')) score += 250
  if (change.categories.includes('new')) score += 200
  if (change.categories.includes('withdrawn')) score += 120
  if (change.categories.includes('late_discovery')) score += 80
  if (change.categories.includes('proposal_changed') || change.categories.includes('dwellings_changed')) score += 60
  if (row.isCommercial) score += 90
  if (row.dwellings != null) score += Math.min(300, row.dwellings)
  if (row.nearConfirmed) score += 150
  if (change.watched) score += 500
  // Paperwork on an existing scheme is rarely the story.
  if (row.developmentRole === 'condition' || row.developmentRole === 'related') score -= 300
  return score
}

/** One entry per development, best first. */
export function rankChanges(changes: CategorisedChange[]): CategorisedChange[] {
  const best = new Map<string, CategorisedChange>()
  for (const change of changes) {
    const key = groupKey(change.row)
    const current = best.get(key)
    if (!current || priority(change) > priority(current)) best.set(key, change)
  }
  return [...best.values()].sort((a, b) => priority(b) - priority(a) || a.row.applicationId.localeCompare(b.row.applicationId))
}

const CATEGORY_WORDS: Record<ChangeCategory, string> = {
  approved: 'Approved',
  refused: 'Refused',
  withdrawn: 'Withdrawn',
  decided_other: 'Decided',
  new: 'New application',
  late_discovery: 'Newly found',
  proposal_changed: 'Proposal amended',
  dwellings_changed: 'Home count updated',
}

export function typeLabel(row: Pick<MonitorRow, 'isResidential' | 'isCommercial' | 'dwellings'>): string {
  const parts: string[] = []
  if (row.isResidential) parts.push(row.dwellings != null ? `Residential · ${row.dwellings.toLocaleString('en-GB')} homes` : 'Residential')
  if (row.isCommercial) parts.push('Commercial')
  return parts.join(' + ') || 'Scheme'
}

export function toHighlight(change: CategorisedChange): DigestHighlight {
  const row = change.row
  const lead = change.categories
    .slice()
    .sort((a, b) => Object.keys(CATEGORY_WORDS).indexOf(a) - Object.keys(CATEGORY_WORDS).indexOf(b))[0]
  return {
    applicationId: row.applicationId,
    developmentId: row.developmentId,
    reference: row.reference,
    authorityName: row.authorityName,
    address: row.address,
    headline: `${CATEGORY_WORDS[lead]} · ${typeLabel(row)}`,
    sourceUrl: row.sourceUrl,
    approximateLocation: row.locationProvenance !== 'source_exact',
  }
}

export interface EvidenceItem {
  id: string
  applicationId: string
  reference: string
  authority: string
  address: string
  description: string
  changes: string[]
  stage: string | null
  councilStatus: string | null
  dateReceived: string | null
  dateDecided: string | null
  type: string
  knownDwellings: number | null
  dwellingCountReviewedByPerson: boolean
  familyAwaitingOriginal: boolean
  approximateLocation: boolean
  nearSelectedStores: boolean | null
  watched: boolean
  sourceUrl: string | null
}

export const MAX_EVIDENCE_ITEMS = 40
const MAX_DESCRIPTION_CHARS = 500

export function evidencePacket(ranked: CategorisedChange[]): { items: EvidenceItem[]; omitted: number } {
  const items = ranked.slice(0, MAX_EVIDENCE_ITEMS).map((change, index): EvidenceItem => {
    const row = change.row
    return {
      id: `E${index + 1}`,
      applicationId: row.applicationId,
      reference: row.reference,
      authority: row.authorityName,
      address: row.address,
      description: row.description.length > MAX_DESCRIPTION_CHARS ? `${row.description.slice(0, MAX_DESCRIPTION_CHARS)}…` : row.description,
      changes: change.categories.map((c) => CATEGORY_WORDS[c]),
      stage: row.stage,
      councilStatus: row.status,
      dateReceived: row.dateReceived,
      dateDecided: row.dateDecided,
      type: typeLabel(row),
      knownDwellings: row.dwellings,
      dwellingCountReviewedByPerson: row.dwellingsReviewed,
      familyAwaitingOriginal: row.familyState === 'awaiting_original',
      approximateLocation: row.locationProvenance !== 'source_exact',
      // Only a confirmed straight-line match; approximate points never get a proximity claim.
      nearSelectedStores: row.locationProvenance === 'source_exact' ? row.nearConfirmed : null,
      watched: change.watched,
      sourceUrl: row.sourceUrl,
    }
  })
  return { items, omitted: Math.max(0, ranked.length - items.length) }
}
