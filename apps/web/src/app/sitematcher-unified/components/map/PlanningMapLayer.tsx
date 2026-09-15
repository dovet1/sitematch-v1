'use client'

import { useEffect, useRef } from 'react'
import type mapboxgl from 'mapbox-gl'
import type { MonitorCluster } from '@/lib/planning-monitor/types'
import type { PatchGeometry } from '@/lib/planning-monitor/geometry'
import { usePlanningMonitorStore } from '../../lib/stores/planning-monitor-store'
import type { NearbyStore } from '../../lib/services/gaps-service'

/**
 * Planning mode's map: patch outline, server clusters and single records, the selected record's
 * ring, and the chosen estate's stores. It owns only its own sources and layers, re-adds them after
 * every style load, and removes nothing belonging to other modes. Clicks are handled here, so the
 * shared map's click handler has nothing to do in Planning.
 */

export const PLANNING_COLORS = {
  residential: '#8B6CFF',
  commercial: '#34D399',
  mixed: '#C4B5FD',
  estate: '#0EAE73',
  patch: '#9E82FF',
}

const SRC_PATCH = 'pm-patch'
const SRC_POINTS = 'pm-points'
const SRC_STORES = 'pm-stores'
const L_PATCH_FILL = 'pm-patch-fill'
const L_PATCH_LINE = 'pm-patch-line'
const L_CLUSTER = 'pm-cluster'
const L_CLUSTER_COUNT = 'pm-cluster-count'
const L_SINGLE = 'pm-single'
const L_SINGLE_APPROX = 'pm-single-approx'
const L_HOVER = 'pm-hover'
const L_SELECTED = 'pm-selected'
const L_STORES = 'pm-stores'
const STORE_IMAGE = 'pm-store-square'
export const PLANNING_LAYER_IDS = [L_PATCH_FILL, L_PATCH_LINE, L_STORES, L_HOVER, L_SELECTED, L_CLUSTER, L_CLUSTER_COUNT, L_SINGLE_APPROX, L_SINGLE]

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

function dominant(cluster: MonitorCluster): 'residential' | 'commercial' | 'mixed' {
  if (cluster.residential > 0 && cluster.commercial > 0) {
    if (cluster.residential >= cluster.commercial * 2) return 'residential'
    if (cluster.commercial >= cluster.residential * 2) return 'commercial'
    return 'mixed'
  }
  return cluster.commercial > 0 ? 'commercial' : 'residential'
}

export function clustersToGeoJSON(clusters: MonitorCluster[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: clusters.map((cluster) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [cluster.lng, cluster.lat] },
      properties: {
        cellKey: cluster.key,
        count: cluster.count,
        label: cluster.count > 999 ? `${Math.round(cluster.count / 100) / 10}k` : String(cluster.count),
        kind: dominant(cluster),
        single: cluster.single ? 1 : 0,
        exact: cluster.single?.exact ? 1 : 0,
        rowKey: cluster.single?.key ?? '',
        applicationId: cluster.single?.applicationId ?? '',
      },
    })),
  }
}

function storeImage(): ImageData {
  const size = 28
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.roundRect(3, 3, 22, 22, 6)
  ctx.fill()
  ctx.fillStyle = PLANNING_COLORS.estate
  ctx.beginPath()
  ctx.roundRect(6, 6, 16, 16, 4)
  ctx.fill()
  return ctx.getImageData(0, 0, size, size)
}

const kindColor: mapboxgl.Expression = ['match', ['get', 'kind'], 'commercial', PLANNING_COLORS.commercial, 'mixed', PLANNING_COLORS.mixed, PLANNING_COLORS.residential]

/**
 * False once the shared map has been removed. UnifiedMap removes it when the workspace unmounts,
 * which can happen before this layer's own cleanup and effects run; after that the canvas and
 * style are gone and any map call throws.
 */
export function mapAlive(map: mapboxgl.Map): boolean {
  return Boolean(map.getCanvas?.()) && !(map as unknown as { _removed?: boolean })._removed
}

