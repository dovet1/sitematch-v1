'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MAP_STYLES, MAPBOX_TOKEN } from '@/lib/sitesketcher-v2/constants'
import { getClearbitLogoUrl } from '@/lib/clearbit-logo'
import { useWorkspaceStore } from '../../lib/stores/unified-workspace-store'
import type { NearbyStore } from '../../lib/services/gaps-service'
import type { RequirementLocation } from '../../types/unified-workspace'

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

// Assess store pins are HTML markers (brand logo badges), not a GeoJSON layer.
const STORE_BADGE_SIZE = 32
const STORE_BADGE_SHADOW = '0 0 0 2px #2A6FDB,0 1px 3px rgba(0,0,0,0.3)'
const STORE_BADGE_SHADOW_HL = '0 0 0 3px #7033FF,0 2px 8px rgba(0,0,0,0.45)'

// Live occupier requirement pins (Assess-only, gated on the overlay toggle).
const REQ_SOURCE = 'assess-requirements'
const REQ_LAYER = 'assess-requirements-dots'

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

// ---- Assess store logo badges (HTML markers) ------------------------------

function storeInitial(store: NearbyStore): string {
  const src = store.brand_name || store.name || '?'
  return src.trim().charAt(0).toUpperCase() || '?'
}

// Renders the brand-initial fallback badge into an existing badge element.
function renderInitialBadge(el: HTMLElement, store: NearbyStore) {
  const span = document.createElement('span')
  span.textContent = storeInitial(store)
  span.style.cssText =
    'display:flex;align-items:center;justify-content:center;width:100%;height:100%;' +
    'background:#2A6FDB;color:#fff;font-weight:600;font-size:13px;'
  el.replaceChildren(span)
}

// Renders an <img> that walks the source list on error (logo.dev → logo_url),
// falling back to the initial badge once every source has failed to load.
function renderLogoImg(el: HTMLElement, store: NearbyStore, sources: string[]) {
  let idx = 0
  const img = document.createElement('img')
  img.alt = ''
  img.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#fff;'
  img.onerror = () => {
    idx += 1
    if (idx < sources.length) img.src = sources[idx]
    else renderInitialBadge(el, store)
  }
  img.src = sources[0]
  el.replaceChildren(img)
}

// Populates a badge element with the store's logo, by priority:
// logo.dev (from brand domain) → uploaded logo_url → brand-initial badge.
function populateStoreBadge(el: HTMLElement, store: NearbyStore) {
  const sources: string[] = []
  // getClearbitLogoUrl returns null when the token is missing or the domain is
  // invalid — guard for that and continue down the fallback chain.
  const logoDev = store.logo_domain ? getClearbitLogoUrl(store.logo_domain, 64) : null
  if (logoDev) sources.push(logoDev)
  if (store.logo_url) sources.push(store.logo_url)
  if (sources.length > 0) renderLogoImg(el, store, sources)
  else renderInitialBadge(el, store)
}

function buildStoreBadge(store: NearbyStore): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText =
    `width:${STORE_BADGE_SIZE}px;height:${STORE_BADGE_SIZE}px;border-radius:50%;` +
    `overflow:hidden;background:#fff;box-shadow:${STORE_BADGE_SHADOW};` +
    'transition:opacity 120ms ease,box-shadow 120ms ease;' +
    'pointer-events:auto;cursor:pointer;'
  // Clicking a store pin opens the present-brand detail modal. Stop propagation
  // so it doesn't fall through to the map's Assess-pin drop handler.
  el.addEventListener('click', (e) => {
    e.stopPropagation()
    useWorkspaceStore.getState().setBrandInfoId(store.brand_id)
  })
  populateStoreBadge(el, store)
  return el
}

// Whether the visual inputs of a store changed (needs a badge rebuild).
function storeVisualChanged(a: NearbyStore, b: NearbyStore): boolean {
  return (
    a.logo_domain !== b.logo_domain ||
    a.logo_url !== b.logo_url ||
    a.brand_name !== b.brand_name ||
    a.name !== b.name
  )
}

function applyMapCursor(map: mapboxgl.Map) {
  const st = useWorkspaceStore.getState()
  // Crosshair only for dropping an Assess pin — not while toggling catchment cells.
  map.getCanvas().style.cursor =
    st.view === 'assess' && st.tab !== 'catchment' ? 'crosshair' : ''
}

