import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import styles from './InteractiveMapView.module.css';

// Dynamically import mapbox-gl to avoid SSR issues
let mapboxgl: any;

interface Location {
  id?: string;
  place_name: string;
  coordinates?: any; // JSONB field can contain various formats
  formatted_address?: string;
  region?: string;
  country?: string;
  // Legacy fields for backward compatibility
  latitude?: number;
  longitude?: number;
}

interface InteractiveMapViewProps {
  locations: Location[];
  onMapStateChange?: (isMapboxActive: boolean) => void;
}

export function InteractiveMapView({ locations, onMapStateChange }: InteractiveMapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [useMapbox, setUseMapbox] = useState(false);

  // Memoize locations to prevent unnecessary re-renders
  const stableLocations = useMemo(() => locations, [JSON.stringify(locations)]);

  // Debug state changes
  useEffect(() => {
    console.log('=== STATE CHANGE ===');
    console.log('mapLoaded:', mapLoaded);
    console.log('useMapbox:', useMapbox);
  }, [mapLoaded, useMapbox]);

  // Notify parent of map state changes
  useEffect(() => {
    if (onMapStateChange) {
      onMapStateChange(useMapbox);
    }
  }, [useMapbox, onMapStateChange]);

  useEffect(() => {
    const initializeMap = async () => {
      try {
        // Check if we have a Mapbox token
        const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
        
        console.log('=== MAP INITIALIZATION START ===');
        console.log('Mapbox token available:', !!mapboxToken);
        console.log('Window defined:', typeof window !== 'undefined');
        console.log('Locations:', stableLocations);
        console.log('Map container exists:', !!mapContainer.current);
        console.log('Map already created:', !!map.current);
        
        if (mapboxToken && typeof window !== 'undefined') {
          // Dynamically import mapbox-gl
          mapboxgl = (await import('mapbox-gl')).default;
          
          if (mapContainer.current && !map.current) {
            console.log('Initializing Mapbox map...');
            mapboxgl.accessToken = mapboxToken;
            
            // Helper function to get coordinates
            const getCoordinates = (location: Location) => {
              console.log('Processing location:', {
                place_name: location.place_name,
                coordinates: location.coordinates,
                coordinates_type: typeof location.coordinates,
                isArray: Array.isArray(location.coordinates)
              });
              
              // Handle JSONB coordinates from database
              if (location.coordinates) {
                // Handle GeoJSON format: [longitude, latitude] array
                if (Array.isArray(location.coordinates) && location.coordinates.length === 2) {
                  const [lng, lat] = location.coordinates;
                  if (typeof lng === 'number' && typeof lat === 'number' &&
                      !isNaN(lng) && !isNaN(lat)) {
                    console.log('Found valid coordinates (GeoJSON array):', lat, lng);
                    return { lat, lng };
                  } else {
                    console.log('Array coordinates are not valid numbers:', location.coordinates);
                  }
                }
                // Handle object format: {lat, lng} or {latitude, longitude}
                else if (typeof location.coordinates === 'object' && location.coordinates !== null) {
                  const coords = location.coordinates as any;
                  console.log('Coordinates object keys:', Object.keys(coords));
                  
                  if (coords.lat !== undefined && coords.lng !== undefined && 
                      coords.lat !== null && coords.lng !== null &&
                      typeof coords.lat === 'number' && typeof coords.lng === 'number') {
                    console.log('Found valid coordinates (lat/lng):', coords.lat, coords.lng);
                    return { lat: coords.lat, lng: coords.lng };
                  } else if (coords.latitude !== undefined && coords.longitude !== undefined && 
                             coords.latitude !== null && coords.longitude !== null &&
                             typeof coords.latitude === 'number' && typeof coords.longitude === 'number') {
                    console.log('Found valid coordinates (latitude/longitude):', coords.latitude, coords.longitude);
                    return { lat: coords.latitude, lng: coords.longitude };
                  } else {
                    console.log('Coordinates object exists but values are invalid:', coords);
                  }
                } else {
                  console.log('Coordinates is not a valid object or array:', location.coordinates);
                }
              } else {
                console.log('No coordinates field found');
              }
              
              // Legacy direct properties
              if (typeof location.latitude === 'number' && typeof location.longitude === 'number' &&
                  location.latitude !== null && location.longitude !== null) {
                console.log('Found valid legacy coordinates:', location.latitude, location.longitude);
                return { lat: location.latitude, lng: location.longitude };
              }
              
              console.log('No valid coordinates found for location:', location.place_name);
              return null;
            };

            // Filter locations with valid coordinates
            const validLocations = stableLocations.filter(loc => getCoordinates(loc) !== null);
            console.log('Valid locations with coordinates:', validLocations.length, 'out of', stableLocations.length);

            if (validLocations.length === 0) {
              console.log('No valid coordinates found, using placeholder');
              setMapLoaded(true);
              setUseMapbox(false);
              return;
            }

            // Calculate bounds for all valid locations
            let bounds: [number, number, number, number] | null = null;
            if (validLocations.length > 0) {
              const coords = validLocations.map(loc => getCoordinates(loc)!);
              const lngs = coords.map(c => c.lng);
              const lats = coords.map(c => c.lat);
              bounds = [
                Math.min(...lngs), Math.min(...lats),
                Math.max(...lngs), Math.max(...lats)
              ];
              console.log('Calculated bounds:', bounds);
            }

            try {
              const firstCoords = getCoordinates(validLocations[0])!;
              map.current = new mapboxgl.Map({
                container: mapContainer.current,
                style: 'mapbox://styles/mapbox/light-v11',
                center: [firstCoords.lng, firstCoords.lat],
                zoom: validLocations.length === 1 ? 8 : 8,  // Consistent zoom level to show surrounding pins
                attributionControl: false
              });

              // Ensure map fills container
              map.current.getContainer().style.width = '100%';
              map.current.getContainer().style.height = '100%';

              console.log('Map created successfully');

              map.current.on('load', () => {
                console.log('Map loaded successfully');
                setMapLoaded(true);
                setUseMapbox(true);
                
                // Force map to resize to fill container
                setTimeout(() => {
                  if (map.current) {
                    map.current.resize();
                  }
                }, 100);

              // Add custom markers for each valid location
              validLocations.forEach((location, index) => {
                const coords = getCoordinates(location)!;
                // Create marker element
                const markerElement = document.createElement('div');
                markerElement.className = 'custom-marker';
                markerElement.style.width = '24px';
                markerElement.style.height = '24px';
                markerElement.style.borderRadius = '50%';
                markerElement.style.backgroundColor = '#8b5cf6';
                markerElement.style.border = '2px solid white';
                markerElement.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
                markerElement.style.cursor = 'pointer';
                markerElement.style.display = 'flex';
                markerElement.style.alignItems = 'center';
                markerElement.style.justifyContent = 'center';
                
                // Add icon
                markerElement.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`;

                // Create popup
                const popup = new mapboxgl.Popup({ offset: 25 })
                  .setHTML(`<div style="padding: 8px; font-size: 14px; color: #374151;">
                    <strong>${location.place_name.split(',')[0]}</strong>
                    ${location.region ? `<br><span style="color: #6b7280;">${location.region}</span>` : ''}
                  </div>`);

                // Add marker to map
                new mapboxgl.Marker(markerElement)
                  .setLngLat([coords.lng, coords.lat])
                  .setPopup(popup)
                  .addTo(map.current);
              });

              // Fit map to show all markers if multiple locations
              if (validLocations.length > 1 && bounds) {
                map.current.fitBounds(bounds, {
                  padding: { top: 80, bottom: 80, left: 80, right: 80 },  // More padding to zoom out further
                  maxZoom: 8  // Limit maximum zoom to ensure more area is visible
                });
              }
            });

            map.current.on('error', (e: any) => {
              console.error('Mapbox error:', e);
              console.log('=== MAPBOX ERROR - REVERTING TO PLACEHOLDER ===');
              setMapLoaded(true);
              setUseMapbox(false);
            });
          } catch (mapError) {
            console.error('Failed to create map:', mapError);
            console.log('=== MAP CREATION FAILED - USING PLACEHOLDER ===');
            setMapLoaded(true);
            setUseMapbox(false);
          }
        } else if (!mapContainer.current) {
          console.log('=== MAP CONTAINER NOT READY - USING PLACEHOLDER ===');
          setTimeout(() => {
            setMapLoaded(true);
            setUseMapbox(false);
          }, 1000);
        } else if (map.current) {
          console.log('=== MAP ALREADY EXISTS - PRESERVING EXISTING MAP ===');
          setMapLoaded(true);
          setUseMapbox(true); // Keep using the existing map
        }
      } else {
        console.log('=== NO TOKEN OR NOT IN BROWSER - USING PLACEHOLDER ===');
        setTimeout(() => {
          setMapLoaded(true);
          setUseMapbox(false);
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to load Mapbox, using placeholder:', error);
      console.log('=== GENERAL ERROR - USING PLACEHOLDER ===');
      setTimeout(() => {
        setMapLoaded(true);
        setUseMapbox(false);
      }, 1000);
    }
    };

    initializeMap();

    return () => {
      console.log('=== CLEANUP TRIGGERED ===');
      if (map.current) {
        console.log('=== REMOVING MAP ===');
        map.current.remove();
        map.current = null;
      }
    };
  }, [stableLocations]); // Use stable locations

  return (
    <div className="relative h-full w-full">
      {/* Map Container */}
      <div ref={mapContainer} className={styles.mapContainer}>
        {!mapLoaded ? (
          <div className={styles.loadingState}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full"
            />
          </div>
        ) : !useMapbox ? (
          // Fallback placeholder when Mapbox is not available
          <div className={styles.placeholderState}>
            {/* Simulated map background */}
            <div className="absolute inset-0 opacity-30">
              <div className="w-full h-full bg-gradient-to-br from-blue-900/20 to-green-900/20" />
              {/* Grid pattern to simulate map */}
              <div className="absolute inset-0" 
                   style={{
                     backgroundImage: `
                       linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                       linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
                     `,
                     backgroundSize: '50px 50px'
                   }} 
              />
            </div>

            {/* Location markers for placeholder */}
            {stableLocations.map((location, index) => (
              <motion.div
                key={index}
                className="absolute w-6 h-6 transform -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${20 + (index * 25) % 60}%`,
                  top: `${30 + (index * 15) % 40}%`
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.1, type: 'spring' }}
              >
                {/* Pulsing ring */}
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-violet-400"
                  animate={{
                    scale: [1, 2, 2.5],
                    opacity: [0.8, 0.3, 0]
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: index * 0.2
                  }}
                />
                
                {/* Marker core */}
                <div className="relative w-6 h-6 bg-violet-500 rounded-full shadow-lg flex items-center justify-center">
                  <MapPin className="w-3 h-3 text-white" />
                </div>
                
                {/* Tooltip */}
                <motion.div
                  className="absolute bottom-8 left-1/2 transform -translate-x-1/2 
                           bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-xs 
                           text-gray-800 whitespace-nowrap shadow-lg opacity-0 hover:opacity-100"
                  transition={{ duration: 0.2 }}
                >
                  {location.place_name.split(',')[0]}
                </motion.div>
              </motion.div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Map overlay gradient - only show on placeholder */}
      {!useMapbox && (
        <div className="absolute inset-0 bg-gradient-to-t from-violet-900/30 to-transparent pointer-events-none" />
      )}
      
    </div>
  );
}