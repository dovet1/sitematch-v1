import 'server-only'

import { createPlanningAdminClient, type PlanningAdminClient } from '@/lib/planning-intelligence/db'
import { FRESHNESS_UNAVAILABLE, readPlanningFreshness } from '@/lib/planning-intelligence/freshness'
import { CAPABILITIES, buildPredicate, type MonitorCriteria, type MonitorPredicate } from './criteria'
import { criteriaHash } from './hash'
import type { PatchGeometry } from './geometry'
import type {
  BBox,
  MonitorCluster,
  MonitorGrouping,
  MonitorQueryResponse,
  MonitorRow,
  MonitorScope,
  MonitorTotals,
} from './types'

/**
 * The one read path behind the Monitor's map, list, counts and draft-criteria preview. Every
 * caller builds its predicate here, so they cannot disagree about what matches.
 *
 * Callers authorise first. Patch geometry reaches this module only after the API has loaded it
 * for its owner; this module never accepts a patch id.
 */

export const PAGE_SIZE = 50

const STATEMENT_TIMEOUT = '57014'

export class MonitorQueryError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

function isTimeout(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === STATEMENT_TIMEOUT
}

export function encodeCursor(sortDate: string | null, key: string): string {
  return Buffer.from(JSON.stringify([sortDate ?? '0001-01-01', key])).toString('base64url')
}

export function decodeCursor(cursor: string | null | undefined): { date: string; key: string } | null {
  if (!cursor) return null
  try {
    const [date, key] = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof key !== 'string' || key.length > 80) return null
    return { date, key }
  } catch {
    return null
  }
}

interface RowRecord {
  row_key: string
  sort_date: string | null
  id: string
  development_id: string | null
  development_role: string | null
  family_state: string | null
  matched_applications: number
  provider_id: string
  authority_name: string
  reference: string
  address: string | null
  description: string | null
  status: string | null
  stage: string | null
  procedure: string | null
  planning_route: string | null
  commercial_work: string | null
  links: { council?: string | null; plota?: string | null } | null
  lng: number
  lat: number
  location_provenance: MonitorRow['locationProvenance']
  location_uncertainty_m: number | null
  inside: boolean
  near_confirmed: boolean | null
  dwellings: number | null
  dwellings_reviewed: boolean | null
  is_residential: boolean
  is_commercial: boolean
  date_received: string | null
  date_validated: string | null
  date_decided: string | null
}

export function mapRow(record: RowRecord, watched: Set<string>, watchedDevelopments: Set<string>): MonitorRow {
  return {
    key: record.row_key,
    sortDate: record.sort_date,
    applicationId: record.id,
    developmentId: record.development_id,
    developmentRole: record.development_role,
    familyState: record.family_state,
    matchedApplications: Number(record.matched_applications),
    providerId: record.provider_id,
    authorityName: record.authority_name,
    reference: record.reference,
    address: record.address ?? '',
    description: record.description ?? '',
    status: record.status,
    stage: record.stage,
    procedure: record.procedure,
    planningRoute: record.planning_route,
    commercialWork: record.commercial_work,
    sourceUrl: record.links?.council ?? record.links?.plota ?? null,
    lng: record.lng,
    lat: record.lat,
    locationProvenance: record.location_provenance,
    locationUncertaintyM: record.location_uncertainty_m ?? 0,
    inside: record.inside,
    nearConfirmed: record.near_confirmed,
    dwellings: record.dwellings,
    dwellingsReviewed: Boolean(record.dwellings_reviewed),
    isResidential: record.is_residential,
    isCommercial: record.is_commercial,
    dateReceived: record.date_received,
    dateValidated: record.date_validated,
    dateDecided: record.date_decided,
    watched: watched.has(record.id) || (record.development_id != null && watchedDevelopments.has(record.development_id)),
  }
}

/** The user's watched applications, and the developments they currently belong to. */
export async function loadWatches(db: PlanningAdminClient, userId: string) {
  const { data, error } = await db
    .from('planning_monitor_watches')
    .select('planning_application_id')
    .eq('user_id', userId)
    .limit(5000)
  if (error) throw error
  const applicationIds = (data ?? []).map((row) => row.planning_application_id as string)
  const developmentIds = new Set<string>()
  for (let i = 0; i < applicationIds.length; i += 200) {
    const { data: links, error: linkError } = await db
      .from('development_applications')
      .select('development_id')
      .in('planning_application_id', applicationIds.slice(i, i + 200))
    if (linkError) throw linkError
    for (const link of links ?? []) developmentIds.add(link.development_id as string)
  }
  return { applicationIds, applications: new Set(applicationIds), developments: developmentIds }
}

async function readTotals(db: PlanningAdminClient, predicate: MonitorPredicate, viewport: BBox | null) {
  const { data, error } = await db.rpc('planning_monitor_count', { p: predicate, p_viewport: viewport })
  if (error) {
    if (isTimeout(error)) return { totals: null, unavailable: 'timeout' as const }
    throw error
  }
  const row = ((data ?? []) as Array<Record<string, number>>)[0]
  const totals: MonitorTotals = {
    applications: Number(row?.applications ?? 0),
    developments: Number(row?.developments ?? 0),
    confirmedApplications: Number(row?.confirmed_applications ?? 0),
    possibleApplications: Number(row?.possible_applications ?? 0),
    residentialApplications: Number(row?.residential_applications ?? 0),
    commercialApplications: Number(row?.commercial_applications ?? 0),
    viewportApplications: viewport ? Number(row?.viewport_applications ?? 0) : null,
    viewportDevelopments: viewport ? Number(row?.viewport_developments ?? 0) : null,
  }
  return { totals, unavailable: null }
}

