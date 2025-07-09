'use client';

import { useState } from 'react';
import { Search, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HeroSearch } from '@/components/search/HeroSearch';
import { FilterDrawer } from '@/components/search/FilterDrawer';
import { ListingGrid } from '@/components/listings/ListingGrid';
import { ListingMap } from '@/components/listings/ListingMap';
import { ListingModal } from '@/components/listings/ListingModal';
import { SearchFilters } from '@/types/search';

export default function Home() {
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    location: '',
    coordinates: null,
    companyName: '',
    sector: [],
    useClass: [],
    sizeMin: null,
    sizeMax: null,
    isNationwide: false,
  });

  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [isMapView, setIsMapView] = useState(false);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [previousScrollPosition, setPreviousScrollPosition] = useState(0);

  const handleSearch = (filters: SearchFilters) => {
    setSearchFilters(filters);
  };

  const handleListingClick = (listingId: string) => {
    setPreviousScrollPosition(window.scrollY);
    setSelectedListingId(listingId);
  };

  const handleModalClose = () => {
    setSelectedListingId(null);
    setTimeout(() => {
      window.scrollTo(0, previousScrollPosition);
    }, 300);
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <HeroSearch
        onSearch={handleSearch}
        onFilterToggle={() => setIsFilterDrawerOpen(true)}
        searchFilters={searchFilters}
      />

      {/* Filter Drawer */}
      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        filters={searchFilters}
        onFiltersChange={setSearchFilters}
      />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Header with View Toggle */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="heading-3">Property Requirements</h2>
          <div className="flex items-center gap-2">
            <Button
              variant={!isMapView ? "default" : "outline"}
              size="sm"
              onClick={() => setIsMapView(false)}
            >
              <Search className="w-4 h-4 mr-2" />
              List View
            </Button>
            <Button
              variant={isMapView ? "default" : "outline"}
              size="sm"
              onClick={() => setIsMapView(true)}
            >
              <MapPin className="w-4 h-4 mr-2" />
              Map View
            </Button>
          </div>
        </div>

        {/* Active Filters Display */}
        {(searchFilters.location || searchFilters.companyName || searchFilters.sector.length > 0 || searchFilters.useClass.length > 0 || searchFilters.sizeMin || searchFilters.sizeMax || searchFilters.isNationwide) && (
          <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
            <span>Active filters:</span>
            <div className="flex flex-wrap items-center gap-2">
              {searchFilters.location && (
                <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded-full text-xs">
                  Location: {searchFilters.location}
                </span>
              )}
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

        {/* Content Area */}
        <div className="relative">
          {isMapView ? (
            <ListingMap
              filters={searchFilters}
              onListingClick={handleListingClick}
            />
          ) : (
            <ListingGrid
              filters={searchFilters}
              onListingClick={handleListingClick}
            />
          )}
        </div>
      </div>

      {/* Modal */}
      <ListingModal
        listingId={selectedListingId}
        isOpen={!!selectedListingId}
        onClose={handleModalClose}
      />
    </main>
  );
}