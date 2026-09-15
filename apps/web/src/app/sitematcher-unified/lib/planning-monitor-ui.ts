import { PROCEDURES, type MonitorCriteria } from '@/lib/planning-monitor/criteria'
import type { MonitorRow, MonitorTotals } from '@/lib/planning-monitor/types'
import type { PlanningApplication, RefBrand } from '../types/unified-workspace'

/** Presentation rules for Planning mode, kept pure so they can be tested without a map or DOM. */

// Planning mode's dark basemap, so residential/commercial markers and the patch outline read clearly.
export const PLANNING_STYLE = 'mapbox://styles/mapbox/dark-v11'

export const MILE_METERS = 1609.344

export function milesLabel(meters: number): string {
  const miles = meters / MILE_METERS
  return `${Number.isInteger(Math.round(miles * 10) / 10) ? Math.round(miles) : miles.toFixed(1)} mi`
}

const STAGE_LABELS: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  refused: 'Refused',
  withdrawn: 'Withdrawn',
  decided: 'Decided',
  other: 'Other',
}

export function stageLabel(stage: string | null): string {
  return stage ? STAGE_LABELS[stage] ?? stage : 'Status unknown'
}

export const PROCEDURE_LABELS: Record<keyof typeof PROCEDURES, string> = {
  full: 'Full',
  outline: 'Outline',
  reserved_matters: 'Reserved matters',
  prior_approval: 'Prior approval',
  paperwork: 'Conditions & amendments',
  other: 'Other',
}

export const WORK_LABELS: Record<string, string> = {
  new: 'New premises',
  extension: 'Extensions',
  'to-commercial': 'Change to commercial',
  between: 'Change between commercial uses',
  loss: 'Commercial loss',
}

const DATE_PRESET_LABELS: Record<string, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  this_year: 'This year',
  all: 'All available history',
  custom: 'Custom dates',
}

export function formatShortDate(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
}

export function relativeDays(iso: string | null, today = new Date()): string | null {
  if (!iso) return null
  const days = Math.round((Date.parse(today.toISOString().slice(0, 10)) - Date.parse(iso.slice(0, 10))) / 86_400_000)
  if (!Number.isFinite(days)) return null
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days}d ago`
  return formatShortDate(iso)
}

export type ChipTone = 'patch' | 'estate' | 'plain'
export interface CriteriaChip {
  key: string
  label: string
  tone: ChipTone
}

/** The criteria chips under the summary card. Only controls that exist at launch produce chips. */
export function criteriaChips(input: {
  criteria: MonitorCriteria
  patchLabel: string | null
  brands: RefBrand[]
}): CriteriaChip[] {
  const { criteria } = input
  const chips: CriteriaChip[] = []
  if (input.patchLabel) chips.push({ key: 'patch', label: input.patchLabel, tone: 'patch' })
  if (criteria.proximity) {
    const names = criteria.proximity.brandIds.map((id) => input.brands.find((b) => b.id === id)?.name).filter(Boolean) as string[]
    const who = names.length === 0 ? 'selected stores' : names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} +${names.length - 2}`
    chips.push({ key: 'proximity', label: `Within ${milesLabel(criteria.proximity.radiusMeters)} of ${who}`, tone: 'estate' })
  }
  if (criteria.residential.enabled) chips.push({ key: 'residential', label: `Residential ≥${criteria.residential.minDwellings} homes`, tone: 'plain' })
  if (criteria.commercial.enabled) {
    const work = criteria.commercial.work
    chips.push({
      key: 'commercial',
      label: work.length === 0 ? 'Commercial' : `Commercial: ${work.map((w) => WORK_LABELS[w]?.toLowerCase() ?? w).join(', ')}`,
      tone: 'plain',
    })
  }
  const dateField = criteria.dates.field === 'received' ? '' : `${criteria.dates.field} · `
  const dateLabel =
    criteria.dates.preset === 'custom'
      ? `${formatShortDate(criteria.dates.from) ?? 'Any'} – ${formatShortDate(criteria.dates.to) ?? 'now'}`
      : DATE_PRESET_LABELS[criteria.dates.preset]
  chips.push({ key: 'dates', label: `${dateField ? dateField[0].toUpperCase() + dateField.slice(1) : ''}${dateLabel}`, tone: 'plain' })
  if (criteria.stages.length) chips.push({ key: 'stages', label: criteria.stages.map(stageLabel).join(', '), tone: 'plain' })
  if (criteria.procedures.length) chips.push({ key: 'procedures', label: criteria.procedures.map((p) => PROCEDURE_LABELS[p]).join(', '), tone: 'plain' })
  if (criteria.keywords.include.length) chips.push({ key: 'include', label: `Mentions: ${criteria.keywords.include.join(', ')}`, tone: 'plain' })
  if (criteria.keywords.exclude.length) chips.push({ key: 'exclude', label: `Excludes: ${criteria.keywords.exclude.join(', ')}`, tone: 'plain' })
  if (criteria.watchedOnly) chips.push({ key: 'watched', label: 'Watched only', tone: 'plain' })
  if (criteria.exactLocationsOnly) chips.push({ key: 'exact', label: 'Exact locations only', tone: 'plain' })
  return chips
}

