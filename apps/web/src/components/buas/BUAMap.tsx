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

interface BUAMapProps {
  center?: { lat: number; lng: number }
  minPopulation: number
  maxPopulation: number
  onBUAClick?: (gsscode: string, name: string, pop: number) => void
  className?: string
}

export function BUAMap({
  center,
  minPopulation,
  maxPopulation,
  onBUAClick,
  className = ''
}: BUAMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const popup = useRef<mapboxgl.Popup | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [center?.lng || -3.5, center?.lat || 54.8],
      zoom: center ? 10 : 5,
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

  // Update filter when population range changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const updateFilter = () => {
      if (!map.current?.getLayer(BUA_LAYER_ID)) {
        // Layer not ready yet, try again shortly
        setTimeout(updateFilter, 50)
        return
      }

      try {
        map.current.setFilter(BUA_LAYER_ID, [
          'all',
          ['>=', ['get', 'pop'], minPopulation],
          ['<=', ['get', 'pop'], maxPopulation]
        ])

        map.current.setFilter(BUA_OUTLINE_LAYER_ID, [
          'all',
          ['>=', ['get', 'pop'], minPopulation],
          ['<=', ['get', 'pop'], maxPopulation]
        ])
      } catch (error) {
        console.error('Error updating filter:', error)
      }
    }

    updateFilter()
  }, [minPopulation, maxPopulation, mapLoaded])

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
