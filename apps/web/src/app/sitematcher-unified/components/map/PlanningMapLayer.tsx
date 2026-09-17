'use client'

import { useEffect, useRef } from 'react'
import type mapboxgl from 'mapbox-gl'
import type { DigestHighlight, MonitorCluster } from '@/lib/planning-monitor/types'
import type { PatchGeometry } from '@/lib/planning-monitor/geometry'
import { usePlanningMonitorStore, type StackPick } from '../../lib/stores/planning-monitor-store'
import { MAX_CLUSTER_ZOOM, groupByPosition } from '../../lib/planning-monitor-ui'
import type { NearbyStore } from '../../lib/services/gaps-service'
import { circleGeometry } from '../../lib/geo'
import { StorePinCluster } from './StorePinCluster'

/**
 * Planning mode's map: patch outline, server clusters and single developments, NEW badges, the
 * hovered and selected pin, dimmed matches outside the patch, an archived week's points, and the
 * chosen brands' stores with the filter's radius around each. The stores themselves are the shared
 * logo-badge markers from Find gaps (HTML, clustered), not a style layer. Several applications at one point draw as a stacked pin that opens a list. It owns only its own sources and layers, re-adds them after every style
 * load, and removes nothing belonging to other modes. Clicks are handled here, so the shared map's
 * click handler has nothing to do in Planning.
 */

export const PLANNING_COLORS = {
  residential: '#7033FF',
  commercial: '#0F9B8E',
  mixed: '#F26B1F',
  estate: '#0EAE73',
  patch: '#B49CFF',
}

const SRC_PATCH = 'pm-patch'
const SRC_POINTS = 'pm-points'
const SRC_OUTSIDE = 'pm-outside'
const SRC_STORE_RADII = 'pm-store-radii'
const L_PATCH_LINE = 'pm-patch-line'
const L_OUTSIDE = 'pm-outside'
const L_OUTSIDE_COUNT = 'pm-outside-count'
const L_CLUSTER = 'pm-cluster'
const L_STACK_BACK = 'pm-stack-back'
const L_STACK_MID = 'pm-stack-mid'
const L_CLUSTER_COUNT = 'pm-cluster-count'
const L_HALO = 'pm-halo'
const L_SINGLE = 'pm-single'
const L_SINGLE_APPROX = 'pm-single-approx'
const L_FOCUS = 'pm-focus'
const L_NEW = 'pm-new'
const L_STORE_RADII_FILL = 'pm-store-radii-fill'
const L_STORE_RADII_LINE = 'pm-store-radii-line'
const NEW_IMAGES = { residential: 'pm-new-residential', commercial: 'pm-new-commercial', mixed: 'pm-new-mixed' } as const
const SOURCES = [SRC_PATCH, SRC_POINTS, SRC_OUTSIDE, SRC_STORE_RADII]
export const PLANNING_LAYER_IDS = [
  L_STORE_RADII_FILL, L_STORE_RADII_LINE, L_PATCH_LINE, L_OUTSIDE, L_OUTSIDE_COUNT, L_HALO, L_STACK_BACK, L_STACK_MID, L_CLUSTER, L_CLUSTER_COUNT, L_SINGLE_APPROX, L_SINGLE, L_FOCUS, L_NEW,
]
const PICKABLE = [L_NEW, L_FOCUS, L_SINGLE, L_SINGLE_APPROX, L_CLUSTER]

/** Cell keys of an archived week's stacked pins; the rest is the position key. */
const STACK_PREFIX = 'hs:'
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }
const NONE = '__none__'

function dominant(cluster: MonitorCluster): 'residential' | 'commercial' | 'mixed' {
  if (cluster.single) {
    if (cluster.residential > 0 && cluster.commercial > 0) return 'mixed'
    return cluster.commercial > 0 ? 'commercial' : 'residential'
  }
  // Clusters are violet unless commercial clearly leads.
  return cluster.commercial > cluster.residential ? 'commercial' : 'residential'
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
        stacked: cluster.colocated ? 1 : 0,
        exact: cluster.single?.exact ? 1 : 0,
        rowKey: cluster.single?.key ?? '',
        applicationId: cluster.single?.applicationId ?? '',
      },
    })),
  }
}

const highlightKind = (h: DigestHighlight) => (h.isResidential && h.isCommercial ? 'mixed' : h.isCommercial ? 'commercial' : 'residential')

