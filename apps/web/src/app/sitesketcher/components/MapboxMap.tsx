'use client';

import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { createMapboxMap, getMapboxToken, flyToLocation, addGridOverlay, removeGridOverlay } from '@/lib/sitesketcher/mapbox-utils';
import type { MapboxDrawPolygon, ParkingOverlay, SearchResult, AreaMeasurement, MeasurementUnit, DrawingMode } from '@/types/sitesketcher';
import { calculateDistance, formatDistance, calculatePolygonArea } from '@/lib/sitesketcher/measurement-utils';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

interface MapboxMapProps {
  onPolygonCreate: (polygon: MapboxDrawPolygon) => void;
  onPolygonUpdate: (polygon: MapboxDrawPolygon) => void;
  onPolygonDelete: (polygonId: string) => void;
  parkingOverlays: ParkingOverlay[];
  onParkingOverlayClick: (overlay: ParkingOverlay) => void;
  onParkingOverlayUpdate: (overlay: ParkingOverlay) => void;
  onClearParkingSelection?: () => void;
  searchResult?: SearchResult | null;
  snapToGrid: boolean;
  gridSize: number;
  polygons: MapboxDrawPolygon[];
  selectedPolygonId: string | null;
  selectedParkingId: string | null;
  measurements: AreaMeasurement | null;
  measurementUnit: MeasurementUnit;
  drawingMode: DrawingMode;
  showSideLengths: boolean;
  className?: string;
}

export interface MapboxMapRef {
  clearAllDrawings: () => void;
  deletePolygon: (polygonId: string) => void;
  isRotating: () => boolean;
  getOriginalCoordinates: () => number[][] | null;
}

