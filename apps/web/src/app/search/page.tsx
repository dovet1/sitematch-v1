'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { UnifiedHeader } from '@/components/search/UnifiedHeader';
import { ListingGrid } from '@/components/listings/ListingGrid';
import { ListingMap } from '@/components/listings/ListingMap';
import { ListingModal } from '@/components/listings/ListingModal';
import { SearchFilters } from '@/types/search';
import { useAuth } from '@/contexts/auth-context';
import { AuthWall } from '@/components/auth/auth-wall';
import { SearchContextToast } from '@/components/search/search-context-toast';
import { UserTypeModal } from '@/components/auth/user-type-modal';
import { useSubscriptionTier } from '@/hooks/useSubscriptionTier';

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const { hasProAccess } = useSubscriptionTier();

  // Preserve full path with search filters
  const currentPath = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');

  // Parse URL parameters into SearchFilters
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(() => {
    if (!searchParams) {
      return {
        location: '',
        coordinates: null,
        companyName: '',
        sector: [],
        useClass: [],
        sizeMin: null,
        sizeMax: null,
        acreageMin: null,
        acreageMax: null,
        dwellingMin: null,
        dwellingMax: null,
        isNationwide: false,
        listingType: []
      };
    }

    const location = searchParams.get('location') || '';
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const nationwide = searchParams.get('nationwide') === 'true';
    const viewAll = searchParams.get('viewAll') === 'true';
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
    
    // If viewAll is true, show all listings without location filter
    // If nationwide is true, actually filter for nationwide listings
    // These are different concepts!
    return {
      location: viewAll ? '' : location, // Clear location if viewing all
      coordinates: viewAll ? null : (lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : null),
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
      isNationwide: nationwide && !viewAll, // Only set nationwide if explicitly requested, not for viewAll
    };
  });

  const [isMapView, setIsMapView] = useState(searchParams?.get('view') === 'map');
  const [selectedListingId, setSelectedListingId] = useState<string | null>(
    searchParams?.get('listingId') || null
  );
  const [previousScrollPosition, setPreviousScrollPosition] = useState(0);
  const [totalListings, setTotalListings] = useState(0);

  // Update selectedListingId when URL listingId parameter changes
  useEffect(() => {
    const urlListingId = searchParams?.get('listingId');
    setSelectedListingId(urlListingId || null);
  }, [searchParams]);

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

  // Handle upgrade CTA click - redirect to auth or pricing
  const handleUpgradeClick = () => {
    if (!user) {
      router.push(`/auth?mode=signup&returnUrl=${encodeURIComponent(currentPath)}`);
    } else {
      router.push('/pricing');
    }
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
        isMapView={isMapView}
        onMapViewToggle={handleViewToggle}
        showViewToggle={true}
      />

      {/* Main Content - Show for all users (free tier gets limited listings) */}
      <div className={isMapView ? "map-view-container" : "relative bg-[#FBFAF7] min-h-screen"}>

        <div className={!isMapView ? "relative" : ""}>
        {/* Header Strip - Only show in list view */}
        {!isMapView && (
          <div className="pt-10 pb-6">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                <div className="flex-1">
                  {/* H1 */}
                  <h1 className="text-[44px] md:text-[44px] leading-tight font-semibold tracking-[-0.035em] mb-4">
                    Live requirements
                  </h1>

                  {/* Lede paragraph */}
                  <p className="text-base text-[#4A4451] max-w-[580px] leading-relaxed">
                    Browse verified property requirements from brands actively seeking their next location. Updated regularly with the latest opportunities across the UK.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

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
              onFiltersChange={handleFiltersChange}
              onUpgradeClick={handleUpgradeClick}
              onTotalCountChange={setTotalListings}
            />
          )}
        </div>
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