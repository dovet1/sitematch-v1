import { MAP_STYLES } from '@/lib/sitesketcher-v2/constants'
import { MIN_RESIDENTIAL_DWELLINGS, defaultCriteria, type DatePreset, type MonitorCriteria } from '@/lib/planning-monitor/criteria'
import type { BBox, DigestHighlight, MonitorRow, MonitorTotals } from '@/lib/planning-monitor/types'
import { isApproximateLocation } from '@/lib/planning-intelligence/location-provenance'
import type { PlanningApplication, RefBrand } from '../types/unified-workspace'

/** Presentation rules for Planning mode, kept pure so they can be tested without a map or DOM. */

// Planning uses the same satellite basemap as the other discovery modes.
export const PLANNING_STYLE = MAP_STYLES.hybrid

export const MILE_METERS = 1609.344

/** Use colours, shared by pins, rows, chips and the legend. */
export const USE_COLORS = {
  residential: { solid: '#7033FF', text: '#5421CC', tint: '#EEE9FF', soft: '#F7F4FF', border: '#E3DEFA' },
  commercial: { solid: '#0F9B8E', text: '#0B7D72', tint: '#E4F5F2', soft: '#F0FAF8', border: '#D6F0EC' },
  mixed: { solid: '#F26B1F', text: '#B4531A', tint: '#FDEEE3', soft: '#FDF6F0', border: '#F7DCC7' },
} as const

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

/** The existing commercial scheme contract (`commercial_work`), shown as the Commercial card's chips. */
export const WORK_LABELS: Record<string, string> = {
  new: 'New premises',
  extension: 'Extensions',
  'to-commercial': 'Change to commercial',
  between: 'Change of commercial use',
  loss: 'Loss of commercial',
}

/** The time-frame pills, in order. Saved patches may still carry `this_year`, `all` or `custom`. */
export const TIME_FRAMES: Array<{ id: DatePreset; label: string }> = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '3 months' },
  { id: '12m', label: '12 months' },
]

const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 3 months',
  '12m': 'Last 12 months',
  this_year: 'This year',
  all: 'All history',
  custom: 'Custom dates',
}

export const RADIUS_MILES = [0.5, 1, 2, 3, 5, 10] as const

