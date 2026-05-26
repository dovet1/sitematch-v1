'use client';

import { useRef, useEffect, useState } from 'react';
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager';
import { MAPBOX_TOKEN, MAP_STYLES } from '@/lib/sitesketcher-v2/constants';
import {
  initializeMap,
  setupMapboxDraw,
  setup3DLayer,
  toggle3DLayer,
  syncDrawTo3D,
  loadPolygonsIntoDraw,
  enterPolygonDrawMode,
  drawFeatureToPolygon,
} from '@/lib/sitesketcher-v2/mapbox-integration';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

export function MapCanvas() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const {
    view,
    mapStyle,
    viewport,
    polygons,
    activeTool,
    selectedPolygonColorIndex,
    setViewport,
    addPolygon,
    updatePolygon,
    deletePolygon,
    setSelectedId,
  } = useSketchStore();

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    if (!MAPBOX_TOKEN) {
      console.error('Mapbox token not found');
      setMapError('Mapbox token not found. Set NEXT_PUBLIC_MAPBOX_TOKEN to load the map.');
      return;
    }

    try {
      setMapError(null);
      const map = initializeMap(mapContainerRef.current, {
        center: viewport.center,
        zoom: viewport.zoom,
        pitch: viewport.pitch,
        bearing: viewport.bearing,
        style: MAP_STYLES[mapStyle],
        accessToken: MAPBOX_TOKEN,
      });

      mapRef.current = map;

      map.on('error', (event) => {
        console.error('Mapbox error:', event.error);
        setMapError(event.error?.message || 'Mapbox failed to load.');
      });

      map.on('load', () => {
        // Setup Mapbox Draw
        const draw = setupMapboxDraw(map);
        drawRef.current = draw;

        // Setup 3D layer
        setup3DLayer(map);

        // Load existing polygons
        if (polygons.length > 0) {
          loadPolygonsIntoDraw(draw, polygons);
          syncDrawTo3D(map, draw);
        }

        // Setup Draw event listeners
        map.on('draw.create', (e: any) => {
          e.features.forEach((feature: any) => {
            // Convert Draw feature to Zustand polygon
            const polygon = drawFeatureToPolygon(feature);

            // Generate unique name based on existing polygons
            const currentPolygons = useSketchStore.getState().polygons;
            const existingNames = currentPolygons.map(p => p.name);
            let nameIndex = 0;
            let newName = `Plot ${String.fromCharCode(65 + nameIndex)}`;
            while (existingNames.includes(newName)) {
              nameIndex++;
              newName = `Plot ${String.fromCharCode(65 + nameIndex)}`;
            }

            // Use selected color index from state
            const colorIndex = useSketchStore.getState().selectedPolygonColorIndex;

            // Add to store with generated name and selected color
            addPolygon({
              ...polygon,
              name: newName,
              colorIndex,
            });
          });

          // Sync to 3D layer
          syncDrawTo3D(map, draw);
        });

        map.on('draw.update', (e: any) => {
          e.features.forEach((feature: any) => {
            // Convert Draw feature to Polygon updates
            const updatedPolygon = drawFeatureToPolygon(feature);

            // Update Zustand state (triggers history, marks dirty)
            updatePolygon(feature.id, {
              points: updatedPolygon.points,
              updatedAt: Date.now(),
            });
          });

          // Sync to 3D layer
          syncDrawTo3D(map, draw);
        });

        map.on('draw.delete', (e: any) => {
          console.log('Draw delete:', e);
          e.features.forEach((feature: any) => {
            deletePolygon(feature.id);
          });
          syncDrawTo3D(map, draw);
        });

        map.on('draw.selectionchange', (e: any) => {
          const selectedId = e.features[0]?.id || null;
          setSelectedId(selectedId, selectedId ? 'polygon' : null);
        });

        // Track viewport changes
        map.on('moveend', () => {
          const center = map.getCenter();
          setViewport({
            center: [center.lng, center.lat],
            zoom: map.getZoom(),
            pitch: map.getPitch(),
            bearing: map.getBearing(),
          });
        });

        setIsLoaded(true);
      });

      return () => {
        map.remove();
        mapRef.current = null;
        drawRef.current = null;
      };
    } catch (error) {
      console.error('Failed to initialize map:', error);
      setMapError(error instanceof Error ? error.message : 'Failed to initialize map.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount - Zustand functions are stable

  // Handle map style changes
  useEffect(() => {
    if (mapRef.current && isLoaded) {
      mapRef.current.setStyle(MAP_STYLES[mapStyle]);
    }
  }, [mapStyle, isLoaded]);

  // Handle view mode changes
  useEffect(() => {
    if (mapRef.current && drawRef.current && isLoaded) {
      const is3D = view === '3d';

      // Toggle 3D layer
      toggle3DLayer(mapRef.current, is3D);

      // Animate camera
      mapRef.current.easeTo({
        pitch: is3D ? 60 : 0,
        duration: 600,
      });

      // Sync if entering 3D
      if (is3D) {
        syncDrawTo3D(mapRef.current, drawRef.current);
      }
    }
  }, [view, isLoaded]);

  // Handle tool changes
  useEffect(() => {
    if (mapRef.current && drawRef.current && isLoaded) {
      if (activeTool === 'polygon') {
        enterPolygonDrawMode(drawRef.current, mapRef.current);
      } else if (activeTool === 'select') {
        drawRef.current.changeMode('simple_select');
      }
    }
  }, [activeTool, isLoaded]);

  // Sync polygon changes from store back to Draw
  useEffect(() => {
    if (mapRef.current && drawRef.current && isLoaded) {
      loadPolygonsIntoDraw(drawRef.current, polygons);
      syncDrawTo3D(mapRef.current, drawRef.current);
    }
  }, [polygons, isLoaded]);

  return (
    <div className="relative h-full w-full min-h-0 bg-sm-bg">
      <div ref={mapContainerRef} className="absolute inset-0 h-full w-full" />

      {!isLoaded && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-sm-bg">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 border-4 border-sm-border border-t-sm-violet rounded-full animate-spin" />
            <p className="text-sm text-sm-ink/60">Loading map...</p>
          </div>
        </div>
      )}

      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-sm-bg">
          <div className="max-w-md rounded-sm-compact border border-sm-border bg-sm-surface p-5 text-center shadow-sm">
            <p className="mb-2 text-sm font-semibold text-sm-ink">Map failed to load</p>
            <p className="text-sm text-sm-ink/60">{mapError}</p>
          </div>
        </div>
      )}

      {/* 3D vignette overlay */}
      <div className={`view-3d-vignette ${view === '3d' ? 'view-3d' : ''}`} />
    </div>
  );
}