async function readClusters(db: PlanningAdminClient, predicate: MonitorPredicate, zoom: number, grouping: MonitorGrouping) {
  const { data, error } = await db.rpc('planning_monitor_clusters', { p: predicate, p_zoom: zoom, p_grouping: grouping, p_max_cells: 1500 })
  if (error) {
    if (isTimeout(error)) return { clusters: null, unavailable: 'timeout' as const }
    throw error
  }
  const clusters: MonitorCluster[] = ((data ?? []) as Array<Record<string, unknown>>).map((cell) => ({
    key: String(cell.cell_key),
    lng: Number(cell.lng),
    lat: Number(cell.lat),
    count: Number(cell.count),
    residential: Number(cell.residential),
    commercial: Number(cell.commercial),
    possible: Number(cell.possible),
    single: cell.single_id
      ? { applicationId: String(cell.single_id), key: String(cell.single_key), exact: Boolean(cell.single_exact) }
      : null,
  }))
  return { clusters, unavailable: null }
}

/**
 * Below this zoom the viewport box is left out of the cluster read. A box covering most of the UK
 * steers the planner onto the spatial index and a scan of the whole store (timed out at 8 s on
 * 15 Sep 2026), while the date filter alone answers the 30-day national view in 0.2-0.5 s warm.
 * The extra cells outside a national view are a few dozen at most.
 */
export const NATIONAL_CLUSTER_ZOOM = 7

export function clusterPredicate(base: MonitorPredicate, viewport: BBox | null, zoom: number): MonitorPredicate {
  return zoom < NATIONAL_CLUSTER_ZOOM ? base : { ...base, bbox: viewport }
}

export interface MonitorQueryInput {
  userId: string
  scope: MonitorScope
  criteria: MonitorCriteria
  /** The owned patch's exact geometry (My patch), or a draft geometry being edited. Ignored for All UK. */
  geometry: PatchGeometry | null
  grouping: MonitorGrouping
  viewport: BBox | null
  zoom: number | null
  include: { totals: boolean; rows: boolean; clusters: boolean }
  /** Restrict the list to the viewport rather than the whole patch/nation. */
  rowsInViewport: boolean
  cursor: string | null
  db?: PlanningAdminClient
}

export async function queryMonitor(input: MonitorQueryInput): Promise<MonitorQueryResponse> {
  const db = input.db ?? createPlanningAdminClient()
  if (input.scope === 'patch' && !input.geometry) throw new MonitorQueryError('A patch is required for My patch', 400)
  if (input.include.clusters && (!input.viewport || input.zoom == null)) {
    throw new MonitorQueryError('Clusters need a viewport and zoom', 400)
  }
  const cursor = decodeCursor(input.cursor)
  if (input.cursor && !cursor) throw new MonitorQueryError('Invalid cursor', 400)

  const freshnessPromise = readPlanningFreshness(db).catch((error: unknown) => {
    console.error('[planning-monitor] Freshness read failed', error)
    return FRESHNESS_UNAVAILABLE
  })
  const watches = await loadWatches(db, input.userId)
  const boundary = input.scope === 'patch' ? input.geometry : null
  const base = buildPredicate(input.criteria, { boundary, watchedApplicationIds: watches.applicationIds })

  const [totals, rows, clusters] = await Promise.all([
    input.include.totals ? readTotals(db, base, input.viewport) : Promise.resolve(null),
    input.include.rows
      ? db.rpc('planning_monitor_rows', {
          p: input.rowsInViewport && input.viewport ? { ...base, bbox: input.viewport } : base,
          p_grouping: input.grouping,
          p_after_date: cursor?.date ?? null,
          p_after_key: cursor?.key ?? null,
          p_limit: PAGE_SIZE + 1,
        })
      : Promise.resolve(null),
    input.include.clusters
      ? readClusters(db, clusterPredicate(base, input.viewport, input.zoom as number), input.zoom as number, input.grouping)
      : Promise.resolve(null),
  ])

  let mappedRows: MonitorRow[] | null = null
  let nextCursor: string | null = null
  if (rows) {
    if (rows.error) {
      if (isTimeout(rows.error)) throw new MonitorQueryError('This view is too large to list at once. Zoom in, narrow the dates, or use a patch.', 503)
      throw rows.error
    }
    const records = (rows.data ?? []) as RowRecord[]
    const page = records.slice(0, PAGE_SIZE)
    mappedRows = page.map((record) => mapRow(record, watches.applications, watches.developments))
    if (records.length > PAGE_SIZE) {
      const last = page[page.length - 1]
      nextCursor = encodeCursor(last.sort_date, last.row_key)
    }
  }

  const freshness = await freshnessPromise
  return {
    criteriaHash: criteriaHash(input.criteria),
    capabilityVersion: CAPABILITIES.version,
    datasetRevision: freshness.lastDiscoveryAt ?? freshness.lastRefreshAt,
    scope: input.scope,
    grouping: input.grouping,
    totals: totals?.totals ?? null,
    totalsUnavailable: totals?.unavailable ?? null,
    rows: mappedRows,
    nextCursor,
    clusters: clusters?.clusters ?? null,
    clustersUnavailable: clusters?.unavailable ?? null,
    freshness,
  }
}
