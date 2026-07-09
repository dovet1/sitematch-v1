'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MAP_STYLES, MAPBOX_TOKEN } from '@/lib/sitesketcher-v2/constants'
import {
  useWorkspaceStore,
  selectMapStyleKey,
} from '../../lib/stores/unified-workspace-store'
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

export function UnifiedMap({ storeDots = [] }: { storeDots?: NearbyStore[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const styleKeyRef = useRef<'satellite' | 'hybrid'>(selectMapStyleKey('assess'))
  const pinRef = useRef<mapboxgl.Marker | null>(null)
  const readyRef = useRef(false)

  const view = useWorkspaceStore((s) => s.view)
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

    applyBuaFilter(map)
    applyVisibility(map)
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

  const applyVisibility = (map: mapboxgl.Map) => {
    const buaVisible = view === 'find'
    for (const id of [BUA_FILL_LAYER, BUA_OUTLINE_LAYER, BUA_SELECTED_LAYER]) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', buaVisible ? 'visible' : 'none')
      }
    }
    const assessVisible = view === 'assess'
    for (const id of [RADIUS_FILL_LAYER, RADIUS_LINE_LAYER, STORES_LAYER]) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', assessVisible ? 'visible' : 'none')
      }
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
      style: MAP_STYLES[selectMapStyleKey(view)],
      center: NATIONAL_VIEWPORT.center,
      zoom: NATIONAL_VIEWPORT.zoom,
      antialias: true,
    })
    mapRef.current = map

    const onLoad = () => addLayers(map)
    map.on('load', onLoad)
    // Re-add custom layers after a base-style swap (sketch <-> discovery).
    map.on('style.load', onLoad)

    // Click BUA → select it; click empty map in Assess → drop a pin.
    map.on('click', (e) => {
      if (useWorkspaceStore.getState().view === 'find') {
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
      if (useWorkspaceStore.getState().view === 'assess') {
        setAssessPoint({ lat: e.lngLat.lat, lng: e.lngLat.lng })
      }
    })

    map.on('mouseenter', BUA_FILL_LAYER, () => {
      if (useWorkspaceStore.getState().view === 'find') {
        map.getCanvas().style.cursor = 'pointer'
      }
    })
    map.on('mouseleave', BUA_FILL_LAYER, () => {
      map.getCanvas().style.cursor = ''
    })

    return () => {
      map.remove()
      mapRef.current = null
      readyRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Swap base style when the mode's required style changes (sketch only for now).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const nextKey = selectMapStyleKey(view)
    if (nextKey !== styleKeyRef.current) {
      styleKeyRef.current = nextKey
      readyRef.current = false
      map.setStyle(MAP_STYLES[nextKey])
      return
    }
    if (readyRef.current) applyVisibility(map)
  }, [view])

  // Re-apply the BUA filter when rules/population change.
  useEffect(() => {
    const map = mapRef.current
    if (map && readyRef.current) applyBuaFilter(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gapGssCodes, populationRange])

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
