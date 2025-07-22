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
  searchResult?: SearchResult | null;
  snapToGrid: boolean;
  gridSize: number;
  polygons: MapboxDrawPolygon[];
  selectedPolygonId: string | null;
  measurements: AreaMeasurement | null;
  measurementUnit: MeasurementUnit;
  drawingMode: DrawingMode;
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
  searchResult,
  snapToGrid,
  gridSize,
  polygons,
  selectedPolygonId,
  measurements,
  measurementUnit,
  drawingMode,
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
        
        setPolygonCenter(null);
        originalPolygonRef.current = null;
        totalRotationRef.current = 0;
      }
    },
    deletePolygon: (polygonId: string) => {
      if (drawRef.current && mapRef.current) {
        const draw = drawRef.current;
        
        // Delete the specific polygon from Mapbox Draw
        draw.delete(polygonId);
        
        // Clear annotations and handles if no polygons remain
        const allFeatures = draw.getAll();
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
              'fill-color': '#2563eb',
              'fill-outline-color': '#2563eb',
              'fill-opacity': 0.3
            }
          },
          {
            id: 'gl-draw-polygon-fill-active',
            type: 'fill',
            filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
            paint: {
              'fill-color': '#3b82f6',
              'fill-outline-color': '#3b82f6',
              'fill-opacity': 0.4
            }
          },
          // Polygon stroke
          {
            id: 'gl-draw-polygon-stroke-inactive',
            type: 'line',
            filter: ['all', ['==', 'active', 'false'], ['==', '$type', 'Polygon']],
            paint: {
              'line-color': '#2563eb',
              'line-width': 2
            }
          },
          {
            id: 'gl-draw-polygon-stroke-active',
            type: 'line',
            filter: ['all', ['==', 'active', 'true'], ['==', '$type', 'Polygon']],
            paint: {
              'line-color': '#3b82f6',
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
      map.addControl(new mapboxgl.NavigationControl(), 'top-right');
      map.addControl(new mapboxgl.ScaleControl(), 'bottom-left');

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
          paint: {
            'fill-color': ['get', 'color'],
            'fill-opacity': 0.6
          }
        });

        map.addLayer({
          id: 'parking-overlays-stroke',
          type: 'line',
          source: 'parking-overlays',
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 2
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
          paint: {
            'circle-radius': 6,
            'circle-color': '#ffffff',
            'circle-stroke-color': '#2563eb',
            'circle-stroke-width': 2
          }
        });

        // Add side length annotations source
        map.addSource('side-annotations', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
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

        // Add drawing annotation layer with different styling
        map.addLayer({
          id: 'drawing-annotation',
          type: 'symbol',
          source: 'drawing-annotation',
          layout: {
            'text-field': ['get', 'label'],
            'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
            'text-size': 14,
            'text-anchor': 'center',
            'text-offset': [0, -1],
            'text-allow-overlap': true,
            'text-ignore-placement': true
          },
          paint: {
            'text-color': '#dc2626', // Red color for active drawing
            'text-halo-color': '#ffffff',
            'text-halo-width': 3
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
        
        // Handle drawing mode tracking for real-time measurements
        isDrawingMode = e.mode === 'draw_polygon';
        if (!isDrawingMode) {
          lastClickedPoint = null;
          // Clear annotation when not drawing
          const drawingSource = map.getSource('drawing-annotation') as mapboxgl.GeoJSONSource;
          if (drawingSource) {
            drawingSource.setData({ type: 'FeatureCollection', features: [] });
          }
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
        console.log('Selection changed:', e.features.length, 'features selected');
        
        if (!e.features || e.features.length === 0) {
          console.log('Nothing selected - clearing handles');
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
          console.log('Polygon selected:', selectedFeature);
          
          if (selectedFeature && selectedFeature.geometry.type === 'Polygon') {
            // Reset rotation state for newly selected polygon
            originalPolygonRef.current = null;
            totalRotationRef.current = 0;
            
            // Update rotation handles immediately using the selected feature directly
            updateRotationHandles(selectedFeature as MapboxDrawPolygon);
          }
        }
      });

      // Debounce parent updates to prevent excessive calls during selection
      let updateTimeout: NodeJS.Timeout | null = null;
      
      // Real-time drawing measurements - simple approach
      let lastClickedPoint: [number, number] | null = null;
      let isDrawingMode = false;
      
      
      // Track clicks to update the reference point - TEMPORARILY DISABLED FOR DEBUGGING
      // map.on('click', (e) => {
      //   if (drawingModeRef.current === 'draw' && isDrawingMode) {
      //     // Store the clicked point as our new reference
      //     lastClickedPoint = [e.lngLat.lng, e.lngLat.lat];
      //   }
      // });

      // Show real-time distance on mouse move
      map.on('mousemove', (e) => {
        // Only show in draw mode with a reference point
        if (drawingModeRef.current !== 'draw' || !isDrawingMode || !lastClickedPoint) {
          return;
        }

        const currentPoint: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        
        // Calculate distance from last clicked point to current mouse position
        const distance = calculateDistance(lastClickedPoint, currentPoint);
        const formattedDistance = formatDistance(distance, measurementUnit);
        
        // Calculate midpoint for annotation placement
        const midLng = (lastClickedPoint[0] + currentPoint[0]) / 2;
        const midLat = (lastClickedPoint[1] + currentPoint[1]) / 2;

        // Update drawing annotation
        const drawingSource = map.getSource('drawing-annotation') as mapboxgl.GeoJSONSource;
        if (drawingSource) {
          drawingSource.setData({
            type: 'FeatureCollection',
            features: [{
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [midLng, midLat]
              },
              properties: {
                label: formattedDistance
              }
            }]
          });
        }
      });

      // Clear drawing annotation when polygon is completed or mode changes
      map.on('draw.create', () => {
        const drawingSource = map.getSource('drawing-annotation') as mapboxgl.GeoJSONSource;
        if (drawingSource) {
          drawingSource.setData({ type: 'FeatureCollection', features: [] });
        }
      });
      


      // Handle parking overlay clicks
      map.on('click', 'parking-overlays-fill', (e) => {
        if (e.features && e.features.length > 0) {
          const feature = e.features[0];
          const overlayId = feature.properties?.id;
          const overlay = parkingOverlays.find(o => o.id === overlayId);
          if (overlay) {
            onParkingOverlayClick(overlay);
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

      map.on('mousedown', 'polygon-rotation-handles', (e) => {
        if (!e.features || e.features.length === 0) return;
        
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

      map.on('mousemove', (e) => {
        if (!isDragging || !currentCenter || !drawRef.current) return;
        
        e.preventDefault();
        
        const mousePoint = e.lngLat;
        const currentAngle = Math.atan2(mousePoint.lat - currentCenter[1], mousePoint.lng - currentCenter[0]);
        const deltaAngle = currentAngle - dragStartAngle;
        
        // Rotate the polygon
        rotatePolygonDirect(currentCenter, deltaAngle);
        
        // Update for next iteration
        dragStartAngle = currentAngle;
      });

      map.on('mouseup', () => {
        if (isDragging) {
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
      
      // Handle mouse leave to stop dragging
      map.on('mouseleave', () => {
        if (isDragging) {
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

      map.on('mouseenter', 'polygon-rotation-handles', () => {
        map.getCanvas().style.cursor = 'grab';
      });

      map.on('mouseleave', 'polygon-rotation-handles', () => {
        if (!isRotating) {
          map.getCanvas().style.cursor = 'crosshair';
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

  // Manage drawing mode and sync polygons
  useEffect(() => {
    if (!drawRef.current || !isMapLoaded || !mapRef.current) return;

    const draw = drawRef.current;
    const map = mapRef.current;
    
    // Add all existing polygons to draw instance
    const currentFeatures = draw.getAll();
    const currentIds = new Set(currentFeatures.features.map(f => f.id));
    
    polygons.forEach(polygon => {
      const polygonId = String(polygon.id || polygon.properties?.id || '');
      if (!currentIds.has(polygonId) && polygon.id) {
        draw.add(polygon);
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

  // Update parking overlays
  useEffect(() => {
    if (!mapRef.current || !isMapLoaded) return;

    const map = mapRef.current;
    const source = map.getSource('parking-overlays') as mapboxgl.GeoJSONSource;
    
    if (source) {
      const features = parkingOverlays.map(overlay => {
        const coordinates = calculateParkingSpaceCoordinates(overlay);
        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Polygon' as const,
            coordinates: [coordinates]
          },
          properties: {
            id: overlay.id,
            type: overlay.type,
            color: overlay.type === 'single' ? '#3b82f6' : '#1e40af'
          }
        };
      });

      source.setData({
        type: 'FeatureCollection',
        features
      });
    }
  }, [parkingOverlays, isMapLoaded]);

  // Update side length annotations for all polygons
  useEffect(() => {
    if (!mapRef.current || !isMapLoaded) return;

    const map = mapRef.current;
    const source = map.getSource('side-annotations') as mapboxgl.GeoJSONSource;
    
    if (!source) return;
    
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
  }, [measurementUnit, isMapLoaded]);

  // Update annotations when polygons change or are moved
  useEffect(() => {
    if (!mapRef.current || !isMapLoaded || !drawRef.current) return;

    const map = mapRef.current;
    const draw = drawRef.current;
    const source = map.getSource('side-annotations') as mapboxgl.GeoJSONSource;
    
    if (!source) return;
    
    // Function to refresh annotations
    const refreshAnnotations = () => {
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
  const totalRotationRef = useRef<number>(0);
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
    if (mapRef.current) {
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