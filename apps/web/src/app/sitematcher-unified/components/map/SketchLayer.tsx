'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager'
import { measurementPreviewStore } from '@/lib/sitesketcher-v2/measurement-preview-store'
import { MAP_STYLES } from '@/lib/sitesketcher-v2/constants'
import {
  setupMapboxDraw,
  setup3DLayer,
  setupParkingLayer,
  setupAutoParkingLayer,
  toggle3DLayer,
  syncDrawTo3D,
  syncParkingToMap,
  syncAutoParkingAccessPointToMap,
  syncAutoParkingGuidanceToMap,
  syncAutoParkingHoverEdgeToMap,
  syncAutoParkingLayoutsToMap,
  type AutoParkingLayoutRenderEntry,
  syncPolygonsTo3D,
  loadPolygonsIntoDraw,
  enterPolygonDrawMode,
  drawFeatureToPolygon,
  addCadImageToMap,
  updateCadImageOnMap,
  removeCadImageFromMap,
} from '@/lib/sitesketcher-v2/mapbox-integration'
import { calculateCadImageCorners } from '@/lib/sitesketcher-v2/cad-utils'
import { snapPointToBoundaryEdge, reprojectAccessAnchor } from '@/lib/sitesketcher-v2/auto-parking/access-point'
import { buildCandidatePreviewGeometry, buildSolverInput } from '@/lib/sitesketcher-v2/auto-parking/adapter'
import { resolveGuidedExclusions, ringsIntersect } from '@/lib/sitesketcher-v2/auto-parking/detection'
import {
  entranceWall,
  isEntranceValid,
  isPointInsideRing,
  resolveEntrance,
  snapEntranceToBuildings,
} from '@/lib/sitesketcher-v2/auto-parking/entrance-point'
import { deriveAutoLayoutStale } from '@/lib/sitesketcher-v2/auto-parking/staleness'
import { clipFeaturesToBoundary } from '@/lib/sitesketcher-v2/auto-parking/clip'
import {
  BOUNDARY_INTERACTIVE_PHASES,
  ACCESS_INTERACTIVE_PHASES,
  ENTRANCE_INTERACTIVE_PHASES,
  LIVE_REFIT_PHASES,
  type AutoParkingDraft,
} from '@/lib/sitesketcher-v2/auto-parking/types'
import { useAutoParkingWorker, representativeAngle } from '../../lib/hooks/useAutoParkingWorker'
import { calculateEdgeDistance } from '@/lib/sitesketcher-v2/polygon-utils'
import type { CadImage, CadInstance, SavedCad, MapStyle } from '@/types/sitesketcher-v2'
import { PolygonLabels } from '../../../sitesketcher-v2/components/map/PolygonLabels'
import { MeasurementOverlay } from '../../../sitesketcher-v2/components/map/MeasurementOverlay'
import { PolygonDrawPreviewOverlay } from '../../../sitesketcher-v2/components/map/PolygonDrawPreviewOverlay'
import { AutoParkingOverlays } from './AutoParkingOverlays'
import mapboxgl from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import { toast } from 'sonner'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'
import '@/styles/sitesketcher-v2-tokens.css'
import '@/styles/sitesketcher-v2.css'

function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [lng, lat] = point
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [lngI, latI] = polygon[i]
    const [lngJ, latJ] = polygon[j]
    const intersects =
      latI > lat !== latJ > lat &&
      lng < ((lngJ - lngI) * (lat - latI)) / (latJ - latI) + lngI
    if (intersects) inside = !inside
  }
  return inside
}

function getProjectedPolygonArea(map: mapboxgl.Map, polygon: [number, number][]): number {
  let area = 0
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const current = map.project(polygon[i])
    const previous = map.project(polygon[j])
    area += (previous.x + current.x) * (previous.y - current.y)
  }
  return Math.abs(area / 2)
}

function selectPolygonForVertexEditing(draw: MapboxDraw, polygonId: string): void {
  try {
    draw.changeMode('direct_select', { featureId: polygonId })
  } catch {
    draw.changeMode('simple_select', { featureIds: [polygonId] })
  }
}

type CadLayerHandlers = {
  mousedown: (e: mapboxgl.MapLayerMouseEvent) => void
  mouseenter: () => void
  mouseleave: () => void
}

function findCadImageAtPoint(
  map: mapboxgl.Map,
  point: mapboxgl.Point,
  cadImages: CadImage[],
  cadInstances: CadInstance[],
  savedCads: SavedCad[]
): string | null {
  const { effectiveAccess } = useSketchStore.getState()
  if (!effectiveAccess.hasPlusAccess) return null

  const placedCadItems: Array<{
    id: string
    corners: [[number, number], [number, number], [number, number], [number, number]]
  }> = [
    ...cadImages
      .filter((cadImage) => cadImage.anchor !== null)
      .map((cadImage) => ({ id: cadImage.id, corners: calculateCadImageCorners(cadImage) })),
    ...cadInstances.flatMap((instance) => {
      const savedCad = savedCads.find((cad) => cad.id === instance.savedCadId)
      if (!savedCad) return []
      return [{ id: instance.id, corners: calculateCadImageCorners(instance, savedCad) }]
    }),
  ]

  for (const cadItem of [...placedCadItems].reverse()) {
    const screenCorners = cadItem.corners.map((corner) => {
      const projected = map.project(corner)
      return [projected.x, projected.y] as [number, number]
    })
    if (isPointInPolygon([point.x, point.y], screenCorners)) return cadItem.id
  }
  return null
}

function getCadInteractionState(id: string): { locked: boolean; exists: boolean } {
  const state = useSketchStore.getState()
  const legacyCad = state.cadImages.find((cad) => cad.id === id)
  if (legacyCad) {
    return { locked: Boolean(legacyCad.locked), exists: legacyCad.anchor !== null }
  }
  const instance = state.cadInstances.find((cadInstance) => cadInstance.id === id)
  if (instance) return { locked: Boolean(instance.locked), exists: true }
  return { locked: false, exists: false }
}

/**
 * Transient candidate-preview geometry for the map, derived from the current
 * auto-parking draft. Returns null unless the user is on the candidate step
 * with a selected candidate and a solver run to build it from. Kept as a plain
 * function so it can be called both from the reactive sync effect and from the
 * style-reload restore path (which reads a fresh `getState()` snapshot).
 */
function getAutoParkingPreviewGeometry(
  state: ReturnType<typeof useSketchStore.getState>
): GeoJSON.FeatureCollection | null {
  if (state.parkingMethod !== 'auto') return null
  if (!LIVE_REFIT_PHASES.has(state.autoParkingDraft.phase)) return null
  // A landed draft solve reflects whatever's currently being dragged — it
  // takes priority over the static (pre-drag) selected-candidate geometry.
  if (state.autoParkingLivePreview) return state.autoParkingLivePreview
  const run = state.autoParkingSolverRun
  const selectedId = state.autoParkingSelectedCandidateId
  if (!run || !selectedId) return null
  const candidate = state.autoParkingCandidates.find((c) => c.candidateId === selectedId)
  if (!candidate) return null
  return buildCandidatePreviewGeometry(run.input, run.output, candidate)
}

/**
 * True while the guided flow should re-fit live on direct map edits — either
 * actively comparing/editing, or mid-"Change" on the boundary/access of a
 * comparison that was already in flight (in-flow editing must not leave Auto
 * mode or mark the candidate stale — see README.md §3/§5).
 */
function isAutoParkingLiveRefitActive(draft: AutoParkingDraft): boolean {
  if (LIVE_REFIT_PHASES.has(draft.phase)) return true
  if (
    BOUNDARY_INTERACTIVE_PHASES.has(draft.phase) ||
    ACCESS_INTERACTIVE_PHASES.has(draft.phase) ||
    ENTRANCE_INTERACTIVE_PHASES.has(draft.phase) ||
    draft.phase === 'buildings'
  ) {
    return !!draft.phaseBeforeEdit && LIVE_REFIT_PHASES.has(draft.phaseBeforeEdit)
  }
  return false
}