function ensureLayers(map: mapboxgl.Map) {
  if (!mapAlive(map) || !map.isStyleLoaded()) return false
  if (!map.hasImage(STORE_IMAGE)) map.addImage(STORE_IMAGE, storeImage(), { pixelRatio: 2 })
  for (const id of [SRC_PATCH, SRC_POINTS, SRC_STORES]) {
    if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: EMPTY })
  }
  if (!map.getLayer(L_PATCH_FILL)) {
    map.addLayer({ id: L_PATCH_FILL, type: 'fill', source: SRC_PATCH, paint: { 'fill-color': 'rgba(139,108,255,0.13)' } })
  }
  if (!map.getLayer(L_PATCH_LINE)) {
    map.addLayer({ id: L_PATCH_LINE, type: 'line', source: SRC_PATCH, paint: { 'line-color': PLANNING_COLORS.patch, 'line-width': 2, 'line-dasharray': [2, 1.5] } })
  }
  if (!map.getLayer(L_STORES)) {
    map.addLayer({
      id: L_STORES, type: 'symbol', source: SRC_STORES,
      layout: { 'icon-image': STORE_IMAGE, 'icon-size': 1, 'icon-allow-overlap': true },
    })
  }
  if (!map.getLayer(L_HOVER)) {
    map.addLayer({
      id: L_HOVER, type: 'circle', source: SRC_POINTS, filter: ['==', ['get', 'rowKey'], '__none__'],
      paint: { 'circle-radius': 16, 'circle-color': 'rgba(255,255,255,0.12)', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 },
    })
  }
  if (!map.getLayer(L_SELECTED)) {
    map.addLayer({
      id: L_SELECTED, type: 'circle', source: SRC_POINTS, filter: ['==', ['get', 'rowKey'], '__none__'],
      paint: { 'circle-radius': 17, 'circle-color': 'rgba(108,71,255,0.25)', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 },
    })
  }
  if (!map.getLayer(L_CLUSTER)) {
    map.addLayer({
      id: L_CLUSTER, type: 'circle', source: SRC_POINTS, filter: ['==', ['get', 'single'], 0],
      paint: {
        'circle-radius': ['step', ['get', 'count'], 16, 10, 19, 50, 22, 250, 26, 1000, 30],
        'circle-color': kindColor,
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 3,
      },
    })
  }
  if (!map.getLayer(L_CLUSTER_COUNT)) {
    map.addLayer({
      id: L_CLUSTER_COUNT, type: 'symbol', source: SRC_POINTS, filter: ['==', ['get', 'single'], 0],
      layout: { 'text-field': ['get', 'label'], 'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'], 'text-size': 12, 'text-allow-overlap': true, 'text-ignore-placement': true },
      paint: { 'text-color': '#14121A' },
    })
  }
  // Approximate positions are hollow rings: a different shape, not just a different colour.
  if (!map.getLayer(L_SINGLE_APPROX)) {
    map.addLayer({
      id: L_SINGLE_APPROX, type: 'circle', source: SRC_POINTS, filter: ['all', ['==', ['get', 'single'], 1], ['==', ['get', 'exact'], 0]],
      paint: { 'circle-radius': 8, 'circle-color': 'rgba(14,21,34,0.6)', 'circle-stroke-color': kindColor, 'circle-stroke-width': 3 },
    })
  }
  if (!map.getLayer(L_SINGLE)) {
    map.addLayer({
      id: L_SINGLE, type: 'circle', source: SRC_POINTS, filter: ['all', ['==', ['get', 'single'], 1], ['==', ['get', 'exact'], 1]],
      paint: { 'circle-radius': 8, 'circle-color': kindColor, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 },
    })
  }
  return true
}

