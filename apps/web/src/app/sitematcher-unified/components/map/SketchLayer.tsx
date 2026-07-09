'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager'
import { measurementPreviewStore } from '@/lib/sitesketcher-v2/measurement-preview-store'
import { MAP_STYLES } from '@/lib/sitesketcher-v2/constants'
import {
  setupMapboxDraw,
  setup3DLayer,
  setupParkingLayer,
  toggle3DLayer,
  syncDrawTo3D,
  syncParkingToMap,
  syncPolygonsTo3D,
  loadPolygonsIntoDraw,
  enterPolygonDrawMode,
  drawFeatureToPolygon,
  addCadImageToMap,
  updateCadImageOnMap,
  removeCadImageFromMap,
} from '@/lib/sitesketcher-v2/mapbox-integration'
import { calculateCadImageCorners } from '@/lib/sitesketcher-v2/cad-utils'
import { calculateEdgeDistance } from '@/lib/sitesketcher-v2/polygon-utils'
import type { CadImage, CadInstance, SavedCad, MapStyle } from '@/types/sitesketcher-v2'
import { PolygonLabels } from '../../../sitesketcher-v2/components/map/PolygonLabels'
import { MeasurementOverlay } from '../../../sitesketcher-v2/components/map/MeasurementOverlay'
import { PolygonDrawPreviewOverlay } from '../../../sitesketcher-v2/components/map/PolygonDrawPreviewOverlay'
import mapboxgl from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import { toast } from 'sonner'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'

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
  const suppressNextMapClickRef = useRef(false)
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
  } = useSketchStore()

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
          const polygon = drawFeatureToPolygon(feature)
          const currentPolygons = useSketchStore.getState().polygons
          const existingNames = currentPolygons.map((p) => p.name)
          let nameIndex = 0
          let newName = `Plot ${String.fromCharCode(65 + nameIndex)}`
          while (existingNames.includes(newName)) {
            nameIndex++
            newName = `Plot ${String.fromCharCode(65 + nameIndex)}`
          }
          const colorIndex = useSketchStore.getState().selectedPolygonColorIndex
          addPolygon({ ...polygon, name: newName, colorIndex })
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
      })

      on('draw.delete', (e: any) => {
        if (isProgrammaticDrawSyncRef.current) return
        e.features.forEach((feature: any) => {
          const exists = useSketchStore.getState().polygons.some((p) => p.id === feature.id)
          if (exists) deletePolygon(feature.id)
        })
        syncDrawTo3D(map, draw)
      })

      on('draw.selectionchange', (e: any) => {
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

        const latestState = useSketchStore.getState()
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
      if (activeTool === 'polygon') {
        enterPolygonDrawMode(drawRef.current, mapRef.current)
      } else if (activeTool === 'select') {
        if (selectedId && selectedType === 'polygon') {
          selectPolygonForVertexEditing(drawRef.current, selectedId)
        } else {
          drawRef.current.changeMode('simple_select')
        }
      } else {
        drawRef.current.changeMode('simple_select')
      }

      if (activeTool === 'measure' || activeTool === 'parking' || cadPlacementInProgress) {
        map.getCanvas().style.cursor = 'crosshair'
      } else {
        map.getCanvas().style.cursor = ''
      }
    }
  }, [activeTool, selectedId, selectedType, isLoaded, cadPlacementInProgress])

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

  return (
    <>
      {isLoaded && <PolygonLabels />}
      {isLoaded && (measurementInProgress || frozenMeasurement) && <MeasurementOverlay />}
      {isLoaded && <PolygonDrawPreviewOverlay />}
      <div className={`view-3d-vignette ${view === '3d' ? 'view-3d' : ''}`} />
    </>
  )
}
