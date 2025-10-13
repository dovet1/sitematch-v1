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
import { TrialSignupModal } from '@/components/TrialSignupModal';
import { PaywallModal } from '@/components/PaywallModal';
import { useSubscriptionAccess } from '@/hooks/useSubscriptionAccess';

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { hasAccess, loading: subscriptionLoading } = useSubscriptionAccess();
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [isSignupInProgress, setIsSignupInProgress] = useState(false);

  // Parse URL parameters into SearchFilters
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(() => {
    if (!searchParams) {
      return {
        location: '',
        coordinates: null,
        nationwide: false,
        sectors: [],
        useClasses: [],
        listingTypes: [],
        sizeMin: null,
        sizeMax: null,
        acreageMin: null,
        acreageMax: null,
        dwellingMin: null,
        dwellingMax: null,
        companyName: ''
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

  const [isMapView, setIsMapView] = useState(searchParams.get('view') === 'map');
  const [selectedListingId, setSelectedListingId] = useState<string | null>(
    searchParams.get('listingId') || null
  );
  const [previousScrollPosition, setPreviousScrollPosition] = useState(0);

  // Update selectedListingId when URL listingId parameter changes
  useEffect(() => {
    const urlListingId = searchParams.get('listingId');
    setSelectedListingId(urlListingId);
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

  const handleTrialModalClose = () => {
    setShowTrialModal(false);
    // Redirect back to home page when user closes modal
    router.push('/');
  };

  const handlePaywallModalClose = () => {
    setShowPaywallModal(false);
    // Redirect back to home page when user closes modal
    router.push('/');
  };

  const handleSignupStarted = (loading: boolean) => {
    // When signup starts (loading = true), immediately close the modal and prevent it from reappearing
    if (loading) {
      setShowTrialModal(false);
      setIsSignupInProgress(true);
    }
  };

  // Check subscription access and show appropriate modal
  useEffect(() => {
    if (!loading && !subscriptionLoading && !isSignupInProgress) {
      if (!user) {
        // User not logged in - show trial signup modal
        setShowTrialModal(true);
        setShowPaywallModal(false);
      } else if (user && !hasAccess) {
        // User logged in but no subscription - show paywall modal
        setShowTrialModal(false);
        setShowPaywallModal(true);
      } else {
        // User has access - hide both modals
        setShowTrialModal(false);
        setShowPaywallModal(false);
      }
    }
  }, [user, hasAccess, loading, subscriptionLoading, isSignupInProgress]);

  // Show loading state while checking auth
  if (loading || subscriptionLoading) {
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

  // Remove auth wall - let middleware handle subscription check instead

  // Show access modal for non-paid users
  const showAccessDenied = !user || (user && !hasAccess)

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

      {/* Main Content - Only show if user has access */}
      {!showAccessDenied ? (
        <div className={isMapView ? "map-view-container" : "container mx-auto px-4 py-6"}>
        {/* Results Header - Only show in list view */}
        {!isMapView && (
          <div className="mb-6 space-y-4">
            {/* Search State Breadcrumb */}
            <div className="flex items-center gap-1 sm:gap-2 text-sm text-muted-foreground overflow-hidden">
              {searchFilters.location || searchFilters.isNationwide ? (
                <>
                  <button
                    onClick={() => handleFiltersChange({ ...searchFilters, location: '', coordinates: null, isNationwide: false })}
                    className="text-primary-600 hover:text-primary-700 hover:underline transition-colors flex-shrink-0"
                  >
                    All Requirements
                  </button>
                  <span className="flex-shrink-0">›</span>
                  <span className="text-foreground font-medium truncate min-w-0">
                    {searchFilters.isNationwide 
                      ? "Nationwide Only" 
                      : `Search: "${searchFilters.location}"`}
                  </span>
                </>
              ) : (
                <span className="text-foreground font-medium">All Requirements</span>
              )}
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
            />
          )}
        </div>
        </div>
      ) : (
        /* Placeholder content for non-paid users */
        <div className="container mx-auto px-4 py-6">
          <div className="text-center py-12">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/2 mx-auto"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3 mx-auto"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-64 bg-gray-200 rounded-lg"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Listing Modal - Only show if user has access */}
      {!showAccessDenied && (
        <ListingModal
          listingId={selectedListingId}
          isOpen={!!selectedListingId}
          onClose={handleModalClose}
          searchState={searchFilters}
          scrollPosition={previousScrollPosition}
        />
      )}

      {/* Trial Modal for non-authenticated users */}
      <TrialSignupModal
        context="search"
        forceOpen={showTrialModal && !isSignupInProgress}
        onClose={handleTrialModalClose}
        onLoadingChange={handleSignupStarted}
      >
        <div />
      </TrialSignupModal>

      {/* Paywall Modal for authenticated users without subscription */}
      <PaywallModal
        context="search"
        isOpen={showPaywallModal}
        onClose={handlePaywallModalClose}
        redirectTo="/search"
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