'use client';

/**
 * Parking Layout Lab — isolated Mapbox GL + Mapbox Draw wrapper.
 *
 * This component owns its OWN Mapbox map and Draw instance. It shares nothing
 * with SiteSketcher, the unified workspace, or any Zustand store. It exposes a
 * small imperative handle so the parent orchestrator can drive drawing modes
 * and render solver output as GL layers.
 */

import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

import type { LngLat } from '@/lib/parking-layout-lab/types';

export type LabDrawMode = 'idle' | 'boundary' | 'exclusion' | 'access';

export type LabMapHandle = {
  startBoundary: () => void;
  startExclusion: () => void;
  startAccess: () => void;
  cancelMode: () => void;
  clearAll: () => void;
  deleteSelected: () => void;
  setResultCollection: (fc: GeoJSON.FeatureCollection | null) => void;
  /** Restrained "preview updating" affordance — a slight opacity drop on the result layers while a draft solve is in flight, no pulsing. */
  setPreviewUpdating: (active: boolean) => void;
};

type Props = {
  /** Called whenever the drawn boundary changes (null if cleared). */
  onBoundaryChange: (ring: LngLat[] | null) => void;
  /** Called whenever the set of exclusion polygons changes. */
  onExclusionsChange: (rings: LngLat[][]) => void;
  /** Called when the user clicks to place/replace the access point. */
  onAccessPoint: (pt: LngLat) => void;
  /** Called when the active draw mode ends (e.g. after a polygon is finished). */
  onModeEnd: () => void;
  /** When true, geometry updates are also emitted (throttled) DURING a drag, not just at drag end. */
  live: boolean;
  /** Throttled during-drag geometry, only fired while `live` is true. */
  onLiveGeometryChange: (boundary: LngLat[] | null, exclusions: LngLat[][]) => void;
};

const RESULT_SOURCE = 'pll-result';
const LIVE_THROTTLE_MS = 150;
const STALL_OPACITY_DEFAULT = 0.55;
const STALL_OPACITY_UPDATING = 0.32;

