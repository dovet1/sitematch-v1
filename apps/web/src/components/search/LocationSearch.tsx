'use client';

import { useState, useEffect, useRef } from 'react';
import { MapPin, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LocationSuggestion } from '@/types/search';
import { cn } from '@/lib/utils';

interface LocationSearchProps {
  value: string;
  onChange: (value: string) => void;
  onLocationSelect?: (location: { name: string; coordinates: { lat: number; lng: number } }) => void;
  placeholder?: string;
  className?: string;
}

export function LocationSearch({ value, onChange, onLocationSelect, placeholder = "Enter location", className }: LocationSearchProps) {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Mock suggestions - in production, this would connect to a geocoding API
  const mockSuggestions: LocationSuggestion[] = [
    { id: '1', name: 'London', description: 'Greater London, England', coordinates: { lat: 51.5074, lng: -0.1278 } },
    { id: '2', name: 'Manchester', description: 'Greater Manchester, England', coordinates: { lat: 53.4808, lng: -2.2426 } },
    { id: '3', name: 'Birmingham', description: 'West Midlands, England', coordinates: { lat: 52.4862, lng: -1.8904 } },
    { id: '4', name: 'Liverpool', description: 'Merseyside, England', coordinates: { lat: 53.4084, lng: -2.9916 } },
    { id: '5', name: 'Leeds', description: 'West Yorkshire, England', coordinates: { lat: 53.8008, lng: -1.5491 } },
    { id: '6', name: 'Glasgow', description: 'Scotland, United Kingdom', coordinates: { lat: 55.8642, lng: -4.2518 } },
    { id: '7', name: 'Edinburgh', description: 'Scotland, United Kingdom', coordinates: { lat: 55.9533, lng: -3.1883 } },
    { id: '8', name: 'Cardiff', description: 'Wales, United Kingdom', coordinates: { lat: 51.4816, lng: -3.1791 } },
  ];

  useEffect(() => {
    const handleSearch = async () => {
      if (value.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setIsLoading(true);
      
      try {
        const url = `/api/public/search/suggest?q=${encodeURIComponent(value)}&limit=8`;
        const response = await fetch(url);
        
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.results || []);
          setShowSuggestions(true);
        } else {
          // Fallback to mock data
          const filtered = mockSuggestions.filter(suggestion =>
            suggestion.name.toLowerCase().includes(value.toLowerCase()) ||
            suggestion.description.toLowerCase().includes(value.toLowerCase())
          );
          setSuggestions(filtered);
          setShowSuggestions(true);
        }
      } catch (error) {
        console.error('Error fetching location suggestions:', error);
        
        // Fallback to mock data
        const filtered = mockSuggestions.filter(suggestion =>
          suggestion.name.toLowerCase().includes(value.toLowerCase()) ||
          suggestion.description.toLowerCase().includes(value.toLowerCase())
        );
        setSuggestions(filtered);
        setShowSuggestions(true);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(handleSearch, 300);
    return () => clearTimeout(debounceTimer);
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleSuggestionClick = (suggestion: LocationSuggestion) => {
    onChange(suggestion.description); // Use full description for display
    setShowSuggestions(false);
    
    // Call onLocationSelect if provided
    if (onLocationSelect) {
      onLocationSelect({
        name: suggestion.description,
        coordinates: suggestion.coordinates
      });
    }
  };

  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
    if (e.key === 'Enter' && !showSuggestions) {
      // Form submission will be handled by parent
      e.preventDefault();
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

  return (
    <div className="relative">
      <div className="relative">
        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "pl-12 pr-10 violet-bloom-input",
            className
          )}
          aria-label="Location search"
          aria-expanded={showSuggestions}
          aria-haspopup="listbox"
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

      {/* Suggestions Dropdown */}
      {showSuggestions && (
        <div
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 z-[9999] mt-1 bg-white border border-border rounded-md shadow-lg max-h-60 overflow-auto"
          role="listbox"
        >
          {isLoading ? (
            <div className="p-3 text-center text-muted-foreground">
              <div className="animate-spin w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full mx-auto" />
              <span className="sr-only">Loading suggestions...</span>
            </div>
          ) : suggestions.length > 0 ? (
            suggestions.map((suggestion) => (
              <button
                key={suggestion.id}
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
                role="option"
                aria-selected={false}
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <div className="font-medium">{suggestion.name}</div>
                    <div className="text-sm text-muted-foreground">{suggestion.description}</div>
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="p-3 text-center text-muted-foreground">
              No locations found
            </div>
          )}
        </div>
      )}
    </div>
  );
}