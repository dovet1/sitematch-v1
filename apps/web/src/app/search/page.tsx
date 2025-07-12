'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { UnifiedHeader } from '@/components/search/UnifiedHeader';
import { ListingGrid } from '@/components/listings/ListingGrid';
import { ListingMap } from '@/components/listings/ListingMap';
import { ListingModal } from '@/components/listings/ListingModal';
import { SearchFilters } from '@/types/search';

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Parse URL parameters into SearchFilters
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(() => {
    const location = searchParams.get('location') || '';
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const nationwide = searchParams.get('nationwide') === 'true';
    const sectors = searchParams.getAll('sectors[]');
    const useClasses = searchParams.getAll('useClasses[]');
    const sizeMin = searchParams.get('minSize');
    const sizeMax = searchParams.get('maxSize');
    const companyName = searchParams.get('companyName') || '';
    
    return {
      location,
      coordinates: lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null,
      companyName,
      sector: sectors,
      useClass: useClasses,
      sizeMin: sizeMin ? parseInt(sizeMin) : null,
      sizeMax: sizeMax ? parseInt(sizeMax) : null,
      isNationwide: nationwide,
    };
  });

  const [isMapView, setIsMapView] = useState(searchParams.get('view') === 'map');
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [previousScrollPosition, setPreviousScrollPosition] = useState(0);

  // Update URL when filters or view changes
  const updateURL = (filters: SearchFilters, mapView: boolean) => {
    const params = new URLSearchParams();
    
    if (filters.location) params.set('location', filters.location);
    if (filters.coordinates?.lat) params.set('lat', filters.coordinates.lat.toString());
    if (filters.coordinates?.lng) params.set('lng', filters.coordinates.lng.toString());
    if (filters.isNationwide) params.set('nationwide', 'true');
    if (filters.companyName) params.set('companyName', filters.companyName);
    if (filters.sizeMin) params.set('minSize', filters.sizeMin.toString());
    if (filters.sizeMax) params.set('maxSize', filters.sizeMax.toString());
    
    // Keep array notation for URL readability, but the API call will use the correct format
    filters.sector.forEach(s => params.append('sectors[]', s));
    filters.useClass.forEach(uc => params.append('useClasses[]', uc));
    
    params.set('view', mapView ? 'map' : 'list');
    
    router.replace(`/search?${params.toString()}`);
  };

  const handleFiltersChange = (filters: SearchFilters) => {
    setSearchFilters(filters);
    updateURL(filters, isMapView);
  };

  const handleViewToggle = (mapView: boolean) => {
    setIsMapView(mapView);
    updateURL(searchFilters, mapView);
  };

  const handleLocationSelect = (locationData: { name: string; coordinates: { lat: number; lng: number } }) => {
    const newFilters = {
      ...searchFilters,
      location: locationData.name,
      coordinates: locationData.coordinates,
      isNationwide: false,
    };
    handleFiltersChange(newFilters);
  };

  const handleNationwideSearch = () => {
    const newFilters = {
      ...searchFilters,
      location: searchFilters.isNationwide ? searchFilters.location : '',
      coordinates: searchFilters.isNationwide ? searchFilters.coordinates : null,
      isNationwide: !searchFilters.isNationwide,
    };
    handleFiltersChange(newFilters);
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
    <div className="min-h-screen bg-background">
      {/* Unified Header with Search */}
      <UnifiedHeader
        searchFilters={searchFilters}
        onFiltersChange={handleFiltersChange}
        onLocationSelect={handleLocationSelect}
        onNationwideSearch={handleNationwideSearch}
        isMapView={isMapView}
        onMapViewToggle={handleViewToggle}
        showViewToggle={true}
      />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        {/* Results Header */}
        <div className="mb-6">
          <h1 className="heading-3">
            {searchFilters.isNationwide 
              ? "Nationwide Requirements" 
              : searchFilters.location 
                ? `Requirements in ${searchFilters.location}`
                : "All Requirements"}
          </h1>
        </div>

        {/* Results Display */}
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

      {/* Listing Modal */}
      <ListingModal
        listingId={selectedListingId}
        isOpen={!!selectedListingId}
        onClose={handleModalClose}
        searchState={searchFilters}
        scrollPosition={previousScrollPosition}
      />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse">
            <div className="h-8 w-48 bg-gray-200 rounded mb-4 mx-auto" />
            <div className="h-4 w-32 bg-gray-200 rounded mx-auto" />
          </div>
        </div>
      </div>
    }>
      <SearchPageContent />
    </Suspense>
  );
}