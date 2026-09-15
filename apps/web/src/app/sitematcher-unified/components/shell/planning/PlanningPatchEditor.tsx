'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import { Loader2, PenLine, Search, Trash2, Undo2, Upload } from 'lucide-react'
import { MAPBOX_TOKEN } from '@/lib/sitesketcher-v2/constants'
import { createDebouncedLocationSearch, type LocationResult } from '@/lib/mapbox'
import { radiusLabel, validatePatchGeometry, type PatchGeometry } from '@/lib/planning-monitor/geometry'
import { circleGeometry } from '../../../lib/geo'
import { MILE_METERS, PLANNING_STYLE } from '../../../lib/planning-monitor-ui'
import type { DraftLocation } from '../../../lib/services/planning-monitor-service'

type Mode = 'draw' | 'upload' | 'search'

const SRC = 'pe-shape'
const SRC_VERTS = 'pe-vertices'

export interface PatchEditorValue {
  /** The unsaved location, or null to keep the saved geometry. */
  location: DraftLocation | null
  /** What to draw: the draft, or the saved outline. */
  preview: PatchGeometry | null
  label: string | null
}

/**
 * The patch's shape: draw it, upload GeoJSON, or search a place for an explicit radius. Uses its
 * own small map and its own handlers, so nothing here touches Sketch mode's editor or shortcuts.
 * The server re-validates everything; client checks only give an early, readable message.
 */
