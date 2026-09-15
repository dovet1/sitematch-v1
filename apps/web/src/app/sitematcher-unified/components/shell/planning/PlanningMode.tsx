'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type mapboxgl from 'mapbox-gl'
import { List, Map as MapIcon } from 'lucide-react'
import type { MonitorRow } from '@/lib/planning-monitor/types'
import type { ReferenceData } from '../../../types/unified-workspace'
import { selectActiveCriteria, usePlanningMonitorStore } from '../../../lib/stores/planning-monitor-store'
import { useWorkspaceStore } from '../../../lib/stores/unified-workspace-store'
import {
  usePatchDigest,
  usePlanningList,
  usePlanningMap,
  usePlanningPatches,
  type PlanningListState,
  type PlanningMapState,
} from '../../../lib/hooks/usePlanningMonitor'
import { toPlanningApplication } from '../../../lib/planning-monitor-ui'
import { queryMonitor, requestPreview, setWatch, type PatchDigestResponse } from '../../../lib/services/planning-monitor-service'
import { fetchStoresInViewport, type NearbyStore } from '../../../lib/services/gaps-service'
import { PlanningMapLayer, mapAlive } from '../../map/PlanningMapLayer'
import { PlanningMonitorPanel } from './PlanningMonitorPanel'
import { PlanningApplicationPopover } from './PlanningApplicationPopover'
import { PlanningCriteriaModal } from './PlanningCriteriaModal'
import { PlanningReportModal } from './PlanningReportModal'
import { PlanningNotificationSettings } from './PlanningNotificationSettings'

/** Estate stores are drawn from this zoom; nationally they would be thousands of points with no meaning. */
const STORE_MIN_ZOOM = 8

interface PlanningModeContext {
  list: PlanningListState
  mapState: PlanningMapState
  digest: { data: PatchDigestResponse | null; loading: boolean; error: string | null; refresh: () => void; requestPreview: () => void }
  stores: NearbyStore[]
  selectRow: (row: MonitorRow) => void
  pickSingle: (pick: { applicationId: string; rowKey: string; lngLat: [number, number] }) => void
  toggleWatch: (row: MonitorRow) => Promise<void>
  refData: ReferenceData
}

const Context = createContext<PlanningModeContext | null>(null)

function usePlanningMode(): PlanningModeContext {
  const value = useContext(Context)
  if (!value) throw new Error('Planning mode components must be inside PlanningModeProvider')
  return value
}

/** Read `?mode=planning&patch=…&report=…&settings=notifications` once, so email links land in the right place. */
export function usePlanningDeepLink() {
  const setMode = useWorkspaceStore((s) => s.setMode)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('mode') !== 'planning') return
    setMode('planning')
    const store = usePlanningMonitorStore.getState()
    const patchId = params.get('patch')
    const report = params.get('report')
    const settings = params.get('settings')
    const unsubscribe = usePlanningMonitorStore.subscribe((state) => {
      if (!state.patchesLoaded) return
      unsubscribe()
      if (patchId && state.patches.some((p) => p.id === patchId)) state.setActivePatch(patchId)
      if (report) state.openReport(report)
      if (settings === 'notifications' && patchId) state.setNotificationsOpen(true)
    })
    if (store.patchesLoaded) {
      unsubscribe()
      if (patchId) store.setActivePatch(patchId)
      if (report) store.openReport(report)
    }
    return () => unsubscribe()
  }, [setMode])
}

