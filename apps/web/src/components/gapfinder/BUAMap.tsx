'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { formatPopulation } from '@/lib/format-population'
import { getFasciaMarkerColor } from '@/lib/sitesketcher/colors'
import type { Store, ViewportStore } from '@/lib/stores'
import type { TargetWithMetadata } from '@/lib/filter-utils'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

const BUA_TILESET_ID = 'dovet.ciilxjuj' // Updated tileset with pop_final field
const BUA_SOURCE_ID = 'bua-source'
const BUA_LAYER_ID = 'bua-fill'
const BUA_OUTLINE_LAYER_ID = 'bua-outline'
const BUA_SOURCE_LAYER = 'bua'

// Track the source of store marker updates to control auto-fit behavior
export enum StoreUpdateSource {
  USER_PAN = 'user_pan',       // User manually moved map - NO auto-fit
  FILTER_CHANGE = 'filter',     // Filters changed - DO auto-fit
  SIDEBAR_CLICK = 'sidebar',    // Clicked BUA from sidebar - NO auto-fit (already flying)
  INITIAL_LOAD = 'initial'      // First load - DO auto-fit
}

function buildBUAFilterExpression(
  minPopulation: number,
  maxPopulation: number,
  filteredGssCodes?: string[]
) {
  const pop = ['coalesce', ['get', 'pop_final'], ['get', 'pop']] as const
  const filterConditions: any[] = [
    'all',
    ['>=', pop, minPopulation],  // Simplified - removed special <5000 handling
    ['<=', pop, maxPopulation]
  ]

  if (filteredGssCodes && filteredGssCodes.length > 0) {
    filterConditions.push(['in', ['get', 'gsscode'], ['literal', filteredGssCodes]])
  }

  return filterConditions
}

// SVG icon constants for popups
const MAP_PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`

const STORE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7"/></svg>`

