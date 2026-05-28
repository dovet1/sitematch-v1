'use client';

import { useRef, useEffect, useState } from 'react';
import { useSketchStore } from '@/lib/sitesketcher-v2/state-manager';
import { measurementPreviewStore } from '@/lib/sitesketcher-v2/measurement-preview-store';
import { MAPBOX_TOKEN, MAP_STYLES } from '@/lib/sitesketcher-v2/constants';
import {
  initializeMap,
  setupMapboxDraw,
  setup3DLayer,
  setupParkingLayer,
  toggle3DLayer,
  syncDrawTo3D,
  syncParkingToMap,
  syncPolygonsTo3D,
  loadPolygonsIntoDraw,
  enterPolygonDrawMode,
  drawFeatureToPolygon,
} from '@/lib/sitesketcher-v2/mapbox-integration';
import { calculateEdgeDistance } from '@/lib/sitesketcher-v2/polygon-utils';
import { PolygonLabels } from './PolygonLabels';
import { MeasurementOverlay } from './MeasurementOverlay';
import { PolygonDrawPreviewOverlay } from './PolygonDrawPreviewOverlay';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [lng, lat] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [lngI, latI] = polygon[i];
    const [lngJ, latJ] = polygon[j];
    const intersects =
      latI > lat !== latJ > lat &&
      lng < ((lngJ - lngI) * (lat - latI)) / (latJ - latI) + lngI;

    if (intersects) inside = !inside;
  }

  return inside;
}

function getProjectedPolygonArea(map: mapboxgl.Map, polygon: [number, number][]): number {
  let area = 0;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const current = map.project(polygon[i]);
    const previous = map.project(polygon[j]);
    area += (previous.x + current.x) * (previous.y - current.y);
  }

  return Math.abs(area / 2);
}

function selectPolygonForVertexEditing(draw: MapboxDraw, polygonId: string): void {
  try {
    draw.changeMode('direct_select', { featureId: polygonId });
  } catch {
    draw.changeMode('simple_select', { featureIds: [polygonId] });
  }
}

