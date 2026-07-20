'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MAP_STYLES, MAPBOX_TOKEN } from '@/lib/sitesketcher-v2/constants'
import { useWorkspaceStore } from '../../lib/stores/unified-workspace-store'
import type { NearbyStore } from '../../lib/services/gaps-service'
import type {
  PlanningApplication,
  RequirementLocation,
} from '../../types/unified-workspace'
import {
  applyStoreBadgeHighlight,
  buildStoreBadge,
  populateStoreBadge,
  storeVisualChanged,
} from './store-badges'
import { StorePinCluster } from './StorePinCluster'
import type { GapPinsStatus } from '../../lib/hooks/useFindGapsStorePins'

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

// Live occupier requirement pins (Assess-only, gated on the overlay toggle).
const REQ_SOURCE = 'assess-requirements'
const REQ_LAYER = 'assess-requirements-dots'

// Planning application pins (Planning tab only, both modes).
const PLANNING_SOURCE = 'planning-applications'
const PLANNING_LAYER = 'planning-applications-dots'
const PLANNING_COLOR = '#F26B1F'

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

// Per-pin compare outlines (both A and B drawn at once, coloured per pin, with
// the active pin emphasised). Replaces the single outline while comparing.
const COMPARE_SOURCE = 'compare-boundary'
const COMPARE_LINE_LAYER = 'compare-boundary-line'
const COMPARE_A_COLOR = '#7033FF'
const COMPARE_B_COLOR = '#E8622C'

// Traffic overlays (available everywhere except sketch). Two independent toggles:
// road AADT line-shading and a count-point intensity heatmap. Tilesets ported
// from the SiteAnalyser tool.
const TRAFFIC_ROADS_TILESET = 'dovet.a4p7c0q8'
const TRAFFIC_ROADS_SOURCE = 'traffic-roads'
const TRAFFIC_ROADS_LAYER = 'traffic-roads-line'
const TRAFFIC_ROADS_SRC_LAYER = 'traffic_roads'

const TRAFFIC_COUNTS_TILESET = 'dovet.b44k9tis'
const TRAFFIC_COUNTS_SOURCE = 'traffic-counts'
const TRAFFIC_HEAT_LAYER = 'traffic-counts-heat'
const TRAFFIC_COUNTS_SRC_LAYER = 'traffic_counts'

export interface LsoaLayerProps {
  allCodes: string[]
  selectedCodes: Set<string>
  onToggle: (code: string) => void
  boundaryGeometry: GeoJSON.Geometry | null
}

// Per-pin catchment outlines drawn while comparing two locations.
export interface CompareBoundariesProps {
  a: GeoJSON.Geometry | null
  b: GeoJSON.Geometry | null
  active: 'a' | 'b'
}

function buaFilter(codes: string[] | null, range: [number, number]) {
  // No active query (null) or a query that matched nothing ([]) ⇒ paint no BUAs.
  // The map only lights up once a bucket produces matching gsscodes.
  if (!codes || codes.length === 0) {
    return ['in', ['get', 'gsscode'], ['literal', []]]
  }
  const pop = ['coalesce', ['get', 'pop_final'], ['get', 'pop']] as const
  return [
    'all',
    ['>=', pop, range[0]],
    ['<=', pop, range[1]],
    ['in', ['get', 'gsscode'], ['literal', codes]],
  ]
}

// Insert BUA/overlay layers below the base style's label symbols.
function firstSymbolLayerId(map: mapboxgl.Map): string | undefined {
  const layers = map.getStyle()?.layers ?? []
  return layers.find((l) => l.type === 'symbol')?.id
}

function requirementsToGeoJSON(
  reqs: RequirementLocation[]
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: reqs.map((r) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [r.coordinates.lng, r.coordinates.lat],
      },
      properties: { requirementId: r.requirementId, companyName: r.companyName },
    })),
  }
}

// Build the traffic-road popup as DOM nodes (textContent, not interpolated HTML)
// so untrusted tileset property values can't inject markup.
function buildRoadPopup(props: Record<string, unknown>): HTMLDivElement {
  const root = document.createElement('div')
  root.style.cssText = 'min-width:180px;font-family:inherit;'

  const roadNumber = String(props.road_number ?? '').trim()
  const classification = String(props.road_classification ?? '').trim()
  const aadtRaw = Number(props.aadt)

  const title = document.createElement('div')
  title.style.cssText =
    'font-size:14px;font-weight:600;color:#0f172a;margin-bottom:6px;'
  title.textContent = roadNumber || 'Road'
  root.appendChild(title)

  if (classification) {
    const type = document.createElement('div')
    type.style.cssText = 'font-size:12px;color:#64748b;margin-bottom:2px;'
    type.textContent = `Type: ${classification}`
    root.appendChild(type)
  }

  const traffic = document.createElement('div')
  traffic.style.cssText = 'font-size:12px;color:#334155;'
  const aadtText = Number.isFinite(aadtRaw)
    ? `${Math.round(aadtRaw).toLocaleString('en-GB')} vehicles/day`
    : 'No data'
  traffic.textContent = `Traffic: ${aadtText}`
  root.appendChild(traffic)

  return root
}