export function formatShortDate(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "14 Sep" — the compact date used on mono meta lines. Fixed names: ICU versions differ ("Sept"). */
export function formatDayMonth(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return null
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`
}

export function timeFrameLabel(criteria: MonitorCriteria): string {
  if (criteria.dates.preset !== 'custom') return DATE_PRESET_LABELS[criteria.dates.preset]
  return `${formatShortDate(criteria.dates.from) ?? 'Any'} – ${formatShortDate(criteria.dates.to) ?? 'now'}`
}

export function dateFieldHelp(criteria: MonitorCriteria): string {
  switch (criteria.dates.field) {
    case 'validated':
      return 'Dated on validation by the council.'
    case 'decided':
      return 'Dated on the council’s decision.'
    default:
      return 'Dated on when the council received the application.'
  }
}

export type ChipTone = 'neutral' | 'residential' | 'commercial'
export interface FilterChip {
  key: 'dates' | 'residential' | 'commercial' | 'proximity' | 'stages' | 'extra'
  label: string
  tone: ChipTone
  /** False for chips that summarise without a single undo (for example legacy refinements). */
  removable: boolean
}

function brandNames(ids: string[], brands: RefBrand[]): string {
  const names = ids.map((id) => brands.find((b) => b.id === id)?.name).filter(Boolean) as string[]
  if (names.length === 0) return 'chosen brands'
  return names.length <= 2 ? names.join(', ') : `${names[0]} +${names.length - 1}`
}

/** The filter summary chips: on the map, in the patch panel and in the name step. */
export function filterChips(criteria: MonitorCriteria, brands: RefBrand[]): FilterChip[] {
  const chips: FilterChip[] = [{ key: 'dates', label: timeFrameLabel(criteria), tone: 'neutral', removable: false }]
  // Both uses on is the unfiltered state, so neither gets a chip unless the other is off or narrowed.
  const both = criteria.residential.enabled && criteria.commercial.enabled
  if (criteria.residential.enabled && (!both || criteria.residential.minDwellings > MIN_RESIDENTIAL_DWELLINGS || criteria.commercial.work.length > 0)) {
    chips.push({ key: 'residential', label: `Residential ${criteria.residential.minDwellings}+`, tone: 'residential', removable: !both })
  }
  if (criteria.commercial.enabled && (!both || criteria.commercial.work.length > 0 || criteria.residential.minDwellings > MIN_RESIDENTIAL_DWELLINGS)) {
    const work = criteria.commercial.work
    const label = work.length === 0 ? 'Commercial' : work.length === 1 ? WORK_LABELS[work[0]] ?? work[0] : `${WORK_LABELS[work[0]] ?? work[0]} +${work.length - 1}`
    chips.push({ key: 'commercial', label, tone: 'commercial', removable: !both || work.length > 0 })
  }
  if (criteria.proximity) {
    chips.push({ key: 'proximity', label: `≤${milesLabel(criteria.proximity.radiusMeters)} from ${brandNames(criteria.proximity.brandIds, brands)}`, tone: 'neutral', removable: true })
  }
  if (criteria.stages.length) chips.push({ key: 'stages', label: criteria.stages.map(stageLabel).join(', '), tone: 'neutral', removable: true })
  // Controls the redesign no longer offers still apply when a saved patch carries them, so say so.
  const extras = [
    criteria.procedures.length ? 'route' : null,
    criteria.keywords.include.length || criteria.keywords.exclude.length ? 'keywords' : null,
    criteria.watchedOnly ? 'watched only' : null,
    criteria.exactLocationsOnly ? 'exact locations' : null,
  ].filter(Boolean)
  if (extras.length) chips.push({ key: 'extra', label: `Also: ${extras.join(', ')}`, tone: 'neutral', removable: true })
  return chips
}

/** Undo one chip. Returns the criteria with that filter lifted. */
export function removeFilterChip(criteria: MonitorCriteria, key: FilterChip['key']): MonitorCriteria {
  const next: MonitorCriteria = JSON.parse(JSON.stringify(criteria))
  const defaults = defaultCriteria()
  switch (key) {
    case 'residential':
      // Lifting one use filter means both uses count again.
      next.commercial.enabled = true
      next.residential = { enabled: true, minDwellings: MIN_RESIDENTIAL_DWELLINGS }
      break
    case 'commercial':
      next.residential.enabled = true
      next.commercial = { enabled: true, work: [] }
      break
    case 'proximity':
      next.proximity = null
      break
    case 'stages':
      next.stages = []
      break
    case 'extra':
      next.procedures = []
      next.keywords = defaults.keywords
      next.watchedOnly = false
      next.exactLocationsOnly = false
      break
    case 'dates':
      next.dates = defaults.dates
      break
  }
  return next
}

export function sameCriteria(a: MonitorCriteria, b: MonitorCriteria): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** "1,284 developments · 3,906 applications" — both units always named. */
export function countsLabel(totals: Pick<MonitorTotals, 'applications' | 'developments'>): string {
  const n = (value: number, one: string, many: string) => `${value.toLocaleString('en-GB')} ${value === 1 ? one : many}`
  return `${n(totals.developments, 'development', 'developments')} · ${n(totals.applications, 'application', 'applications')}`
}

export type MarkerKind = 'residential' | 'commercial' | 'mixed'

export function markerKind(row: Pick<MonitorRow, 'isResidential' | 'isCommercial'>): MarkerKind {
  if (row.isResidential && row.isCommercial) return 'mixed'
  return row.isCommercial ? 'commercial' : 'residential'
}

export const KIND_LABELS: Record<MarkerKind, string> = { residential: 'Residential', commercial: 'Commercial', mixed: 'Mixed use' }

export function rowTitle(row: Pick<MonitorRow, 'address' | 'authorityName' | 'reference'>): string {
  return row.address || `${row.authorityName} ${row.reference}`
}

/** The mono meta line: "320 dwellings · Approved 14 Sep" or "Change of commercial use · Validated 12 Sep". */
export function rowMeta(row: MonitorRow): string {
  const parts: string[] = []
  if (row.isResidential && row.dwellings != null) parts.push(`${row.dwellings.toLocaleString('en-GB')} dwellings`)
  else if (row.isCommercial) parts.push(row.commercialWork ? WORK_LABELS[row.commercialWork] ?? 'Commercial' : 'Commercial')
  const decided = row.dateDecided && row.stage && row.stage !== 'pending'
  if (decided) parts.push(`${stageLabel(row.stage)} ${formatDayMonth(row.dateDecided)}`)
  else if (row.dateValidated) parts.push(`${stageLabel(row.stage)} · validated ${formatDayMonth(row.dateValidated)}`)
  else parts.push(`${stageLabel(row.stage)}${row.dateReceived ? ` · received ${formatDayMonth(row.dateReceived)}` : ''}`)
  return parts.join(' · ')
}

/** Documents a row stands for: the development's full paperwork once known, else its matched records. */
export function documentCount(row: Pick<MonitorRow, 'matchedApplications' | 'developmentId'>, historyLength: number | null): number {
  if (row.developmentId && historyLength != null) return historyLength
  return Math.max(1, row.matchedApplications)
}

/** Added in the last seven days: the NEW badge on pins and rows. */
export function isNewRow(row: Pick<MonitorRow, 'dateValidated' | 'dateReceived'>, today: string): boolean {
  const date = row.dateValidated ?? row.dateReceived
  if (!date) return false
  const days = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date.slice(0, 10)}T00:00:00Z`)) / 86_400_000
  return days >= 0 && days <= 7
}

