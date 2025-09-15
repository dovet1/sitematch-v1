// =====================================================
// Location Search Component - Story 3.2 Task 1
// Enhanced location search with chips and nationwide toggle
// =====================================================

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { 
  searchLocations, 
  createDebouncedLocationSearch,
  formatLocationDisplay,
  isUKOrIreland 
} from '@/lib/mapbox';
import type { LocationResult } from '@/lib/mapbox';
import type { 
  LocationSelection, 
  LocationSearchProps, 
  LocationValidation
} from '@/types/locations';
import { DEFAULT_LOCATION_RULES } from '@/types/locations';

// Simplified props - nationwide is automatic when no locations selected
interface SimpleLocationSearchProps {
  value?: LocationSelection[];
  onChange?: (locations: LocationSelection[]) => void;
  onLocationSelect?: (location: any) => void;
  onValidationChange?: (validation: LocationValidation) => void;
  maxLocations?: number;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
}

export function LocationSearch({
  value = [],
  onChange,
  onValidationChange,
  onLocationSelect,
  maxLocations = DEFAULT_LOCATION_RULES.maxTotal,
  placeholder = "Search for UK/Ireland locations...",
  disabled = false,
  error,
  className
}: SimpleLocationSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useRef(createDebouncedLocationSearch(300));

  // =====================================================
  // SEARCH LOGIC
  // =====================================================

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    setSearchError(null);

    try {
      const searchResults = await debouncedSearch.current(searchQuery, {
        limit: 8,
        country: ['GB', 'IE'],
        types: ['place', 'locality', 'neighborhood']
      });

      // Filter out locations already selected - use current value at time of execution
      const filteredResults = searchResults.filter(
        result => !value?.some(selected => selected.id === result.id)
      );

      setResults(filteredResults);
      setIsOpen(filteredResults.length > 0);
      setFocusedIndex(-1);
    } catch (error) {
      console.error('Location search error:', error);
      setSearchError(error instanceof Error ? error.message : 'Search failed');
      setResults([]);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, []); // Remove value dependency

  // Debounced search effect
  useEffect(() => {
    performSearch(query);
  }, [query, performSearch]); // performSearch is now stable

  // =====================================================
  // VALIDATION
  // =====================================================

  const validateLocations = useCallback((): LocationValidation => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check maximum locations
    if (value && value.length > maxLocations) {
      errors.push(`Maximum ${maxLocations} locations allowed`);
    }

    // Check for duplicates (shouldn't happen but good to validate)
    const uniqueIds = new Set(value?.map(loc => loc.id) || []);
    if (value && uniqueIds.size !== value.length) {
      errors.push('Duplicate locations detected');
    }

    const validation = {
      isValid: errors.length === 0,
      errors,
      warnings
    };

    return validation;
  }, [value, maxLocations]);

  // Removed validation useEffect - not being used by current implementation

  // =====================================================
  // EVENT HANDLERS
  // =====================================================

  const handleLocationSelect = (location: LocationResult) => {
    if (value && value.length >= maxLocations) {
      setSearchError(`Maximum ${maxLocations} locations allowed`);
      return;
    }

    const newLocation: LocationSelection = {
      id: location.id,
      place_name: location.place_name,
      coordinates: location.center,
      type: 'preferred', // Default type - will be removed from database
      formatted_address: formatLocationDisplay(location),
      region: location.context?.find(ctx => ctx.id.startsWith('region'))?.text,
      country: location.context?.find(ctx => ctx.id.startsWith('country'))?.text
    };

    // Support both interfaces
    if (onLocationSelect) {
      // Simple callback interface (used by modal)
      onLocationSelect({
        id: location.id,
        name: formatLocationDisplay(location),
        coordinates: location.center,
        region: location.context?.find(ctx => ctx.id.startsWith('region'))?.text,
        country: location.context?.find(ctx => ctx.id.startsWith('country'))?.text
      });
    } else if (onChange) {
      // Full interface (used by other components)
      const updatedLocations = [...value, newLocation];
      onChange(updatedLocations);
    }

    // Clear search
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setSearchError(null);
  };

  const handleLocationRemove = (locationId: string) => {
    const updatedLocations = value.filter(loc => loc.id !== locationId);
    onChange?.(updatedLocations);
  };



  // =====================================================
  // KEYBOARD NAVIGATION
  // =====================================================

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setFocusedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        setFocusedIndex(prev => 
          prev > 0 ? prev - 1 : results.length - 1
        );
        break;
      case 'Enter':
        event.preventDefault();
        if (focusedIndex >= 0 && results[focusedIndex]) {
          handleLocationSelect(results[focusedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setFocusedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // =====================================================
  // RENDER HELPERS
  // =====================================================

  const renderLocationChip = (location: LocationSelection) => (
    <div 
      key={location.id}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm bg-blue-50 border-blue-200 text-blue-700"
    >
      <MapPin className="w-3 h-3" />
      
      <span className="font-medium">{location.formatted_address}</span>

      {/* Remove button */}
      <button
        type="button"
        onClick={() => handleLocationRemove(location.id)}
        className="p-0.5 rounded hover:bg-white/50 transition-colors"
        disabled={disabled}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );

  const renderSearchResult = (location: LocationResult, index: number) => (
    <div
      key={location.id}
      className={cn(
        "flex items-center justify-between p-3 cursor-pointer transition-colors",
        index === focusedIndex ? "bg-purple-50" : "hover:bg-gray-50"
      )}
      onClick={() => handleLocationSelect(location)}
    >
      <div className="flex items-center gap-3">
        <MapPin className="w-4 h-4 text-gray-400" />
        <div>
          <p className="font-medium text-gray-900">{location.text}</p>
          <p className="text-sm text-gray-500">{formatLocationDisplay(location)}</p>
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          handleLocationSelect(location);
        }}
        className="px-2 py-1 h-auto text-xs"
      >
        <MapPin className="w-3 h-3 mr-1" />
        Add Location
      </Button>
    </div>
  );

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className={cn("space-y-4", className)}>
      {/* Location Search */}
      <div className="space-y-3">
        <div className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsOpen(results.length > 0)}
                placeholder={placeholder}
                disabled={disabled}
                className={cn(
                  "pl-10",
                  (error || searchError) && "border-red-500 focus-visible:ring-red-500"
                )}
              />
              {isLoading && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Search Results Dropdown */}
            {isOpen && results.length > 0 && (
              <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-80 overflow-y-auto shadow-lg bg-white border border-gray-200">
                <CardContent className="p-0 bg-white">
                  {results.map((location, index) => renderSearchResult(location, index))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Error Messages */}
          {(error || searchError) && (
            <p className="text-sm text-red-600">
              {error || searchError}
            </p>
          )}

          {/* Selected Locations */}
          {value && value.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-medium">Selected Locations</Label>
                <Badge variant="secondary" className="text-xs">
                  {value?.length || 0} / {maxLocations}
                </Badge>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {value.map(renderLocationChip)}
              </div>

            </div>
          )}

        </div>
    </div>
  );
}