/** An archived week's developments: single pins, or a stacked pin where several share a point. */
export function highlightsToGeoJSON(points: DigestHighlight[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: groupByPosition(points).map((group): GeoJSON.Feature => {
      const geometry: GeoJSON.Point = { type: 'Point', coordinates: [group.lng, group.lat] }
      if (group.points.length > 1) {
        const commercial = group.points.filter((h) => h.isCommercial).length
        return {
          type: 'Feature',
          geometry,
          properties: {
            cellKey: `${STACK_PREFIX}${group.key}`,
            count: group.points.length,
            label: String(group.points.length),
            kind: commercial > group.points.length - commercial ? 'commercial' : 'residential',
            single: 0,
            stacked: 1,
            exact: 0,
            rowKey: '',
            applicationId: '',
          },
        }
      }
      const h = group.points[0]
      return {
        type: 'Feature',
        geometry,
        properties: {
          cellKey: `h:${h.applicationId}`,
          count: 1,
          label: '1',
          kind: highlightKind(h),
          single: 1,
          stacked: 0,
          exact: h.approximateLocation ? 0 : 1,
          // The same key the developments list uses, so hover and selection line up.
          rowKey: h.developmentId ?? `app:${h.applicationId}`,
          applicationId: h.applicationId,
        },
      }
    }),
  }
}

/** The mono "NEW" badge drawn above a pin, in its use colour. Rendered at 2x. */
function newBadgeImage(color: string): ImageData {
  const w = 64
  const h = 30
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.roundRect(2, 2, w - 4, h - 4, 10)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,.9)'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.font = '600 17px "JetBrains Mono", ui-monospace, Menlo, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('NEW', w / 2, h / 2 + 1)
  return ctx.getImageData(0, 0, w, h)
}