export const MapboxMap = forwardRef<MapboxMapRef, MapboxMapProps>(({
  onPolygonCreate,
  onPolygonUpdate,
  onPolygonDelete,
  parkingOverlays,
  onParkingOverlayClick,
  onParkingOverlayUpdate,
  onClearParkingSelection,
  searchResult,
  snapToGrid,
  gridSize,
  polygons,
  selectedPolygonId,
  selectedParkingId,
  measurements,
  measurementUnit,
  drawingMode,
  showSideLengths,
  className = ''
}, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [rotationStartAngle, setRotationStartAngle] = useState(0);
  const [polygonCenter, setPolygonCenter] = useState<[number, number] | null>(null);
  const drawingModeRef = useRef<DrawingMode>(drawingMode);
  const selectedPolygonIdRef = useRef<string | null>(selectedPolygonId);
  const polygonsRef = useRef<MapboxDrawPolygon[]>(polygons);
  const isDrawingRef = useRef<boolean>(false);
  const drawingPointsRef = useRef<number[][]>([]);
  const measurementUnitRef = useRef<MeasurementUnit>(measurementUnit);
  const lastClickedPointRef = useRef<[number, number] | null>(null);
  const isDrawingModeRef = useRef<boolean>(false);
  const showSideLengthsRef = useRef<boolean>(showSideLengths);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    clearAllDrawings: () => {
      if (drawRef.current && mapRef.current) {
        const draw = drawRef.current;
        const map = mapRef.current;
        
        // Delete all drawings
        draw.deleteAll();
        
        // Re-enter appropriate mode based on current drawing mode
        if (drawingModeRef.current === 'draw') {
          draw.changeMode('draw_polygon');
        } else {
          draw.changeMode('simple_select');
        }
        
        // Restore appropriate cursor
        if (drawingModeRef.current === 'draw') {
          map.getCanvas().style.cursor = 'crosshair';
        } else {
          map.getCanvas().style.cursor = '';
        }
      }
      
      // Also clear side annotations, rotation handles, and drawing annotations immediately
      if (mapRef.current && isMapLoaded) {
        const sideSource = mapRef.current.getSource('side-annotations') as mapboxgl.GeoJSONSource;
        if (sideSource) {
          sideSource.setData({
            type: 'FeatureCollection',
            features: []
          });
        }
        
        const rotationSource = mapRef.current.getSource('polygon-rotation-handles') as mapboxgl.GeoJSONSource;
        if (rotationSource) {
          rotationSource.setData({
            type: 'FeatureCollection',
            features: []
          });
        }
        
        const drawingSource = mapRef.current.getSource('drawing-annotation') as mapboxgl.GeoJSONSource;
        if (drawingSource) {
          drawingSource.setData({
            type: 'FeatureCollection',
            features: []
          });
        }
        
        // Clear colored polygon overlays
        const coloredPolygonsSource = mapRef.current.getSource('colored-polygons') as mapboxgl.GeoJSONSource;
        if (coloredPolygonsSource) {
          coloredPolygonsSource.setData({
            type: 'FeatureCollection',
            features: []
          });
        }
        
        setPolygonCenter(null);
        originalPolygonRef.current = null;
        totalRotationRef.current = 0;
      }
    },
    deletePolygon: (polygonId: string) => {
      if (drawRef.current && mapRef.current) {
        const draw = drawRef.current;
        
        // Debug: Log what we're trying to delete vs what exists
        let allFeatures = draw.getAll();
        console.log('MapboxMap.deletePolygon - Trying to delete:', polygonId);
        console.log('MapboxMap.deletePolygon - Available features:', allFeatures.features.map(f => ({
          id: f.id,
          type: f.geometry.type
        })));
        
        // First deselect any selected features
        const selectedIds = draw.getSelectedIds();
        console.log('Selected IDs before delete:', selectedIds);
        if (selectedIds.length > 0) {
          draw.changeMode('simple_select');
        }
        
        // Delete the specific polygon from Mapbox Draw
        console.log('About to delete polygon:', polygonId);
        draw.delete([polygonId]);
        
        // Clean up custom annotation layers for this polygon
        if (mapRef.current && isMapLoaded) {
          const sideSource = mapRef.current.getSource('side-annotations') as mapboxgl.GeoJSONSource;
          if (sideSource) {
            const currentData = sideSource._data as any;
            if (currentData && currentData.features) {
              // Remove annotations related to the deleted polygon
              const filteredFeatures = currentData.features.filter((feature: any) => {
                return feature.properties?.polygonId !== polygonId;
              });
              sideSource.setData({
                type: 'FeatureCollection',
                features: filteredFeatures
              });
            }
          }
          
          const rotationSource = mapRef.current.getSource('polygon-rotation-handles') as mapboxgl.GeoJSONSource;
          if (rotationSource) {
            const currentData = rotationSource._data as any;
            if (currentData && currentData.features) {
              // Remove rotation handles for the deleted polygon
              const filteredHandles = currentData.features.filter((feature: any) => {
                return feature.properties?.polygonId !== polygonId;
              });
              rotationSource.setData({
                type: 'FeatureCollection',
                features: filteredHandles
              });
            }
          }
          
          // Force a redraw/refresh of the map
          mapRef.current.triggerRepaint();
        }
        
        // Check what's left after deletion
        const remainingFeatures = draw.getAll();
        console.log('Features remaining after delete:', remainingFeatures.features.length);
        console.log('Remaining feature IDs:', remainingFeatures.features.map(f => f.id));
        
        // Clear annotations and handles if no polygons remain
        allFeatures = draw.getAll();
        if (allFeatures.features.length === 0) {
          if (mapRef.current && isMapLoaded) {
            const sideSource = mapRef.current.getSource('side-annotations') as mapboxgl.GeoJSONSource;
            if (sideSource) {
              sideSource.setData({
                type: 'FeatureCollection',
                features: []
              });
            }
            
            const rotationSource = mapRef.current.getSource('polygon-rotation-handles') as mapboxgl.GeoJSONSource;
            if (rotationSource) {
              rotationSource.setData({
                type: 'FeatureCollection',
                features: []
              });
            }
            
            setPolygonCenter(null);
            originalPolygonRef.current = null;
            totalRotationRef.current = 0;
          }
        }
        
        // Return to appropriate mode after deletion
        if (drawingModeRef.current === 'draw') {
          draw.changeMode('draw_polygon');
        } else {
          draw.changeMode('simple_select');
        }
      }
    },
    isRotating: () => isRotatingRef.current,
    getOriginalCoordinates: () => originalPolygonRef.current
  }), [isMapLoaded]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    try {
      const map = createMapboxMap(mapContainer.current, {
        style: 'mapbox://styles/mapbox/satellite-v9'
      });

      // Initialize Mapbox Draw
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: {},
        styles: [
          // Polygon fill
          {
            id: 'gl-draw-polygon-fill-inactive',
            type: 'fill',
            filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon']],
            paint: {
              'fill-color': 'transparent', // Make completed polygons invisible
              'fill-opacity': 0
            }
          },
          {
            id: 'gl-draw-polygon-fill-active',
            type: 'fill',
            filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
            paint: {
              'fill-color': [
                'case',
                ['has', 'color'],
                ['get', 'color'],
                '#3b82f6'
              ],
              'fill-opacity': 0.4
            }
          },
          // Polygon stroke
          {
            id: 'gl-draw-polygon-stroke-inactive',
            type: 'line',
            filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon']],
            paint: {
              'line-color': 'transparent', // Make completed polygon outlines invisible
              'line-width': 0
            }
          },
          {
            id: 'gl-draw-polygon-stroke-active',
            type: 'line',
            filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
            paint: {
              'line-color': [
                'case',
                ['has', 'color'],
                ['get', 'color'],
                '#3b82f6'
              ],
              'line-width': 3
            }
          },
          // Vertex points
          {
            id: 'gl-draw-polygon-vertex-stroke-inactive',
            type: 'circle',
            filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point']],
            paint: {
              'circle-radius': 5,
              'circle-color': '#ffffff',
              'circle-stroke-color': '#2563eb',
              'circle-stroke-width': 2
            }
          },
          {
            id: 'gl-draw-polygon-vertex-active',
            type: 'circle',
            filter: ['all', ['==', 'meta', 'vertex'], ['==', '$type', 'Point'], ['==', 'active', 'true']],
            paint: {
              'circle-radius': 6,
              'circle-color': '#ffffff',
              'circle-stroke-color': '#3b82f6',
              'circle-stroke-width': 3
            }
          }
        ]
      });

      map.addControl(draw);
      // Navigation controls removed for cleaner mobile interface
      
      // Mobile-specific gesture handling
      const isMobile = () => window.innerWidth < 768;
      
      if (isMobile()) {
        // Disable map rotation on mobile to prevent conflicts
        map.touchZoomRotate.disableRotation();
        
        // Track touch state for gesture conflict resolution
        let touchStartTime = 0;
        let isSingleTouch = false;
        
        // Handle touch start
        map.on('touchstart', (e) => {
          const touches = (e.originalEvent as TouchEvent).touches;
          touchStartTime = Date.now();
          isSingleTouch = touches.length === 1;
          
          if (drawingModeRef.current === 'draw' && isSingleTouch) {
            // Prevent default map panning in draw mode
            e.preventDefault();
          }
        });
        
        // Handle touch end for drawing
        map.on('touchend', (e) => {
          const touchDuration = Date.now() - touchStartTime;
          
          // Only process as drawing tap if:
          // 1. In draw mode
          // 2. Was single touch
          // 3. Quick tap (< 300ms)
          // 4. Not much movement
          if (drawingModeRef.current === 'draw' && 
              isSingleTouch && 
              touchDuration < 300) {
            
            const point = e.point;
            const lngLat = map.unproject(point);
            
            // Show touch indicator
            const indicator = document.createElement('div');
            indicator.className = 'touch-indicator';
            indicator.style.left = `${point.x}px`;
            indicator.style.top = `${point.y}px`;
            mapContainer.current?.appendChild(indicator);
            
            // Remove indicator after animation
            setTimeout(() => {
              indicator.remove();
            }, 600);
            
            // Trigger draw point at this location
            const features = draw.getAll();
            if (features.features.length > 0) {
              const currentFeature = features.features[features.features.length - 1];
              if (currentFeature.geometry.type === 'Polygon' && 
                  currentFeature.geometry.coordinates[0].length > 0) {
                // Drawing in progress - handled by Mapbox Draw
              }
            }
          }
        });
        
        // Disable single-finger pan in draw mode
        map.on('drag', (e) => {
          if (drawingModeRef.current === 'draw' && isSingleTouch) {
            e.originalEvent?.preventDefault();
          }
        });
      }
      // Scale control also removed for minimal mobile interface

      mapRef.current = map;
      drawRef.current = draw;

      map.on('load', () => {
        setIsMapLoaded(true);
        
        // Initialize parking overlay source
        map.addSource('parking-overlays', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        });

        // Add parking overlay layers
        map.addLayer({
          id: 'parking-overlays-fill',
          type: 'fill',
          source: 'parking-overlays',
          filter: ['==', ['geometry-type'], 'Polygon'],
          paint: {
            'fill-color': '#4a5568', // Gray for parking surface
            'fill-opacity': 0.7
          }
        });

        // Individual parking spaces no longer need grid lines - each space has its own border

        map.addLayer({
          id: 'parking-overlays-stroke',
          type: 'line',
          source: 'parking-overlays',
          filter: ['==', ['geometry-type'], 'Polygon'],
          paint: {
            'line-color': '#1f2937', // Dark gray border
            'line-width': 3,
            'line-opacity': 1
          }
        });

        // Add parking overlay rotation handles
        map.addSource('rotation-handles', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        });

        map.addLayer({
          id: 'rotation-handles',
          type: 'circle',
          source: 'rotation-handles',
          filter: ['==', ['get', 'type'], 'rotation-handle'],
          paint: {
            'circle-radius': 6,
            'circle-color': '#ffffff',
            'circle-stroke-color': '#2563eb',
            'circle-stroke-width': 2
          }
        });

        // Add parking rotation handles layer
        map.addLayer({
          id: 'parking-rotation-handles',
          type: 'circle',
          source: 'rotation-handles',
          filter: ['==', ['get', 'type'], 'parking-rotation-handle'],
          paint: {
            'circle-radius': 6,
            'circle-color': '#f59e0b', // Orange for parking handles
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2
          }
        });

        // Add colored polygon overlay source and layers first
        map.addSource('colored-polygons', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        });

        // Add colored polygon fill layer
        map.addLayer({
          id: 'colored-polygons-fill',
          type: 'fill',
          source: 'colored-polygons',
          paint: {
            'fill-color': ['get', 'color'],
            'fill-opacity': 0.3
          }
        });

        // Add colored polygon stroke layer
        map.addLayer({
          id: 'colored-polygons-stroke',
          type: 'line',
          source: 'colored-polygons',
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 2
          }
        });

        // Add side length annotations source and layer AFTER colored polygons
        map.addSource('side-annotations', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        });

        map.addLayer({
          id: 'side-annotations',
          type: 'symbol',
          source: 'side-annotations',
          layout: {
            'text-field': ['get', 'label'],
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            'text-size': 12,
            'text-anchor': 'center',
            'text-offset': [0, 0],
            'text-allow-overlap': true,
            'text-ignore-placement': true
          },
          paint: {
            'text-color': '#2563eb',
            'text-halo-color': '#ffffff',
            'text-halo-width': 2
          }
        });

        // Add temporary drawing annotation source for real-time measurements
        map.addSource('drawing-annotation', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        });

        // Add drawing annotation layer with different styling
        map.addLayer({
          id: 'drawing-annotation',
          type: 'symbol',
          source: 'drawing-annotation',
          layout: {
            'text-field': ['get', 'label'],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 16,
            'text-anchor': 'center',
            'text-offset': [0, -1.5],
            'text-allow-overlap': true,
            'text-ignore-placement': true,
            'text-rotation-alignment': 'map',
            'text-pitch-alignment': 'viewport'
          },
          paint: {
            'text-color': '#dc2626', // Red color for active drawing
            'text-halo-color': '#ffffff',
            'text-halo-width': 3,
            'text-halo-blur': 1
          }
        });

        // Add polygon rotation handles source
        map.addSource('polygon-rotation-handles', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        });

        map.addLayer({
          id: 'polygon-rotation-handles',
          type: 'circle',
          source: 'polygon-rotation-handles',
          paint: {
            'circle-radius': 8,
            'circle-color': '#3b82f6',
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2
          }
        });


      });

      // Handle draw events
      map.on('draw.create', (e: any) => {
        if (e.features && e.features.length > 0) {
          const feature = e.features[0] as MapboxDrawPolygon;
          // Reset rotation references for new polygon
          originalPolygonRef.current = null;
          totalRotationRef.current = 0;
          
          onPolygonCreate(feature);
          
          // Note: Colors will be handled by overlay system - no need for immediate updates
          
          // Visual feedback for completed polygon
          if (isMobile()) {
            // Flash the polygon to confirm completion
            const flashFeature = {
              type: 'Feature' as const,
              geometry: feature.geometry,
              properties: {}
            };
            
            // Add temporary flash layer
            map.addSource('polygon-flash', {
              type: 'geojson',
              data: flashFeature
            });
            
            map.addLayer({
              id: 'polygon-flash',
              type: 'fill',
              source: 'polygon-flash',
              paint: {
                'fill-color': '#22c55e',
                'fill-opacity': 0.6
              }
            });
            
            // Remove flash after animation
            setTimeout(() => {
              if (map.getLayer('polygon-flash')) {
                map.removeLayer('polygon-flash');
                map.removeSource('polygon-flash');
              }
              
              // Auto-switch to select mode on mobile after completion
              if (drawingModeRef.current === 'draw') {
                // This will trigger the parent component to switch modes
                // The parent should handle this through the polygon create callback
              }
            }, 300);
          }
          
          // Clear drawing annotation when polygon is completed
          const drawingSource = map.getSource('drawing-annotation') as mapboxgl.GeoJSONSource;
          if (drawingSource) {
            drawingSource.setData({
              type: 'FeatureCollection',
              features: []
            });
          }
          
          // Reset drawing state
          isDrawingRef.current = false;
          drawingPointsRef.current = [];
          
          // If still in draw mode, immediately prepare for next polygon
          if (drawingModeRef.current === 'draw') {
            // Force re-enter draw mode to ensure clean state
            setTimeout(() => {
              // Reset the tracking variables using refs
              lastClickedPointRef.current = null;
              drawingPointsRef.current = [];
              isDrawingModeRef.current = true; // Re-enable drawing mode tracking
              
              // Ensure we're in the right mode
              if (draw.getMode() !== 'draw_polygon') {
                draw.changeMode('draw_polygon');
              }
              console.log('Ready for next polygon drawing');
            }, 100);
          }
        }
      });
      
      // Handle mode changes based on drawing mode state
      map.on('draw.modechange', (e: any) => {
        // Don't interfere with mode changes in select mode
        if (drawingModeRef.current === 'select') return;
        
        // In draw mode, always return to draw_polygon
        if (drawingModeRef.current === 'draw' && e.mode !== 'draw_polygon') {
          requestAnimationFrame(() => {
            draw.changeMode('draw_polygon');
            map.getCanvas().style.cursor = 'crosshair';
          });
        }
      });

      map.on('draw.update', (e: any) => {
        if (e.features && e.features.length > 0) {
          const feature = e.features[0] as MapboxDrawPolygon;
          // If this is a manual update (not from rotation), reset references
          if (!originalPolygonRef.current) {
            originalPolygonRef.current = null;
            totalRotationRef.current = 0;
          }
          onPolygonUpdate(feature);
        }
      });

      map.on('draw.delete', (e: any) => {
        if (e.features && e.features.length > 0) {
          const feature = e.features[0] as MapboxDrawPolygon;
          // Reset rotation references when polygon is deleted
          originalPolygonRef.current = null;
          totalRotationRef.current = 0;
          if (feature.properties?.id) {
            onPolygonDelete(feature.properties.id);
          }
        }
      });
      
      // Handle selection changes - TEMPORARILY SIMPLIFIED FOR DEBUGGING
      map.on('draw.selectionchange', (e: any) => {
        // Skip processing if parking overlay was clicked recently or is being dragged
        if (parkingClickedRef.current || isDraggingParkingRef.current) {
          return;
        }
        
        if (!e.features || e.features.length === 0) {
          // Clear parking selection when nothing is selected
          if (selectedParkingIdRef.current && onClearParkingSelection) {
            onClearParkingSelection();
          }
          
          // Nothing is selected - clear rotation state and handles
          originalPolygonRef.current = null;
          totalRotationRef.current = 0;
          updateRotationHandles(); // Clear rotation handles immediately
          
          // Only force to draw_polygon if we're in draw mode
          if (drawingModeRef.current === 'draw') {
            draw.changeMode('draw_polygon');
          }
        } else {
          // Something is selected
          const selectedFeature = e.features[0];
          
          if (selectedFeature && selectedFeature.geometry.type === 'Polygon') {
            // Clear parking selection when polygon is selected
            if (selectedParkingIdRef.current && onClearParkingSelection) {
              onClearParkingSelection();
            }
            
            // Reset rotation state for newly selected polygon
            originalPolygonRef.current = null;
            totalRotationRef.current = 0;
            
            // Update rotation handles immediately using the selected feature directly
            updateRotationHandles(selectedFeature as MapboxDrawPolygon);
          }
        }
      });

      // Debounce parent updates to prevent excessive calls during selection
      const updateTimeout: NodeJS.Timeout | null = null;
      
      // Real-time drawing measurements (desktop only - mobile has no hover)
      isDrawingModeRef.current = drawingModeRef.current === 'draw'; // Initialize based on current mode
      
      // Track drawing state changes
      map.on('draw.modechange', (e: any) => {
        console.log('Draw mode change:', e.mode, 'Previous isDrawingMode:', isDrawingModeRef.current);
        isDrawingModeRef.current = e.mode === 'draw_polygon';
        
        if (!isDrawingModeRef.current) {
          lastClickedPointRef.current = null;
          drawingPointsRef.current = [];
          // Clear annotation when not drawing
          const drawingSource = map.getSource('drawing-annotation') as mapboxgl.GeoJSONSource;
          if (drawingSource) {
            drawingSource.setData({ type: 'FeatureCollection', features: [] });
          }
        } else {
          // Entering draw mode - reset state for new polygon
          console.log('Entering draw_polygon mode - ready for new polygon');
          lastClickedPointRef.current = null;
          drawingPointsRef.current = [];
        }
      });
      
      // Track clicks during drawing - capture with higher priority
      map.on('mousedown', (e) => {
        // Check if we're in draw polygon mode
        const currentMode = draw.getMode();
        
        if (currentMode === 'draw_polygon' && drawingModeRef.current === 'draw') {
          // Store the clicked point as our new reference
          const clickedPoint: [number, number] = [e.lngLat.lng, e.lngLat.lat];
          lastClickedPointRef.current = clickedPoint;
          drawingPointsRef.current.push(clickedPoint);
          isDrawingModeRef.current = true; // Ensure drawing mode is active
          console.log('Drawing mousedown - reference point set:', clickedPoint);
          
          // Clear annotation momentarily after click
          setTimeout(() => {
            const drawingSource = map.getSource('drawing-annotation') as mapboxgl.GeoJSONSource;
            if (drawingSource) {
              drawingSource.setData({ type: 'FeatureCollection', features: [] });
            }
          }, 50);
        }
      });

      // Show real-time distance on mouse move
      map.on('mousemove', (e) => {
        // Only show in draw mode with a reference point
        if (drawingModeRef.current !== 'draw' || !isDrawingModeRef.current || !lastClickedPointRef.current) {
          return;
        }

        const currentPoint: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        
        // Calculate distance from last clicked point to current mouse position
        const distance = calculateDistance(lastClickedPointRef.current, currentPoint);
        const formattedDistance = formatDistance(distance, measurementUnitRef.current);
        
        // Place annotation at the mouse position with slight offset
        const drawingSource = map.getSource('drawing-annotation') as mapboxgl.GeoJSONSource;
        if (drawingSource) {
          // Remove spam log - console.log('Updating drawing annotation:', formattedDistance);
          drawingSource.setData({
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: currentPoint
              },
              properties: {
                label: formattedDistance
              }
            }]
          });
        }
      });

      // Much simpler: just track clicks and check if we're in draw_polygon mode
      // Remove the complex render tracking and go back to basics

      // Clear drawing annotation when polygon is completed
      map.on('draw.create', () => {
        lastClickedPointRef.current = null;
        drawingPointsRef.current = [];
        const drawingSource = map.getSource('drawing-annotation') as mapboxgl.GeoJSONSource;
        if (drawingSource) {
          drawingSource.setData({ type: 'FeatureCollection', features: [] });
        }
      });
      


      // Handle parking overlay clicks (individual spaces)
      map.on('click', 'parking-overlays-fill', (e) => {
        if (e.features && e.features.length > 0) {
          const feature = e.features[0];
          const overlayId = feature.properties?.overlayId || feature.properties?.id;
          const overlay = parkingOverlaysRef.current.find(o => o.id === overlayId);
          
          if (overlay) {
            // Prevent event from bubbling to polygon selection
            e.preventDefault();
            
            // Set flag to indicate parking was clicked
            parkingClickedRef.current = true;
            
            // Clear any polygon selection when parking is clicked
            if (drawRef.current) {
              drawRef.current.changeMode('simple_select');
              const selectedIds = drawRef.current.getSelectedIds();
              if (selectedIds.length > 0) {
                drawRef.current.changeMode('simple_select'); // This deselects
              }
            }
            
            onParkingOverlayClick(overlay);
            
            // Clear flag after a longer delay to prevent interference
            setTimeout(() => {
              parkingClickedRef.current = false;
            }, 200);
          }
        }
      });

      // Change cursor on hover over parking overlays
      map.on('mouseenter', 'parking-overlays-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });

      map.on('mouseleave', 'parking-overlays-fill', () => {
        map.getCanvas().style.cursor = 'crosshair';
      });
      
      // Add keyboard shortcut to force draw mode
      map.on('keydown', (e: any) => {
        if (e.keyCode === 68) { // 'D' key
          draw.changeMode('draw_polygon');
          map.getCanvas().style.cursor = 'crosshair';
        }
      });

      // Rotation handle event handlers
      let isDragging = false;
      let dragStartAngle = 0;
      let currentCenter: [number, number] | null = null;
      
      // Separate variables for parking rotation to avoid conflicts
      let isParkingRotating = false;
      let parkingDragStartAngle = 0;
      let parkingCurrentCenter: [number, number] | null = null;

      // Mouse events for desktop
      map.on('mousedown', 'polygon-rotation-handles', (e) => {
        if (!e.features || e.features.length === 0) return;
        
        // Don't allow polygon rotation if parking is being interacted with
        if (parkingClickedRef.current || isDraggingParkingRef.current) {
          return;
        }
        
        e.preventDefault();
        isDragging = true;
        isRotatingRef.current = true;
        
        // Get selected polygon from refs
        if (!selectedPolygonIdRef.current) return;
        
        const selectedPolygon = polygonsRef.current.find(p => 
          String(p.id) === selectedPolygonIdRef.current || 
          String(p.properties?.id) === selectedPolygonIdRef.current
        );
        
        if (!selectedPolygon || selectedPolygon.geometry.type !== 'Polygon') return;
        
        const coordinates = selectedPolygon.geometry.coordinates[0];
        currentCenter = calculatePolygonCenterLocal(coordinates);
        
        const mousePoint = e.lngLat;
        dragStartAngle = Math.atan2(mousePoint.lat - currentCenter[1], mousePoint.lng - currentCenter[0]);
        
        map.getCanvas().style.cursor = 'grabbing';
        
        // Disable map interactions during rotation
        map.dragPan.disable();
        map.doubleClickZoom.disable();
        map.scrollZoom.disable();
        map.boxZoom.disable();
        map.dragRotate.disable();
        map.keyboard.disable();
        map.touchZoomRotate.disable();
      });

      // Touch events for mobile
      map.on('touchstart', 'polygon-rotation-handles', (e) => {
        if (!e.features || e.features.length === 0) return;
        
        // Don't allow polygon rotation if parking is being interacted with
        if (parkingClickedRef.current || isDraggingParkingRef.current) {
          return;
        }
        
        const touch = (e.originalEvent as TouchEvent).touches[0];
        if (!touch) return;
        
        e.preventDefault();
        isDragging = true;
        isRotatingRef.current = true;
        
        // Get selected polygon from refs
        if (!selectedPolygonIdRef.current) return;
        
        const selectedPolygon = polygonsRef.current.find(p => 
          String(p.id) === selectedPolygonIdRef.current || 
          String(p.properties?.id) === selectedPolygonIdRef.current
        );
        
        if (!selectedPolygon || selectedPolygon.geometry.type !== 'Polygon') return;
        
        const coordinates = selectedPolygon.geometry.coordinates[0];
        currentCenter = calculatePolygonCenterLocal(coordinates);
        
        const touchPoint = map.unproject([touch.clientX, touch.clientY]);
        dragStartAngle = Math.atan2(touchPoint.lat - currentCenter[1], touchPoint.lng - currentCenter[0]);
        
        // Disable map interactions during rotation
        map.dragPan.disable();
        map.doubleClickZoom.disable();
        map.scrollZoom.disable();
        map.boxZoom.disable();
        map.dragRotate.disable();
        map.keyboard.disable();
        map.touchZoomRotate.disable();
      });

      map.on('mousemove', (e) => {
        const mousePoint = e.lngLat;
        
        // Check if we're dragging a parking overlay - this takes priority
        if (isDraggingParkingRef.current && draggedParkingIdRef.current && originalOverlayRef.current) {          
          const updatedOverlay = {
            ...originalOverlayRef.current,
            position: [mousePoint.lng, mousePoint.lat] as [number, number]
          };
          
          onParkingOverlayUpdate(updatedOverlay);
          return; // Exit early to prevent polygon interactions
        }
        
        // Don't handle polygon rotation if parking is being interacted with
        if (parkingClickedRef.current) {
          return;
        }
        
        // Handle parking rotation first (higher priority)
        if (isParkingRotating && parkingCurrentCenter && originalOverlayRef.current && !isDraggingParkingRef.current) {
          e.preventDefault();
          
          // Ensure polygon is not selected during parking rotation
          if (drawRef.current) {
            const selectedIds = drawRef.current.getSelectedIds();
            if (selectedIds.length > 0) {
              drawRef.current.changeMode('simple_select'); // Deselect any polygons
            }
          }
          
          const currentAngle = Math.atan2(mousePoint.lat - parkingCurrentCenter[1], mousePoint.lng - parkingCurrentCenter[0]);
          
          // Calculate total rotation from the original drag start angle
          const totalDeltaAngle = currentAngle - originalDragStartAngleRef.current;
          const rotationDegrees = (totalDeltaAngle * 180) / Math.PI;
          const newRotation = (originalOverlayRef.current.rotation + rotationDegrees) % 360;
          
          const updatedOverlay = {
            ...originalOverlayRef.current,
            rotation: newRotation < 0 ? newRotation + 360 : newRotation
          };
          
          onParkingOverlayUpdate(updatedOverlay);
          return; // Exit early to prevent any polygon interactions
        }
        
        // Handle polygon rotation (existing logic)
        if (isDragging && currentCenter && drawRef.current && selectedPolygonIdRef.current) {          
          e.preventDefault();
          
          const currentAngle = Math.atan2(mousePoint.lat - currentCenter[1], mousePoint.lng - currentCenter[0]);
          const deltaAngle = currentAngle - dragStartAngle;
          
          // Rotate the polygon (keep original behavior)
          rotatePolygonDirect(currentCenter, deltaAngle);
          
          // Update for next iteration (only for polygons)
          dragStartAngle = currentAngle;
        }
      });

      // Touch move for mobile rotation
      map.on('touchmove', (e) => {
        if (!isDragging || !currentCenter || !drawRef.current) return;
        
        const touch = (e.originalEvent as TouchEvent).touches[0];
        if (!touch) return;
        
        e.preventDefault();
        
        const touchPoint = map.unproject([touch.clientX, touch.clientY]);
        const currentAngle = Math.atan2(touchPoint.lat - currentCenter[1], touchPoint.lng - currentCenter[0]);
        const deltaAngle = currentAngle - dragStartAngle;
        
        // Rotate the polygon
        rotatePolygonDirect(currentCenter, deltaAngle);
        
        // Update for next iteration
        dragStartAngle = currentAngle;
      });

      map.on('mouseup', () => {
        // Handle parking drag end
        if (isDraggingParkingRef.current) {
          isDraggingParkingRef.current = false;
          draggedParkingIdRef.current = null;
          originalOverlayRef.current = null;
          
          // Clear parking click flag after a short delay
          setTimeout(() => {
            parkingClickedRef.current = false;
          }, 100);
          
          // Restore cursor
          map.getCanvas().style.cursor = drawingModeRef.current === 'draw' ? 'crosshair' : '';
          
          // Re-enable all map interactions
          map.dragPan.enable();
          map.doubleClickZoom.enable();
          map.scrollZoom.enable();
          map.boxZoom.enable();
          map.dragRotate.enable();
          map.keyboard.enable();
          map.touchZoomRotate.enable();
          
          // Restore proper draw mode
          if (drawRef.current) {
            if (drawingModeRef.current === 'draw') {
              drawRef.current.changeMode('draw_polygon');
            } else {
              drawRef.current.changeMode('simple_select');
            }
          }
          return;
        }
        
        // Handle parking rotation end
        if (isParkingRotating) {
          isParkingRotating = false;
          isRotatingRef.current = false;
          parkingCurrentCenter = null;
          
          // Clear rotation references
          originalOverlayRef.current = null;
          
          // Restore cursor based on drawing mode
          if (drawingModeRef.current === 'draw') {
            map.getCanvas().style.cursor = 'crosshair';
          } else {
            map.getCanvas().style.cursor = '';
          }
          
          // Re-enable map interactions
          map.dragPan.enable();
          map.doubleClickZoom.enable();
          map.scrollZoom.enable();
          map.boxZoom.enable();
          map.dragRotate.enable();
          map.keyboard.enable();
          map.touchZoomRotate.enable();
          
          return;
        }
        
        // Handle polygon rotation end
        if (isDragging) {
          isDragging = false;
          isRotatingRef.current = false;
          currentCenter = null;
          
          // Clear rotation references
          originalOverlayRef.current = null;
          
          // Restore cursor based on drawing mode
          if (drawingModeRef.current === 'draw') {
            map.getCanvas().style.cursor = 'crosshair';
          } else {
            map.getCanvas().style.cursor = '';
          }
          
          // Re-enable map interactions
          map.dragPan.enable();
          map.doubleClickZoom.enable();
          map.scrollZoom.enable();
          map.boxZoom.enable();
          map.dragRotate.enable();
          map.keyboard.enable();
          map.touchZoomRotate.enable();
          
        }
      });

      // Touch end for mobile
      map.on('touchend', () => {
        if (isParkingRotating) {
          isParkingRotating = false;
          isRotatingRef.current = false;
          parkingCurrentCenter = null;
          originalOverlayRef.current = null;
          
          // Re-enable map interactions
          map.dragPan.enable();
          map.doubleClickZoom.enable();
          map.scrollZoom.enable();
          map.boxZoom.enable();
          map.dragRotate.enable();
          map.keyboard.enable();
          map.touchZoomRotate.enable();
        } else if (isDragging) {
          isDragging = false;
          isRotatingRef.current = false;
          currentCenter = null;
          
          // Re-enable map interactions
          map.dragPan.enable();
          map.doubleClickZoom.enable();
          map.scrollZoom.enable();
          map.boxZoom.enable();
          map.dragRotate.enable();
          map.keyboard.enable();
          map.touchZoomRotate.enable();
        }
      });
      
      // Handle mouse leave to stop dragging
      map.on('mouseleave', () => {
        if (isParkingRotating) {
          isParkingRotating = false;
          isRotatingRef.current = false;
          parkingCurrentCenter = null;
          originalOverlayRef.current = null;
          
          // Restore cursor based on drawing mode
          if (drawingModeRef.current === 'draw') {
            map.getCanvas().style.cursor = 'crosshair';
          } else {
            map.getCanvas().style.cursor = '';
          }
          
          // Re-enable map interactions
          map.dragPan.enable();
          map.doubleClickZoom.enable();
          map.scrollZoom.enable();
          map.boxZoom.enable();
          map.dragRotate.enable();
          map.keyboard.enable();
          map.touchZoomRotate.enable();
        } else if (isDragging) {
          isDragging = false;
          isRotatingRef.current = false;
          currentCenter = null;
          
          // Restore cursor based on drawing mode
          if (drawingModeRef.current === 'draw') {
            map.getCanvas().style.cursor = 'crosshair';
          } else {
            map.getCanvas().style.cursor = '';
          }
          
          // Re-enable map interactions
          map.dragPan.enable();
          map.doubleClickZoom.enable();
          map.scrollZoom.enable();
          map.boxZoom.enable();
          map.dragRotate.enable();
          map.keyboard.enable();
          map.touchZoomRotate.enable();
        }
      });

      // Handle touch cancel for mobile
      map.on('touchcancel', () => {
        if (isParkingRotating) {
          isParkingRotating = false;
          isRotatingRef.current = false;
          parkingCurrentCenter = null;
          originalOverlayRef.current = null;
          
          // Re-enable map interactions
          map.dragPan.enable();
          map.doubleClickZoom.enable();
          map.scrollZoom.enable();
          map.boxZoom.enable();
          map.dragRotate.enable();
          map.keyboard.enable();
          map.touchZoomRotate.enable();
        } else if (isDragging) {
          isDragging = false;
          isRotatingRef.current = false;
          currentCenter = null;
          
          // Re-enable map interactions
          map.dragPan.enable();
          map.doubleClickZoom.enable();
          map.scrollZoom.enable();
          map.boxZoom.enable();
          map.dragRotate.enable();
          map.keyboard.enable();
          map.touchZoomRotate.enable();
        }
      });

      map.on('mouseenter', 'polygon-rotation-handles', () => {
        map.getCanvas().style.cursor = 'grab';
      });

      map.on('mouseleave', 'polygon-rotation-handles', () => {
        if (!isRotating) {
          map.getCanvas().style.cursor = 'crosshair';
        }
      });

      // Parking rotation handle mouse events
      map.on('mousedown', 'parking-rotation-handles', (e) => {
        if (!e.features || e.features.length === 0) return;
        
        e.preventDefault();
        isParkingRotating = true;
        isRotatingRef.current = true;
        
        // Immediately clear any polygon selection to prevent interference
        if (drawRef.current) {
          drawRef.current.changeMode('simple_select');
          const selectedIds = drawRef.current.getSelectedIds();
          if (selectedIds.length > 0) {
            drawRef.current.changeMode('simple_select'); // This deselects
          }
        }
        
        const feature = e.features[0];
        const overlayId = feature.properties?.overlayId;
        const selectedOverlay = parkingOverlaysRef.current.find(o => o.id === overlayId);
        
        if (!selectedOverlay) return;
        
        parkingCurrentCenter = selectedOverlay.position as [number, number];
        const mousePoint = e.lngLat;
        parkingDragStartAngle = Math.atan2(mousePoint.lat - parkingCurrentCenter[1], mousePoint.lng - parkingCurrentCenter[0]);
        
        // Store the original drag start angle for stable rotation calculation
        originalDragStartAngleRef.current = parkingDragStartAngle;
        
        
        map.getCanvas().style.cursor = 'grabbing';
        
        // Store original overlay for rotation
        originalOverlayRef.current = { ...selectedOverlay };
        
        // Disable map interactions during parking rotation
        map.dragPan.disable();
        map.doubleClickZoom.disable();
        map.scrollZoom.disable();
        map.boxZoom.disable();
        map.dragRotate.disable();
        map.keyboard.disable();
        map.touchZoomRotate.disable();
      });

      map.on('mouseenter', 'parking-rotation-handles', () => {
        map.getCanvas().style.cursor = 'grab';
      });

      map.on('mouseleave', 'parking-rotation-handles', () => {
        if (!isParkingRotating && !isDragging) {
          if (drawingModeRef.current === 'draw') {
            map.getCanvas().style.cursor = 'crosshair';
          } else {
            map.getCanvas().style.cursor = '';
          }
        }
      });

      // Add parking overlay dragging functionality
      map.on('mousedown', 'parking-overlays-fill', (e) => {
        const currentSelectedId = selectedParkingIdRef.current;
        
        if (e.features && e.features.length > 0 && currentSelectedId) {
          const feature = e.features[0];
          const overlayId = feature.properties?.overlayId || feature.properties?.id;
          const overlay = parkingOverlaysRef.current.find(o => o.id === overlayId);
          
          if (overlay && currentSelectedId === overlayId) {
            isDraggingParkingRef.current = true;
            draggedParkingIdRef.current = overlayId;
            originalOverlayRef.current = { ...overlay };
            
            // Set flag to prevent polygon interactions
            parkingClickedRef.current = true;
            
            // Store the initial mouse position relative to overlay center
            const mousePoint = e.lngLat;
            const overlayCenter = overlay.position;
            currentCenter = overlayCenter as [number, number];
            
            map.getCanvas().style.cursor = 'move';
            
            // Disable map interactions during drag
            map.dragPan.disable();
            map.doubleClickZoom.disable();
            map.scrollZoom.disable();
            map.boxZoom.disable();
            map.dragRotate.disable();
            map.keyboard.disable();
            map.touchZoomRotate.disable();
            
            // Temporarily disable draw interactions by switching to simple_select
            if (drawRef.current) {
              drawRef.current.changeMode('simple_select');
              // Clear any current selection to prevent interference
              const selected = drawRef.current.getSelectedIds();
              if (selected.length > 0) {
                drawRef.current.changeMode('simple_select');
              }
            }
            
            e.preventDefault();
          }
        }
      });

    } catch (error) {
      console.error('Error initializing map:', error);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        drawRef.current = null;
      }
    };
  }, []);

  // Update refs when props change
  useEffect(() => {
    drawingModeRef.current = drawingMode;
  }, [drawingMode]);

  useEffect(() => {
    selectedPolygonIdRef.current = selectedPolygonId;
  }, [selectedPolygonId]);

  useEffect(() => {
    polygonsRef.current = polygons;
  }, [polygons]);

  useEffect(() => {
    measurementUnitRef.current = measurementUnit;
  }, [measurementUnit]);

  useEffect(() => {
    showSideLengthsRef.current = showSideLengths;
  }, [showSideLengths]);

  // Manage drawing mode and sync polygons
  useEffect(() => {
    if (!drawRef.current || !isMapLoaded || !mapRef.current) return;

    const draw = drawRef.current;
    const map = mapRef.current;
    
    // Sync polygons bidirectionally
    const currentFeatures = draw.getAll();
    const currentIds = new Set(currentFeatures.features.map(f => String(f.id)));
    const stateIds = new Set(polygons.map(p => String(p.id || p.properties?.id || '')));
    
    // Sync polygons - add missing ones with their properties including colors
    polygons.forEach(polygon => {
      const polygonId = String(polygon.id || polygon.properties?.id || '');
      if (!currentIds.has(polygonId) && polygon.id) {
        console.log('Adding polygon to draw with color:', polygonId, polygon.properties?.color);
        draw.add(polygon);
      } else if (currentIds.has(polygonId)) {
        // Check if existing polygon needs color property update
        const existingFeature = currentFeatures.features.find(f => String(f.id) === polygonId);
        if (existingFeature && polygon.properties?.color && !existingFeature.properties?.color) {
          console.log('Updating existing polygon with color:', polygonId, polygon.properties.color);
          draw.delete([polygonId]);
          draw.add(polygon);
        }
      }
    });
    
    // Remove extra polygons from draw that aren't in state
    currentFeatures.features.forEach(feature => {
      const featureId = String(feature.id);
      if (!stateIds.has(featureId)) {
        console.log('Removing extra polygon from map:', featureId);
        draw.delete([featureId]);
      }
    });
    
    // Set mode based on drawingMode prop
    if (drawingMode === 'draw') {
      draw.changeMode('draw_polygon');
      map.getCanvas().style.cursor = 'crosshair';
    } else {
      draw.changeMode('simple_select');
      map.getCanvas().style.cursor = '';
    }
    
    // Override cursor for drawing interactions
    const setCursor = () => {
      if (!isRotatingRef.current) {
        if (drawingMode === 'draw') {
          map.getCanvas().style.cursor = 'crosshair';
        } else {
          map.getCanvas().style.cursor = '';
        }
      }
    };
    
    // Add event listeners to maintain proper cursor
    map.on('mousemove', setCursor);
    map.on('mouseenter', setCursor);
    
    return () => {
      map.off('mousemove', setCursor);
      map.off('mouseenter', setCursor);
    };
  }, [isMapLoaded, polygons, drawingMode]);

  // Handle search result flyto
  useEffect(() => {
    if (!mapRef.current || !searchResult || !isMapLoaded) return;

    flyToLocation(mapRef.current, searchResult.center, 16);
  }, [searchResult, isMapLoaded]);

  // Update grid overlay
  useEffect(() => {
    if (!mapRef.current || !isMapLoaded) return;

    if (snapToGrid) {
      addGridOverlay(mapRef.current, gridSize);
    } else {
      removeGridOverlay(mapRef.current);
    }
  }, [snapToGrid, gridSize, isMapLoaded]);

  // Helper function to generate rotation handles for parking overlays
  const generateParkingRotationHandles = (overlay: ParkingOverlay): any[] => {
    const { position, rotation, size, type, quantity } = overlay;
    const [centerLng, centerLat] = position;
    
    // Calculate total bounds of the parking overlay
    const totalWidthDeg = size.width / (111320 * Math.cos(centerLat * Math.PI / 180));
    const totalLengthDeg = size.length / 111320;
    
    // Create handle positions at the corners of the total overlay area
    const halfWidth = totalWidthDeg / 2;
    const halfLength = totalLengthDeg / 2;
    
    const corners = [
      [-halfWidth, -halfLength], // top-left
      [halfWidth, -halfLength],  // top-right  
      [halfWidth, halfLength],   // bottom-right
      [-halfWidth, halfLength]   // bottom-left
    ];
    
    // Apply rotation to corner positions
    const rotationRad = (rotation * Math.PI) / 180;
    const rotatedCorners = corners.map(([x, y]) => {
      const rotatedX = x * Math.cos(rotationRad) - y * Math.sin(rotationRad);
      const rotatedY = x * Math.sin(rotationRad) + y * Math.cos(rotationRad);
      return [centerLng + rotatedX, centerLat + rotatedY];
    });
    
    return rotatedCorners.map((corner, index) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: corner
      },
      properties: {
        type: 'parking-rotation-handle',
        overlayId: overlay.id,
        handleIndex: index
      }
    }));
  };

  // Update parking overlays
  useEffect(() => {
    if (!mapRef.current || !isMapLoaded) return;

    const map = mapRef.current;
    const source = map.getSource('parking-overlays') as mapboxgl.GeoJSONSource;
    
    if (source) {
      const features: any[] = [];
      
      parkingOverlays.forEach(overlay => {
        // Simple approach: Create individual rectangles for each parking space
        const { position, rotation, type, quantity } = overlay;
        const [centerLng, centerLat] = position;
        
        // Calculate grid layout
        const spacesPerRow = type === 'double' ? Math.ceil(quantity / 2) : quantity;
        const numRows = type === 'double' ? 2 : 1;
        
        // Individual space dimensions (standard: 2.7m × 5m, compact: 2.4m × 4.8m)
        const spaceWidth = overlay.size.width / spacesPerRow; // Individual space width
        const spaceLength = overlay.size.length / numRows;    // Individual space length
        
        // Convert individual space size to degrees
        const spaceWidthDeg = spaceWidth / (111320 * Math.cos(centerLat * Math.PI / 180));
        const spaceLengthDeg = spaceLength / 111320;
        
        // Calculate total grid dimensions for positioning
        const totalWidthDeg = overlay.size.width / (111320 * Math.cos(centerLat * Math.PI / 180));
        const totalLengthDeg = overlay.size.length / 111320;
        
        
        // Generate individual parking space rectangles
        for (let row = 0; row < numRows; row++) {
          for (let col = 0; col < spacesPerRow; col++) {
            // Skip if we've created all the spaces we need
            if (row * spacesPerRow + col >= quantity) break;
            
            // Calculate position for this space
            const spaceX = centerLng + (col - (spacesPerRow - 1) / 2) * spaceWidthDeg;
            const spaceY = centerLat + (row - (numRows - 1) / 2) * spaceLengthDeg;
            
            // Create rectangle corners for this individual space
            const halfWidth = spaceWidthDeg / 2;
            const halfLength = spaceLengthDeg / 2;
            
            const corners = [
              [spaceX - halfWidth, spaceY - halfLength],
              [spaceX + halfWidth, spaceY - halfLength],
              [spaceX + halfWidth, spaceY + halfLength],
              [spaceX - halfWidth, spaceY + halfLength],
              [spaceX - halfWidth, spaceY - halfLength] // Close polygon
            ];
            
            // Apply rotation if needed
            const rotatedCorners = rotation !== 0 ? corners.map(([lng, lat]) => {
              const dx = lng - centerLng;
              const dy = lat - centerLat;
              const rotRad = (rotation * Math.PI) / 180;
              const rotatedX = dx * Math.cos(rotRad) - dy * Math.sin(rotRad);
              const rotatedY = dx * Math.sin(rotRad) + dy * Math.cos(rotRad);
              return [centerLng + rotatedX, centerLat + rotatedY];
            }) : corners;
            
            // Add individual parking space rectangle
            features.push({
              type: 'Feature' as const,
              geometry: {
                type: 'Polygon' as const,
                coordinates: [rotatedCorners]
              },
              properties: {
                id: `${overlay.id}-space-${row}-${col}`,
                overlayId: overlay.id,
                type: overlay.type,
                spaceNumber: row * spacesPerRow + col + 1,
                color: overlay.type === 'single' ? '#4a5568' : '#374151' // Gray for parking spaces
              }
            });
          }
        }
      });

      source.setData({
        type: 'FeatureCollection',
        features
      });

    }
  }, [parkingOverlays, isMapLoaded]);

  // Update colored polygon overlays
  useEffect(() => {
    if (!mapRef.current || !isMapLoaded) return;

    const map = mapRef.current;
    const source = map.getSource('colored-polygons') as mapboxgl.GeoJSONSource;
    
    if (source) {
      const features = polygons.map((polygon, index) => {
        return {
          type: 'Feature' as const,
          geometry: polygon.geometry,
          properties: {
            color: polygon.properties?.color || '#2563eb',
            id: polygon.id || polygon.properties?.id
          }
        };
      });

      source.setData({
        type: 'FeatureCollection',
        features
      });
    }
  }, [polygons, isMapLoaded]);


  // Update side length annotations for all polygons
  useEffect(() => {
    if (!mapRef.current || !isMapLoaded) return;

    const map = mapRef.current;
    const source = map.getSource('side-annotations') as mapboxgl.GeoJSONSource;
    
    if (!source) return;
    
    // If side lengths are hidden, clear the annotations
    if (!showSideLengths) {
      source.setData({
        type: 'FeatureCollection',
        features: []
      });
      return;
    }
    
    // Get current polygons from Mapbox Draw to ensure we have the latest coordinates
    const draw = drawRef.current;
    if (!draw) return;
    
    const currentFeatures = draw.getAll();
    if (currentFeatures.features.length === 0) {
      source.setData({
        type: 'FeatureCollection',
        features: []
      });
      return;
    }
    
    const allFeatures: any[] = [];
    
    // Create annotations for each polygon from the draw instance
    currentFeatures.features.forEach((feature, polygonIndex) => {
      if (feature.geometry.type !== 'Polygon') return;
      
      const coordinates = feature.geometry.coordinates[0];
      
      // Skip if polygon doesn't have enough points (need at least 4 for a closed polygon)
      if (coordinates.length < 4) return;
      
      // Calculate measurements for this polygon
      const polygonMeasurement = calculatePolygonArea(coordinates);
      
      // Create annotation for each side
      for (let i = 0; i < coordinates.length - 1; i++) {
        const startPoint = coordinates[i];
        const endPoint = coordinates[i + 1];
        
        // Calculate midpoint of the side
        const midLng = (startPoint[0] + endPoint[0]) / 2;
        const midLat = (startPoint[1] + endPoint[1]) / 2;
        
        // Get side length and format it
        const lengthMeters = polygonMeasurement.sideLengths[i];
        const formattedLength = formatDistance(lengthMeters, measurementUnit);
        
        allFeatures.push({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [midLng, midLat]
          },
          properties: {
            label: formattedLength,
            sideIndex: i,
            polygonIndex: polygonIndex,
            polygonId: String(feature.id || '')
          }
        });
      }
    });
    
    source.setData({
      type: 'FeatureCollection',
      features: allFeatures
    });
  }, [measurementUnit, isMapLoaded, showSideLengths]);

  // Update annotations when polygons change or are moved
  useEffect(() => {
    if (!mapRef.current || !isMapLoaded || !drawRef.current) return;

    const map = mapRef.current;
    const draw = drawRef.current;
    const source = map.getSource('side-annotations') as mapboxgl.GeoJSONSource;
    
    if (!source) return;
    
    // Function to refresh annotations
    const refreshAnnotations = () => {
      // If side lengths are hidden, clear and return
      if (!showSideLengthsRef.current) {
        source.setData({
          type: 'FeatureCollection',
          features: []
        });
        return;
      }
      
      const currentFeatures = draw.getAll();
      const allFeatures: any[] = [];
      
      currentFeatures.features.forEach((feature, polygonIndex) => {
        if (feature.geometry.type !== 'Polygon') return;
        
        const coordinates = feature.geometry.coordinates[0];
        
        // Skip if polygon doesn't have enough points
        if (coordinates.length < 4) return;
        
        const polygonMeasurement = calculatePolygonArea(coordinates);
        
        for (let i = 0; i < coordinates.length - 1; i++) {
          const startPoint = coordinates[i];
          const endPoint = coordinates[i + 1];
          
          const midLng = (startPoint[0] + endPoint[0]) / 2;
          const midLat = (startPoint[1] + endPoint[1]) / 2;
          
          const lengthMeters = polygonMeasurement.sideLengths[i];
          const formattedLength = formatDistance(lengthMeters, measurementUnit);
          
          allFeatures.push({
            type: 'Feature' as const,
            geometry: {
              type: 'Point' as const,
              coordinates: [midLng, midLat]
            },
            properties: {
              label: formattedLength,
              sideIndex: i,
              polygonIndex: polygonIndex,
              polygonId: String(feature.id || '')
            }
          });
        }
      });
      
      source.setData({
        type: 'FeatureCollection',
        features: allFeatures
      });
    };

    // Initial refresh
    refreshAnnotations();

    // Listen to draw events to refresh annotations
    const handleDrawUpdate = () => {
      // Use setTimeout to ensure coordinates are updated
      setTimeout(refreshAnnotations, 10);
    };

    const handleDrawCreate = () => {
      setTimeout(refreshAnnotations, 10);
    };

    const handleDrawDelete = () => {
      setTimeout(refreshAnnotations, 10);
    };

    map.on('draw.update', handleDrawUpdate);
    map.on('draw.create', handleDrawCreate);
    map.on('draw.delete', handleDrawDelete);
    
    return () => {
      map.off('draw.update', handleDrawUpdate);
      map.off('draw.create', handleDrawCreate);
      map.off('draw.delete', handleDrawDelete);
    };
  }, [polygons.length, measurementUnit, isMapLoaded]);

  // Function to update rotation handles for a specific polygon
  const updateRotationHandles = useCallback((polygon?: MapboxDrawPolygon) => {
    if (!mapRef.current || !isMapLoaded) {
      return;
    }
    const map = mapRef.current;
    const source = map.getSource('polygon-rotation-handles') as mapboxgl.GeoJSONSource;
    
    if (!source) {
      return;
    }
    
    if (!polygon) {
      // Clear rotation handles when no polygon
      source.setData({
        type: 'FeatureCollection',
        features: []
      });
      setPolygonCenter(null);
      return;
    }
    
    const coordinates = polygon.geometry.coordinates[0];
      
    // Calculate polygon center
    const center = calculatePolygonCenter(coordinates);
    setPolygonCenter(center);
    
    // Calculate bounding box to place rotation handles
    const lngs = coordinates.map(coord => coord[0]);
    const lats = coordinates.map(coord => coord[1]);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    
    // Calculate radius for handle placement
    const deltaLng = maxLng - minLng;
    const deltaLat = maxLat - minLat;
    const radius = Math.max(deltaLng, deltaLat) * 0.7; // Place handles outside polygon
    
    // Create rotation handles at cardinal directions
    const handles = [
      [center[0], center[1] + radius], // North
      [center[0] + radius, center[1]], // East
      [center[0], center[1] - radius], // South
      [center[0] - radius, center[1]], // West
    ].map((coord, index) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: coord
      },
      properties: {
        handleIndex: index
      }
    }));
    
    source.setData({
      type: 'FeatureCollection',
      features: handles
    });
  }, [isMapLoaded]);

  // Function to update rotation handles for parking overlays
  const updateParkingRotationHandles = useCallback((selectedParkingId?: string | null) => {
    if (!mapRef.current || !isMapLoaded) {
      return;
    }
    const map = mapRef.current;
    const source = map.getSource('rotation-handles') as mapboxgl.GeoJSONSource;
    
    if (!source) {
      return;
    }

    if (!selectedParkingId) {
      // Clear parking handles
      source.setData({
        type: 'FeatureCollection',
        features: []
      });
      return;
    }

    // Find the selected parking overlay
    const selectedOverlay = parkingOverlays.find(o => o.id === selectedParkingId);
    
    if (!selectedOverlay) {
      return;
    }

    try {
      // Generate parking rotation handles
      const parkingHandles = generateParkingRotationHandles(selectedOverlay);
      
      source.setData({
        type: 'FeatureCollection',
        features: parkingHandles
      });
      
    } catch (error) {
      console.error('Error updating parking rotation handles:', error);
    }
  }, [parkingOverlays, isMapLoaded]);

  // Update polygon rotation handles for selected polygon
  useEffect(() => {
    if (!selectedPolygonId) {
      updateRotationHandles(); // Clear handles
      originalPolygonRef.current = null;
      totalRotationRef.current = 0;
      return;
    }
    
    // Find the selected polygon
    const selectedPolygon = polygons.find(p => 
      String(p.id) === selectedPolygonId || 
      String(p.properties?.id) === selectedPolygonId
    );
    
    updateRotationHandles(selectedPolygon);
  }, [polygons, selectedPolygonId, updateRotationHandles]);

  // Update parking rotation handles for selected parking overlay
  useEffect(() => {
    updateParkingRotationHandles(selectedParkingId);
  }, [selectedParkingId, parkingOverlays, updateParkingRotationHandles]);

  // Update parking overlay visual selection
  useEffect(() => {
    if (!mapRef.current || !isMapLoaded) return;
    
    const map = mapRef.current;
    
    
    // Update fill color to highlight selected parking overlay
    map.setPaintProperty('parking-overlays-fill', 'fill-color', [
      'case',
      ['==', ['get', 'overlayId'], selectedParkingId || ''],
      '#fbbf24', // Yellow for selected parking spaces
      '#4a5568'  // Gray for unselected parking spaces
    ]);
    
  }, [selectedParkingId, isMapLoaded]);

  // Local helper for polygon center calculation  
  const calculatePolygonCenterLocal = (coordinates: number[][]): [number, number] => {
    const lngs = coordinates.map(coord => coord[0]);
    const lats = coordinates.map(coord => coord[1]);
    const centerLng = lngs.reduce((sum, lng) => sum + lng, 0) / lngs.length;
    const centerLat = lats.reduce((sum, lat) => sum + lat, 0) / lats.length;
    return [centerLng, centerLat];
  };

  // Store original polygon for rotation reference
  const originalPolygonRef = useRef<number[][] | null>(null);
  const originalOverlayRef = useRef<ParkingOverlay | null>(null);
  const parkingOverlaysRef = useRef<ParkingOverlay[]>(parkingOverlays);
  const selectedParkingIdRef = useRef<string | null>(selectedParkingId);
  const parkingClickedRef = useRef<boolean>(false);
  const isDraggingParkingRef = useRef<boolean>(false);
  const draggedParkingIdRef = useRef<string | null>(null);
  
  // Update refs when props change
  useEffect(() => {
    parkingOverlaysRef.current = parkingOverlays;
  }, [parkingOverlays]);
  
  useEffect(() => {
    selectedParkingIdRef.current = selectedParkingId;
  }, [selectedParkingId]);
  const totalRotationRef = useRef<number>(0);
  const originalDragStartAngleRef = useRef<number>(0);
  const isRotatingRef = useRef<boolean>(false);

  // Direct rotation function with better precision
  const rotatePolygonDirect = useCallback((center: [number, number], deltaAngle: number) => {
    if (!drawRef.current || !selectedPolygonIdRef.current) return;

    const draw = drawRef.current;
    
    // Find the selected polygon from refs
    const selectedPolygon = polygonsRef.current.find(p => 
      String(p.id) === selectedPolygonIdRef.current || 
      String(p.properties?.id) === selectedPolygonIdRef.current
    );
    
    if (!selectedPolygon || selectedPolygon.geometry.type !== 'Polygon') return;
    
    const polygon = selectedPolygon;
    
    // Store original coordinates if not already stored
    if (!originalPolygonRef.current) {
      originalPolygonRef.current = polygon.geometry.coordinates[0].map(coord => [...coord]);
    }
    
    // Update total rotation
    totalRotationRef.current += deltaAngle;
    
    const originalCoords = originalPolygonRef.current;
    
    // For geographic coordinates, work in a projected coordinate system for accurate rotation
    // Convert to Web Mercator (approximately Cartesian for small areas)
    const toWebMercator = (lng: number, lat: number): [number, number] => {
      const x = lng * 20037508.34 / 180;
      let y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) / (Math.PI / 180);
      y = y * 20037508.34 / 180;
      return [x, y];
    };
    
    const fromWebMercator = (x: number, y: number): [number, number] => {
      const lng = (x / 20037508.34) * 180;
      let lat = (y / 20037508.34) * 180;
      lat = 180 / Math.PI * (2 * Math.atan(Math.exp(lat * Math.PI / 180)) - Math.PI / 2);
      return [lng, lat];
    };
    
    // Convert center to Web Mercator
    const centerMercator = toWebMercator(center[0], center[1]);
    
    // Apply rigid body rotation in Cartesian space (preserves all distances and angles)
    const rotatedCoords = originalCoords.slice(0, -1).map(coord => {
      const mercatorCoord = toWebMercator(coord[0], coord[1]);
      
      // Translate to origin (center becomes 0,0)
      const translatedX = mercatorCoord[0] - centerMercator[0];
      const translatedY = mercatorCoord[1] - centerMercator[1];
      
      // Apply rotation matrix (this is the key - preserves all geometric properties)
      const cosAngle = Math.cos(totalRotationRef.current);
      const sinAngle = Math.sin(totalRotationRef.current);
      
      const rotatedX = translatedX * cosAngle - translatedY * sinAngle;
      const rotatedY = translatedX * sinAngle + translatedY * cosAngle;
      
      // Translate back
      const finalX = rotatedX + centerMercator[0];
      const finalY = rotatedY + centerMercator[1];
      
      // Convert back to geographic coordinates
      return fromWebMercator(finalX, finalY);
    });
    
    // Ensure the polygon is closed by duplicating the first coordinate
    rotatedCoords.push(rotatedCoords[0]);
    
    // Update the polygon coordinates directly
    polygon.geometry.coordinates[0] = rotatedCoords;
    
    // Remove and re-add to trigger visual update
    draw.delete(String(polygon.id));
    draw.add(polygon);
    
    // Refresh side annotations to move them with the rotated polygon
    // With improved rotation precision, we can now use current measurements
    if (mapRef.current && showSideLengthsRef.current) {
      const sideSource = mapRef.current.getSource('side-annotations') as mapboxgl.GeoJSONSource;
      if (sideSource) {
        const allFeatures: any[] = [];
        const currentFeatures = draw.getAll();
        
        currentFeatures.features.forEach((feature, polygonIndex) => {
          if (feature.geometry.type !== 'Polygon') return;
          
          const coordinates = feature.geometry.coordinates[0];
          if (coordinates.length < 4) return;
          
          // With proper rigid body rotation, current measurements should equal original
          const currentMeasurement = calculatePolygonArea(coordinates);
          
          for (let i = 0; i < coordinates.length - 1; i++) {
            const startPoint = coordinates[i];
            const endPoint = coordinates[i + 1];
            
            const midLng = (startPoint[0] + endPoint[0]) / 2;
            const midLat = (startPoint[1] + endPoint[1]) / 2;
            
            // Use current measurements - they should be preserved by proper rotation
            const lengthMeters = currentMeasurement.sideLengths[i];
            const formattedLength = formatDistance(lengthMeters, measurementUnit);
            
            allFeatures.push({
              type: 'Feature' as const,
              geometry: {
                type: 'Point' as const,
                coordinates: [midLng, midLat]
              },
              properties: {
                label: formattedLength,
                sideIndex: i,
                polygonIndex: polygonIndex,
                polygonId: String(feature.id || '')
              }
            });
          }
        });
        
        sideSource.setData({
          type: 'FeatureCollection',
          features: allFeatures
        });
      }
    }
    
    // Always trigger update callback for visual consistency
    // The parent will handle whether to recalculate measurements
    onPolygonUpdate(polygon as MapboxDrawPolygon);
  }, [onPolygonUpdate]);

  // Helper function to calculate polygon center for handle placement
  const calculatePolygonCenter = useCallback((coordinates: number[][]): [number, number] => {
    return calculatePolygonCenterLocal(coordinates);
  }, []);

  return (
    <div 
      ref={mapContainer} 
      className={`w-full h-full ${className}`}
      style={{ minHeight: '400px' }}
    />
  );
});

MapboxMap.displayName = 'MapboxMap';

// Helper function to calculate parking space coordinates
function calculateParkingSpaceCoordinates(overlay: ParkingOverlay): number[][] {
  const { position, rotation, size } = overlay;
  const [centerLng, centerLat] = position;
  
  // Convert size from meters to approximate degrees
  const metersToLng = size.width / 111320;
  const metersToLat = size.length / 110540;
  
  // Create rectangle corners relative to center
  const halfWidth = metersToLng / 2;
  const halfLength = metersToLat / 2;
  
  const corners = [
    [-halfWidth, -halfLength],
    [halfWidth, -halfLength],
    [halfWidth, halfLength],
    [-halfWidth, halfLength],
    [-halfWidth, -halfLength]
  ];
  
  // Apply rotation
  const rotationRad = (rotation * Math.PI) / 180;
  const rotatedCorners = corners.map(([x, y]) => {
    const rotatedX = x * Math.cos(rotationRad) - y * Math.sin(rotationRad);
    const rotatedY = x * Math.sin(rotationRad) + y * Math.cos(rotationRad);
    return [centerLng + rotatedX, centerLat + rotatedY];
  });
  
  return rotatedCorners;
}