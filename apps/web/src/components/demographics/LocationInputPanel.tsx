'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { MapPin, Loader2, X, RotateCcw } from 'lucide-react';
import { searchLocations, formatLocationDisplay } from '@/lib/mapbox';
import type { LocationResult } from '@/lib/mapbox';

interface LocationInputPanelProps {
  selectedLocation: LocationResult | null;
  onLocationChange: (location: LocationResult | null) => void;
  radius: number;
  onRadiusChange: (radius: number) => void;
  onAnalyze: () => void;
  onReset: () => void;
  loading: boolean;
  hasResults: boolean;
}

export function LocationInputPanel({
  selectedLocation,
  onLocationChange,
  radius,
  onRadiusChange,
  onAnalyze,
  onReset,
  loading,
  hasResults,
}: LocationInputPanelProps) {
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState<LocationResult[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowLocationDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search locations with debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (locationQuery.trim().length > 2) {
        setLocationLoading(true);
        try {
          const results = await searchLocations(locationQuery);
          setLocationResults(results);
          setShowLocationDropdown(true);
        } catch (error) {
          console.error('Location search error:', error);
          setLocationResults([]);
        } finally {
          setLocationLoading(false);
        }
      } else {
        setLocationResults([]);
        setShowLocationDropdown(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [locationQuery]);

  const handleLocationSelect = (location: LocationResult) => {
    onLocationChange(location);
    setLocationQuery(formatLocationDisplay(location));
    setShowLocationDropdown(false);
    setLocationResults([]);
  };

  const handleClearLocation = () => {
    onLocationChange(null);
    setLocationQuery('');
    setLocationResults([]);
  };

  const canAnalyze = selectedLocation && !loading;

  return (
    <div className="flex items-center gap-3">
      {/* Location Search */}
      <div className="flex-1 relative" ref={inputRef}>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={locationQuery}
            onChange={(e) => setLocationQuery(e.target.value)}
            placeholder="Search for a UK location..."
            className="pl-10 pr-10 h-10 border-gray-300 focus:border-violet-500 focus:ring-violet-500"
            disabled={loading}
          />
          {selectedLocation && (
            <button
              onClick={handleClearLocation}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              disabled={loading}
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {locationLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 animate-spin" />
          )}
        </div>

        {/* Location Dropdown */}
        {showLocationDropdown && locationResults.length > 0 && (
          <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
            {locationResults.map((result) => (
              <button
                key={result.id}
                onClick={() => handleLocationSelect(result)}
                className="w-full text-left px-4 py-3 hover:bg-violet-50 transition-colors border-b border-gray-100 last:border-0"
              >
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-violet-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {result.text}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatLocationDisplay(result)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Radius Input */}
      <div className="w-32">
        <div className="relative">
          <Input
            type="number"
            min="1"
            max="50"
            value={radius}
            onChange={(e) => onRadiusChange(Number(e.target.value))}
            className="h-10 pr-16 border-gray-300 focus:border-violet-500 focus:ring-violet-500"
            disabled={loading}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
            miles
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={onAnalyze}
          disabled={!canAnalyze}
          className="h-10 px-6 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-sm hover:shadow-md transition-all"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            'Analyze'
          )}
        </Button>

        {hasResults && (
          <Button
            onClick={onReset}
            variant="outline"
            disabled={loading}
            className="h-10 w-10 p-0 border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
