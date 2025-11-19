'use client';

import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { MeasurementMode } from './LocationInputPanel';
import type { LSOATooltipData } from '@/lib/supabase-census-data';

// Set your Mapbox access token
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

// Traffic layer configuration
const TRAFFIC_TILESET_ID = 'dovet.a4p7c0q8';
const TRAFFIC_SOURCE_ID = 'traffic-roads';
const TRAFFIC_LAYER_ID = 'traffic-roads';
const TRAFFIC_SOURCE_LAYER = 'traffic_roads';

interface DemographicsMapProps {
  center: { lat: number; lng: number };
  radiusMiles: number;
  isochroneGeometry: any;
  loading: boolean;
  measurementMode: MeasurementMode;
  measurementValue: number;
  selectedLsoaCodes: Set<string>;
  allLsoaCodes: string[];
  onLsoaToggle: (code: string) => void;
  lsoaTooltipData: Record<string, LSOATooltipData>;
  showTraffic?: boolean; // Optional toggle for traffic layer visibility
}

export function DemographicsMap({
  center,
  radiusMiles,
  isochroneGeometry,
  loading,
  measurementMode,
  measurementValue,
  selectedLsoaCodes,
  allLsoaCodes,
  onLsoaToggle,
  lsoaTooltipData,
  showTraffic = false,
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
  const trafficHandlersAttached = useRef(false);
  const lastCenter = useRef<{ lat: number; lng: number } | null>(null);
  const lastRadius = useRef<number | null>(null);
  const [hoveredLsoa, setHoveredLsoa] = useState<LSOATooltipData | null>(null);
  const [hoveredRoad, setHoveredRoad] = useState<{
    roadNumber: string;
    classification: string;
    aadt: number;
  } | null>(null);

  // Calculate zoom level based on radius (larger radius = more zoomed out)
  // Note: LSOA vector tiles may have maxzoom ~10-12, so we avoid going below zoom 8
  const calculateZoom = (radius: number): number => {
    if (radius <= 5) return 11;
    if (radius <= 10) return 10;
    if (radius <= 20) return 9;
    if (radius <= 30) return 8.5;
    return 8;  // Don't go below 8 to ensure LSOA tiles remain visible
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

    // Only redraw if something actually changed (allow redraw when isochrone arrives)
    // Note: isochroneGeometry is in the dependency array, so this effect will re-run when it changes
    if (!centerChanged && !radiusChanged && isochroneGeometry === null) return;

    const addCircle = () => {
      if (!map.current || !map.current.isStyleLoaded()) return;

      // Remove existing overlay source and layers
      if (map.current.getSource('radius-circle')) {
        if (map.current.getLayer('radius-circle-fill')) {
          map.current.removeLayer('radius-circle-fill');
        }
        if (map.current.getLayer('radius-circle-outline')) {
          map.current.removeLayer('radius-circle-outline');
        }
        map.current.removeSource('radius-circle');
      }

      // Determine which geometry to use
      let geometry: any;

      console.log('[DemographicsMap] isochroneGeometry:', isochroneGeometry);
      console.log('[DemographicsMap] measurementMode:', measurementMode);

      if (isochroneGeometry) {
        // Use isochrone polygon for time-based modes
        console.log('[DemographicsMap] Using isochrone geometry');
        geometry = isochroneGeometry;
      } else {
        // Create circle coordinates for distance mode
        console.log('[DemographicsMap] Using circular radius geometry');
        const radiusMeters = radiusMiles * 1609.34;
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

        geometry = {
          type: 'Polygon',
          coordinates: [circleCoords],
        };
      }

      console.log('[DemographicsMap] Final geometry type:', geometry?.type);
      console.log('[DemographicsMap] Geometry coordinates length:', geometry?.coordinates?.[0]?.length);

      // Add overlay source
      map.current.addSource('radius-circle', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: geometry,
          properties: {},
        },
      });

      // Add overlay fill layer
      map.current.addLayer({
        id: 'radius-circle-fill',
        type: 'fill',
        source: 'radius-circle',
        paint: {
          'fill-color': '#fbbf24', // Amber/yellow
          'fill-opacity': 0.05,
        },
      });

      // Add overlay outline layer - yellow solid line to distinguish from LSOA boundaries
      map.current.addLayer({
        id: 'radius-circle-outline',
        type: 'line',
        source: 'radius-circle',
        paint: {
          'line-color': '#fbbf24', // Amber/yellow
          'line-width': 3,
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
  }, [center, radiusMiles, isochroneGeometry, mapLoaded]);

  // Draw LSOA boundaries using Mapbox vector tileset
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const addBoundaries = () => {
      if (!map.current || !map.current.isStyleLoaded()) return;

      // Remove existing LSOA layers and source
      if (map.current.getSource('lsoa-boundaries')) {
        const layersToRemove = [
          'lsoa-fill-selected',
          'lsoa-fill-deselected',
          'lsoa-outline-selected',
          'lsoa-outline-deselected',
          'lsoa-fill', // Legacy layer name
          'lsoa-outline' // Legacy layer name
        ];
        layersToRemove.forEach(layerId => {
          if (map.current?.getLayer(layerId)) {
            map.current.removeLayer(layerId);
          }
        });
        map.current.removeSource('lsoa-boundaries');
      }

      // Add LSOA boundaries from Mapbox vector tileset
      map.current.addSource('lsoa-boundaries', {
        type: 'vector',
        url: 'mapbox://dovet.3xo625k3',
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

      // Add LSOA fill layer for SELECTED LSOAs only
      // Insert before the first symbol layer so labels appear on top
      // Note: Tiles will be visible at all zoom levels via overzooming
      map.current.addLayer({
        id: 'lsoa-fill-selected',
        type: 'fill',
        source: 'lsoa-boundaries',
        'source-layer': 'Lower_layer_Super_Output_Area-4ntic5',
        layout: {},
        filter: ['in', ['get', 'LSOA21CD'], ['literal', []]],
        paint: {
          'fill-color': '#7c3aed',   // Selected: purple
          'fill-opacity': 0.3,
        },
      }, firstSymbolId);

      // Add LSOA fill layer for DESELECTED LSOAs (all LSOAs in the analysis)
      map.current.addLayer({
        id: 'lsoa-fill-deselected',
        type: 'fill',
        source: 'lsoa-boundaries',
        'source-layer': 'Lower_layer_Super_Output_Area-4ntic5',
        layout: {},
        filter: ['in', ['get', 'LSOA21CD'], ['literal', []]],
        paint: {
          'fill-color': '#64748b',   // Deselected: muted slate gray
          'fill-opacity': 0.15,
        },
      }, firstSymbolId);

      // Add LSOA outline layer for SELECTED LSOAs
      map.current.addLayer({
        id: 'lsoa-outline-selected',
        type: 'line',
        source: 'lsoa-boundaries',
        'source-layer': 'Lower_layer_Super_Output_Area-4ntic5',
        filter: ['in', ['get', 'LSOA21CD'], ['literal', []]],
        paint: {
          'line-color': '#ffffff',
          'line-width': 2.5,  // Selected: thicker
        },
      }, firstSymbolId);

      // Add LSOA outline layer for DESELECTED LSOAs
      map.current.addLayer({
        id: 'lsoa-outline-deselected',
        type: 'line',
        source: 'lsoa-boundaries',
        'source-layer': 'Lower_layer_Super_Output_Area-4ntic5',
        filter: ['in', ['get', 'LSOA21CD'], ['literal', []]],
        paint: {
          'line-color': '#ffffff',
          'line-width': 1.5,  // Deselected: thinner
        },
      }, firstSymbolId);

      // Add traffic layer immediately after LSOA layers
      // Only add if source doesn't already exist
      if (!map.current.getSource(TRAFFIC_SOURCE_ID)) {
        try {
          console.log('[DemographicsMap] Adding traffic source:', `mapbox://${TRAFFIC_TILESET_ID}`);
          map.current.addSource(TRAFFIC_SOURCE_ID, {
            type: 'vector',
            url: `mapbox://${TRAFFIC_TILESET_ID}`,
          });

          console.log('[DemographicsMap] Adding traffic layer, source-layer:', TRAFFIC_SOURCE_LAYER);
          map.current.addLayer({
            id: TRAFFIC_LAYER_ID,
            type: 'line',
            source: TRAFFIC_SOURCE_ID,
            'source-layer': TRAFFIC_SOURCE_LAYER,
            layout: {
              visibility: 'none', // Start hidden
            },
            paint: {
              'line-color': [
                'interpolate',
                ['linear'],
                ['get', 'aadt'],
                0,     '#e5e7eb',
                5000,  '#fde68a',
                10000, '#fbbf24',
                20000, '#f97316',
                35000, '#dc2626',
                50000, '#991b1b',
              ],
              'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                8,  1,
                10, 1.5,
                12, 2.5,
                14, 4,
                16, 6,
              ],
              'line-opacity': 0.75,
            },
          }, firstSymbolId);

          console.log('[DemographicsMap] Traffic layer added successfully');
        } catch (error) {
          console.error('[DemographicsMap] Error adding traffic layer:', error);
        }
      }
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
  }, [mapLoaded]);

  // Toggle traffic layer visibility based on showTraffic prop
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const updateTrafficVisibility = () => {
      if (!map.current?.getLayer(TRAFFIC_LAYER_ID)) {
        // Layer doesn't exist yet, try again
        setTimeout(updateTrafficVisibility, 50);
        return;
      }

      map.current.setLayoutProperty(
        TRAFFIC_LAYER_ID,
        'visibility',
        showTraffic ? 'visible' : 'none'
      );

      console.log('[DemographicsMap] Traffic layer visibility:', showTraffic ? 'visible' : 'none');
    };

    updateTrafficVisibility();
  }, [showTraffic, mapLoaded]);

  // Add traffic layer hover handlers
  useEffect(() => {
    if (!map.current || !mapLoaded || !showTraffic) {
      return;
    }

    let timeoutId: NodeJS.Timeout;
    let handlerCleanup: (() => void) | undefined;

    const checkAndAttachTrafficHandlers = () => {
      if (!map.current) return;

      // Check if layer exists
      if (!map.current.getLayer(TRAFFIC_LAYER_ID)) {
        timeoutId = setTimeout(checkAndAttachTrafficHandlers, 100);
        return;
      }

      if (trafficHandlersAttached.current) return;

      // Hover handlers for traffic roads
      const handleMouseEnter = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
        if (!map.current || !e.features || e.features.length === 0) return;

        map.current.getCanvas().style.cursor = 'pointer';

        const feature = e.features[0];
        const properties = feature.properties;

        if (properties) {
          setHoveredRoad({
            roadNumber: properties.road_number || 'Unknown',
            classification: properties.road_classification || 'Unknown',
            aadt: properties.aadt || 0,
          });
        }
      };

      const handleMouseLeave = () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = '';
        }
        setHoveredRoad(null);
      };

      // Attach handlers
      map.current.on('mouseenter', TRAFFIC_LAYER_ID, handleMouseEnter);
      map.current.on('mouseleave', TRAFFIC_LAYER_ID, handleMouseLeave);

      trafficHandlersAttached.current = true;

      // Store cleanup function
      handlerCleanup = () => {
        if (map.current) {
          map.current.off('mouseenter', TRAFFIC_LAYER_ID, handleMouseEnter);
          map.current.off('mouseleave', TRAFFIC_LAYER_ID, handleMouseLeave);
        }
        trafficHandlersAttached.current = false;
      };
    };

    checkAndAttachTrafficHandlers();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (handlerCleanup) handlerCleanup();
    };
  }, [mapLoaded, showTraffic]);

  // Add click handlers after layers are created
  useEffect(() => {
    if (!map.current || !mapLoaded) {
      return;
    }

    let timeoutId: NodeJS.Timeout;
    let handlerCleanup: (() => void) | undefined;

    // Wait for layer to exist
    const checkAndAttachHandlers = () => {
      if (!map.current) {
        return;
      }

      // Check if layers exist
      if (!map.current.getLayer('lsoa-fill-selected') || !map.current.getLayer('lsoa-fill-deselected')) {
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

      // Add event listeners to both selected and deselected layers
      const lsoaLayers = ['lsoa-fill-selected', 'lsoa-fill-deselected'];
      lsoaLayers.forEach(layerId => {
        map.current?.on('click', layerId, handleClick);
        map.current?.on('mouseenter', layerId, handleMouseEnter);
        map.current?.on('mousemove', layerId, handleMouseMove);
        map.current?.on('mouseleave', layerId, handleMouseLeave);
      });

      handlersAttached.current = true;

      // Store cleanup function
      handlerCleanup = () => {
        if (map.current) {
          lsoaLayers.forEach(layerId => {
            map.current?.off('click', layerId, handleClick);
            map.current?.off('mouseenter', layerId, handleMouseEnter);
            map.current?.off('mousemove', layerId, handleMouseMove);
            map.current?.off('mouseleave', layerId, handleMouseLeave);
          });
        }
        handlersAttached.current = false;
      };
    };

    checkAndAttachHandlers();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (handlerCleanup) handlerCleanup();
    };
  }, [mapLoaded, onLsoaToggle, lsoaTooltipData]);

  // Update filters when selection changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const updateFilters = () => {
      if (!map.current ||
          !map.current.getLayer('lsoa-fill-selected') ||
          !map.current.getLayer('lsoa-fill-deselected')) {
        // Layers not ready yet, try again after a short delay
        setTimeout(updateFilters, 50);
        return;
      }

      console.log('[DemographicsMap] Updating filters for', allLsoaCodes.length, 'LSOAs');
      console.log('[DemographicsMap] Selected count:', selectedLsoaCodes.size);

      // Convert Sets to Arrays for filter expressions
      const selectedArray = Array.from(selectedLsoaCodes);
      const deselectedArray = allLsoaCodes.filter(code => !selectedLsoaCodes.has(code));

      console.log('[DemographicsMap] Selected LSOAs:', selectedArray.length);
      console.log('[DemographicsMap] Deselected LSOAs:', deselectedArray.length);

      // Update selected layers to show only selected LSOAs
      map.current.setFilter('lsoa-fill-selected', ['in', ['get', 'LSOA21CD'], ['literal', selectedArray]]);
      map.current.setFilter('lsoa-outline-selected', ['in', ['get', 'LSOA21CD'], ['literal', selectedArray]]);

      // Update deselected layers to show only deselected LSOAs
      map.current.setFilter('lsoa-fill-deselected', ['in', ['get', 'LSOA21CD'], ['literal', deselectedArray]]);
      map.current.setFilter('lsoa-outline-deselected', ['in', ['get', 'LSOA21CD'], ['literal', deselectedArray]]);

      console.log('[DemographicsMap] Filters updated');
    };

    updateFilters();
  }, [selectedLsoaCodes, mapLoaded, allLsoaCodes]);

  return (
    <div className="absolute inset-0 w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* LSOA Info Box - Top Right */}
      {hoveredLsoa && !hoveredRoad && (
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

      {/* Traffic Road Info Box - Top Right */}
      {hoveredRoad && (
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 p-4 min-w-[240px] z-10">
          <div className="font-semibold text-gray-900 mb-2">
            {hoveredRoad.roadNumber}
          </div>
          <div className="space-y-1 text-sm text-gray-600">
            <div>
              <span className="font-medium">Type:</span>{' '}
              {hoveredRoad.classification}
            </div>
            <div>
              <span className="font-medium">Traffic:</span>{' '}
              {hoveredRoad.aadt.toLocaleString()} vehicles/day
            </div>
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