export function PlanningModeProvider({ enabled, map, refData, children }: { enabled: boolean; map: mapboxgl.Map | null; refData: ReferenceData; children: React.ReactNode }) {
  usePlanningPatches(enabled)
  const list = usePlanningList(enabled)
  const mapState = usePlanningMap(enabled)
  const scope = usePlanningMonitorStore((s) => s.scope)
  const activePatchId = usePlanningMonitorStore((s) => s.activePatchId)
  const grouping = usePlanningMonitorStore((s) => s.grouping)
  const select = usePlanningMonitorStore((s) => s.select)
  const markWatched = usePlanningMonitorStore((s) => s.markWatched)
  const viewport = usePlanningMonitorStore((s) => s.viewport)
  const criteria = usePlanningMonitorStore(selectActiveCriteria)
  const digestState = usePatchDigest(scope === 'patch' ? activePatchId : null, enabled && scope === 'patch')
  const bump = usePlanningMonitorStore((s) => s.bump)

  const digest = useMemo(() => ({
    ...digestState,
    requestPreview: () => {
      if (!activePatchId) return
      requestPreview(activePatchId).then(() => bump()).catch(() => digestState.refresh())
    },
  }), [digestState, activePatchId, bump])

  // Estate stores for the chosen brands, in view.
  const [stores, setStores] = useState<NearbyStore[]>([])
  const fasciaIds = useMemo(() => {
    const ids = criteria.proximity?.brandIds ?? []
    return refData.brands.filter((b) => ids.includes(b.id)).flatMap((b) => b.fascias.map((f) => f.id))
  }, [criteria.proximity, refData.brands])
  const storeKey = enabled && viewport && viewport.zoom >= STORE_MIN_ZOOM && fasciaIds.length ? `${fasciaIds.join(',')}|${viewport.bbox.map((n) => n.toFixed(3)).join(',')}` : null
  useEffect(() => {
    if (!storeKey || !viewport) {
      setStores([])
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetchStoresInViewport(viewport.bbox, { fasciaIds }, controller.signal)
        .then((res) => setStores(res.stores))
        .catch(() => undefined)
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
    // storeKey captures viewport and fascia changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeKey])

  const selectRow = useCallback((row: MonitorRow) => {
    select(row)
    if (map && mapAlive(map)) {
      const zoom = Math.max(map.getZoom(), 13)
      map.easeTo({ center: [row.lng, row.lat], zoom, duration: 600 })
    }
    usePlanningMonitorStore.getState().setMobilePane('map')
  }, [map, select])

  // A single map marker may not be on the current list page, so it is read on its own with the
  // same predicate, limited to a tiny box around the point.
  const pickSingle = useCallback((pick: { applicationId: string; rowKey: string; lngLat: [number, number] }) => {
    const existing = list.rows.find((r) => r.key === pick.rowKey)
    if (existing) {
      select(existing)
      return
    }
    const [lng, lat] = pick.lngLat
    const d = 0.0005
    queryMonitor({
      scope,
      patchId: scope === 'patch' ? activePatchId : null,
      criteria: scope === 'uk' ? criteria : undefined,
      grouping,
      viewport: [lng - d, lat - d, lng + d, lat + d],
      include: { totals: false, rows: true },
      rowsInViewport: true,
    })
      .then((res) => {
        const row = res.rows?.find((r) => r.key === pick.rowKey) ?? res.rows?.[0]
        if (row) select(row)
      })
      .catch(() => undefined)
  }, [list.rows, scope, activePatchId, criteria, grouping, select])

  const toggleWatch = useCallback(async (row: MonitorRow) => {
    const next = !row.watched
    await setWatch(row.applicationId, next, scope === 'patch' ? activePatchId : null)
    markWatched(row.applicationId, row.developmentId, next)
  }, [scope, activePatchId, markWatched])

  const value = useMemo(
    () => ({ list, mapState, digest, stores, selectRow, pickSingle, toggleWatch, refData }),
    [list, mapState, digest, stores, selectRow, pickSingle, toggleWatch, refData]
  )
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function PlanningModePanel() {
  const { list, mapState, digest, selectRow, refData } = usePlanningMode()
  const mobilePane = usePlanningMonitorStore((s) => s.mobilePane)
  return (
    <aside
      aria-label="Planning monitor"
      className={(mobilePane === 'map' ? 'hidden lg:flex ' : 'flex ') + 'w-full shrink-0 flex-col border-r border-sm-border bg-sm-surface lg:w-[426px]'}
    >
      <PlanningMonitorPanel brands={refData.brands} list={list} mapState={mapState} digest={digest} onSelectRow={selectRow} />
    </aside>
  )
}

export function PlanningModeMapOverlay({ map }: { map: mapboxgl.Map }) {
  const { mapState, stores, pickSingle, toggleWatch } = usePlanningMode()
  const selected = usePlanningMonitorStore((s) => s.selected)
  const select = usePlanningMonitorStore((s) => s.select)
  const patches = usePlanningMonitorStore((s) => s.patches)
  const activePatchId = usePlanningMonitorStore((s) => s.activePatchId)
  const scope = usePlanningMonitorStore((s) => s.scope)
  const setPlanningModal = useWorkspaceStore((s) => s.setPlanningModal)
  const patch = patches.find((p) => p.id === activePatchId) ?? null

  // Frame the patch when it changes.
  useEffect(() => {
    if (scope !== 'patch' || !patch || !mapAlive(map)) return
    const rings = patch.displayGeometry.type === 'Polygon' ? [patch.displayGeometry.coordinates[0]] : patch.displayGeometry.coordinates.map((p) => p[0])
    let [w, s, e, n] = [180, 90, -180, -90]
    for (const ring of rings) for (const [lng, lat] of ring) { w = Math.min(w, lng); e = Math.max(e, lng); s = Math.min(s, lat); n = Math.max(n, lat) }
    map.fitBounds([[w, s], [e, n]], { padding: 60, duration: 700, maxZoom: 14 })
  }, [map, scope, patch?.id, patch?.revision]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <PlanningMapLayer map={map} clusters={mapState.clusters} patchGeometry={scope === 'patch' ? patch?.displayGeometry ?? null : null} stores={stores} onPickSingle={pickSingle} />
      {selected && (
        <PlanningApplicationPopover
          map={map}
          row={selected}
          onClose={() => select(null)}
          onView={() => setPlanningModal(toPlanningApplication(selected))}
          onToggleWatch={() => toggleWatch(selected)}
        />
      )}
      {scope === 'patch' && patch && (
        <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-lg bg-[#1C1B22]/90 px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide text-white">
          {patch.name}
        </div>
      )}
      {(mapState.error || mapState.unavailable) && (
        <div role="status" className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-white px-4 py-2 text-[12.5px] text-sm-ink2 shadow">
          {mapState.unavailable ? 'Too many applications to map here. Zoom in or narrow the dates.' : 'Map data could not be loaded.'}
        </div>
      )}
      <div className="absolute bottom-6 right-4 z-10 hidden rounded-2xl bg-white px-4 py-3 text-[13px] text-sm-ink shadow-[0_10px_30px_-12px_rgba(0,0,0,.4)] sm:block">
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-sm-ink3">On the map</p>
        <p className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#8B6CFF]" />Residential</p>
        <p className="mt-1 flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-[#34D399]" />Commercial</p>
        <p className="mt-1 flex items-center gap-2"><span className="h-3 w-3 rounded-full border-[3px] border-[#8B6CFF]" />Approximate location</p>
        {stores.length > 0 && <p className="mt-1 flex items-center gap-2"><span className="h-3 w-3 rounded-[3px] bg-[#0EAE73]" />Selected store estate</p>}
      </div>
    </>
  )
}

/**
 * The small-screen Map/List switch. It sits outside both panes, because whichever pane is not
 * showing is hidden, and a switch inside it would vanish with it.
 */
export function PlanningMobilePaneSwitch() {
  const mobilePane = usePlanningMonitorStore((s) => s.mobilePane)
  const setMobilePane = usePlanningMonitorStore((s) => s.setMobilePane)
  return (
    <button
      type="button"
      onClick={() => setMobilePane(mobilePane === 'map' ? 'list' : 'map')}
      className="fixed bottom-6 left-1/2 z-30 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#1C1B22] px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg lg:hidden"
    >
      {mobilePane === 'map' ? <><List size={15} aria-hidden /> List</> : <><MapIcon size={15} aria-hidden /> Map</>}
    </button>
  )
}

export function PlanningModeModals() {
  const { refData } = usePlanningMode()
  const editor = usePlanningMonitorStore((s) => s.editor)
  const closeEditor = usePlanningMonitorStore((s) => s.closeEditor)
  const upsertPatch = usePlanningMonitorStore((s) => s.upsertPatch)
  const removePatch = usePlanningMonitorStore((s) => s.removePatch)
  const patches = usePlanningMonitorStore((s) => s.patches)
  const activePatchId = usePlanningMonitorStore((s) => s.activePatchId)
  const reportRunId = usePlanningMonitorStore((s) => s.reportRunId)
  const openReport = usePlanningMonitorStore((s) => s.openReport)
  const notificationsOpen = usePlanningMonitorStore((s) => s.notificationsOpen)
  const setNotificationsOpen = usePlanningMonitorStore((s) => s.setNotificationsOpen)
  const setScope = usePlanningMonitorStore((s) => s.setScope)
  const active = patches.find((p) => p.id === activePatchId) ?? null

  return (
    <>
      {editor && (
        <PlanningCriteriaModal
          key={editor}
          patch={editor === 'new' ? null : patches.find((p) => p.id === editor) ?? null}
          brands={refData.brands}
          onClose={closeEditor}
          onSaved={(patch) => {
            upsertPatch(patch)
            closeEditor()
          }}
        />
      )}
      {reportRunId && (
        <PlanningReportModal
          runId={reportRunId}
          onClose={() => openReport(null)}
          onViewMap={() => {
            openReport(null)
            setScope('patch')
          }}
        />
      )}
      {notificationsOpen && active && (
        <PlanningNotificationSettings
          patch={active}
          onClose={() => setNotificationsOpen(false)}
          onUpdated={(patch) => usePlanningMonitorStore.setState((s) => ({ patches: s.patches.map((p) => (p.id === patch.id ? patch : p)) }))}
          onArchived={(patchId) => {
            setNotificationsOpen(false)
            removePatch(patchId)
          }}
        />
      )}
    </>
  )
}