const LabMap = forwardRef<LabMapHandle, Props>(function LabMap(
  {
    onBoundaryChange,
    onExclusionsChange,
    onAccessPoint,
    onModeEnd,
    live,
    onLiveGeometryChange,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const accessMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const modeRef = useRef<LabDrawMode>('idle');
  // Feature id -> role, so we can tell boundary polygons from exclusions.
  const rolesRef = useRef<Map<string, 'boundary' | 'exclusion'>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Keep the latest callbacks/props without re-initialising the map.
  const cbs = useRef({
    onBoundaryChange,
    onExclusionsChange,
    onAccessPoint,
    onModeEnd,
    live,
    onLiveGeometryChange,
  });
  cbs.current = {
    onBoundaryChange,
    onExclusionsChange,
    onAccessPoint,
    onModeEnd,
    live,
    onLiveGeometryChange,
  };

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      setError('Mapbox token not found. Set NEXT_PUBLIC_MAPBOX_TOKEN to load the map.');
      return;
    }
    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [-1.079, 51.279], // Canterbury-ish default; user pans anywhere.
      zoom: 17,
      preserveDrawingBuffer: true,
    });
    mapRef.current = map;

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {},
      styles: drawStyles(),
    });
    drawRef.current = draw;
    map.addControl(draw as unknown as mapboxgl.IControl);
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

    const readGeometry = (): { boundary: LngLat[] | null; exclusions: LngLat[][] } => {
      const all = draw.getAll();
      let boundary: LngLat[] | null = null;
      const exclusions: LngLat[][] = [];
      for (const f of all.features) {
        if (f.geometry.type !== 'Polygon') continue;
        const ring = f.geometry.coordinates[0] as LngLat[];
        const role = rolesRef.current.get(String(f.id));
        if (role === 'boundary') boundary = ring;
        else if (role === 'exclusion') exclusions.push(ring);
      }
      return { boundary, exclusions };
    };

    const recompute = () => {
      const { boundary, exclusions } = readGeometry();
      cbs.current.onBoundaryChange(boundary);
      cbs.current.onExclusionsChange(exclusions);
    };

    // Throttled (trailing-edge) during-drag emitter. `draw.render` fires on
    // every frame of any Draw interaction (vertex drag, whole-feature drag,
    // in-progress polygon), which is the closest thing Draw exposes to an
    // "onDrag" hook without forking its mode implementations.
    let lastLiveEmit = 0;
    let liveTimer: ReturnType<typeof setTimeout> | null = null;
    const emitLive = () => {
      lastLiveEmit = Date.now();
      const { boundary, exclusions } = readGeometry();
      cbs.current.onLiveGeometryChange(boundary, exclusions);
    };
    const onRender = () => {
      if (!cbs.current.live) return;
      if (modeRef.current !== 'idle') return; // don't fire live updates while actively drawing a new shape
      const since = Date.now() - lastLiveEmit;
      if (since >= LIVE_THROTTLE_MS) {
        if (liveTimer) {
          clearTimeout(liveTimer);
          liveTimer = null;
        }
        emitLive();
      } else if (!liveTimer) {
        liveTimer = setTimeout(() => {
          liveTimer = null;
          emitLive();
        }, LIVE_THROTTLE_MS - since);
      }
    };

    const onCreate = (e: { features: GeoJSON.Feature[] }) => {
      const mode = modeRef.current;
      for (const f of e.features) {
        if (mode === 'boundary') {
          // Only one boundary: remove any previous boundary feature.
          for (const [id, role] of Array.from(rolesRef.current.entries())) {
            if (role === 'boundary' && id !== String(f.id)) {
              try {
                draw.delete(id);
              } catch {
                /* already gone */
              }
              rolesRef.current.delete(id);
            }
          }
          rolesRef.current.set(String(f.id), 'boundary');
        } else if (mode === 'exclusion') {
          rolesRef.current.set(String(f.id), 'exclusion');
        }
      }
      modeRef.current = 'idle';
      recompute();
      cbs.current.onModeEnd();
    };

    const onDelete = (e: { features: GeoJSON.Feature[] }) => {
      for (const f of e.features) rolesRef.current.delete(String(f.id));
      recompute();
    };

    const onUpdate = () => {
      // This is the definitive, committed geometry change (drag released /
      // vertex edit finished). Cancel any trailing throttled live-preview
      // emit so a late draft tick can't fire after — and visually undo — the
      // full solve this update is about to trigger.
      if (liveTimer) {
        clearTimeout(liveTimer);
        liveTimer = null;
      }
      recompute();
    };

    const onClick = (e: mapboxgl.MapMouseEvent) => {
      if (modeRef.current === 'access') {
        const pt: LngLat = [e.lngLat.lng, e.lngLat.lat];
        placeAccessMarker(pt);
        modeRef.current = 'idle';
        cbs.current.onAccessPoint(pt);
        cbs.current.onModeEnd();
      }
    };

    map.on('draw.create', onCreate as never);
    map.on('draw.delete', onDelete as never);
    map.on('draw.update', onUpdate as never);
    map.on('draw.render', onRender);
    map.on('click', onClick);
    map.on('load', () => {
      map.addSource(RESULT_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      addResultLayers(map);
      setReady(true);
    });

    return () => {
      if (liveTimer) clearTimeout(liveTimer);
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function placeAccessMarker(pt: LngLat) {
    const map = mapRef.current;
    if (!map) return;
    if (accessMarkerRef.current) accessMarkerRef.current.remove();
    const el = document.createElement('div');
    el.style.cssText =
      'width:16px;height:16px;border-radius:50%;background:#F97316;border:3px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.3);';
    accessMarkerRef.current = new mapboxgl.Marker({ element: el })
      .setLngLat(pt)
      .addTo(map);
  }

  useImperativeHandle(ref, (): LabMapHandle => ({
    startBoundary: () => {
      modeRef.current = 'boundary';
      drawRef.current?.changeMode('draw_polygon');
    },
    startExclusion: () => {
      modeRef.current = 'exclusion';
      drawRef.current?.changeMode('draw_polygon');
    },
    startAccess: () => {
      modeRef.current = 'access';
      drawRef.current?.changeMode('simple_select');
      if (mapRef.current) mapRef.current.getCanvas().style.cursor = 'crosshair';
    },
    cancelMode: () => {
      modeRef.current = 'idle';
      drawRef.current?.changeMode('simple_select');
      if (mapRef.current) mapRef.current.getCanvas().style.cursor = '';
    },
    clearAll: () => {
      drawRef.current?.deleteAll();
      rolesRef.current.clear();
      accessMarkerRef.current?.remove();
      accessMarkerRef.current = null;
      const map = mapRef.current;
      const src = map?.getSource(RESULT_SOURCE) as mapboxgl.GeoJSONSource | undefined;
      src?.setData({ type: 'FeatureCollection', features: [] });
      cbs.current.onBoundaryChange(null);
      cbs.current.onExclusionsChange([]);
    },
    deleteSelected: () => {
      const draw = drawRef.current;
      if (!draw) return;
      const selected = draw.getSelected();
      for (const f of selected.features) rolesRef.current.delete(String(f.id));
      draw.trash();
    },
    setResultCollection: (fc) => {
      const map = mapRef.current;
      if (!map) return;
      const src = map.getSource(RESULT_SOURCE) as mapboxgl.GeoJSONSource | undefined;
      src?.setData(fc ?? { type: 'FeatureCollection', features: [] });
    },
    setPreviewUpdating: (active) => {
      const map = mapRef.current;
      if (!map || !map.getLayer('pll-stalls')) return;
      const opacity = active ? STALL_OPACITY_UPDATING : STALL_OPACITY_DEFAULT;
      map.setPaintProperty('pll-stalls', 'fill-opacity', opacity);
    },
  }));

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-sm-bg/90 p-6 text-center text-sm text-sm-ink2">
          {error}
        </div>
      )}
      {!ready && !error && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/60 px-2 py-1 text-xs text-white">
          Loading map…
        </div>
      )}
    </div>
  );
});

