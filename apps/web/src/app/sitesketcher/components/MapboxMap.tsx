'use client';

import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { createMapboxMap, getMapboxToken, flyToLocation, addGridOverlay, removeGridOverlay } from '@/lib/sitesketcher/mapbox-utils';
import type { MapboxDrawPolygon, ParkingOverlay, SearchResult, AreaMeasurement, MeasurementUnit } from '@/types/sitesketcher';
import { calculateDistance, formatDistance } from '@/lib/sitesketcher/measurement-utils';
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
  measurements: AreaMeasurement | null;
  measurementUnit: MeasurementUnit;
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
  measurements,
  measurementUnit,
  className = ''
}, ref) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [rotationStartAngle, setRotationStartAngle] = useState(0);
  const [polygonCenter, setPolygonCenter] = useState<[number, number] | null>(null);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    clearAllDrawings: () => {
      if (drawRef.current && mapRef.current) {
        const draw = drawRef.current;
        const map = mapRef.current;
        
        // Delete all drawings
        draw.deleteAll();
        
        // Re-enter polygon drawing mode
        draw.changeMode('draw_polygon');
        
        // Restore crosshair cursor
        map.getCanvas().style.cursor = 'crosshair';
      }
      
      // Also clear side annotations and rotation handles immediately
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
    },
    deletePolygon: (polygonId: string) => {
      if (drawRef.current && mapRef.current) {
        const draw = drawRef.current;
        
        console.log('MapboxMap deletePolygon called with ID:', polygonId);
        console.log('All features before delete:', draw.getAll().features.map(f => ({ id: f.id, properties: f.properties })));
        
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
        
        // Remain in drawing mode after deletion
        draw.changeMode('draw_polygon');
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

      // Rotation handle event handlers
      let isDragging = false;
      let dragStartAngle = 0;
      let currentCenter: [number, number] | null = null;

      map.on('mousedown', 'polygon-rotation-handles', (e) => {
        if (!e.features || e.features.length === 0) return;
        
        e.preventDefault();
        isDragging = true;
        isRotatingRef.current = true;
        
        // Get current polygon and center
        const allFeatures = drawRef.current?.getAll();
        if (!allFeatures || allFeatures.features.length === 0) return;
        
        const polygon = allFeatures.features[0];
        if (polygon.geometry.type !== 'Polygon') return;
        
        const coordinates = polygon.geometry.coordinates[0];
        currentCenter = calculatePolygonCenterLocal(coordinates);
        
        const mousePoint = e.lngLat;
        dragStartAngle = Math.atan2(mousePoint.lat - currentCenter[1], mousePoint.lng - currentCenter[0]);
        
        map.getCanvas().style.cursor = 'grabbing';
        map.dragPan.disable();
        map.doubleClickZoom.disable();
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
          map.getCanvas().style.cursor = 'crosshair';
          map.dragPan.enable();
          map.doubleClickZoom.enable();
        }
      });
      
      // Handle mouse leave to stop dragging
      map.on('mouseleave', () => {
        if (isDragging) {
          isDragging = false;
          isRotatingRef.current = false;
          currentCenter = null;
          map.getCanvas().style.cursor = 'crosshair';
          map.dragPan.enable();
          map.doubleClickZoom.enable();
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

  // Keep map always in polygon draw mode
  useEffect(() => {
    if (!drawRef.current || !isMapLoaded || !mapRef.current) return;

    const draw = drawRef.current;
    const map = mapRef.current;
    
    draw.changeMode('draw_polygon');
    
    // Set crosshairs cursor for drawing
    map.getCanvas().style.cursor = 'crosshair';
    
    // Override cursor for drawing interactions
    const setCrosshairCursor = () => {
      map.getCanvas().style.cursor = 'crosshair';
    };
    
    // Add event listeners to maintain crosshair cursor during drawing
    map.on('mousemove', setCrosshairCursor);
    map.on('mouseenter', setCrosshairCursor);
    
    return () => {
      map.off('mousemove', setCrosshairCursor);
      map.off('mouseenter', setCrosshairCursor);
    };
  }, [isMapLoaded]);

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

  // Update side length annotations
  useEffect(() => {
    if (!mapRef.current || !isMapLoaded || !polygons.length || !measurements) return;

    const map = mapRef.current;
    const source = map.getSource('side-annotations') as mapboxgl.GeoJSONSource;
    
    if (source && measurements.sideLengths.length > 0) {
      const polygon = polygons[0]; // Use first polygon
      const coordinates = polygon.geometry.coordinates[0];
      
      const features = [];
      
      // Create annotation for each side
      for (let i = 0; i < coordinates.length - 1; i++) {
        const startPoint = coordinates[i];
        const endPoint = coordinates[i + 1];
        
        // Calculate midpoint of the side
        const midLng = (startPoint[0] + endPoint[0]) / 2;
        const midLat = (startPoint[1] + endPoint[1]) / 2;
        
        // Get side length and format it
        const lengthMeters = measurements.sideLengths[i];
        const formattedLength = formatDistance(lengthMeters, measurementUnit);
        
        features.push({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [midLng, midLat]
          },
          properties: {
            label: formattedLength,
            sideIndex: i
          }
        });
      }
      
      source.setData({
        type: 'FeatureCollection',
        features
      });
    } else if (source) {
      // Clear annotations when no polygon
      source.setData({
        type: 'FeatureCollection',
        features: []
      });
    }
  }, [polygons, measurements, measurementUnit, isMapLoaded]);

  // Update polygon rotation handles
  useEffect(() => {
    if (!mapRef.current || !isMapLoaded) return;

    const map = mapRef.current;
    const source = map.getSource('polygon-rotation-handles') as mapboxgl.GeoJSONSource;
    
    if (!polygons.length) {
      // Clear rotation handles when no polygon
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features: []
        });
      }
      setPolygonCenter(null);
      originalPolygonRef.current = null;
      totalRotationRef.current = 0;
      return;
    }
    
    if (source) {
      const polygon = polygons[0]; // Use first polygon
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
    }
  }, [polygons, isMapLoaded]);

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
    if (!drawRef.current) return;

    const draw = drawRef.current;
    const allFeatures = draw.getAll();
    
    if (allFeatures.features.length === 0) return;
    
    const polygon = allFeatures.features[0];
    if (polygon.geometry.type !== 'Polygon') return;
    
    // Store original coordinates if not already stored
    if (!originalPolygonRef.current) {
      originalPolygonRef.current = polygon.geometry.coordinates[0].map(coord => [...coord]);
    }
    
    // Update total rotation
    totalRotationRef.current += deltaAngle;
    
    const originalCoords = originalPolygonRef.current;
    
    // Rotate from original coordinates to maintain precision
    const rotatedCoords = originalCoords.map((coord: number[], index: number) => {
      // Skip the last coordinate as it's the same as the first
      if (index === originalCoords.length - 1) {
        return coord; // Will be updated after the loop
      }
      
      const dx = coord[0] - center[0];
      const dy = coord[1] - center[1];
      
      const totalAngle = totalRotationRef.current;
      const rotatedX = dx * Math.cos(totalAngle) - dy * Math.sin(totalAngle);
      const rotatedY = dx * Math.sin(totalAngle) + dy * Math.cos(totalAngle);
      
      return [center[0] + rotatedX, center[1] + rotatedY];
    });
    
    // Ensure the polygon is closed
    rotatedCoords[rotatedCoords.length - 1] = rotatedCoords[0];
    
    // Update the polygon coordinates directly
    polygon.geometry.coordinates[0] = rotatedCoords;
    
    // Remove and re-add to trigger visual update
    draw.delete(String(polygon.id));
    draw.add(polygon);
    
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