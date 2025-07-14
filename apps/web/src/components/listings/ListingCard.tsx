'use client';

import { MapPin } from 'lucide-react';
import { SearchResult } from '@/types/search';
import { cn } from '@/lib/utils';
import { getSearchResultLogoUrl } from '@/lib/search-logo-utils';

interface ListingCardProps {
  listing: SearchResult;
  onClick: () => void;
}

function getInitials(companyName: string): string {
  return companyName
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function ListingCard({ listing, onClick }: ListingCardProps) {
  // Get the appropriate logo URL based on clearbit_logo flag and available data
  const logoUrl = getSearchResultLogoUrl(listing);
  
  return (
    <article 
      className={cn(
        "listing-card",
        "bg-card border border-border rounded-md overflow-hidden",
        "cursor-pointer transition-all duration-200 ease-in-out relative",
        "hover:-translate-y-0.5 hover:shadow-lg hover:border-primary-200"
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
      <div className="listing-card-logo h-40 w-full p-5 bg-gray-50 flex items-center justify-center relative">
        {listing.is_nationwide && (
          <div className="nationwide-badge absolute top-3 right-3 bg-primary-500 text-primary-foreground px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1 z-10">
            <MapPin className="w-3 h-3" />
            Nationwide
          </div>
        )}
        
        {logoUrl ? (
          <img 
            src={logoUrl} 
            alt={`${listing.company_name} logo`}
            className="max-w-full max-h-full object-contain"
            loading="lazy"
            onError={(e) => {
              // Hide broken image and show placeholder
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const placeholder = target.nextElementSibling;
              if (placeholder) {
                placeholder.classList.remove('hidden');
              }
            }}
          />
        ) : null}
        
        {/* Placeholder (always render but conditionally hide) */}
        <div className={cn(
          "logo-placeholder",
          "w-20 h-20 bg-primary-100 text-primary-600 rounded-md",
          "flex items-center justify-center text-3xl font-semibold tracking-tight",
          "leading-none", // Ensure no extra line height affects centering
          logoUrl ? "hidden" : ""
        )}>
          {getInitials(listing.company_name)}
        </div>
      </div>
      
      <div className="listing-card-name px-4 py-5 text-center border-t border-border">
        <h3 className="text-lg font-semibold text-foreground m-0 whitespace-nowrap overflow-hidden text-ellipsis">
          {listing.company_name}
        </h3>
      </div>
    </article>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="listing-card bg-card border border-border rounded-md overflow-hidden">
      <div className="listing-card-logo h-40 w-full p-5 bg-gray-50 flex items-center justify-center">
        <div className="w-20 h-20 bg-gray-200 rounded-md animate-pulse" />
      </div>
      <div className="listing-card-name px-4 py-5 text-center border-t border-border">
        <div className="h-6 bg-gray-200 rounded-md animate-pulse w-3/4 mx-auto" />
      </div>
    </div>
  );
}