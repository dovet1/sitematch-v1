'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { X } from 'lucide-react'
import { formatPopulation } from '@/lib/format-population'
import { getFasciaMarkerColor } from '@/lib/sitesketcher/colors'
import type { Store, ViewportStore } from '@/lib/stores'
import type { TargetWithMetadata } from '@/lib/filter-utils'
import { MapLegend, type MapLegendItem } from './MapLegend'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

const BUA_TILESET_ID = 'dovet.ciilxjuj' // Updated tileset with pop_final field
const BUA_SOURCE_ID = 'bua-source'
const BUA_LAYER_ID = 'bua-fill'
const BUA_OUTLINE_LAYER_ID = 'bua-outline'
const BUA_SOURCE_LAYER = 'bua'
const REQUIREMENT_SOURCE_ID = 'requirement-locations-source'
const REQUIREMENT_CLUSTER_LAYER_ID = 'requirement-locations-clusters'
const REQUIREMENT_CLUSTER_COUNT_LAYER_ID = 'requirement-locations-cluster-count'
const REQUIREMENT_POINT_LAYER_ID = 'requirement-locations-point'

function isValidCoordinate(point?: { lat: number; lng: number } | null): point is { lat: number; lng: number } {
  return !!point && Number.isFinite(point.lat) && Number.isFinite(point.lng)
}

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
      <div style="background: linear-gradient(135deg, #fafaf9 0%, #f5f5f4 100%); padding: 12px 46px 12px 12px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #e7e5e4;">
        <div style="background: ${fasciaColor}; border-radius: 6px; padding: 8px; display: flex; box-shadow: 0 2px 8px ${fasciaColor}40;">
          <div style="color: white; display: flex;">${STORE_SVG}</div>
        </div>
        <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: #1e293b; line-height: 1.3; flex: 1; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">${escapedName}</h3>
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

const LOCATION_SUFFIXES_TO_REMOVE = new Set([
  'united kingdom',
  'uk',
  'england',
  'scotland',
  'wales'
])

export function formatRequirementLocationDisplay(
  formattedAddress?: string | null,
  placeName?: string | null
): string {
  const source = (formattedAddress || placeName || '').trim()
  if (!source) {
    return ''
  }

  const parts = source
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .filter(part => !LOCATION_SUFFIXES_TO_REMOVE.has(part.toLowerCase()))

  return parts.slice(0, 2).join(', ')
}

export function isStoreMarkerEventTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('.simple-store-marker'))
}

/**
 * Generate requirement location popup HTML
 */