/** Why a location is shown, in words: never colour alone. */
export function locationNote(row: Pick<MonitorRow, 'locationProvenance'>): string | null {
  return isApproximateLocation(row.locationProvenance) ? 'Approximate location (area centre)' : null
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
 * Where to put the detail card so it sits beside its pin, never on it, and stays on screen.
 * Prefers the right of the pin, then the left, then above, then below; clamps into view.
 */
export function placePopover(input: {
  anchor: { x: number; y: number }
  size: { width: number; height: number }
  viewport: { width: number; height: number }
  gap?: number
  margin?: number
}): { left: number; top: number; side: 'right' | 'left' | 'above' | 'below' } {
  const gap = input.gap ?? 22
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

/** Map clusters stop zooming in here; a group still together at this zoom opens as a list. */
export const MAX_CLUSTER_ZOOM = 18

/** Degrees per server cluster cell at a zoom: the same sum as planning_monitor_clusters. */
export function clusterCellSize(zoom: number): number {
  return 360.0 / Math.pow(2, Math.min(Math.max(zoom, 0), 22)) * 64.0 / 512.0
}

function parseCellKey(cellKey: string): [number, number] | null {
  const match = /^(-?\d+):(-?\d+)$/.exec(cellKey)
  return match ? [Number(match[1]), Number(match[2])] : null
}

/** The box a server cluster cell covers, as [west, south, east, north]. */
export function cellBounds(cellKey: string, zoom: number): BBox | null {
  const cell = parseCellKey(cellKey)
  if (!cell) return null
  const size = clusterCellSize(zoom)
  return [cell[0] * size, cell[1] * size, (cell[0] + 1) * size, (cell[1] + 1) * size]
}

/** Whether a point falls in a cell, by the server's own floor rule (the box's edges are shared). */
export function inCell(lng: number, lat: number, cellKey: string, zoom: number): boolean {
  const cell = parseCellKey(cellKey)
  if (!cell) return false
  const size = clusterCellSize(zoom)
  return Math.floor(lng / size) === cell[0] && Math.floor(lat / size) === cell[1]
}

/** One entry in the list a stacked pin opens: a live row, or a point from an archived week. */
export type StackItem = { type: 'row'; row: MonitorRow } | { type: 'highlight'; highlight: DigestHighlight }

/** The key the list and detail card use for an item, so the card can offer a way back. */
export function stackItemKey(item: StackItem): string {
  if (item.type === 'row') return item.row.key
  const h = item.highlight
  // The developments list's key, as the archived pins use.
  return h.developmentId ?? `app:${h.applicationId}`
}

export interface StackItemView {
  key: string
  title: string
  description: string
  meta: string
  kind: MarkerKind
  approximate: boolean
}

export function stackItemView(item: StackItem): StackItemView {
  if (item.type === 'row') {
    const row = item.row
    return {
      key: row.key,
      title: rowTitle(row),
      description: row.description.trim(),
      meta: rowMeta(row),
      kind: markerKind(row),
      approximate: isApproximateLocation(row.locationProvenance),
    }
  }
  const h = item.highlight
  const date = h.dateDecided ?? h.dateValidated ?? h.dateReceived ?? null
  const meta = [
    h.isResidential && h.dwellings != null ? `${h.dwellings.toLocaleString('en-GB')} dwellings` : null,
    `${h.stage ? stageLabel(h.stage) : h.reference}${date ? ` ${formatDayMonth(date)}` : ''}`,
  ].filter(Boolean).join(' · ')
  return {
    key: stackItemKey(item),
    title: h.address || `${h.authorityName} ${h.reference}`,
    description: h.headline.trim(),
    meta,
    kind: markerKind({ isResidential: Boolean(h.isResidential), isCommercial: Boolean(h.isCommercial) }),
    approximate: h.approximateLocation,
  }
}

/** Groups an archived week's points that share a position (to about a metre), keeping their order. */
export function groupByPosition<T extends { lng?: number; lat?: number }>(points: T[]): Array<{ key: string; lng: number; lat: number; points: T[] }> {
  const groups = new Map<string, { key: string; lng: number; lat: number; points: T[] }>()
  for (const point of points) {
    if (point.lng == null || point.lat == null) continue
    const key = `${point.lng.toFixed(5)},${point.lat.toFixed(5)}`
    const group = groups.get(key)
    if (group) group.points.push(point)
    else groups.set(key, { key, lng: point.lng, lat: point.lat, points: [point] })
  }
  return [...groups.values()]
}

/** A CSV file from rows of cells. Quotes every cell; neutralises spreadsheet formula prefixes. */
export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  const cell = (value: string | number | null | undefined) => {
    let text = value == null ? '' : String(value)
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
    return `"${text.replace(/"/g, '""')}"`
  }
  return rows.map((row) => row.map(cell).join(',')).join('\r\n')
}

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function rowsToCsv(rows: MonitorRow[]): string {
  return toCsv([
    ['Address', 'Authority', 'Reference', 'Use', 'Dwellings', 'Status', 'Received', 'Validated', 'Decided', 'Documents', 'Latitude', 'Longitude', 'Location', 'Link'],
    ...rows.map((r) => [
      r.address, r.authorityName, r.reference, KIND_LABELS[markerKind(r)], r.dwellings, stageLabel(r.stage),
      r.dateReceived, r.dateValidated, r.dateDecided, r.matchedApplications, r.lat, r.lng,
      isApproximateLocation(r.locationProvenance) ? 'approximate' : 'site', r.sourceUrl,
    ]),
  ])
}

/** Area of a lng/lat ring in square miles (spherical excess; fine at patch scale). */
export function ringAreaSqMi(ring: [number, number][]): number {
  if (ring.length < 3) return 0
  const R = 6_371_008.8
  const rad = Math.PI / 180
  let sum = 0
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[(i + 1) % ring.length]
    sum += (x2 - x1) * rad * (2 + Math.sin(y1 * rad) + Math.sin(y2 * rad))
  }
  const m2 = Math.abs((sum * R * R) / 2)
  return m2 / (MILE_METERS * MILE_METERS)
}

