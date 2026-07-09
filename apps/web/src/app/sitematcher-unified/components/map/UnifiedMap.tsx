'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MAP_STYLES, MAPBOX_TOKEN } from '@/lib/sitesketcher-v2/constants'
import { useWorkspaceStore } from '../../lib/stores/unified-workspace-store'
import type { NearbyStore } from '../../lib/services/gaps-service'

// UK-wide "national" starting view for discovery.
const NATIONAL_VIEWPORT = {
  center: [-2.5, 54.2] as [number, number],
  zoom: 5.2,
}

const BUA_TILESET_ID = 'dovet.ciilxjuj'
const BUA_SOURCE_ID = 'bua-source'
const BUA_SOURCE_LAYER = 'bua'
const BUA_FILL_LAYER = 'bua-fill'
const BUA_OUTLINE_LAYER = 'bua-outline'
const BUA_SELECTED_LAYER = 'bua-selected'

const RADIUS_SOURCE = 'assess-radius'
const RADIUS_FILL_LAYER = 'assess-radius-fill'
const RADIUS_LINE_LAYER = 'assess-radius-line'
const STORES_SOURCE = 'assess-stores'
const STORES_LAYER = 'assess-stores-dots'

// LSOA catchment cells (Catchment tab) — reuses the SiteAnalyser tileset.
const LSOA_TILESET_ID = 'dovet.3xo625k3'
const LSOA_SOURCE_ID = 'catchment-lsoa'
const LSOA_SOURCE_LAYER = 'Lower_layer_Super_Output_Area-4ntic5'
const LSOA_CODE_PROP = 'LSOA21CD'
const LSOA_FILL_SELECTED = 'lsoa-fill-selected'
const LSOA_FILL_DESELECTED = 'lsoa-fill-deselected'
const LSOA_OUTLINE_SELECTED = 'lsoa-outline-selected'
const LSOA_OUTLINE_DESELECTED = 'lsoa-outline-deselected'
const CATCH_SOURCE = 'catchment-boundary'
const CATCH_LINE_LAYER = 'catchment-boundary-line'

export interface LsoaLayerProps {
  allCodes: string[]
  selectedCodes: Set<string>
  onToggle: (code: string) => void
  boundaryGeometry: GeoJSON.Geometry | null
}

function buaFilter(codes: string[] | null, range: [number, number]) {
  const pop = ['coalesce', ['get', 'pop_final'], ['get', 'pop']] as const
  const conditions: any[] = ['all', ['>=', pop, range[0]], ['<=', pop, range[1]]]
  if (codes && codes.length > 0) {
    conditions.push(['in', ['get', 'gsscode'], ['literal', codes]])
  }
  return conditions
}

// Insert BUA/overlay layers below the base style's label symbols.
function firstSymbolLayerId(map: mapboxgl.Map): string | undefined {
  const layers = map.getStyle()?.layers ?? []
  return layers.find((l) => l.type === 'symbol')?.id
}

function applyMapCursor(map: mapboxgl.Map) {
  const st = useWorkspaceStore.getState()
  // Crosshair only for dropping an Assess pin — not while toggling catchment cells.
  map.getCanvas().style.cursor =
    st.view === 'assess' && st.tab !== 'catchment' ? 'crosshair' : ''
}

// A GeoJSON polygon approximating a circle of `radiusKm` around [lng, lat].
function circlePolygon(
  lng: number,
  lat: number,
  radiusKm: number,
  steps = 64
): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = []
  const distanceX = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180))
  const distanceY = radiusKm / 110.574
  for (let i = 0; i < steps; i++) {
    const theta = (i / steps) * (2 * Math.PI)
    coords.push([lng + distanceX * Math.cos(theta), lat + distanceY * Math.sin(theta)])
  }
  coords.push(coords[0])
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [coords] },
    properties: {},
  }
}

