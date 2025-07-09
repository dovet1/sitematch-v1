'use client';

import { useState, useEffect } from 'react';
import { Filter, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LocationSearch } from './LocationSearch';
import { SearchFilters } from '@/types/search';
import { cn } from '@/lib/utils';

interface HeroSearchProps {
  onSearch: (filters: SearchFilters) => void;
  onFilterToggle: () => void;
  searchFilters: SearchFilters;
}

export function HeroSearch({ onSearch, onFilterToggle, searchFilters }: HeroSearchProps) {
  const [localLocation, setLocalLocation] = useState(searchFilters.location);
  
  useEffect(() => {
    setLocalLocation(searchFilters.location);
  }, [searchFilters.location]);

  const handleLocationChange = (location: string) => {
    setLocalLocation(location);
    onSearch({ ...searchFilters, location });
  };

  const handleLocationSelect = (locationData: { name: string; coordinates: { lat: number; lng: number } }) => {
    setLocalLocation(locationData.name);
    onSearch({ 
      ...searchFilters, 
      location: locationData.name,
      coordinates: locationData.coordinates 
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch({ ...searchFilters, location: localLocation });
  };

  const activeFiltersCount = [
    searchFilters.companyName,
    searchFilters.sector.length > 0,
    searchFilters.useClass.length > 0,
    searchFilters.sizeMin !== null || searchFilters.sizeMax !== null,
    searchFilters.isNationwide
  ].filter(Boolean).length;

  return (
    <section className="hero-section relative">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-50 to-primary-100 opacity-50" />
      
      {/* Content */}
      <div className="relative container mx-auto px-4 py-24 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Hero Title */}
          <h1 className="hero-title text-4xl md:text-5xl lg:text-6xl font-bold text-primary-700 leading-tight tracking-tight">
            Find the perfect match for your site
          </h1>
          
          {/* Subtitle */}
          <p className="body-large text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Discover property requirements from leading companies looking for their next location
          </p>
          
          {/* Search Form */}
          <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-4 p-2 bg-white rounded-2xl shadow-lg border border-border">
              {/* Location Search */}
              <div className="flex-1">
                <LocationSearch
                  value={localLocation}
                  onChange={handleLocationChange}
                  onLocationSelect={handleLocationSelect}
                  placeholder="Enter address, postcode, or location..."
                  className="search-bar w-full h-14 border-0 bg-transparent text-lg placeholder:text-muted-foreground focus:ring-0"
                />
              </div>
              
              {/* Filter Button */}
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={onFilterToggle}
                className={cn(
                  "violet-bloom-touch flex items-center gap-2 h-14 px-6 bg-white border-l border-border sm:border-l-0 sm:border-none relative",
                  activeFiltersCount > 0 && "bg-primary-50 border-primary-200"
                )}
              >
                <Filter className="w-5 h-5" />
                <span className="hidden sm:inline">Filters</span>
                {activeFiltersCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary-500 text-primary-foreground text-xs rounded-full flex items-center justify-center">
                    {activeFiltersCount}
                  </span>
                )}
              </Button>
            </div>
          </form>
          
          {/* Quick Stats */}
          <div className="flex justify-center items-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary-500 rounded-full" />
              <span>1,200+ Active Requirements</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-success rounded-full" />
              <span>500+ Companies</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-warning rounded-full" />
              <span>Updated Daily</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}