function generateRequirementPopupHTML(location: {
  companyName: string
  listingType: string
  placeName: string
  formattedAddress?: string
}): string {
  const listingTypeLabel = location.listingType === 'commercial' ? 'Commercial' : 'Residential'
  const displayLocation = formatRequirementLocationDisplay(location.formattedAddress, location.placeName)

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
        ${displayLocation ? `<p style="margin: 0; font-size: 12px; color: #57534e;">${escapeHtml(displayLocation)}</p>` : ''}
      </div>
    </div>
  `
}

/**
 * Extract visible fascias from actual stores on the map for legend display
 * Uses store data to determine which fascias and badge numbers are actually shown
 */
function extractVisibleFascias(
  targetBadgeMapping: TargetWithMetadata[],
  companiesVisibility: Record<string, boolean>,
  includedStores: ViewportStore[],
  excludedStores: ViewportStore[],
  proximityIncludedStores: ViewportStore[],
  proximityExcludedStores: ViewportStore[]
): MapLegendItem[] {
  // Collect all unique fascia IDs that actually appear on stores
  const fasciaMap = new Map<string, {
    fasciaId: string
    fasciaName: string
    badgeNumbers: Set<number>
  }>()

  const allStores = [
    ...includedStores,
    ...excludedStores,
    ...proximityIncludedStores,
    ...proximityExcludedStores
  ]

  // For each store, look at its displayTargetIds and get badge numbers
  allStores.forEach(store => {
    if (!store.fascia_id) return

    const fasciaId = store.fascia_id

    // Get badge numbers from displayTargetIds
    const badgeNumbers = new Set<number>()
    let fasciaName = fasciaId // fallback to ID

    if (store.displayTargetIds) {
      store.displayTargetIds.forEach(targetId => {
        const badge = targetBadgeMapping.find(t => t.targetId === targetId)
        if (badge) {
          badgeNumbers.add(badge.badgeNumber)
          // Use the targetName from the badge mapping if it matches the fascia_id
          if (badge.targetId === fasciaId && badge.targetType === 'fascia') {
            fasciaName = badge.targetName
          }
        }
      })
    }

    if (!fasciaMap.has(fasciaId)) {
      fasciaMap.set(fasciaId, {
        fasciaId,
        fasciaName,
        badgeNumbers
      })
    } else {
      // Merge badge numbers for stores with same fascia
      const existing = fasciaMap.get(fasciaId)!
      badgeNumbers.forEach(num => existing.badgeNumbers.add(num))
    }
  })

  // Convert to legend items
  const items: MapLegendItem[] = Array.from(fasciaMap.values()).map(item => {
    // Sparse pattern: missing = visible, false = hidden
    const isVisible = companiesVisibility[item.fasciaId] !== false

    return {
      id: item.fasciaId,
      label: item.fasciaName,
      color: getFasciaMarkerColor(item.fasciaId),
      badgeNumbers: Array.from(item.badgeNumbers).sort((a, b) => a - b),
      isVisible
    }
  })

  // Sort by first badge number
  return items.sort((a, b) => {
    const aMin = a.badgeNumbers.length > 0 ? Math.min(...a.badgeNumbers) : Infinity
    const bMin = b.badgeNumbers.length > 0 ? Math.min(...b.badgeNumbers) : Infinity
    return aMin - bMin
  })
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
  centerFlyToZoom?: number
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
  onFasciaVisibilityToggle?: (fasciaId: string) => void
  assessBadgeByStoreId?: Record<string, number>  // Badge lookup for Assess Area mode
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
  centerFlyToZoom = 12,
  targetBadgeMapping = [],
  onViewportChange,
  storeUpdateSource = StoreUpdateSource.USER_PAN,
  companiesVisibility = {},
  categoriesVisibility = {},
  requirementLocations = [],
  onFasciaVisibilityToggle,
  assessBadgeByStoreId = {}
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
  const suppressNextPointSelection = useRef(false)
  const lastHandledSidebarSelection = useRef(0)
  const buaFilterRef = useRef<any[] | null>(null)
  const [requirementClusterPopup, setRequirementClusterPopup] = useState<{
    isOpen: boolean
    requirements: Array<{
      id: string
      listingId: string
      companyName: string
      title: string
      listingType: string
      placeName: string
      formattedAddress: string
    }>
    position: { x: number; y: number }
    maxHeight: number
  }>({
    isOpen: false,
    requirements: [],
    position: { x: 0, y: 0 },
    maxHeight: 400
  })


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

  const openStorePopup = useCallback((store: Store | ViewportStore, color: string) => {
    if (!map.current) return

    const address = [store.address_line_1, store.town, store.postcode]
      .filter(Boolean)
      .join(', ')

    if (popup.current) {
      popup.current.remove()
    }

    popup.current = new mapboxgl.Popup({
      offset: 15,
      className: 'premium-store-popup'
    })
      .setLngLat([store.lon, store.lat])
      .setHTML(generateStorePopupHTML(store.name || 'Store', address, color))
      .addTo(map.current)
  }, [])

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
        },
        layout: {
          visibility: mode === 'assess-area' ? 'none' : 'visible'
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
        },
        layout: {
          visibility: mode === 'assess-area' ? 'none' : 'visible'
        }
      })

      applyBUAFilters()

      // Add click handler (but only once - check if already exists)
      const existingHandler = (map.current as any)._buaClickHandlerAdded
      if (!existingHandler) {
        (map.current as any)._buaClickHandlerAdded = true

        map.current.on('click', BUA_LAYER_ID, (e) => {
          if (!e.features || e.features.length === 0) return

          // Check if click originated from a DOM marker - if so, ignore this BUA click
          const target = e.originalEvent.target as HTMLElement
          if (target && target.closest('.simple-store-marker')) {
            return
          }

          // Check if any requirement features are at this click point
          // This handles both individual requirement points and clusters
          const clickedFeatures = map.current!.queryRenderedFeatures(e.point)
          const hasRequirement = clickedFeatures.some(
            feature => feature.source === REQUIREMENT_SOURCE_ID
          )
          if (hasRequirement) {
            return // Don't show BUA popup if a requirement was clicked
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
  }, [mapLoaded, mode])

  // Hide the BUA overlay while Assess Area mode is active, but keep layers registered.
  useEffect(() => {
    if (!map.current || !mapLoaded) return
    if (!map.current.getLayer(BUA_LAYER_ID) || !map.current.getLayer(BUA_OUTLINE_LAYER_ID)) return

    const visibility = mode === 'assess-area' ? 'none' : 'visible'

    try {
      map.current.setLayoutProperty(BUA_LAYER_ID, 'visibility', visibility)
      map.current.setLayoutProperty(BUA_OUTLINE_LAYER_ID, 'visibility', visibility)
    } catch (error) {
      console.error('Failed to update BUA layer visibility:', error)
    }
  }, [mapLoaded, mode])

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
    if (!isValidCoordinate(center)) return

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
    if (!isValidCoordinate(center)) return

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
      zoom: centerFlyToZoom,
      duration: 1500,
      essential: true
    })
  }, [center, centerFlyToZoom, mapLoaded])

  // Handle Assess Area mode - map click for point selection
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const handleMapClick = (e: mapboxgl.MapMouseEvent) => {
      if (mode === 'assess-area' && onPointSelected) {
        if (suppressNextPointSelection.current) {
          suppressNextPointSelection.current = false
          return
        }

        if (isStoreMarkerEventTarget(e.originalEvent.target)) {
          return
        }

        const clickedStore = stores.reduce<{
          store: Store
          distance: number
        } | null>((closest, store) => {
          if (!Number.isFinite(store.lat) || !Number.isFinite(store.lon)) {
            return closest
          }

          const storePoint = map.current!.project([store.lon, store.lat])
          const distance = Math.hypot(storePoint.x - e.point.x, storePoint.y - e.point.y)

          if (distance > 16) {
            return closest
          }

          if (!closest || distance < closest.distance) {
            return { store, distance }
          }

          return closest
        }, null)

        if (clickedStore) {
          openStorePopup(clickedStore.store, getFasciaMarkerColor(clickedStore.store.fascia_id))
          return
        }

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
  }, [mode, mapLoaded, onPointSelected, openStorePopup, stores])

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
    // FIRST: Check if the store's direct fascia is hidden
    // This ensures that hiding a fascia always hides ALL its stores
    if (store.fascia_id && companiesVis[store.fascia_id] === false) {
      return false
    }

    // For viewport stores, check if at least ONE matched target is visible
    if ('matchedTargetIds' in store && store.matchedTargetIds) {
      const hasVisibleMatch = store.matchedTargetIds.some(targetId => {
        // Check if this target is hidden in either visibility map
        const isFasciaHidden = companiesVis[targetId] === false
        const isCategoryHidden = categoriesVis[targetId] === false

        // Target is visible if NOT explicitly hidden
        return !isFasciaHidden && !isCategoryHidden
      })

      return hasVisibleMatch
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

    const storePopup = new mapboxgl.Popup({
      offset: 15,
      className: 'premium-store-popup'
    }).setHTML(generateStorePopupHTML(store.name || 'Store', address, color))

    el.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      suppressNextPointSelection.current = true

      openStorePopup(store, color)
    })

    return new mapboxgl.Marker({ element: el })
      .setLngLat([store.lon, store.lat])
      .setPopup(storePopup)
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
          const badgeNumber = assessBadgeByStoreId[store.id]
          const badgeLabel = badgeNumber ? String(badgeNumber) : undefined
          const marker = createSimpleStoreMarker(store, getFasciaMarkerColor(store.fascia_id), badgeLabel)
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
  }, [stores, includedStores, excludedStores, proximityIncludedStores, proximityExcludedStores, mode, mapLoaded, targetBadgeMapping, storeUpdateSource, companiesVisibility, categoriesVisibility, isStoreVisible, assessBadgeByStoreId])

  const requirementGeoJson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: requirementLocations.map(location => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [location.coordinates.lng, location.coordinates.lat]
      },
      properties: {
        id: location.id,
        listingId: location.listingId,
        companyName: location.companyName,
        title: location.title,
        listingType: location.listingType,
        placeName: location.placeName,
        formattedAddress: location.formattedAddress
      }
    }))
  }), [requirementLocations])

  // Render requirement locations as clustered GeoJSON so overlapping points are counted visibly.
  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const requirementSource = map.current.getSource(REQUIREMENT_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined
    if (requirementSource) {
      requirementSource.setData(requirementGeoJson)
      return
    }

    if (!map.current.isStyleLoaded()) return

    map.current.addSource(REQUIREMENT_SOURCE_ID, {
      type: 'geojson',
      data: requirementGeoJson,
      cluster: true,
      clusterMaxZoom: 22,
      clusterRadius: 0  // Only cluster at exact same coordinates
    })

    map.current.addLayer({
      id: REQUIREMENT_CLUSTER_LAYER_ID,
      type: 'circle',
      source: REQUIREMENT_SOURCE_ID,
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          '#a78bfa',
          100,
          '#8b5cf6',
          750,
          '#7c3aed'
        ],
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          20,
          100,
          30,
          750,
          40
        ],
        'circle-stroke-width': 1,
        'circle-stroke-color': '#ffffff'
      }
    })

    map.current.addLayer({
      id: REQUIREMENT_CLUSTER_COUNT_LAYER_ID,
      type: 'symbol',
      source: REQUIREMENT_SOURCE_ID,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        'text-size': 14,
        'text-allow-overlap': true
      },
      paint: {
        'text-color': '#ffffff'
      }
    })

    map.current.addLayer({
      id: REQUIREMENT_POINT_LAYER_ID,
      type: 'circle',
      source: REQUIREMENT_SOURCE_ID,
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': '#8b5cf6',
        'circle-radius': 8,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#ffffff'
      }
    })
  }, [requirementGeoJson, mapLoaded])

  useEffect(() => {
    if (!map.current || !mapLoaded) return

    const handleRequirementClusterClick = async (event: mapboxgl.MapMouseEvent) => {
      const feature = event.features?.[0]
      const source = map.current?.getSource(REQUIREMENT_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined

      if (!source || !feature || !feature.properties || !feature.geometry || feature.geometry.type !== 'Point') return

      const clusterId = feature.properties.cluster_id
      const pointCount = feature.properties.point_count
      if (clusterId === undefined || !pointCount) return

      // Stop event propagation to prevent click-outside handler from closing popup immediately
      event.originalEvent?.stopPropagation()

      // Close any existing Mapbox popups
      popup.current?.remove()

      try {
        // Get all requirements in this cluster
        const clusterLeaves = await new Promise<any[]>((resolve) => {
          source.getClusterLeaves(
            clusterId,
            pointCount,
            0,
            (error: any, features: any) => {
              if (error) {
                console.error('Error getting cluster leaves:', error)
                resolve([])
              } else {
                resolve(features || [])
              }
            }
          )
        })

        // Extract requirement data
        const requirements = clusterLeaves.map(leaf => ({
          id: leaf.properties.id || '',
          listingId: leaf.properties.listingId || '',
          companyName: leaf.properties.companyName || '',
          title: leaf.properties.title || '',
          listingType: leaf.properties.listingType || 'commercial',
          placeName: leaf.properties.placeName || '',
          formattedAddress: leaf.properties.formattedAddress || ''
        }))

        // Calculate smart popup position
        const mapRect = mapContainer.current?.getBoundingClientRect()
        if (!mapRect) return

        const popupWidth = 320
        const availableHeight = window.innerHeight - 100
        const maxPopupHeight = Math.min(400, availableHeight)
        const popupHeight = Math.min(maxPopupHeight, requirements.length * 56 + 80)
        const margin = 20

        // Start with click position relative to viewport
        let x = event.point.x + mapRect.left
        let y = event.point.y + mapRect.top

        // Horizontal positioning - prefer right of click, then left, then force fit
        if (x + popupWidth + margin > window.innerWidth) {
          x = x - popupWidth - 20
          if (x < margin) {
            x = window.innerWidth - popupWidth - margin
          }
        }
        if (x < margin) {
          x = margin
        }

        // Vertical positioning - prefer below click, then above, then clamp
        const maxY = window.innerHeight - popupHeight - margin
        if (y + popupHeight > window.innerHeight - margin) {
          y = y - popupHeight - 20
        }
        if (y < margin) {
          y = margin
        }
        if (y > maxY) {
          y = maxY
        }

        setRequirementClusterPopup({
          isOpen: true,
          requirements,
          position: { x, y },
          maxHeight: maxPopupHeight
        })
      } catch (error) {
        console.error('Error handling cluster click:', error)
      }
    }

    const handleRequirementPointClick = (event: mapboxgl.MapMouseEvent) => {
      const feature = event.features?.[0]
      if (!feature || !feature.geometry || feature.geometry.type !== 'Point') return

      // Requirement marker clicks should not also place/move an Assess Area point.
      event.originalEvent?.stopPropagation()

      const properties = feature.properties || {}
      const location = {
        companyName: String(properties.companyName || ''),
        listingType: String(properties.listingType || 'commercial'),
        placeName: String(properties.placeName || ''),
        formattedAddress: String(properties.formattedAddress || '')
      }

      new mapboxgl.Popup({
        offset: 15,
        className: 'premium-store-popup'
      })
        .setLngLat(feature.geometry.coordinates as [number, number])
        .setHTML(generateRequirementPopupHTML(location))
        .addTo(map.current!)
    }

    const setPointerCursor = () => {
      if (map.current) map.current.getCanvas().style.cursor = 'pointer'
    }
    const resetCursor = () => {
      if (map.current) map.current.getCanvas().style.cursor = mode === 'assess-area' ? 'crosshair' : ''
    }

    map.current.on('click', REQUIREMENT_CLUSTER_LAYER_ID, handleRequirementClusterClick)
    map.current.on('click', REQUIREMENT_POINT_LAYER_ID, handleRequirementPointClick)
    map.current.on('mouseenter', REQUIREMENT_CLUSTER_LAYER_ID, setPointerCursor)
    map.current.on('mouseenter', REQUIREMENT_POINT_LAYER_ID, setPointerCursor)
    map.current.on('mouseleave', REQUIREMENT_CLUSTER_LAYER_ID, resetCursor)
    map.current.on('mouseleave', REQUIREMENT_POINT_LAYER_ID, resetCursor)

    return () => {
      if (!map.current) return
      map.current.off('click', REQUIREMENT_CLUSTER_LAYER_ID, handleRequirementClusterClick)
      map.current.off('click', REQUIREMENT_POINT_LAYER_ID, handleRequirementPointClick)
      map.current.off('mouseenter', REQUIREMENT_CLUSTER_LAYER_ID, setPointerCursor)
      map.current.off('mouseenter', REQUIREMENT_POINT_LAYER_ID, setPointerCursor)
      map.current.off('mouseleave', REQUIREMENT_CLUSTER_LAYER_ID, resetCursor)
      map.current.off('mouseleave', REQUIREMENT_POINT_LAYER_ID, resetCursor)
    }
  }, [mapLoaded, mode])

  // Handle click-outside, map move/zoom, and window resize for cluster popup
  useEffect(() => {
    if (!requirementClusterPopup.isOpen) return

    // Install click-outside handler on next tick to avoid race with opening click
    const timeoutId = setTimeout(() => {
      const handleClickOutside = (e: MouseEvent) => {
        const target = e.target as HTMLElement
        if (!target.closest('.requirement-cluster-popup')) {
          setRequirementClusterPopup({
            isOpen: false,
            requirements: [],
            position: { x: 0, y: 0 },
            maxHeight: 400
          })
        }
      }
      document.addEventListener('mousedown', handleClickOutside)

      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }, 0)

    // Map move/zoom handlers
    const handleMapMove = () => {
      setRequirementClusterPopup({
        isOpen: false,
        requirements: [],
        position: { x: 0, y: 0 },
        maxHeight: 400
      })
    }

    const handleWindowResize = () => {
      setRequirementClusterPopup({
        isOpen: false,
        requirements: [],
        position: { x: 0, y: 0 },
        maxHeight: 400
      })
    }

    map.current?.on('move', handleMapMove)
    map.current?.on('zoom', handleMapMove)
    window.addEventListener('resize', handleWindowResize)

    return () => {
      clearTimeout(timeoutId)
      map.current?.off('move', handleMapMove)
      map.current?.off('zoom', handleMapMove)
      window.removeEventListener('resize', handleWindowResize)
    }
  }, [requirementClusterPopup.isOpen])

  // Compute fascia legend items
  const fasciaLegendItems = useMemo(() => {
    if (!mapLoaded || targetBadgeMapping.length === 0) {
      return []
    }
    return extractVisibleFascias(
      targetBadgeMapping,
      companiesVisibility,
      includedStores,
      excludedStores,
      proximityIncludedStores,
      proximityExcludedStores
    )
  }, [
    targetBadgeMapping,
    companiesVisibility,
    includedStores,
    excludedStores,
    proximityIncludedStores,
    proximityExcludedStores,
    mapLoaded
  ])

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
      {fasciaLegendItems.length > 0 && (
        <MapLegend
          items={fasciaLegendItems}
          onToggleVisibility={onFasciaVisibilityToggle}
          position={requirementLocations.length > 0 ? 'stacked' : 'standalone'}
        />
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
      {requirementClusterPopup.isOpen && (
        <div
          className="requirement-cluster-popup fixed bg-white rounded-lg shadow-xl border border-gray-200 z-50 w-80 flex flex-col"
          style={{
            left: requirementClusterPopup.position.x,
            top: requirementClusterPopup.position.y,
            maxHeight: `${requirementClusterPopup.maxHeight}px`
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-br from-violet-100 to-purple-200">
            <div className="flex items-center gap-3">
              <div
                className="bg-violet-500 rounded-md p-2 shadow-md"
                dangerouslySetInnerHTML={{ __html: REQUIREMENT_SVG }}
              />
              <h3 className="font-semibold text-gray-900 text-sm">
                {requirementClusterPopup.requirements.length} Requirements
              </h3>
            </div>
            <button
              onClick={() => setRequirementClusterPopup({ isOpen: false, requirements: [], position: { x: 0, y: 0 }, maxHeight: 400 })}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close popup"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {requirementClusterPopup.requirements.map((req, index) => {
              const displayLocation = formatRequirementLocationDisplay(req.formattedAddress, req.placeName)

              return (
                <div
                  key={req.id || index}
                  className="p-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-semibold text-gray-900 text-sm">
                        {req.companyName}
                      </h4>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded flex-shrink-0">
                        {req.listingType === 'commercial' ? 'Commercial' : 'Residential'}
                      </span>
                    </div>
                    {displayLocation && (
                      <p className="text-xs text-gray-500">
                        {displayLocation}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