/** Resolves the draft's edge-relative access anchor to a concrete lng/lat against the current boundary ring. */
function resolveAutoParkingAccessPoint(
  state: ReturnType<typeof useSketchStore.getState>
): [number, number] | null {
  if (state.parkingMethod !== 'auto') return null
  const { boundaryId, accessAnchor } = state.autoParkingDraft
  if (!boundaryId || !accessAnchor) return null
  const boundary = state.polygons.find((p) => p.id === boundaryId)
  if (!boundary) return null
  return reprojectAccessAnchor(accessAnchor, boundary.points)
}

function syncAutoParkingGuidanceForState(
  map: mapboxgl.Map,
  state: ReturnType<typeof useSketchStore.getState>,
): void {
  if (state.parkingMethod !== 'auto') {
    syncAutoParkingGuidanceToMap(map, { buildings: [], entrancePoint: null, entranceWall: null })
    return
  }
  const buildings = state.autoParkingDraft.buildingRefs.flatMap((ref) => {
    const polygon = state.polygons.find((candidate) => candidate.id === ref.id)
    return polygon ? [{ id: ref.id, source: ref.source, ring: polygon.points }] : []
  })
  syncAutoParkingGuidanceToMap(map, {
    buildings,
    entrancePoint: resolveEntrance(state.autoParkingDraft.entrance, state.polygons),
    entranceWall: entranceWall(state.autoParkingDraft.entrance, state.polygons),
    accessibleGeometry: getAutoParkingPreviewGeometry(state),
  })
}

/** Every applied AutoParkingLayout as a map render entry — stale ones clipped/flagged for reduced-opacity display. */
function getAutoParkingLayoutRenderEntries(
  state: ReturnType<typeof useSketchStore.getState>
): AutoParkingLayoutRenderEntry[] {
  return state.autoLayouts.map((layout) => {
    const stale = deriveAutoLayoutStale(layout, {
      polygons: state.polygons,
      cadInstances: state.cadInstances,
      cadImages: state.cadImages,
      savedCads: state.savedCads,
    })
    if (!stale) {
      return { id: layout.id, features: layout.geometry.features as GeoJSON.Feature[], stale: false }
    }
    const currentBoundaryRing = state.polygons.find((p) => p.id === layout.boundaryId)?.points
    const clipped = currentBoundaryRing
      ? clipFeaturesToBoundary(layout.geometry, currentBoundaryRing)
      : layout.geometry;
    return {
      id: layout.id,
      features: clipped.features as GeoJSON.Feature[],
      stale: true,
      currentBoundaryRing,
      previousBoundaryRing: layout.boundarySnapshot,
    }
  })
}

/**
 * Drives the SiteSketcher layers on the *shared* Unified Workspace map. Unlike
 * MapCanvas it does not create the map — it attaches to a provided instance and
 * tears its own layers/handlers back down on unmount so the discovery tools can
 * reclaim the map. All handlers are tracked so detach is clean.
 */