const kindColor: mapboxgl.Expression = ['match', ['get', 'kind'], 'commercial', PLANNING_COLORS.commercial, 'mixed', PLANNING_COLORS.mixed, PLANNING_COLORS.residential]
const kindHalo: mapboxgl.Expression = ['match', ['get', 'kind'], 'commercial', 'rgba(15,155,142,0.3)', 'mixed', 'rgba(242,107,31,0.3)', 'rgba(112,51,255,0.3)']

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
  for (const kind of ['residential', 'commercial', 'mixed'] as const) {
    if (!map.hasImage(NEW_IMAGES[kind])) map.addImage(NEW_IMAGES[kind], newBadgeImage(PLANNING_COLORS[kind]), { pixelRatio: 2 })
  }
  for (const id of SOURCES) {
    if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: EMPTY })
  }
  const add = (layer: mapboxgl.AnyLayer) => {
    if (!map.getLayer(layer.id)) map.addLayer(layer)
  }
  // Radius rings sit beneath everything else. Overlapping fills deepen, which reads as coverage.
  add({ id: L_STORE_RADII_FILL, type: 'fill', source: SRC_STORE_RADII, paint: { 'fill-color': PLANNING_COLORS.estate, 'fill-opacity': 0.06 } })
  add({
    id: L_STORE_RADII_LINE, type: 'line', source: SRC_STORE_RADII,
    paint: { 'line-color': PLANNING_COLORS.estate, 'line-width': 1.5, 'line-opacity': 0.7, 'line-dasharray': [2, 2] },
  })
  add({ id: L_PATCH_LINE, type: 'line', source: SRC_PATCH, paint: { 'line-color': PLANNING_COLORS.patch, 'line-width': 3 } })
  // Matches outside the patch: white and dimmed, so an edge case is still visible.
  add({
    id: L_OUTSIDE, type: 'circle', source: SRC_OUTSIDE,
    paint: {
      'circle-radius': ['case', ['==', ['get', 'single'], 1], 6, ['step', ['get', 'count'], 13, 10, 15, 50, 17, 250, 19]],
      'circle-color': 'rgba(255,255,255,0.55)',
      'circle-stroke-color': 'rgba(255,255,255,0.85)',
      'circle-stroke-width': 1.5,
    },
  })
  add({
    id: L_OUTSIDE_COUNT, type: 'symbol', source: SRC_OUTSIDE, filter: ['==', ['get', 'single'], 0],
    layout: { 'text-field': ['get', 'label'], 'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'], 'text-size': 11, 'text-allow-overlap': true, 'text-ignore-placement': true },
    paint: { 'text-color': 'rgba(23,20,25,0.7)' },
  })
  add({
    id: L_HALO, type: 'circle', source: SRC_POINTS, filter: ['==', ['get', 'rowKey'], NONE],
    paint: { 'circle-radius': 21, 'circle-color': kindHalo },
  })
  // A stacked pin: two offset discs behind the count, like a pile of cards.
  const stacked: mapboxgl.Expression = ['all', ['==', ['get', 'single'], 0], ['==', ['get', 'stacked'], 1]]
  add({
    id: L_STACK_BACK, type: 'circle', source: SRC_POINTS, filter: stacked,
    paint: { 'circle-radius': 16, 'circle-color': kindColor, 'circle-opacity': 0.45, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2, 'circle-translate': [8, -8] },
  })
  add({
    id: L_STACK_MID, type: 'circle', source: SRC_POINTS, filter: stacked,
    paint: { 'circle-radius': 16, 'circle-color': kindColor, 'circle-opacity': 0.7, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2, 'circle-translate': [4, -4] },
  })
  add({
    id: L_CLUSTER, type: 'circle', source: SRC_POINTS, filter: ['==', ['get', 'single'], 0],
    paint: {
      'circle-radius': ['case', ['==', ['get', 'stacked'], 1], 16, ['step', ['get', 'count'], 19, 10, 21, 50, 23, 250, 25, 1000, 26]],
      'circle-color': kindColor,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 3,
    },
  })
  add({
    id: L_CLUSTER_COUNT, type: 'symbol', source: SRC_POINTS, filter: ['==', ['get', 'single'], 0],
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
      'text-size': ['case', ['==', ['get', 'stacked'], 1], 13, ['step', ['get', 'count'], 14, 100, 15, 1000, 16]],
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: { 'text-color': '#ffffff' },
  })
  // Approximate positions are hollow rings: a different shape, not just a different colour.
  add({
    id: L_SINGLE_APPROX, type: 'circle', source: SRC_POINTS, filter: ['all', ['==', ['get', 'single'], 1], ['==', ['get', 'exact'], 0]],
    paint: { 'circle-radius': 6, 'circle-color': 'rgba(255,255,255,0.35)', 'circle-stroke-color': kindColor, 'circle-stroke-width': 2.5 },
  })
  add({
    id: L_SINGLE, type: 'circle', source: SRC_POINTS, filter: ['all', ['==', ['get', 'single'], 1], ['==', ['get', 'exact'], 1]],
    paint: { 'circle-radius': 7, 'circle-color': kindColor, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2.5 },
  })
  // The hovered or selected pin grows to 26px with a 4px white border.
  add({
    id: L_FOCUS, type: 'circle', source: SRC_POINTS, filter: ['==', ['get', 'rowKey'], NONE],
    paint: { 'circle-radius': 13, 'circle-color': kindColor, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 4 },
  })
  add({
    id: L_NEW, type: 'symbol', source: SRC_POINTS, filter: ['==', ['get', 'rowKey'], NONE],
    layout: {
      'icon-image': ['match', ['get', 'kind'], 'commercial', NEW_IMAGES.commercial, 'mixed', NEW_IMAGES.mixed, NEW_IMAGES.residential],
      'icon-anchor': 'bottom',
      'icon-offset': [0, -11],
      'icon-allow-overlap': true,
    },
  })
  return true
}

interface LayerData {
  clusters: MonitorCluster[]
  outside: MonitorCluster[]
  /** The zoom the clusters were computed at. */
  clusterZoom: number | null
  archived: DigestHighlight[] | null
  patchGeometry: PatchGeometry | null
  stores: NearbyStore[]
  storeRadiusMeters: number | null
  newKeys: string[]
  focusKeys: string[]
  interactive: boolean
}

function apply(map: mapboxgl.Map, data: LayerData) {
  const source = (id: string) => map.getSource(id) as mapboxgl.GeoJSONSource
  source(SRC_POINTS).setData(data.archived ? highlightsToGeoJSON(data.archived) : clustersToGeoJSON(data.clusters))
  source(SRC_OUTSIDE).setData(data.archived ? EMPTY : clustersToGeoJSON(data.outside))
  source(SRC_PATCH).setData(data.patchGeometry ? { type: 'Feature', geometry: data.patchGeometry, properties: {} } : EMPTY)
  source(SRC_STORE_RADII).setData(data.storeRadiusMeters ? {
    type: 'FeatureCollection',
    features: data.stores.map((s) => ({ type: 'Feature', geometry: circleGeometry(s.lon, s.lat, data.storeRadiusMeters! / 1000, 48), properties: { id: s.id } })),
  } : EMPTY)
  applyFilters(map, data)
}

