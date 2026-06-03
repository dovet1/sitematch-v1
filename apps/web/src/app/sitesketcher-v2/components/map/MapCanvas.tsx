'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
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
  addCadImageToMap,
  updateCadImageOnMap,
  removeCadImageFromMap,
} from '@/lib/sitesketcher-v2/mapbox-integration';
import { calculateCadImageCorners } from '@/lib/sitesketcher-v2/cad-utils';
import { calculateEdgeDistance } from '@/lib/sitesketcher-v2/polygon-utils';
import type { CadImage, CadInstance, SavedCad } from '@/types/sitesketcher-v2';
import { PolygonLabels } from './PolygonLabels';
import { MeasurementOverlay } from './MeasurementOverlay';
import { PolygonDrawPreviewOverlay } from './PolygonDrawPreviewOverlay';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { toast } from 'sonner';
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

type CadLayerHandlers = {
  mousedown: (e: mapboxgl.MapLayerMouseEvent) => void;
  mouseenter: () => void;
  mouseleave: () => void;
};

function findCadImageAtPoint(
  map: mapboxgl.Map,
  point: mapboxgl.Point,
  cadImages: CadImage[],
  cadInstances: CadInstance[],
  savedCads: SavedCad[]
): string | null {
  // Check Plus access - no CAD interaction for non-Plus users
  const { effectiveAccess } = useSketchStore.getState();
  if (!effectiveAccess.hasPlusAccess) {
    return null;
  }

  const placedCadItems: Array<{
    id: string;
    corners: [[number, number], [number, number], [number, number], [number, number]];
  }> = [
    ...cadImages
      .filter((cadImage) => cadImage.anchor !== null)
      .map((cadImage) => ({
        id: cadImage.id,
        corners: calculateCadImageCorners(cadImage),
      })),
    ...cadInstances.flatMap((instance) => {
      const savedCad = savedCads.find((cad) => cad.id === instance.savedCadId);
      if (!savedCad) return [];

      return [{
        id: instance.id,
        corners: calculateCadImageCorners(instance, savedCad),
      }];
    }),
  ];

  for (const cadItem of [...placedCadItems].reverse()) {
    const screenCorners = cadItem.corners.map((corner) => {
      const projected = map.project(corner);
      return [projected.x, projected.y] as [number, number];
    });

    if (isPointInPolygon([point.x, point.y], screenCorners)) {
      return cadItem.id;
    }
  }

  return null;
}

function getCadInteractionState(id: string): { locked: boolean; exists: boolean } {
  const state = useSketchStore.getState();
  const legacyCad = state.cadImages.find((cad) => cad.id === id);
  if (legacyCad) {
    return { locked: Boolean(legacyCad.locked), exists: legacyCad.anchor !== null };
  }

  const instance = state.cadInstances.find((cadInstance) => cadInstance.id === id);
  if (instance) {
    return { locked: Boolean(instance.locked), exists: true };
  }

  return { locked: false, exists: false };
}

