'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Filter, Globe, MapPin, List, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LocationSearch } from './LocationSearch';
import { FilterDrawer } from './FilterDrawer';
import { FilterPill } from './FilterPill';
import { AnimatedFilterPill, FilterPillsContainer } from './AnimatedFilterPill';
import { SearchFilters } from '@/types/search';
import { cn } from '@/lib/utils';

interface SearchHeaderBarProps {
  searchFilters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onLocationSelect: (locationData: { name: string; coordinates: { lat: number; lng: number } }) => void;
  isMapView?: boolean;
  onMapViewToggle?: (isMapView: boolean) => void;
  showViewToggle?: boolean;
  className?: string;
}

export function SearchHeaderBar({
  searchFilters,
  onFiltersChange,
  onLocationSelect,
  isMapView = false,
  onMapViewToggle,
  showViewToggle = false,
  className
}: SearchHeaderBarProps) {
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [isLocationFocused, setIsLocationFocused] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [forceExpanded, setForceExpanded] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  // Track scroll position for styling changes and collapse behavior
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const handleScroll = () => {
      const scrolled = window.scrollY > 10;
      const shouldCollapse = window.scrollY > 120; // Slightly higher threshold
      
      setIsScrolled(scrolled);
      
      // Debounce collapse changes to prevent flutter
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        // Reset forceExpanded if user scrolls past the threshold after interaction
        if (forceExpanded && shouldCollapse && !isLocationFocused) {
          setForceExpanded(false);
        }
        
        // Don't collapse if force expanded or if user is interacting with search
        if (!forceExpanded && !isLocationFocused) {
          setIsCollapsed(shouldCollapse);
        }
      }, 50); // 50ms delay to smooth out rapid scroll changes
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(timeoutId);
    };
  }, [forceExpanded, isLocationFocused]);

  // Calculate active filters count
  const activeFiltersCount = [
    searchFilters.companyName,
    searchFilters.sector.length > 0,
    searchFilters.useClass.length > 0,
    searchFilters.listingType.length > 0,
    searchFilters.sizeMin !== null || searchFilters.sizeMax !== null,
    searchFilters.acreageMin !== null || searchFilters.acreageMax !== null,
    searchFilters.dwellingMin !== null || searchFilters.dwellingMax !== null,
  ].filter(Boolean).length;

  // Track local location state without triggering search
  const [localLocation, setLocalLocation] = useState(searchFilters.location);
  
  // Update local state when location changes from parent
  useEffect(() => {
    setLocalLocation(searchFilters.location);
  }, [searchFilters.location]);
  
  const handleLocationChange = (location: string) => {
    // Only update local state, don't trigger search
    setLocalLocation(location);
  };

  const handleClearFilters = () => {
    onFiltersChange({
      location: '',
      coordinates: null,
      companyName: '',
      sector: [],
      useClass: [],
      listingType: [],
      sizeMin: null,
      sizeMax: null,
      acreageMin: null,
      acreageMax: null,
      dwellingMin: null,
      dwellingMax: null,
      isNationwide: false,
    });
  };

  const handleRemoveCompanyFilter = () => {
    onFiltersChange({ ...searchFilters, companyName: '' });
  };

  const handleRemoveSectorFilter = (sectorToRemove: string) => {
    onFiltersChange({
      ...searchFilters,
      sector: searchFilters.sector.filter(s => s !== sectorToRemove)
    });
  };

  const handleRemoveUseClassFilter = (useClassToRemove: string) => {
    onFiltersChange({
      ...searchFilters,
      useClass: searchFilters.useClass.filter(uc => uc !== useClassToRemove)
    });
  };

  const handleRemoveListingTypeFilter = (listingTypeToRemove: string) => {
    onFiltersChange({
      ...searchFilters,
      listingType: searchFilters.listingType.filter(lt => lt !== listingTypeToRemove)
    });
  };

  const handleRemoveSizeFilter = () => {
    onFiltersChange({
      ...searchFilters,
      sizeMin: null,
      sizeMax: null
    });
  };

  const handleRemoveAcreageFilter = () => {
    onFiltersChange({
      ...searchFilters,
      acreageMin: null,
      acreageMax: null
    });
  };

  const handleRemoveDwellingFilter = () => {
    onFiltersChange({
      ...searchFilters,
      dwellingMin: null,
      dwellingMax: null
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
        <div className={cn(
          "container mx-auto px-4 transition-all duration-300",
          isCollapsed ? "py-1" : "py-2"
        )}>
          {/* Desktop Layout */}
          <div className={cn(
            "hidden md:flex items-center gap-4 transition-all duration-300",
            isCollapsed && "justify-center"
          )}>
            {/* Location Search Section - Responsive to Collapse */}
            {isCollapsed ? (
              /* Collapsed Search - Compact Button */
              <Button
                variant="outline"
                onClick={() => {
                  // Scroll to top and restore full interface
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  // Force restore collapsed state immediately and prevent re-collapse
                  setIsCollapsed(false);
                  setForceExpanded(true);
                  // After scroll completes, focus the search input
                  setTimeout(() => {
                    setIsLocationFocused(true);
                  }, 300);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-full border-gray-200 hover:border-primary-300 transition-all duration-200"
              >
                <Search className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {searchFilters.location || "Search location..."}
                </span>
              </Button>
            ) : (
              /* Full Search Bar */
              <div className="flex-1 relative">
                <div 
                  className={cn(
                    "flex items-center gap-4 bg-white rounded-full border-2 transition-all duration-200",
                    isLocationFocused 
                      ? "border-primary-300 shadow-lg ring-4 ring-primary-100" 
                      : "border-gray-200 hover:border-gray-300 shadow-sm"
                  )}
                >
                <div className="flex-1 px-4 py-3">
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <LocationSearch
                      value={localLocation}
                      onChange={handleLocationChange}
                      onLocationSelect={onLocationSelect}
                      onEnterKey={() => {
                        if (localLocation.trim()) {
                          onFiltersChange({ ...searchFilters, location: localLocation.trim() });
                        }
                      }}
                      onFocus={() => setIsLocationFocused(true)}
                      onBlur={() => {
                        setIsLocationFocused(false);
                        // Allow normal collapse behavior after user finishes interaction
                        if (forceExpanded) {
                          setTimeout(() => setForceExpanded(false), 1000);
                        }
                      }}
                      placeholder="Where are you looking?"
                      className="w-full border-0 outline-none bg-transparent text-gray-700 placeholder-gray-400 font-medium pl-12 pr-4"
                      hideIcon={true}
                    />
                  </div>
                </div>
                
                {/* Search Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (localLocation.trim()) {
                      // Trigger search with the current local location
                      onFiltersChange({ ...searchFilters, location: localLocation.trim() });
                    }
                  }}
                  className="violet-bloom-touch flex items-center justify-center h-12 w-12 rounded-full bg-primary-600 hover:bg-primary-700 transition-colors shrink-0 mr-2"
                  aria-label="Search"
                >
                  <Search className="w-5 h-5 text-white" />
                </button>
                </div>
              </div>
            )}

            {/* Filters Button - Responsive to Collapse */}
            {isCollapsed ? (
              /* Collapsed Filters - Show count only */
              activeFiltersCount > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setIsFilterDrawerOpen(true)}
                  className="px-3 py-2 rounded-full border-primary-200 bg-primary-50 text-primary-700"
                >
                  <Filter className="w-4 h-4 mr-1" />
                  {activeFiltersCount}
                </Button>
              )
            ) : (
              /* Full Filters Button */
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
            )}

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
                    : localLocation || searchFilters.location || "Where are you looking?"}
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

        {/* Active Filters Display - Smooth Collapsible - Hidden on Map View */}
        {activeFiltersCount > 0 && !isMapView && (
          <div className={cn(
            "border-t border-gray-100 bg-gray-50/50 backdrop-blur-sm transition-all duration-300 ease-in-out overflow-hidden",
            isCollapsed 
              ? "max-h-0 py-0 opacity-0" 
              : isScrolled 
                ? "max-h-20 py-1 opacity-100" 
                : "max-h-20 py-2 opacity-100"
          )}>
            <div className="container mx-auto px-4">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <FilterPillsContainer>
                  {/* Company Name Filter */}
                  {searchFilters.companyName && (
                    <AnimatedFilterPill id="company">
                      <FilterPill
                        type="company"
                        label={searchFilters.companyName}
                        value={searchFilters.companyName}
                        onRemove={handleRemoveCompanyFilter}
                      />
                    </AnimatedFilterPill>
                  )}
                  
                  {/* Individual Sector Filters */}
                  {searchFilters.sector.map((sector) => (
                    <AnimatedFilterPill key={`sector-${sector}`} id={`sector-${sector}`}>
                      <FilterPill
                        type="sector"
                        label={sector}
                        value={sector}
                        onRemove={() => handleRemoveSectorFilter(sector)}
                      />
                    </AnimatedFilterPill>
                  ))}
                  
                  {/* Individual Use Class Filters */}
                  {searchFilters.useClass.map((useClass) => (
                    <AnimatedFilterPill key={`useClass-${useClass}`} id={`useClass-${useClass}`}>
                      <FilterPill
                        type="useClass"
                        label={useClass}
                        value={useClass}
                        onRemove={() => handleRemoveUseClassFilter(useClass)}
                      />
                    </AnimatedFilterPill>
                  ))}
                  
                  {/* Individual Listing Type Filters */}
                  {searchFilters.listingType.map((listingType) => (
                    <AnimatedFilterPill key={`listingType-${listingType}`} id={`listingType-${listingType}`}>
                      <FilterPill
                        type="listingType"
                        label={listingType}
                        value={listingType}
                        onRemove={() => handleRemoveListingTypeFilter(listingType)}
                      />
                    </AnimatedFilterPill>
                  ))}
                  
                  {/* Size Range Filter */}
                  {(searchFilters.sizeMin || searchFilters.sizeMax) && (
                    <AnimatedFilterPill id="size">
                      <FilterPill
                        type="size"
                        label={`${searchFilters.sizeMin || '0'} - ${searchFilters.sizeMax || '∞'} sq ft`}
                        value={`${searchFilters.sizeMin || '0'} - ${searchFilters.sizeMax || '∞'} sq ft`}
                        onRemove={handleRemoveSizeFilter}
                      />
                    </AnimatedFilterPill>
                  )}
                  
                  {/* Acreage Range Filter */}
                  {(searchFilters.acreageMin || searchFilters.acreageMax) && (
                    <AnimatedFilterPill id="acreage">
                      <FilterPill
                        type="acreage"
                        label={`${searchFilters.acreageMin || '0'} - ${searchFilters.acreageMax || '∞'} acres`}
                        value={`${searchFilters.acreageMin || '0'} - ${searchFilters.acreageMax || '∞'} acres`}
                        onRemove={handleRemoveAcreageFilter}
                      />
                    </AnimatedFilterPill>
                  )}
                  
                  {/* Dwelling Count Range Filter */}
                  {(searchFilters.dwellingMin || searchFilters.dwellingMax) && (
                    <AnimatedFilterPill id="dwelling">
                      <FilterPill
                        type="dwelling"
                        label={`${searchFilters.dwellingMin || '0'} - ${searchFilters.dwellingMax || '∞'} dwellings`}
                        value={`${searchFilters.dwellingMin || '0'} - ${searchFilters.dwellingMax || '∞'} dwellings`}
                        onRemove={handleRemoveDwellingFilter}
                      />
                    </AnimatedFilterPill>
                  )}
                </FilterPillsContainer>
                
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
              <div className="space-y-3">
                <LocationSearch
                  value={localLocation}
                  onChange={handleLocationChange}
                  onLocationSelect={(location) => {
                    onLocationSelect(location);
                    setIsLocationFocused(false);
                  }}
                  onEnterKey={() => {
                    if (localLocation.trim()) {
                      onFiltersChange({ ...searchFilters, location: localLocation.trim() });
                      setIsLocationFocused(false);
                    }
                  }}
                  placeholder="Enter location"
                  className="w-full pl-12 pr-10 py-4 border border-gray-200 rounded-lg text-lg"
                  autoFocus
                />
                
                {/* Search Button for typed location */}
                {localLocation.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      onFiltersChange({ ...searchFilters, location: localLocation.trim() });
                      setIsLocationFocused(false);
                    }}
                    className="w-full p-4 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Search in {localLocation}
                  </button>
                )}
              </div>
              
              {/* Browse All Option */}
              <button
                type="button"
                onClick={() => {
                  onFiltersChange({ ...searchFilters, isNationwide: true });
                  setIsLocationFocused(false);
                }}
                className="w-full p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center">
                  <Search className="w-5 h-5 mr-3 text-gray-400" />
                  <span className="text-gray-700 font-medium">View all listings nationwide</span>
                </div>
              </button>
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