export function UnifiedMap({
  storeDots = [],
  visiblePresentBrandIds = null,
  requirements = [],
  lsoa,
  onMap,
}: {
  storeDots?: NearbyStore[]
  // Brand ids whose present-store pins should show; null = show all (no filter).
  visiblePresentBrandIds?: Set<string> | null
  requirements?: RequirementLocation[]
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
  // Latest requirements, read by addLayers to re-hydrate the source after a
  // style swap (mirrors how the Assess pin re-places from store state).
  const requirementsRef = useRef<RequirementLocation[]>(requirements)
  requirementsRef.current = requirements
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

  const view = useWorkspaceStore((s) => s.view)
  const tab = useWorkspaceStore((s) => s.tab)
  const showLsoa = useWorkspaceStore((s) => s.showLsoa)
  const area = useWorkspaceStore((s) => s.area)
  const gapGssCodes = useWorkspaceStore((s) => s.gapGssCodes)
  const populationRange = useWorkspaceStore((s) => s.populationRange)
  const assessPoint = useWorkspaceStore((s) => s.assessPoint)
  const hoveredBrandId = useWorkspaceStore((s) => s.hoveredBrandId)
  const overlaysRequirements = useWorkspaceStore((s) => s.overlays.requirements)
  const selectArea = useWorkspaceStore((s) => s.selectArea)
  const setAssessPoint = useWorkspaceStore((s) => s.setAssessPoint)
  const setReqModal = useWorkspaceStore((s) => s.setReqModal)

  // Reconcile the Assess store logo-badge markers against the latest storeDots.
  // Creates/removes markers by id, updates position + badge content in place,
  // and toggles visibility to match the old circle-layer rule. Reads live store
  // state so it stays correct when called from a stale style-load closure.
  const syncStoreMarkers = (map: mapboxgl.Map) => {
    const st = useWorkspaceStore.getState()
    const assessVisible = st.view === 'assess' && st.tab !== 'catchment'
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

  // Emphasize the hovered brand's store badges and dim the rest. Never touches
  // el.style.transform — Mapbox owns that for marker positioning.
  const applyStoreHighlight = () => {
    const hovered = useWorkspaceStore.getState().hoveredBrandId
    const markers = storeMarkersRef.current
    const snapshot = storeSnapshotRef.current
    markers.forEach((marker, id) => {
      const el = marker.getElement()
      if (!hovered) {
        el.style.opacity = '1'
        el.style.boxShadow = STORE_BADGE_SHADOW
        el.style.zIndex = ''
        return
      }
      const store = snapshot.get(id)
      if (store?.brand_id === hovered) {
        el.style.opacity = '1'
        el.style.boxShadow = STORE_BADGE_SHADOW_HL
        el.style.zIndex = '2'
      } else {
        el.style.opacity = '0.35'
        el.style.boxShadow = STORE_BADGE_SHADOW
        el.style.zIndex = ''
      }
    })
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
    // Re-attach store logo badges now the style is ready — covers storeDots that
    // arrived before the style loaded (the storeDots effect early-returns then).
    syncStoreMarkers(map)

    // Hydrate dynamic state in case it changed before the style finished loading.
    const st = useWorkspaceStore.getState()
    if (map.getLayer(BUA_SELECTED_LAYER)) {
      map.setFilter(BUA_SELECTED_LAYER, [
        '==',
        ['get', 'gsscode'],
        st.area?.kind === 'bua' ? st.area.id : '__none__',
      ] as any)
    }
    // Place the Assess pin marker if a point was dropped before the style settled.
    if (st.assessPoint) {
      if (!pinRef.current) {
        pinRef.current = new mapboxgl.Marker({ color: '#7033FF' })
      }
      pinRef.current.setLngLat([st.assessPoint.lng, st.assessPoint.lat]).addTo(map)
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
    // Assess store logo badges are HTML markers; their visibility is handled by
    // syncStoreMarkers (called from the same effects as applyVisibility).
    // Requirement pins: Assess-only, require an active dropped point, gated on
    // the overlay toggle, and hidden while the Catchment tab owns the view.
    const reqVisible =
      view === 'assess' &&
      !!assessPoint &&
      !catchmentActive &&
      useWorkspaceStore.getState().overlays.requirements
    if (map.getLayer(REQ_LAYER)) {
      map.setLayoutProperty(REQ_LAYER, 'visibility', reqVisible ? 'visible' : 'none')
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
    // just on the Catchment tab. The BUA boundary stays scoped to the tab.
    const boundaryVisible = catchmentActive || (view === 'assess' && !!assessPoint)
    if (map.getLayer(CATCH_LINE_LAYER)) {
      map.setLayoutProperty(
        CATCH_LINE_LAYER,
        'visibility',
        boundaryVisible ? 'visible' : 'none'
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
  }, [gapGssCodes, populationRange])

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
    if (assessPoint) {
      if (!pinRef.current) {
        pinRef.current = new mapboxgl.Marker({ color: '#7033FF' })
      }
      pinRef.current.setLngLat([assessPoint.lng, assessPoint.lat]).addTo(map)
      map.flyTo({ center: [assessPoint.lng, assessPoint.lat], zoom: 11, duration: 900 })
    } else {
      pinRef.current?.remove()
      pinRef.current = null
    }
    applyVisibility(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessPoint])

  // Reconcile the Assess store logo-badge markers when the nearby stores change.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    syncStoreMarkers(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeDots])

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

  // Re-evaluate requirement-pin visibility when the overlay toggle flips.
  useEffect(() => {
    const map = mapRef.current
    if (map && readyRef.current) applyVisibility(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlaysRequirements])

  return <div ref={containerRef} className="absolute inset-0 h-full w-full" />
}