export function MapCanvas() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const parkingDragRef = useRef<{ id: string; moved: boolean } | null>(null);
  const suppressNextMapClickRef = useRef(false);
  const isApplyingDrawUpdateRef = useRef(false);
  const isUserInteractionRef = useRef(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const {
    view,
    mapStyle,
    viewport,
    polygons,
    parkingBlocks,
    selectedId,
    selectedType,
    mapFocusRequest,
    activeTool,
    selectedPolygonColorIndex,
    measurementInProgress,
    setViewport,
    addPolygon,
    addParkingBlock,
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
      useSketchStore.getState().setMapInstance(map);

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
        setupParkingLayer(map);

        // Load existing polygons
        if (polygons.length > 0) {
          loadPolygonsIntoDraw(draw, polygons);
          syncPolygonsTo3D(map, polygons);
        }
        syncParkingToMap(
          map,
          useSketchStore.getState().parkingBlocks,
          useSketchStore.getState().selectedId
        );

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
          isApplyingDrawUpdateRef.current = true;

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
          if (selectedId) {
            setSelectedId(selectedId, 'polygon');
            return;
          }

          // Mapbox Draw emits an empty selection between direct_select targets.
          // Let the click hit-test below clear selection intentionally, otherwise
          // switching polygon A -> polygon B briefly closes/reopens inspector state.
          if (useSketchStore.getState().activeTool !== 'select') {
            setSelectedId(null, null);
          }
        });

        map.on('mouseenter', 'parking-block-fill', () => {
          const activeTool = useSketchStore.getState().activeTool;
          if (activeTool === 'select') {
            map.getCanvas().style.cursor = 'move';
          } else if (activeTool === 'parking') {
            map.getCanvas().style.cursor = 'crosshair';
          }
        });

        map.on('mouseleave', 'parking-block-fill', () => {
          if (!parkingDragRef.current) {
            const activeTool = useSketchStore.getState().activeTool;
            map.getCanvas().style.cursor =
              activeTool === 'parking' || activeTool === 'measure' ? 'crosshair' : '';
          }
        });

        map.on('mousedown', 'parking-block-fill', (event: any) => {
          const state = useSketchStore.getState();
          if (state.activeTool !== 'select' && state.activeTool !== 'parking') return;

          const parkingId = event.features?.[0]?.properties?.id;
          if (!parkingId) return;

          event.preventDefault();
          parkingDragRef.current = { id: parkingId, moved: false };
          state.pushHistory();
          state.setSelectedId(parkingId, 'parking');
          map.dragPan.disable();
          map.getCanvas().style.cursor = 'grabbing';
        });

        map.on('mousemove', (event) => {
          const dragState = parkingDragRef.current;
          if (dragState) {
            dragState.moved = true;
            useSketchStore.getState().moveParkingBlock(dragState.id, [
              event.lngLat.lng,
              event.lngLat.lat,
            ]);
            return;
          }

          // CRITICAL: Read live state - don't close over render state
          const latestState = useSketchStore.getState();

          // Only track when measure tool is active
          if (latestState.activeTool !== 'measure') return;

          const measurement = latestState.measurementInProgress;

          // Only show preview if at least one point exists
          if (!measurement || measurement.points.length === 0) return;

          // Get last confirmed measurement point
          const lastPoint = measurement.points[measurement.points.length - 1].lngLat;

          // Update preview store with cursor position
          measurementPreviewStore.setState({
            lastMeasurementPoint: lastPoint,
            currentCursorPosition: [event.lngLat.lng, event.lngLat.lat],
          });
        });

        map.on('mouseup', () => {
          const dragState = parkingDragRef.current;
          if (!dragState) return;

          suppressNextMapClickRef.current = true;
          parkingDragRef.current = null;
          map.dragPan.enable();
          const activeTool = useSketchStore.getState().activeTool;
          map.getCanvas().style.cursor =
            activeTool === 'parking' || activeTool === 'measure' ? 'crosshair' : '';
        });

        map.on('click', (event) => {
          if (suppressNextMapClickRef.current) {
            suppressNextMapClickRef.current = false;
            return;
          }

          const state = useSketchStore.getState();

          if (state.activeTool === 'parking') {
            const existingNames = state.parkingBlocks.map((parking) => parking.name);
            let nameIndex = 1;
            let name = `Parking ${nameIndex}`;
            while (existingNames.includes(name)) {
              nameIndex++;
              name = `Parking ${nameIndex}`;
            }

            const id = `parking-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
            addParkingBlock({
              id,
              name,
              spaces: state.parkingPlacement.spaces,
              layout: state.parkingPlacement.layout,
              stallSize: state.parkingPlacement.stallSize,
              anchor: [event.lngLat.lng, event.lngLat.lat],
              rotation: 0,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            });
            setSelectedId(id, 'parking');
            return;
          }

          if (state.activeTool === 'measure') {
            const lngLat: [number, number] = [event.lngLat.lng, event.lngLat.lat];

            // Start measurement if not already started
            if (!state.measurementInProgress) {
              state.startMeasurement();
            }

            // Get fresh state after startMeasurement
            const latestState = useSketchStore.getState();
            const prevPoint = latestState.measurementInProgress?.points.slice(-1)[0]?.lngLat;
            const distance = prevPoint
              ? calculateEdgeDistance(prevPoint, lngLat)
              : undefined;

            state.addMeasurementPoint(lngLat, distance);

            // Clear cursor position to prevent stale preview line
            measurementPreviewStore.setState({
              currentCursorPosition: null,
            });
            return;
          }

          if (state.activeTool === 'select') {
            const point = event.point;
            const lngLat: [number, number] = [event.lngLat.lng, event.lngLat.lat];

            window.setTimeout(() => {
              const latestState = useSketchStore.getState();

              if (map.getLayer('parking-block-fill')) {
                const parkingFeatures = map.queryRenderedFeatures(
                  [
                    [point.x - 4, point.y - 4],
                    [point.x + 4, point.y + 4],
                  ],
                  { layers: ['parking-block-fill'] }
                );
                const parkingId = parkingFeatures[0]?.properties?.id;

                if (parkingId) {
                  draw.changeMode('simple_select', { featureIds: [] });
                  latestState.setSelectedId(parkingId, 'parking');
                  return;
                }
              }

              const hitPolygon = latestState.polygons
                .filter((polygon) => isPointInPolygon(lngLat, polygon.points))
                .map((polygon) => ({
                  polygon,
                  area: getProjectedPolygonArea(map, polygon.points),
                }))
                .sort((a, b) => a.area - b.area)[0]?.polygon;

              if (hitPolygon) {
                selectPolygonForVertexEditing(draw, hitPolygon.id);
                latestState.setSelectedId(hitPolygon.id, 'polygon');
                return;
              }

              draw.changeMode('simple_select', { featureIds: [] });
              latestState.setSelectedId(null, null);
            }, 0);
          }
        });

        // Track viewport changes
        map.on('moveend', () => {
          if (isUserInteractionRef.current) {
            const center = map.getCenter();
            setViewport({
              center: [center.lng, center.lat],
              zoom: map.getZoom(),
              pitch: map.getPitch(),
              bearing: map.getBearing(),
            });
          }
          isUserInteractionRef.current = true;
        });

        setIsLoaded(true);
      });

      return () => {
        map.remove();
        mapRef.current = null;
        drawRef.current = null;
        useSketchStore.getState().setMapInstance(null);
      };
    } catch (error) {
      console.error('Failed to initialize map:', error);
      setMapError(error instanceof Error ? error.message : 'Failed to initialize map.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount - Zustand functions are stable

  // Handle map style changes
  useEffect(() => {
    if (mapRef.current && drawRef.current && isLoaded) {
      const map = mapRef.current;
      const draw = drawRef.current;

      map.once('style.load', () => {
        const is3D = useSketchStore.getState().view === '3d';
        setup3DLayer(map);
        setupParkingLayer(map);
        syncPolygonsTo3D(map, useSketchStore.getState().polygons);
        syncParkingToMap(
          map,
          useSketchStore.getState().parkingBlocks,
          useSketchStore.getState().selectedId
        );
        toggle3DLayer(map, is3D);
      });

      map.setStyle(MAP_STYLES[mapStyle]);
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
        syncPolygonsTo3D(mapRef.current, useSketchStore.getState().polygons);
      }
    }
  }, [view, isLoaded]);

  // Handle tool and selection changes
  useEffect(() => {
    if (mapRef.current && drawRef.current && isLoaded) {
      const map = mapRef.current;

      if (activeTool === 'polygon') {
        enterPolygonDrawMode(drawRef.current, mapRef.current);
      } else if (activeTool === 'select') {
        if (selectedId && selectedType === 'polygon') {
          selectPolygonForVertexEditing(drawRef.current, selectedId);
        } else {
          drawRef.current.changeMode('simple_select');
        }
      } else {
        // For measure, parking, cad tools: exit draw mode to prevent polygon vertex clicks
        drawRef.current.changeMode('simple_select');
      }

      // Set cursor style based on active tool
      if (activeTool === 'measure' || activeTool === 'parking') {
        map.getCanvas().style.cursor = 'crosshair';
      } else {
        map.getCanvas().style.cursor = '';
      }
    }
  }, [activeTool, selectedId, selectedType, isLoaded]);

  // Keep Mapbox's canvas in lockstep with the flex layout as panels open/close.
  useEffect(() => {
    if (!mapContainerRef.current || !mapRef.current || !isLoaded) return;

    const map = mapRef.current;
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });

    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [isLoaded]);

  // Sync polygon geometry changes from store back to Draw.
  // Selection changes are handled separately above to avoid deleteAll/re-add flashes.
  useEffect(() => {
    if (mapRef.current && drawRef.current && isLoaded) {
      if (isApplyingDrawUpdateRef.current) {
        isApplyingDrawUpdateRef.current = false;
      } else {
        loadPolygonsIntoDraw(drawRef.current, polygons);

        const { selectedId, selectedType } = useSketchStore.getState();
        if (selectedId && selectedType === 'polygon') {
          selectPolygonForVertexEditing(drawRef.current, selectedId);
        }
      }

      syncPolygonsTo3D(mapRef.current, polygons);
    }
  }, [polygons, isLoaded]);

  // Sync parking changes from store back to map layers
  useEffect(() => {
    if (mapRef.current && isLoaded) {
      syncParkingToMap(mapRef.current, parkingBlocks, selectedId);
    }
  }, [parkingBlocks, selectedId, isLoaded]);

  // Handle layer focus requests from panels.
  useEffect(() => {
    if (!mapRef.current || !isLoaded || !mapFocusRequest) return;

    const map = mapRef.current;
    if (mapFocusRequest.bounds) {
      const [southWest, northEast] = mapFocusRequest.bounds;
      const boundsAreCollapsed =
        southWest[0] === northEast[0] && southWest[1] === northEast[1];

      if (!boundsAreCollapsed) {
        map.fitBounds(new mapboxgl.LngLatBounds(southWest, northEast), {
          maxZoom: 19,
          duration: 1000,
          pitch: 0,
          bearing: map.getBearing(),
          essential: true,
        });
        return;
      }
    }

    map.flyTo({
      center: mapFocusRequest.center,
      zoom: mapFocusRequest.zoom ?? 18.5,
      pitch: 0,
      bearing: map.getBearing(),
      duration: 1000,
      essential: true,
    });
  }, [mapFocusRequest, isLoaded]);

  // Handle programmatic viewport changes (e.g., from location search)
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;

    const map = mapRef.current;
    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();

    // Check if viewport has changed significantly (more than just rounding differences)
    const centerChanged =
      Math.abs(currentCenter.lng - viewport.center[0]) > 0.0001 ||
      Math.abs(currentCenter.lat - viewport.center[1]) > 0.0001;
    const zoomChanged = Math.abs(currentZoom - viewport.zoom) > 0.01;

    if (centerChanged || zoomChanged) {
      // This is a programmatic change, not user interaction
      isUserInteractionRef.current = false;

      map.flyTo({
        center: viewport.center,
        zoom: viewport.zoom,
        pitch: viewport.pitch,
        bearing: viewport.bearing,
        duration: 1000,
        essential: true
      });
    }
  }, [viewport.center, viewport.zoom, viewport.pitch, viewport.bearing, isLoaded]);

  return (
    <div className="relative h-full w-full min-h-0 bg-sm-bg">
      <div ref={mapContainerRef} className="absolute inset-0 h-full w-full" />

      {/* Polygon labels overlay */}
      {isLoaded && <PolygonLabels />}

      {/* Measurement overlay */}
      {isLoaded && measurementInProgress && <MeasurementOverlay />}

      {/* Polygon drawing preview overlay */}
      {isLoaded && <PolygonDrawPreviewOverlay />}

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