function planningToGeoJSON(
  apps: PlanningApplication[]
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: apps.map((a) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [a.lng, a.lat] },
      properties: { name: a.name },
    })),
  }
}

function applyMapCursor(map: mapboxgl.Map) {
  const st = useWorkspaceStore.getState()
  // Crosshair only for dropping an Assess pin — not while toggling catchment
  // cells or browsing planning pins.
  map.getCanvas().style.cursor =
    st.view === 'assess' && st.tab !== 'catchment' && st.tab !== 'planning'
      ? 'crosshair'
      : ''
}

// A labelled map pin (teardrop) carrying a single letter — used for the A/B
// compare pins. `anchor: 'bottom'` on the Marker points the tip at the coord.
function buildLabeledPin(color: string, letter: string): HTMLElement {
  const el = document.createElement('div')
  el.style.cssText =
    'width:26px;height:26px;border-radius:50% 50% 50% 0;' +
    `background:${color};transform:rotate(-45deg);` +
    'border:2px solid #fff;box-shadow:0 2px 6px rgba(20,10,40,0.35);' +
    'display:flex;align-items:center;justify-content:center;cursor:pointer;'
  const label = document.createElement('span')
  label.textContent = letter
  label.style.cssText =
    'transform:rotate(45deg);color:#fff;font-weight:700;font-size:13px;' +
    'line-height:1;font-family:inherit;'
  el.appendChild(label)
  return el
}

