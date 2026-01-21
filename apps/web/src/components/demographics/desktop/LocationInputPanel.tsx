'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MapPin, Loader2, X, RotateCcw, Sparkles } from 'lucide-react';
import { searchLocations, formatLocationDisplay } from '@/lib/mapbox';
import type { LocationResult } from '@/lib/mapbox';

export type MeasurementMode = 'distance' | 'drive_time' | 'walk_time';

interface LocationInputPanelProps {
  selectedLocation: LocationResult | null;
  onLocationChange: (location: LocationResult | null) => void;
  measurementMode: MeasurementMode;
  onMeasurementModeChange: (mode: MeasurementMode) => void;
  measurementValue: number;
  onMeasurementValueChange: (value: number) => void;
  onAnalyze: (location?: LocationResult, shouldReset?: boolean) => void;
  onReset: () => void;
  loading: boolean;
  hasResults: boolean;
}

export function LocationInputPanel({
  selectedLocation,
  onLocationChange,
  measurementMode,
  onMeasurementModeChange,
  measurementValue,
  onMeasurementValueChange,
  onAnalyze,
  onReset,
  loading,
  hasResults,
}: LocationInputPanelProps) {
  const [locationQuery, setLocationQuery] = useState('');
  const [locationResults, setLocationResults] = useState<LocationResult[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Get configuration based on mode
  const getModeConfig = () => {
    switch (measurementMode) {
      case 'distance':
        return { label: 'Distance', unit: 'miles', min: 1, max: 50 };
      case 'drive_time':
        return { label: 'Drive Time', unit: 'mins', min: 2, max: 120 };
      case 'walk_time':
        return { label: 'Walk Time', unit: 'mins', min: 1, max: 60 };
    }
  };

  const config = getModeConfig();

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showLocationDropdown || locationResults.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < locationResults.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < locationResults.length) {
          handleLocationSelect(locationResults[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowLocationDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [locationResults]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowLocationDropdown(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search locations with debounce
  useEffect(() => {
    // If user is typing something different from the selected location, allow search
    const selectedLocationDisplay = selectedLocation ? formatLocationDisplay(selectedLocation) : '';
    const isTypingNewQuery = locationQuery !== selectedLocationDisplay;

    // Don't search if query matches selected location (user hasn't changed it)
    if (selectedLocation && !isTypingNewQuery) {
      setLocationResults([]);
      setShowLocationDropdown(false);
      return;
    }

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
  }, [locationQuery, selectedLocation]);

  const handleLocationSelect = (location: LocationResult) => {
    onLocationChange(location);
    setLocationQuery(formatLocationDisplay(location));
    setShowLocationDropdown(false);
    setLocationResults([]);
    searchInputRef.current?.blur();
    // Auto-analyze only on first search (no existing results)
    // Subsequent searches require user to click Analyze button
    if (!hasResults) {
      onAnalyze(location, false);
    }
  };

  const handleClearLocation = () => {
    onLocationChange(null);
    setLocationQuery('');
    setLocationResults([]);
  };

  const canAnalyze = selectedLocation && !loading && measurementValue && Number(measurementValue) > 0;

  return (
    <div className="flex items-center gap-2.5">
      {/* Premium Location Search */}
      <div className="flex-1 relative" ref={inputRef}>
        <div className="relative group">
          <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-violet-500 transition-colors duration-200" />
          <Input
            ref={searchInputRef}
            value={locationQuery}
            onChange={(e) => setLocationQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search an England or Wales location..."
            className="pl-11 pr-10 h-9 text-sm border-gray-200 bg-white hover:border-gray-300 focus:border-violet-400 focus:ring-violet-400/20 shadow-sm hover:shadow transition-all duration-200"
            disabled={loading}
          />
          {selectedLocation && (
            <button
              onClick={handleClearLocation}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded p-0.5 transition-all duration-200"
              disabled={loading}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {locationLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-500 animate-spin" />
          )}
        </div>

        {/* Premium Location Dropdown */}
        {showLocationDropdown && locationResults.length > 0 && (
          <div className="absolute z-[9999] w-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-64 overflow-hidden">
            <div className="max-h-64 overflow-y-auto">
              {locationResults.map((result, idx) => (
                <button
                  key={result.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleLocationSelect(result);
                  }}
                  className={`w-full text-left px-4 py-2.5 hover:bg-violet-50 transition-colors duration-150 ${
                    selectedIndex === idx ? 'bg-violet-50' : ''
                  } ${idx !== locationResults.length - 1 ? 'border-b border-gray-100' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <MapPin className="h-3.5 w-3.5 text-violet-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {result.text}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {formatLocationDisplay(result)}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Premium Measurement Mode Selector */}
      <div className="w-36">
        <Select
          value={measurementMode}
          onValueChange={(value) => onMeasurementModeChange(value as MeasurementMode)}
          disabled={loading}
        >
          <SelectTrigger className="h-9 text-sm border-gray-200 bg-white hover:border-gray-300 focus:border-violet-400 focus:ring-violet-400/20 shadow-sm hover:shadow transition-all duration-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="distance">Distance</SelectItem>
            <SelectItem value="drive_time">Drive Time</SelectItem>
            <SelectItem value="walk_time">Walk Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Premium Measurement Value Input */}
      <div className="w-28">
        <div className="relative group">
          <Input
            type="number"
            min={config.min}
            max={config.max}
            value={measurementValue}
            onChange={(e) => {
              if (e.target.value === '') {
                onMeasurementValueChange(config.min);
              } else {
                const val = Number(e.target.value);
                if (!isNaN(val) && val >= config.min && val <= config.max) {
                  onMeasurementValueChange(val);
                }
              }
            }}
            className="h-9 pr-14 text-sm border-gray-200 bg-white hover:border-gray-300 focus:border-violet-400 focus:ring-violet-400/20 shadow-sm hover:shadow transition-all duration-200"
            disabled={loading}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-medium pointer-events-none">
            {config.unit}
          </span>
        </div>
      </div>

      {/* Premium Action Buttons */}
      <div className="flex gap-2">
        <Button
          onClick={() => onAnalyze()}
          disabled={!canAnalyze}
          className="h-9 px-5 text-sm font-medium bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-3.5 w-3.5" />
              <span>Analyse</span>
            </>
          )}
        </Button>

        {hasResults && (
          <Button
            onClick={onReset}
            variant="outline"
            disabled={loading}
            className="h-9 w-9 p-0 border-gray-200 hover:border-gray-300 hover:bg-gray-50 shadow-sm hover:shadow transition-all duration-200"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
