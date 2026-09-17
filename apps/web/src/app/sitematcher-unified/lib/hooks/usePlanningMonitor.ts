'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DigestReport, MonitorCluster, MonitorQueryResponse, MonitorRow } from '@/lib/planning-monitor/types'
import { selectActiveCriteria, selectPatch, usePlanningMonitorStore } from '../stores/planning-monitor-store'
import {
  countMonitor,
  fetchPatchDigest,
  fetchReport,
  listPatches,
  queryMonitor,
  type DraftLocation,
  type PatchDigestResponse,
} from '../services/planning-monitor-service'
import type { MonitorCriteria } from '@/lib/planning-monitor/criteria'
import type { MonitorCountResponse } from '@/lib/planning-monitor/types'

/** Load the user's patches once when Planning mode opens. */
export function usePlanningPatches(enabled: boolean) {
  const setPatches = usePlanningMonitorStore((s) => s.setPatches)
  const setPatchesError = usePlanningMonitorStore((s) => s.setPatchesError)
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    listPatches(controller.signal)
      .then((res) => setPatches(res.patches, res.capabilities))
      .catch((error) => {
        if (error?.name !== 'AbortError') setPatchesError(error instanceof Error ? error.message : 'Patches could not be loaded')
      })
    return () => controller.abort()
  }, [enabled, setPatches, setPatchesError])
}

export interface PlanningListState {
  rows: MonitorRow[]
  totals: MonitorQueryResponse['totals']
  totalsUnavailable: MonitorQueryResponse['totalsUnavailable']
  freshness: MonitorQueryResponse['freshness'] | null
  loading: boolean
  loadingMore: boolean
  error: string | null
  nextCursor: string | null
  loadMore: () => void
}

function viewportKeyOf(viewport: { bbox: number[]; zoom: number } | null) {
  return viewport ? `${viewport.bbox.map((n) => n.toFixed(4)).join(',')}@${viewport.zoom.toFixed(2)}` : null
}

/**
 * The results panel: developments in the map view (Whole UK) or in the whole patch (My patch),
 * newest first, with totals for the same scope. Whole UK re-reads as the map moves; My patch
 * re-reads only when the patch, its filters or a save changes.
 */
export function usePlanningList(enabled: boolean): PlanningListState {
  const scope = usePlanningMonitorStore((s) => s.scope)
  const activePatchId = usePlanningMonitorStore((s) => s.activePatchId)
  const revision = usePlanningMonitorStore((s) => s.revision)
  const criteria = usePlanningMonitorStore(selectActiveCriteria)
  const patchesLoaded = usePlanningMonitorStore((s) => s.patchesLoaded)
  const viewport = usePlanningMonitorStore((s) => (s.scope === 'uk' ? s.viewport : null))
  const criteriaKey = JSON.stringify(criteria)
  const viewportKey = viewportKeyOf(viewport)

  const [state, setState] = useState<Omit<PlanningListState, 'loadMore'>>({
    rows: [], totals: null, totalsUnavailable: null, freshness: null, loading: false, loadingMore: false, error: null, nextCursor: null,
  })
  const requestId = useRef(0)

  const request = useCallback(
    () => ({
      scope,
      patchId: scope === 'patch' ? activePatchId : null,
      criteria: scope === 'uk' ? criteria : undefined,
      grouping: 'developments' as const,
      viewport: scope === 'uk' ? viewport?.bbox ?? null : null,
      rowsInViewport: scope === 'uk',
    }),
    // criteriaKey and viewportKey stand for criteria and viewport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scope, activePatchId, criteriaKey, viewportKey]
  )

  useEffect(() => {
    if (!enabled || !patchesLoaded) return
    if (scope === 'uk' && !viewport) return
    const id = ++requestId.current
    const controller = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))
    const timer = setTimeout(() => {
      queryMonitor({ ...request(), include: { totals: true, rows: true } }, controller.signal)
        .then((res) => {
          if (id !== requestId.current) return
          setState({
            rows: res.rows ?? [], totals: res.totals, totalsUnavailable: res.totalsUnavailable, freshness: res.freshness,
            loading: false, loadingMore: false, error: null, nextCursor: res.nextCursor,
          })
        })
        .catch((error) => {
          if (error?.name === 'AbortError' || id !== requestId.current) return
          setState((s) => ({ ...s, rows: [], totals: null, totalsUnavailable: null, nextCursor: null, loading: false, error: error instanceof Error ? error.message : 'Planning data failed' }))
        })
    }, scope === 'uk' ? 300 : 0)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, patchesLoaded, request, revision])

  const loadMore = useCallback(() => {
    if (!state.nextCursor || state.loadingMore) return
    const id = requestId.current
    setState((s) => ({ ...s, loadingMore: true }))
    queryMonitor({ ...request(), include: { totals: false, rows: true }, cursor: state.nextCursor })
      .then((res) => {
        if (id !== requestId.current) return
        setState((s) => ({ ...s, rows: [...s.rows, ...(res.rows ?? [])], nextCursor: res.nextCursor, loadingMore: false }))
      })
      .catch((error) => {
        if (id !== requestId.current) return
        setState((s) => ({ ...s, loadingMore: false, error: error instanceof Error ? error.message : 'More results failed' }))
      })
  }, [state.nextCursor, state.loadingMore, request])

  return { ...state, loadMore }
}

