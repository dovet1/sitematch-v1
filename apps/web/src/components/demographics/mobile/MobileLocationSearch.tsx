'use client';

import { useState, useEffect, useRef } from 'react';
import { X, MapPin, Loader2, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { searchLocations, formatLocationDisplay } from '@/lib/mapbox';
import type { LocationResult } from '@/lib/mapbox';
import type { MeasurementMode } from '../shared/types/demographics.types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface MobileLocationSearchProps {
  open: boolean;
  onClose: () => void;
  selectedLocation: LocationResult | null;
  onLocationSelect: (location: LocationResult) => void;
  measurementMode: MeasurementMode;
  measurementValue: number;
  onMeasurementModeChange: (mode: MeasurementMode) => void;
  onMeasurementValueChange: (value: number) => void;
}

export function MobileLocationSearch({
  open,
  onClose,
  selectedLocation,
  onLocationSelect,
  measurementMode,
  measurementValue,
  onMeasurementModeChange,
  onMeasurementValueChange,
}: MobileLocationSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim().length > 2) {
        setLoading(true);
        try {
          const searchResults = await searchLocations(query);
          setResults(searchResults);
        } catch (error) {
          console.error('Location search error:', error);
          setResults([]);
        } finally {
          setLoading(false);
        }
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleLocationSelect = (location: LocationResult) => {
    onLocationSelect(location);
    onClose();
  };

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col safe-area-inset">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-200">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-10 w-10 rounded-lg"
        >
          <X className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold text-gray-900">Search Location</h2>
      </div>

      {/* Search Input */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search UK location..."
            className="pl-11 pr-10 h-12 text-base"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-violet-500 animate-spin" />
          )}
        </div>
      </div>

      {/* Measurement Settings */}
      <div className="p-4 space-y-3 border-b border-gray-200 bg-gray-50">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Measurement Type</label>
          <Select
            value={measurementMode}
            onValueChange={(value) => onMeasurementModeChange(value as MeasurementMode)}
          >
            <SelectTrigger className="h-12 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="distance">Distance (miles)</SelectItem>
              <SelectItem value="drive_time">Drive Time (minutes)</SelectItem>
              <SelectItem value="walk_time">Walk Time (minutes)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            {config.label} Value
          </label>
          <div className="relative">
            <Input
              type="number"
              min={config.min}
              max={config.max}
              value={measurementValue}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (!isNaN(val) && val >= config.min && val <= config.max) {
                  onMeasurementValueChange(val);
                }
              }}
              className="h-12 pr-16 text-base"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-medium">
              {config.unit}
            </span>
          </div>
        </div>
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto">
        {results.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {results.map((result) => (
              <button
                key={result.id}
                onClick={() => handleLocationSelect(result)}
                className="w-full text-left px-4 py-4 hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-violet-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-medium text-gray-900 truncate">
                      {result.text}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5 truncate">
                      {formatLocationDisplay(result)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : query.trim().length > 2 && !loading ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <MapPin className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-base font-medium text-gray-500">No locations found</p>
            <p className="text-sm text-gray-400 mt-1">Try a different search term</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <Clock className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-base font-medium text-gray-500">Start typing to search</p>
            <p className="text-sm text-gray-400 mt-1">Search for any UK location</p>
          </div>
        )}
      </div>
    </div>
  );
}
