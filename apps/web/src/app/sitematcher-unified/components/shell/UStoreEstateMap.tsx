'use client'

import { useMemo } from 'react'
import { Map, Source, Layer, Marker } from 'react-map-gl/mapbox'
import { MapPin } from 'lucide-react'
import type { CircleLayerSpecification } from 'mapbox-gl'
import type { StoreEstateStore } from '../../types/unified-workspace'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

// Above this many points, drop individual pin markers (too many DOM nodes) and fall back
// to a fast GL circle layer. Below it, render the design's violet map-pin glyphs.
const PIN_MARKER_CAP = 80

const circleLayer: CircleLayerSpecification = {
  id: 'store-points',
  type: 'circle',
  source: 'stores',
  paint: {
    'circle-radius': 4,
    'circle-color': '#7033FF',
    'circle-opacity': 0.85,
    'circle-stroke-width': 1,
    'circle-stroke-color': '#ffffff',
  },
}

// Violet map-pin glyph with a white centre dot + drop shadow (per design handoff).
function StorePin() {
  return (
    <span
      className="block"
      style={{ filter: 'drop-shadow(0 3px 5px rgba(84,33,204,.35))', transform: 'translateY(-1px)' }}
    >
      <svg width="20" height="24" viewBox="0 0 20 24" fill="none" aria-hidden>
        <path
          d="M10 0C4.477 0 0 4.477 0 10c0 6.5 10 14 10 14s10-7.5 10-14C20 4.477 15.523 0 10 0Z"
          fill="#7033FF"
        />
        <circle cx="10" cy="10" r="3.4" fill="#fff" />
      </svg>
    </span>
  )
}

// Full-bleed store-estate map for the requirement modal's left column. Fills its container
// to the rounded bottom-left corner; renders violet pins (small estates) or a circle layer
// (large estates), a "N stores" chip top-right, and Mapbox attribution.
export function UStoreEstateMap({
  stores,
  count,
}: {
  stores: StoreEstateStore[]
  count: number
}) {
  const points = useMemo(
    () => stores.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon)),
    [stores]
  )

  const geojson = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: points.map((s) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [s.lon, s.lat] },
        properties: {},
      })),
    }),
    [points]
  )

  const viewState = useMemo(() => {
    if (points.length === 0) return { longitude: -3.5, latitude: 54.8, zoom: 4.2 }
    if (points.length === 1) return { longitude: points[0].lon, latitude: points[0].lat, zoom: 9 }

    const lats = points.map((p) => p.lat)
    const lngs = points.map((p) => p.lon)
    const minLat = Math.min(...lats)
    const maxLat = Math.max(...lats)
    const minLng = Math.min(...lngs)
    const maxLng = Math.max(...lngs)
    const maxDiff = Math.max(maxLat - minLat, maxLng - minLng)

    let zoom = 9
    if (maxDiff > 10) zoom = 4.2
    else if (maxDiff > 5) zoom = 5
    else if (maxDiff > 2) zoom = 6
    else if (maxDiff > 1) zoom = 7
    else if (maxDiff > 0.5) zoom = 8

    return { longitude: (minLng + maxLng) / 2, latitude: (minLat + maxLat) / 2, zoom }
  }, [points])

  const usePins = points.length > 0 && points.length <= PIN_MARKER_CAP

  if (!MAPBOX_TOKEN || points.length === 0) {
    return (
      <div className="flex h-full min-h-[160px] items-center justify-center border-t border-sm-border-soft bg-sm-bg text-sm-ink3">
        <div className="flex flex-col items-center gap-1.5">
          <MapPin size={18} className="text-sm-ink3" />
          <span className="text-[12px]">
            {MAPBOX_TOKEN ? 'No store locations to map' : 'Map unavailable'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full min-h-[160px] border-t border-sm-border-soft">
      <Map
        initialViewState={viewState}
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        attributionControl
        logoPosition="bottom-left"
        interactive
      >
        {usePins ? (
          points.map((s) => (
            <Marker key={s.id} longitude={s.lon} latitude={s.lat} anchor="bottom">
              <StorePin />
            </Marker>
          ))
        ) : (
          <Source id="stores" type="geojson" data={geojson}>
            <Layer {...circleLayer} />
          </Source>
        )}
      </Map>
      <div className="pointer-events-none absolute right-3.5 top-3.5 inline-flex items-center gap-2 rounded-full border border-sm-border bg-sm-surface px-3 py-1.5 shadow-[0_4px_14px_-6px_rgba(20,10,40,0.3)]">
        <span className="h-2 w-2 rounded-full bg-sm-violet" />
        <span className="font-mono text-[11px] font-medium text-sm-ink2">
          {count.toLocaleString()} {count === 1 ? 'store' : 'stores'}
        </span>
      </div>
    </div>
  )
}
