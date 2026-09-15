'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { MonitorCluster, MonitorQueryResponse, MonitorRow } from '@/lib/planning-monitor/types'
import { selectActiveCriteria, usePlanningMonitorStore } from '../stores/planning-monitor-store'
import {
  countMonitor,
  fetchPatchDigest,
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

/**
 * The list and its patch-wide (or national) totals. Re-reads when scope, patch, criteria, grouping
 * or a save/watch changes, never on pan: the list is the patch, the map is the view.
 */
export function usePlanningList(enabled: boolean): PlanningListState {
  const scope = usePlanningMonitorStore((s) => s.scope)
  const activePatchId = usePlanningMonitorStore((s) => s.activePatchId)
  const grouping = usePlanningMonitorStore((s) => s.grouping)
  const revision = usePlanningMonitorStore((s) => s.revision)
  const criteria = usePlanningMonitorStore(selectActiveCriteria)
  const patchesLoaded = usePlanningMonitorStore((s) => s.patchesLoaded)
  const criteriaKey = JSON.stringify(criteria)

  const [state, setState] = useState<Omit<PlanningListState, 'loadMore'>>({
    rows: [], totals: null, totalsUnavailable: null, freshness: null, loading: false, loadingMore: false, error: null, nextCursor: null,
  })
  const requestId = useRef(0)

  useEffect(() => {
    if (!enabled || !patchesLoaded) return
    const id = ++requestId.current
    const controller = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))
    queryMonitor({
      scope,
      patchId: scope === 'patch' ? activePatchId : null,
      criteria: scope === 'uk' ? criteria : undefined,
      grouping,
      include: { totals: true, rows: true },
    }, controller.signal)
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
    return () => controller.abort()
    // criteriaKey stands for criteria.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, patchesLoaded, scope, activePatchId, grouping, criteriaKey, revision])

  const loadMore = useCallback(() => {
    if (!state.nextCursor || state.loadingMore) return
    const id = requestId.current
    setState((s) => ({ ...s, loadingMore: true }))
    queryMonitor({
      scope,
      patchId: scope === 'patch' ? activePatchId : null,
      criteria: scope === 'uk' ? criteria : undefined,
      grouping,
      include: { totals: false, rows: true },
      cursor: state.nextCursor,
    })
      .then((res) => {
        if (id !== requestId.current) return
        setState((s) => ({ ...s, rows: [...s.rows, ...(res.rows ?? [])], nextCursor: res.nextCursor, loadingMore: false }))
      })
      .catch((error) => {
        if (id !== requestId.current) return
        setState((s) => ({ ...s, loadingMore: false, error: error instanceof Error ? error.message : 'More results failed' }))
      })
  }, [state.nextCursor, state.loadingMore, scope, activePatchId, criteria, grouping])

  return { ...state, loadMore }
}

export interface PlanningMapState {
  clusters: MonitorCluster[]
  viewportApplications: number | null
  viewportDevelopments: number | null
  loading: boolean
  error: string | null
  unavailable: boolean
}

/** Clusters and in-view counts for the current viewport. Debounced; stale answers are dropped. */
export function usePlanningMap(enabled: boolean): PlanningMapState {
  const scope = usePlanningMonitorStore((s) => s.scope)
  const activePatchId = usePlanningMonitorStore((s) => s.activePatchId)
  const grouping = usePlanningMonitorStore((s) => s.grouping)
  const viewport = usePlanningMonitorStore((s) => s.viewport)
  const revision = usePlanningMonitorStore((s) => s.revision)
  const criteria = usePlanningMonitorStore(selectActiveCriteria)
  const patchesLoaded = usePlanningMonitorStore((s) => s.patchesLoaded)
  const criteriaKey = JSON.stringify(criteria)
  const viewportKey = viewport ? `${viewport.bbox.map((n) => n.toFixed(4)).join(',')}@${viewport.zoom.toFixed(2)}` : null

  const [state, setState] = useState<PlanningMapState>({ clusters: [], viewportApplications: null, viewportDevelopments: null, loading: false, error: null, unavailable: false })
  const requestId = useRef(0)

  useEffect(() => {
    if (!enabled || !patchesLoaded || !viewport) return
    const id = ++requestId.current
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setState((s) => ({ ...s, loading: true, error: null }))
      queryMonitor({
        scope,
        patchId: scope === 'patch' ? activePatchId : null,
        criteria: scope === 'uk' ? criteria : undefined,
        grouping,
        viewport: viewport.bbox,
        zoom: viewport.zoom,
        include: { totals: true, rows: false, clusters: true },
      }, controller.signal)
        .then((res) => {
          if (id !== requestId.current) return
          setState({
            clusters: res.clusters ?? [],
            viewportApplications: res.totals?.viewportApplications ?? null,
            viewportDevelopments: res.totals?.viewportDevelopments ?? null,
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
  }, [enabled, patchesLoaded, scope, activePatchId, grouping, criteriaKey, viewportKey, revision])

  return state
}

/** Live match count for the criteria editor's draft. Debounced; each change aborts the previous request. */
export function useDraftCount(input: { enabled: boolean; criteria: MonitorCriteria; location: DraftLocation | null; patchId: string | null }) {
  const [state, setState] = useState<{ result: MonitorCountResponse | null; loading: boolean; error: string | null }>({ result: null, loading: false, error: null })
  const key = JSON.stringify([input.criteria, input.location, input.patchId])
  useEffect(() => {
    if (!input.enabled || (!input.location && !input.patchId)) {
      setState({ result: null, loading: false, error: null })
      return
    }
    const controller = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))
    const timer = setTimeout(() => {
      countMonitor({
        scope: 'patch',
        patchId: input.location ? null : input.patchId,
        draftLocation: input.location ?? undefined,
        criteria: input.criteria,
      }, controller.signal)
        .then((result) => setState({ result, loading: false, error: null }))
        .catch((error) => {
          if (error?.name === 'AbortError') return
          setState({ result: null, loading: false, error: error instanceof Error ? error.message : 'Count failed' })
        })
    }, 500)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.enabled, key])
  return state
}

/** The active patch's briefing. Polls while one is being prepared. */
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
        if (error?.name !== 'AbortError') setState({ data: null, loading: false, error: error instanceof Error ? error.message : 'Briefing failed' })
      })
    return () => controller.abort()
  }, [patchId, enabled, revision, tick])
  const preparing = Boolean(state.data?.preparing)
  useEffect(() => {
    if (!preparing) return
    const timer = setInterval(() => setTick((t) => t + 1), 10_000)
    return () => clearInterval(timer)
  }, [preparing])
  return { ...state, refresh: () => setTick((t) => t + 1) }
}
