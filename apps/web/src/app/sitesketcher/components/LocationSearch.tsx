'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  MapPin, 
  Navigation, 
  Clock,
  X,
  Loader2
} from 'lucide-react';
import type { SearchResult } from '@/types/sitesketcher';
import { searchLocations } from '@/lib/sitesketcher/mapbox-utils';

interface LocationSearchProps {
  onLocationSelect: (location: SearchResult) => void;
  recentSearches: SearchResult[];
  onUpdateRecentSearches: (searches: SearchResult[]) => void;
  className?: string;
  isMobile?: boolean;
}

export function LocationSearch({
  onLocationSelect,
  recentSearches,
  onUpdateRecentSearches,
  className = '',
  isMobile = false
}: LocationSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim().length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const searchResults = await searchLocations(query, 8);
        setResults(searchResults);
        setSelectedIndex(-1);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      const totalResults = results.length + (recentSearches.length > 0 ? recentSearches.length : 0);
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % totalResults);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => prev <= 0 ? totalResults - 1 : prev - 1);
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0) {
            const allResults = [...results, ...recentSearches];
            if (allResults[selectedIndex]) {
              handleLocationSelect(allResults[selectedIndex]);
            }
          }
          break;
        case 'Escape':
          setIsOpen(false);
          setSelectedIndex(-1);
          inputRef.current?.blur();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, recentSearches, selectedIndex]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLocationSelect = (location: SearchResult) => {
    onLocationSelect(location);
    
    // Add to recent searches (keep only last 5)
    const updatedRecent = [
      location,
      ...recentSearches.filter(r => r.id !== location.id)
    ].slice(0, 5);
    
    onUpdateRecentSearches(updatedRecent);
    
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    
    // Store in localStorage
    localStorage.setItem('sitesketcher-recent-searches', JSON.stringify(updatedRecent));
  };

  const handleClearRecent = () => {
    onUpdateRecentSearches([]);
    localStorage.removeItem('sitesketcher-recent-searches');
  };

  const showRecent = !query.trim() && recentSearches.length > 0;
  const hasResults = results.length > 0;
  const showDropdown = isOpen && (hasResults || showRecent);

  return (
    <div className={`relative ${className}`}>
      <Card className="border-0 shadow-lg">
        <CardContent className="p-3">
          <div className="relative">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                type="text"
                placeholder="Search locations..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setIsOpen(true)}
                className={`pl-10 pr-10 ${isMobile ? 'h-12 text-base' : 'h-10'}`}
              />
              {isLoading && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
              {query && !isLoading && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setQuery('');
                    setResults([]);
                    inputRef.current?.focus();
                  }}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* Results Dropdown */}
            {showDropdown && (
              <div
                ref={resultsRef}
                className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border border-border rounded-md shadow-lg max-h-80 overflow-y-auto"
              >
                {/* Search Results */}
                {hasResults && (
                  <div>
                    <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                      Search Results
                    </div>
                    {results.map((result, index) => (
                      <button
                        key={result.id}
                        onClick={() => handleLocationSelect(result)}
                        className={`
                          w-full text-left px-3 py-3 hover:bg-muted border-b border-border/50 last:border-b-0
                          ${index === selectedIndex ? 'bg-muted' : ''}
                          transition-colors
                        `}
                      >
                        <div className="flex items-start gap-3">
                          <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm truncate">
                              {/* For addresses, show more detail; for places show first part only */}
                              {result.place_type.includes('address') 
                                ? result.place_name.split(',').slice(0, 2).join(', ')
                                : result.place_name.split(',')[0]
                              }
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {result.place_name}
                            </div>
                          </div>
                          <Navigation className="h-4 w-4 text-primary opacity-60 flex-shrink-0" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Recent Searches */}
                {showRecent && (
                  <div>
                    <div className="flex items-center justify-between px-3 py-2 border-b">
                      <span className="text-xs font-medium text-muted-foreground">
                        Recent Searches
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearRecent}
                        className="h-6 px-2 text-xs"
                      >
                        Clear
                      </Button>
                    </div>
                    {recentSearches.map((result, index) => {
                      const adjustedIndex = hasResults ? results.length + index : index;
                      return (
                        <button
                          key={result.id}
                          onClick={() => handleLocationSelect(result)}
                          className={`
                            w-full text-left px-3 py-3 hover:bg-muted border-b border-border/50 last:border-b-0
                            ${adjustedIndex === selectedIndex ? 'bg-muted' : ''}
                            transition-colors
                          `}
                        >
                          <div className="flex items-start gap-3">
                            <Clock className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm truncate">
                                {/* For addresses, show more detail; for places show first part only */}
                                {result.place_type.includes('address') 
                                  ? result.place_name.split(',').slice(0, 2).join(', ')
                                  : result.place_name.split(',')[0]
                                }
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {result.place_name}
                              </div>
                            </div>
                            <Navigation className="h-4 w-4 text-primary opacity-40 flex-shrink-0" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* No Results */}
                {query.trim() && !isLoading && !hasResults && (
                  <div className="px-3 py-6 text-center text-muted-foreground">
                    <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No locations found</p>
                    <p className="text-xs">Try adjusting your search terms</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}