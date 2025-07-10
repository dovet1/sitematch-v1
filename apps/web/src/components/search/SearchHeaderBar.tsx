'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Filter, Globe, MapPin, List, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LocationSearch } from './LocationSearch';
import { FilterDrawer } from './FilterDrawer';
import { SearchFilters } from '@/types/search';
import { cn } from '@/lib/utils';

interface SearchHeaderBarProps {
  searchFilters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onLocationSelect: (locationData: { name: string; coordinates: { lat: number; lng: number } }) => void;
  onNationwideSearch: () => void;
  isMapView?: boolean;
  onMapViewToggle?: (isMapView: boolean) => void;
  showViewToggle?: boolean;
  className?: string;
}

export function SearchHeaderBar({
  searchFilters,
  onFiltersChange,
  onLocationSelect,
  onNationwideSearch,
  isMapView = false,
  onMapViewToggle,
  showViewToggle = false,
  className
}: SearchHeaderBarProps) {
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [isLocationFocused, setIsLocationFocused] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  // Track scroll position for styling changes
  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 10;
      setIsScrolled(scrolled);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Calculate active filters count
  const activeFiltersCount = [
    searchFilters.companyName,
    searchFilters.sector.length > 0,
    searchFilters.useClass.length > 0,
    searchFilters.sizeMin !== null || searchFilters.sizeMax !== null,
  ].filter(Boolean).length;

  const handleLocationChange = (location: string) => {
    onFiltersChange({ ...searchFilters, location });
  };

  const handleClearFilters = () => {
    onFiltersChange({
      location: '',
      coordinates: null,
      companyName: '',
      sector: [],
      useClass: [],
      sizeMin: null,
      sizeMax: null,
      isNationwide: false,
    });
  };

  return (
    <>
      {/* Main Search Header */}
      <div 
        ref={headerRef}
        className={cn(
          "sticky top-0 z-sticky transition-all duration-300 ease-in-out",
          isScrolled 
            ? "bg-white/95 backdrop-blur-md shadow-lg border-b border-gray-200" 
            : "bg-white/80 backdrop-blur-sm border-b border-gray-100",
          className
        )}
      >
        <div className="container mx-auto px-4 py-3">
          {/* Desktop Layout */}
          <div className="hidden md:flex items-center gap-4">
            {/* Location Search Section */}
            <div className="flex-1 relative">
              <div 
                className={cn(
                  "flex items-center bg-white rounded-full border-2 transition-all duration-200",
                  isLocationFocused 
                    ? "border-primary-300 shadow-lg ring-4 ring-primary-100" 
                    : "border-gray-200 hover:border-gray-300 shadow-sm"
                )}
              >
                <div className="flex-1 px-4 py-3">
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <LocationSearch
                      value={searchFilters.location}
                      onChange={handleLocationChange}
                      onLocationSelect={onLocationSelect}
                      onFocus={() => setIsLocationFocused(true)}
                      onBlur={() => setIsLocationFocused(false)}
                      placeholder="Where are you looking?"
                      className="w-full border-0 outline-none bg-transparent text-gray-700 placeholder-gray-400 font-medium pl-12 pr-4"
                      hideIcon={true}
                    />
                  </div>
                </div>
                
                {/* Divider */}
                <div className="w-px h-8 bg-gray-200" />
                
                {/* Nationwide Toggle */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onNationwideSearch}
                  className={cn(
                    "px-4 py-3 h-auto rounded-none rounded-r-full font-medium transition-colors",
                    searchFilters.isNationwide 
                      ? "bg-primary-50 text-primary-700 hover:bg-primary-100" 
                      : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                  )}
                >
                  <Globe className="w-4 h-4 mr-2" />
                  Nationwide
                </Button>
              </div>
            </div>

            {/* Filters Button */}
            <Button
              variant="outline"
              onClick={() => setIsFilterDrawerOpen(true)}
              className={cn(
                "px-6 py-3 h-auto rounded-full font-medium transition-all duration-200 relative",
                activeFiltersCount > 0 
                  ? "bg-primary-50 border-primary-200 text-primary-700 shadow-sm" 
                  : "border-gray-200 hover:border-gray-300 shadow-sm"
              )}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge 
                  variant="secondary" 
                  className="ml-2 bg-primary-100 text-primary-700 border-primary-200"
                >
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>

            {/* View Toggle */}
            {showViewToggle && onMapViewToggle && (
              <div className="flex items-center bg-gray-100 rounded-full p-1">
                <Button
                  variant={!isMapView ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onMapViewToggle(false)}
                  className={cn(
                    "px-4 py-2 rounded-full font-medium transition-all duration-200",
                    !isMapView 
                      ? "bg-white shadow-sm text-gray-900" 
                      : "text-gray-600 hover:text-gray-800"
                  )}
                >
                  <List className="w-4 h-4 mr-2" />
                  List
                </Button>
                <Button
                  variant={isMapView ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onMapViewToggle(true)}
                  className={cn(
                    "px-4 py-2 rounded-full font-medium transition-all duration-200",
                    isMapView 
                      ? "bg-white shadow-sm text-gray-900" 
                      : "text-gray-600 hover:text-gray-800"
                  )}
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  Map
                </Button>
              </div>
            )}
          </div>

          {/* Mobile Layout */}
          <div className="md:hidden">
            <div className="flex items-center gap-3">
              {/* Main Search Button */}
              <Button
                variant="ghost"
                onClick={() => setIsLocationFocused(true)}
                className="flex-1 justify-start px-4 py-3 h-auto bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md transition-all duration-200"
              >
                <Search className="w-4 h-4 mr-3 text-gray-400" />
                <span className="text-left text-gray-600 font-medium truncate">
                  {searchFilters.isNationwide 
                    ? "Nationwide search" 
                    : searchFilters.location || "Where are you looking?"}
                </span>
              </Button>

              {/* Filters Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFilterDrawerOpen(true)}
                className="p-3 rounded-full border-gray-200 relative"
              >
                <Filter className="w-4 h-4" />
                {activeFiltersCount > 0 && (
                  <Badge 
                    variant="secondary" 
                    className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-primary-100 text-primary-700 border-primary-200"
                  >
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>

              {/* View Toggle for Mobile */}
              {showViewToggle && onMapViewToggle && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onMapViewToggle(!isMapView)}
                  className="p-3 rounded-full border-gray-200"
                >
                  {isMapView ? (
                    <List className="w-4 h-4" />
                  ) : (
                    <MapPin className="w-4 h-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Active Filters Display */}
        {activeFiltersCount > 0 && (
          <div className="border-t border-gray-100 bg-gray-50/80 backdrop-blur-sm">
            <div className="container mx-auto px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  {searchFilters.companyName && (
                    <Badge variant="secondary" className="bg-primary-100 text-primary-700 border-primary-200">
                      Company: {searchFilters.companyName}
                    </Badge>
                  )}
                  {searchFilters.sector.length > 0 && (
                    <Badge variant="secondary" className="bg-primary-100 text-primary-700 border-primary-200">
                      {searchFilters.sector.length} Sector{searchFilters.sector.length > 1 ? 's' : ''}
                    </Badge>
                  )}
                  {searchFilters.useClass.length > 0 && (
                    <Badge variant="secondary" className="bg-primary-100 text-primary-700 border-primary-200">
                      {searchFilters.useClass.length} Use Class{searchFilters.useClass.length > 1 ? 'es' : ''}
                    </Badge>
                  )}
                  {(searchFilters.sizeMin || searchFilters.sizeMax) && (
                    <Badge variant="secondary" className="bg-primary-100 text-primary-700 border-primary-200">
                      Size: {searchFilters.sizeMin || '0'} - {searchFilters.sizeMax || '∞'} sq ft
                    </Badge>
                  )}
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="text-gray-500 hover:text-gray-700 px-3 py-1 h-auto font-medium"
                >
                  Clear all
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Search Modal */}
      {isLocationFocused && (
        <div className="fixed inset-0 z-modal bg-white md:hidden">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Search location</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsLocationFocused(false)}
                className="p-2"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            {/* Search Content */}
            <div className="flex-1 p-4 space-y-4">
              <LocationSearch
                value={searchFilters.location}
                onChange={handleLocationChange}
                onLocationSelect={(location) => {
                  onLocationSelect(location);
                  setIsLocationFocused(false);
                }}
                placeholder="Enter location"
                className="w-full pl-12 pr-10 py-4 border border-gray-200 rounded-lg text-lg"
                autoFocus
              />
              
              <Button
                variant="outline"
                onClick={() => {
                  onNationwideSearch();
                  setIsLocationFocused(false);
                }}
                className={cn(
                  "w-full p-4 justify-start rounded-lg font-medium",
                  searchFilters.isNationwide && "bg-primary-50 border-primary-200 text-primary-700"
                )}
              >
                <Globe className="w-5 h-5 mr-3" />
                Search nationwide
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Filter Drawer */}
      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        filters={searchFilters}
        onFiltersChange={onFiltersChange}
      />
    </>
  );
}