'use client'

import { useMemo } from 'react'
import { Map, Source, Layer, Marker } from 'react-map-gl/mapbox'
import { MapPin } from 'lucide-react'
import type { CircleLayerSpecification } from 'mapbox-gl'
import type { StoreEstateStore, DirectoryTarget } from '../../types/unified-workspace'

export type EstateMapMode = 'estate' | 'targets'

// A store counts as "new" when it opened within this window. `stores` has no status or
// closure date, so the design's third legend series (Closing) has no data source and is
// not rendered — see the directory plan's substitutions section.
const NEW_STORE_WINDOW_MS = 365 * 24 * 60 * 60 * 1000

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

// Map-pin glyph with a white centre dot + drop shadow (per design handoff). Recently
// opened stores render green to match the estate legend.
function StorePin({ isNew = false }: { isNew?: boolean }) {
  const fill = isNew ? '#16A34A' : '#7033FF'
  const shadow = isNew ? 'rgba(22,163,74,.35)' : 'rgba(84,33,204,.35)'
  return (
    <span
      className="block"
      style={{ filter: `drop-shadow(0 3px 5px ${shadow})`, transform: 'translateY(-1px)' }}
    >
      <svg width="20" height="24" viewBox="0 0 20 24" fill="none" aria-hidden>
        <path
          d="M10 0C4.477 0 0 4.477 0 10c0 6.5 10 14 10 14s10-7.5 10-14C20 4.477 15.523 0 10 0Z"
          fill={fill}
        />
        <circle cx="10" cy="10" r="3.4" fill="#fff" />
      </svg>
    </span>
  )
}

// Violet halo-pin for a requirement target location (directory brand profile only).
function TargetPin() {
  return (
    <span className="block" style={{ transform: 'translateY(-1px)' }}>
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden>
        <circle cx="13" cy="13" r="12" fill="#7033FF" fillOpacity="0.16" />
        <circle cx="13" cy="13" r="7" fill="#7033FF" fillOpacity="0.28" />
        <circle cx="13" cy="13" r="3.5" fill="#7033FF" stroke="#fff" strokeWidth="1.5" />
      </svg>
    </span>
  )
}

// Full-bleed store-estate map. Used by the requirement modal's left column and by the
// directory brand profile's estate panel.
//
// `mode` is controlled: pass `onModeChange` to render the Existing estate / Targets toggle.
// Without the callback the toggle is hidden and the component behaves exactly as it did
// before the directory existed, so the requirement modal's usage is unchanged.
export function UStoreEstateMap({
  stores,
  count,
  mode = 'estate',
  onModeChange,
  targets,
  showLegend = false,
}: {
  stores: StoreEstateStore[]
  count: number
  mode?: EstateMapMode
  onModeChange?: (mode: EstateMapMode) => void
  targets?: DirectoryTarget[]
  showLegend?: boolean
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

  const targetPoints = useMemo(
    () => (targets || []).filter((t) => Number.isFinite(t.lat) && Number.isFinite(t.lon)),
    [targets]
  )

  const showingTargets = mode === 'targets'
  const plotted = showingTargets ? targetPoints.length : points.length

  // The count pill reports what is actually plotted, never a headline figure that the map
  // does not back up — target coordinates are dropped server-side when they fail validation.
  const countLabel = showingTargets
    ? `${targetPoints.length.toLocaleString()} ${targetPoints.length === 1 ? 'target town' : 'target towns'}`
    : `${count.toLocaleString()} ${count === 1 ? 'store' : 'stores'}`

  const newCutoff = Date.now() - NEW_STORE_WINDOW_MS
  const isNew = (s: StoreEstateStore) =>
    Boolean(s.openDate) && new Date(s.openDate as string).getTime() >= newCutoff

  const toggle = onModeChange ? (
    <div className="absolute left-3.5 top-3.5 z-10 inline-flex rounded-full border border-sm-border bg-sm-surface p-0.5 shadow-[0_4px_14px_-6px_rgba(20,10,40,0.3)]">
      {([
        { id: 'estate' as const, label: 'Existing estate' },
        { id: 'targets' as const, label: 'Targets' },
      ]).map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onModeChange(t.id)}
          aria-pressed={mode === t.id}
          className={
            'rounded-full px-3 py-1 text-[11.5px] font-medium transition-colors duration-150 ' +
            (mode === t.id ? 'bg-sm-ink text-white' : 'text-sm-ink3 hover:text-sm-ink2')
          }
        >
          {t.label}
        </button>
      ))}
    </div>
  ) : null

  if (!MAPBOX_TOKEN || plotted === 0) {
    return (
      <div className="relative flex h-full min-h-[160px] items-center justify-center border-t border-sm-border-soft bg-sm-bg text-sm-ink3">
        {toggle}
        <div className="flex flex-col items-center gap-1.5">
          <MapPin size={18} className="text-sm-ink3" />
          <span className="text-[12px]">
            {!MAPBOX_TOKEN
              ? 'Map unavailable'
              : showingTargets
                ? 'No target locations on file'
                : 'No store locations to map'}
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
        {showingTargets ? (
          targetPoints.map((t) => (
            <Marker key={t.id} longitude={t.lon} latitude={t.lat} anchor="center">
              <TargetPin />
            </Marker>
          ))
        ) : usePins ? (
          points.map((s) => (
            <Marker key={s.id} longitude={s.lon} latitude={s.lat} anchor="bottom">
              <StorePin isNew={isNew(s)} />
            </Marker>
          ))
        ) : (
          <Source id="stores" type="geojson" data={geojson}>
            <Layer {...circleLayer} />
          </Source>
        )}
      </Map>

      {toggle}

      <div className="pointer-events-none absolute right-3.5 top-3.5 inline-flex items-center gap-2 rounded-full border border-sm-border bg-sm-surface px-3 py-1.5 shadow-[0_4px_14px_-6px_rgba(20,10,40,0.3)]">
        <span className="h-2 w-2 rounded-full bg-sm-violet" />
        <span className="font-mono text-[11px] font-medium text-sm-ink2">{countLabel}</span>
      </div>

      {/* Legend is estate-only. "Closing" from the design is omitted: stores carries no
          status or closure date, so there is nothing to plot it from. */}
      {showLegend && !showingTargets && (
        <div className="pointer-events-none absolute bottom-3.5 left-3.5 inline-flex items-center gap-3 rounded-full border border-sm-border bg-sm-surface/95 px-3 py-1.5 shadow-[0_4px_14px_-6px_rgba(20,10,40,0.3)]">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-sm-ink2">
            <span className="h-2 w-2 rounded-full bg-sm-violet" />
            Trading
          </span>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-sm-ink2">
            <span className="h-2 w-2 rounded-full bg-[#16A34A]" />
            Opened in last 12m
          </span>
        </div>
      )}
    </div>
  )
}
