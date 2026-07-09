'use client'

import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { MAP_STYLES, MAPBOX_TOKEN } from '@/lib/sitesketcher-v2/constants'
import { useWorkspaceStore, selectMapStyleKey } from '../../lib/stores/unified-workspace-store'

// UK-wide "national" starting view for discovery.
const NATIONAL_VIEWPORT = {
  center: [-2.5, 54.2] as [number, number],
  zoom: 5.2,
}

export function UnifiedMap() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const styleKeyRef = useRef<'satellite' | 'hybrid'>(selectMapStyleKey('assess'))
  const view = useWorkspaceStore((s) => s.view)

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
      style: MAP_STYLES[selectMapStyleKey(view)],
      center: NATIONAL_VIEWPORT.center,
      zoom: NATIONAL_VIEWPORT.zoom,
      antialias: true,
    })
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
    // Initialize once; view changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Swap base style when the mode's required style changes.
  // NOTE: a style swap wipes custom layers — the shared layer manager must
  // re-add them on `style.load`. Layers arrive in a later phase.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const nextKey = selectMapStyleKey(view)
    if (nextKey === styleKeyRef.current) return
    styleKeyRef.current = nextKey
    map.setStyle(MAP_STYLES[nextKey])
  }, [view])

  return <div ref={containerRef} className="absolute inset-0 h-full w-full" />
}
