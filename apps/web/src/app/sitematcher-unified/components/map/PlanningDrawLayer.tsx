'use client'

import { useEffect, useRef, useState } from 'react'
import type mapboxgl from 'mapbox-gl'
import { PenLine } from 'lucide-react'
import { usePlanningMonitorStore, type LngLat, type PlanningDrawing } from '../../lib/stores/planning-monitor-store'
import { crossingEdges } from '../../lib/planning-monitor-ui'
import { mapAlive } from './PlanningMapLayer'

/**
 * Free-draw for the patch, on the shared map. Click to add points; click the first point or press
 * Enter to close; ⌘Z undoes; Esc cancels. A closed shape (and the saved boundary in edit mode)
 * exposes draggable vertices, midpoint handles that add a point, and dragging a vertex off the map
 * removes it. An edge that crosses another turns amber and blocks closing.
 */

const SRC = 'pm-draw'
const SRC_HANDLES = 'pm-draw-handles'
const L_LINE = 'pm-draw-line'
const L_BAD = 'pm-draw-bad'
const L_RUBBER = 'pm-draw-rubber'
const L_DRAG_HALO = 'pm-draw-drag-halo'
const L_MID = 'pm-draw-mid'
const L_VERTEX = 'pm-draw-vertex'
const LAYERS = [L_LINE, L_BAD, L_RUBBER, L_DRAG_HALO, L_MID, L_VERTEX]
const SNAP_PX = 12

type Handle = { kind: 'vertex' | 'mid'; index: number }

function features(drawing: PlanningDrawing, cursor: LngLat | null, dragIndex: number | null) {
  const { vertices, closed } = drawing
  const shape: GeoJSON.Feature[] = []
  const bad = new Set(crossingEdges(vertices, closed))
  const edgeCount = closed ? vertices.length : vertices.length - 1
  for (let i = 0; i < edgeCount; i++) {
    shape.push({
      type: 'Feature',
      properties: { role: 'edge', bad: bad.has(i) ? 1 : 0 },
      geometry: { type: 'LineString', coordinates: [vertices[i], vertices[(i + 1) % vertices.length]] },
    })
  }
  if (!closed && cursor && vertices.length > 0) {
    shape.push({ type: 'Feature', properties: { role: 'rubber' }, geometry: { type: 'LineString', coordinates: [vertices[vertices.length - 1], cursor] } })
  }
  const handles: GeoJSON.Feature[] = vertices.map((v, index) => ({
    type: 'Feature',
    properties: { kind: 'vertex', index, first: index === 0 && !closed && vertices.length >= 3 ? 1 : 0, dragging: index === dragIndex ? 1 : 0 },
    geometry: { type: 'Point', coordinates: v },
  }))
  if (closed) {
    vertices.forEach((v, index) => {
      const next = vertices[(index + 1) % vertices.length]
      handles.push({
        type: 'Feature',
        properties: { kind: 'mid', index: index + 1 },
        geometry: { type: 'Point', coordinates: [(v[0] + next[0]) / 2, (v[1] + next[1]) / 2] },
      })
    })
  }
  return {
    shape: { type: 'FeatureCollection', features: shape } as GeoJSON.FeatureCollection,
    handles: { type: 'FeatureCollection', features: handles } as GeoJSON.FeatureCollection,
  }
}

function ensure(map: mapboxgl.Map, closed: boolean) {
  if (!mapAlive(map) || !map.isStyleLoaded()) return false
  for (const id of [SRC, SRC_HANDLES]) if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  const add = (layer: mapboxgl.AnyLayer) => !map.getLayer(layer.id) && map.addLayer(layer)
  add({ id: L_LINE, type: 'line', source: SRC, filter: ['all', ['==', ['get', 'role'], 'edge'], ['==', ['get', 'bad'], 0]], paint: { 'line-color': '#B49CFF', 'line-width': 3 } })
  add({ id: L_BAD, type: 'line', source: SRC, filter: ['all', ['==', ['get', 'role'], 'edge'], ['==', ['get', 'bad'], 1]], paint: { 'line-color': '#F59E0B', 'line-width': 3.5 } })
  add({ id: L_RUBBER, type: 'line', source: SRC, filter: ['==', ['get', 'role'], 'rubber'], paint: { 'line-color': '#ffffff', 'line-width': 2, 'line-dasharray': [2, 2] } })
  add({
    id: L_DRAG_HALO, type: 'circle', source: SRC_HANDLES, filter: ['all', ['==', ['get', 'kind'], 'vertex'], ['==', ['get', 'dragging'], 1]],
    paint: { 'circle-radius': 14, 'circle-color': 'rgba(112,51,255,0.3)' },
  })
  add({
    id: L_MID, type: 'circle', source: SRC_HANDLES, filter: ['==', ['get', 'kind'], 'mid'],
    paint: { 'circle-radius': 4, 'circle-color': 'rgba(255,255,255,0.85)', 'circle-stroke-color': '#7033FF', 'circle-stroke-width': 1.5 },
  })
  add({
    id: L_VERTEX, type: 'circle', source: SRC_HANDLES, filter: ['==', ['get', 'kind'], 'vertex'],
    paint: {
      'circle-radius': ['case', ['==', ['get', 'first'], 1], 6.5, 5.5],
      'circle-color': '#ffffff',
      'circle-stroke-color': '#7033FF',
      'circle-stroke-width': ['case', ['==', ['get', 'first'], 1], 3, 2.5],
    },
  })
  // Open edges are dashed while drawing; a closed shape is solid.
  map.setPaintProperty(L_LINE, 'line-dasharray', closed ? [1, 0] : [3, 2.3])
  return true
}

