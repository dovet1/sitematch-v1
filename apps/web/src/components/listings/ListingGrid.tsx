'use client';

import { useState, useEffect } from 'react';
import { SearchFilters, SearchResult } from '@/types/search';
import { ListingCard } from './ListingCard';
import { LoadingGrid } from './LoadingGrid';

interface ListingGridProps {
  filters: SearchFilters;
  onListingClick: (listingId: string) => void;
}

export function ListingGrid({ filters, onListingClick }: ListingGridProps) {
  const [listings, setListings] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    const fetchListings = async () => {
      setIsLoading(true);
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
        
        const response = await fetch(`/api/public/listings?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setListings(data.results || []);
        
      } catch (err) {
        console.error('Error fetching listings:', err);
        console.error('Error details:', err instanceof Error ? err.message : 'Unknown error');
        setError('Failed to load listings. Please try again.');
        setListings([]);
        return;
      } finally {
        setIsLoading(false);
      }
    };

    fetchListings();
  }, [filters]);

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
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">No listings found matching your criteria.</p>
        <p className="text-sm text-muted-foreground">
          Try adjusting your filters or search location.
        </p>
      </div>
    );
  }

  return (
    <div className="listing-grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {listings.map((listing) => (
        <ListingCard
          key={listing.id}
          listing={listing}
          onClick={() => onListingClick(listing.id)}
        />
      ))}
    </div>
  );
}