export interface PlanningMapState {
  clusters: MonitorCluster[]
  /** The zoom the clusters were computed at; their cell keys depend on it. */
  zoom: number | null
  loading: boolean
  error: string | null
  unavailable: boolean
}

/** Clusters for the current viewport. Debounced; stale answers are dropped. */
export function usePlanningMap(enabled: boolean): PlanningMapState {
  const scope = usePlanningMonitorStore((s) => s.scope)
  const activePatchId = usePlanningMonitorStore((s) => s.activePatchId)
  const viewport = usePlanningMonitorStore((s) => s.viewport)
  const revision = usePlanningMonitorStore((s) => s.revision)
  const criteria = usePlanningMonitorStore(selectActiveCriteria)
  const patchesLoaded = usePlanningMonitorStore((s) => s.patchesLoaded)
  const criteriaKey = JSON.stringify(criteria)
  const viewportKey = viewportKeyOf(viewport)

  const [state, setState] = useState<PlanningMapState>({ clusters: [], zoom: null, loading: false, error: null, unavailable: false })
  const requestId = useRef(0)

  useEffect(() => {
    if (!enabled || !patchesLoaded || !viewport) return
    const id = ++requestId.current
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setState((s) => ({ ...s, loading: true, error: null }))
      const base = { grouping: 'developments' as const, viewport: viewport.bbox, zoom: viewport.zoom, include: { totals: false, rows: false, clusters: true } }
      // Inside a patch the map shows only the patch's developments; nothing is fetched beyond it.
      queryMonitor({
        ...base,
        scope,
        patchId: scope === 'patch' ? activePatchId : null,
        criteria: scope === 'uk' ? criteria : undefined,
      }, controller.signal)
        .then((res) => {
          if (id !== requestId.current) return
          setState({
            clusters: res.clusters ?? [],
            zoom: viewport.zoom,
            loading: false,
            error: null,
            unavailable: res.clustersUnavailable != null,
          })
        })
        .catch((error) => {
          if (error?.name === 'AbortError' || id !== requestId.current) return
          setState((s) => ({ ...s, loading: false, error: error instanceof Error ? error.message : 'Map data failed' }))
        })
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, patchesLoaded, scope, activePatchId, criteriaKey, viewportKey, revision])

  return state
}

/**
 * Live match count for a set of criteria: a draft shape, the saved patch, or Whole UK in the
 * current view. Debounced; each change aborts the previous request.
 */
