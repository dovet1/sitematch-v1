'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type mapboxgl from 'mapbox-gl'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import type { MonitorCriteria } from '@/lib/planning-monitor/criteria'
import type { MonitorPatch, MonitorRow } from '@/lib/planning-monitor/types'
import type { ReferenceData } from '../../../types/unified-workspace'
import { selectActiveCriteria, selectPatch, usePlanningMonitorStore, type LngLat, type StackPick } from '../../../lib/stores/planning-monitor-store'
import { useWorkspaceStore } from '../../../lib/stores/unified-workspace-store'
import { usePatchDigest, usePlanningList, usePlanningMap, usePlanningPatches } from '../../../lib/hooks/usePlanningMonitor'
import { cellBounds, documentCount, filterChips, inCell, isNewRow, londonTodayIso, milesLabel, removeFilterChip, rowTitle } from '../../../lib/planning-monitor-ui'
import {
  archivePatch,
  createPatch as createPatchRequest,
  queryMonitor,
  requestPreview,
  restorePatch,
  setWatch,
  updateNotifications,
  updatePatch,
  type DraftLocation,
} from '../../../lib/services/planning-monitor-service'
import { fetchStoresInViewport, type NearbyStore } from '../../../lib/services/gaps-service'
import { PlanningMapLayer, mapAlive } from '../../map/PlanningMapLayer'
import { PlanningDrawLayer } from '../../map/PlanningDrawLayer'
import { PlanningModeContext, usePlanningMode, type PlanningModeValue } from './PlanningModeContext'
import { PlanningHomePanel } from './PlanningHomePanel'
import { PlanningFiltersPanel } from './PlanningFiltersPanel'
import { PlanningDrawPanel, PlanningNamePanel, drawnLocation } from './PlanningDrawPanel'
import { PlanningResultsPanel } from './PlanningResultsPanel'
import { PlanningDevelopmentCard } from './PlanningDevelopmentCard'
import { PlanningStackPicker } from './PlanningStackPicker'
import { PlanningWeeklySummary } from './PlanningWeeklySummary'
import { PlanningDeleteDialog, PlanningPatchMenu } from './PlanningPatchMenu'
import { FilterChipView } from './PlanningUi'

/** Brand stores are drawn from this zoom; below it a large estate is a smear of points with no meaning. */
const STORE_MIN_ZOOM = 6

/** A bbox grown by `meters` on every side. */
function padBbox([w, s, e, n]: [number, number, number, number], meters: number): [number, number, number, number] {
  const dLat = meters / 111320
  const dLng = meters / (111320 * Math.cos((((s + n) / 2) * Math.PI) / 180))
  return [w - dLng, s - dLat, e + dLng, n + dLat]
}

/** Read `?mode=planning&patch=…&report=…&settings=notifications` once, so email links land in the right place. */
export function usePlanningDeepLink() {
  const setMode = useWorkspaceStore((s) => s.setMode)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('mode') !== 'planning') return
    setMode('planning')
    const patchId = params.get('patch')
    const report = params.get('report')
    const settings = params.get('settings')
    const land = (state: ReturnType<typeof usePlanningMonitorStore.getState>) => {
      if (patchId && state.patches.some((p) => p.id === patchId)) state.setActivePatch(patchId)
      if (report) state.openSummary(report)
      else if (settings === 'notifications' && state.activePatchId) state.setMenu('panel')
    }
    const store = usePlanningMonitorStore.getState()
    if (store.patchesLoaded) {
      land(store)
      return
    }
    const unsubscribe = usePlanningMonitorStore.subscribe((state) => {
      if (!state.patchesLoaded) return
      unsubscribe()
      land(state)
    })
    return () => unsubscribe()
  }, [setMode])
}