export function PlanningPatchEditor({
  saved,
  value,
  onChange,
}: {
  saved: { geometry: PatchGeometry; label: string | null } | null
  value: PatchEditorValue
  onChange: (value: PatchEditorValue) => void
}) {
  const [mode, setMode] = useState<Mode>('draw')
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const [points, setPoints] = useState<[number, number][]>([])
  const [closed, setClosed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pointsRef = useRef(points)
  pointsRef.current = points
  const closedRef = useRef(closed)
  closedRef.current = closed
  const modeRef = useRef(mode)
  modeRef.current = mode
  const dragIndex = useRef<number | null>(null)

  // Search state.
  const search = useRef(createDebouncedLocationSearch(300))
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LocationResult[]>([])
  const [searching, setSearching] = useState(false)
  const [place, setPlace] = useState<LocationResult | null>(null)
  const [radiusMiles, setRadiusMiles] = useState(3)

  const commitPolygon = (ring: [number, number][]) => {
    const closedRing = [...ring, ring[0]]
    const geometry: GeoJSON.Polygon = { type: 'Polygon', coordinates: [closedRing] }
    const result = validatePatchGeometry(geometry)
    if (!result.ok) {
      setError(result.error)
      onChange({ location: null, preview: saved?.geometry ?? null, label: saved?.label ?? null })
      return
    }
    setError(null)
    onChange({ location: { kind: 'drawn', geometry }, preview: geometry, label: null })
  }

  // Map setup, once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current || !MAPBOX_TOKEN) return
    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: PLANNING_STYLE,
      center: [-2.5, 54.2],
      zoom: 4.6,
      doubleClickZoom: false,
      attributionControl: false,
    })
    map.addControl(new mapboxgl.AttributionControl({ compact: true }))
    mapRef.current = map
    map.on('load', () => {
      map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addSource(SRC_VERTS, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'pe-fill', type: 'fill', source: SRC, filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': 'rgba(139,108,255,0.18)' } })
      map.addLayer({ id: 'pe-line', type: 'line', source: SRC, paint: { 'line-color': '#9E82FF', 'line-width': 2, 'line-dasharray': [2, 1.5] } })
      map.addLayer({ id: 'pe-vertex', type: 'circle', source: SRC_VERTS, paint: { 'circle-radius': 6, 'circle-color': '#ffffff', 'circle-stroke-color': '#6C47FF', 'circle-stroke-width': 3 } })
      redraw()
      fitTo(value.preview ?? saved?.geometry ?? null)
    })

    const vertexAt = (point: mapboxgl.Point) => {
      if (!map.getLayer('pe-vertex')) return null
      const hit = map.queryRenderedFeatures([[point.x - 8, point.y - 8], [point.x + 8, point.y + 8]], { layers: ['pe-vertex'] })[0]
      return hit ? Number(hit.properties?.index) : null
    }
    const startDrag = (e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent) => {
      if (modeRef.current !== 'draw') return
      const index = vertexAt(e.point)
      if (index == null) return
      e.preventDefault()
      dragIndex.current = index
      map.dragPan.disable()
    }
    const moveDrag = (e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent) => {
      if (dragIndex.current == null) return
      const next = [...pointsRef.current]
      next[dragIndex.current] = [e.lngLat.lng, e.lngLat.lat]
      setPoints(next)
    }
    const endDrag = () => {
      if (dragIndex.current == null) return
      dragIndex.current = null
      map.dragPan.enable()
      if (closedRef.current && pointsRef.current.length >= 3) commitPolygon(pointsRef.current)
    }
    map.on('mousedown', startDrag)
    map.on('touchstart', startDrag)
    map.on('mousemove', moveDrag)
    map.on('touchmove', moveDrag)
    map.on('mouseup', endDrag)
    map.on('touchend', endDrag)
    map.on('click', (e) => {
      if (modeRef.current !== 'draw' || closedRef.current || vertexAt(e.point) != null) return
      // A double-click delivers two clicks first; a point on top of the last one is not a new vertex.
      const last = pointsRef.current[pointsRef.current.length - 1]
      if (last) {
        const p = map.project(last)
        if (Math.hypot(p.x - e.point.x, p.y - e.point.y) < 6) return
      }
      setPoints((p) => [...p, [e.lngLat.lng, e.lngLat.lat]])
    })
    map.on('dblclick', (e) => {
      if (modeRef.current !== 'draw' || closedRef.current) return
      e.preventDefault()
      if (pointsRef.current.length >= 3) {
        setClosed(true)
        commitPolygon(pointsRef.current)
      }
    })
    return () => {
      map.remove()
      mapRef.current = null
    }
    // One map per editor; handlers read refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fitTo = (geometry: PatchGeometry | null) => {
    const map = mapRef.current
    if (!map || !geometry) return
    const bounds = new mapboxgl.LngLatBounds()
    const rings = geometry.type === 'Polygon' ? [geometry.coordinates[0]] : geometry.coordinates.map((p) => p[0])
    rings.forEach((ring) => ring.forEach(([lng, lat]) => bounds.extend([lng, lat])))
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 30, duration: 0, maxZoom: 14 })
  }

  const redraw = () => {
    const map = mapRef.current
    if (!map || !map.getSource(SRC)) return
    const features: GeoJSON.Feature[] = []
    // A drawing in progress takes precedence over any earlier upload or radius preview.
    if (mode === 'draw' && points.length > 0) {
      const coords = closed ? [...points, points[0]] : points
      features.push({
        type: 'Feature',
        properties: {},
        geometry: closed && points.length >= 3 ? { type: 'Polygon', coordinates: [coords] } : { type: 'LineString', coordinates: coords },
      })
    } else if (value.preview) {
      features.push({ type: 'Feature', properties: {}, geometry: value.preview })
    } else if (saved) {
      features.push({ type: 'Feature', properties: {}, geometry: saved.geometry })
    }
    ;(map.getSource(SRC) as mapboxgl.GeoJSONSource).setData({ type: 'FeatureCollection', features })
    ;(map.getSource(SRC_VERTS) as mapboxgl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: mode === 'draw' ? points.map((p, index) => ({ type: 'Feature', properties: { index }, geometry: { type: 'Point', coordinates: p } })) : [],
    })
  }
  useEffect(redraw)

  const clearDrawing = () => {
    setPoints([])
    setClosed(false)
    setError(null)
    onChange({ location: null, preview: saved?.geometry ?? null, label: saved?.label ?? null })
  }

  // Search as you type.
  useEffect(() => {
    if (mode !== 'search' || !query.trim()) {
      setResults([])
      return
    }
    let active = true
    setSearching(true)
    search.current(query, { limit: 5, country: ['GB'], types: ['place', 'locality', 'neighborhood', 'postcode', 'district', 'region'] })
      .then((res) => active && setResults(res))
      .catch(() => active && setResults([]))
      .finally(() => active && setSearching(false))
    return () => {
      active = false
    }
  }, [query, mode])

  const applyRadius = (location: LocationResult, miles: number) => {
    const radiusMeters = Math.round(miles * MILE_METERS)
    const [lng, lat] = location.center
    const preview = circleGeometry(lng, lat, radiusMeters / 1000)
    onChange({
      location: { kind: 'radius', center: { lng, lat }, radiusMeters, placeName: location.text },
      preview,
      label: radiusLabel(location.text, radiusMeters),
    })
    fitTo(preview)
  }

  const onUpload = async (file: File) => {
    setError(null)
    if (file.size > 2_000_000) {
      setError('The file is too large (2 MB limit)')
      return
    }
    try {
      const parsed = JSON.parse(await file.text())
      const result = validatePatchGeometry(parsed)
      if (!result.ok) {
        setError(result.error)
        return
      }
      onChange({ location: { kind: 'uploaded', geometry: result.geometry, label: file.name.replace(/\.(geo)?json$/i, '') }, preview: result.display, label: `${file.name} (uploaded)` })
      fitTo(result.display)
    } catch {
      setError('That file is not valid GeoJSON')
    }
  }

  const modeButton = (id: Mode, label: string, Icon: typeof PenLine) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === id}
      onClick={() => {
        setMode(id)
        setError(null)
      }}
      className={
        'inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-[14px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#6C47FF] ' +
        (mode === id ? 'border-[#6C47FF] bg-[#6C47FF] text-white' : 'border-[#E6E3EF] bg-white text-sm-ink2 hover:bg-[#FAF8FF]')
      }
    >
      <Icon size={14} aria-hidden /> {label}
    </button>
  )

  const helper = useMemo(() => {
    if (mode !== 'draw') return null
    if (closed) return 'Drag points to adjust · Clear to start again'
    if (points.length === 0) return saved ? 'Click to start a new outline · the saved patch stays until you close a new one' : 'Click to add points · double-click to close'
    return points.length < 3 ? 'Keep clicking to add points' : 'Double-click or press Close shape to finish'
  }, [mode, closed, points.length, saved])

  return (
    <div>
      <div role="tablist" aria-label="How to set the patch" className="flex gap-2">
        {modeButton('draw', 'Draw', PenLine)}
        {modeButton('upload', 'Upload', Upload)}
        {modeButton('search', 'Search', Search)}
      </div>

      {mode === 'upload' && (
        <label className="mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#D9CFFB] bg-[#FAF8FF] px-4 py-3 text-center text-[13px] text-sm-ink2 focus-within:outline focus-within:outline-2 focus-within:outline-[#6C47FF]">
          <span className="font-semibold text-[#4B23C9]">Choose a GeoJSON file</span>
          <span className="text-[12px] text-sm-ink3">Polygon or MultiPolygon, WGS84, up to 2 MB</span>
          <input type="file" accept=".geojson,.json,application/geo+json,application/json" className="sr-only" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
        </label>
      )}

      {mode === 'search' && (
        <div className="mt-3">
          <label className="block">
            <span className="sr-only">Town or postcode</span>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setPlace(null)
              }}
              placeholder="Town or postcode"
              className="w-full rounded-xl border border-[#E6E3EF] px-3 py-2.5 text-[14px] outline-none focus:border-[#6C47FF]"
            />
          </label>
          {searching && <Loader2 size={14} className="mt-2 animate-spin text-sm-ink3" aria-hidden />}
          {!place && results.length > 0 && (
            <ul className="mt-1 overflow-hidden rounded-xl border border-[#E6E3EF] bg-white" role="listbox">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => {
                      setPlace(r)
                      setQuery(r.place_name)
                      applyRadius(r, radiusMiles)
                    }}
                    className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[#FAF8FF] focus:bg-[#FAF8FF]"
                  >
                    {r.place_name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {place && (
            <label className="mt-2 flex items-center gap-2 text-[13px] text-sm-ink2">
              Radius
              <input
                type="number"
                min={0.25}
                max={30}
                step={0.25}
                value={radiusMiles}
                onChange={(e) => {
                  const miles = Math.min(30, Math.max(0.25, Number(e.target.value) || 0.25))
                  setRadiusMiles(miles)
                  applyRadius(place, miles)
                }}
                className="w-20 rounded-lg border border-[#E6E3EF] px-2 py-1.5"
              />
              miles around {place.text}
            </label>
          )}
          <p className="mt-2 text-[12px] text-sm-ink3">A place search creates a radius patch, labelled as a radius. Administrative boundary search is not available yet; draw or upload a boundary instead.</p>
        </div>
      )}

      <div className="relative mt-3 overflow-hidden rounded-2xl bg-[#0E1522]">
        <div ref={containerRef} className="h-[300px] w-full sm:h-[380px]" aria-label="Patch map" />
        {helper && (
          <p className="pointer-events-none absolute left-3 right-24 top-3 text-[12.5px] font-semibold text-[#E5DEFF] [text-shadow:0_1px_2px_rgba(0,0,0,.6)]">{helper}</p>
        )}
        {mode === 'draw' && (
          <div className="absolute right-2 top-2 flex gap-1.5">
            {!closed && points.length >= 3 && (
              <button type="button" onClick={() => { setClosed(true); commitPolygon(points) }} className="rounded-lg bg-white px-2.5 py-1.5 text-[12px] font-semibold text-[#4B23C9] shadow">
                Close shape
              </button>
            )}
            {points.length > 0 && !closed && (
              <button type="button" onClick={() => setPoints((p) => p.slice(0, -1))} aria-label="Undo last point" className="rounded-lg bg-white p-1.5 text-sm-ink2 shadow">
                <Undo2 size={14} />
              </button>
            )}
            {points.length > 0 && (
              <button type="button" onClick={clearDrawing} aria-label="Clear drawing" className="rounded-lg bg-white p-1.5 text-sm-ink2 shadow">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}
      </div>
      {error && <p role="alert" className="mt-2 text-[12.5px] text-[#8A2A1F]">{error}</p>}
      {value.label && <p className="mt-2 text-[12.5px] text-sm-ink3">Area: {value.label}</p>}
    </div>
  )
}