export function SketchLayer({ map }: { map: mapboxgl.Map }) {
  const mapRef = useRef(map)
  mapRef.current = map

  const drawRef = useRef<MapboxDraw | null>(null)
  const parkingDragRef = useRef<{ id: string; moved: boolean } | null>(null)
  const cadDragRef = useRef<{ id: string; moved: boolean } | null>(null)
  const accessDragRef = useRef<{ moved: boolean } | null>(null)
  const entranceDragRef = useRef<{ moved: boolean } | null>(null)
  const suppressNextMapClickRef = useRef(false)
  // Throttled (trailing-edge) live-draft-solve scheduling while dragging
  // boundary/exclusion/access geometry during Auto compare — mirrors
  // parking-layout-lab's LabMap draw.render throttle.
  const lastLiveDraftEmitRef = useRef(0)
  const liveDraftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Set when a polygon is closed to serve as the auto-parking boundary, so the
  // draw.selectionchange that MapboxDraw fires straight after draw.create does
  // not select the plot and flip the tool back to 'select' (see draw.create).
  const completingAutoBoundaryRef = useRef(false)
  const isApplyingDrawUpdateRef = useRef(false)
  const isProgrammaticDrawSyncRef = useRef(false)
  const isUserInteractionRef = useRef(true)
  const cadLayerHandlersRef = useRef<Map<string, CadLayerHandlers>>(new Map())
  // Every map.on registered during setup, so detach can map.off them all.
  const listenersRef = useRef<
    Array<{ type: string; layer?: string; handler: (...args: any[]) => void }>
  >([])
  // The base style the shared map currently carries. UnifiedMap always hands us
  // a 'hybrid' map on attach; we reconcile the sketch's style against this.
  const appliedStyleKeyRef = useRef<MapStyle>('hybrid')
  const firstViewportSyncRef = useRef(true)
  const [isLoaded, setIsLoaded] = useState(false)

  const {
    view,
    mapStyle,
    viewport,
    polygons,
    parkingBlocks,
    cadImages,
    cadInstances,
    savedCads,
    getCadForInstance,
    selectedId,
    selectedType,
    mapFocusRequest,
    activeTool,
    measurementInProgress,
    frozenMeasurement,
    cadPlacementInProgress,
    parkingMethod,
    autoParkingDraft,
    autoParkingCandidates,
    autoParkingSelectedCandidateId,
    autoParkingSolverRun,
    autoParkingLivePreview,
    autoLayouts,
    selectedAutoLayoutId,
    setViewport,
    addPolygon,
    addParkingBlock,
    updatePolygon,
    deletePolygon,
    setSelectedId,
    moveCadImage,
    updateCadInstance,
    placeCadImage,
    placeCadInstance,
    cancelCadPlacement,
    commitAutoParkingAccessAnchor,
    commitAutoParkingEntrance,
    cancelAutoParkingBoundaryEdit,
    cancelAutoParkingEntranceEdit,
    cancelAutoParkingAccessEdit,
    setSelectedAutoLayoutId,
  } = useSketchStore()

  const { generate: generateAutoParkingFull, generateDraft: generateAutoParkingDraft } = useAutoParkingWorker()

  /**
   * Builds the current solver input from committed store state (boundary +
   * detected exclusions + reprojected access point) for the guided flow's
   * live re-fit. Returns null when any required input is missing/invalid —
   * callers should silently skip the solve rather than throw.
   */
  const buildLiveAutoParkingInput = useCallback((accessPointOverride?: [number, number]) => {
    const state = useSketchStore.getState()
    const draft = state.autoParkingDraft
    if (!draft.boundaryId || !draft.accessAnchor || !draft.entrance) return null

    // Read boundary/exclusion geometry from Draw's LIVE buffer where a feature
    // is currently loaded (mid-drag), falling back to committed store state —
    // draw.render fires before the corresponding draw.update commits it.
    const liveById = new Map((drawRef.current?.getAll().features ?? []).map((f) => [String(f.id), f]))
    const liveRingFor = (id: string, fallback: [number, number][]): [number, number][] => {
      const live = liveById.get(id)
      return live && live.geometry.type === 'Polygon'
        ? (live.geometry.coordinates[0] as [number, number][])
        : fallback
    }

    const boundaryPolygon = state.polygons.find((p) => p.id === draft.boundaryId)
    if (!boundaryPolygon) return null
    const boundaryRing = liveRingFor(boundaryPolygon.id, boundaryPolygon.points)

    const polygonsForDetection = state.polygons.map((p) => ({ ...p, points: liveRingFor(p.id, p.points) }))
    const resolved = resolveGuidedExclusions({
      boundaryId: draft.boundaryId,
      boundaryRing,
      buildingRefs: draft.buildingRefs,
      polygons: polygonsForDetection,
      cadInstances: state.cadInstances,
      cadImages: state.cadImages,
      savedCads: state.savedCads,
    })
    if (resolved.missingRefs.length > 0) return null

    const accessPoint = accessPointOverride ?? reprojectAccessAnchor(draft.accessAnchor, boundaryRing)
    if (!accessPoint) return null
    const entrancePoint = resolveEntrance(draft.entrance, polygonsForDetection)
    if (!entrancePoint) return null

    return { boundaryRing, exclusions: resolved.exclusions, accessPoint, entrancePoint, settings: draft.settings }
  }, [])

  /** Full, authoritative solve — after draw.update / drag release / a committed settings change. */
  const refitAutoParkingFull = useCallback((accessPointOverride?: [number, number]) => {
    const state = useSketchStore.getState()
    if (state.parkingMethod !== 'auto' || !isAutoParkingLiveRefitActive(state.autoParkingDraft)) return
    const params = buildLiveAutoParkingInput(accessPointOverride)
    if (!params) return
    generateAutoParkingFull(buildSolverInput(params))
  }, [buildLiveAutoParkingInput, generateAutoParkingFull])

  const emitAutoParkingDraft = useCallback((accessPointOverride?: [number, number]) => {
    lastLiveDraftEmitRef.current = Date.now()
    const state = useSketchStore.getState()
    if (state.parkingMethod !== 'auto' || !isAutoParkingLiveRefitActive(state.autoParkingDraft)) return
    const params = buildLiveAutoParkingInput(accessPointOverride)
    if (!params) return
    const selectedCandidate = state.autoParkingCandidates.find(
      (c) => c.candidateId === state.autoParkingSelectedCandidateId
    )
    generateAutoParkingDraft(
      buildSolverInput(params),
      selectedCandidate ? representativeAngle(selectedCandidate.orientationSummary) : undefined
    )
  }, [buildLiveAutoParkingInput, generateAutoParkingDraft])

  const LIVE_DRAFT_THROTTLE_MS = 150
  /** Throttled (trailing-edge) draft-solve scheduling — mirrors parking-layout-lab's LabMap draw.render throttle. */
  const scheduleAutoParkingDraft = useCallback((accessPointOverride?: [number, number]) => {
    const since = Date.now() - lastLiveDraftEmitRef.current
    if (since >= LIVE_DRAFT_THROTTLE_MS) {
      if (liveDraftTimerRef.current) {
        clearTimeout(liveDraftTimerRef.current)
        liveDraftTimerRef.current = null
      }
      emitAutoParkingDraft(accessPointOverride)
    } else if (!liveDraftTimerRef.current) {
      liveDraftTimerRef.current = setTimeout(() => {
        liveDraftTimerRef.current = null
        emitAutoParkingDraft(accessPointOverride)
      }, LIVE_DRAFT_THROTTLE_MS - since)
    }
  }, [emitAutoParkingDraft])

  const handleCadMouseDown = useCallback(
    (e: mapboxgl.MapMouseEvent | mapboxgl.MapLayerMouseEvent, cadId: string) => {
      const id = cadId
      if (!id || !mapRef.current) return

      const state = useSketchStore.getState()
      if (state.cadPlacementInProgress) return
      if (state.activeTool !== 'select' && state.activeTool !== 'cad') return

      const cadState = getCadInteractionState(id)
      if (!cadState.exists || cadState.locked) return

      e.preventDefault()
      mapRef.current.dragPan.disable()
      cadDragRef.current = { id, moved: false }
      suppressNextMapClickRef.current = true
      mapRef.current.getCanvas().style.cursor = 'grabbing'
      setSelectedId(id, 'cad')
    },
    [setSelectedId]
  )

  const handleCadMouseMove = useCallback(
    (e: mapboxgl.MapMouseEvent) => {
      if (!cadDragRef.current) return
      const { id } = cadDragRef.current
      cadDragRef.current.moved = true
      const state = useSketchStore.getState()
      const anchor: [number, number] = [e.lngLat.lng, e.lngLat.lat]
      if (state.cadInstances.some((instance) => instance.id === id)) {
        updateCadInstance(id, { anchor })
      } else {
        moveCadImage(id, anchor)
      }
    },
    [moveCadImage, updateCadInstance]
  )

  const handleCadMouseUp = useCallback(() => {
    if (cadDragRef.current && mapRef.current) {
      mapRef.current.dragPan.enable()
      mapRef.current.getCanvas().style.cursor = ''
      cadDragRef.current = null
    }
  }, [])

  const handleCadMouseEnter = useCallback(
    (cadId: string) => () => {
      if (!mapRef.current) return
      const cadState = getCadInteractionState(cadId)
      if (cadState.exists && !cadState.locked) {
        mapRef.current.getCanvas().style.cursor = 'grab'
      }
    },
    []
  )

  const handleCadMouseLeave = useCallback(() => {
    if (mapRef.current) mapRef.current.getCanvas().style.cursor = ''
  }, [])

  const unregisterCadLayerHandlers = useCallback((map: mapboxgl.Map, cadId: string) => {
    const handlers = cadLayerHandlersRef.current.get(cadId)
    if (!handlers) return
    try {
      map.off('mousedown', `cad-layer-${cadId}`, handlers.mousedown)
      map.off('mouseenter', `cad-layer-${cadId}`, handlers.mouseenter)
      map.off('mouseleave', `cad-layer-${cadId}`, handlers.mouseleave)
    } catch (error) {
      console.warn(`Failed to remove CAD layer handlers for ${cadId}:`, error)
    } finally {
      cadLayerHandlersRef.current.delete(cadId)
    }
  }, [])

  const unregisterAllCadLayerHandlers = useCallback(
    (map: mapboxgl.Map) => {
      Array.from(cadLayerHandlersRef.current.keys()).forEach((cadId) => {
        unregisterCadLayerHandlers(map, cadId)
      })
    },
    [unregisterCadLayerHandlers]
  )

  const registerCadLayerHandlers = useCallback(
    (map: mapboxgl.Map, cadId: string) => {
      if (cadLayerHandlersRef.current.has(cadId)) return
      if (!map.getLayer(`cad-layer-${cadId}`)) return

      const mouseenterHandler = handleCadMouseEnter(cadId)
      const handlers: CadLayerHandlers = {
        mousedown: (event) => handleCadMouseDown(event, cadId),
        mouseenter: mouseenterHandler,
        mouseleave: handleCadMouseLeave,
      }
      map.on('mousedown', `cad-layer-${cadId}`, handlers.mousedown)
      map.on('mouseenter', `cad-layer-${cadId}`, handlers.mouseenter)
      map.on('mouseleave', `cad-layer-${cadId}`, handlers.mouseleave)
      cadLayerHandlersRef.current.set(cadId, handlers)
    },
    [handleCadMouseDown, handleCadMouseEnter, handleCadMouseLeave]
  )

  // Attach to the shared map: add sketch layers + handlers, detach on unmount.
  useEffect(() => {
    if (!map) return
    let cancelled = false

    // Register a handler on the map and record it for clean teardown.
    const on = (type: string, layerOrHandler: any, handler?: any) => {
      if (handler) {
        map.on(type as any, layerOrHandler, handler)
        listenersRef.current.push({ type, layer: layerOrHandler, handler })
      } else {
        map.on(type as any, layerOrHandler)
        listenersRef.current.push({ type, handler: layerOrHandler })
      }
    }

    const setup = () => {
      if (cancelled) return

      useSketchStore.getState().setMapInstance(map)

      // Adopt the current map viewport so we don't fly away on attach.
      const c = map.getCenter()
      useSketchStore.getState().setViewport({
        center: [c.lng, c.lat],
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing(),
      })

      const draw = setupMapboxDraw(map)
      drawRef.current = draw

      setup3DLayer(map)
      setupParkingLayer(map)
      setupAutoParkingLayer(map)

      const initialPolygons = useSketchStore.getState().polygons
      if (initialPolygons.length > 0) {
        loadPolygonsIntoDraw(draw, initialPolygons)
        syncPolygonsTo3D(map, initialPolygons)
      }
      syncParkingToMap(
        map,
        useSketchStore.getState().parkingBlocks,
        useSketchStore.getState().selectedId
      )

      on('draw.create', (e: any) => {
        const { checkPolygonLimit } = useSketchStore.getState()
        if (!checkPolygonLimit()) {
          const featureIds = e.features.map((f: any) => f.id)
          draw.delete(featureIds)
          toast.error('Polygon limit reached. Upgrade to Pro for unlimited polygons.')
          return
        }
        e.features.forEach((feature: any) => {
          const stateBeforeCreate = useSketchStore.getState()
          const isAutoParkingBoundary =
            stateBeforeCreate.parkingMethod === 'auto' &&
            stateBeforeCreate.autoParkingDraft.phase === 'boundary'
          const isAutoParkingBuilding =
            stateBeforeCreate.parkingMethod === 'auto' &&
            stateBeforeCreate.autoParkingDraft.phase === 'buildings' &&
            stateBeforeCreate.autoParkingDraft.buildingMode === 'draw'
          if (isAutoParkingBoundary || isAutoParkingBuilding) {
            feature.properties = { ...feature.properties, height: 0 }
          }
          const polygon = drawFeatureToPolygon(feature)
          const currentPolygons = useSketchStore.getState().polygons
          const existingNames = currentPolygons.map((p) => p.name)
          let nameIndex = isAutoParkingBuilding ? 1 : 0
          let newName = isAutoParkingBuilding ? `Building ${nameIndex}` : `Plot ${String.fromCharCode(65 + nameIndex)}`
          while (existingNames.includes(newName)) {
            nameIndex++
            newName = isAutoParkingBuilding ? `Building ${nameIndex}` : `Plot ${String.fromCharCode(65 + nameIndex)}`
          }
          const colorIndex = useSketchStore.getState().selectedPolygonColorIndex
          addPolygon({ ...polygon, name: newName, colorIndex })

          // Auto layout: a boundary drawn from within the guided flow's
          // boundary step becomes its site boundary and advances straight to
          // access placement — the user stays in the Parking tool throughout.
          if (isAutoParkingBoundary) {
            completingAutoBoundaryRef.current = true
            // Mapbox Draw emits draw.create synchronously from the click that
            // closes the polygon. The shared map's click handler runs later in
            // that same event dispatch; without suppressing it, the finishing
            // double-click is immediately reused to place vehicle access.
            suppressNextMapClickRef.current = true
            useSketchStore.getState().setAutoParkingBoundary(polygon.id)
          } else if (isAutoParkingBuilding) {
            suppressNextMapClickRef.current = true
            useSketchStore.getState().toggleAutoParkingBuilding(polygon.id, 'drawn')
          }
        })
        syncDrawTo3D(map, draw)
      })

      on('draw.update', (e: any) => {
        isApplyingDrawUpdateRef.current = true
        e.features.forEach((feature: any) => {
          const updatedPolygon = drawFeatureToPolygon(feature)
          updatePolygon(feature.id, {
            points: updatedPolygon.points,
            updatedAt: Date.now(),
          })
        })
        syncDrawTo3D(map, draw)
        // Committed geometry change (drag released / vertex edit finished) —
        // cancel any trailing throttled draft so a late tick can't fire after,
        // and visually undo, the full solve this update is about to trigger.
        if (liveDraftTimerRef.current) {
          clearTimeout(liveDraftTimerRef.current)
          liveDraftTimerRef.current = null
        }
        const stateAfterUpdate = useSketchStore.getState()
        if (
          stateAfterUpdate.parkingMethod === 'auto' &&
          stateAfterUpdate.autoParkingDraft.entrance &&
          !isEntranceValid(
            stateAfterUpdate.autoParkingDraft.entrance,
            stateAfterUpdate.polygons,
            stateAfterUpdate.polygons.find((polygon) => polygon.id === stateAfterUpdate.autoParkingDraft.boundaryId)?.points,
          )
        ) {
          stateAfterUpdate.setAutoParkingEntrance(null)
          stateAfterUpdate.setAutoParkingPhase('entrance')
        } else {
          refitAutoParkingFull()
        }
      })

      on('draw.delete', (e: any) => {
        if (isProgrammaticDrawSyncRef.current) return
        e.features.forEach((feature: any) => {
          const exists = useSketchStore.getState().polygons.some((p) => p.id === feature.id)
          if (exists) deletePolygon(feature.id)
        })
        syncDrawTo3D(map, draw)
      })

      on('draw.render', () => {
        const state = useSketchStore.getState()
        if (state.parkingMethod !== 'auto') return
        if (!isAutoParkingLiveRefitActive(state.autoParkingDraft)) return
        scheduleAutoParkingDraft()
      })

      on('draw.modechange', (e: any) => {
        // MapboxDraw's own built-in modes (draw_polygon) already cancel an
        // in-progress shape on Escape and fall back to simple_select — while
        // the guided flow is still waiting on its boundary step, re-arm
        // draw_polygon so the user can keep trying rather than getting stuck.
        const state = useSketchStore.getState()
        if (
          state.parkingMethod === 'auto' &&
          (state.autoParkingDraft.phase === 'boundary' ||
            (state.autoParkingDraft.phase === 'buildings' && state.autoParkingDraft.buildingMode === 'draw')) &&
          e.mode === 'simple_select'
        ) {
          requestAnimationFrame(() => {
            const current = useSketchStore.getState().autoParkingDraft
            if (current.phase === 'boundary' || (current.phase === 'buildings' && current.buildingMode === 'draw')) {
              try {
                draw.changeMode('draw_polygon')
              } catch {}
            }
          })
        }
      })

      on('draw.selectionchange', (e: any) => {
        // The plot we just closed to become the auto boundary must not select
        // itself (which would switch the tool to 'select' and leave auto mode).
        if (completingAutoBoundaryRef.current) {
          completingAutoBoundaryRef.current = false
          return
        }
        const state = useSketchStore.getState()
        // While the guided flow owns direct-select editing of the boundary or
        // an exclusion polygon (Change / in-compare direct edits), selecting
        // via Draw must not flip selectedId/selectedType — that belongs to
        // the Select tool only.
        if (state.parkingMethod === 'auto' && state.activeTool === 'parking') return
        const selectedId = e.features[0]?.id || null
        if (selectedId) {
          setSelectedId(selectedId, 'polygon')
          return
        }
        if (useSketchStore.getState().activeTool !== 'select') {
          setSelectedId(null, null)
        }
      })

      on('mouseenter', 'parking-block-fill', () => {
        const activeTool = useSketchStore.getState().activeTool
        if (activeTool === 'select') {
          map.getCanvas().style.cursor = 'move'
        } else if (activeTool === 'parking') {
          map.getCanvas().style.cursor = 'crosshair'
        }
      })

      on('mouseleave', 'parking-block-fill', () => {
        if (!parkingDragRef.current) {
          const activeTool = useSketchStore.getState().activeTool
          map.getCanvas().style.cursor =
            activeTool === 'parking' || activeTool === 'measure' ? 'crosshair' : ''
        }
      })

      on('mousedown', 'parking-block-fill', (event: any) => {
        const state = useSketchStore.getState()
        if (state.activeTool !== 'select' && state.activeTool !== 'parking') return
        const parkingId = event.features?.[0]?.properties?.id
        if (!parkingId) return
        event.preventDefault()
        parkingDragRef.current = { id: parkingId, moved: false }
        state.pushHistory()
        state.setSelectedId(parkingId, 'parking')
        map.dragPan.disable()
        map.getCanvas().style.cursor = 'grabbing'
      })

      on('mousedown', (event: mapboxgl.MapMouseEvent) => {
        const state = useSketchStore.getState()
        if (state.cadPlacementInProgress) return
        if (state.activeTool !== 'select' && state.activeTool !== 'cad') return
        const cadId = findCadImageAtPoint(
          map,
          event.point,
          state.cadImages,
          state.cadInstances,
          state.savedCads
        )
        if (!cadId) return
        handleCadMouseDown(event, cadId)
      })

      on('mousedown', 'auto-parking-access-dot', (event: mapboxgl.MapLayerMouseEvent) => {
        const state = useSketchStore.getState()
        if (state.parkingMethod !== 'auto' || !state.autoParkingDraft.accessAnchor) return
        const { phase } = state.autoParkingDraft
        if (phase === 'boundary' || phase === 'boundary-edit' || phase === 'generating') return
        event.preventDefault()
        accessDragRef.current = { moved: false }
        suppressNextMapClickRef.current = true
        map.dragPan.disable()
        map.getCanvas().style.cursor = 'grabbing'
      })

      on('mousedown', 'auto-parking-entrance-dot', (event: mapboxgl.MapLayerMouseEvent) => {
        const state = useSketchStore.getState()
        if (state.parkingMethod !== 'auto' || !state.autoParkingDraft.entrance) return
        if (state.autoParkingDraft.phase === 'boundary' || state.autoParkingDraft.phase === 'buildings' || state.autoParkingDraft.phase === 'generating') return
        event.preventDefault()
        entranceDragRef.current = { moved: false }
        suppressNextMapClickRef.current = true
        map.dragPan.disable()
        map.getCanvas().style.cursor = 'grabbing'
      })

      on('mousemove', (event: mapboxgl.MapMouseEvent) => {
        handleCadMouseMove(event)

        const dragState = parkingDragRef.current
        if (dragState) {
          dragState.moved = true
          useSketchStore
            .getState()
            .moveParkingBlock(dragState.id, [event.lngLat.lng, event.lngLat.lat])
          return
        }

        if (accessDragRef.current) {
          accessDragRef.current.moved = true
          const state = useSketchStore.getState()
          const boundary = state.polygons.find((p) => p.id === state.autoParkingDraft.boundaryId)
          if (boundary) {
            const snap = snapPointToBoundaryEdge([event.lngLat.lng, event.lngLat.lat], boundary.points)
            if (snap) {
              state.setAutoParkingAccessAnchor({ edgeIndex: snap.edgeIndex, distanceAlongEdgeM: snap.distanceAlongEdgeM })
              syncAutoParkingAccessPointToMap(map, snap.point)
              scheduleAutoParkingDraft(snap.point)
            }
          }
          return
        }

        if (entranceDragRef.current) {
          entranceDragRef.current.moved = true
          const state = useSketchStore.getState()
          const point: [number, number] = [event.lngLat.lng, event.lngLat.lat]
          const entrance = state.autoParkingDraft.entrance
          if (entrance?.kind === 'building') {
            const building = state.polygons.find((polygon) => polygon.id === entrance.buildingId)
            const snap = building ? snapPointToBoundaryEdge(point, building.points) : null
            if (snap) {
              state.setAutoParkingEntrance({
                kind: 'building',
                buildingId: entrance.buildingId,
                edgeIndex: snap.edgeIndex,
                distanceAlongEdgeM: snap.distanceAlongEdgeM,
              })
              scheduleAutoParkingDraft()
            }
          } else {
            const boundary = state.polygons.find((polygon) => polygon.id === state.autoParkingDraft.boundaryId)
            if (boundary && isPointInsideRing(point, boundary.points)) {
              state.setAutoParkingEntrance({ kind: 'target', point })
              scheduleAutoParkingDraft()
            }
          }
          return
        }

        const latestState = useSketchStore.getState()

        if (
          latestState.activeTool === 'parking' &&
          latestState.parkingMethod === 'auto' &&
          ENTRANCE_INTERACTIVE_PHASES.has(latestState.autoParkingDraft.phase)
        ) {
          const point: [number, number] = [event.lngLat.lng, event.lngLat.lat]
          if (latestState.autoParkingDraft.buildingRefs.length > 0) {
            const snap = snapEntranceToBuildings(point, latestState.autoParkingDraft.buildingRefs, latestState.polygons)
            latestState.setAutoParkingEntrance(snap?.entrance ?? null)
          } else {
            const boundary = latestState.polygons.find((polygon) => polygon.id === latestState.autoParkingDraft.boundaryId)
            latestState.setAutoParkingEntrance(boundary && isPointInsideRing(point, boundary.points) ? { kind: 'target', point } : null)
          }
          map.getCanvas().style.cursor = 'pointer'
          return
        }

        // Access placement (initial or "Change"): the nearest boundary edge
        // thickens and a preview marker follows the cursor before commit.
        if (
          latestState.activeTool === 'parking' &&
          latestState.parkingMethod === 'auto' &&
          ACCESS_INTERACTIVE_PHASES.has(latestState.autoParkingDraft.phase) &&
          latestState.autoParkingDraft.boundaryId
        ) {
          const boundary = latestState.polygons.find((p) => p.id === latestState.autoParkingDraft.boundaryId)
          if (boundary) {
            const snap = snapPointToBoundaryEdge([event.lngLat.lng, event.lngLat.lat], boundary.points)
            if (snap) {
              const ring = boundary.points
              const openLen = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.length - 1 : ring.length
              const a = ring[snap.edgeIndex]
              const b = ring[(snap.edgeIndex + 1) % openLen]
              syncAutoParkingHoverEdgeToMap(map, [a, b])
              syncAutoParkingAccessPointToMap(map, snap.point)
              map.getCanvas().style.cursor = 'pointer'
            }
          }
          return
        }

        if (latestState.activeTool !== 'measure') return
        const measurement = latestState.measurementInProgress
        if (!measurement || measurement.points.length === 0) return
        const lastPoint = measurement.points[measurement.points.length - 1].lngLat
        measurementPreviewStore.setState({
          lastMeasurementPoint: lastPoint,
          currentCursorPosition: [event.lngLat.lng, event.lngLat.lat],
        })
      })

      on('mouseup', () => {
        handleCadMouseUp()

        if (entranceDragRef.current) {
          const wasMoved = entranceDragRef.current.moved
          entranceDragRef.current = null
          suppressNextMapClickRef.current = true
          map.dragPan.enable()
          map.getCanvas().style.cursor = 'crosshair'
          if (wasMoved) {
            const entrance = useSketchStore.getState().autoParkingDraft.entrance
            if (entrance) {
              useSketchStore.getState().commitAutoParkingEntrance(entrance)
              refitAutoParkingFull()
            }
          }
          return
        }

        if (accessDragRef.current) {
          const wasMoved = accessDragRef.current.moved
          accessDragRef.current = null
          const isPlacingChangedAccess =
            !wasMoved && useSketchStore.getState().autoParkingDraft.phase === 'access-edit'
          // A stationary press on the access marker during "Change" is a
          // placement click, not a drag. Let the following click handler snap
          // and commit it; only suppress the synthetic click after a real drag
          // (or when the marker is not currently being repositioned).
          suppressNextMapClickRef.current = !isPlacingChangedAccess
          map.dragPan.enable()
          map.getCanvas().style.cursor = 'crosshair'
          if (wasMoved) {
            const state = useSketchStore.getState()
            const anchor = state.autoParkingDraft.accessAnchor
            if (anchor) {
              state.commitAutoParkingAccessAnchor(anchor)
              refitAutoParkingFull()
            }
          }
          return
        }

        const dragState = parkingDragRef.current
        if (!dragState) return
        suppressNextMapClickRef.current = true
        parkingDragRef.current = null
        map.dragPan.enable()
        const activeTool = useSketchStore.getState().activeTool
        map.getCanvas().style.cursor =
          activeTool === 'parking' || activeTool === 'measure' ? 'crosshair' : ''
      })

      on('click', (event: mapboxgl.MapMouseEvent) => {
        if (suppressNextMapClickRef.current) {
          suppressNextMapClickRef.current = false
          return
        }

        const state = useSketchStore.getState()

        if (state.cadPlacementInProgress) {
          const { effectiveAccess } = state
          if (!effectiveAccess.hasPlusAccess) {
            toast.error('CAD overlay requires Plus subscription.')
            return
          }
          const anchor: [number, number] = [event.lngLat.lng, event.lngLat.lat]
          if (
            typeof state.cadPlacementInProgress === 'object' &&
            'savedCadId' in state.cadPlacementInProgress
          ) {
            placeCadInstance(state.cadPlacementInProgress.savedCadId, anchor)
          } else {
            placeCadImage(state.cadPlacementInProgress as string, anchor)
          }
          return
        }

        if (state.activeTool === 'parking' && state.parkingMethod === 'auto') {
          // Auto layout: no manual block is ever created while this method is
          // active — see README.md's interaction priority table.
          const draft = state.autoParkingDraft
          if (draft.phase === 'buildings') {
            if (draft.buildingMode === 'select') {
              const lngLat: [number, number] = [event.lngLat.lng, event.lngLat.lat]
              const boundary = state.polygons.find((polygon) => polygon.id === draft.boundaryId)
              const hitPolygon = state.polygons
                .filter((polygon) =>
                  polygon.id !== draft.boundaryId &&
                  isPointInPolygon(lngLat, polygon.points) &&
                  (!boundary || ringsIntersect(boundary.points, polygon.points))
                )
                .map((polygon) => ({ polygon, area: getProjectedPolygonArea(map, polygon.points) }))
                .sort((a, b) => a.area - b.area)[0]?.polygon
              if (hitPolygon) {
                state.toggleAutoParkingBuilding(hitPolygon.id, 'selected')
                refitAutoParkingFull()
              }
            }
            return
          }
          if (ENTRANCE_INTERACTIVE_PHASES.has(draft.phase) && draft.boundaryId) {
            const point: [number, number] = [event.lngLat.lng, event.lngLat.lat]
            if (draft.buildingRefs.length > 0) {
              const snap = snapEntranceToBuildings(point, draft.buildingRefs, state.polygons)
              if (snap) {
                commitAutoParkingEntrance(snap.entrance)
                refitAutoParkingFull()
              }
            } else {
              const boundary = state.polygons.find((polygon) => polygon.id === draft.boundaryId)
              if (boundary && isPointInsideRing(point, boundary.points)) {
                commitAutoParkingEntrance({ kind: 'target', point })
                refitAutoParkingFull()
              }
            }
            return
          }
          if ((draft.phase === 'access' || draft.phase === 'access-edit') && draft.boundaryId) {
            const boundary = state.polygons.find((p) => p.id === draft.boundaryId)
            if (boundary) {
              const snap = snapPointToBoundaryEdge(
                [event.lngLat.lng, event.lngLat.lat],
                boundary.points
              )
              if (snap) {
                commitAutoParkingAccessAnchor({ edgeIndex: snap.edgeIndex, distanceAlongEdgeM: snap.distanceAlongEdgeM })
                refitAutoParkingFull(snap.point)
              }
            }
            return
          }
          // Ready / comparing / editing: clicking a boundary or exclusion
          // polygon's body enters direct vertex editing on it (same
          // click-to-edit affordance the Select tool offers) so the user can
          // manipulate boundary/building vertices directly during compare.
          if (draft.phase === 'ready' || draft.phase === 'compare' || draft.phase === 'editing') {
            const lngLat: [number, number] = [event.lngLat.lng, event.lngLat.lat]
            const editableIds = new Set([
              draft.boundaryId,
              ...draft.buildingRefs.map((ref) => ref.id),
            ])
            const hitPolygon = state.polygons
              .filter((polygon) => editableIds.has(polygon.id) && isPointInPolygon(lngLat, polygon.points))
              .map((polygon) => ({ polygon, area: getProjectedPolygonArea(map, polygon.points) }))
              .sort((a, b) => a.area - b.area)[0]?.polygon
            if (hitPolygon) selectPolygonForVertexEditing(draw, hitPolygon.id)
          }
          return
        }

        if (state.activeTool === 'parking') {
          const { checkParkingLimit } = state
          if (!checkParkingLimit()) {
            toast.error('Parking limit reached. Upgrade to Pro for unlimited parking blocks.')
            return
          }
          const existingNames = state.parkingBlocks.map((parking) => parking.name)
          let nameIndex = 1
          let name = `Parking ${nameIndex}`
          while (existingNames.includes(name)) {
            nameIndex++
            name = `Parking ${nameIndex}`
          }
          const id = `parking-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
          addParkingBlock({
            id,
            name,
            spaces: state.parkingPlacement.spaces,
            layout: state.parkingPlacement.layout,
            stallSize: state.parkingPlacement.stallSize,
            anchor: [event.lngLat.lng, event.lngLat.lat],
            rotation: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          })
          setSelectedId(id, 'parking')
          return
        }

        if (state.activeTool === 'measure') {
          const lngLat: [number, number] = [event.lngLat.lng, event.lngLat.lat]
          if (state.frozenMeasurement) return
          const { checkMeasurementLimit } = state
          if (!checkMeasurementLimit()) {
            toast.error(
              'Measurement segment limit reached (20 segments). Upgrade to Pro for unlimited measurements.'
            )
            return
          }
          if (!state.measurementInProgress) state.startMeasurement()
          const latestState = useSketchStore.getState()
          const prevPoint = latestState.measurementInProgress?.points.slice(-1)[0]?.lngLat
          const distance = prevPoint ? calculateEdgeDistance(prevPoint, lngLat) : undefined
          state.addMeasurementPoint(lngLat, distance)
          measurementPreviewStore.setState({ currentCursorPosition: null })
          return
        }

        if (state.activeTool === 'select') {
          const point = event.point
          const lngLat: [number, number] = [event.lngLat.lng, event.lngLat.lat]
          window.setTimeout(() => {
            const latestState = useSketchStore.getState()

            if (map.getLayer('parking-block-fill')) {
              const parkingFeatures = map.queryRenderedFeatures(
                [
                  [point.x - 4, point.y - 4],
                  [point.x + 4, point.y + 4],
                ],
                { layers: ['parking-block-fill'] }
              )
              const parkingId = parkingFeatures[0]?.properties?.id
              if (parkingId) {
                draw.changeMode('simple_select', { featureIds: [] })
                latestState.setSelectedId(parkingId, 'parking')
                return
              }
            }

            const autoParkingLayers = ['auto-parking-stall-fill', 'auto-parking-aisle-fill'].filter(
              (layerId) => map.getLayer(layerId)
            )
            if (autoParkingLayers.length > 0) {
              const autoParkingFeatures = map.queryRenderedFeatures(
                [
                  [point.x - 4, point.y - 4],
                  [point.x + 4, point.y + 4],
                ],
                { layers: autoParkingLayers }
              )
              const autoLayoutId = autoParkingFeatures[0]?.properties?.autoLayoutId
              if (autoLayoutId) {
                draw.changeMode('simple_select', { featureIds: [] })
                latestState.setSelectedAutoLayoutId(autoLayoutId)
                return
              }
            }

            const cadLayers = [
              ...latestState.cadImages
                .filter((c) => c.anchor !== null)
                .map((c) => `cad-layer-${c.id}`),
              ...latestState.cadInstances.map((instance) => `cad-layer-${instance.id}`),
            ].filter((layerId) => map.getLayer(layerId))

            if (cadLayers.length > 0) {
              const cadFeatures = map.queryRenderedFeatures(
                [
                  [point.x - 4, point.y - 4],
                  [point.x + 4, point.y + 4],
                ],
                { layers: cadLayers }
              )
              const cadFeatureLayerId = cadFeatures[0]?.layer?.id
              if (cadFeatureLayerId) {
                const cadId = cadFeatureLayerId.replace('cad-layer-', '')
                draw.changeMode('simple_select', { featureIds: [] })
                latestState.setSelectedId(cadId, 'cad')
                return
              }
            }

            const hitPolygon = latestState.polygons
              .filter((polygon) => isPointInPolygon(lngLat, polygon.points))
              .map((polygon) => ({
                polygon,
                area: getProjectedPolygonArea(map, polygon.points),
              }))
              .sort((a, b) => a.area - b.area)[0]?.polygon

            if (hitPolygon) {
              selectPolygonForVertexEditing(draw, hitPolygon.id)
              latestState.setSelectedId(hitPolygon.id, 'polygon')
              return
            }

            draw.changeMode('simple_select', { featureIds: [] })
            latestState.setSelectedId(null, null)
          }, 0)
        }
      })

      on('moveend', () => {
        if (isUserInteractionRef.current) {
          const center = map.getCenter()
          setViewport({
            center: [center.lng, center.lat],
            zoom: map.getZoom(),
            pitch: map.getPitch(),
            bearing: map.getBearing(),
          })
        }
        isUserInteractionRef.current = true
      })

      setIsLoaded(true)
    }

    if (map.isStyleLoaded()) {
      setup()
    } else {
      map.once('idle', setup)
    }

    return () => {
      cancelled = true
      const m = mapRef.current
      try {
        unregisterAllCadLayerHandlers(m)
      } catch {}
      // Remove all tracked map listeners.
      listenersRef.current.forEach(({ type, layer, handler }) => {
        try {
          if (layer) m.off(type as any, layer, handler)
          else m.off(type as any, handler)
        } catch {}
      })
      listenersRef.current = []
      // Remove the draw control (its layers/sources go with it).
      try {
        if (drawRef.current) m.removeControl(drawRef.current)
      } catch {}
      drawRef.current = null
      try {
        useSketchStore.getState().setMapInstance(null)
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map])

  // Handle map style changes. Reconcile against the base the shared map already
  // carries so we skip the redundant restyle when they already agree.
  useEffect(() => {
    if (!(mapRef.current && drawRef.current && isLoaded)) return
    if (appliedStyleKeyRef.current === mapStyle) return
    appliedStyleKeyRef.current = mapStyle
    const map = mapRef.current
    unregisterAllCadLayerHandlers(map)

    map.once('style.load', () => {
      const is3D = useSketchStore.getState().view === '3d'
      setup3DLayer(map)
      setupParkingLayer(map)
      setupAutoParkingLayer(map)
      {
        const s = useSketchStore.getState()
        syncAutoParkingAccessPointToMap(map, resolveAutoParkingAccessPoint(s))
        syncAutoParkingGuidanceForState(map, s)
        syncAutoParkingLayoutsToMap(
          map,
          getAutoParkingLayoutRenderEntries(s),
          s.selectedAutoLayoutId,
          getAutoParkingPreviewGeometry(s)
        )
      }

      const currentCadImages = useSketchStore.getState().cadImages
      currentCadImages.forEach((cadImage) => {
        if (cadImage.anchor !== null) {
          addCadImageToMap(map, cadImage)
          registerCadLayerHandlers(map, cadImage.id)
        }
      })

      const state = useSketchStore.getState()
      state.cadInstances.forEach((instance) => {
        const savedCad = state.savedCads.find((cad) => cad.id === instance.savedCadId)
        if (savedCad) {
          addCadImageToMap(map, instance, savedCad)
          registerCadLayerHandlers(map, instance.id)
        }
      })

      syncPolygonsTo3D(map, useSketchStore.getState().polygons)
      syncParkingToMap(
        map,
        useSketchStore.getState().parkingBlocks,
        useSketchStore.getState().selectedId
      )
      toggle3DLayer(map, is3D)
    })

    map.setStyle(MAP_STYLES[mapStyle])
  }, [mapStyle, isLoaded, registerCadLayerHandlers, unregisterAllCadLayerHandlers])

  // Handle view mode changes (2D/3D)
  useEffect(() => {
    if (mapRef.current && drawRef.current && isLoaded) {
      const is3D = view === '3d'
      toggle3DLayer(mapRef.current, is3D)
      mapRef.current.easeTo({ pitch: is3D ? 60 : 0, duration: 600 })
      if (is3D) {
        syncPolygonsTo3D(mapRef.current, useSketchStore.getState().polygons)
      }
    }
  }, [view, isLoaded])

  // Handle tool and selection changes
  useEffect(() => {
    if (mapRef.current && drawRef.current && isLoaded) {
      const map = mapRef.current
      // The Auto parking flow draws its site boundary while the Parking tool
      // stays active, so drive draw mode off the draft phase too, not just
      // the Polygon tool; "Change" on a completed boundary card enters
      // direct vertex editing on that same polygon.
      const drawingAutoBoundary = parkingMethod === 'auto' && autoParkingDraft.phase === 'boundary'
      const drawingAutoBuilding =
        parkingMethod === 'auto' &&
        autoParkingDraft.phase === 'buildings' &&
        autoParkingDraft.buildingMode === 'draw'
      const editingAutoBoundary = parkingMethod === 'auto' && autoParkingDraft.phase === 'boundary-edit'
      if (activeTool === 'polygon' || drawingAutoBoundary || drawingAutoBuilding) {
        enterPolygonDrawMode(drawRef.current, mapRef.current)
      } else if (editingAutoBoundary && autoParkingDraft.boundaryId) {
        selectPolygonForVertexEditing(drawRef.current, autoParkingDraft.boundaryId)
      } else if (activeTool === 'select') {
        if (selectedId && selectedType === 'polygon') {
          selectPolygonForVertexEditing(drawRef.current, selectedId)
        } else {
          drawRef.current.changeMode('simple_select')
        }
      } else {
        drawRef.current.changeMode('simple_select')
      }

      const autoAccessPlacement = parkingMethod === 'auto' && ACCESS_INTERACTIVE_PHASES.has(autoParkingDraft.phase)
      if (
        activeTool === 'measure' ||
        activeTool === 'parking' ||
        drawingAutoBoundary ||
        autoAccessPlacement ||
        cadPlacementInProgress
      ) {
        map.getCanvas().style.cursor = 'crosshair'
      } else {
        map.getCanvas().style.cursor = ''
      }
    }
  }, [
    activeTool,
    selectedId,
    selectedType,
    isLoaded,
    cadPlacementInProgress,
    parkingMethod,
    autoParkingDraft.phase,
    autoParkingDraft.boundaryId,
    autoParkingDraft.buildingMode,
  ])

  // Sync polygon geometry changes from store back to Draw.
  useEffect(() => {
    if (mapRef.current && drawRef.current && isLoaded) {
      if (isApplyingDrawUpdateRef.current) {
        isApplyingDrawUpdateRef.current = false
      } else {
        isProgrammaticDrawSyncRef.current = true
        try {
          loadPolygonsIntoDraw(drawRef.current, polygons)
        } finally {
          isProgrammaticDrawSyncRef.current = false
        }
        const { selectedId, selectedType } = useSketchStore.getState()
        if (selectedId && selectedType === 'polygon') {
          selectPolygonForVertexEditing(drawRef.current, selectedId)
        }
      }
      syncPolygonsTo3D(mapRef.current, polygons)
    }
  }, [polygons, isLoaded])

  // Sync parking changes from store back to map layers
  useEffect(() => {
    if (mapRef.current && isLoaded) {
      syncParkingToMap(mapRef.current, parkingBlocks, selectedId)
    }
  }, [parkingBlocks, selectedId, isLoaded])

  // Sync the Auto layout draft's access-point marker (resolved from its
  // edge-relative anchor against the current boundary ring, so it stays
  // pinned as the boundary is reshaped).
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return
    syncAutoParkingAccessPointToMap(mapRef.current, resolveAutoParkingAccessPoint(useSketchStore.getState()))
  }, [parkingMethod, autoParkingDraft.accessAnchor, autoParkingDraft.boundaryId, polygons, isLoaded])

  useEffect(() => {
    if (!mapRef.current || !isLoaded) return
    syncAutoParkingGuidanceForState(mapRef.current, useSketchStore.getState())
  }, [
    parkingMethod,
    autoParkingDraft.buildingRefs,
    autoParkingDraft.entrance,
    polygons,
    autoParkingDraft.phase,
    autoParkingCandidates,
    autoParkingSelectedCandidateId,
    autoParkingSolverRun,
    autoParkingLivePreview,
    isLoaded,
  ])

  // Clear the hover-edge affordance whenever access placement isn't active.
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return
    if (!(parkingMethod === 'auto' && ACCESS_INTERACTIVE_PHASES.has(autoParkingDraft.phase))) {
      syncAutoParkingHoverEdgeToMap(mapRef.current, null)
    }
  }, [parkingMethod, autoParkingDraft.phase, isLoaded])

  // Sync applied auto-parking layouts (bays/aisles/corridor, stale opacity +
  // clip + amber boundary overlay) + selection, plus the transient candidate
  // preview / live draft preview while the user is comparing/editing.
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return
    const state = useSketchStore.getState()
    const preview = getAutoParkingPreviewGeometry(state)
    syncAutoParkingLayoutsToMap(mapRef.current, getAutoParkingLayoutRenderEntries(state), selectedAutoLayoutId, preview)
  }, [
    autoLayouts,
    selectedAutoLayoutId,
    isLoaded,
    parkingMethod,
    polygons,
    cadInstances,
    cadImages,
    savedCads,
    autoParkingDraft.phase,
    autoParkingCandidates,
    autoParkingSelectedCandidateId,
    autoParkingSolverRun,
    autoParkingLivePreview,
  ])

  // Sync CAD images with map
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return
    const map = mapRef.current

    const layerIds = map
      .getStyle()
      .layers.filter((l) => l.id.startsWith('cad-layer-'))
      .map((l) => l.id.replace('cad-layer-', ''))

    layerIds.forEach((id) => {
      const cad = cadImages.find((c) => c.id === id)
      const instance = cadInstances.find((c) => c.id === id)
      if (!instance && (!cad || cad.anchor === null)) {
        unregisterCadLayerHandlers(map, id)
        removeCadImageFromMap(map, id)
      }
    })

    cadImages.forEach((cadImage) => {
      if (cadImage.anchor === null) return
      if (map.getSource(`cad-image-${cadImage.id}`)) {
        updateCadImageOnMap(map, cadImage)
      } else {
        addCadImageToMap(map, cadImage)
      }
      registerCadLayerHandlers(map, cadImage.id)
    })
  }, [cadImages, cadInstances, isLoaded, registerCadLayerHandlers, unregisterCadLayerHandlers])

  // Sync cadInstances to map
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return
    const map = mapRef.current

    const layerIds = map
      .getStyle()
      .layers.filter((l) => l.id.startsWith('cad-layer-'))
      .map((l) => l.id.replace('cad-layer-', ''))

    layerIds.forEach((id) => {
      const instance = cadInstances.find((i) => i.id === id)
      if (!instance) {
        const isLegacyCad = cadImages.find((c) => c.id === id)
        if (!isLegacyCad) {
          unregisterCadLayerHandlers(map, id)
          removeCadImageFromMap(map, id)
        }
      }
    })

    cadInstances.forEach((instance) => {
      const savedCad = getCadForInstance(instance.id)
      if (!savedCad) return
      if (map.getSource(`cad-image-${instance.id}`)) {
        updateCadImageOnMap(map, instance, savedCad)
      } else {
        addCadImageToMap(map, instance, savedCad)
      }
      registerCadLayerHandlers(map, instance.id)
    })
  }, [
    cadInstances,
    savedCads,
    getCadForInstance,
    isLoaded,
    registerCadLayerHandlers,
    unregisterCadLayerHandlers,
  ])

  // Handle layer focus requests from panels.
  useEffect(() => {
    if (!mapRef.current || !isLoaded || !mapFocusRequest) return
    const map = mapRef.current
    if (mapFocusRequest.bounds) {
      const [southWest, northEast] = mapFocusRequest.bounds
      const boundsAreCollapsed =
        southWest[0] === northEast[0] && southWest[1] === northEast[1]
      if (!boundsAreCollapsed) {
        map.fitBounds(new mapboxgl.LngLatBounds(southWest, northEast), {
          maxZoom: 19,
          duration: 1000,
          pitch: 0,
          bearing: map.getBearing(),
          essential: true,
        })
        return
      }
    }
    map.flyTo({
      center: mapFocusRequest.center,
      zoom: mapFocusRequest.zoom ?? 18.5,
      pitch: 0,
      bearing: map.getBearing(),
      duration: 1000,
      essential: true,
    })
  }, [mapFocusRequest, isLoaded])

  // Handle programmatic viewport changes (skip first run — we adopted the map's
  // viewport on attach and don't want to fly on entry).
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return
    if (firstViewportSyncRef.current) {
      firstViewportSyncRef.current = false
      return
    }
    const map = mapRef.current
    const currentCenter = map.getCenter()
    const currentZoom = map.getZoom()
    const centerChanged =
      Math.abs(currentCenter.lng - viewport.center[0]) > 0.0001 ||
      Math.abs(currentCenter.lat - viewport.center[1]) > 0.0001
    const zoomChanged = Math.abs(currentZoom - viewport.zoom) > 0.01
    if (centerChanged || zoomChanged) {
      isUserInteractionRef.current = false
      map.flyTo({
        center: viewport.center,
        zoom: viewport.zoom,
        pitch: viewport.pitch,
        bearing: viewport.bearing,
        duration: 1000,
        essential: true,
      })
    }
  }, [viewport.center, viewport.zoom, viewport.pitch, viewport.bearing, isLoaded])

  // Cancel CAD placement on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && cadPlacementInProgress) {
        cancelCadPlacement()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cadPlacementInProgress, cancelCadPlacement])

  // Escape during the guided Auto flow's boundary-edit / access-edit
  // sub-modes restores the pre-edit geometry and exits editing. Boundary
  // draw's own Escape-to-cancel is handled natively by MapboxDraw + the
  // draw.modechange re-arm above; the very first access placement (phase
  // 'access', nothing to restore yet) has no Escape behaviour to define.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const state = useSketchStore.getState()
      if (state.parkingMethod !== 'auto') return
      const { phase } = state.autoParkingDraft
      if (phase === 'boundary-edit') {
        cancelAutoParkingBoundaryEdit()
        try {
          drawRef.current?.changeMode('simple_select')
        } catch {}
      } else if (phase === 'access-edit') {
        cancelAutoParkingAccessEdit()
      } else if (phase === 'entrance-edit') {
        cancelAutoParkingEntranceEdit()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cancelAutoParkingBoundaryEdit, cancelAutoParkingAccessEdit, cancelAutoParkingEntranceEdit])

  return (
    <>
      {isLoaded && <PolygonLabels />}
      {isLoaded && (measurementInProgress || frozenMeasurement) && <MeasurementOverlay />}
      {isLoaded && <PolygonDrawPreviewOverlay />}
      {isLoaded && <AutoParkingOverlays />}
      <div className={`view-3d-vignette ${view === '3d' ? 'view-3d' : ''}`} />
    </>
  )
}
