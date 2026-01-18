'use client';

import { MapPin, Building2, Briefcase, Ruler, CheckCircle2 } from 'lucide-react';
import { SearchResult } from '@/types/search';
import { cn } from '@/lib/utils';
import { getSearchResultLogoUrl } from '@/lib/search-logo-utils';
import { isRecentlyVerified, getRelativeVerificationTime } from '@/lib/utils/date-formatting';
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
    return 'All locations considered';
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
  // For residential listings, show acreage instead of sq ft
  if (listing.listing_type === 'residential') {
    const minAcres = listing.site_acreage_min;
    const maxAcres = listing.site_acreage_max;

    if (!minAcres && !maxAcres) {
      return 'No site size preference';
    }

    // Format numbers with up to 2 decimal places
    const formatAcres = (num: number) => {
      return num % 1 === 0 ? num.toString() : num.toFixed(2);
    };

    if (minAcres && maxAcres) {
      return `${formatAcres(minAcres)} - ${formatAcres(maxAcres)} acres`;
    } else if (minAcres) {
      return `Min ${formatAcres(minAcres)} acres`;
    } else if (maxAcres) {
      return `Max ${formatAcres(maxAcres)} acres`;
    }

    return 'No site size preference';
  }

  // For commercial listings, show sq ft
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

  // Get primary sector for display
  const primarySector = listing.sectors?.[0]?.name;

  return (
    <article
      className={cn(
        "listing-card group relative",
        "bg-white rounded-[2rem] p-7 md:p-8 border-3 border-violet-200",
        "cursor-pointer transition-all duration-500",
        "hover:shadow-2xl hover:border-violet-400 hover:-translate-y-3",
        index % 4 === 1 ? 'md:mt-6' : index % 4 === 3 ? 'md:mt-8' : ''
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
      data-listing-id={listing.id}
    >
      {/* Gradient accent corner */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-300/30 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

      {/* Logo/Company */}
      <div className="relative flex items-center gap-4 mb-7">
        {logoUrl ? (
          <div className="w-16 h-16 md:w-18 md:h-18 rounded-2xl overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center flex-shrink-0 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
            <img
              src={logoUrl}
              alt={`${listing.company_name} logo`}
              className="w-full h-full object-contain p-1.5"
              width={64}
              height={64}
              loading={loadingStrategy}
              fetchPriority={fetchPriority as 'high' | 'low' | 'auto'}
              onLoad={() => setImageLoaded(true)}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                if (target.parentElement) {
                  target.parentElement.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-500 to-purple-600 text-white font-bold text-lg">${getInitials(listing.company_name)}</div>`;
                }
              }}
            />
          </div>
        ) : (
          <div className="w-16 h-16 md:w-18 md:h-18 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
            {getInitials(listing.company_name)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="relative font-black text-gray-900 text-base md:text-lg pb-2 break-words">
            {listing.company_name}
            <span className="absolute bottom-0 left-0 w-16 h-1 bg-violet-300 group-hover:w-full transition-all duration-500 rounded-full"></span>
          </h3>
          {primarySector && (
            <p className="text-sm text-violet-600 font-bold mt-1">{formatSectorName(primarySector)}</p>
          )}
        </div>
      </div>

      {/* Details with bold icons */}
      <div className="space-y-3 text-base text-gray-700 font-semibold mb-5">
        <div className="flex items-start gap-3">
          <MapPin className="w-5 h-5 mt-0.5 flex-shrink-0 text-violet-500" />
          <span className="line-clamp-1">{locationText}</span>
        </div>
        {siteSizeText && siteSizeText !== 'No site size preference' && (
          <div className="flex items-start gap-3">
            <Building2 className="w-5 h-5 mt-0.5 flex-shrink-0 text-violet-500" />
            <span>{siteSizeText}</span>
          </div>
        )}
        {/* Verification badge - only show if recently verified (within 90 days) */}
        {listing.verified_at && isRecentlyVerified(listing.verified_at) && (
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0 text-green-500" />
            <span className="text-sm text-green-600">Verified {getRelativeVerificationTime(listing.verified_at)}</span>
          </div>
        )}
      </div>

      {/* Bold hover indicator */}
      <div className="mt-5 pt-5 border-t-3 border-violet-100 group-hover:border-violet-300 transition-colors duration-300">
        <span className="text-base text-violet-600 font-black flex items-center gap-2">
          View details
          <svg className="w-5 h-5 group-hover:translate-x-2 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </span>
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