const REQUIREMENT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`

/**
 * Generate premium BUA popup HTML with gradient header and icon
 */
function generateBUAPopupHTML(name: string, population: string): string {
  // Escape HTML to prevent XSS
  const escapedName = name.replace(/[<>&"']/g, (c) => {
    const escapeMap: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;',
      "'": '&#39;'
    }
    return escapeMap[c] || c
  })

  const escapedPopulation = population.replace(/[<>&"']/g, (c) => {
    const escapeMap: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;',
      "'": '&#39;'
    }
    return escapeMap[c] || c
  })

  return `
    <div style="display: flex; flex-direction: column; width: 100%;">
      <div style="background: linear-gradient(135deg, #f3f0ff 0%, #ede9fe 100%); padding: 16px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #e9d5ff;">
        <div style="background: linear-gradient(135deg, #6F5AFF 0%, #8b5cf6 100%); border-radius: 8px; padding: 10px; display: flex; box-shadow: 0 4px 12px rgba(111, 90, 255, 0.25);">
          <div style="color: white; display: flex;">${MAP_PIN_SVG}</div>
        </div>
        <h3 style="margin: 0; font-size: 18px; font-weight: 700; color: #1e293b; line-height: 1.3; letter-spacing: -0.025em; flex: 1;">${escapedName}</h3>
      </div>
      <div style="padding: 16px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 14px; font-weight: 600; color: #6b7280;">Population:</span>
          <span style="font-size: 16px; font-weight: 700; color: #6F5AFF;">${escapedPopulation}</span>
        </div>
      </div>
    </div>
  `
}

/**
 * Generate premium store marker popup HTML with color-coded icon
 */
function generateStorePopupHTML(
  storeName: string,
  address: string,
  fasciaColor: string
): string {
  // Escape HTML to prevent XSS
  const escapedName = storeName.replace(/[<>&"']/g, (c) => {
    const escapeMap: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;',
      "'": '&#39;'
    }
    return escapeMap[c] || c
  })

  const escapedAddress = address.replace(/[<>&"']/g, (c) => {
    const escapeMap: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;',
      "'": '&#39;'
    }
    return escapeMap[c] || c
  })

  return `
    <div style="display: flex; flex-direction: column; width: 100%;">
      <div style="background: linear-gradient(135deg, #fafaf9 0%, #f5f5f4 100%); padding: 12px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #e7e5e4;">
        <div style="background: ${fasciaColor}; border-radius: 6px; padding: 8px; display: flex; box-shadow: 0 2px 8px ${fasciaColor}40;">
          <div style="color: white; display: flex;">${STORE_SVG}</div>
        </div>
        <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: #1e293b; line-height: 1.3; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapedName}</h3>
      </div>
      ${address ? `<div style="padding: 12px;"><div style="font-size: 13px; color: #6b7280; line-height: 1.5;">${escapedAddress}</div></div>` : ''}
    </div>
  `
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  return text.replace(/[<>&"']/g, (c) => {
    const escapeMap: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;',
      "'": '&#39;'
    }
    return escapeMap[c] || c
  })
}

/**
 * Generate requirement location popup HTML
 */
function generateRequirementPopupHTML(location: {
  companyName: string
  title: string
  listingType: string
  placeName: string
}): string {
  const listingTypeLabel = location.listingType === 'commercial' ? 'Commercial' : 'Residential'

  return `
    <div style="display: flex; flex-direction: column; width: 100%;">
      <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 12px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #fcd34d;">
        <div style="background: #f59e0b; border-radius: 6px; padding: 8px; display: flex; box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);">
          <div style="color: white; display: flex;">${REQUIREMENT_SVG}</div>
        </div>
        <div style="flex: 1;">
          <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: #1e293b; line-height: 1.3;">
            ${escapeHtml(location.companyName)}
          </h3>
          <p style="margin: 0; margin-top: 2px; font-size: 11px; color: #78716c;">
            ${escapeHtml(listingTypeLabel)}
          </p>
        </div>
      </div>
      <div style="padding: 12px;">
        <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 500; color: #1e293b;">
          ${escapeHtml(location.title)}
        </p>
        <p style="margin: 0; font-size: 12px; color: #57534e;">
          ${escapeHtml(location.placeName)}
        </p>
      </div>
    </div>
  `
}

interface BUAMapProps {
  center?: { lat: number; lng: number }
  minPopulation: number
  maxPopulation: number
  onBUAClick?: (gsscode: string, name: string, pop: number) => void
  className?: string
  // Assess Area mode props
  mode?: 'find-gaps' | 'assess-area'
  selectedPoint?: { lat: number; lng: number } | null
  onPointSelected?: (point: { lat: number; lng: number }) => void
  radiusMeters?: number
  stores?: Store[]  // Stores to display as markers in Assess Area mode
  selectedBUAGsscode?: string | null
  sidebarSelectionNonce?: number
  filteredGssCodes?: string[]  // List of BUA gsscodes to show (ALL matching gsscodes, no limit)
  includedStores?: ViewportStore[]  // Green pins from has filters
  excludedStores?: ViewportStore[]  // Red pins from has_not filters
  proximityIncludedStores?: ViewportStore[]  // Green pins from has_within filters
  proximityExcludedStores?: ViewportStore[]  // Red pins from has_not_within filters
  targetBadgeMapping?: TargetWithMetadata[]
  onViewportChange?: (bounds: { minLat: number; minLon: number; maxLat: number; maxLon: number }) => void
  storeUpdateSource?: StoreUpdateSource  // NEW: Track why stores changed
  companiesVisibility?: Record<string, boolean>
  categoriesVisibility?: Record<string, boolean>
  requirementLocations?: Array<{
    id: string
    listingId: string
    companyName: string
    title: string
    listingType: string
    placeName: string
    formattedAddress: string
    coordinates: { lat: number; lng: number }
  }>
}

export function BUAMap({
  center,
  minPopulation,
  maxPopulation,
  onBUAClick,
  className = '',
  mode = 'find-gaps',
  selectedPoint = null,
  onPointSelected,
  radiusMeters = 5000,
  stores = [],
  selectedBUAGsscode = null,
  sidebarSelectionNonce = 0,
  filteredGssCodes,
  includedStores = [],
  excludedStores = [],
  proximityIncludedStores = [],
  proximityExcludedStores = [],
  targetBadgeMapping = [],
  onViewportChange,
  storeUpdateSource = StoreUpdateSource.USER_PAN,
  companiesVisibility = {},
  categoriesVisibility = {},
  requirementLocations = []
}: BUAMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const popup = useRef<mapboxgl.Popup | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const pointMarker = useRef<mapboxgl.Marker | null>(null)
  const radiusCircle = useRef<string | null>(null)
  const storeMarkers = useRef<mapboxgl.Marker[]>([])
  const requirementMarkers = useRef<mapboxgl.Marker[]>([])
  const isAutoFitting = useRef(false)
  const skipNextCenterFlyTo = useRef(false)
  const lastHandledSidebarSelection = useRef(0)
  const buaFilterRef = useRef<any[] | null>(null)


  const applyBUAFilters = () => {
    if (!map.current || !buaFilterRef.current) return
    if (!map.current.getLayer(BUA_LAYER_ID) || !map.current.getLayer(BUA_OUTLINE_LAYER_ID)) return

    try {
      map.current.setFilter(BUA_LAYER_ID, buaFilterRef.current)
      map.current.setFilter(BUA_OUTLINE_LAYER_ID, buaFilterRef.current)
    } catch (error) {
      console.error('Failed to apply BUA filters:', error)
    }
  }

  // Initialize map ONCE (not dependent on center - center changes should just pan the map)
  useEffect(() => {
    if (!mapContainer.current || map.current) return

    const initialCenter = center || { lng: -3.5, lat: 54.8 }

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [initialCenter.lng, initialCenter.lat],
      zoom: center ? 11 : 6,
      minZoom: 4,
      maxZoom: 18
    })

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({ showCompass: true }),
      'top-right'
    )

    map.current.on('load', () => {
      // Force map resize to ensure correct dimensions
      if (map.current) {
        map.current.resize()
      }
      setMapLoaded(true)
    })

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, []) // Empty dependency - only run ONCE on mount

  // Track viewport changes (separate from initialization to avoid re-creating map)
  useEffect(() => {
    if (!map.current || !mapLoaded || !onViewportChange) return

    const handleMoveEnd = () => {
      if (map.current && !isAutoFitting.current) {
        const bounds = map.current.getBounds()
        if (bounds) {
          onViewportChange({
            minLat: bounds.getSouth(),
            minLon: bounds.getWest(),
            maxLat: bounds.getNorth(),
            maxLon: bounds.getEast()
          })
        }
      }
    }

    // Initial viewport
    if (map.current) {
      const bounds = map.current.getBounds()
      if (bounds) {
        onViewportChange({
          minLat: bounds.getSouth(),
          minLon: bounds.getWest(),
          maxLat: bounds.getNorth(),
          maxLon: bounds.getEast()
        })
      }
    }

    map.current.on('moveend', handleMoveEnd)

    return () => {
      if (map.current) {
        map.current.off('moveend', handleMoveEnd)
      }
    }
  }, [mapLoaded, onViewportChange])

  // Add ResizeObserver for ongoing stability
  useEffect(() => {
    if (!map.current || !mapLoaded || !mapContainer.current) return

    const resizeObserver = new ResizeObserver(() => {
      if (map.current) {
        map.current.resize()
      }
    })

    resizeObserver.observe(mapContainer.current)

    return () => {
      resizeObserver.disconnect()
    }
  }, [mapLoaded])

  // Add BUA layer when map is loaded
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const addBUALayer = () => {
      if (!map.current?.isStyleLoaded()) return

      // Only add layers if they don't exist (defensive check)
      if (map.current.getSource(BUA_SOURCE_ID)) {
        return // Layers already exist
      }

      // Add vector tileset source
      map.current.addSource(BUA_SOURCE_ID, {
        type: 'vector',
        url: `mapbox://${BUA_TILESET_ID}`
      })

      // Add fill layer with population-based colors
      map.current.addLayer({
        id: BUA_LAYER_ID,
        type: 'fill',
        source: BUA_SOURCE_ID,
        'source-layer': BUA_SOURCE_LAYER,
        paint: {
          'fill-color': [
            'step',
            ['coalesce', ['get', 'pop_final'], ['get', 'pop']],
            '#eff6ff', // <1k: very light blue
            1000, '#dbeafe', // 1k-5k
            5000, '#bfdbfe', // 5k-10k
            10000, '#93c5fd', // 10k-50k
            50000, '#60a5fa', // 50k-100k
            100000, '#3b82f6', // 100k-500k
            500000, '#2563eb', // 500k-1M
            1000000, '#1d4ed8' // 1M+
          ],
          'fill-opacity': 0.7
        }
      })

      // Add outline layer
      map.current.addLayer({
        id: BUA_OUTLINE_LAYER_ID,
        type: 'line',
        source: BUA_SOURCE_ID,
        'source-layer': BUA_SOURCE_LAYER,
        paint: {
          'line-color': '#1e293b',
          'line-width': 0.5
        }
      })

      applyBUAFilters()

      // Add click handler (but only once - check if already exists)
      const existingHandler = (map.current as any)._buaClickHandlerAdded
      if (!existingHandler) {
        (map.current as any)._buaClickHandlerAdded = true

        map.current.on('click', BUA_LAYER_ID, (e) => {
          if (!e.features || e.features.length === 0) return

          // Check if click originated from a marker - if so, ignore this BUA click
          const target = e.originalEvent.target as HTMLElement
          if (target && (target.closest('.simple-store-marker') || target.closest('.requirement-location-marker'))) {
            return
          }

          const feature = e.features[0]
          const gsscode = feature.properties?.gsscode
          const name = feature.properties?.name
          const pop = feature.properties?.pop
          const pop_final = feature.properties?.pop_final

          if (gsscode && name && pop !== undefined) {
            // Show popup
            if (popup.current) {
              popup.current.remove()
            }

            popup.current = new mapboxgl.Popup({
              closeButton: true,
              closeOnClick: true,
              maxWidth: '320px',
              className: 'premium-bua-popup'
            })
              .setLngLat(e.lngLat)
              .setHTML(generateBUAPopupHTML(name, formatPopulation(pop_final)))
              .addTo(map.current!)

            // Call optional callback
            if (onBUAClick) {
              onBUAClick(gsscode, name, pop)
            }
          }
        })

        // Change cursor on hover
        map.current.on('mouseenter', BUA_LAYER_ID, () => {
          if (map.current) {
            map.current.getCanvas().style.cursor = 'pointer'
          }
        })

        map.current.on('mouseleave', BUA_LAYER_ID, () => {
          if (map.current) {
            map.current.getCanvas().style.cursor = ''
          }
        })
      }
    }

    // Add layers initially
    if (map.current.isStyleLoaded()) {
      addBUALayer()
    }

    // Only recreate layers on style reload (when Mapbox resets the style)
    map.current.on('style.load', addBUALayer)

    return () => {
      if (map.current) {
        map.current.off('style.load', addBUALayer)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded])

  // Update filter when population range or filtered gsscodes change
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    buaFilterRef.current = buildBUAFilterExpression(minPopulation, maxPopulation, filteredGssCodes)

    const updateFilter = () => {
      if (!map.current?.getLayer(BUA_LAYER_ID)) {
        setTimeout(updateFilter, 50)
        return
      }

      try {
        applyBUAFilters()
      } catch (error) {
        console.error('BUA filter failed:', error)
      }
    }

    updateFilter()
  }, [minPopulation, maxPopulation, filteredGssCodes, mapLoaded])

  // Handle explicit sidebar-driven BUA navigation
  useEffect(() => {
    if (!map.current || !mapLoaded || !center || !selectedBUAGsscode) return
    if (sidebarSelectionNonce === 0 || lastHandledSidebarSelection.current === sidebarSelectionNonce) return

    lastHandledSidebarSelection.current = sidebarSelectionNonce
    skipNextCenterFlyTo.current = true

    if (popup.current) {
      popup.current.remove()
      popup.current = null
    }

    map.current.flyTo({
      center: [center.lng, center.lat],
      zoom: 12,
      duration: 1500,
      essential: true
    })
  }, [center, mapLoaded, selectedBUAGsscode, sidebarSelectionNonce])

  // Fly to location when center changes
  useEffect(() => {
    if (!map.current || !mapLoaded || !center) return

    if (skipNextCenterFlyTo.current) {
      skipNextCenterFlyTo.current = false
      return
    }

    // Close existing popup
    if (popup.current) {
      popup.current.remove()
      popup.current = null
    }

    map.current.flyTo({
      center: [center.lng, center.lat],
      zoom: 12,
      duration: 1500,
      essential: true
    })
  }, [center, mapLoaded])

  // Handle Assess Area mode - map click for point selection
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const handleMapClick = (e: mapboxgl.MapMouseEvent) => {
      if (mode === 'assess-area' && onPointSelected) {
        onPointSelected({ lat: e.lngLat.lat, lng: e.lngLat.lng })
      }
    }

    // Change cursor style based on mode
    if (mode === 'assess-area') {
      if (map.current.getCanvas()) {
        map.current.getCanvas().style.cursor = 'crosshair'
      }
      map.current.on('click', handleMapClick)
    } else {
      if (map.current.getCanvas()) {
        map.current.getCanvas().style.cursor = ''
      }
    }

    return () => {
      if (map.current) {
        map.current.off('click', handleMapClick)
      }
    }
  }, [mode, mapLoaded, onPointSelected])

  // Handle selected point marker and radius circle
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    // Remove existing marker and circle
    if (pointMarker.current) {
      pointMarker.current.remove()
      pointMarker.current = null
    }
    if (radiusCircle.current && map.current.getLayer(radiusCircle.current)) {
      map.current.removeLayer(radiusCircle.current)
      map.current.removeSource(radiusCircle.current)
      radiusCircle.current = null
    }

    // Add new marker and circle if point is selected
    if (selectedPoint && mode === 'assess-area') {
      // Add marker
      pointMarker.current = new mapboxgl.Marker({
        color: '#8b5cf6' // violet-500
      })
        .setLngLat([selectedPoint.lng, selectedPoint.lat])
        .addTo(map.current)

      // Add radius circle
      const radiusLayerId = 'radius-circle'
      radiusCircle.current = radiusLayerId

      // Create circle GeoJSON
      const center = [selectedPoint.lng, selectedPoint.lat]
      const radiusInKm = radiusMeters / 1000
      const points = 64
      const coords = {
        latitude: selectedPoint.lat,
        longitude: selectedPoint.lng
      }

      const ret = []
      const distanceX = radiusInKm / (111.320 * Math.cos((coords.latitude * Math.PI) / 180))
      const distanceY = radiusInKm / 110.574

      for (let i = 0; i < points; i++) {
        const theta = (i / points) * (2 * Math.PI)
        const x = distanceX * Math.cos(theta)
        const y = distanceY * Math.sin(theta)
        ret.push([coords.longitude + x, coords.latitude + y])
      }
      ret.push(ret[0]) // Close the circle

      map.current.addSource(radiusLayerId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [ret]
          },
          properties: {}
        }
      })

      map.current.addLayer({
        id: radiusLayerId,
        type: 'fill',
        source: radiusLayerId,
        paint: {
          'fill-color': '#8b5cf6',
          'fill-opacity': 0.1
        }
      })

      map.current.addLayer({
        id: `${radiusLayerId}-outline`,
        type: 'line',
        source: radiusLayerId,
        paint: {
          'line-color': '#8b5cf6',
          'line-width': 2,
          'line-opacity': 0.6
        }
      })

      // Fly to the selected point
      map.current.flyTo({
        center: [selectedPoint.lng, selectedPoint.lat],
        zoom: radiusMeters > 15000 ? 10 : radiusMeters > 8000 ? 11 : 12,
        duration: 1000
      })
    }

    return () => {
      if (pointMarker.current) {
        pointMarker.current.remove()
      }
      if (radiusCircle.current && map.current) {
        if (map.current.getLayer(radiusCircle.current)) {
          map.current.removeLayer(radiusCircle.current)
        }
        if (map.current.getLayer(`${radiusCircle.current}-outline`)) {
          map.current.removeLayer(`${radiusCircle.current}-outline`)
        }
        if (map.current.getSource(radiusCircle.current)) {
          map.current.removeSource(radiusCircle.current)
        }
      }
    }
  }, [selectedPoint, radiusMeters, mode, mapLoaded])

  // CRITICAL VISIBILITY RULE: A marker is visible if at least one of its matched targets is still visible
  const isStoreVisible = useCallback((
    store: Store | ViewportStore,
    companiesVis: Record<string, boolean>,
    categoriesVis: Record<string, boolean>
  ): boolean => {
    // For viewport stores, use matchedTargetIds to determine visibility
    if ('matchedTargetIds' in store && store.matchedTargetIds) {
      // Check if at least ONE matched target is visible
      const hasVisibleMatch = store.matchedTargetIds.some(targetId => {
        // Check if this target is hidden in either visibility map
        const isFasciaHidden = companiesVis[targetId] === false
        const isCategoryHidden = categoriesVis[targetId] === false

        // Target is visible if NOT explicitly hidden
        return !isFasciaHidden && !isCategoryHidden
      })

      return hasVisibleMatch
    }

    // Fallback for assess-area stores (no matchedTargetIds)
    // Check fascia visibility only
    if (store.fascia_id && companiesVis[store.fascia_id] === false) {
      return false
    }

    return true  // Default visible
  }, [])

  const createSimpleStoreMarker = (
    store: Store | ViewportStore,
    color: string,
    badgeLabel?: string
  ): mapboxgl.Marker => {
    const el = document.createElement('div')
    el.className = 'simple-store-marker'
    const hasBadge = Boolean(badgeLabel)
    const markerText = badgeLabel || ''
    const markerWidth = hasBadge
      ? `${Math.max(24, markerText.length * 8 + 12)}px`
      : '12px'

    el.style.width = markerWidth
    el.style.height = hasBadge ? '24px' : '12px'
    el.style.borderRadius = '9999px'
    el.style.backgroundColor = color
    el.style.border = '2px solid white'
    el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.25)'
    el.style.cursor = 'pointer'
    if (hasBadge) {
      el.style.display = 'flex'
      el.style.alignItems = 'center'
      el.style.justifyContent = 'center'
      el.style.color = '#ffffff'
      el.style.fontSize = '12px'
      el.style.fontWeight = '700'
      el.style.lineHeight = '1'
      el.textContent = markerText
    }

    const address = [store.address_line_1, store.town, store.postcode]
      .filter(Boolean)
      .join(', ')

    const popup = new mapboxgl.Popup({
      offset: 15,
      className: 'premium-store-popup'
    }).setHTML(generateStorePopupHTML(store.name || 'Store', address, color))

    return new mapboxgl.Marker({ element: el })
      .setLngLat([store.lon, store.lat])
      .setPopup(popup)
  }

  const createRequirementMarker = (
    location: {
      id: string
      listingId: string
      companyName: string
      title: string
      listingType: string
      placeName: string
      formattedAddress: string
      coordinates: { lat: number; lng: number }
    },
    color: string
  ): mapboxgl.Marker => {
    const el = document.createElement('div')
    el.className = 'requirement-location-marker'

    el.style.width = '16px'
    el.style.height = '16px'
    el.style.backgroundColor = color
    el.style.borderRadius = '9999px'
    el.style.border = '1px solid white'
    el.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.3)'
    el.style.cursor = 'pointer'

    const popup = new mapboxgl.Popup({
      offset: 15,
      className: 'premium-store-popup'
    }).setHTML(generateRequirementPopupHTML(location))

    return new mapboxgl.Marker({ element: el })
      .setLngLat([location.coordinates.lng, location.coordinates.lat])
      .setPopup(popup)
  }

  // Handle store markers for both modes
  useEffect(() => {
    if (!map.current || !mapLoaded) {
      storeMarkers.current.forEach(marker => marker.remove())
      storeMarkers.current = []
      return
    }

    const addMarkersWhenReady = () => {
      if (!mapContainer.current || !map.current) return

      // Verify container has non-zero dimensions
      const containerRect = mapContainer.current.getBoundingClientRect()
      if (containerRect.width === 0 || containerRect.height === 0) {
        requestAnimationFrame(addMarkersWhenReady)
        return
      }

      // Verify canvas matches container (accounting for devicePixelRatio)
      const canvas = map.current.getCanvas()
      const expectedCanvasWidth = containerRect.width * window.devicePixelRatio
      const widthRatio = canvas.width / expectedCanvasWidth

      if (widthRatio < 0.9 || widthRatio > 1.1) {
        // Canvas size mismatch - force resize and retry
        map.current.resize()
        requestAnimationFrame(addMarkersWhenReady)
        return
      }

      // Now safe to add markers - dimensions are verified
      // Remove existing store markers
      storeMarkers.current.forEach(marker => marker.remove())
      storeMarkers.current = []

      const newMarkers: mapboxgl.Marker[] = []
      const greenStores = mode === 'assess-area'
        ? stores
        : [...includedStores, ...proximityIncludedStores]
      const redStores = mode === 'find-gaps'
        ? [...excludedStores, ...proximityExcludedStores]
        : []

      // Apply visibility filtering ONLY in find-gaps mode
      const visibleGreenStores = mode === 'find-gaps'
        ? greenStores.filter(store => isStoreVisible(store, companiesVisibility, categoriesVisibility))
        : greenStores

      const visibleRedStores = mode === 'find-gaps'
        ? redStores.filter(store => isStoreVisible(store, companiesVisibility, categoriesVisibility))
        : redStores

      // Update badge label generation to only include visible targets
      const getBadgeLabel = (store: ViewportStore): string | undefined => {
        // Use displayTargetIds instead of matchedTargetIds for badge lookup
        if (!store.displayTargetIds || store.displayTargetIds.length === 0) {
          return undefined
        }

        // Filter display targets to only include visible ones
        const visibleDisplayTargets = store.displayTargetIds.filter(targetId => {
          const isFasciaHidden = companiesVisibility[targetId] === false
          const isCategoryHidden = categoriesVisibility[targetId] === false
          return !isFasciaHidden && !isCategoryHidden
        })

        if (visibleDisplayTargets.length === 0) {
          return undefined
        }

        const badgeNumbers = targetBadgeMapping
          .filter(target => visibleDisplayTargets.includes(target.targetId))
          .map(target => target.badgeNumber)
          .sort((a, b) => a - b)

        if (badgeNumbers.length === 0) {
          return undefined
        }

        return badgeNumbers.join(',')
      }

      if (mode === 'assess-area') {
        visibleGreenStores.forEach(store => {
          const marker = createSimpleStoreMarker(store, getFasciaMarkerColor(store.fascia_id))
          marker.addTo(map.current!)
          newMarkers.push(marker)
        })
      } else {
        visibleGreenStores.forEach(store => {
          const marker = createSimpleStoreMarker(store, getFasciaMarkerColor(store.fascia_id), getBadgeLabel(store))
          marker.addTo(map.current!)
          newMarkers.push(marker)
        })

        visibleRedStores.forEach(store => {
          const marker = createSimpleStoreMarker(store, getFasciaMarkerColor(store.fascia_id), getBadgeLabel(store))
          marker.addTo(map.current!)
          newMarkers.push(marker)
        })
      }

      storeMarkers.current = newMarkers

      // Conditional auto-fit based on update source
      // Only auto-fit when: filter changes or initial load (NOT on user pans or sidebar clicks)
      const shouldAutoFit = mode === 'find-gaps' &&
        (visibleGreenStores.length > 0 || visibleRedStores.length > 0) &&
        (storeUpdateSource === StoreUpdateSource.FILTER_CHANGE ||
         storeUpdateSource === StoreUpdateSource.INITIAL_LOAD)

      if (shouldAutoFit) {
        const markerBounds = new mapboxgl.LngLatBounds()

        visibleGreenStores.concat(visibleRedStores).forEach((store) => {
          markerBounds.extend([store.lon, store.lat])
        })

        isAutoFitting.current = true

        map.current.fitBounds(markerBounds, {
          padding: { top: 50, bottom: 50, left: 50, right: 50 },
          maxZoom: 12,
          duration: 1000
        })

        window.setTimeout(() => {
          isAutoFitting.current = false
        }, 1100)
      }
    }

    // Start the verification cycle
    requestAnimationFrame(addMarkersWhenReady)

    return () => {
      storeMarkers.current.forEach(marker => marker.remove())
      storeMarkers.current = []
    }
  }, [stores, includedStores, excludedStores, proximityIncludedStores, proximityExcludedStores, mode, mapLoaded, targetBadgeMapping, storeUpdateSource, companiesVisibility, categoriesVisibility, isStoreVisible])

  // Handle requirement location markers
  useEffect(() => {
    // Clean up existing markers
    requirementMarkers.current.forEach(marker => marker.remove())
    requirementMarkers.current = []

    if (!map.current || !mapLoaded || !requirementLocations || requirementLocations.length === 0) {
      return
    }

    const color = '#8b5cf6' // violet-500
    const newMarkers: mapboxgl.Marker[] = []

    requirementLocations.forEach(location => {
      const marker = createRequirementMarker(location, color)
      marker.addTo(map.current!)
      newMarkers.push(marker)
    })

    requirementMarkers.current = newMarkers

    return () => {
      requirementMarkers.current.forEach(marker => marker.remove())
      requirementMarkers.current = []
    }
  }, [requirementLocations, mapLoaded])

  return (
    <div className={`relative ${className}`}>
      <div ref={mapContainer} className="w-full h-full" style={{ position: 'relative' }} />
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading map...</p>
          </div>
        </div>
      )}
      {requirementLocations && requirementLocations.length > 0 && (
        <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-3">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-violet-500 rounded-full border border-white shadow-sm"></div>
            <p className="text-xs text-gray-700">
              Requirements
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