/** "18 developments · 31 applications" — both units always named. */
export function countsLabel(totals: Pick<MonitorTotals, 'applications' | 'developments'>): string {
  const n = (value: number, one: string, many: string) => `${value.toLocaleString('en-GB')} ${value === 1 ? one : many}`
  return `${n(totals.developments, 'development', 'developments')} · ${n(totals.applications, 'application', 'applications')}`
}

export type MarkerKind = 'residential' | 'commercial' | 'mixed'

export function markerKind(row: Pick<MonitorRow, 'isResidential' | 'isCommercial'>): MarkerKind {
  if (row.isResidential && row.isCommercial) return 'mixed'
  return row.isCommercial ? 'commercial' : 'residential'
}

export function rowTitle(row: MonitorRow): string {
  const place = row.address || `${row.authorityName} ${row.reference}`
  if (row.isResidential && row.dwellings != null) return `${place} — ${row.dwellings.toLocaleString('en-GB')} homes`
  return place
}

export function rowMeta(row: MonitorRow): string {
  const parts: string[] = []
  if (row.isResidential && row.isCommercial) parts.push('Residential + commercial')
  else parts.push(row.isCommercial ? 'Commercial' : 'Residential')
  const decided = row.dateDecided && row.stage && row.stage !== 'pending'
  parts.push(decided ? `${stageLabel(row.stage)} ${relativeDays(row.dateDecided) ?? ''}`.trim() : `${stageLabel(row.stage)} · received ${relativeDays(row.dateReceived) ?? 'date unknown'}`)
  if (row.matchedApplications > 1) parts.push(`${row.matchedApplications} applications`)
  return parts.join(' · ')
}

/** Why a location is shown, in words: never colour alone. */
export function locationNote(row: Pick<MonitorRow, 'locationProvenance' | 'inside'>): string | null {
  if (row.locationProvenance === 'source_exact') return null
  const what = row.locationProvenance === 'postcode_centroid' ? 'postcode centre' : 'area centre'
  return row.inside ? `Approximate location (${what})` : `Approximate location (${what}) — may be in this area`
}

/** The existing planning detail modal's shape. Rows never carry applicant or agent details. */
export function toPlanningApplication(row: MonitorRow): PlanningApplication {
  return {
    name: `${row.authorityName}/${row.reference}`,
    uid: row.providerId,
    address: row.address,
    appSize: '',
    appState: row.status ?? stageLabel(row.stage),
    appType: row.planningRoute ?? row.procedure ?? row.commercialWork ?? '',
    description: row.description,
    url: row.sourceUrl ?? '',
    lat: row.lat,
    lng: row.lng,
    decidedDate: row.dateDecided,
    dateValidated: row.dateValidated,
    dateReceived: row.dateReceived,
    nDwellings: row.dwellings,
    dwellingCountReviewed: row.dwellingsReviewed,
    applicantAddress: null,
    agentAddress: null,
    provider: 'plota',
    developmentId: row.developmentId,
    developmentRole: row.developmentRole,
    familyState: row.familyState,
    locationProvenance: row.locationProvenance,
    locationUncertaintyM: row.locationUncertaintyM,
    insideBoundary: row.inside,
    commercialWork: row.commercialWork,
  }
}

/**
 * Where to put the popover so it sits beside its marker, never on it, and stays on screen.
 * Prefers the right of the marker, then the left, then above, then below; clamps into view.
 */
export function placePopover(input: {
  anchor: { x: number; y: number }
  size: { width: number; height: number }
  viewport: { width: number; height: number }
  gap?: number
  margin?: number
}): { left: number; top: number; side: 'right' | 'left' | 'above' | 'below' } {
  const gap = input.gap ?? 18
  const margin = input.margin ?? 12
  const { anchor, size, viewport } = input
  const clampY = (top: number) => Math.min(Math.max(top, margin), Math.max(margin, viewport.height - size.height - margin))
  const clampX = (left: number) => Math.min(Math.max(left, margin), Math.max(margin, viewport.width - size.width - margin))
  if (anchor.x + gap + size.width + margin <= viewport.width) {
    return { left: anchor.x + gap, top: clampY(anchor.y - size.height / 2), side: 'right' }
  }
  if (anchor.x - gap - size.width >= margin) {
    return { left: anchor.x - gap - size.width, top: clampY(anchor.y - size.height / 2), side: 'left' }
  }
  if (anchor.y - gap - size.height >= margin) {
    return { left: clampX(anchor.x - size.width / 2), top: anchor.y - gap - size.height, side: 'above' }
  }
  return { left: clampX(anchor.x - size.width / 2), top: Math.min(anchor.y + gap, viewport.height - size.height - margin), side: 'below' }
}

/** "Residential · 320 homes", "Commercial", or both for a mixed scheme. Never states an unknown count. */
export function typeLabelFor(row: Pick<MonitorRow, 'isResidential' | 'isCommercial' | 'dwellings'>): string {
  const parts: string[] = []
  if (row.isResidential) parts.push(row.dwellings != null ? `Residential · ${row.dwellings.toLocaleString('en-GB')} homes` : 'Residential')
  if (row.isCommercial) parts.push('Commercial')
  return parts.join(' + ') || 'Scheme'
}