export default LabMap;

// ---------------------------------------------------------------------------
// GL layers that render solver output, keyed by `featureType`.
// ---------------------------------------------------------------------------
function addResultLayers(map: mapboxgl.Map) {
  const src = RESULT_SOURCE;

  // Access corridor (reserved strip).
  map.addLayer({
    id: 'pll-corridor',
    type: 'fill',
    source: src,
    filter: ['==', ['get', 'featureType'], 'access-corridor'],
    paint: { 'fill-color': '#F59E0B', 'fill-opacity': 0.18 },
  });
  map.addLayer({
    id: 'pll-corridor-line',
    type: 'line',
    source: src,
    filter: ['==', ['get', 'featureType'], 'access-corridor'],
    paint: { 'line-color': '#F59E0B', 'line-width': 1.5, 'line-dasharray': [2, 2] },
  });

  // Exclusion clearance (buffered keep-out).
  map.addLayer({
    id: 'pll-exclusion-clearance',
    type: 'fill',
    source: src,
    filter: ['==', ['get', 'featureType'], 'exclusion-clearance'],
    paint: { 'fill-color': '#EF4444', 'fill-opacity': 0.12 },
  });

  // M2: visibility keepouts (sight-line clearance).
  map.addLayer({
    id: 'pll-visibility-keepout',
    type: 'fill',
    source: src,
    filter: ['==', ['get', 'featureType'], 'visibility-keepout'],
    paint: { 'fill-color': '#F97316', 'fill-opacity': 0.15 },
  });
  map.addLayer({
    id: 'pll-visibility-keepout-line',
    type: 'line',
    source: src,
    filter: ['==', ['get', 'featureType'], 'visibility-keepout'],
    paint: { 'line-color': '#F97316', 'line-width': 1, 'line-dasharray': [1, 2] },
  });

  // Drive aisles — perimeter / interior / spine / turning (M2) roles.
  map.addLayer({
    id: 'pll-aisles',
    type: 'fill',
    source: src,
    filter: ['==', ['get', 'featureType'], 'drive-aisle'],
    paint: {
      'fill-color': [
        'match',
        ['get', 'role'],
        'spine', '#FBBF24',
        'perimeter', '#D1D5DB',
        'turning', '#A78BFA',
        '#E5E7EB',
      ],
      'fill-opacity': ['case', ['==', ['get', 'role'], 'spine'], 0.35, 0.22],
    },
  });
  map.addLayer({
    id: 'pll-aisles-line',
    type: 'line',
    source: src,
    filter: ['all', ['==', ['get', 'featureType'], 'drive-aisle'], ['==', ['get', 'role'], 'spine']],
    paint: { 'line-color': '#D97706', 'line-width': 1.2, 'line-dasharray': [3, 2] },
  });

  // Parking stalls — perimeter vs interior placement, distinguished by fill.
  map.addLayer({
    id: 'pll-stalls',
    type: 'fill',
    source: src,
    filter: ['==', ['get', 'featureType'], 'parking-stall'],
    paint: {
      'fill-color': ['case', ['==', ['get', 'placement'], 'perimeter'], '#1D4ED8', '#2563EB'],
      'fill-opacity': STALL_OPACITY_DEFAULT,
    },
  });
  map.addLayer({
    id: 'pll-stalls-line',
    type: 'line',
    source: src,
    filter: ['==', ['get', 'featureType'], 'parking-stall'],
    paint: { 'line-color': '#1D4ED8', 'line-width': 0.6 },
  });

  // Usable boundary outline.
  map.addLayer({
    id: 'pll-usable',
    type: 'line',
    source: src,
    filter: ['==', ['get', 'featureType'], 'usable-boundary'],
    paint: { 'line-color': '#10B981', 'line-width': 1.5, 'line-dasharray': [3, 2] },
  });
}