export function PlanningDrawLayer({ map, onSaveBoundary }: { map: mapboxgl.Map; onSaveBoundary: (vertices: LngLat[]) => Promise<void> }) {
  const drawing = usePlanningMonitorStore((s) => s.drawing) as PlanningDrawing
  const [cursor, setCursor] = useState<{ lngLat: LngLat; point: { x: number; y: number } } | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const drag = useRef<Handle | null>(null)
  const original = useRef<LngLat[]>(drawing.vertices)

  // Render.
  useEffect(() => {
    const render = () => {
      if (!ensure(map, drawing.closed)) return
      const { shape, handles } = features(drawing, cursor?.lngLat ?? null, dragIndex)
      ;(map.getSource(SRC) as mapboxgl.GeoJSONSource).setData(shape)
      ;(map.getSource(SRC_HANDLES) as mapboxgl.GeoJSONSource).setData(handles)
    }
    render()
    // Only after a style swap removed the sources: re-sending data on every idle would loop.
    const onIdle = () => {
      if (!map.getSource(SRC)) render()
    }
    map.on('idle', onIdle)
    return () => {
      map.off('idle', onIdle)
    }
  }, [map, drawing, cursor, dragIndex])

  // Interaction, registered once.
  useEffect(() => {
    const store = usePlanningMonitorStore.getState
    const handleAt = (point: mapboxgl.Point): Handle | null => {
      const layers = [L_VERTEX, L_MID].filter((id) => map.getLayer(id))
      if (!layers.length) return null
      const hit = map.queryRenderedFeatures([[point.x - 7, point.y - 7], [point.x + 7, point.y + 7]], { layers })[0]
      return hit ? { kind: hit.properties?.kind as Handle['kind'], index: Number(hit.properties?.index) } : null
    }
    const tryClose = () => {
      const d = store().drawing
      if (!d || d.closed || d.vertices.length < 3) return
      if (crossingEdges(d.vertices, true).length > 0) return
      store().closeShape()
    }
    const onClick = (e: mapboxgl.MapMouseEvent) => {
      const d = store().drawing
      if (!d || d.closed) return
      const first = d.vertices[0]
      if (first && d.vertices.length >= 3) {
        const p = map.project(first)
        if (Math.hypot(p.x - e.point.x, p.y - e.point.y) <= SNAP_PX) {
          tryClose()
          return
        }
      }
      const last = d.vertices[d.vertices.length - 1]
      if (last) {
        const p = map.project(last)
        if (Math.hypot(p.x - e.point.x, p.y - e.point.y) < 5) return
      }
      store().addVertex([e.lngLat.lng, e.lngLat.lat])
    }
    const onDown = (e: mapboxgl.MapMouseEvent) => {
      const d = store().drawing
      if (!d?.closed) return
      const handle = handleAt(e.point)
      if (!handle) return
      e.preventDefault()
      map.dragPan.disable()
      if (handle.kind === 'mid') {
        store().insertVertex(handle.index, [e.lngLat.lng, e.lngLat.lat])
        drag.current = { kind: 'vertex', index: handle.index }
      } else {
        drag.current = handle
      }
      setDragIndex(drag.current.index)
    }
    const onMove = (e: mapboxgl.MapMouseEvent) => {
      const d = store().drawing
      if (!d) return
      if (drag.current) {
        store().moveVertex(drag.current.index, [e.lngLat.lng, e.lngLat.lat])
        return
      }
      map.getCanvas().style.cursor = d.closed ? (handleAt(e.point) ? 'grab' : '') : 'crosshair'
      setCursor(d.closed ? null : { lngLat: [e.lngLat.lng, e.lngLat.lat], point: { x: e.point.x, y: e.point.y } })
    }
    const endDrag = () => {
      if (!drag.current) return
      drag.current = null
      setDragIndex(null)
      map.dragPan.enable()
    }
    // Dragging a vertex off the map deletes it.
    const onOut = () => {
      if (drag.current) {
        store().removeVertex(drag.current.index)
        endDrag()
      }
      setCursor(null)
    }
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      const d = store().drawing
      if (!d) return
      if (e.key === 'Escape') {
        e.preventDefault()
        store().endDrawing()
      } else if (e.key === 'Enter' && d.mode === 'new') {
        e.preventDefault()
        if (d.closed) store().toNameStep()
        else tryClose()
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && d.mode === 'new') {
        e.preventDefault()
        store().undoVertex()
      }
    }

    const doubleClick = map.doubleClickZoom.isEnabled()
    map.doubleClickZoom.disable()
    map.on('click', onClick)
    map.on('mousedown', onDown)
    map.on('mousemove', onMove)
    map.on('mouseup', endDrag)
    map.on('mouseout', onOut)
    document.addEventListener('keydown', onKey)
    return () => {
      map.off('click', onClick)
      map.off('mousedown', onDown)
      map.off('mousemove', onMove)
      map.off('mouseup', endDrag)
      map.off('mouseout', onOut)
      document.removeEventListener('keydown', onKey)
      if (!mapAlive(map)) return
      if (doubleClick) map.doubleClickZoom.enable()
      map.dragPan.enable()
      map.getCanvas().style.cursor = ''
      if (map.isStyleLoaded()) {
        for (const id of LAYERS) if (map.getLayer(id)) map.removeLayer(id)
        for (const id of [SRC, SRC_HANDLES]) if (map.getSource(id)) map.removeSource(id)
      }
    }
  }, [map])

  const crossing = crossingEdges(drawing.vertices, drawing.closed).length > 0
  // While open, closing is blocked if the closing edge would cross another.
  const closeBlocked = !drawing.closed && drawing.vertices.length >= 3 && crossingEdges(drawing.vertices, true).length > 0
  const edit = drawing.mode === 'edit'
  const unchanged = JSON.stringify(original.current) === JSON.stringify(drawing.vertices)

  return (
    <>
      <div role="status" className="pointer-events-none absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-[12px] bg-[rgba(23,20,25,.92)] px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-lg">
        <PenLine size={15} aria-hidden />
        {edit ? (
          <span>Editing boundary · <span className="text-[#B49CFF]">drag a point · drag the dots between points to add one · drag off the map to remove</span></span>
        ) : drawing.closed ? (
          <span>Shape closed · <span className="text-[#B49CFF]">drag points to adjust · Enter to continue</span></span>
        ) : (
          <span>Free-draw mode · <span className="text-[#B49CFF]">Esc to cancel · ⌘Z to undo</span></span>
        )}
      </div>

      {cursor && !drawing.closed && (
        <div
          className="pointer-events-none absolute z-20 whitespace-nowrap rounded-[7px] bg-sm-ink px-2.5 py-1.5 text-[11.5px] font-semibold text-white"
          style={{ left: cursor.point.x + 16, top: cursor.point.y + 12 }}
        >
          {crossing ? 'Edges cross — undo the last point' : closeBlocked ? 'Closing here would cross an edge' : drawing.vertices.length >= 3 ? 'Click the first point to close' : 'Click to add a point'}
        </div>
      )}

      {edit && (
        <div className="absolute bottom-6 right-4 z-20 flex flex-col items-end gap-2">
          {(saveError || crossing) && (
            <p role="alert" className="rounded-[10px] bg-white px-3 py-2 text-[12.5px] text-[#C0453F] shadow">
              {crossing ? 'Two edges cross. Move a point to fix the shape.' : saveError}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => usePlanningMonitorStore.getState().endDrawing()}
              className="rounded-[10px] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-sm-ink shadow-[0_4px_12px_-4px_rgba(0,0,0,.4)] hover:bg-sm-bg"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || crossing || unchanged || drawing.vertices.length < 3}
              onClick={async () => {
                setSaving(true)
                setSaveError(null)
                try {
                  await onSaveBoundary(drawing.vertices)
                } catch (err) {
                  setSaveError(err instanceof Error ? err.message : 'The boundary could not be saved')
                } finally {
                  setSaving(false)
                }
              }}
              className="rounded-[10px] bg-sm-violet px-4 py-2.5 text-[13.5px] font-bold text-white shadow-[0_4px_12px_-4px_rgba(0,0,0,.4)] hover:bg-sm-violet-deep disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save boundary'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
