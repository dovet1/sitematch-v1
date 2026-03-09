'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

const BUA_TILESET_ID = 'dovet.drwqyy89'
const BUA_SOURCE_ID = 'bua-source'
const BUA_LAYER_ID = 'bua-fill'
const BUA_OUTLINE_LAYER_ID = 'bua-outline'
const BUA_SOURCE_LAYER = 'bua'

interface Store {
  id: string
  name: string
  lat: number
  lon: number
  town?: string | null
  postcode?: string | null
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
  filteredGssCodes?: string[]  // Optional list of BUA gsscodes to show (for company/category filtering)
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
  filteredGssCodes
}: BUAMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const popup = useRef<mapboxgl.Popup | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const pointMarker = useRef<mapboxgl.Marker | null>(null)
  const radiusCircle = useRef<string | null>(null)
  const storeMarkers = useRef<mapboxgl.Marker[]>([])

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [center?.lng || -3.5, center?.lat || 54.8],
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
      setMapLoaded(true)
    })

    return () => {
      if (map.current) {
        map.current.remove()
        map.current = null
      }
    }
  }, [])

  // Add BUA layer when map is loaded
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const addBUALayer = () => {
      if (!map.current?.isStyleLoaded()) return

      // Remove existing layers and source if they exist
      if (map.current.getLayer(BUA_OUTLINE_LAYER_ID)) {
        map.current.removeLayer(BUA_OUTLINE_LAYER_ID)
      }
      if (map.current.getLayer(BUA_LAYER_ID)) {
        map.current.removeLayer(BUA_LAYER_ID)
      }
      if (map.current.getSource(BUA_SOURCE_ID)) {
        map.current.removeSource(BUA_SOURCE_ID)
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
            ['get', 'pop'],
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

      // Add click handler
      map.current.on('click', BUA_LAYER_ID, (e) => {
        if (!e.features || e.features.length === 0) return

        const feature = e.features[0]
        const gsscode = feature.properties?.gsscode
        const name = feature.properties?.name
        const pop = feature.properties?.pop

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
                <div style="font-size: 14px; color: #64748b; margin-bottom: 4px;">
                  <strong>Population:</strong> ${pop.toLocaleString()}
                </div>
                <div style="font-size: 12px; color: #94a3b8;">
                  GSS Code: ${gsscode}
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

    if (map.current.isStyleLoaded()) {
      addBUALayer()
    } else {
      map.current.once('style.load', addBUALayer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded])

  // Update filter when population range or filtered gsscodes change
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const updateFilter = () => {
      if (!map.current?.getLayer(BUA_LAYER_ID)) {
        // Layer not ready yet, try again shortly
        setTimeout(updateFilter, 50)
        return
      }

      try {
        // Build filter conditions
        const filterConditions: any[] = [
          'all',
          ['>=', ['get', 'pop'], minPopulation],
          ['<=', ['get', 'pop'], maxPopulation]
        ]

        // If we have filtered gsscodes (from company/category filters), add them to the filter
        if (filteredGssCodes && filteredGssCodes.length > 0) {
          // Use 'in' filter to show only BUAs with gsscodes in the list
          filterConditions.push(['in', ['get', 'gsscode'], ['literal', filteredGssCodes]])
        }

        map.current.setFilter(BUA_LAYER_ID, filterConditions)
        map.current.setFilter(BUA_OUTLINE_LAYER_ID, filterConditions)
      } catch (error) {
        console.error('Error updating filter:', error)
      }
    }

    updateFilter()
  }, [minPopulation, maxPopulation, filteredGssCodes, mapLoaded])

  // Fly to location when center changes
  useEffect(() => {
    if (!map.current || !mapLoaded || !center) return

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

  // Handle store markers in Assess Area mode
  useEffect(() => {
    if (!map.current || !mapLoaded || mode !== 'assess-area') {
      // Remove all store markers if not in assess-area mode
      storeMarkers.current.forEach(marker => marker.remove())
      storeMarkers.current = []
      return
    }

    // Remove existing store markers
    storeMarkers.current.forEach(marker => marker.remove())
    storeMarkers.current = []

    // Add new store markers
    if (stores && stores.length > 0) {
      stores.forEach(store => {
        // Create custom marker element (smaller pin)
        const el = document.createElement('div')
        el.className = 'store-marker'
        el.style.width = '20px'
        el.style.height = '20px'
        el.style.borderRadius = '50% 50% 50% 0'
        el.style.background = '#10b981' // emerald-500
        el.style.border = '2px solid white'
        el.style.transform = 'rotate(-45deg)'
        el.style.cursor = 'pointer'
        el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)'

        // Create popup
        const popup = new mapboxgl.Popup({
          offset: 25,
          closeButton: false,
          className: 'store-popup'
        }).setHTML(`
          <div style="padding: 4px;">
            <div style="font-weight: 600; font-size: 13px; margin-bottom: 2px;">${store.name}</div>
            ${store.town ? `<div style="font-size: 11px; color: #6b7280;">${store.town}${store.postcode ? ` • ${store.postcode}` : ''}</div>` : ''}
          </div>
        `)

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([store.lon, store.lat])
          .setPopup(popup)
          .addTo(map.current!)

        // Prevent map click when clicking on store marker, but allow popup to show
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          marker.togglePopup()
        })

        storeMarkers.current.push(marker)
      })
    }

    return () => {
      storeMarkers.current.forEach(marker => marker.remove())
      storeMarkers.current = []
    }
  }, [stores, mode, mapLoaded])

  return (
    <div className={`relative ${className}`}>
      <div ref={mapContainer} className="w-full h-full" />
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