export function areaLabel(sqMi: number): string {
  if (sqMi < 10) return `${sqMi.toFixed(1)} sq mi`
  return `${Math.round(sqMi).toLocaleString('en-GB')} sq mi`
}

type Pt = [number, number]
function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o = (p: Pt, q: Pt, r: Pt) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]))
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b) && o(a, b, c) !== 0 && o(a, b, d) !== 0
}

/**
 * Edges (by index of their first vertex) that cross another edge. With `closed`, the closing edge
 * from the last vertex back to the first is included. Adjacent edges share a vertex and never count.
 */
export function crossingEdges(points: Pt[], closed: boolean): number[] {
  const n = points.length
  const edges: Array<[number, Pt, Pt]> = []
  for (let i = 0; i < n - 1; i++) edges.push([i, points[i], points[i + 1]])
  if (closed && n >= 3) edges.push([n - 1, points[n - 1], points[0]])
  const bad = new Set<number>()
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const [ei, a, b] = edges[i]
      const [ej, c, d] = edges[j]
      const adjacent = Math.abs(ei - ej) === 1 || (closed && ((ei === 0 && ej === n - 1) || (ej === 0 && ei === n - 1)))
      if (adjacent) continue
      if (segmentsCross(a, b, c, d)) {
        bad.add(ei)
        bad.add(ej)
      }
    }
  }
  return [...bad].sort((x, y) => x - y)
}

export function londonTodayIso(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(now)
}
