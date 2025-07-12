'use client';

import { MapPin, Search } from 'lucide-react';

interface SearchLocationMarkerProps {
  coordinates: { lat: number; lng: number };
  locationName: string;
}

export function SearchLocationMarker({ coordinates, locationName }: SearchLocationMarkerProps) {
  return (
    <div className="relative" style={{ transform: 'translate(-50%, -100%)' }}>
      {/* Search location marker */}
      <div className="relative">
        <div className="w-10 h-10 bg-blue-600 border-3 border-white rounded-full shadow-lg flex items-center justify-center animate-pulse">
          <Search className="w-5 h-5 text-white" />
        </div>
        {/* Pin stem */}
        <div className="absolute top-8 left-1/2 w-0.5 h-3 bg-blue-600 transform -translate-x-1/2" />
      </div>

      {/* Location name tooltip */}
      <div className="absolute bottom-14 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white text-xs font-medium px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
        <div className="flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          <span>{locationName}</span>
        </div>
        {/* Arrow */}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-blue-600" />
      </div>
    </div>
  );
}