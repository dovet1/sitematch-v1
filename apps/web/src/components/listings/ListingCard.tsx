'use client';

import { MapPin, Building2, Briefcase, Ruler } from 'lucide-react';
import { SearchResult } from '@/types/search';
import { cn } from '@/lib/utils';
import { getSearchResultLogoUrl } from '@/lib/search-logo-utils';
import { useState } from 'react';

interface ListingCardProps {
  listing: SearchResult;
  onClick: () => void;
  searchCoordinates?: { lat: number; lng: number } | null;
  index?: number;
}

function getInitials(companyName: string): string {
  return companyName
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatSectorName(sector: string): string {
  // Handle common sector formats and make them human-readable
  return sector
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .split(' ')
    .map(word => {
      // Handle special acronyms
      const acronyms = ['UK', 'US', 'EU', 'IT', 'HR', 'PR', 'B2B', 'B2C', 'EV'];
      if (acronyms.includes(word.toUpperCase())) {
        return word.toUpperCase();
      }
      // Capitalize first letter of each word
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

function formatUseClassName(useClass: string): string {
  // Handle common use class formats
  // Prioritize code if available, otherwise format the name
  return useClass
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .split(' ')
    .map((word, index) => {
      // Common use class codes should stay uppercase
      if (word.match(/^[A-Z]+[0-9]*$/)) {
        return word;
      }
      // First word capitalized, rest lowercase unless it's an acronym
      return index === 0 || word.length <= 2
        ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        : word.toLowerCase();
    })
    .join(' ');
}

function normalizeCoordinates(coords: any): { lat: number; lng: number } | null {
  if (!coords) return null;

  // Handle array format [lng, lat]
  if (Array.isArray(coords) && coords.length === 2) {
    return { lat: coords[1], lng: coords[0] };
  }

  // Handle object format {lat, lng}
  if (typeof coords === 'object' && 'lat' in coords && 'lng' in coords) {
    return { lat: coords.lat, lng: coords.lng };
  }

  return null;
}

function calculateDistance(
  coord1: { lat: number; lng: number },
  coord2: { lat: number; lng: number }
): number {
  // Haversine formula to calculate distance in km
  const R = 6371; // Earth's radius in km
  const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
  const dLon = (coord2.lng - coord1.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatLocations(
  listing: SearchResult,
  searchCoordinates?: { lat: number; lng: number } | null
): string {
  if (listing.is_nationwide) {
    return 'Nationwide';
  }

  // Use multiple locations if available
  if (listing.locations && listing.locations.length > 0) {
    let locations = [...listing.locations];

    // Sort by distance to search coordinates if available
    if (searchCoordinates) {
      locations = locations.sort((a, b) => {
        const aNormalized = normalizeCoordinates(a.coordinates);
        const bNormalized = normalizeCoordinates(b.coordinates);

        // Handle missing coordinates
        if (!aNormalized) return 1;
        if (!bNormalized) return -1;

        // Calculate distances
        const aDist = calculateDistance(searchCoordinates, aNormalized);
        const bDist = calculateDistance(searchCoordinates, bNormalized);

        return aDist - bDist;
      });
    }

    const formattedLocations = locations.map(loc => {
      // Extract just the first part (city/town name)
      const placeParts = loc.place_name.split(',').map(p => p.trim());
      return placeParts[0];
    });

    // Return formatted locations
    if (formattedLocations.length === 1) {
      return formattedLocations[0];
    } else if (formattedLocations.length === 2) {
      return formattedLocations.join(' & ');
    } else {
      return `${formattedLocations[0]} + ${formattedLocations.length - 1} more`;
    }
  }

  // Fallback to legacy place_name field
  if (listing.place_name) {
    const parts = listing.place_name.split(',').map(part => part.trim());
    return parts[0];
  }

  return 'Location not specified';
}

function formatSiteSize(listing: SearchResult): string {
  const min = listing.site_size_min;
  const max = listing.site_size_max;
  
  if (!min && !max) {
    return 'No site size preference';
  }
  
  // Format numbers with commas
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-GB').format(num);
  };
  
  if (min && max) {
    return `${formatNumber(min)} - ${formatNumber(max)} sq ft`;
  } else if (min) {
    return `Min ${formatNumber(min)} sq ft`;
  } else if (max) {
    return `Max ${formatNumber(max)} sq ft`;
  }
  
  return 'No site size preference';
}

export function ListingCard({ listing, onClick, searchCoordinates, index = 999 }: ListingCardProps) {
  // Get the appropriate logo URL based on clearbit_logo flag and available data
  const logoUrl = getSearchResultLogoUrl(listing);
  const siteSizeText = formatSiteSize(listing);
  const locationText = formatLocations(listing, searchCoordinates);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Load first 8 cards eagerly (covers 2 rows at max 4-col layout, 4 rows at 2-col)
  // This ensures above-the-fold content is always loaded regardless of viewport
  const isAboveFold = index < 8;
  const loadingStrategy = isAboveFold ? 'eager' : 'lazy';
  const fetchPriority = isAboveFold ? 'high' : 'auto';

  return (
    <article 
      className={cn(
        "listing-card group",
        "flex flex-col bg-white rounded-xl overflow-hidden",
        "cursor-pointer transition-all duration-200",
        "hover:shadow-md"
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`View ${listing.company_name} listing`}
    >
      {/* Logo Section - Optimized for Clearbit logos */}
      <div className="relative aspect-[4/3] bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center p-4">
          {logoUrl ? (
            <div className="w-full h-full flex items-center justify-center">
              <img
                src={logoUrl}
                alt={`${listing.company_name} logo`}
                className="max-w-full max-h-full object-contain"
                loading={loadingStrategy}
                fetchPriority={fetchPriority as 'high' | 'low' | 'auto'}
                onLoad={() => setImageLoaded(true)}
                onError={(e) => {
                  // Hide broken image and show placeholder
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  setImageLoaded(true);
                }}
              />
            </div>
          ) : null}
          
          {/* Placeholder - always visible, only hide when image loads */}
          <div className={cn(
            "logo-placeholder",
            "w-28 h-28 bg-white text-gray-700 rounded-2xl shadow-sm",
            "flex items-center justify-center text-4xl font-bold tracking-tight",
            "border border-gray-200",
            logoUrl && imageLoaded ? "hidden" : ""
          )}>
            {getInitials(listing.company_name)}
          </div>
        </div>
      </div>
      
      {/* Content Section */}
      <div className="flex flex-col flex-1 p-3">
        {/* Company Name */}
        <h3 className="text-base font-semibold text-gray-900 mb-1 line-clamp-1">
          {listing.company_name}
        </h3>

        {/* Location */}
        <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="line-clamp-1">{locationText}</span>
        </div>

        {/* Site Size */}
        <div className="flex items-center gap-1 text-sm text-gray-500 mb-3">
          <Ruler className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="line-clamp-1">{siteSizeText}</span>
        </div>
        
        {/* Sectors and Use Classes Pills */}
        <div className="flex flex-wrap gap-2 mt-auto">
          {/* Sectors */}
          {listing.sectors && listing.sectors.length > 0 && (
            <div className="flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-gray-400" />
              <div className="flex flex-wrap gap-1">
                {listing.sectors.slice(0, 2).map((sector, index) => (
                  <span 
                    key={sector.id || index}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                    title={sector.name}
                  >
                    {formatSectorName(sector.name)}
                  </span>
                ))}
                {listing.sectors.length > 2 && (
                  <span 
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                    title={`${listing.sectors.length - 2} more sectors`}
                  >
                    +{listing.sectors.length - 2}
                  </span>
                )}
              </div>
            </div>
          )}
          
          {/* Use Classes */}
          {listing.use_classes && listing.use_classes.length > 0 && (
            <div className="flex items-center gap-1">
              <Briefcase className="w-3.5 h-3.5 text-gray-400" />
              <div className="flex flex-wrap gap-1">
                {listing.use_classes.slice(0, 1).map((useClass, index) => (
                  <span 
                    key={useClass.id || index}
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"
                    title={useClass.name}
                  >
                    {useClass.code ? useClass.code : formatUseClassName(useClass.name)}
                  </span>
                ))}
                {listing.use_classes.length > 1 && (
                  <span 
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700"
                    title={`${listing.use_classes.length - 1} more use classes`}
                  >
                    +{listing.use_classes.length - 1}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="listing-card flex flex-col bg-white rounded-xl overflow-hidden">
      {/* Logo skeleton */}
      <div className="relative aspect-[4/3] bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="w-28 h-28 bg-gray-200 rounded-2xl animate-pulse" />
        </div>
      </div>
      
      {/* Content skeleton */}
      <div className="flex flex-col flex-1 p-3">
        {/* Company name skeleton */}
        <div className="h-5 bg-gray-200 rounded animate-pulse w-3/4 mb-2" />
        
        {/* Site size skeleton */}
        <div className="flex items-center gap-1 mb-3">
          <div className="w-3.5 h-3.5 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
        </div>
        
        {/* Pills skeleton */}
        <div className="flex gap-2 mt-auto">
          <div className="h-6 bg-gray-200 rounded-full animate-pulse w-16" />
          <div className="h-6 bg-gray-200 rounded-full animate-pulse w-12" />
        </div>
      </div>
    </div>
  );
}