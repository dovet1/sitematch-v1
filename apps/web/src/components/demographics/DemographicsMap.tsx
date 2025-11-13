'use client';

import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { MeasurementMode } from './LocationInputPanel';
import type { LSOATooltipData } from '@/lib/supabase-census-data';

// Set your Mapbox access token
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

interface DemographicsMapProps {
  center: { lat: number; lng: number };
  radiusMiles: number;
  lsoaBoundaries: GeoJSON.FeatureCollection | null;
  loading: boolean;
  measurementMode: MeasurementMode;
  measurementValue: number;
  selectedLsoaCodes: Set<string>;
  allLsoaCodes: string[];
  onLsoaToggle: (code: string) => void;
  lsoaTooltipData: Record<string, LSOATooltipData>;
}

export function DemographicsMap({
  center,
  radiusMiles,
  lsoaBoundaries,
  loading,
  measurementMode,
  measurementValue,
  selectedLsoaCodes,
  allLsoaCodes,
  onLsoaToggle,
  lsoaTooltipData,
}: DemographicsMapProps) {
  // Format display text based on mode
  const getMeasurementDisplay = () => {
    switch (measurementMode) {
      case 'distance':
        return `${measurementValue} mile${measurementValue !== 1 ? 's' : ''}`;
      case 'drive_time':
        return `${measurementValue} min drive`;
      case 'walk_time':
        return `${measurementValue} min walk`;
    }
  };
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const handlersAttached = useRef(false);
  const lastCenter = useRef<{ lat: number; lng: number } | null>(null);
  const lastRadius = useRef<number | null>(null);
  const [hoveredLsoa, setHoveredLsoa] = useState<LSOATooltipData | null>(null);

  // Calculate zoom level based on radius (larger radius = more zoomed out)
  const calculateZoom = (radius: number): number => {
    if (radius <= 5) return 10;
    if (radius <= 10) return 9;
    if (radius <= 20) return 8;
    if (radius <= 30) return 7.5;
    return 7;
  };

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    // Only initialize if not already initialized
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [center.lng, center.lat],
      zoom: calculateZoom(radiusMiles),
    });

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
        setMapLoaded(false);
      }
    };
  }, [center.lng, center.lat, radiusMiles]);

  // Update map center, zoom, and add marker when center or radius changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Check if the center has actually changed (new location search)
    const centerChanged = !lastCenter.current ||
      lastCenter.current.lat !== center.lat ||
      lastCenter.current.lng !== center.lng;

    // Only fly to location when the center actually changes (new location search)
    if (centerChanged) {
      map.current.flyTo({
        center: [center.lng, center.lat],
        zoom: calculateZoom(radiusMiles),
        essential: true,
      });
      lastCenter.current = { lat: center.lat, lng: center.lng };
    }

    // Remove existing marker
    const existingMarker = document.querySelector('.demographics-marker');
    if (existingMarker) {
      existingMarker.remove();
    }

    // Add marker for search location
    new mapboxgl.Marker({
      color: '#7c3aed', // Violet bloom color
      className: 'demographics-marker',
    })
      .setLngLat([center.lng, center.lat])
      .addTo(map.current);
  }, [center, radiusMiles, mapLoaded]);

  // Draw radius circle
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Check if center or radius has actually changed
    const centerChanged = !lastCenter.current ||
      lastCenter.current.lat !== center.lat ||
      lastCenter.current.lng !== center.lng;
    const radiusChanged = lastRadius.current !== radiusMiles;

    // Only redraw circle if center or radius actually changed
    if (!centerChanged && !radiusChanged) return;

    const addCircle = () => {
      if (!map.current || !map.current.isStyleLoaded()) return;

      const radiusMeters = radiusMiles * 1609.34;

      // Create circle coordinates
      const circleCoords: [number, number][] = [];
      const steps = 64;
      for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * 2 * Math.PI;
        const lat = center.lat + (radiusMeters / 111320) * Math.cos(angle);
        const lng =
          center.lng +
          (radiusMeters / (111320 * Math.cos((center.lat * Math.PI) / 180))) * Math.sin(angle);
        circleCoords.push([lng, lat]);
      }

      // Remove existing circle source and layer
      if (map.current.getSource('radius-circle')) {
        if (map.current.getLayer('radius-circle-fill')) {
          map.current.removeLayer('radius-circle-fill');
        }
        if (map.current.getLayer('radius-circle-outline')) {
          map.current.removeLayer('radius-circle-outline');
        }
        map.current.removeSource('radius-circle');
      }

      // Add circle source
      map.current.addSource('radius-circle', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [circleCoords],
          },
          properties: {},
        },
      });

      // Add circle fill layer
      map.current.addLayer({
        id: 'radius-circle-fill',
        type: 'fill',
        source: 'radius-circle',
        paint: {
          'fill-color': '#fbbf24', // Amber/yellow
          'fill-opacity': 0.05,
        },
      });

      // Add circle outline layer - yellow dashed line to distinguish from LSOA boundaries
      map.current.addLayer({
        id: 'radius-circle-outline',
        type: 'line',
        source: 'radius-circle',
        paint: {
          'line-color': '#fbbf24', // Amber/yellow
          'line-width': 3,
          'line-dasharray': [6, 4], // Longer dashes for distinction
        },
      });

      // Update last radius
      lastRadius.current = radiusMiles;
    };

    if (map.current.isStyleLoaded()) {
      addCircle();
    } else {
      map.current.once('style.load', addCircle);
    }
  }, [center, radiusMiles, mapLoaded]);

  // Draw LSOA boundaries (initial setup - only when boundaries change)
  useEffect(() => {
    if (!map.current || !mapLoaded || !lsoaBoundaries) return;

    const addBoundaries = () => {
      if (!map.current || !map.current.isStyleLoaded()) return;

      // Remove existing LSOA layers and source
      if (map.current.getSource('lsoa-boundaries')) {
        if (map.current.getLayer('lsoa-fill')) {
          map.current.removeLayer('lsoa-fill');
        }
        if (map.current.getLayer('lsoa-outline')) {
          map.current.removeLayer('lsoa-outline');
        }
        map.current.removeSource('lsoa-boundaries');
      }

      // Add LSOA boundaries source
      map.current.addSource('lsoa-boundaries', {
        type: 'geojson',
        data: lsoaBoundaries,
      });

      // Find the first symbol layer (labels) to insert boundaries before it
      const layers = map.current.getStyle().layers;
      let firstSymbolId: string | undefined;
      for (const layer of layers || []) {
        if (layer.type === 'symbol') {
          firstSymbolId = layer.id;
          break;
        }
      }

      // Add LSOA fill layer with initial styling (will be updated by separate effect)
      // Insert before the first symbol layer so labels appear on top
      map.current.addLayer({
        id: 'lsoa-fill',
        type: 'fill',
        source: 'lsoa-boundaries',
        layout: {},
        paint: {
          'fill-color': '#7c3aed', // Purple
          'fill-opacity': 0.3,
        },
      }, firstSymbolId);

      // Add LSOA outline layer with white color
      map.current.addLayer({
        id: 'lsoa-outline',
        type: 'line',
        source: 'lsoa-boundaries',
        paint: {
          'line-color': '#ffffff',
          'line-width': 2,
        },
      }, firstSymbolId);
    };

    // Use idle event instead of style.load to ensure map is fully ready after flyTo
    const tryAddBoundaries = () => {
      if (map.current && map.current.isStyleLoaded()) {
        addBoundaries();
      } else {
        map.current?.once('style.load', addBoundaries);
      }
    };

    if (map.current.isStyleLoaded()) {
      addBoundaries();
    } else {
      map.current.once('idle', tryAddBoundaries);
    }
  }, [lsoaBoundaries, mapLoaded]);

  // Add click handlers after layers are created
  useEffect(() => {
    if (!map.current || !mapLoaded || !lsoaBoundaries) {
      return;
    }

    let timeoutId: NodeJS.Timeout;
    let handlerCleanup: (() => void) | undefined;

    // Wait for layer to exist
    const checkAndAttachHandlers = () => {
      if (!map.current) {
        return;
      }

      // Check if layer exists
      if (!map.current.getLayer('lsoa-fill')) {
        // Try again after a short delay
        timeoutId = setTimeout(checkAndAttachHandlers, 100);
        return;
      }

      if (handlersAttached.current) {
        return;
      }

      // Click handler to toggle LSOA selection
      const handleClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
        if (!e.features || e.features.length === 0) return;

        const feature = e.features[0];
        const lsoaCode = feature.properties?.LSOA21CD;

        if (lsoaCode) {
          onLsoaToggle(lsoaCode);
        }
      };

      // Hover handlers with info box
      let currentLsoaCode: string | null = null;

      const updateHoverInfo = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
        if (!map.current || !e.features || e.features.length === 0) return;

        const feature = e.features[0];
        const lsoaCode = feature.properties?.LSOA21CD;

        // Only update if LSOA has changed
        if (lsoaCode === currentLsoaCode) return;
        currentLsoaCode = lsoaCode;

        const tooltipInfo = lsoaTooltipData[lsoaCode];
        if (tooltipInfo) {
          setHoveredLsoa(tooltipInfo);
        }
      };

      const handleMouseEnter = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
        if (!map.current) return;
        map.current.getCanvas().style.cursor = 'pointer';
        updateHoverInfo(e);
      };

      const handleMouseMove = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
        updateHoverInfo(e);
      };

      const handleMouseLeave = () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = '';
        }
        setHoveredLsoa(null);
        currentLsoaCode = null;
      };

      // Add event listeners
      map.current.on('click', 'lsoa-fill', handleClick);
      map.current.on('mouseenter', 'lsoa-fill', handleMouseEnter);
      map.current.on('mousemove', 'lsoa-fill', handleMouseMove);
      map.current.on('mouseleave', 'lsoa-fill', handleMouseLeave);

      handlersAttached.current = true;

      // Store cleanup function
      handlerCleanup = () => {
        if (map.current) {
          map.current.off('click', 'lsoa-fill', handleClick);
          map.current.off('mouseenter', 'lsoa-fill', handleMouseEnter);
          map.current.off('mousemove', 'lsoa-fill', handleMouseMove);
          map.current.off('mouseleave', 'lsoa-fill', handleMouseLeave);
        }
        handlersAttached.current = false;
      };
    };

    checkAndAttachHandlers();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (handlerCleanup) handlerCleanup();
    };
  }, [lsoaBoundaries, mapLoaded, onLsoaToggle]);

  // Update layer styling when selection changes (without recreating layers)
  useEffect(() => {
    if (!map.current || !mapLoaded || !lsoaBoundaries) return;
    if (!map.current.getLayer('lsoa-fill')) return;

    const selectedCodesArray = Array.from(selectedLsoaCodes);

    // Update fill layer paint properties
    map.current.setPaintProperty('lsoa-fill', 'fill-color', [
      'case',
      ['in', ['get', 'LSOA21CD'], ['literal', selectedCodesArray]],
      '#7c3aed', // Selected: purple
      '#64748b'  // Deselected: muted slate gray
    ]);

    map.current.setPaintProperty('lsoa-fill', 'fill-opacity', [
      'case',
      ['in', ['get', 'LSOA21CD'], ['literal', selectedCodesArray]],
      0.3, // Selected: 30% opacity
      0.15 // Deselected: very subtle
    ]);

    // Update outline layer paint properties - white for both
    map.current.setPaintProperty('lsoa-outline', 'line-color', '#ffffff');

    map.current.setPaintProperty('lsoa-outline', 'line-width', [
      'case',
      ['in', ['get', 'LSOA21CD'], ['literal', selectedCodesArray]],
      2.5, // Selected: thicker
      1.5  // Deselected: thinner
    ]);
  }, [selectedLsoaCodes, mapLoaded, lsoaBoundaries]);

  return (
    <div className="absolute inset-0 w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* LSOA Info Box - Top Right */}
      {hoveredLsoa && (
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 p-4 min-w-[240px] z-10">
          <div className="font-semibold text-gray-900 mb-2">{hoveredLsoa.geo_name}</div>
          <div className="space-y-1 text-sm text-gray-600">
            <div>
              <span className="font-medium">Population:</span>{' '}
              {hoveredLsoa.population.toLocaleString()}
            </div>
            {hoveredLsoa.affluence_score && (
              <div>
                <span className="font-medium">Affluence:</span>{' '}
                {hoveredLsoa.affluence_score.toFixed(1)}
              </div>
            )}
          </div>
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading map data...</p>
          </div>
        </div>
      )}
    </div>
  );
}
