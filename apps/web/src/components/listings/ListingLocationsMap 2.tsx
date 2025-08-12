'use client';

import { useMemo } from 'react';
import { Map, Marker } from 'react-map-gl/mapbox';
import { MapPin } from 'lucide-react';
import '@/styles/map-mobile.css';

interface Location {
  id: string;
  place_name: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  type?: string;
}

interface ListingLocationsMapProps {
  locations: Location[];
  height?: string;
  interactive?: boolean;
}

// Mapbox token from environment
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export function ListingLocationsMap({ 
  locations, 
  height = '400px',
  interactive = true 
}: ListingLocationsMapProps) {
  
  // Filter locations that have valid coordinates
  const mappableLocations = useMemo(() => 
    locations.filter(loc => loc.coordinates?.lat && loc.coordinates?.lng),
    [locations]
  );

  // Calculate center and zoom to fit all locations
  const viewState = useMemo(() => {
    if (mappableLocations.length === 0) {
      // Default UK view
      return {
        longitude: -3.5,
        latitude: 54.8,
        zoom: 5
      };
    }

    if (mappableLocations.length === 1) {
      // Single location - zoom in
      return {
        longitude: mappableLocations[0].coordinates!.lng,
        latitude: mappableLocations[0].coordinates!.lat,
        zoom: 10
      };
    }

    // Multiple locations - calculate bounds
    const lats = mappableLocations.map(loc => loc.coordinates!.lat);
    const lngs = mappableLocations.map(loc => loc.coordinates!.lng);
    
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    
    // Calculate appropriate zoom level
    const latDiff = maxLat - minLat;
    const lngDiff = maxLng - minLng;
    const maxDiff = Math.max(latDiff, lngDiff);
    
    let zoom = 10;
    if (maxDiff > 10) zoom = 5;
    else if (maxDiff > 5) zoom = 6;
    else if (maxDiff > 2) zoom = 7;
    else if (maxDiff > 1) zoom = 8;
    else if (maxDiff > 0.5) zoom = 9;
    
    return {
      longitude: centerLng,
      latitude: centerLat,
      zoom
    };
  }, [mappableLocations]);

  if (!MAPBOX_TOKEN) {
    return (
      <div 
        className="flex items-center justify-center bg-gray-100 rounded-lg border border-gray-200"
        style={{ height }}
      >
        <div className="text-center text-gray-500">
          <MapPin className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm">Map unavailable</p>
        </div>
      </div>
    );
  }

  if (mappableLocations.length === 0) {
    return (
      <div 
        className="flex items-center justify-center bg-gradient-to-br from-violet-50 to-purple-50 rounded-lg border border-violet-200"
        style={{ height }}
      >
        <div className="text-center">
          <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <MapPin className="w-8 h-8 text-violet-500" />
          </div>
          <p className="text-gray-700 font-medium">Nationwide Coverage</p>
          <p className="text-sm text-gray-600 mt-1">Open to opportunities across the UK & Ireland</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg overflow-hidden border border-gray-200" style={{ height }}>
      <Map
        {...viewState}
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        attributionControl={false}
        interactive={interactive}
        scrollZoom={interactive}
        doubleClickZoom={interactive}
        dragPan={interactive}
      >
        {mappableLocations.map((location) => (
          <Marker
            key={location.id}
            longitude={location.coordinates!.lng}
            latitude={location.coordinates!.lat}
            anchor="bottom"
          >
            <div className="relative group">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center shadow-lg
                transform transition-all duration-200 hover:scale-110
                ${location.type === 'preferred' 
                  ? 'bg-violet-600 hover:bg-violet-700' 
                  : 'bg-blue-600 hover:bg-blue-700'}
              `}>
                <MapPin className="w-5 h-5 text-white" />
              </div>
              
              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-lg">
                  <p className="font-medium">{location.place_name}</p>
                  {location.type && (
                    <p className="text-gray-300 capitalize text-[10px]">{location.type} location</p>
                  )}
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                    <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </div>
            </div>
          </Marker>
        ))}
      </Map>
      
      {/* Location legend */}
      {mappableLocations.length > 0 && (
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-3">
          <p className="text-xs font-medium text-gray-700 mb-2">Locations ({mappableLocations.length})</p>
          <div className="space-y-1">
            {mappableLocations.slice(0, 3).map((location) => (
              <div key={location.id} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  location.type === 'preferred' ? 'bg-violet-600' : 'bg-blue-600'
                }`} />
                <p className="text-xs text-gray-600">{location.place_name}</p>
              </div>
            ))}
            {mappableLocations.length > 3 && (
              <p className="text-xs text-gray-500 italic">+{mappableLocations.length - 3} more</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}