export function UnifiedMap({
  storeDots = [],
  lsoa,
  onMap,
}: {
  storeDots?: NearbyStore[]
  lsoa?: LsoaLayerProps
  onMap?: (map: mapboxgl.Map | null) => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const prevViewRef = useRef(useWorkspaceStore.getState().view)
  const pinRef = useRef<mapboxgl.Marker | null>(null)
  const readyRef = useRef(false)
  // Latest LSOA toggle handler, read inside the once-registered map click handler.
  const lsoaToggleRef = useRef<((code: string) => void) | undefined>(undefined)
  lsoaToggleRef.current = lsoa?.onToggle

  const view = useWorkspaceStore((s) => s.view)
  const tab = useWorkspaceStore((s) => s.tab)
  const showLsoa = useWorkspaceStore((s) => s.showLsoa)
  const area = useWorkspaceStore((s) => s.area)
  const gapGssCodes = useWorkspaceStore((s) => s.gapGssCodes)
  const populationRange = useWorkspaceStore((s) => s.populationRange)
  const assessPoint = useWorkspaceStore((s) => s.assessPoint)
  const radiusKm = useWorkspaceStore((s) => s.radiusKm)
  const selectArea = useWorkspaceStore((s) => s.selectArea)
  const setAssessPoint = useWorkspaceStore((s) => s.setAssessPoint)

  // Add BUA + overlay layers to the current style. Safe to call repeatedly.
  const addLayers = (map: mapboxgl.Map) => {
    if (!map.isStyleLoaded()) return
    // While sketching, the SketchLayer owns the style — don't re-add discovery
    // layers on top of it (its setStyle calls also fire our 'style.load').
    if (useWorkspaceStore.getState().view === 'sketch') return

    if (!map.getSource(BUA_SOURCE_ID)) {
      map.addSource(BUA_SOURCE_ID, { type: 'vector', url: `mapbox://${BUA_TILESET_ID}` })
    }
    const beforeId = firstSymbolLayerId(map)
    if (!map.getLayer(BUA_FILL_LAYER)) {
      map.addLayer(
        {
          id: BUA_FILL_LAYER,
          type: 'fill',
          source: BUA_SOURCE_ID,
          'source-layer': BUA_SOURCE_LAYER,
          paint: {
            'fill-color': [
              'step',
              ['coalesce', ['get', 'pop_final'], ['get', 'pop']],
              '#eff6ff',
              1000, '#dbeafe',
              5000, '#bfdbfe',
              10000, '#93c5fd',
              50000, '#60a5fa',
              100000, '#3b82f6',
              500000, '#2563eb',
              1000000, '#1d4ed8',
            ],
            'fill-opacity': 0.55,
          },
        },
        beforeId
      )
    }
    if (!map.getLayer(BUA_OUTLINE_LAYER)) {
      map.addLayer(
        {
          id: BUA_OUTLINE_LAYER,
          type: 'line',
          source: BUA_SOURCE_ID,
          'source-layer': BUA_SOURCE_LAYER,
          paint: { 'line-color': '#1e293b', 'line-width': 0.5 },
        },
        beforeId
      )
    }
    if (!map.getLayer(BUA_SELECTED_LAYER)) {
      map.addLayer(
        {
          id: BUA_SELECTED_LAYER,
          type: 'line',
          source: BUA_SOURCE_ID,
          'source-layer': BUA_SOURCE_LAYER,
          paint: { 'line-color': '#7033FF', 'line-width': 2.5 },
          filter: ['==', ['get', 'gsscode'], '__none__'],
        },
        beforeId
      )
    }

    if (!map.getSource(RADIUS_SOURCE)) {
      map.addSource(RADIUS_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
    }
    if (!map.getLayer(RADIUS_FILL_LAYER)) {
      map.addLayer({
        id: RADIUS_FILL_LAYER,
        type: 'fill',
        source: RADIUS_SOURCE,
        paint: { 'fill-color': '#7033FF', 'fill-opacity': 0.08 },
      })
    }
    if (!map.getLayer(RADIUS_LINE_LAYER)) {
      map.addLayer({
        id: RADIUS_LINE_LAYER,
        type: 'line',
        source: RADIUS_SOURCE,
        paint: { 'line-color': '#7033FF', 'line-width': 1.5, 'line-dasharray': [2, 2] },
      })
    }
    if (!map.getSource(STORES_SOURCE)) {
      map.addSource(STORES_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
    }
    if (!map.getLayer(STORES_LAYER)) {
      map.addLayer({
        id: STORES_LAYER,
        type: 'circle',
        source: STORES_SOURCE,
        paint: {
          'circle-radius': 5,
          'circle-color': '#2A6FDB',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1.5,
        },
      })
    }

    // LSOA catchment cells (Catchment tab).
    if (!map.getSource(LSOA_SOURCE_ID)) {
      map.addSource(LSOA_SOURCE_ID, {
        type: 'vector',
        url: `mapbox://${LSOA_TILESET_ID}`,
      })
    }
    if (!map.getLayer(LSOA_FILL_DESELECTED)) {
      map.addLayer(
        {
          id: LSOA_FILL_DESELECTED,
          type: 'fill',
          source: LSOA_SOURCE_ID,
          'source-layer': LSOA_SOURCE_LAYER,
          filter: ['in', ['get', LSOA_CODE_PROP], ['literal', []]],
          paint: { 'fill-color': '#64748b', 'fill-opacity': 0.15 },
        },
        beforeId
      )
    }
    if (!map.getLayer(LSOA_FILL_SELECTED)) {
      map.addLayer(
        {
          id: LSOA_FILL_SELECTED,
          type: 'fill',
          source: LSOA_SOURCE_ID,
          'source-layer': LSOA_SOURCE_LAYER,
          filter: ['in', ['get', LSOA_CODE_PROP], ['literal', []]],
          paint: { 'fill-color': '#7033FF', 'fill-opacity': 0.3 },
        },
        beforeId
      )
    }
    if (!map.getLayer(LSOA_OUTLINE_DESELECTED)) {
      map.addLayer(
        {
          id: LSOA_OUTLINE_DESELECTED,
          type: 'line',
          source: LSOA_SOURCE_ID,
          'source-layer': LSOA_SOURCE_LAYER,
          filter: ['in', ['get', LSOA_CODE_PROP], ['literal', []]],
          paint: { 'line-color': '#ffffff', 'line-width': 1 },
        },
        beforeId
      )
    }
    if (!map.getLayer(LSOA_OUTLINE_SELECTED)) {
      map.addLayer(
        {
          id: LSOA_OUTLINE_SELECTED,
          type: 'line',
          source: LSOA_SOURCE_ID,
          'source-layer': LSOA_SOURCE_LAYER,
          filter: ['in', ['get', LSOA_CODE_PROP], ['literal', []]],
          paint: { 'line-color': '#ffffff', 'line-width': 2 },
        },
        beforeId
      )
    }

    if (!map.getSource(CATCH_SOURCE)) {
      map.addSource(CATCH_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
    }
    if (!map.getLayer(CATCH_LINE_LAYER)) {
      map.addLayer({
        id: CATCH_LINE_LAYER,
        type: 'line',
        source: CATCH_SOURCE,
        paint: { 'line-color': '#7033FF', 'line-width': 2, 'line-dasharray': [2, 2] },
      })
    }

    applyBuaFilter(map)
    applyLsoaFilters(map)
    applyCatchmentBoundary(map)
    applyVisibility(map)
    applyMapCursor(map)
    readyRef.current = true

    // Hydrate dynamic state in case it changed before the style finished loading.
    const st = useWorkspaceStore.getState()
    if (map.getLayer(BUA_SELECTED_LAYER)) {
      map.setFilter(BUA_SELECTED_LAYER, [
        '==',
        ['get', 'gsscode'],
        st.area?.kind === 'bua' ? st.area.id : '__none__',
      ] as any)
    }
    const src = map.getSource(RADIUS_SOURCE) as mapboxgl.GeoJSONSource | undefined
    if (st.assessPoint) {
      src?.setData({
        type: 'FeatureCollection',
        features: [circlePolygon(st.assessPoint.lng, st.assessPoint.lat, st.radiusKm)],
      })
    }
  }

  const applyBuaFilter = (map: mapboxgl.Map) => {
    if (!map.getLayer(BUA_FILL_LAYER)) return
    const f = buaFilter(gapGssCodes, populationRange) as any
    map.setFilter(BUA_FILL_LAYER, f)
    map.setFilter(BUA_OUTLINE_LAYER, f)
  }

  const applyLsoaFilters = (map: mapboxgl.Map) => {
    if (!map.getLayer(LSOA_FILL_SELECTED)) return
    const all = lsoa?.allCodes ?? []
    const selected = lsoa?.selectedCodes ?? new Set<string>()
    const selectedArr = Array.from(selected)
    const deselectedArr = all.filter((c) => !selected.has(c))
    const selFilter = ['in', ['get', LSOA_CODE_PROP], ['literal', selectedArr]] as any
    const deselFilter = ['in', ['get', LSOA_CODE_PROP], ['literal', deselectedArr]] as any
    map.setFilter(LSOA_FILL_SELECTED, selFilter)
    map.setFilter(LSOA_OUTLINE_SELECTED, selFilter)
    map.setFilter(LSOA_FILL_DESELECTED, deselFilter)
    map.setFilter(LSOA_OUTLINE_DESELECTED, deselFilter)
  }

  const applyCatchmentBoundary = (map: mapboxgl.Map) => {
    const src = map.getSource(CATCH_SOURCE) as mapboxgl.GeoJSONSource | undefined
    if (!src) return
    const geom = lsoa?.boundaryGeometry
    src.setData(
      geom
        ? { type: 'Feature', geometry: geom, properties: {} }
        : { type: 'FeatureCollection', features: [] }
    )
  }

  const applyVisibility = (map: mapboxgl.Map) => {
    const catchmentActive = tab === 'catchment'
    const buaVisible = view === 'find'
    for (const id of [BUA_FILL_LAYER, BUA_OUTLINE_LAYER, BUA_SELECTED_LAYER]) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', buaVisible ? 'visible' : 'none')
      }
    }
    // Assess radius/store dots hide while the Catchment tab owns the local view.
    const assessVisible = view === 'assess' && !catchmentActive
    for (const id of [RADIUS_FILL_LAYER, RADIUS_LINE_LAYER, STORES_LAYER]) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', assessVisible ? 'visible' : 'none')
      }
    }
    const lsoaVisible = catchmentActive && showLsoa
    for (const id of [
      LSOA_FILL_DESELECTED,
      LSOA_FILL_SELECTED,
      LSOA_OUTLINE_DESELECTED,
      LSOA_OUTLINE_SELECTED,
    ]) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', lsoaVisible ? 'visible' : 'none')
      }
    }
    if (map.getLayer(CATCH_LINE_LAYER)) {
      map.setLayoutProperty(
        CATCH_LINE_LAYER,
        'visibility',
        catchmentActive ? 'visible' : 'none'
      )
    }
  }

  // Initialize the single shared map instance once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    if (!MAPBOX_TOKEN) {
      console.error('Mapbox token not found. Set NEXT_PUBLIC_MAPBOX_TOKEN.')
      return
    }
    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: containerRef.current,
      // Discovery base style. The SketchLayer takes over the style in sketch mode.
      style: MAP_STYLES.hybrid,
      center: NATIONAL_VIEWPORT.center,
      zoom: NATIONAL_VIEWPORT.zoom,
      antialias: true,
    })
    mapRef.current = map
    onMap?.(map)

    const onLoad = () => addLayers(map)
    map.on('load', onLoad)
    // Re-add custom layers after a base-style swap (sketch <-> discovery).
    map.on('style.load', onLoad)

    // Click BUA → select it; click empty map in Assess → drop a pin.
    // The Catchment tab owns clicks (LSOA toggle) via its own layer handlers.
    map.on('click', (e) => {
      const st = useWorkspaceStore.getState()
      if (st.tab === 'catchment') return
      if (st.view === 'find') {
        const feats = map.queryRenderedFeatures(e.point, { layers: [BUA_FILL_LAYER] })
        const f = feats[0]
        if (f?.properties?.gsscode) {
          selectArea({
            id: f.properties.gsscode,
            name: f.properties.name ?? 'Selected area',
            center: [e.lngLat.lng, e.lngLat.lat],
            population: f.properties.pop_final ?? f.properties.pop,
            kind: 'bua',
          })
        }
        return
      }
      if (st.view === 'assess') {
        setAssessPoint({ lat: e.lngLat.lat, lng: e.lngLat.lng })
      }
    })

    map.on('mouseenter', BUA_FILL_LAYER, () => {
      if (useWorkspaceStore.getState().view === 'find') {
        map.getCanvas().style.cursor = 'pointer'
      }
    })
    map.on('mouseleave', BUA_FILL_LAYER, () => {
      applyMapCursor(map)
    })

    // LSOA cell click → toggle it in/out of the catchment selection.
    const lsoaClick = (
      e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }
    ) => {
      if (useWorkspaceStore.getState().tab !== 'catchment') return
      const code = e.features?.[0]?.properties?.[LSOA_CODE_PROP]
      if (code) lsoaToggleRef.current?.(code)
    }
    for (const id of [LSOA_FILL_SELECTED, LSOA_FILL_DESELECTED]) {
      map.on('click', id, lsoaClick)
      map.on('mouseenter', id, () => {
        if (useWorkspaceStore.getState().tab === 'catchment') {
          map.getCanvas().style.cursor = 'pointer'
        }
      })
      map.on('mouseleave', id, () => applyMapCursor(map))
    }

    // Keep the map sized to its container as side panels open/close.
    const resizeObserver = new ResizeObserver(() => map.resize())
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      onMap?.(null)
      map.remove()
      mapRef.current = null
      readyRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // React to mode changes, handing the base style off to (and reclaiming it
  // from) the SketchLayer at the sketch boundary.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const prev = prevViewRef.current
    prevViewRef.current = view

    // Entering sketch: the SketchLayer owns the style now. Hide discovery
    // overlays so they don't show beneath the sketch.
    if (view === 'sketch') {
      if (readyRef.current) applyVisibility(map)
      applyMapCursor(map)
      return
    }

    // Leaving sketch: force the discovery base style back. The sketch shares the
    // 'hybrid' base, so a default (diffed) setStyle would strip the layers the
    // sketch overlaid *without* firing 'style.load' — leaving our discovery
    // layers gone and readyRef stuck false (radius circle/pin never redraw).
    // diff:false forces a full reload; cast because mapbox-gl v3's internal
    // SetStyleOptions marks the font-family fields as required.
    // Assess/Find are 2D-only, so flatten the map in case the sketch left it
    // pitched/rotated in 3D (setStyle alone preserves camera pitch & bearing).
    if (prev === 'sketch') {
      readyRef.current = false
      map.setStyle(MAP_STYLES.hybrid, { diff: false } as any)
      map.easeTo({ pitch: 0, bearing: 0, duration: 400 })
      // Re-add the discovery layers once the reloaded style settles. 'idle'
      // fires reliably for both full and diffed swaps (unlike 'style.load'),
      // and addLayers is idempotent — this restores readyRef + the radius/BUA
      // sources so the next map click redraws them.
      map.once('idle', () => {
        addLayers(map)
        applyVisibility(map)
        applyMapCursor(map)
      })
      applyMapCursor(map)
      return
    }

    // Discovery mode change (assess <-> find): just re-evaluate visibility.
    if (readyRef.current) {
      applyVisibility(map)
      applyMapCursor(map)
    }
  }, [view])

  // Re-apply the BUA filter when rules/population change.
  useEffect(() => {
    const map = mapRef.current
    if (map && readyRef.current) applyBuaFilter(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gapGssCodes, populationRange])

  // Re-evaluate layer visibility when the tab or LSOA overlay toggle changes.
  useEffect(() => {
    const map = mapRef.current
    if (map && readyRef.current) {
      applyVisibility(map)
      applyMapCursor(map)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, showLsoa])

  // Repaint LSOA selected/deselected cells as the catchment selection changes.
  useEffect(() => {
    const map = mapRef.current
    if (map && readyRef.current) applyLsoaFilters(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lsoa?.allCodes, lsoa?.selectedCodes])

  // Redraw the catchment outline (isochrone or radius circle).
  useEffect(() => {
    const map = mapRef.current
    if (map && readyRef.current) applyCatchmentBoundary(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lsoa?.boundaryGeometry])

  // Highlight the selected BUA + fly to it.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    if (map.getLayer(BUA_SELECTED_LAYER)) {
      map.setFilter(BUA_SELECTED_LAYER, [
        '==',
        ['get', 'gsscode'],
        area?.kind === 'bua' ? area.id : '__none__',
      ] as any)
    }
    if (area) {
      map.flyTo({ center: area.center, zoom: 10.5, duration: 900 })
    }
  }, [area])

  // Draw the Assess radius circle + fly to the dropped pin + place a DOM marker.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    const src = map.getSource(RADIUS_SOURCE) as mapboxgl.GeoJSONSource | undefined
    if (assessPoint) {
      const circle = circlePolygon(assessPoint.lng, assessPoint.lat, radiusKm)
      src?.setData({ type: 'FeatureCollection', features: [circle] })
      if (!pinRef.current) {
        pinRef.current = new mapboxgl.Marker({ color: '#7033FF' })
      }
      pinRef.current.setLngLat([assessPoint.lng, assessPoint.lat]).addTo(map)
      map.flyTo({ center: [assessPoint.lng, assessPoint.lat], zoom: 11, duration: 900 })
    } else {
      src?.setData({ type: 'FeatureCollection', features: [] })
      pinRef.current?.remove()
      pinRef.current = null
    }
  }, [assessPoint, radiusKm])

  // Feed nearby store dots into the Assess store layer.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    const src = map.getSource(STORES_SOURCE) as mapboxgl.GeoJSONSource | undefined
    src?.setData({
      type: 'FeatureCollection',
      features: storeDots.map((s) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
        properties: { id: s.id },
      })),
    })
  }, [storeDots])

  return <div ref={containerRef} className="absolute inset-0 h-full w-full" />
}