export function UnifiedMap({
  storeDots = [],
  visiblePresentBrandIds = null,
  requirements = [],
  planningApplications = [],
  lsoa,
  compareBoundaries,
  onMap,
  gapStorePins = [],
  gapPinsStatus = 'idle',
}: {
  storeDots?: NearbyStore[]
  // Brand ids whose present-store pins should show; null = show all (no filter).
  visiblePresentBrandIds?: Set<string> | null
  requirements?: RequirementLocation[]
  // Planning application pins (shown only while the Planning tab is open).
  planningApplications?: PlanningApplication[]
  lsoa?: LsoaLayerProps
  // Per-pin compare outlines; null when not comparing.
  compareBoundaries?: CompareBoundariesProps
  onMap?: (map: mapboxgl.Map | null) => void
  // Find-gaps clustered store pins + their fetch status (drives the map hint).
  gapStorePins?: NearbyStore[]
  gapPinsStatus?: GapPinsStatus
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const prevViewRef = useRef(useWorkspaceStore.getState().view)
  const pinRef = useRef<mapboxgl.Marker | null>(null)
  // Labelled A/B compare pins (mutually exclusive with the plain pinRef above).
  const compareMarkersRef = useRef<{
    a: mapboxgl.Marker | null
    b: mapboxgl.Marker | null
  }>({ a: null, b: null })
  const readyRef = useRef(false)
  // Latest LSOA toggle handler, read inside the once-registered map click handler.
  const lsoaToggleRef = useRef<((code: string) => void) | undefined>(undefined)
  lsoaToggleRef.current = lsoa?.onToggle
  // Latest requirements, read by addLayers to re-hydrate the source after a
  // style swap (mirrors how the Assess pin re-places from store state).
  const requirementsRef = useRef<RequirementLocation[]>(requirements)
  requirementsRef.current = requirements
  // Latest planning applications: read by addLayers for post-style-load
  // rehydration, and by the click handler to resolve a pin hit to its record.
  const planningRef = useRef<PlanningApplication[]>(planningApplications)
  planningRef.current = planningApplications
  // Latest per-pin compare outlines, read by addLayers to re-hydrate the source
  // after a style swap (mirrors requirementsRef above).
  const compareBoundariesRef = useRef<CompareBoundariesProps | undefined>(
    compareBoundaries
  )
  compareBoundariesRef.current = compareBoundaries
  // Assess store logo-badge markers, keyed by store id, plus the last-rendered
  // store snapshot used to detect position/visual changes on re-sync.
  const storeMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map())
  const storeSnapshotRef = useRef<Map<string, NearbyStore>>(new Map())
  const storeDotsRef = useRef<NearbyStore[]>(storeDots)
  storeDotsRef.current = storeDots
  // Brand filter for the store pins, read inside syncStoreMarkers (which runs
  // from stale style-load closures, so it must read the ref, not the prop).
  const visibleBrandIdsRef = useRef<Set<string> | null>(visiblePresentBrandIds)
  visibleBrandIdsRef.current = visiblePresentBrandIds
  // Find-gaps clustered store pins: a supercluster-backed controller plus a ref of
  // the latest pin set, so post-style-load rehydration can re-feed it.
  const clusterRef = useRef<StorePinCluster | null>(null)
  const gapStorePinsRef = useRef<NearbyStore[]>(gapStorePins)
  gapStorePinsRef.current = gapStorePins

  const view = useWorkspaceStore((s) => s.view)
  const tab = useWorkspaceStore((s) => s.tab)
  const showLsoa = useWorkspaceStore((s) => s.showLsoa)
  const area = useWorkspaceStore((s) => s.area)
  const gapGssCodes = useWorkspaceStore((s) => s.gapGssCodes)
  const populationRange = useWorkspaceStore((s) => s.populationRange)
  const showSubFiveK = useWorkspaceStore((s) => s.showSubFiveK)
  const assessPoint = useWorkspaceStore((s) => s.assessPoint)
  const compareArm = useWorkspaceStore((s) => s.compareArm)
  const comparePair = useWorkspaceStore((s) => s.comparePair)
  const activeCompareArm = useWorkspaceStore((s) => s.activeCompareArm)
  const hoveredBrandId = useWorkspaceStore((s) => s.hoveredBrandId)
  const overlaysRequirements = useWorkspaceStore((s) => s.overlays.requirements)
  const overlaysRoadTraffic = useWorkspaceStore((s) => s.overlays.roadTraffic)
  const overlaysTrafficHeatmap = useWorkspaceStore((s) => s.overlays.trafficHeatmap)
  const selectArea = useWorkspaceStore((s) => s.selectArea)
  const setAssessPoint = useWorkspaceStore((s) => s.setAssessPoint)
  const setReqModal = useWorkspaceStore((s) => s.setReqModal)

  // Coordinate-only signature of the compare pair, used to key the camera effect
  // so it fires only when a pin moves (added/removed), not on a catchment edit.
  const compareCoordKey = comparePair
    ? `${comparePair.a.lat},${comparePair.a.lng}|${comparePair.b.lat},${comparePair.b.lng}`
    : null

  // Reconcile the Assess store logo-badge markers against the latest storeDots.
  // Creates/removes markers by id, updates position + badge content in place,
  // and toggles visibility to match the old circle-layer rule. Reads live store
  // state so it stays correct when called from a stale style-load closure.
  const syncStoreMarkers = (map: mapboxgl.Map) => {
    const st = useWorkspaceStore.getState()
    // Hide store badges on the Planning tab so its pins read clearly.
    const assessVisible =
      st.view === 'assess' && st.tab !== 'catchment' && st.tab !== 'planning'
    const filterSet = visibleBrandIdsRef.current
    const stores = storeDotsRef.current
    const markers = storeMarkersRef.current
    const snapshot = storeSnapshotRef.current
    const seen = new Set<string>()

    for (const store of stores) {
      seen.add(store.id)
      const show =
        assessVisible && (filterSet == null || filterSet.has(store.brand_id))
      const prev = snapshot.get(store.id)
      let marker = markers.get(store.id)
      if (!marker) {
        const el = buildStoreBadge(store)
        el.style.display = show ? '' : 'none'
        marker = new mapboxgl.Marker({ element: el })
          .setLngLat([store.lon, store.lat])
          .addTo(map)
        markers.set(store.id, marker)
      } else {
        if (!prev || prev.lat !== store.lat || prev.lon !== store.lon) {
          marker.setLngLat([store.lon, store.lat])
        }
        if (!prev || storeVisualChanged(prev, store)) {
          populateStoreBadge(marker.getElement(), store)
        }
        marker.getElement().style.display = show ? '' : 'none'
      }
      snapshot.set(store.id, store)
    }

    markers.forEach((marker, id) => {
      if (!seen.has(id)) {
        marker.remove()
        markers.delete(id)
        snapshot.delete(id)
      }
    })

    // Re-apply hover highlighting so markers created/updated during an active
    // brand hover pick up the correct emphasis/dimming.
    applyStoreHighlight()
  }

  // Feed the latest find-gaps pin set into the supercluster controller, creating
  // it on first use. Markers are HTML (no style layers), so this only needs the
  // map instance — safe to call from the style-load path and prop effects alike.
  const syncClusterPins = (map: mapboxgl.Map) => {
    if (!clusterRef.current) clusterRef.current = new StorePinCluster(map)
    clusterRef.current.setPins(gapStorePinsRef.current)
    clusterRef.current.applyBrandHighlight(useWorkspaceStore.getState().hoveredBrandId)
  }

  // Emphasize the hovered brand's store badges and dim the rest. Never touches
  // el.style.transform — Mapbox owns that for marker positioning.
  const applyStoreHighlight = () => {
    const hovered = useWorkspaceStore.getState().hoveredBrandId
    const markers = storeMarkersRef.current
    const snapshot = storeSnapshotRef.current
    markers.forEach((marker, id) => {
      applyStoreBadgeHighlight(marker.getElement(), snapshot.get(id), hovered)
    })
    clusterRef.current?.applyBrandHighlight(hovered)
  }

  // Single source of truth for the Assess pin(s). Reads live store state and
  // reconciles the plain violet pin against the labelled A/B compare pins so no
  // stale marker survives a style reload or a state change:
  //   • no compare  → one plain violet pin at assessPoint
  //   • armed (no pair) → violet "A" pin at assessPoint
  //   • paired      → "A" (violet) at a, "B" (orange) at b; no plain pin
  const syncAssessPins = (map: mapboxgl.Map) => {
    const st = useWorkspaceStore.getState()
    const markers = compareMarkersRef.current

    const removePlain = () => {
      pinRef.current?.remove()
      pinRef.current = null
    }
    const removeLabeled = () => {
      markers.a?.remove()
      markers.a = null
      markers.b?.remove()
      markers.b = null
    }

    if (st.view !== 'assess' || !st.assessPoint) {
      removePlain()
      removeLabeled()
      return
    }

    // Clicking a compare pin selects that arm for editing. stopPropagation keeps
    // the click from falling through to the map's drop-point handler.
    const attachArmClick = (marker: mapboxgl.Marker, arm: 'a' | 'b') => {
      marker.getElement().addEventListener('click', (e) => {
        e.stopPropagation()
        useWorkspaceStore.getState().setActiveCompareArm(arm)
      })
    }

    if (st.comparePair) {
      removePlain()
      if (!markers.a) {
        markers.a = new mapboxgl.Marker({
          element: buildLabeledPin('#7033FF', 'A'),
          anchor: 'bottom',
        })
        attachArmClick(markers.a, 'a')
      }
      markers.a.setLngLat([st.comparePair.a.lng, st.comparePair.a.lat]).addTo(map)
      if (!markers.b) {
        markers.b = new mapboxgl.Marker({
          element: buildLabeledPin('#E8622C', 'B'),
          anchor: 'bottom',
        })
        attachArmClick(markers.b, 'b')
      }
      markers.b.setLngLat([st.comparePair.b.lng, st.comparePair.b.lat]).addTo(map)
      return
    }

    if (st.compareArm) {
      removePlain()
      markers.b?.remove()
      markers.b = null
      if (!markers.a) markers.a = new mapboxgl.Marker({
        element: buildLabeledPin('#7033FF', 'A'),
        anchor: 'bottom',
      })
      markers.a.setLngLat([st.assessPoint.lng, st.assessPoint.lat]).addTo(map)
      return
    }

    removeLabeled()
    if (!pinRef.current) pinRef.current = new mapboxgl.Marker({ color: '#7033FF' })
    pinRef.current.setLngLat([st.assessPoint.lng, st.assessPoint.lat]).addTo(map)
  }

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

    // Requirement pins — larger violet markers, styled distinctly from stores.
    if (!map.getSource(REQ_SOURCE)) {
      map.addSource(REQ_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
    }
    if (!map.getLayer(REQ_LAYER)) {
      map.addLayer({
        id: REQ_LAYER,
        type: 'circle',
        source: REQ_SOURCE,
        paint: {
          'circle-radius': 7,
          'circle-color': '#7033FF',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2,
        },
      })
    }
    // Re-hydrate the source (a style swap resets it to the empty seed above).
    const reqSrc = map.getSource(REQ_SOURCE) as mapboxgl.GeoJSONSource | undefined
    reqSrc?.setData(requirementsToGeoJSON(requirementsRef.current))

    // Planning application pins — orange dots, Planning tab only.
    if (!map.getSource(PLANNING_SOURCE)) {
      map.addSource(PLANNING_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
    }
    if (!map.getLayer(PLANNING_LAYER)) {
      map.addLayer({
        id: PLANNING_LAYER,
        type: 'circle',
        source: PLANNING_SOURCE,
        paint: {
          'circle-radius': 7,
          'circle-color': PLANNING_COLOR,
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2,
        },
      })
    }
    const planningSrc = map.getSource(PLANNING_SOURCE) as
      | mapboxgl.GeoJSONSource
      | undefined
    planningSrc?.setData(planningToGeoJSON(planningRef.current))

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

    // Compare outlines: both pins at once, coloured per pin, active pin emphasised.
    if (!map.getSource(COMPARE_SOURCE)) {
      map.addSource(COMPARE_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
    }
    if (!map.getLayer(COMPARE_LINE_LAYER)) {
      map.addLayer({
        id: COMPARE_LINE_LAYER,
        type: 'line',
        source: COMPARE_SOURCE,
        paint: {
          'line-color': [
            'match',
            ['get', 'pin'],
            'a',
            COMPARE_A_COLOR,
            'b',
            COMPARE_B_COLOR,
            '#7033FF',
          ] as any,
          'line-width': ['case', ['get', 'active'], 3.5, 2] as any,
          'line-opacity': ['case', ['get', 'active'], 1, 0.55] as any,
          'line-dasharray': [2, 2],
        },
      })
    }

    // Traffic heatmap (count-point intensity). Added before the road line so the
    // crisp road shading renders on top of the softer heatmap bloom.
    if (!map.getSource(TRAFFIC_COUNTS_SOURCE)) {
      map.addSource(TRAFFIC_COUNTS_SOURCE, {
        type: 'vector',
        url: `mapbox://${TRAFFIC_COUNTS_TILESET}`,
      })
    }
    if (!map.getLayer(TRAFFIC_HEAT_LAYER)) {
      map.addLayer(
        {
          id: TRAFFIC_HEAT_LAYER,
          type: 'heatmap',
          source: TRAFFIC_COUNTS_SOURCE,
          'source-layer': TRAFFIC_COUNTS_SRC_LAYER,
          layout: { visibility: 'none' },
          paint: {
            'heatmap-weight': [
              'interpolate',
              ['linear'],
              ['get', 'aadt'],
              0, 0,
              50000, 1,
            ],
            'heatmap-intensity': [
              'interpolate',
              ['linear'],
              ['zoom'],
              6, 0.6,
              14, 1.2,
            ],
            'heatmap-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              6, 8,
              12, 25,
              16, 40,
            ],
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0, 'rgba(0,0,0,0)',
              0.2, '#fde68a',
              0.4, '#fbbf24',
              0.6, '#f97316',
              0.8, '#dc2626',
              1, '#991b1b',
            ],
            'heatmap-opacity': 0.7,
          },
        },
        beforeId
      )
    }

    // Road AADT line-shading (grey → dark red), width scales with zoom.
    if (!map.getSource(TRAFFIC_ROADS_SOURCE)) {
      map.addSource(TRAFFIC_ROADS_SOURCE, {
        type: 'vector',
        url: `mapbox://${TRAFFIC_ROADS_TILESET}`,
      })
    }
    if (!map.getLayer(TRAFFIC_ROADS_LAYER)) {
      map.addLayer(
        {
          id: TRAFFIC_ROADS_LAYER,
          type: 'line',
          source: TRAFFIC_ROADS_SOURCE,
          'source-layer': TRAFFIC_ROADS_SRC_LAYER,
          layout: { visibility: 'none' },
          paint: {
            'line-color': [
              'interpolate',
              ['linear'],
              ['get', 'aadt'],
              0, '#e5e7eb',
              5000, '#fde68a',
              10000, '#fbbf24',
              20000, '#f97316',
              35000, '#dc2626',
              50000, '#991b1b',
            ],
            'line-width': [
              'interpolate',
              ['linear'],
              ['zoom'],
              8, 1,
              10, 1.5,
              12, 2.5,
              14, 4,
              16, 6,
            ],
            'line-opacity': 0.75,
          },
        },
        beforeId
      )
    }

    applyBuaFilter(map)
    applyLsoaFilters(map)
    applyCatchmentBoundary(map)
    applyCompareBoundaries(map)
    applyVisibility(map)
    applyMapCursor(map)
    readyRef.current = true
    // Re-attach store logo badges now the style is ready — covers storeDots that
    // arrived before the style loaded (the storeDots effect early-returns then).
    syncStoreMarkers(map)
    syncClusterPins(map)

    // Hydrate dynamic state in case it changed before the style finished loading.
    const st = useWorkspaceStore.getState()
    if (map.getLayer(BUA_SELECTED_LAYER)) {
      map.setFilter(BUA_SELECTED_LAYER, [
        '==',
        ['get', 'gsscode'],
        st.area?.kind === 'bua' ? st.area.id : '__none__',
      ] as any)
    }
    // Re-place the Assess pin(s) if they were set before the style settled.
    syncAssessPins(map)
  }

  const applyBuaFilter = (map: mapboxgl.Map) => {
    if (!map.getLayer(BUA_FILL_LAYER)) return
    const effRange: [number, number] = [
      showSubFiveK ? 0 : populationRange[0],
      populationRange[1],
    ]
    const f = buaFilter(gapGssCodes, effRange) as any
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

  // Draw both pins' catchment outlines (A + B) as one FeatureCollection, tagging
  // each with its pin id and whether it's the active (emphasised) arm.
  const applyCompareBoundaries = (map: mapboxgl.Map) => {
    const src = map.getSource(COMPARE_SOURCE) as mapboxgl.GeoJSONSource | undefined
    if (!src) return
    const cb = compareBoundariesRef.current
    const features: GeoJSON.Feature[] = []
    if (cb) {
      for (const pin of ['a', 'b'] as const) {
        const geom = cb[pin]
        if (!geom) continue
        features.push({
          type: 'Feature',
          geometry: geom,
          properties: { pin, active: cb.active === pin },
        })
      }
    }
    src.setData({ type: 'FeatureCollection', features })
  }

  const applyVisibility = (map: mapboxgl.Map) => {
    const catchmentActive = tab === 'catchment'
    const buaVisible = view === 'find'
    for (const id of [BUA_FILL_LAYER, BUA_OUTLINE_LAYER, BUA_SELECTED_LAYER]) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, 'visibility', buaVisible ? 'visible' : 'none')
      }
    }
    // Assess store logo badges are HTML markers; their visibility is handled by
    // syncStoreMarkers (called from the same effects as applyVisibility).
    // Requirement pins: Assess-only, require an active dropped point, gated on
    // the overlay toggle, and hidden while the Catchment tab owns the view.
    const reqVisible =
      view === 'assess' &&
      !!assessPoint &&
      !catchmentActive &&
      tab !== 'planning' &&
      useWorkspaceStore.getState().overlays.requirements
    if (map.getLayer(REQ_LAYER)) {
      map.setLayoutProperty(REQ_LAYER, 'visibility', reqVisible ? 'visible' : 'none')
    }
    // Planning pins own the map while their tab is open — and only then.
    if (map.getLayer(PLANNING_LAYER)) {
      map.setLayoutProperty(
        PLANNING_LAYER,
        'visibility',
        tab === 'planning' ? 'visible' : 'none'
      )
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
    // The Assess boundary (circle for distance, isochrone for drive/walk) is the
    // single dashed shape for a dropped pin — show it whenever a pin exists, not
    // just on the Catchment tab. The BUA boundary stays scoped to the tab. While
    // comparing, the per-pin compare outlines replace it, so hide the single one.
    const boundaryVisible =
      !comparePair && (catchmentActive || (view === 'assess' && !!assessPoint))
    if (map.getLayer(CATCH_LINE_LAYER)) {
      map.setLayoutProperty(
        CATCH_LINE_LAYER,
        'visibility',
        boundaryVisible ? 'visible' : 'none'
      )
    }
    // The per-pin compare outlines (A + B) are shown only while a pair exists.
    if (map.getLayer(COMPARE_LINE_LAYER)) {
      map.setLayoutProperty(
        COMPARE_LINE_LAYER,
        'visibility',
        comparePair ? 'visible' : 'none'
      )
    }

    // Traffic overlays: available everywhere except sketch, each on its own toggle.
    // Read live store state (not the closure) so this stays correct when called
    // from stale style-load closures. addLayers early-returns in sketch, so the
    // notSketch guard is belt-and-braces.
    const st = useWorkspaceStore.getState()
    const notSketch = st.view !== 'sketch'
    if (map.getLayer(TRAFFIC_HEAT_LAYER)) {
      map.setLayoutProperty(
        TRAFFIC_HEAT_LAYER,
        'visibility',
        notSketch && st.overlays.trafficHeatmap ? 'visible' : 'none'
      )
    }
    if (map.getLayer(TRAFFIC_ROADS_LAYER)) {
      map.setLayoutProperty(
        TRAFFIC_ROADS_LAYER,
        'visibility',
        notSketch && st.overlays.roadTraffic ? 'visible' : 'none'
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
    // Capture the marker maps (stable useRef identities) for the cleanup below.
    const storeMarkers = storeMarkersRef.current
    const storeSnapshot = storeSnapshotRef.current

    const onLoad = () => addLayers(map)
    map.on('load', onLoad)
    // Re-add custom layers after a base-style swap (sketch <-> discovery).
    map.on('style.load', onLoad)

    // Click BUA → select it; click empty map in Assess → drop a pin.
    // The Catchment tab owns clicks (LSOA toggle) via its own layer handlers.
    map.on('click', (e) => {
      const st = useWorkspaceStore.getState()
      if (st.tab === 'catchment') return
      // Planning tab owns clicks entirely: a pin hit opens its modal; anything
      // else is inert. Placed before the compare / Find-select / Assess-pin
      // paths so a Planning-tab click can never arm or drop a compare pin,
      // select a BUA, or move the Assess pin.
      if (st.tab === 'planning') {
        if (map.getLayer(PLANNING_LAYER)) {
          const hit = map.queryRenderedFeatures(e.point, {
            layers: [PLANNING_LAYER],
          })
          const name = hit[0]?.properties?.name
          if (name) {
            const app = planningRef.current.find((a) => a.name === name)
            if (app) st.setPlanningModal(app)
          }
        }
        return
      }
      // Road-shading popup: consume the click before the Assess pin-drop path so
      // clicking a road never relocates the dropped pin. Placed after the
      // catchment guard so LSOA cell-toggling still owns clicks on that tab.
      if (
        st.view !== 'sketch' &&
        st.overlays.roadTraffic &&
        map.getLayer(TRAFFIC_ROADS_LAYER)
      ) {
        const hit = map.queryRenderedFeatures(e.point, {
          layers: [TRAFFIC_ROADS_LAYER],
        })
        if (hit[0]?.properties) {
          new mapboxgl.Popup({ closeButton: true, closeOnClick: false })
            .setLngLat(e.lngLat)
            .setDOMContent(buildRoadPopup(hit[0].properties))
            .addTo(map)
          return
        }
      }
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
        // Compare flow: armed → this click drops pin B; already paired → ignore
        // (block relocating pin A until the comparison is cleared).
        if (st.compareArm) {
          st.dropComparePoint({ lat: e.lngLat.lat, lng: e.lngLat.lng })
          return
        }
        if (st.comparePair) return
        // Clicking a requirement pin opens its modal instead of moving the pin.
        // Guard getLayer — the layer is briefly absent during a style teardown.
        if (st.overlays.requirements && map.getLayer(REQ_LAYER)) {
          const hit = map.queryRenderedFeatures(e.point, { layers: [REQ_LAYER] })
          const requirementId = hit[0]?.properties?.requirementId
          if (requirementId) {
            setReqModal(requirementId as string)
            return
          }
        }
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

    map.on('mouseenter', REQ_LAYER, () => {
      if (useWorkspaceStore.getState().overlays.requirements) {
        map.getCanvas().style.cursor = 'pointer'
      }
    })
    map.on('mouseleave', REQ_LAYER, () => applyMapCursor(map))

    map.on('mouseenter', PLANNING_LAYER, () => {
      if (useWorkspaceStore.getState().tab === 'planning') {
        map.getCanvas().style.cursor = 'pointer'
      }
    })
    map.on('mouseleave', PLANNING_LAYER, () => applyMapCursor(map))

    // Road-shading hover: pointer cursor when the overlay is on (outside catchment).
    map.on('mouseenter', TRAFFIC_ROADS_LAYER, () => {
      const st = useWorkspaceStore.getState()
      if (st.overlays.roadTraffic && st.tab !== 'catchment') {
        map.getCanvas().style.cursor = 'pointer'
      }
    })
    map.on('mouseleave', TRAFFIC_ROADS_LAYER, () => applyMapCursor(map))

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
      storeMarkers.forEach((marker) => marker.remove())
      storeMarkers.clear()
      storeSnapshot.clear()
      pinRef.current?.remove()
      pinRef.current = null
      compareMarkersRef.current.a?.remove()
      compareMarkersRef.current.b?.remove()
      compareMarkersRef.current = { a: null, b: null }
      clusterRef.current?.destroy()
      clusterRef.current = null
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
      if (readyRef.current) {
        applyVisibility(map)
        syncStoreMarkers(map)
      }
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
      syncStoreMarkers(map)
      applyMapCursor(map)
    }
  }, [view])

  // Re-apply the BUA filter when rules/population change.
  useEffect(() => {
    const map = mapRef.current
    if (map && readyRef.current) applyBuaFilter(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gapGssCodes, populationRange, showSubFiveK])

  // Re-evaluate layer visibility when the tab or LSOA overlay toggle changes.
  useEffect(() => {
    const map = mapRef.current
    if (map && readyRef.current) {
      applyVisibility(map)
      syncStoreMarkers(map)
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

  // Place the Assess pin marker + fly to it. The dashed boundary shape is drawn
  // through the shared catchment path (applyCatchmentBoundary), so this effect no
  // longer draws its own circle — it just re-evaluates boundary visibility.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    syncAssessPins(map)
    // Only fly to a freshly dropped single point — never fight the compare
    // camera (national on arm, fitBounds on pair) while a comparison is active.
    if (assessPoint && !comparePair) {
      map.flyTo({ center: [assessPoint.lng, assessPoint.lat], zoom: 11, duration: 900 })
    }
    applyVisibility(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessPoint])

  // Compare camera: re-sync the A/B pins and move the camera. Arming opens up the
  // whole UK as a drop target; a completed pair frames both pins. Keyed on a
  // coordinate-only signature (not the comparePair object, which gets a fresh
  // reference on every catchment edit) so the camera only moves when a pin is
  // added or removed — never on a slider/mode change.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    syncAssessPins(map)
    if (comparePair) {
      const bounds = new mapboxgl.LngLatBounds(
        [comparePair.a.lng, comparePair.a.lat],
        [comparePair.a.lng, comparePair.a.lat]
      )
      bounds.extend([comparePair.b.lng, comparePair.b.lat])
      map.fitBounds(bounds, { padding: 140, maxZoom: 12, duration: 900 })
    } else if (compareArm) {
      map.flyTo({ ...NATIONAL_VIEWPORT, duration: 900 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareArm, compareCoordKey])

  // Compare visibility + outlines: suppress the single dashed shape and repaint
  // both per-pin outlines. Runs on catchment edits, active-arm switches, and when
  // a pair is added/cleared — none of which the coordinate-keyed camera effect
  // reacts to. Also re-syncs the pins so active-arm emphasis stays current.
  const hasComparePair = !!comparePair
  const compareBoundaryA = compareBoundaries?.a
  const compareBoundaryB = compareBoundaries?.b
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    syncAssessPins(map)
    applyCompareBoundaries(map)
    applyVisibility(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasComparePair, activeCompareArm, compareBoundaryA, compareBoundaryB])

  // Reconcile the Assess store logo-badge markers when the nearby stores change.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    syncStoreMarkers(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeDots])

  // Feed the find-gaps clustered pins into the controller when they change.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    syncClusterPins(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gapStorePins])

  // Restyle store badges when the hovered present-brand changes.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    applyStoreHighlight()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredBrandId])

  // Re-sync badge visibility when the brand/category filter changes.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    syncStoreMarkers(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiblePresentBrandIds])

  // Feed requirement locations into the Assess requirements layer. The ref is
  // updated on every render; this also covers post-style-load rehydration via
  // addLayers reading requirementsRef.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    const src = map.getSource(REQ_SOURCE) as mapboxgl.GeoJSONSource | undefined
    src?.setData(requirementsToGeoJSON(requirements))
  }, [requirements])

  // Feed planning applications into their layer (mirrors the requirements
  // effect; the tab-change effect above re-runs applyVisibility).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    const src = map.getSource(PLANNING_SOURCE) as
      | mapboxgl.GeoJSONSource
      | undefined
    src?.setData(planningToGeoJSON(planningApplications))
  }, [planningApplications])

  // Re-evaluate overlay-layer visibility when any overlay toggle flips.
  useEffect(() => {
    const map = mapRef.current
    if (map && readyRef.current) applyVisibility(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlaysRequirements, overlaysRoadTraffic, overlaysTrafficHeatmap])

  const pinHint =
    gapPinsStatus === 'zoom_gated'
      ? 'Zoom in to see stores'
      : gapPinsStatus === 'truncated'
        ? 'Too many stores — zoom in'
        : null

  return (
    <div ref={containerRef} className="absolute inset-0 h-full w-full">
      {pinHint && (
        <div className="pointer-events-none absolute left-1/2 top-3.5 z-10 -translate-x-1/2 rounded-full border border-sm-border bg-sm-surface px-3 py-1.5 shadow-[0_4px_14px_-6px_rgba(20,10,40,0.3)]">
          <span className="font-mono text-[11px] font-medium text-sm-ink2">
            {pinHint}
          </span>
        </div>
      )}
    </div>
  )
}
