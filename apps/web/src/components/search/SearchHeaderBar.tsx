'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Filter, Globe, MapPin, List, X, ChevronDown, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LocationSearch } from './LocationSearch';
import { UnifiedSearch } from './UnifiedSearch';
import { FilterDrawer } from './FilterDrawer';
import { FilterPill } from './FilterPill';
import { AnimatedFilterPill, FilterPillsContainer } from './AnimatedFilterPill';
import { SearchFilters } from '@/types/search';
import { cn } from '@/lib/utils';

interface SearchHeaderBarProps {
  searchFilters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  isMapView?: boolean;
  onMapViewToggle?: (isMapView: boolean) => void;
  showViewToggle?: boolean;
  className?: string;
}

export function SearchHeaderBar({
  searchFilters,
  onFiltersChange,
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

  // Track local search state without triggering search
  const [localSearchValue, setLocalSearchValue] = useState(
    searchFilters.location || searchFilters.companyName || ''
  );

  // Update local state when search filters change from parent
  useEffect(() => {
    const newValue = searchFilters.location || searchFilters.companyName || '';
    setLocalSearchValue(newValue);
  }, [searchFilters.location, searchFilters.companyName]);

  const handleSearchChange = (value: string) => {
    // Only update local state, don't trigger search
    setLocalSearchValue(value);
  };

  const handleLocationSelect = (location: { name: string; coordinates: { lat: number; lng: number } }) => {
    const newFilters = {
      ...searchFilters,
      location: location.name,
      coordinates: location.coordinates,
      companyName: '', // Clear company name when location is selected
      isNationwide: false,
    };
    onFiltersChange(newFilters);
  };

  const handleCompanySelect = (companyName: string) => {
    const newFilters = {
      ...searchFilters,
      companyName: companyName,
      location: '', // Clear location when company is selected
      coordinates: null,
      isNationwide: false,
    };
    onFiltersChange(newFilters);
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
            ? "bg-gradient-to-br from-violet-50/95 via-purple-50/95 to-blue-50/95 backdrop-blur-md shadow-2xl border-b border-violet-200"
            : "bg-gradient-to-br from-violet-50/90 via-purple-50/90 to-blue-50/90 backdrop-blur-sm border-b border-violet-100",
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
                className="flex items-center gap-3 px-6 py-2.5 rounded-full border-2 border-violet-300 hover:border-violet-400 bg-white hover:bg-violet-50 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <Search className="w-5 h-5 text-violet-600" />
                <span className="text-sm font-bold text-gray-700">
                  {searchFilters.location || searchFilters.companyName || "Search location or company..."}
                </span>
              </Button>
            ) : (
              /* Full Unified Search Bar */
              <div className="flex-1 relative">
                <div
                  className={cn(
                    "flex items-center gap-4 bg-white rounded-full border-3 transition-all duration-300",
                    isLocationFocused
                      ? "border-violet-400 shadow-2xl ring-4 ring-violet-200"
                      : "border-violet-200 hover:border-violet-300 shadow-lg"
                  )}
                >
                <div className="flex-1 px-4 py-3">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-violet-500" />
                    <UnifiedSearch
                      value={localSearchValue}
                      onChange={handleSearchChange}
                      onLocationSelect={handleLocationSelect}
                      onCompanySelect={handleCompanySelect}
                      onEnterKey={() => {
                        if (localSearchValue.trim()) {
                          // Determine if it looks more like a location or company name
                          // For now, treat as generic search and let the user select from suggestions
                          onFiltersChange({
                            ...searchFilters,
                            location: localSearchValue.trim(),
                            companyName: ''
                          });
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
                      placeholder="Search location or company name"
                      className="w-full border-0 outline-none bg-transparent text-gray-900 placeholder-gray-500 font-semibold text-base pl-12 pr-4"
                      hideIcon={true}
                    />
                  </div>
                </div>

                {/* Search Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (localSearchValue.trim()) {
                      // Default to location search when user clicks search button
                      onFiltersChange({
                        ...searchFilters,
                        location: localSearchValue.trim(),
                        companyName: ''
                      });
                    }
                  }}
                  className="violet-bloom-touch flex items-center justify-center h-14 w-14 rounded-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-105 shrink-0 mr-2"
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
                  className="px-4 py-2.5 rounded-full border-2 border-violet-300 bg-violet-100 text-violet-700 font-bold shadow-lg hover:shadow-xl"
                >
                  <Filter className="w-4 h-4 mr-1.5" />
                  {activeFiltersCount}
                </Button>
              )
            ) : (
              /* Full Filters Button */
              <Button
                variant="outline"
                onClick={() => setIsFilterDrawerOpen(true)}
                className={cn(
                  "px-6 py-3.5 h-auto rounded-full font-bold text-base transition-all duration-300 relative border-2",
                  activeFiltersCount > 0
                    ? "bg-violet-100 border-violet-300 text-violet-700 shadow-lg hover:shadow-xl hover:scale-105"
                    : "border-violet-200 hover:border-violet-300 bg-white shadow-md hover:shadow-lg hover:scale-105"
                )}
              >
                <Filter className="w-5 h-5 mr-2" />
                Filters
                {activeFiltersCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-2 bg-violet-200 text-violet-800 border border-violet-300 font-black px-2"
                  >
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            )}

            {/* View Toggle */}
            {showViewToggle && onMapViewToggle && (
              <div className="flex items-center bg-violet-100 rounded-full p-1.5 border-2 border-violet-200">
                <Button
                  variant={!isMapView ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onMapViewToggle(false)}
                  className={cn(
                    "px-5 py-2.5 rounded-full font-bold transition-all duration-300",
                    !isMapView
                      ? "bg-white shadow-lg text-violet-700 hover:scale-105"
                      : "text-violet-600 hover:text-violet-800 hover:bg-violet-50"
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
                    "px-5 py-2.5 rounded-full font-bold transition-all duration-300",
                    isMapView
                      ? "bg-white shadow-lg text-violet-700 hover:scale-105"
                      : "text-violet-600 hover:text-violet-800 hover:bg-violet-50"
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
                className="flex-1 justify-start px-5 py-3.5 h-auto bg-white border-2 border-violet-200 rounded-full shadow-lg hover:shadow-xl hover:border-violet-300 transition-all duration-300"
              >
                <Search className="w-5 h-5 mr-3 text-violet-500" />
                <span className="text-left text-gray-700 font-bold truncate">
                  {searchFilters.isNationwide
                    ? "Nationwide search"
                    : localSearchValue || searchFilters.location || searchFilters.companyName || "Search location or company..."}
                </span>
              </Button>

              {/* Filters Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFilterDrawerOpen(true)}
                className="p-3.5 rounded-full border-2 border-violet-200 relative bg-white shadow-lg hover:shadow-xl hover:border-violet-300 transition-all duration-300"
              >
                <Filter className="w-5 h-5 text-violet-600" />
                {activeFiltersCount > 0 && (
                  <Badge
                    variant="secondary"
                    className="absolute -top-1 -right-1 h-6 w-6 p-0 flex items-center justify-center text-xs font-black bg-violet-200 text-violet-800 border-2 border-violet-300"
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
                  className="p-3.5 rounded-full border-2 border-violet-200 bg-white shadow-lg hover:shadow-xl hover:border-violet-300 transition-all duration-300"
                >
                  {isMapView ? (
                    <List className="w-5 h-5 text-violet-600" />
                  ) : (
                    <MapPin className="w-5 h-5 text-violet-600" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Active Filters Display - Smooth Collapsible - Hidden on Map View */}
        {activeFiltersCount > 0 && !isMapView && (
          <div className={cn(
            "border-t border-violet-200 bg-violet-50/60 backdrop-blur-sm transition-all duration-300 ease-in-out overflow-hidden",
            isCollapsed
              ? "max-h-0 py-0 opacity-0"
              : isScrolled
                ? "max-h-20 py-2 opacity-100"
                : "max-h-20 py-2.5 opacity-100"
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
                  className="text-violet-600 hover:text-violet-800 hover:bg-violet-100 px-4 py-2 h-auto font-bold rounded-full transition-all duration-200"
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
        <div className="fixed inset-0 z-modal bg-gradient-to-br from-violet-50 via-purple-50 to-blue-50 md:hidden">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b-2 border-violet-200 bg-white/90 backdrop-blur-md">
              <h2 className="text-xl font-black text-gray-900">Search</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsLocationFocused(false)}
                className="p-2 hover:bg-violet-100 rounded-full"
              >
                <X className="w-6 h-6 text-violet-600" />
              </Button>
            </div>

            {/* Search Content */}
            <div className="flex-1 p-4 space-y-4">
              <div className="space-y-3">
                <UnifiedSearch
                  value={localSearchValue}
                  onChange={handleSearchChange}
                  onLocationSelect={(location) => {
                    handleLocationSelect(location);
                    setIsLocationFocused(false);
                  }}
                  onCompanySelect={(companyName) => {
                    handleCompanySelect(companyName);
                    setIsLocationFocused(false);
                  }}
                  onEnterKey={() => {
                    if (localSearchValue.trim()) {
                      onFiltersChange({ ...searchFilters, location: localSearchValue.trim() });
                      setIsLocationFocused(false);
                    }
                  }}
                  placeholder="Search location or company"
                  className="w-full pl-12 pr-10 py-4 border-2 border-violet-200 rounded-2xl text-lg font-semibold bg-white shadow-lg"
                  autoFocus
                />

                {/* Search Button for typed text */}
                {localSearchValue.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      onFiltersChange({ ...searchFilters, location: localSearchValue.trim() });
                      setIsLocationFocused(false);
                    }}
                    className="w-full p-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-2xl font-black text-lg shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300"
                  >
                    Search for "{localSearchValue}"
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
                className="w-full p-4 text-left border-2 border-violet-200 rounded-2xl hover:bg-violet-50 bg-white shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <div className="flex items-center">
                  <Search className="w-5 h-5 mr-3 text-violet-500" />
                  <span className="text-gray-900 font-bold">View all listings nationwide</span>
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