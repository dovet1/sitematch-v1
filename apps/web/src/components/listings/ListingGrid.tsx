'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SearchFilters, SearchResult } from '@/types/search';
import { ListingCard } from './ListingCard';
import { LoadingGrid } from './LoadingGrid';
import { SearchEmptyState } from './SearchEmptyState';

interface ListingGridProps {
  filters: SearchFilters;
  onListingClick: (listingId: string) => void;
  onFiltersChange?: (filters: SearchFilters) => void;
}

export function ListingGrid({ filters, onListingClick, onFiltersChange }: ListingGridProps) {
  const [listings, setListings] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const ITEMS_PER_PAGE = 20;


  // Reset pagination when filters change
  useEffect(() => {
    setPage(1);
    setListings([]);
    setHasMore(true);
  }, [filters]);

  // Fetch listings function
  const fetchListings = async (pageNum: number, append: boolean = false) => {
    if (!append) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    setError(null);
    
    try {
      // Build query parameters
      const params = new URLSearchParams();
        
        if (filters.location) params.append('location', filters.location);
        if (filters.coordinates) {
          params.append('lat', filters.coordinates.lat.toString());
          params.append('lng', filters.coordinates.lng.toString());
        }
        if (filters.companyName) params.append('companyName', filters.companyName);
        if (filters.sizeMin !== null) params.append('sizeMin', filters.sizeMin.toString());
        if (filters.sizeMax !== null) params.append('sizeMax', filters.sizeMax.toString());
        if (filters.acreageMin !== null) params.append('minAcreage', filters.acreageMin.toString());
        if (filters.acreageMax !== null) params.append('maxAcreage', filters.acreageMax.toString());
        if (filters.dwellingMin !== null) params.append('minDwelling', filters.dwellingMin.toString());
        if (filters.dwellingMax !== null) params.append('maxDwelling', filters.dwellingMax.toString());
        if (filters.isNationwide) params.append('isNationwide', 'true');
        
        filters.sector.forEach(s => params.append('sector', s));
        filters.useClass.forEach(uc => params.append('useClass', uc));
        filters.listingType.forEach(lt => params.append('listingType', lt));
        
        // Add pagination parameters
        params.append('page', pageNum.toString());
        params.append('limit', ITEMS_PER_PAGE.toString());
        
        const response = await fetch(`/api/public/listings?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Update listings
        if (append) {
          setListings(prev => [...prev, ...(data.results || [])]);
        } else {
          setListings(data.results || []);
        }
        
        // Check if there are more listings
        const receivedCount = data.results?.length || 0;
        setHasMore(receivedCount === ITEMS_PER_PAGE);
        
        // Update total count if provided
        if (data.total !== undefined) {
          setTotalCount(data.total);
        }
        
      } catch (err) {
        console.error('Error fetching listings:', err);
        console.error('Error details:', err instanceof Error ? err.message : 'Unknown error');
        setError('Failed to load listings. Please try again.');
        if (!append) {
          setListings([]);
        }
        return;
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
  };

  // Initial load
  useEffect(() => {
    fetchListings(1, false);
  }, [filters]);

  // Load more function
  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore && !isLoading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchListings(nextPage, true);
    }
  }, [isLoadingMore, hasMore, isLoading, page]);

  // Infinite scroll detection
  const observerTarget = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore && !isLoading) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [loadMore, hasMore, isLoadingMore, isLoading]);

  if (isLoading) {
    return <LoadingGrid />;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-primary-600 hover:text-primary-700 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (listings.length === 0) {
    const handleBrowseAll = () => {
      if (onFiltersChange) {
        onFiltersChange({
          ...filters,
          location: '',
          coordinates: null,
          isNationwide: true
        });
      }
    };

    const handleClearFilters = () => {
      if (onFiltersChange) {
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
      }
    };

    return (
      <SearchEmptyState 
        filters={filters}
        onBrowseAll={handleBrowseAll}
        onClearFilters={handleClearFilters}
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* Listings Grid */}
      <div className="listing-grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {listings.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            onClick={() => onListingClick(listing.id)}
          />
        ))}
      </div>

      {/* Loading More Indicator */}
      {isLoadingMore && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={`skeleton-${i}`} className="animate-pulse">
              <div className="bg-gray-200 rounded-lg h-64"></div>
            </div>
          ))}
        </div>
      )}

      {/* Load More Button (fallback for accessibility) */}
      {hasMore && !isLoadingMore && (
        <div className="flex justify-center py-8">
          <button
            onClick={loadMore}
            className="px-6 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors duration-200 font-medium shadow-sm hover:shadow-md"
          >
            Load More Listings
          </button>
        </div>
      )}

      {/* Listing Count */}
      {listings.length > 0 && (
        <div className="text-center text-sm text-gray-600">
          Showing {listings.length} {totalCount > 0 && `of ${totalCount}`} listings
        </div>
      )}

      {/* Infinite Scroll Trigger */}
      <div ref={observerTarget} className="h-4" />
    </div>
  );
}