export function PlanningModeProvider({ enabled, map, refData, children }: { enabled: boolean; map: mapboxgl.Map | null; refData: ReferenceData; children: React.ReactNode }) {
  usePlanningPatches(enabled)
  const list = usePlanningList(enabled)
  const mapState = usePlanningMap(enabled)
  const scope = usePlanningMonitorStore((s) => s.scope)
  const activePatchId = usePlanningMonitorStore((s) => s.activePatchId)
  const select = usePlanningMonitorStore((s) => s.select)
  const markWatched = usePlanningMonitorStore((s) => s.markWatched)
  const upsertPatch = usePlanningMonitorStore((s) => s.upsertPatch)
  const viewport = usePlanningMonitorStore((s) => s.viewport)
  const criteria = usePlanningMonitorStore(selectActiveCriteria)
  const digestState = usePatchDigest(activePatchId, enabled)
  const bump = usePlanningMonitorStore((s) => s.bump)
  const { user, profile } = useAuth()
  const userEmail = profile?.email || user?.email || ''

  const digest = useMemo(() => ({
    ...digestState,
    requestPreview: () => {
      if (!activePatchId) return
      requestPreview(activePatchId).then(() => bump()).catch(() => digestState.refresh())
    },
  }), [digestState, activePatchId, bump])

  // Stores for the chosen brands, in view, each drawn with the filter's radius.
  const [stores, setStores] = useState<NearbyStore[]>([])
  const storeRadiusMeters = criteria.proximity?.radiusMeters ?? null
  const fasciaIds = useMemo(() => {
    const ids = criteria.proximity?.brandIds ?? []
    return refData.brands.filter((b) => ids.includes(b.id)).flatMap((b) => b.fascias.map((f) => f.id))
  }, [criteria.proximity, refData.brands])
  const storeKey = enabled && viewport && viewport.zoom >= STORE_MIN_ZOOM && fasciaIds.length
    ? `${fasciaIds.join(',')}|${storeRadiusMeters}|${viewport.bbox.map((n) => n.toFixed(3)).join(',')}`
    : null
  useEffect(() => {
    if (!storeKey || !viewport) {
      setStores([])
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      // Padded by the radius, so a ring reaching into view from a store just outside it still draws.
      fetchStoresInViewport(padBbox(viewport.bbox, storeRadiusMeters ?? 0), { fasciaIds }, controller.signal)
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

  const selectRow = useCallback((row: MonitorRow | null, options?: { fly?: boolean }) => {
    select(row)
    if (row && options?.fly && map && mapAlive(map)) {
      map.easeTo({ center: [row.lng, row.lat], zoom: Math.max(map.getZoom(), 13), duration: 600 })
    }
  }, [map, select])

  // A single map pin may not be on the loaded list page, so it is read on its own, limited to a
  // tiny box around the point. A pin from an archived week may no longer match today's filters;
  // it is then looked up with the time frame and status lifted.
  const pickSingle = useCallback<PlanningModeValue['pickSingle']>((pick) => {
    const matches = (r: MonitorRow) =>
      r.key === pick.rowKey || r.applicationId === pick.applicationId || (pick.developmentId != null && r.developmentId === pick.developmentId)
    const existing = list.rows.find(matches)
    if (existing) {
      selectRow(existing, { fly: pick.fly })
      return
    }
    const [lng, lat] = pick.lngLat
    const d = 0.0005
    const box: [number, number, number, number] = [lng - d, lat - d, lng + d, lat + d]
    const read = (request: Parameters<typeof queryMonitor>[0]) =>
      queryMonitor(request).then((res) => res.rows?.find(matches) ?? null)
    const base = { grouping: 'developments' as const, viewport: box, include: { totals: false, rows: true }, rowsInViewport: true }
    read({ ...base, scope, patchId: scope === 'patch' ? activePatchId : null, criteria: scope === 'uk' ? criteria : undefined })
      .then((row) => {
        if (row || !pick.relaxed) return row
        const relaxed: MonitorCriteria = { ...criteria, dates: { field: criteria.dates.field, preset: 'all', from: null, to: null }, stages: [] }
        return read({ ...base, scope: 'uk', criteria: relaxed })
      })
      .then((row) => {
        if (row) selectRow(row, { fly: pick.fly })
        else toast.info('That development no longer matches your filters.')
      })
      .catch(() => toast.error('That development could not be loaded.'))
  }, [list.rows, scope, activePatchId, criteria, selectRow])

  // A stacked pin lists what its server cell holds: the same filters, limited to the cell's box.
  const stackSeq = useRef(0)
  const openStack = useCallback((pick: StackPick) => {
    const store = usePlanningMonitorStore.getState()
    const id = `${pick.cellKey}#${++stackSeq.current}`
    if (pick.highlights) {
      store.openStack({ id, pick, items: pick.highlights.map((highlight) => ({ type: 'highlight', highlight })), more: false, error: null })
      return
    }
    store.openStack({ id, pick, items: null, more: false, error: null })
    const box = pick.zoom == null ? null : cellBounds(pick.cellKey, pick.zoom)
    if (!box || pick.zoom == null) {
      store.setStackError(id, 'These applications could not be listed. Move the map and try again.')
      return
    }
    const zoom = pick.zoom
    queryMonitor({
      scope,
      patchId: scope === 'patch' ? activePatchId : null,
      criteria: scope === 'uk' ? criteria : undefined,
      grouping: 'developments',
      viewport: box,
      include: { totals: false, rows: true },
      rowsInViewport: true,
    })
      .then((res) => {
        const rows = (res.rows ?? []).filter((r) => inCell(r.lng, r.lat, pick.cellKey, zoom))
        const state = usePlanningMonitorStore.getState()
        if (state.stack?.id !== id) return
        if (rows.length === 0) state.setStackError(id, 'These applications no longer match your filters.')
        else if (rows.length === 1 && !res.nextCursor) selectRow(rows[0])
        else state.setStackItems(id, rows.map((row) => ({ type: 'row', row })), Boolean(res.nextCursor))
      })
      .catch(() => usePlanningMonitorStore.getState().setStackError(id, 'These applications could not be loaded.'))
  }, [scope, activePatchId, criteria, selectRow])

  const toggleWatch = useCallback(async (row: MonitorRow) => {
    const next = !row.watched
    await setWatch(row.applicationId, next, scope === 'patch' ? activePatchId : null)
    markWatched(row.applicationId, row.developmentId, next)
  }, [scope, activePatchId, markWatched])

  const savePatch = useCallback<PlanningModeValue['savePatch']>(async (changes) => {
    const patch = selectPatch(usePlanningMonitorStore.getState())
    if (!patch) throw new Error('No patch to save')
    const result = await updatePatch(patch.id, {
      name: changes.name ?? patch.name,
      criteria: changes.criteria ?? patch.criteria,
      location: changes.location,
      expectedRevision: patch.revision,
    })
    upsertPatch(result.patch)
    return result.patch
  }, [upsertPatch])

  const createPatch = useCallback<PlanningModeValue['createPatch']>(async (input) => {
    const result = await createPatchRequest({
      name: input.name,
      location: input.location,
      criteria: input.criteria,
      emailEnabled: input.emailEnabled,
      // Quiet weeks are kept in the app but not emailed.
      skipQuietWeeks: true,
    })
    upsertPatch(result.patch)
    toast.success(`${result.patch.name} saved. Your first summary is being prepared.`)
    return result.patch
  }, [upsertPatch])

  const replacePatch = (patch: MonitorPatch) =>
    usePlanningMonitorStore.setState((s) => ({ patches: s.patches.map((p) => (p.id === patch.id ? patch : p)) }))

  const setEmail = useCallback(async (enabled: boolean) => {
    const patch = selectPatch(usePlanningMonitorStore.getState())
    if (!patch) return
    const result = await updateNotifications(patch.id, enabled ? { emailEnabled: true, skipQuietWeeks: true } : { emailEnabled: false })
    replacePatch(result.patch)
    digestState.refresh()
  }, [digestState])

  const deletePatch = useCallback(async () => {
    const store = usePlanningMonitorStore.getState()
    const patch = selectPatch(store)
    if (!patch) return
    const emailWasOn = Boolean(patch.subscription?.emailEnabled)
    await archivePatch(patch.id)
    store.removePatch(patch.id)
    toast(`${patch.name} deleted`, {
      duration: 10_000,
      action: {
        label: 'Undo',
        onClick: () => {
          restorePatch(patch.id, emailWasOn)
            .then((res) => res.patch && usePlanningMonitorStore.getState().upsertPatch(res.patch))
            .catch((error) => toast.error(error instanceof Error ? error.message : 'The patch could not be restored'))
        },
      },
    })
  }, [])

  const value = useMemo<PlanningModeValue>(
    () => ({ map, list, mapState, digest, stores, storeRadiusMeters, refData, userEmail, selectRow, pickSingle, openStack, toggleWatch, savePatch, createPatch, setEmail, deletePatch }),
    [map, list, mapState, digest, stores, storeRadiusMeters, refData, userEmail, selectRow, pickSingle, openStack, toggleWatch, savePatch, createPatch, setEmail, deletePatch]
  )
  return <PlanningModeContext.Provider value={value}>{children}</PlanningModeContext.Provider>
}

/** The left control panel. All filters and the name step widen over the map rather than pushing it. */
export function PlanningModePanel() {
  const panel = usePlanningMonitorStore((s) => s.panel)
  const drawing = usePlanningMonitorStore((s) => s.drawing)
  const wide = panel === 'filters' || panel === 'name'
  return (
    <aside aria-label="Planning monitor" className="relative z-30 flex w-[302px] shrink-0 flex-col border-r border-[#EDEBE7] bg-white">
      {panel === 'draw' && drawing?.mode === 'new' ? <PlanningDrawPanel /> : <PlanningHomePanel />}
      {wide && (
        <div className="absolute inset-y-0 left-0 w-[390px] border-r border-[#EDEBE7] bg-white shadow-[12px_0_40px_-24px_rgba(0,0,0,.35)]">
          {panel === 'filters' ? <PlanningFiltersPanel /> : <PlanningNamePanel />}
        </div>
      )}
    </aside>
  )
}

/** The right results panel; closed while a new patch is being drawn or named. */
export function PlanningModeResults() {
  const drawing = usePlanningMonitorStore((s) => s.drawing)
  if (drawing?.mode === 'new') return null
  return <PlanningResultsPanel />
}

function bboxOf(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon) {
  const rings = geometry.type === 'Polygon' ? [geometry.coordinates[0]] : geometry.coordinates.map((p) => p[0])
  let [w, s, e, n] = [180, 90, -180, -90]
  for (const ring of rings) for (const [lng, lat] of ring) { w = Math.min(w, lng); e = Math.max(e, lng); s = Math.min(s, lat); n = Math.max(n, lat) }
  return { w, s, e, n }
}

/** Something that sits on the map at a geographic point, kept in place as the map moves. */
function useProjected(map: mapboxgl.Map, lngLat: LngLat | null) {
  const [point, setPoint] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const key = lngLat ? lngLat.join(',') : null
  useLayoutEffect(() => {
    if (!lngLat) {
      setPoint(null)
      return
    }
    const place = () => {
      if (!mapAlive(map)) return
      const p = map.project(lngLat)
      const c = map.getContainer()
      setPoint({ x: p.x, y: p.y, width: c.clientWidth, height: c.clientHeight })
    }
    place()
    map.on('move', place)
    return () => {
      map.off('move', place)
    }
    // key stands for lngLat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key])
  return point
}

function PatchChip({ map }: { map: mapboxgl.Map }) {
  const patch = usePlanningMonitorStore(selectPatch)
  const anchor = useMemo<LngLat | null>(() => {
    if (!patch) return null
    const { w, n } = bboxOf(patch.displayGeometry)
    return [w, n]
  }, [patch])
  const point = useProjected(map, anchor)
  if (!patch || !point) return null
  const left = Math.min(Math.max(point.x, 12), point.width - 220)
  const top = Math.min(Math.max(point.y - 44, 12), point.height - 60)
  return (
    <div className="absolute z-20 flex items-center gap-2 rounded-[12px] bg-[rgba(23,20,25,.92)] py-1.5 pl-3 pr-1.5 shadow-[0_4px_12px_-4px_rgba(0,0,0,.4)]" style={{ left, top }}>
      <span className="max-w-[160px] truncate text-[13px] font-bold text-white">{patch.name}</span>
      <PlanningPatchMenu host="map" dark />
    </div>
  )
}

function HoverTooltip({ map }: { map: mapboxgl.Map }) {
  const hoveredKey = usePlanningMonitorStore((s) => s.hoveredKey)
  const selectedKey = usePlanningMonitorStore((s) => s.selected?.key ?? null)
  const hoverStack = usePlanningMonitorStore((s) => (s.stack?.pick.cellKey === s.hoverStack?.key ? null : s.hoverStack))
  const { mapState, list } = usePlanningMode()
  const cluster = hoveredKey && hoveredKey !== selectedKey ? mapState.clusters.find((c) => c.single?.key === hoveredKey) : null
  const row = hoveredKey ? list.rows.find((r) => r.key === hoveredKey) : null
  const anchor: LngLat | null = hoverStack ? hoverStack.lngLat : cluster ? [cluster.lng, cluster.lat] : null
  const point = useProjected(map, anchor)
  if (!anchor || !point) return null
  const docs = row ? documentCount(row, null) : null
  const label = hoverStack
    ? `${hoverStack.count} applications at one location · click to list`
    : row ? `${rowTitle(row)}${docs ? ` · ${docs} doc${docs === 1 ? '' : 's'}` : ''}` : 'Open development'
  return (
    <div
      className="pointer-events-none absolute z-20 -translate-x-1/2 whitespace-nowrap rounded-[7px] bg-sm-ink px-2.5 py-1.5 text-[11.5px] font-semibold text-white shadow"
      style={{ left: point.x, top: point.y - 44 }}
    >
      {label}
    </div>
  )
}

function Legend({ patch, stores, radiusMeters }: { patch: boolean; stores: boolean; radiusMeters: number | null }) {
  const dot = (color: string) => <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
  return (
    <div className="absolute bottom-6 left-4 z-10 rounded-[12px] bg-white/95 px-3.5 py-3 text-[12px] text-sm-ink shadow-[0_4px_12px_-4px_rgba(0,0,0,.4)]">
      <p className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-[#8A857D]">On the map</p>
      <ul className="space-y-1">
        <li className="flex items-center gap-2">{dot('#7033FF')} Residential</li>
        <li className="flex items-center gap-2">{dot('#0F9B8E')} Commercial</li>
        <li className="flex items-center gap-2">{dot('#F26B1F')} Mixed use</li>
        <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full border-[2.5px] border-[#7033FF]" /> Approximate location</li>
        <li className="flex items-center gap-2">
          <span className="relative h-2.5 w-2.5" aria-hidden>
            <span className="absolute left-[3px] top-[-3px] h-2.5 w-2.5 rounded-full bg-[#7033FF]/45 ring-1 ring-white" />
            <span className="absolute inset-0 rounded-full bg-[#7033FF] ring-1 ring-white" />
          </span>
          Several at one location
        </li>
        {patch && (
          <>
            <li className="flex items-center gap-2">
              <span className="rounded-[4px] bg-sm-violet px-1 font-mono text-[8px] font-semibold uppercase text-white">New</span> Added in the last 7 days
            </li>
            <li className="flex items-center gap-2">{dot('#C9C3BA')} Outside the patch — dimmed</li>
          </>
        )}
        {stores && <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-white ring-[1.5px] ring-[#2A6FDB]" /> Chosen brands’ stores</li>}
        {stores && radiusMeters != null && (
          <li className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full border-[1.5px] border-dashed border-[#0EAE73] bg-[#0EAE73]/10" /> {milesLabel(radiusMeters)} radius
          </li>
        )}
      </ul>
    </div>
  )
}

export function PlanningModeMapOverlay({ map }: { map: mapboxgl.Map }) {
  const { mapState, stores, storeRadiusMeters, pickSingle, openStack, list, refData, savePatch } = usePlanningMode()
  const selected = usePlanningMonitorStore((s) => s.selected)
  const stack = usePlanningMonitorStore((s) => s.stack)
  const patch = usePlanningMonitorStore(selectPatch)
  const scope = usePlanningMonitorStore((s) => s.scope)
  const panel = usePlanningMonitorStore((s) => s.panel)
  const drawing = usePlanningMonitorStore((s) => s.drawing)
  const archivedWeek = usePlanningMonitorStore((s) => s.archivedWeek)
  const browseCriteria = usePlanningMonitorStore((s) => s.browseCriteria)
  const setBrowseCriteria = usePlanningMonitorStore((s) => s.setBrowseCriteria)
  const inPatch = scope === 'patch' && patch
  const today = londonTodayIso()
  const newKeys = useMemo(() => (inPatch ? list.rows.filter((r) => isNewRow(r, today)).map((r) => r.key) : []), [inPatch, list.rows, today])
  const chips = useMemo(() => filterChips(browseCriteria, refData.brands), [browseCriteria, refData.brands])

  // Frame the patch when it opens or changes.
  useEffect(() => {
    if (scope !== 'patch' || !patch || !mapAlive(map)) return
    const { w, s, e, n } = bboxOf(patch.displayGeometry)
    map.fitBounds([[w, s], [e, n]], { padding: 80, duration: 700, maxZoom: 14 })
  }, [map, scope, patch?.id, patch?.revision]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveBoundary = useCallback(async (vertices: LngLat[]) => {
    const location = drawnLocation(vertices)
    if (!location) throw new Error('The shape crosses itself')
    await savePatch({ location: location as DraftLocation })
    usePlanningMonitorStore.getState().endDrawing()
    toast.success('Boundary saved. The next summary uses the new shape.')
  }, [savePatch])

  const drawingNew = drawing?.mode === 'new'
  return (
    <>
      <PlanningMapLayer
        map={map}
        clusters={drawingNew ? [] : mapState.clusters}
        outside={drawingNew ? [] : mapState.outside}
        clusterZoom={mapState.zoom}
        archived={archivedWeek?.points ?? null}
        patchGeometry={inPatch && !drawing ? patch.displayGeometry : null}
        stores={drawingNew ? [] : stores}
        storeRadiusMeters={storeRadiusMeters}
        newKeys={newKeys}
        interactive={!drawing}
        onPickSingle={(pick) => pickSingle(pick)}
        onPickStack={openStack}
      />
      {drawing && <PlanningDrawLayer key={drawing.mode} map={map} onSaveBoundary={saveBoundary} />}
      {!drawing && selected && <PlanningDevelopmentCard key={selected.key} map={map} row={selected} />}
      {!drawing && !selected && stack && <PlanningStackPicker key={stack.id} map={map} stack={stack} />}
      {!drawing && <HoverTooltip map={map} />}
      {!drawing && inPatch && <PatchChip map={map} />}

      {!drawing && scope === 'uk' && (
        <div className="absolute left-4 right-4 top-4 z-10 flex flex-wrap gap-[7px]">
          {chips.map((chip) => (
            <FilterChipView key={chip.key} chip={chip} floating onRemove={() => setBrowseCriteria(removeFilterChip(browseCriteria, chip.key))} />
          ))}
        </div>
      )}

      {!drawing && (mapState.error || mapState.unavailable) && (
        <div role="status" className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white px-4 py-2 text-[12.5px] text-sm-ink shadow">
          {mapState.unavailable ? 'Too many applications to map here. Zoom in or narrow the time frame.' : 'Map data could not be loaded.'}
        </div>
      )}
      {!drawingNew && <Legend patch={Boolean(inPatch)} stores={stores.length > 0} radiusMeters={storeRadiusMeters} />}

      {panel === 'filters' && <div className="absolute inset-0 z-20 bg-[rgba(20,16,10,.35)]" onClick={() => usePlanningMonitorStore.getState().closeFilters()} aria-hidden />}
      <PlanningWeeklySummary />
    </>
  )
}

export function PlanningModeModals() {
  return <PlanningDeleteDialog />
}