// ---------------------------------------------------------------------------
// Mapbox Draw styling — self-contained; site boundary vs exclusion colours.
// ---------------------------------------------------------------------------
function drawStyles(): object[] {
  return [
    // Polygon fill (inactive).
    {
      id: 'gl-draw-polygon-fill-inactive',
      type: 'fill',
      filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon']],
      paint: { 'fill-color': '#7C3AED', 'fill-opacity': 0.08 },
    },
    // Polygon fill (active).
    {
      id: 'gl-draw-polygon-fill-active',
      type: 'fill',
      filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
      paint: { 'fill-color': '#7C3AED', 'fill-opacity': 0.12 },
    },
    // Polygon outline (inactive).
    {
      id: 'gl-draw-polygon-stroke-inactive',
      type: 'line',
      filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#6D28D9', 'line-width': 2 },
    },
    // Polygon outline (active).
    {
      id: 'gl-draw-polygon-stroke-active',
      type: 'line',
      filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#6D28D9', 'line-width': 2, 'line-dasharray': [0.4, 2] },
    },
    // Vertices.
    {
      id: 'gl-draw-polygon-and-line-vertex-halo-active',
      type: 'circle',
      filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point']],
      paint: { 'circle-radius': 5, 'circle-color': '#FFF' },
    },
    {
      id: 'gl-draw-polygon-and-line-vertex-active',
      type: 'circle',
      filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point']],
      paint: { 'circle-radius': 3, 'circle-color': '#6D28D9' },
    },
    // Midpoints.
    {
      id: 'gl-draw-polygon-midpoint',
      type: 'circle',
      filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']],
      paint: { 'circle-radius': 2.5, 'circle-color': '#A78BFA' },
    },
  ];
}
