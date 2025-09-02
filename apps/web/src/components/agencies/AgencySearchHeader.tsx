'use client';

import { useState } from 'react';
import { Search, Filter, List, MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { AgencyFilterDrawer } from './AgencyFilterDrawer';
import { cn } from '@/lib/utils';

interface AgencySearchHeaderProps {
  search: string;
  classification: string;
  onSearchChange: (search: string) => void;
  onClassificationChange: (classification: string) => void;
  isMapView: boolean;
  onMapViewToggle: (isMapView: boolean) => void;
  className?: string;
}

export function AgencySearchHeader({
  search,
  classification,
  onSearchChange,
  onClassificationChange,
  isMapView,
  onMapViewToggle,
  className
}: AgencySearchHeaderProps) {
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState(search);

  // Calculate active filters count
  const activeFiltersCount = [
    search.trim(),
    classification && classification !== 'all'
  ].filter(Boolean).length;

  const handleSearchSubmit = () => {
    if (localSearch.trim()) {
      onSearchChange(localSearch.trim());
    }
  };

  const handleClearFilters = () => {
    setLocalSearch('');
    onSearchChange('');
    onClassificationChange('all');
  };

  const handleRemoveSearchFilter = () => {
    setLocalSearch('');
    onSearchChange('');
  };

  const handleRemoveClassificationFilter = () => {
    onClassificationChange('all');
  };

  return (
    <>
      {/* Main Search Header */}
      <div className={cn(
        "sticky top-0 z-sticky transition-all duration-300 bg-white/95 backdrop-blur-md shadow-lg border-b border-gray-200",
        className
      )}>
        <div className="container mx-auto px-4 py-2">
          <div className="max-w-6xl mx-auto">
            {/* Desktop Layout */}
            <div className="hidden md:flex items-center gap-4">
              {/* Search Bar */}
              <div className="flex-1 relative">
                <div className="flex items-center gap-4 bg-white rounded-full border-2 border-gray-200 hover:border-gray-300 shadow-sm transition-all duration-200">
                  <div className="flex-1 px-4 py-3">
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        value={localSearch}
                        onChange={(e) => setLocalSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSearchSubmit();
                          }
                        }}
                        placeholder="Search agencies by name..."
                        className="w-full border-0 outline-none bg-transparent text-gray-700 placeholder-gray-400 font-medium pl-12 pr-4 focus:ring-0"
                      />
                    </div>
                  </div>
                  
                  {/* Search Button */}
                  <button
                    type="button"
                    onClick={handleSearchSubmit}
                    className="flex items-center justify-center h-12 w-12 rounded-full bg-primary-600 hover:bg-primary-700 transition-colors shrink-0 mr-2"
                    aria-label="Search"
                  >
                    <Search className="w-5 h-5 text-white" />
                  </button>
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
            </div>

            {/* Mobile Layout */}
            <div className="md:hidden">
              <div className="flex items-center gap-3">
                {/* Main Search Button */}
                <div className="flex-1">
                  <div className="flex items-center bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md transition-all duration-200">
                    <div className="flex-1 px-4 py-3">
                      <div className="relative">
                        <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          value={localSearch}
                          onChange={(e) => setLocalSearch(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSearchSubmit();
                            }
                          }}
                          placeholder="Search agencies..."
                          className="w-full border-0 outline-none bg-transparent text-gray-600 font-medium pl-6 pr-4 focus:ring-0"
                        />
                      </div>
                    </div>
                  </div>
                </div>

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
              </div>
            </div>
          </div>
        </div>

        {/* Active Filters Display */}
        {activeFiltersCount > 0 && (
          <div className="border-t border-gray-100 bg-gray-50/50 backdrop-blur-sm transition-all duration-300">
            <div className="container mx-auto px-4 py-2">
              <div className="max-w-6xl mx-auto">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <div className="flex flex-wrap gap-2">
                    {/* Search Filter */}
                    {search && (
                      <div className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm font-medium">
                        <Search className="h-3 w-3" />
                        {search}
                        <button
                          onClick={handleRemoveSearchFilter}
                          className="ml-1 p-0.5 hover:bg-primary-200 rounded-full transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    
                    {/* Classification Filter */}
                    {classification && classification !== 'all' && (
                      <div className="inline-flex items-center gap-1 px-3 py-1 bg-violet-100 text-violet-800 rounded-full text-sm font-medium">
                        <Filter className="h-3 w-3" />
                        {`${classification} Property`}
                        <button
                          onClick={handleRemoveClassificationFilter}
                          className="ml-1 p-0.5 hover:bg-violet-200 rounded-full transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
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
          </div>
        )}
      </div>

      {/* Filter Drawer */}
      <AgencyFilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        classification={classification}
        onClassificationChange={onClassificationChange}
      />
    </>
  );
}