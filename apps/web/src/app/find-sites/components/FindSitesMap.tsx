'use client'

import { useEffect, useMemo, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MAP_STYLES, MAPBOX_TOKEN } from '@/lib/sitesketcher-v2/constants'
import type { FindSitesItem } from '@/lib/site-matching/find-sites-dto'
import type { SiteTier } from '@/lib/site-matching/tiering'
import { TIER_STYLES } from '../lib/tier-style'
import { useFindSitesStore } from '../lib/store/find-sites-store'

const PARCEL_SOURCE = 'find-sites-parcels'
const PARCEL_FILL = 'find-sites-parcels-fill'
const PARCEL_LINE = 'find-sites-parcels-line'
// Two line layers filtered to the selected parcel: a white casing + a tier-coloured ring on top,
// so the selection reads clearly even over the satellite basemap.
const PARCEL_SELECTED_CASING = 'find-sites-parcels-selected-casing'
const PARCEL_SELECTED_RING = 'find-sites-parcels-selected-ring'

const SELECTED_ONLY: mapboxgl.Expression = ['==', ['get', 'selected'], true]

// Canterbury — the demo geography. The map opens here even before a search returns.
const CANTERBURY_VIEW = { center: [1.078, 51.278] as [number, number], zoom: 11 }

// Data-driven tier → colour, expressed as a Mapbox 'match' expression over the feature property.
function tierColorExpr(): mapboxgl.Expression {
  const stops: (string | SiteTier)[] = []
  for (const [tier, style] of Object.entries(TIER_STYLES)) {
    stops.push(tier as SiteTier, style.color)
  }
  return ['match', ['get', 'tier'], ...stops, '#94A3B8'] as unknown as mapboxgl.Expression
}

function toFeatureCollection(
  items: FindSitesItem[],
  selectedSiteId: string | null
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: items
      .filter((i) => i.geometry)
      .map((i) => ({
        type: 'Feature',
        geometry: i.geometry as GeoJSON.Geometry,
        properties: {
          siteId: i.siteId,
          tier: i.tier,
          selected: i.siteId === selectedSiteId,
        },
      })),
  }
}

function firstSymbolLayerId(map: mapboxgl.Map): string | undefined {
  return map.getStyle()?.layers?.find((l) => l.type === 'symbol')?.id
}

export function FindSitesMap() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const readyRef = useRef(false)
  // Latest items/selection read from inside once-registered map closures.
  const itemsRef = useRef<FindSitesItem[]>([])
  const selectedRef = useRef<string | null>(null)
  // Track whether we've auto-framed the current result set yet (fit once per new set).
  const framedKeyRef = useRef<string | null>(null)

  // Select the STABLE `response` reference; deriving `?? []` inside the selector would return a
  // fresh array each render and break useSyncExternalStore's snapshot cache (infinite loop).
  const response = useFindSitesStore((s) => s.response)
  const items = useMemo(() => response?.items ?? [], [response])
  const selectedSiteId = useFindSitesStore((s) => s.selectedSiteId)
  const select = useFindSitesStore((s) => s.select)
  itemsRef.current = items
  selectedRef.current = selectedSiteId

  // A stable key for the current result set — changes only when the parcels change, so the
  // auto-fit runs once per new search rather than on every selection.
  const resultKey = useMemo(() => items.map((i) => i.siteId).join(','), [items])

  const setData = (map: mapboxgl.Map) => {
    const src = map.getSource(PARCEL_SOURCE) as mapboxgl.GeoJSONSource | undefined
    src?.setData(toFeatureCollection(itemsRef.current, selectedRef.current))
  }

  const addLayers = (map: mapboxgl.Map) => {
    if (!map.isStyleLoaded()) return
    if (!map.getSource(PARCEL_SOURCE)) {
      map.addSource(PARCEL_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
    }
    const beforeId = firstSymbolLayerId(map)
    if (!map.getLayer(PARCEL_FILL)) {
      map.addLayer(
        {
          id: PARCEL_FILL,
          type: 'fill',
          source: PARCEL_SOURCE,
          paint: {
            'fill-color': tierColorExpr(),
            // Selected parcel is boldly filled; the rest dim back so it stands out.
            'fill-opacity': ['case', ['get', 'selected'], 0.65, 0.22] as unknown as number,
          },
        },
        beforeId
      )
    }
    if (!map.getLayer(PARCEL_LINE)) {
      map.addLayer(
        {
          id: PARCEL_LINE,
          type: 'line',
          source: PARCEL_SOURCE,
          paint: {
            'line-color': tierColorExpr(),
            'line-width': 1.2,
            'line-opacity': ['case', ['get', 'selected'], 0, 0.85] as unknown as number,
          },
        },
        beforeId
      )
    }
    // White casing + tier ring for the selected parcel. Added ABOVE labels (no beforeId) so the
    // highlight is never occluded by basemap symbols.
    if (!map.getLayer(PARCEL_SELECTED_CASING)) {
      map.addLayer({
        id: PARCEL_SELECTED_CASING,
        type: 'line',
        source: PARCEL_SOURCE,
        filter: SELECTED_ONLY,
        paint: { 'line-color': '#ffffff', 'line-width': 6, 'line-opacity': 0.95 },
      })
    }
    if (!map.getLayer(PARCEL_SELECTED_RING)) {
      map.addLayer({
        id: PARCEL_SELECTED_RING,
        type: 'line',
        source: PARCEL_SOURCE,
        filter: SELECTED_ONLY,
        paint: { 'line-color': tierColorExpr(), 'line-width': 3 },
      })
    }
    readyRef.current = true
    setData(map)
  }

  // Initialise the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    if (!MAPBOX_TOKEN) {
      console.error('Mapbox token not found. Set NEXT_PUBLIC_MAPBOX_TOKEN.')
      return
    }
    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLES.hybrid,
      center: CANTERBURY_VIEW.center,
      zoom: CANTERBURY_VIEW.zoom,
      antialias: true,
    })
    mapRef.current = map

    const onLoad = () => addLayers(map)
    map.on('load', onLoad)
    map.on('style.load', onLoad)

    map.on('click', PARCEL_FILL, (e) => {
      const siteId = e.features?.[0]?.properties?.siteId
      if (typeof siteId === 'string') select(siteId)
    })
    map.on('mouseenter', PARCEL_FILL, () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', PARCEL_FILL, () => {
      map.getCanvas().style.cursor = ''
    })

    const resizeObserver = new ResizeObserver(() => map.resize())
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      map.remove()
      mapRef.current = null
      readyRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-feed parcels when the result set or selection changes, and frame a fresh result set once.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    setData(map)

    if (resultKey && framedKeyRef.current !== resultKey) {
      framedKeyRef.current = resultKey
      const pts = items.map((i) => i.centroid).filter((c): c is [number, number] => !!c)
      if (pts.length > 0) {
        const bounds = new mapboxgl.LngLatBounds(pts[0], pts[0])
        for (const p of pts) bounds.extend(p)
        map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 800 })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultKey, selectedSiteId])

  // Fly to the selected parcel.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current || !selectedSiteId) return
    const item = items.find((i) => i.siteId === selectedSiteId)
    if (item?.centroid) {
      map.flyTo({ center: item.centroid, zoom: Math.max(map.getZoom(), 14), duration: 700 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSiteId])

  return <div ref={containerRef} className="absolute inset-0 h-full w-full" />
}
