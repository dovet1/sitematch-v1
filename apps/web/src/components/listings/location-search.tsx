// =====================================================
// Location Search Component - Story 3.2 Task 1
// Enhanced location search with chips and nationwide toggle
// =====================================================

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, X, Globe, Star } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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

export function LocationSearch({
  value,
  onChange,
  onValidationChange,
  isNationwide,
  onNationwideChange,
  maxLocations = DEFAULT_LOCATION_RULES.maxTotal,
  placeholder = "Search for UK/Ireland locations...",
  disabled = false,
  error
}: LocationSearchProps) {
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

      // Filter out locations already selected
      const filteredResults = searchResults.filter(
        result => !value.some(selected => selected.id === result.id)
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
  }, [value]);

  // Debounced search effect
  useEffect(() => {
    performSearch(query);
  }, [query, performSearch]);

  // =====================================================
  // VALIDATION
  // =====================================================

  const validateLocations = useCallback((): LocationValidation => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if locations are required but none selected
    if (DEFAULT_LOCATION_RULES.requiresAtLeastOne && value.length === 0 && !isNationwide) {
      errors.push('Please select at least one location or choose nationwide');
    }

    // Check maximum locations
    if (value.length > maxLocations) {
      errors.push(`Maximum ${maxLocations} locations allowed`);
    }

    // Check preferred/acceptable limits
    const preferredCount = value.filter(loc => loc.type === 'preferred').length;
    const acceptableCount = value.filter(loc => loc.type === 'acceptable').length;

    if (preferredCount > DEFAULT_LOCATION_RULES.maxPreferred) {
      warnings.push(`Consider limiting preferred locations to ${DEFAULT_LOCATION_RULES.maxPreferred}`);
    }

    if (acceptableCount > DEFAULT_LOCATION_RULES.maxAcceptable) {
      warnings.push(`Consider limiting acceptable locations to ${DEFAULT_LOCATION_RULES.maxAcceptable}`);
    }

    // Check for duplicates (shouldn't happen but good to validate)
    const uniqueIds = new Set(value.map(loc => loc.id));
    if (uniqueIds.size !== value.length) {
      errors.push('Duplicate locations detected');
    }

    const validation = {
      isValid: errors.length === 0,
      errors,
      warnings
    };

    return validation;
  }, [value, isNationwide, maxLocations]);

  // Validate on changes with debouncing to prevent infinite loops
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const validation = validateLocations();
      onValidationChange?.(validation);
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [value, isNationwide, maxLocations, onValidationChange]);

  // =====================================================
  // EVENT HANDLERS
  // =====================================================

  const handleLocationSelect = (location: LocationResult, type: 'preferred' | 'acceptable' = 'preferred') => {
    if (value.length >= maxLocations) {
      setSearchError(`Maximum ${maxLocations} locations allowed`);
      return;
    }

    const newLocation: LocationSelection = {
      id: location.id,
      place_name: location.place_name,
      coordinates: location.center,
      type,
      formatted_address: formatLocationDisplay(location),
      region: location.context?.find(ctx => ctx.id.startsWith('region'))?.text,
      country: location.context?.find(ctx => ctx.id.startsWith('country'))?.text
    };

    const updatedLocations = [...value, newLocation];
    onChange(updatedLocations);

    // Clear search
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setSearchError(null);
  };

  const handleLocationRemove = (locationId: string) => {
    const updatedLocations = value.filter(loc => loc.id !== locationId);
    onChange(updatedLocations);
  };

  const handleLocationTypeChange = (locationId: string, newType: 'preferred' | 'acceptable') => {
    const updatedLocations = value.map(loc => 
      loc.id === locationId ? { ...loc, type: newType } : loc
    );
    onChange(updatedLocations);
  };

  const lastToggleRef = useRef<boolean | null>(null);
  
  const handleNationwideToggle = useCallback((checked: boolean) => {
    // Prevent rapid successive calls with the same value
    if (lastToggleRef.current === checked) {
      return;
    }
    
    lastToggleRef.current = checked;
    onNationwideChange(checked);
    setSearchError(null);
  }, [onNationwideChange]);

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
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm",
        location.type === 'preferred' 
          ? "bg-purple-50 border-purple-200 text-purple-700" 
          : "bg-blue-50 border-blue-200 text-blue-700"
      )}
    >
      {location.type === 'preferred' ? (
        <Star className="w-3 h-3 fill-current" />
      ) : (
        <MapPin className="w-3 h-3" />
      )}
      
      <span className="font-medium">{location.formatted_address}</span>
      
      {/* Type toggle button */}
      <button
        type="button"
        onClick={() => handleLocationTypeChange(
          location.id, 
          location.type === 'preferred' ? 'acceptable' : 'preferred'
        )}
        className="text-xs px-1.5 py-0.5 rounded bg-white/50 hover:bg-white/80 transition-colors"
        disabled={disabled}
      >
        {location.type === 'preferred' ? 'Pref' : 'Accept'}
      </button>

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

      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleLocationSelect(location, 'preferred');
          }}
          className="px-2 py-1 h-auto text-xs"
        >
          <Star className="w-3 h-3 mr-1" />
          Preferred
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleLocationSelect(location, 'acceptable');
          }}
          className="px-2 py-1 h-auto text-xs"
        >
          <MapPin className="w-3 h-3 mr-1" />
          Acceptable
        </Button>
      </div>
    </div>
  );

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <strong>Choose your search approach:</strong> Select "Nationwide Coverage" for opportunities across the UK and Ireland, 
          or turn it off and specify individual locations below.
        </p>
      </div>

      {/* Nationwide Toggle */}
      <div 
        className={cn(
          "flex items-center justify-between p-4 border rounded-lg transition-all duration-200",
          isNationwide 
            ? "bg-violet-50 border-violet-200 shadow-sm" 
            : "bg-gray-50 border-gray-200"
        )}
      >
        <div 
          className="flex items-center gap-3 flex-1 cursor-pointer"
          onClick={() => !disabled && handleNationwideToggle(!isNationwide)}
        >
          <Globe className={cn(
            "w-5 h-5", 
            isNationwide ? "text-violet-600" : "text-gray-600"
          )} />
          <div>
            <Label className={cn(
              "font-medium cursor-pointer",
              isNationwide ? "text-violet-900" : "text-gray-900"
            )}>
              Nationwide Coverage
            </Label>
            <p className={cn(
              "text-sm",
              isNationwide ? "text-violet-700" : "text-gray-600"
            )}>
              Open to opportunities across the UK and Ireland
            </p>
          </div>
        </div>
        <Switch
          checked={isNationwide}
          onCheckedChange={handleNationwideToggle}
          disabled={disabled}
        />
      </div>

      {/* Alternative Option Label */}
      {!isNationwide && (
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">OR specify individual locations</span>
          </div>
        </div>
      )}

      {/* Location Search */}
      {!isNationwide && (
        <div className="space-y-3">
          <div className="relative">
            <Label className="font-medium">Preferred Locations</Label>
            <p className="text-sm text-gray-600 mb-2">
              Search and select specific locations where you'd like to operate
            </p>
            
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
          {value.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-medium">Selected Locations</Label>
                <Badge variant="secondary" className="text-xs">
                  {value.length} / {maxLocations}
                </Badge>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {value.map(renderLocationChip)}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 text-xs text-gray-600">
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-purple-600 fill-current" />
                  <span>Preferred locations</span>
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-blue-600" />
                  <span>Acceptable locations</span>
                </div>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!isNationwide && value.length === 0 && !query && (
            <div className="text-center py-8 text-gray-500">
              <MapPin className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Start typing to search for locations</p>
            </div>
          )}
        </div>
      )}

      {/* Nationwide State */}
      {isNationwide && (
        <div className="text-center py-8 bg-purple-50 rounded-lg border border-purple-200">
          <Globe className="w-8 h-8 mx-auto mb-2 text-purple-600" />
          <p className="font-medium text-purple-900">Nationwide Coverage Selected</p>
          <p className="text-sm text-purple-700">
            You're open to opportunities across the UK and Ireland
          </p>
        </div>
      )}
    </div>
  );
}