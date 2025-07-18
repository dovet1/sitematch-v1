'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { UnifiedHeader } from '@/components/search/UnifiedHeader';
import { ListingGrid } from '@/components/listings/ListingGrid';
import { ListingMap } from '@/components/listings/ListingMap';
import { ListingModal } from '@/components/listings/ListingModal';
import { SearchFilters } from '@/types/search';
import { useAuth } from '@/contexts/auth-context';
import { AuthWall } from '@/components/auth/auth-wall';
import { SearchContextToast } from '@/components/search/search-context-toast';
import { UserTypeModal } from '@/components/auth/user-type-modal';

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  
  // Parse URL parameters into SearchFilters
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(() => {
    const location = searchParams.get('location') || '';
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const nationwide = searchParams.get('nationwide') === 'true';
    const sectors = searchParams.getAll('sectors[]');
    const useClasses = searchParams.getAll('useClasses[]');
    const listingTypes = searchParams.getAll('listingTypes[]');
    const sizeMin = searchParams.get('minSize');
    const sizeMax = searchParams.get('maxSize');
    const acreageMin = searchParams.get('minAcreage');
    const acreageMax = searchParams.get('maxAcreage');
    const dwellingMin = searchParams.get('minDwelling');
    const dwellingMax = searchParams.get('maxDwelling');
    const companyName = searchParams.get('companyName') || '';
    
    return {
      location,
      coordinates: lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null,
      companyName,
      sector: sectors,
      useClass: useClasses,
      listingType: listingTypes,
      sizeMin: sizeMin ? parseInt(sizeMin) : null,
      sizeMax: sizeMax ? parseInt(sizeMax) : null,
      acreageMin: acreageMin ? parseFloat(acreageMin) : null,
      acreageMax: acreageMax ? parseFloat(acreageMax) : null,
      dwellingMin: dwellingMin ? parseInt(dwellingMin) : null,
      dwellingMax: dwellingMax ? parseInt(dwellingMax) : null,
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
    if (filters.acreageMin) params.set('minAcreage', filters.acreageMin.toString());
    if (filters.acreageMax) params.set('maxAcreage', filters.acreageMax.toString());
    if (filters.dwellingMin) params.set('minDwelling', filters.dwellingMin.toString());
    if (filters.dwellingMax) params.set('maxDwelling', filters.dwellingMax.toString());
    
    // Keep array notation for URL readability, but the API call will use the correct format
    filters.sector.forEach(s => params.append('sectors[]', s));
    filters.useClass.forEach(uc => params.append('useClasses[]', uc));
    filters.listingType.forEach(lt => params.append('listingTypes[]', lt));
    
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

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse">
            <div className="h-8 w-48 bg-gray-200 rounded mb-4 mx-auto" />
            <div className="h-4 w-32 bg-gray-200 rounded mx-auto" />
          </div>
        </div>
      </div>
    );
  }

  // Show auth wall if not authenticated
  if (!user) {
    const query = searchParams.get('query') || searchFilters.location || searchFilters.companyName;
    return (
      <div className="min-h-screen bg-background">
        <UnifiedHeader
          searchFilters={searchFilters}
          onFiltersChange={handleFiltersChange}
          onLocationSelect={handleLocationSelect}
          onNationwideSearch={handleNationwideSearch}
          isMapView={isMapView}
          onMapViewToggle={handleViewToggle}
          showViewToggle={false}
        />
        <AuthWall 
          searchQuery={query}
          // TODO: Get actual result count from API
          resultCount={undefined}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* User Type Modal for existing users without type */}
      <UserTypeModal />
      
      {/* Search Context Toast */}
      <SearchContextToast />
      
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