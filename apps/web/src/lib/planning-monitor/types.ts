import type { PlanningFreshness } from '@/lib/planning-intelligence/freshness'
import type { FilterCapabilities, MonitorCriteria } from './criteria'
import type { PatchGeometry, PatchSource } from './geometry'

/** Shapes shared by the Planning Monitor API and the workspace. No server-only imports here. */

export type MonitorScope = 'patch' | 'uk'
export type MonitorGrouping = 'developments' | 'applications'
export type BBox = [number, number, number, number]

export interface MonitorRow {
  /** Development id, `app:<id>` for an unlinked application, or the application id in applications mode. */
  key: string
  sortDate: string | null
  applicationId: string
  developmentId: string | null
  developmentRole: string | null
  familyState: string | null
  /** Matched applications this row stands for. 1 in applications mode. */
  matchedApplications: number
  providerId: string
  authorityName: string
  reference: string
  address: string
  description: string
  status: string | null
  stage: string | null
  procedure: string | null
  planningRoute: string | null
  commercialWork: string | null
  sourceUrl: string | null
  lng: number
  lat: number
  locationProvenance: 'source_exact' | 'source_centroid' | 'postcode_centroid' | 'missing'
  locationUncertaintyM: number
  /** False: shown because an approximate position may fall inside, not because it does. */
  inside: boolean
  /** Straight-line proximity to the selected estate without the location allowance. Null when no estate is selected. */
  nearConfirmed: boolean | null
  dwellings: number | null
  dwellingsReviewed: boolean
  isResidential: boolean
  isCommercial: boolean
  dateReceived: string | null
  dateValidated: string | null
  dateDecided: string | null
  watched: boolean
}

export interface MonitorCluster {
  key: string
  lng: number
  lat: number
  count: number
  residential: number
  commercial: number
  /** Units shown because an approximate position may be inside the patch. */
  possible: number
  /** Set when the cell holds exactly one unit. */
  single: { applicationId: string; key: string; exact: boolean } | null
  /** Set when a cell holds several units at one point, which no zoom level can separate. */
  colocated: boolean
}

export interface MonitorTotals {
  applications: number
  developments: number
  confirmedApplications: number
  possibleApplications: number
  residentialApplications: number
  commercialApplications: number
  viewportApplications: number | null
  viewportDevelopments: number | null
}

export interface MonitorQueryResponse {
  criteriaHash: string
  capabilityVersion: number
  /** Changes whenever ingestion runs; lets a client discard answers computed on older data. */
  datasetRevision: string | null
  scope: MonitorScope
  grouping: MonitorGrouping
  /** Null when the count could not finish in time; the UI shows a pending/unavailable state rather than zero. */
  totals: MonitorTotals | null
  totalsUnavailable: 'timeout' | null
  rows: MonitorRow[] | null
  nextCursor: string | null
  clusters: MonitorCluster[] | null
  clustersUnavailable: 'timeout' | null
  freshness: PlanningFreshness
}

export interface MonitorCountResponse {
  criteriaHash: string
  totals: MonitorTotals | null
  totalsUnavailable: 'timeout' | null
}

export interface MonitorSubscription {
  id: string
  emailEnabled: boolean
  skipQuietWeeks: boolean
  timezone: string
  nextDueAt: string | null
  unsubscribedAt: string | null
}

export interface MonitorPatch {
  id: string
  name: string
  geometry: PatchGeometry
  displayGeometry: PatchGeometry
  geometrySource: PatchSource
  geometryLabel: string | null
  criteria: MonitorCriteria
  revision: number
  revisionId: string | null
  needsAttention: string | null
  updatedAt: string
  subscription: MonitorSubscription | null
}

export interface MonitorPatchListResponse {
  patches: MonitorPatch[]
  capabilities: FilterCapabilities
}

export interface DigestHighlight {
  applicationId: string
  developmentId: string | null
  reference: string
  authorityName: string
  address: string
  headline: string
  sourceUrl: string | null
  approximateLocation: boolean
  // Stored on reports generated from 16 Sep 2026; absent on earlier ones.
  /** What happened to it in the period: 'new' and/or a decision ('approved', 'refused', …). */
  categories?: string[]
  rowKey?: string
  isResidential?: boolean
  isCommercial?: boolean
  dwellings?: number | null
  stage?: string | null
  dateReceived?: string | null
  dateValidated?: string | null
  dateDecided?: string | null
  matchedApplications?: number
  nearConfirmed?: boolean | null
  lng?: number
  lat?: number
}

export interface DigestSummary {
  overview: string
  keyChanges: Array<{ text: string; evidence: string[] }>
  residentialTheme: string | null
  commercialTheme: string | null
  watchedChanges: Array<{ text: string; evidence: string[] }>
  caveats: string[]
}

export interface DigestReport {
  runId: string
  patchId: string
  patchName: string
  kind: 'initial' | 'preview' | 'scheduled'
  periodStart: string
  periodEnd: string
  periodLabel: string
  generatedAt: string | null
  status: 'queued' | 'running' | 'generated' | 'failed' | 'cancelled'
  summaryKind: 'ai' | 'fallback' | 'no_changes' | 'partial' | null
  revision: number
  counts: {
    newApplications: number
    newDevelopments: number
    decisions: number
    approvals: number
    refusals: number
    withdrawals: number
    lateDiscoveries: number
    knownNewDwellings: number
    unresolvedFamilies: number
    watchedChanges: number
    // New applications by use, as the weekly panel's counters show them. Absent on reports before 16 Sep 2026.
    newResidential?: number
    newResidentialDwellings?: number
    newCommercial?: number
    newNearStores?: number
  } | null
  summary: DigestSummary | null
  highlights: DigestHighlight[]
  omittedHighlights: number
  coverage: { stale: boolean; staleReason: string | null; note: string | null } | null
  error: string | null
}