function applyFilters(map: mapboxgl.Map, data: Pick<LayerData, 'newKeys' | 'focusKeys'>) {
  const focus: mapboxgl.Expression = ['all', ['==', ['get', 'single'], 1], ['in', ['get', 'rowKey'], ['literal', data.focusKeys.length ? data.focusKeys : [NONE]]]]
  map.setFilter(L_FOCUS, focus)
  map.setFilter(L_HALO, focus)
  map.setFilter(L_NEW, ['all', ['==', ['get', 'single'], 1], ['in', ['get', 'rowKey'], ['literal', data.newKeys.length ? data.newKeys : [NONE]]]])
}

export function PlanningMapLayer({
  map,
  clusters,
  outside,
  clusterZoom,
  archived,
  patchGeometry,
  stores,
  storeRadiusMeters,
  newKeys,
  interactive,
  onPickSingle,
  onPickStack,
}: {
  map: mapboxgl.Map
  clusters: MonitorCluster[]
  outside: MonitorCluster[]
  clusterZoom: number | null
  /** An archived week's points; replaces the live clusters while set. */
  archived: DigestHighlight[] | null
  patchGeometry: PatchGeometry | null
  stores: NearbyStore[]
  /** Drawn as a ring around each store; null draws none. */
  storeRadiusMeters: number | null
  /** Row keys added in the last 7 days. */
  newKeys: string[]
  /** False while drawing: the draw layer owns clicks. */
  interactive: boolean
  onPickSingle: (pick: { applicationId: string; rowKey: string; lngLat: [number, number] }) => void
  /** A pin holding several applications that zooming cannot separate. */
  onPickStack: (pick: StackPick) => void
}) {
  const setViewport = usePlanningMonitorStore((s) => s.setViewport)
  const selectedKey = usePlanningMonitorStore((s) => s.selected?.key ?? null)
  const hoveredKey = usePlanningMonitorStore((s) => s.hoveredKey)
  const setHovered = usePlanningMonitorStore((s) => s.setHovered)
  const setHoverStack = usePlanningMonitorStore((s) => s.setHoverStack)
  const select = usePlanningMonitorStore((s) => s.select)
  const focusKeys = [selectedKey, hoveredKey].filter(Boolean) as string[]

  const data: LayerData = { clusters, outside, clusterZoom, archived, patchGeometry, stores, storeRadiusMeters, newKeys, focusKeys, interactive }
  const latest = useRef({ data, onPickSingle, onPickStack })
  latest.current = { data, onPickSingle, onPickStack }
  // Set when an update could not be applied because the style was busy (isStyleLoaded is false
  // while tiles load after a move). The next idle applies the latest data instead of dropping it.
  const pending = useRef(false)

  // Sources, layers, viewport tracking and clicks: registered once per map.
  useEffect(() => {
    const sync = () => {
      if (!ensureLayers(map)) {
        pending.current = true
        return
      }
      pending.current = false
      apply(map, latest.current.data)
    }
    const reportViewport = () => {
      if (!mapAlive(map)) return
      const b = map.getBounds()
      if (!b) return
      setViewport({ bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()], zoom: map.getZoom() })
    }
    // 'idle' restores layers a style swap removed and applies an update that arrived while the style
    // was busy. Re-sending data on every idle would re-render the map and fire idle again, forever.
    const onIdle = () => {
      if (pending.current || !map.getSource(SRC_POINTS)) sync()
    }
    const hitAt = (point: mapboxgl.Point) => {
      const layers = PICKABLE.filter((id) => map.getLayer(id))
      return layers.length ? map.queryRenderedFeatures(point, { layers })[0] : undefined
    }
    /** The list behind a group pin, or null when zooming in can still separate it. */
    const stackPick = (props: Record<string, unknown>, coords: [number, number]): StackPick | null => {
      const { archived, clusterZoom } = latest.current.data
      const cellKey = String(props.cellKey)
      const count = Number(props.count)
      if (archived) {
        if (!cellKey.startsWith(STACK_PREFIX)) return null
        const position = cellKey.slice(STACK_PREFIX.length)
        const highlights = groupByPosition(archived).find((g) => g.key === position)?.points ?? []
        return { cellKey, lngLat: coords, count, zoom: null, highlights }
      }
      // A group still together at full zoom is as separate as the map can make it.
      if (Number(props.stacked) !== 1 && map.getZoom() < MAX_CLUSTER_ZOOM - 0.05) return null
      return { cellKey, lngLat: coords, count, zoom: clusterZoom, highlights: null }
    }
    const onClick = (e: mapboxgl.MapMouseEvent) => {
      if (!latest.current.data.interactive) return
      const hit = hitAt(e.point)
      if (!hit) {
        select(null)
        return
      }
      const props = hit.properties as Record<string, unknown>
      const coords = (hit.geometry as GeoJSON.Point).coordinates as [number, number]
      if (Number(props.single) === 1) {
        latest.current.onPickSingle({ applicationId: String(props.applicationId), rowKey: String(props.rowKey), lngLat: coords })
        return
      }
      const pick = stackPick(props, coords)
      if (pick) latest.current.onPickStack(pick)
      else map.easeTo({ center: coords, zoom: Math.min(map.getZoom() + 2.5, MAX_CLUSTER_ZOOM), duration: 500 })
    }
    const onMove = (e: mapboxgl.MapMouseEvent) => {
      if (!latest.current.data.interactive) return
      const hit = hitAt(e.point)
      map.getCanvas().style.cursor = hit ? 'pointer' : ''
      const key = hit && Number(hit.properties?.single) === 1 ? String(hit.properties?.rowKey) : null
      const state = usePlanningMonitorStore.getState()
      if (key !== state.hoveredKey) setHovered(key, 'map')
      const stackKey = hit && Number(hit.properties?.stacked) === 1 ? String(hit.properties?.cellKey) : null
      if (stackKey !== (state.hoverStack?.key ?? null)) {
        setHoverStack(stackKey && hit
          ? { key: stackKey, lngLat: (hit.geometry as GeoJSON.Point).coordinates as [number, number], count: Number(hit.properties?.count) }
          : null)
      }
    }
    const onLeave = () => {
      if (usePlanningMonitorStore.getState().hoverSource === 'map') setHovered(null, 'map')
      setHoverStack(null)
    }

    sync()
    reportViewport()
    map.on('style.load', sync)
    map.on('idle', onIdle)
    map.on('moveend', reportViewport)
    map.on('click', onClick)
    map.on('mousemove', onMove)
    map.on('mouseout', onLeave)
    return () => {
      map.off('style.load', sync)
      map.off('idle', onIdle)
      map.off('moveend', reportViewport)
      map.off('click', onClick)
      map.off('mousemove', onMove)
      map.off('mouseout', onLeave)
      if (!mapAlive(map)) return
      map.getCanvas().style.cursor = ''
      // Leave nothing behind for the next mode. The style swap on leaving Planning clears these
      // too; removing them here covers a mode change that does not swap style.
      if (map.isStyleLoaded()) {
        for (const id of PLANNING_LAYER_IDS) if (map.getLayer(id)) map.removeLayer(id)
        for (const id of SOURCES) if (map.getSource(id)) map.removeSource(id)
      }
    }
  }, [map, setViewport, setHovered, setHoverStack, select])

  // Data updates.
  const dataKey = [clusters, outside, archived, patchGeometry, stores, storeRadiusMeters]
  useEffect(() => {
    if (!ensureLayers(map)) {
      pending.current = true
      return
    }
    apply(map, latest.current.data)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, ...dataKey])

  // Store badges: HTML markers, so they survive style swaps without re-adding. Hidden while drawing,
  // where they would sit over the vertices being placed.
  const pinsRef = useRef<StorePinCluster | null>(null)
  useEffect(() => {
    const pins = new StorePinCluster(map, { clusterColor: PLANNING_COLORS.estate })
    pinsRef.current = pins
    return () => {
      pins.destroy()
      pinsRef.current = null
    }
  }, [map])
  useEffect(() => {
    pinsRef.current?.setPins(interactive ? stores : [])
  }, [map, stores, interactive])

  // Highlight updates.
  const filterKey = `${newKeys.join(',')}|${focusKeys.join(',')}`
  useEffect(() => {
    if (!ensureLayers(map)) {
      pending.current = true
      return
    }
    applyFilters(map, latest.current.data)
  }, [map, filterKey])

  return null
}