export function MapCanvas() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const parkingDragRef = useRef<{ id: string; moved: boolean } | null>(null);
  const cadDragRef = useRef<{ id: string; moved: boolean } | null>(null);
  const suppressNextMapClickRef = useRef(false);
  const isApplyingDrawUpdateRef = useRef(false);
  const isProgrammaticDrawSyncRef = useRef(false);
  const isUserInteractionRef = useRef(true);
  const cadLayerHandlersRef = useRef<Map<string, CadLayerHandlers>>(new Map());
  const [isLoaded, setIsLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const {
    view,
    mapStyle,
    viewport,
    polygons,
    parkingBlocks,
    cadImages,
    cadInstances,
    savedCads,
    getCadForInstance,
    selectedId,
    selectedType,
    mapFocusRequest,
    activeTool,
    selectedPolygonColorIndex,
    measurementInProgress,
    frozenMeasurement,
    cadPlacementInProgress,
    setViewport,
    addPolygon,
    addParkingBlock,
    updatePolygon,
    deletePolygon,
    setSelectedId,
    moveCadImage,
    updateCadInstance,
    placeCadImage,
    placeCadInstance,
    cancelCadPlacement,
  } = useSketchStore();

  // CAD drag handlers - use live store reads to avoid listener churn
  const handleCadMouseDown = useCallback((
    e: mapboxgl.MapMouseEvent | mapboxgl.MapLayerMouseEvent,
    cadId: string
  ) => {
    const id = cadId;
    if (!id || !mapRef.current) return;

    // CRITICAL: Live store read instead of dependency - prevents re-registration during drag
    const state = useSketchStore.getState();
    if (state.cadPlacementInProgress) return;
    if (state.activeTool !== 'select' && state.activeTool !== 'cad') return;

    const cadState = getCadInteractionState(id);
    if (!cadState.exists || cadState.locked) return;

    e.preventDefault();

    // CRITICAL: Disable map drag pan (mirror parking drag behavior)
    mapRef.current.dragPan.disable();

    cadDragRef.current = { id, moved: false };
    suppressNextMapClickRef.current = true;
    mapRef.current.getCanvas().style.cursor = 'grabbing';
    setSelectedId(id, 'cad');
    // REMOVE: pushHistory(); - CAD operations deferred from undo system (see Known Limitations)
  }, [setSelectedId]);

  const handleCadMouseMove = useCallback((e: mapboxgl.MapMouseEvent) => {
    if (!cadDragRef.current) return;

    const { id } = cadDragRef.current;
    cadDragRef.current.moved = true;

    const state = useSketchStore.getState();
    const anchor: [number, number] = [e.lngLat.lng, e.lngLat.lat];
    if (state.cadInstances.some((instance) => instance.id === id)) {
      updateCadInstance(id, { anchor });
    } else {
      moveCadImage(id, anchor);
    }
  }, [moveCadImage, updateCadInstance]);

  const handleCadMouseUp = useCallback(() => {
    if (cadDragRef.current && mapRef.current) {
      // CRITICAL: Re-enable map drag pan
      mapRef.current.dragPan.enable();
      mapRef.current.getCanvas().style.cursor = '';
      cadDragRef.current = null;
      // History already pushed on mousedown, no action needed here
    }
  }, []);

  // CRITICAL: Use live store read for locked state to avoid listener churn
  const handleCadMouseEnter = useCallback((cadId: string) => () => {
    if (!mapRef.current) return;
    const cadState = getCadInteractionState(cadId);
    if (cadState.exists && !cadState.locked) {
      mapRef.current.getCanvas().style.cursor = 'grab';
    }
  }, []);

  const handleCadMouseLeave = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.getCanvas().style.cursor = '';
    }
  }, []);

  const unregisterCadLayerHandlers = useCallback((map: mapboxgl.Map, cadId: string) => {
    const handlers = cadLayerHandlersRef.current.get(cadId);
    if (!handlers) return;

    try {
      map.off('mousedown', `cad-layer-${cadId}`, handlers.mousedown);
      map.off('mouseenter', `cad-layer-${cadId}`, handlers.mouseenter);
      map.off('mouseleave', `cad-layer-${cadId}`, handlers.mouseleave);
    } catch (error) {
      console.warn(`Failed to remove CAD layer handlers for ${cadId}:`, error);
    } finally {
      cadLayerHandlersRef.current.delete(cadId);
    }
  }, []);

  const unregisterAllCadLayerHandlers = useCallback((map: mapboxgl.Map) => {
    Array.from(cadLayerHandlersRef.current.keys()).forEach((cadId) => {
      unregisterCadLayerHandlers(map, cadId);
    });
  }, [unregisterCadLayerHandlers]);

  const registerCadLayerHandlers = useCallback((map: mapboxgl.Map, cadId: string) => {
    if (cadLayerHandlersRef.current.has(cadId)) return;
    if (!map.getLayer(`cad-layer-${cadId}`)) return;

    const mouseenterHandler = handleCadMouseEnter(cadId);
    const handlers: CadLayerHandlers = {
      mousedown: (event) => handleCadMouseDown(event, cadId),
      mouseenter: mouseenterHandler,
      mouseleave: handleCadMouseLeave,
    };

    map.on('mousedown', `cad-layer-${cadId}`, handlers.mousedown);
    map.on('mouseenter', `cad-layer-${cadId}`, handlers.mouseenter);
    map.on('mouseleave', `cad-layer-${cadId}`, handlers.mouseleave);

    cadLayerHandlersRef.current.set(cadId, handlers);
  }, [handleCadMouseDown, handleCadMouseEnter, handleCadMouseLeave]);

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
          const { checkPolygonLimit } = useSketchStore.getState();

          // Check limit BEFORE processing the polygon
          if (!checkPolygonLimit()) {
            // Delete the just-created draw feature
            const featureIds = e.features.map((f: any) => f.id);
            draw.delete(featureIds);

            toast.error('Polygon limit reached. Upgrade to Pro for unlimited polygons.');
            return; // Block polygon creation
          }

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

          // Skip if this is a programmatic sync operation
          if (isProgrammaticDrawSyncRef.current) {
            return;
          }

          e.features.forEach((feature: any) => {
            // Additional safety: only delete if polygon still exists in state
            const exists = useSketchStore.getState().polygons.some(p => p.id === feature.id);
            if (exists) {
              deletePolygon(feature.id);
            }
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

        map.on('mousedown', (event) => {
          const state = useSketchStore.getState();
          if (state.cadPlacementInProgress) return;
          if (state.activeTool !== 'select' && state.activeTool !== 'cad') return;

          const cadId = findCadImageAtPoint(
            map,
            event.point,
            state.cadImages,
            state.cadInstances,
            state.savedCads
          );
          if (!cadId) return;

          handleCadMouseDown(event, cadId);
        });

        map.on('mousemove', (event) => {
          // Handle CAD drag
          handleCadMouseMove(event);

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
          // Handle CAD drag
          handleCadMouseUp();

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

          // Handle CAD placement (highest priority)
          if (state.cadPlacementInProgress) {
            // Check Plus access before CAD placement
            const { effectiveAccess } = state;
            if (!effectiveAccess.hasPlusAccess) {
              toast.error('CAD overlay requires Plus subscription.');
              return;
            }

            const anchor: [number, number] = [event.lngLat.lng, event.lngLat.lat];

            // NEW: Check if this is a savedCadId (new flow) or legacy cadImageId
            if (typeof state.cadPlacementInProgress === 'object' && 'savedCadId' in state.cadPlacementInProgress) {
              // New flow: create instance from savedCadId
              placeCadInstance(state.cadPlacementInProgress.savedCadId, anchor);
            } else {
              // Legacy flow: place existing cadImage
              placeCadImage(state.cadPlacementInProgress as string, anchor);
            }
            return;
          }

          if (state.activeTool === 'parking') {
            // Check parking limit before placement
            const { checkParkingLimit } = state;
            if (!checkParkingLimit()) {
              toast.error('Parking limit reached. Upgrade to Pro for unlimited parking blocks.');
              return;
            }

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

            // Don't allow new points if there's a frozen measurement
            if (state.frozenMeasurement) {
              return;
            }

            // Check measurement limit before adding point
            const { checkMeasurementLimit } = state;
            if (!checkMeasurementLimit()) {
              toast.error('Measurement segment limit reached (20 segments). Upgrade to Pro for unlimited measurements.');
              return;
            }

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

              // Check for CAD layer clicks
              const cadLayers = [
                ...latestState.cadImages
                  .filter(c => c.anchor !== null)
                  .map(c => `cad-layer-${c.id}`),
                ...latestState.cadInstances.map(instance => `cad-layer-${instance.id}`),
              ].filter(layerId => map.getLayer(layerId));

              if (cadLayers.length > 0) {
                const cadFeatures = map.queryRenderedFeatures(
                  [
                    [point.x - 4, point.y - 4],
                    [point.x + 4, point.y + 4],
                  ],
                  { layers: cadLayers }
                );

                const cadFeatureLayerId = cadFeatures[0]?.layer?.id;
                if (cadFeatureLayerId) {
                  const cadId = cadFeatureLayerId.replace('cad-layer-', '');
                  draw.changeMode('simple_select', { featureIds: [] });
                  latestState.setSelectedId(cadId, 'cad');
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
        unregisterAllCadLayerHandlers(map);
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

      unregisterAllCadLayerHandlers(map);

      map.once('style.load', () => {
        const is3D = useSketchStore.getState().view === '3d';
        setup3DLayer(map);
        setupParkingLayer(map);

        // Re-add CAD layers (skip unplaced)
        const currentCadImages = useSketchStore.getState().cadImages;
        currentCadImages.forEach(cadImage => {
          if (cadImage.anchor !== null) { // ONLY add placed CADs
            addCadImageToMap(map, cadImage);
            registerCadLayerHandlers(map, cadImage.id);
          }
        });

        const state = useSketchStore.getState();
        state.cadInstances.forEach(instance => {
          const savedCad = state.savedCads.find(cad => cad.id === instance.savedCadId);
          if (savedCad) {
            addCadImageToMap(map, instance, savedCad);
            registerCadLayerHandlers(map, instance.id);
          }
        });

        // IMPORTANT: Keep existing live state reads (lines 473-478)
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
  }, [mapStyle, isLoaded, registerCadLayerHandlers, unregisterAllCadLayerHandlers]);

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
      if (activeTool === 'measure' || activeTool === 'parking' || cadPlacementInProgress) {
        map.getCanvas().style.cursor = 'crosshair';
      } else {
        map.getCanvas().style.cursor = '';
      }
    }
  }, [activeTool, selectedId, selectedType, isLoaded, cadPlacementInProgress]);

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
        // Guard only the programmatic sync that calls deleteAll
        isProgrammaticDrawSyncRef.current = true;
        try {
          loadPolygonsIntoDraw(drawRef.current, polygons);
        } finally {
          isProgrammaticDrawSyncRef.current = false;
        }

        // Selection changes happen after sync guard is released
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

  // Sync CAD images with map
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;

    const map = mapRef.current;

    // Remove layers not in state OR that are now unplaced
    const layerIds = map.getStyle().layers
      .filter(l => l.id.startsWith('cad-layer-'))
      .map(l => l.id.replace('cad-layer-', ''));

    layerIds.forEach(id => {
      const cad = cadImages.find(c => c.id === id);
      const instance = cadInstances.find(c => c.id === id);
      // Remove if CAD deleted OR if CAD unplaced (e.g., via undo)
      if (!instance && (!cad || cad.anchor === null)) {
        unregisterCadLayerHandlers(map, id);
        removeCadImageFromMap(map, id);
      }
    });

    // Add/update layers from state
    cadImages.forEach(cadImage => {
      // Skip unplaced CADs
      if (cadImage.anchor === null) return;

      if (map.getSource(`cad-image-${cadImage.id}`)) {
        updateCadImageOnMap(map, cadImage);
      } else {
        addCadImageToMap(map, cadImage);
      }
      registerCadLayerHandlers(map, cadImage.id);
    });
  }, [cadImages, cadInstances, isLoaded, registerCadLayerHandlers, unregisterCadLayerHandlers]);

  // NEW: Sync cadInstances to map
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return;
    const map = mapRef.current;

    // Remove instance layers not in state
    const layerIds = map.getStyle().layers
      .filter(l => l.id.startsWith('cad-layer-'))
      .map(l => l.id.replace('cad-layer-', ''));

    layerIds.forEach(id => {
      const instance = cadInstances.find(i => i.id === id);
      if (!instance) {
        // Check if it's a legacy cadImage before removing
        const isLegacyCad = cadImages.find(c => c.id === id);
        if (!isLegacyCad) {
          unregisterCadLayerHandlers(map, id);
          removeCadImageFromMap(map, id);
        }
      }
    });

    // Add/update instance layers
    cadInstances.forEach(instance => {
      const savedCad = getCadForInstance(instance.id);
      if (!savedCad) {
        // Orphaned instance - skip rendering
        return;
      }

      if (map.getSource(`cad-image-${instance.id}`)) {
        updateCadImageOnMap(map, instance, savedCad);
      } else {
        addCadImageToMap(map, instance, savedCad);
      }
      registerCadLayerHandlers(map, instance.id);
    });
  }, [cadInstances, savedCads, getCadForInstance, isLoaded, registerCadLayerHandlers, unregisterCadLayerHandlers]);

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

  // Cancel CAD placement on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && cadPlacementInProgress) {
        cancelCadPlacement();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cadPlacementInProgress, cancelCadPlacement]);

  return (
    <div className="relative h-full w-full min-h-0 bg-sm-bg">
      <div ref={mapContainerRef} className="absolute inset-0 h-full w-full" />

      {/* Polygon labels overlay */}
      {isLoaded && <PolygonLabels />}

      {/* Measurement overlay */}
      {isLoaded && (measurementInProgress || frozenMeasurement) && <MeasurementOverlay />}

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
