'use client';

import { useState, useEffect, useRef } from 'react';
import { MapPin, Building2, X, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LocationSuggestion } from '@/types/search';
import { cn } from '@/lib/utils';

interface CompanySuggestion {
  id: string;
  name: string;
  description?: string;
}

interface UnifiedSuggestion {
  id: string;
  name: string;
  description: string;
  type: 'location' | 'company';
  coordinates?: { lat: number; lng: number };
}

interface UnifiedSearchProps {
  value: string;
  onChange: (value: string) => void;
  onLocationSelect?: (location: { name: string; coordinates: { lat: number; lng: number } }) => void;
  onCompanySelect?: (companyName: string) => void;
  onEnterKey?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  hideIcon?: boolean;
}

export function UnifiedSearch({
  value,
  onChange,
  onLocationSelect,
  onCompanySelect,
  onEnterKey,
  onFocus,
  onBlur,
  placeholder = "Search location or company",
  className,
  autoFocus = false,
  hideIcon = false
}: UnifiedSearchProps) {
  const [suggestions, setSuggestions] = useState<UnifiedSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const justSelectedRef = useRef(false);

  useEffect(() => {
    const handleSearch = async () => {
      if (value.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        justSelectedRef.current = false;
        return;
      }

      // Don't show suggestions if we just selected something
      if (justSelectedRef.current) {
        justSelectedRef.current = false;
        return;
      }

      // Don't show suggestions automatically on page load - only when user has interacted
      if (!hasUserInteracted) {
        return;
      }

      setIsLoading(true);

      try {
        // Fetch both location and company suggestions in parallel
        const [locationResponse, companyResponse] = await Promise.all([
          fetch(`/api/public/search/suggest?q=${encodeURIComponent(value)}&limit=4`),
          fetch(`/api/public/companies/suggest?q=${encodeURIComponent(value)}&limit=4`)
        ]);

        const unifiedSuggestions: UnifiedSuggestion[] = [];

        // Add location suggestions
        if (locationResponse.ok) {
          const locationData = await locationResponse.json();
          const locationSuggestions: UnifiedSuggestion[] = (locationData.results || []).map((loc: LocationSuggestion) => ({
            id: `location-${loc.id}`,
            name: loc.name,
            description: loc.description,
            type: 'location' as const,
            coordinates: loc.coordinates
          }));
          unifiedSuggestions.push(...locationSuggestions);
        }

        // Add company suggestions
        if (companyResponse.ok) {
          const companyData = await companyResponse.json();
          const companySuggestions: UnifiedSuggestion[] = (companyData.results || []).map((company: CompanySuggestion) => ({
            id: `company-${company.id}`,
            name: company.name,
            description: company.description || 'Company',
            type: 'company' as const
          }));
          unifiedSuggestions.push(...companySuggestions);
        }
        setSuggestions(unifiedSuggestions);
        setShowSuggestions(unifiedSuggestions.length > 0);
        setSelectedIndex(-1);

      } catch (error) {
        console.error('Error fetching unified suggestions:', error);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(handleSearch, 300);
    return () => clearTimeout(debounceTimer);
  }, [value, hasUserInteracted]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    justSelectedRef.current = false; // Reset flag when user types
    setHasUserInteracted(true); // Mark that user has interacted
    onChange(e.target.value);
  };

  const handleSuggestionClick = (suggestion: UnifiedSuggestion) => {
    justSelectedRef.current = true;
    onChange(suggestion.name);
    setShowSuggestions(false);
    setSelectedIndex(-1);

    // Call appropriate callback based on suggestion type
    if (suggestion.type === 'location' && onLocationSelect && suggestion.coordinates) {
      onLocationSelect({
        name: suggestion.description,
        coordinates: suggestion.coordinates
      });
    } else if (suggestion.type === 'company' && onCompanySelect) {
      onCompanySelect(suggestion.name);
    }
  };

  const handleSuggestionSelect = (index: number) => {
    if (index >= 0 && index < suggestions.length) {
      const suggestion = suggestions[index];
      handleSuggestionClick(suggestion);
    }
  };

  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (onEnterKey) {
          onEnterKey();
        }
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSuggestionSelect(selectedIndex);
        }
        break;
      case 'Tab':
        if (selectedIndex >= 0) {
          e.preventDefault();
          handleSuggestionSelect(selectedIndex);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    };

    // Add a small delay to prevent immediate closing when suggestions are shown
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSuggestions]);

  // Group suggestions by type for better display
  const locationSuggestions = suggestions.filter(s => s.type === 'location');
  const companySuggestions = suggestions.filter(s => s.type === 'company');

  return (
    <div className="relative">
      {hideIcon ? (
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setHasUserInteracted(true);
            onFocus?.();
          }}
          onBlur={onBlur}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={className}
          aria-label="Unified search"
          aria-expanded={showSuggestions}
          aria-haspopup="listbox"
          aria-activedescendant={selectedIndex >= 0 ? `unified-suggestion-${suggestions[selectedIndex]?.id}` : undefined}
          role="combobox"
        />
      ) : (
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              setHasUserInteracted(true);
              onFocus?.();
            }}
            onBlur={onBlur}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className={cn(
              "pl-12 pr-10 violet-bloom-input",
              className
            )}
            aria-label="Unified search"
            aria-expanded={showSuggestions}
            aria-haspopup="listbox"
            aria-activedescendant={selectedIndex >= 0 ? `unified-suggestion-${suggestions[selectedIndex]?.id}` : undefined}
            role="combobox"
          />
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-transparent"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}

      {/* Suggestions Dropdown */}
      {showSuggestions && (
        <div
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 z-dropdown mt-1 bg-white border border-border rounded-md shadow-lg max-h-80 overflow-hidden"
          role="listbox"
        >
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              <div className="animate-spin w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-2" />
              <span className="text-sm">Searching...</span>
            </div>
          ) : (
            <>
              {/* Responsive layout: unified scroll on mobile, side-by-side on desktop */}
              {(locationSuggestions.length > 0 || companySuggestions.length > 0) ? (
                <>
                  {/* Mobile Layout: Single unified scrollable list */}
                  <div className="md:hidden max-h-80 overflow-y-auto">
                    {/* Location suggestions */}
                    {locationSuggestions.length > 0 && (
                      <>
                        <div className="px-4 py-3 text-xs font-semibold text-muted-foreground bg-blue-50 border-b border-gray-100 flex items-center gap-1 sticky top-0 z-10">
                          <MapPin className="w-3 h-3" />
                          LOCATIONS ({locationSuggestions.length})
                        </div>
                        {locationSuggestions.map((suggestion, index) => {
                          const globalIndex = suggestions.findIndex(s => s.id === suggestion.id);
                          return (
                            <button
                              key={suggestion.id}
                              id={`unified-suggestion-${suggestion.id}`}
                              onClick={() => handleSuggestionClick(suggestion)}
                              className={cn(
                                "w-full px-4 py-3 text-left hover:bg-blue-50 hover:text-blue-900 focus:bg-blue-50 focus:text-blue-900 focus:outline-none transition-colors border-b border-gray-50 active:bg-blue-100",
                                selectedIndex === globalIndex && "bg-blue-50 text-blue-900"
                              )}
                              role="option"
                              aria-selected={selectedIndex === globalIndex}
                            >
                              <div className="flex items-start gap-3">
                                <MapPin className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-base truncate">{suggestion.name}</div>
                                  <div className="text-sm text-muted-foreground truncate">{suggestion.description}</div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </>
                    )}

                    {/* Company suggestions */}
                    {companySuggestions.length > 0 && (
                      <>
                        <div className="px-4 py-3 text-xs font-semibold text-muted-foreground bg-green-50 border-b border-gray-100 flex items-center gap-1 sticky top-0 z-10">
                          <Building2 className="w-3 h-3" />
                          COMPANIES ({companySuggestions.length})
                        </div>
                        {companySuggestions.map((suggestion, index) => {
                          const globalIndex = suggestions.findIndex(s => s.id === suggestion.id);
                          return (
                            <button
                              key={suggestion.id}
                              id={`unified-suggestion-${suggestion.id}`}
                              onClick={() => handleSuggestionClick(suggestion)}
                              className={cn(
                                "w-full px-4 py-3 text-left hover:bg-green-50 hover:text-green-900 focus:bg-green-50 focus:text-green-900 focus:outline-none transition-colors border-b border-gray-50 active:bg-green-100",
                                selectedIndex === globalIndex && "bg-green-50 text-green-900"
                              )}
                              role="option"
                              aria-selected={selectedIndex === globalIndex}
                            >
                              <div className="flex items-start gap-3">
                                <Building2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-base truncate">{suggestion.name}</div>
                                  <div className="text-sm text-muted-foreground truncate">{suggestion.description}</div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </>
                    )}
                  </div>

                  {/* Desktop Layout: Side-by-side columns */}
                  <div className="hidden md:flex md:min-h-0">
                    {/* Location suggestions column */}
                    {locationSuggestions.length > 0 && (
                      <div className={cn(
                        "flex-1 border-r border-gray-100",
                        companySuggestions.length === 0 && "border-r-0"
                      )}>
                        <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-gray-50 border-b border-gray-100 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          LOCATIONS ({locationSuggestions.length})
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                          {locationSuggestions.map((suggestion, index) => {
                            const globalIndex = suggestions.findIndex(s => s.id === suggestion.id);
                            return (
                              <button
                                key={suggestion.id}
                                id={`unified-suggestion-${suggestion.id}`}
                                onClick={() => handleSuggestionClick(suggestion)}
                                className={cn(
                                  "w-full px-3 py-2.5 text-left hover:bg-blue-50 hover:text-blue-900 focus:bg-blue-50 focus:text-blue-900 focus:outline-none transition-colors border-b border-gray-50 last:border-b-0",
                                  selectedIndex === globalIndex && "bg-blue-50 text-blue-900"
                                )}
                                role="option"
                                aria-selected={selectedIndex === globalIndex}
                              >
                                <div className="flex items-start gap-2">
                                  <MapPin className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                                  <div className="min-w-0 flex-1">
                                    <div className="font-medium text-sm truncate">{suggestion.name}</div>
                                    <div className="text-xs text-muted-foreground truncate">{suggestion.description}</div>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Company suggestions column */}
                    {companySuggestions.length > 0 && (
                      <div className="flex-1">
                        <div className="px-3 py-2 text-xs font-semibold text-muted-foreground bg-gray-50 border-b border-gray-100 flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          COMPANIES ({companySuggestions.length})
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                          {companySuggestions.map((suggestion, index) => {
                            const globalIndex = suggestions.findIndex(s => s.id === suggestion.id);
                            return (
                              <button
                                key={suggestion.id}
                                id={`unified-suggestion-${suggestion.id}`}
                                onClick={() => handleSuggestionClick(suggestion)}
                                className={cn(
                                  "w-full px-3 py-2.5 text-left hover:bg-green-50 hover:text-green-900 focus:bg-green-50 focus:text-green-900 focus:outline-none transition-colors border-b border-gray-50 last:border-b-0",
                                  selectedIndex === globalIndex && "bg-green-50 text-green-900"
                                )}
                                role="option"
                                aria-selected={selectedIndex === globalIndex}
                              >
                                <div className="flex items-start gap-2">
                                  <Building2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                                  <div className="min-w-0 flex-1">
                                    <div className="font-medium text-sm truncate">{suggestion.name}</div>
                                    <div className="text-xs text-muted-foreground truncate">{suggestion.description}</div>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-4 text-center text-muted-foreground">
                  <div className="text-sm">No results found</div>
                  <div className="text-xs mt-1">Try searching for locations or company names</div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}