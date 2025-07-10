'use client';

import { useState, useEffect } from 'react';
import { Filter, MapPin, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchFilters } from '@/types/search';
import { cn } from '@/lib/utils';

interface StickyHeaderProps {
  onFilterToggle: () => void;
  searchFilters: SearchFilters;
  isMapView: boolean;
  onMapViewToggle: () => void;
}

export function StickyHeader({ 
  onFilterToggle, 
  searchFilters, 
  isMapView, 
  onMapViewToggle 
}: StickyHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 100;
      setIsScrolled(scrolled);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const activeFiltersCount = [
    searchFilters.companyName,
    searchFilters.sector.length > 0,
    searchFilters.useClass.length > 0,
    searchFilters.sizeMin !== null || searchFilters.sizeMax !== null,
    searchFilters.isNationwide
  ].filter(Boolean).length;

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-all duration-200 ease-in-out",
        isScrolled 
          ? "bg-white/90 backdrop-blur-lg shadow-md border-b border-border" 
          : "bg-transparent"
      )}
    >
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Filter Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onFilterToggle}
            className={cn(
              "relative violet-bloom-touch",
              activeFiltersCount > 0 && "bg-primary-50 border-primary-200"
            )}
          >
            <Filter className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Filters</span>
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary-500 text-primary-foreground text-xs rounded-full flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </Button>
          
          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <Button
              variant={!isMapView ? "default" : "ghost"}
              size="sm"
              onClick={() => onMapViewToggle()}
              className={cn(
                "h-8 px-3 text-xs",
                !isMapView && "bg-white shadow-sm"
              )}
            >
              <List className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">List</span>
            </Button>
            <Button
              variant={isMapView ? "default" : "ghost"}
              size="sm"
              onClick={() => onMapViewToggle()}
              className={cn(
                "h-8 px-3 text-xs",
                isMapView && "bg-white shadow-sm"
              )}
            >
              <MapPin className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Map</span>
            </Button>
          </div>
        </div>
        
        {/* Active Filters Indicator */}
        {activeFiltersCount > 0 && (
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <span>Active filters:</span>
            <div className="flex items-center gap-1">
              {searchFilters.companyName && (
                <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded-full text-xs">
                  Company: {searchFilters.companyName}
                </span>
              )}
              {searchFilters.sector.length > 0 && (
                <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded-full text-xs">
                  {searchFilters.sector.length} Sectors
                </span>
              )}
              {searchFilters.useClass.length > 0 && (
                <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded-full text-xs">
                  {searchFilters.useClass.length} Use Classes
                </span>
              )}
              {(searchFilters.sizeMin || searchFilters.sizeMax) && (
                <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded-full text-xs">
                  Size: {searchFilters.sizeMin || '0'} - {searchFilters.sizeMax || '∞'} sq ft
                </span>
              )}
              {searchFilters.isNationwide && (
                <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded-full text-xs">
                  Nationwide
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}