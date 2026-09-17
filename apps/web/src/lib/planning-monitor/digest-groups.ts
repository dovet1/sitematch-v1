import type { DigestHighlight } from './types'

/**
 * How a week's report is laid out, shared by the in-app weekly panel and the email so the two
 * group identically. New applications are grouped by use; anything else the week touched
 * (decisions on older applications, amended proposals) follows in its own group. Reports written
 * before highlights carried categories fall into one flat group.
 */

export type DigestGroupId = 'residential' | 'commercial' | 'mixed' | 'decided' | 'changes'

export interface DigestGroup {
  id: DigestGroupId
  label: string
  items: DigestHighlight[]
}

const LABELS: Record<DigestGroupId, string> = {
  residential: 'Residential',
  commercial: 'Commercial',
  mixed: 'Mixed use',
  decided: 'Decided or updated this week',
  changes: 'Changes',
}

const ORDER: DigestGroupId[] = ['residential', 'commercial', 'mixed', 'decided', 'changes']

export function highlightGroup(h: DigestHighlight): DigestGroupId {
  if (!h.categories) return 'changes'
  if (!h.categories.includes('new')) return 'decided'
  if (h.isResidential && h.isCommercial) return 'mixed'
  return h.isCommercial ? 'commercial' : 'residential'
}

/** Newest first within a group, by the date that made it relevant. */
function sortDate(h: DigestHighlight): string {
  const g = highlightGroup(h)
  return (g === 'decided' ? h.dateDecided : h.dateValidated ?? h.dateReceived) ?? ''
}

export function groupHighlights(highlights: DigestHighlight[]): DigestGroup[] {
  const groups = new Map<DigestGroupId, DigestHighlight[]>()
  for (const h of highlights) {
    const id = highlightGroup(h)
    groups.set(id, [...(groups.get(id) ?? []), h])
  }
  return ORDER.filter((id) => groups.has(id)).map((id) => ({
    id,
    label: LABELS[id],
    items: [...(groups.get(id) as DigestHighlight[])].sort((a, b) => sortDate(b).localeCompare(sortDate(a))),
  }))
}

const STAGE_WORDS: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  refused: 'Refused',
  withdrawn: 'Withdrawn',
  decided: 'Decided',
  other: 'Other',
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Fixed month names: ICU versions differ ("Sep" / "Sept") between the server and browsers.
function shortDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return null
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`
}

/** "88 dwellings · Validated 12 Sep · Kirklees": the row's meta line, in the panel and the email. */
export function highlightMeta(h: DigestHighlight): string {
  const parts: string[] = []
  if (h.isResidential && h.dwellings != null) parts.push(`${h.dwellings.toLocaleString('en-GB')} dwellings`)
  else if (h.isCommercial) parts.push('Commercial')
  const decided = h.stage && h.stage !== 'pending' && h.dateDecided
  if (decided) parts.push(`${STAGE_WORDS[h.stage as string] ?? h.stage} ${shortDate(h.dateDecided)}`)
  else if (h.dateValidated) parts.push(`Validated ${shortDate(h.dateValidated)}`)
  else if (h.dateReceived) parts.push(`Received ${shortDate(h.dateReceived)}`)
  else if (h.stage) parts.push(STAGE_WORDS[h.stage] ?? h.stage)
  parts.push(h.authorityName)
  return parts.join(' · ')
}

/** "7–13 September 2026" from a report's [start, end) instants, in UK dates. */
export function weekRangeLabel(periodStart: string, periodEnd: string, withYear = true): string {
  const uk = (instant: string) => new Date(`${new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date(instant))}T00:00:00Z`)
  const start = uk(periodStart)
  const end = new Date(uk(periodEnd).getTime() - 86_400_000)
  const day = (d: Date) => d.getUTCDate()
  const month = (d: Date) => new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' }).format(d)
  const year = withYear ? ` ${end.getUTCFullYear()}` : ''
  if (start.getUTCMonth() === end.getUTCMonth()) return `${day(start)}–${day(end)} ${month(end)}${year}`
  return `${day(start)} ${MONTHS[start.getUTCMonth()]} – ${day(end)} ${month(end)}${year}`
}