export function useDraftCount(input: {
  enabled: boolean
  criteria: MonitorCriteria
  location: DraftLocation | null
  patchId: string | null
  /** Whole UK: count within this box instead of a patch. */
  viewport?: [number, number, number, number] | null
}) {
  const [state, setState] = useState<{ result: MonitorCountResponse | null; loading: boolean; error: string | null }>({ result: null, loading: false, error: null })
  const key = JSON.stringify([input.criteria, input.location, input.patchId, input.viewport])
  useEffect(() => {
    const uk = !input.location && !input.patchId
    if (!input.enabled || (uk && !input.viewport)) {
      setState({ result: null, loading: false, error: null })
      return
    }
    const controller = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))
    const timer = setTimeout(() => {
      const done = (result: MonitorCountResponse) => setState({ result, loading: false, error: null })
      const fail = (error: { name?: string } & Error) => {
        if (error?.name === 'AbortError') return
        setState({ result: null, loading: false, error: error instanceof Error ? error.message : 'Count failed' })
      }
      if (uk) {
        // The count endpoint has no viewport; the query endpoint's totals carry the in-view figures.
        queryMonitor({ scope: 'uk', criteria: input.criteria, grouping: 'developments', viewport: input.viewport, include: { totals: true, rows: false } }, controller.signal)
          .then((res) => done({ criteriaHash: res.criteriaHash, totals: res.totals && { ...res.totals, applications: res.totals.viewportApplications ?? res.totals.applications, developments: res.totals.viewportDevelopments ?? res.totals.developments }, totalsUnavailable: res.totalsUnavailable }))
          .catch(fail)
        return
      }
      countMonitor({
        scope: 'patch',
        patchId: input.location ? null : input.patchId,
        draftLocation: input.location ?? undefined,
        criteria: input.criteria,
      }, controller.signal)
        .then(done)
        .catch(fail)
    }, 400)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.enabled, key])
  return state
}

/**
 * The council that covers most of a drawn shape, for the name step's suggestion. Read from the
 * first page of matching developments; null when nothing matches.
 */
export function useDraftAuthority(location: DraftLocation | null, criteria: MonitorCriteria | null): string | null {
  const [name, setName] = useState<string | null>(null)
  const key = JSON.stringify(location)
  useEffect(() => {
    if (!location || !criteria) return
    const controller = new AbortController()
    queryMonitor({ scope: 'patch', draftLocation: location, criteria, grouping: 'applications', include: { totals: false, rows: true } }, controller.signal)
      .then((res) => {
        const tally = new Map<string, number>()
        for (const row of res.rows ?? []) tally.set(row.authorityName, (tally.get(row.authorityName) ?? 0) + 1)
        const best = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]
        setName(best ? best[0].replace(/\s+(City|Borough|District|Metropolitan Borough)?\s*Council$/i, '') : null)
      })
      .catch(() => undefined)
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return name
}

/** The patch's latest report and its kept weeks. Polls while one is being prepared. */
export function usePatchDigest(patchId: string | null, enabled: boolean) {
  const revision = usePlanningMonitorStore((s) => s.revision)
  const [state, setState] = useState<{ data: PatchDigestResponse | null; loading: boolean; error: string | null }>({ data: null, loading: false, error: null })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!enabled || !patchId) {
      setState({ data: null, loading: false, error: null })
      return
    }
    const controller = new AbortController()
    setState((s) => ({ ...s, loading: s.data?.latest?.patchId !== patchId }))
    fetchPatchDigest(patchId, controller.signal)
      .then((data) => setState({ data, loading: false, error: null }))
      .catch((error) => {
        if (error?.name !== 'AbortError') setState({ data: null, loading: false, error: error instanceof Error ? error.message : 'Summary failed' })
      })
    return () => controller.abort()
  }, [patchId, enabled, revision, tick])
  const preparing = Boolean(state.data?.preparing)
  useEffect(() => {
    if (!preparing) return
    const timer = setInterval(() => setTick((t) => t + 1), 10_000)
    return () => clearInterval(timer)
  }, [preparing])
  const refresh = useCallback(() => setTick((t) => t + 1), [])
  return { ...state, refresh }
}

/** One saved week, exactly as it was generated. Cached for the session: saved reports do not change. */
const reportCache = new Map<string, DigestReport>()
export function useReport(runId: string | null) {
  const [state, setState] = useState<{ report: DigestReport | null; loading: boolean; error: string | null }>(() => ({
    report: runId ? reportCache.get(runId) ?? null : null, loading: false, error: null,
  }))
  useEffect(() => {
    if (!runId) {
      setState({ report: null, loading: false, error: null })
      return
    }
    const cached = reportCache.get(runId)
    if (cached) {
      setState({ report: cached, loading: false, error: null })
      return
    }
    const controller = new AbortController()
    // Never show one week's figures under another week's dates.
    setState({ report: null, loading: true, error: null })
    fetchReport(runId, controller.signal)
      .then((res) => {
        if (res.report.status === 'generated') reportCache.set(runId, res.report)
        setState({ report: res.report, loading: false, error: null })
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') setState({ report: null, loading: false, error: error instanceof Error ? error.message : 'This week could not be loaded' })
      })
    return () => controller.abort()
  }, [runId])
  return state
}
