'use client';

import { useState, useEffect } from 'react';
import { Map, Marker } from 'react-map-gl/mapbox';
import { MapPin } from 'lucide-react';
import '@/styles/map-mobile.css';

interface SiteMapPreviewProps {
  latitude: number;
  longitude: number;
  siteName: string;
  className?: string;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export function SiteMapPreview({ latitude, longitude, siteName, className = '' }: SiteMapPreviewProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !MAPBOX_TOKEN) {
    return (
      <div className={`bg-gray-100 rounded-2xl border-2 border-gray-200 flex items-center justify-center ${className}`}>
        <MapPin className="h-12 w-12 text-gray-400" />
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border-3 border-gray-300 overflow-hidden shadow-lg ${className}`}>
      <Map
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          longitude,
          latitude,
          zoom: 14
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        interactive={false}
        attributionControl={false}
      >
        <Marker longitude={longitude} latitude={latitude}>
          <div className="relative">
            <div className="absolute -top-10 -left-4 bg-gradient-to-br from-violet-600 to-purple-600 text-white rounded-full p-2 shadow-xl border-3 border-white">
              <MapPin className="h-5 w-5" fill="white" />
            </div>
          </div>
        </Marker>
      </Map>
    </div>
  );
}
