'use client'

import { useEffect, useRef, useState } from 'react'
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
  storeUpdateSource = StoreUpdateSource.USER_PAN
}: BUAMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const popup = useRef<mapboxgl.Popup | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const pointMarker = useRef<mapboxgl.Marker | null>(null)
  const radiusCircle = useRef<string | null>(null)
  const storeMarkers = useRef<mapboxgl.Marker[]>([])
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
      style: 'mapbox://styles/mapbox/light-v11',
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
              maxWidth: '300px'
            })
              .setLngLat(e.lngLat)
              .setHTML(`
                <div style="padding: 8px;">
                  <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1e293b;">${name}</h3>
                  <div style="font-size: 14px; color: #64748b;">
                    <strong>Population:</strong> ${formatPopulation(pop_final)}
                  </div>
                </div>
              `)
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

    const badgeLine = badgeLabel
      ? `<div style="font-size: 11px; color: #374151; margin-top: 4px;">Marker: ${badgeLabel}</div>`
      : ''

    const popup = new mapboxgl.Popup({
      offset: 15
    }).setHTML(`
      <div style="padding: 4px;">
        <div style="font-weight: 600; font-size: 13px; margin-bottom: 2px;">${store.name || 'Store'}</div>
        ${address ? `<div style="font-size: 11px; color: #6b7280;">${address}</div>` : ''}
        ${badgeLine}
      </div>
    `)

    return new mapboxgl.Marker({ element: el })
      .setLngLat([store.lon, store.lat])
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
      const getBadgeLabel = (store: ViewportStore): string | undefined => {
        if (!store.matchedTargetIds || store.matchedTargetIds.length === 0) {
          return undefined
        }

        const badgeNumbers = targetBadgeMapping
          .filter(target => store.matchedTargetIds?.includes(target.targetId))
          .map(target => target.badgeNumber)
          .sort((a, b) => a - b)

        if (badgeNumbers.length === 0) {
          return undefined
        }

        return badgeNumbers.join(',')
      }

      if (mode === 'assess-area') {
        greenStores.forEach(store => {
          const marker = createSimpleStoreMarker(store, getFasciaMarkerColor(store.fascia_id))
          marker.addTo(map.current!)
          newMarkers.push(marker)
        })
      } else {
        greenStores.forEach(store => {
          const marker = createSimpleStoreMarker(store, getFasciaMarkerColor(store.fascia_id), getBadgeLabel(store))
          marker.addTo(map.current!)
          newMarkers.push(marker)
        })

        redStores.forEach(store => {
          const marker = createSimpleStoreMarker(store, getFasciaMarkerColor(store.fascia_id), getBadgeLabel(store))
          marker.addTo(map.current!)
          newMarkers.push(marker)
        })
      }

      storeMarkers.current = newMarkers

      // Conditional auto-fit based on update source
      // Only auto-fit when: filter changes or initial load (NOT on user pans or sidebar clicks)
      const shouldAutoFit = mode === 'find-gaps' &&
        (greenStores.length > 0 || redStores.length > 0) &&
        (storeUpdateSource === StoreUpdateSource.FILTER_CHANGE ||
         storeUpdateSource === StoreUpdateSource.INITIAL_LOAD)

      if (shouldAutoFit) {
        const markerBounds = new mapboxgl.LngLatBounds()

        greenStores.concat(redStores).forEach((store) => {
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
  }, [stores, includedStores, excludedStores, proximityIncludedStores, proximityExcludedStores, mode, mapLoaded, targetBadgeMapping, storeUpdateSource])

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
    </div>
  )
}