export function PlanningMapLayer({
  map,
  clusters,
  patchGeometry,
  stores,
  onPickSingle,
}: {
  map: mapboxgl.Map
  clusters: MonitorCluster[]
  patchGeometry: PatchGeometry | null
  stores: NearbyStore[]
  onPickSingle: (pick: { applicationId: string; rowKey: string; lngLat: [number, number] }) => void
}) {
  const setViewport = usePlanningMonitorStore((s) => s.setViewport)
  const selectedKey = usePlanningMonitorStore((s) => s.selected?.key ?? null)
  const hoveredKey = usePlanningMonitorStore((s) => s.hoveredKey)
  const setHoveredKey = usePlanningMonitorStore((s) => s.setHoveredKey)
  const select = usePlanningMonitorStore((s) => s.select)

  const latest = useRef({ clusters, patchGeometry, stores, selectedKey, hoveredKey, onPickSingle })
  latest.current = { clusters, patchGeometry, stores, selectedKey, hoveredKey, onPickSingle }

  // Sources, layers, viewport tracking and clicks: registered once per map.
  useEffect(() => {
    const sync = () => {
      if (!ensureLayers(map)) return
      const { clusters: c, patchGeometry: g, stores: st, selectedKey: sel, hoveredKey: hov } = latest.current
      ;(map.getSource(SRC_POINTS) as mapboxgl.GeoJSONSource).setData(clustersToGeoJSON(c))
      ;(map.getSource(SRC_PATCH) as mapboxgl.GeoJSONSource).setData(g ? { type: 'Feature', geometry: g, properties: {} } : EMPTY)
      ;(map.getSource(SRC_STORES) as mapboxgl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: st.map((s) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lon, s.lat] }, properties: { id: s.id } })),
      })
      map.setFilter(L_SELECTED, ['==', ['get', 'rowKey'], sel ?? '__none__'])
      map.setFilter(L_HOVER, ['==', ['get', 'rowKey'], hov ?? '__none__'])
    }
    const reportViewport = () => {
      if (!mapAlive(map)) return
      const b = map.getBounds()
      if (!b) return
      setViewport({ bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], zoom: map.getZoom() })
    }
    const onStyle = () => sync()
    // 'idle' only restores layers a style swap removed. Re-sending data on every idle would
    // re-render the map and fire idle again, forever.
    const onIdle = () => {
      if (!map.getSource(SRC_POINTS)) sync()
    }
    const onClick = (e: mapboxgl.MapMouseEvent) => {
      const layers = [L_SINGLE, L_SINGLE_APPROX, L_CLUSTER].filter((id) => map.getLayer(id))
      const hit = layers.length ? map.queryRenderedFeatures(e.point, { layers })[0] : undefined
      if (!hit) {
        select(null)
        return
      }
      const props = hit.properties as Record<string, unknown>
      const coords = (hit.geometry as GeoJSON.Point).coordinates as [number, number]
      if (Number(props.single) === 1) {
        latest.current.onPickSingle({ applicationId: String(props.applicationId), rowKey: String(props.rowKey), lngLat: coords })
      } else {
        // A cluster zooms in; it never opens a list of its own.
        map.easeTo({ center: coords, zoom: Math.min(map.getZoom() + 2.5, 18), duration: 500 })
      }
    }
    const onMove = (e: mapboxgl.MapMouseEvent) => {
      const layers = [L_SINGLE, L_SINGLE_APPROX, L_CLUSTER].filter((id) => map.getLayer(id))
      const hit = layers.length ? map.queryRenderedFeatures(e.point, { layers })[0] : undefined
      map.getCanvas().style.cursor = hit ? 'pointer' : ''
      const key = hit && Number(hit.properties?.single) === 1 ? String(hit.properties?.rowKey) : null
      if (key !== latest.current.hoveredKey) setHoveredKey(key)
    }

    sync()
    reportViewport()
    map.on('style.load', onStyle)
    map.on('idle', onIdle)
    map.on('moveend', reportViewport)
    map.on('click', onClick)
    map.on('mousemove', onMove)
    return () => {
      map.off('style.load', onStyle)
      map.off('idle', onIdle)
      map.off('moveend', reportViewport)
      map.off('click', onClick)
      map.off('mousemove', onMove)
      if (!mapAlive(map)) return
      map.getCanvas().style.cursor = ''
      // Leave nothing behind for the next mode. The style swap on leaving Planning clears these
      // too; removing them here covers a mode change that does not swap style.
      if (map.isStyleLoaded()) {
        for (const id of PLANNING_LAYER_IDS) if (map.getLayer(id)) map.removeLayer(id)
        for (const id of [SRC_PATCH, SRC_POINTS, SRC_STORES]) if (map.getSource(id)) map.removeSource(id)
      }
    }
  }, [map, setViewport, setHoveredKey, select])

  // Data and highlight updates.
  useEffect(() => {
    if (!ensureLayers(map)) return
    ;(map.getSource(SRC_POINTS) as mapboxgl.GeoJSONSource).setData(clustersToGeoJSON(clusters))
  }, [map, clusters])
  useEffect(() => {
    if (!ensureLayers(map)) return
    ;(map.getSource(SRC_PATCH) as mapboxgl.GeoJSONSource).setData(patchGeometry ? { type: 'Feature', geometry: patchGeometry, properties: {} } : EMPTY)
  }, [map, patchGeometry])
  useEffect(() => {
    if (!ensureLayers(map)) return
    ;(map.getSource(SRC_STORES) as mapboxgl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: stores.map((s) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lon, s.lat] }, properties: { id: s.id } })),
    })
  }, [map, stores])
  useEffect(() => {
    if (!ensureLayers(map)) return
    map.setFilter(L_SELECTED, ['==', ['get', 'rowKey'], selectedKey ?? '__none__'])
    map.setFilter(L_HOVER, ['==', ['get', 'rowKey'], hoveredKey ?? '__none__'])
  }, [map, selectedKey, hoveredKey])

  return null
}
