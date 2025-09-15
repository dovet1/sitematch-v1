'use client';

import { useState, useEffect, useRef } from 'react';
import { Building2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CompanySuggestion {
  id: string;
  name: string;
  description?: string;
}

interface CompanySearchProps {
  value: string;
  onChange: (value: string) => void;
  onCompanySelect?: (companyName: string) => void;
  onEnterKey?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  hideIcon?: boolean;
}

export function CompanySearch({
  value,
  onChange,
  onCompanySelect,
  onEnterKey,
  onFocus,
  onBlur,
  placeholder = "Enter company name",
  className,
  autoFocus = false,
  hideIcon = false
}: CompanySearchProps) {
  const [suggestions, setSuggestions] = useState<CompanySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const justSelectedRef = useRef(false);

  // Mock company suggestions - in production, this would connect to a companies API
  const mockCompanySuggestions: CompanySuggestion[] = [
    { id: '1', name: 'Savills', description: 'Real Estate Services' },
    { id: '2', name: 'CBRE', description: 'Commercial Real Estate Services' },
    { id: '3', name: 'JLL', description: 'Jones Lang LaSalle' },
    { id: '4', name: 'Cushman & Wakefield', description: 'Commercial Real Estate Services' },
    { id: '5', name: 'Knight Frank', description: 'Residential & Commercial Property' },
    { id: '6', name: 'Colliers', description: 'Commercial Real Estate Services' },
    { id: '7', name: 'Lambert Smith Hampton', description: 'Property Consultancy' },
    { id: '8', name: 'Avison Young', description: 'Commercial Real Estate Advisory' },
  ];

  useEffect(() => {
    const handleSearch = async () => {
      if (value.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        justSelectedRef.current = false;
        return;
      }

      // Don't show suggestions if we just selected a company
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
        const url = `/api/public/companies/suggest?q=${encodeURIComponent(value)}&limit=8`;
        const response = await fetch(url);

        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.results || []);
          setShowSuggestions(true);
          setSelectedIndex(-1);
        } else {
          // Fallback to mock data
          const filtered = mockCompanySuggestions.filter(suggestion =>
            suggestion.name.toLowerCase().includes(value.toLowerCase()) ||
            (suggestion.description && suggestion.description.toLowerCase().includes(value.toLowerCase()))
          );
          setSuggestions(filtered);
          setShowSuggestions(true);
          setSelectedIndex(-1);
        }
      } catch (error) {
        console.error('Error fetching company suggestions:', error);

        // Fallback to mock data
        const filtered = mockCompanySuggestions.filter(suggestion =>
          suggestion.name.toLowerCase().includes(value.toLowerCase()) ||
          (suggestion.description && suggestion.description.toLowerCase().includes(value.toLowerCase()))
        );
        setSuggestions(filtered);
        setShowSuggestions(true);
        setSelectedIndex(-1);
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

  const handleSuggestionClick = (suggestion: CompanySuggestion) => {
    justSelectedRef.current = true;
    onChange(suggestion.name);
    setShowSuggestions(false);
    setSelectedIndex(-1);

    // Call onCompanySelect if provided
    if (onCompanySelect) {
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
          aria-label="Company search"
          aria-expanded={showSuggestions}
          aria-haspopup="listbox"
          aria-activedescendant={selectedIndex >= 0 ? `company-suggestion-${suggestions[selectedIndex]?.id}` : undefined}
          role="combobox"
        />
      ) : (
        <div className="relative">
          <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
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
            aria-label="Company search"
            aria-expanded={showSuggestions}
            aria-haspopup="listbox"
            aria-activedescendant={selectedIndex >= 0 ? `company-suggestion-${suggestions[selectedIndex]?.id}` : undefined}
            role="combobox"
          />
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-transparent"
              aria-label="Clear company search"
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
          className="absolute top-full left-0 right-0 z-dropdown mt-1 bg-white border border-border rounded-md shadow-lg max-h-60 overflow-auto"
          role="listbox"
        >
          {isLoading ? (
            <div className="p-3 text-center text-muted-foreground">
              <div className="animate-spin w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full mx-auto" />
              <span className="sr-only">Loading company suggestions...</span>
            </div>
          ) : suggestions.length > 0 ? (
            suggestions.map((suggestion, index) => (
              <button
                key={suggestion.id}
                id={`company-suggestion-${suggestion.id}`}
                onClick={() => handleSuggestionClick(suggestion)}
                className={cn(
                  "w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none",
                  selectedIndex === index && "bg-accent text-accent-foreground"
                )}
                role="option"
                aria-selected={selectedIndex === index}
              >
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <div className="font-medium">{suggestion.name}</div>
                    {suggestion.description && (
                      <div className="text-sm text-muted-foreground">{suggestion.description}</div>
                    )}
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="p-3 text-center text-muted-foreground">
              No companies found
            </div>
          )}
        </div>
      )}
    </div>
  );
}