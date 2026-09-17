// Client wrappers for /api/planning-monitor. Every call throws an Error carrying the server's message.

import type { MonitorCriteria } from '@/lib/planning-monitor/criteria'
import type {
  BBox,
  DigestReport,
  MonitorCountResponse,
  MonitorGrouping,
  MonitorPatch,
  MonitorPatchListResponse,
  MonitorQueryResponse,
  MonitorScope,
} from '@/lib/planning-monitor/types'

export type DraftLocation =
  | { kind: 'drawn' | 'uploaded'; geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon; label?: string | null }
  | { kind: 'radius'; center: { lng: number; lat: number }; radiusMeters: number; placeName: string }

async function call<T>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { 'Content-Type': 'application/json', ...(rest.headers ?? {}) } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  })
  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const error = new Error(body?.error ?? `Request failed (${res.status})`) as Error & { status?: number }
    error.status = res.status
    throw error
  }
  return body as T
}

export interface MonitorQueryRequest {
  scope: MonitorScope
  patchId?: string | null
  criteria?: MonitorCriteria
  draftLocation?: DraftLocation
  grouping: MonitorGrouping
  viewport?: BBox | null
  zoom?: number | null
  include: { totals?: boolean; rows?: boolean; clusters?: boolean }
  rowsInViewport?: boolean
  cursor?: string | null
}

export function queryMonitor(request: MonitorQueryRequest, signal?: AbortSignal) {
  return call<MonitorQueryResponse>('/api/planning-monitor/query', { method: 'POST', json: request, signal })
}

export function countMonitor(request: Pick<MonitorQueryRequest, 'scope' | 'patchId' | 'criteria' | 'draftLocation'>, signal?: AbortSignal) {
  return call<MonitorCountResponse>('/api/planning-monitor/count', { method: 'POST', json: request, signal })
}

export function listPatches(signal?: AbortSignal) {
  return call<MonitorPatchListResponse>('/api/planning-monitor/patches', { signal })
}

export interface SavePatchRequest {
  name: string
  location?: DraftLocation
  criteria: MonitorCriteria
  emailEnabled?: boolean
  skipQuietWeeks?: boolean
  expectedRevision?: number
}

export function createPatch(request: SavePatchRequest) {
  return call<{ patch: MonitorPatch; briefingRunId: string | null }>('/api/planning-monitor/patches', { method: 'POST', json: request })
}

export function updatePatch(patchId: string, request: SavePatchRequest) {
  return call<{ patch: MonitorPatch; briefingRunId: string | null }>(`/api/planning-monitor/patches/${patchId}`, { method: 'PUT', json: request })
}

export function updateNotifications(patchId: string, changes: { emailEnabled?: boolean; skipQuietWeeks?: boolean }) {
  return call<{ patch: MonitorPatch }>(`/api/planning-monitor/patches/${patchId}`, { method: 'PATCH', json: changes })
}

export function archivePatch(patchId: string) {
  return call<void>(`/api/planning-monitor/patches/${patchId}`, { method: 'DELETE' })
}

export function restorePatch(patchId: string, emailEnabled: boolean) {
  return call<{ patch: MonitorPatch }>(`/api/planning-monitor/patches/${patchId}/restore`, { method: 'POST', json: { emailEnabled } })
}

export function setWatch(applicationId: string, watched: boolean, patchId?: string | null) {
  return call<{ watched: boolean }>('/api/planning-monitor/watches', {
    method: watched ? 'POST' : 'DELETE',
    json: watched ? { applicationId, patchId: patchId ?? null } : { applicationId },
  })
}

export interface PatchDigestResponse {
  latest: (DigestReport & { fromOlderRevision: boolean }) | null
  preparing: { runId: string; kind: string } | null
  lastFailed: boolean
  /** Kept reports, newest first. `newApplications` is null on reports that predate the count. */
  history: Array<{
    runId: string
    kind: string
    periodLabel: string
    periodStart: string
    periodEnd: string
    generatedAt: string | null
    summaryKind: string | null
    newApplications: number | null
  }>
  nextEmailAt: string | null
}

export function fetchPatchDigest(patchId: string, signal?: AbortSignal) {
  return call<PatchDigestResponse>(`/api/planning-monitor/patches/${patchId}/digest`, { signal })
}

export function requestPreview(patchId: string) {
  return call<{ runId: string }>(`/api/planning-monitor/patches/${patchId}/digest`, { method: 'POST' })
}

export function fetchReport(runId: string, signal?: AbortSignal) {
  return call<{ report: DigestReport }>(`/api/planning-monitor/digests/${runId}`, { signal })
}
