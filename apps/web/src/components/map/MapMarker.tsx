'use client';

import { forwardRef, useState } from 'react';
import { Building2 } from 'lucide-react';
import { MapCluster } from '@/hooks/useMapClustering';
import { getSearchResultLogoUrl } from '@/lib/search-logo-utils';
import { cn } from '@/lib/utils';

interface MapMarkerProps {
  cluster: MapCluster;
  onClick: (event: React.MouseEvent) => void;
}

export const MapMarker = forwardRef<HTMLButtonElement, MapMarkerProps>(
  ({ cluster, onClick }, ref) => {
    const isSingle = cluster.type === 'single';
    const listing = cluster.listings[0];
    const logoUrl = isSingle ? getSearchResultLogoUrl(listing) : null;
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);
    
    // Get company initials for fallback
    const getInitials = (name: string) => {
      return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    };
    
    return (
      <button
        ref={ref}
        className="map-marker-button relative cursor-pointer group focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded-full"
        onClick={(event) => onClick(event)}
        aria-label={
          isSingle 
            ? `Property listing: ${listing.company_name} at ${listing.place_name}`
            : `${cluster.count} property listings at this location`
        }
        tabIndex={0}
        style={{ 
          minWidth: '44px',
          minHeight: '44px'
        }}
      >
        {/* Pin stem - positioned before the marker so it appears behind */}
        <div className={cn(
          "absolute left-1/2 w-0.5 h-3 transform -translate-x-1/2",
          isSingle ? 'bg-gray-400' : 'bg-orange-500',
          "top-8 md:top-10"
        )} />
        
        {/* Main marker with Story 8.0 styling */}
        <div className={cn(
          "relative flex items-center justify-center rounded-full border-2 transition-all duration-300 ease-out cursor-pointer",
          isSingle 
            ? "w-10 h-10 md:w-12 md:h-12 bg-white" 
            : "w-10 h-10 md:w-12 md:h-12 bg-orange-500 border-white",
          "group-hover:scale-110 group-hover:z-[1000]"
        )}
        style={{
          boxShadow: isSingle 
            ? '0 4px 12px rgba(0, 0, 0, 0.15)'
            : '0 4px 12px rgba(249, 115, 22, 0.3)'
        }}>
          {isSingle ? (
            // Single listing - show logo or initials
            <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-white">
              {logoUrl && !imageError ? (
                <>
                  <img 
                    src={logoUrl}
                    alt={`${listing.company_name} logo`}
                    className={cn(
                      "w-8 h-8 md:w-10 md:h-10 object-contain p-1",
                      imageLoaded ? "opacity-100" : "opacity-0"
                    )}
                    onLoad={() => setImageLoaded(true)}
                    onError={() => {
                      setImageError(true);
                      setImageLoaded(true);
                    }}
                  />
                  {!imageLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100 animate-pulse rounded-full">
                      <div className="text-xs font-medium text-gray-400">
                        {getInitials(listing.company_name)}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                // Fallback to initials
                <div className="w-full h-full bg-primary-500 text-white flex items-center justify-center text-xs font-bold rounded-full">
                  {getInitials(listing.company_name)}
                </div>
              )}
            </div>
          ) : (
            // Multi-listing icon
            <Building2 className="w-4 h-4 text-white md:w-5 md:h-5" />
          )}
        </div>

        {/* Count badge for clusters with Story 8.0 styling */}
        {!isSingle && (
          <div className={`
            absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold
            rounded-full min-w-[18px] h-[18px] flex items-center justify-center
            border-2 border-white
            md:-top-2 md:-right-2 md:min-w-[24px] md:h-6 md:text-sm
            ${cluster.count > 99 ? 'px-1' : ''}
          `}
          style={{
            boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)'
          }}>
            {cluster.count > 99 ? '99+' : cluster.count}
          </div>
        )}


      </button>
    );
  }
);

MapMarker.displayName = 'MapMarker';