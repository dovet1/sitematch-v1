'use client';

import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Set your Mapbox access token
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

interface DemographicsMapProps {
  center: { lat: number; lng: number };
  radiusMiles: number;
  lsoaBoundaries: GeoJSON.FeatureCollection | null;
  loading: boolean;
}

export function DemographicsMap({
  center,
  radiusMiles,
  lsoaBoundaries,
  loading,
}: DemographicsMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

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
      style: 'mapbox://styles/mapbox/light-v11',
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

    // Fly to new center with appropriate zoom for radius
    map.current.flyTo({
      center: [center.lng, center.lat],
      zoom: calculateZoom(radiusMiles),
      essential: true,
    });

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
          'fill-color': '#7c3aed',
          'fill-opacity': 0.1,
        },
      });

      // Add circle outline layer
      map.current.addLayer({
        id: 'radius-circle-outline',
        type: 'line',
        source: 'radius-circle',
        paint: {
          'line-color': '#7c3aed',
          'line-width': 2,
          'line-dasharray': [2, 2],
        },
      });
    };

    if (map.current.isStyleLoaded()) {
      addCircle();
    } else {
      map.current.once('style.load', addCircle);
    }
  }, [center, radiusMiles, mapLoaded]);

  // Draw LSOA boundaries
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

      // Add LSOA fill layer
      const beforeLayer = map.current.getLayer('radius-circle-fill') ? 'radius-circle-fill' : undefined;
      map.current.addLayer({
        id: 'lsoa-fill',
        type: 'fill',
        source: 'lsoa-boundaries',
        paint: {
          'fill-color': '#7c3aed', // Violet bloom color
          'fill-opacity': 0.4,
        },
      }, beforeLayer);

      // Add LSOA outline layer
      map.current.addLayer({
        id: 'lsoa-outline',
        type: 'line',
        source: 'lsoa-boundaries',
        paint: {
          'line-color': '#5b21b6', // Darker violet
          'line-width': 2,
        },
      });

      // Add click handler to show LSOA info
      map.current.on('click', 'lsoa-fill', (e) => {
        if (!e.features || e.features.length === 0) return;

        const feature = e.features[0];
        const properties = feature.properties;

        new mapboxgl.Popup()
          .setLngLat(e.lngLat)
          .setHTML(
            `<div class="p-2">
              <p class="font-semibold">${properties?.LSOA21NM || 'Unknown LSOA'}</p>
              <p class="text-sm text-gray-600">${properties?.LSOA21CD || ''}</p>
            </div>`
          )
          .addTo(map.current!);
      });

      // Change cursor on hover
      map.current.on('mouseenter', 'lsoa-fill', () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = 'pointer';
        }
      });

      map.current.on('mouseleave', 'lsoa-fill', () => {
        if (map.current) {
          map.current.getCanvas().style.cursor = '';
        }
      });
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

  return (
    <div className="absolute inset-0 w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
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
