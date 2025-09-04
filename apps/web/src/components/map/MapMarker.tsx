'use client';

import { forwardRef, useState } from 'react';
import { Building2 } from 'lucide-react';
import { MapCluster } from '@/hooks/useMapClustering';
import { getSearchResultLogoUrl } from '@/lib/search-logo-utils';
import { cn } from '@/lib/utils';
import { AgencyMapData } from '@/components/agencies/AgencyMapSimple';

interface MapMarkerProps {
  type: 'listing' | 'listing-cluster' | 'agency' | 'agency-cluster';
  count: number;
  isSelected: boolean;
  cluster?: MapCluster;
  agency?: AgencyMapData;
  onClick?: (event: React.MouseEvent) => void;
}

export const MapMarker = forwardRef<HTMLButtonElement, MapMarkerProps>(
  ({ type, count, isSelected, cluster, agency, onClick }, ref) => {
    const isSingle = count === 1;
    const isAgency = type === 'agency' || type === 'agency-cluster';
    
    // For listings
    const listing = cluster?.listings?.[0];
    const listingLogoUrl = isSingle && listing ? getSearchResultLogoUrl(listing) : null;
    
    // For agencies
    const agencyLogoUrl = agency?.logo_url;
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
    
    const displayName = isAgency 
      ? (agency?.name || 'Agency')
      : (listing?.company_name || 'Company');
    
    const displayLocation = isAgency 
      ? (agency?.office_address || 'Office location')
      : (listing?.place_name || 'Property location');
    
    const logoUrl = isAgency ? agencyLogoUrl : listingLogoUrl;

    return (
      <button
        ref={ref}
        className="map-marker-button relative cursor-pointer group focus:outline-none"
        onClick={(event) => onClick?.(event)}
        aria-label={
          isSingle 
            ? `${isAgency ? 'Agency' : 'Property listing'}: ${displayName} at ${displayLocation}`
            : `${count} ${isAgency ? 'agencies' : 'property listings'} at this location`
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
          isSingle 
            ? (isAgency ? 'bg-violet-400' : 'bg-gray-400')
            : (isAgency ? 'bg-violet-500' : 'bg-orange-500'),
          "top-8 md:top-10"
        )} />
        
        {/* Main marker with Story 8.0 styling */}
        <div className={cn(
          "relative flex items-center justify-center rounded-full border-2 transition-all duration-300 ease-out cursor-pointer",
          isSingle 
            ? "w-10 h-10 md:w-12 md:h-12 bg-white" 
            : isAgency
              ? "w-10 h-10 md:w-12 md:h-12 bg-violet-500 border-white"
              : "w-10 h-10 md:w-12 md:h-12 bg-orange-500 border-white",
          "group-hover:scale-110 group-hover:z-[1000]",
          isSelected && "scale-110 z-[1000]"
        )}
        style={{
          boxShadow: isSingle 
            ? '0 4px 12px rgba(0, 0, 0, 0.15)'
            : isAgency 
              ? '0 4px 12px rgba(139, 92, 246, 0.3)'
              : '0 4px 12px rgba(249, 115, 22, 0.3)'
        }}>
          {isSingle ? (
            // Single item - show logo or initials
            <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-white">
              {logoUrl && !imageError ? (
                <>
                  <img 
                    src={logoUrl}
                    alt={`${displayName} logo`}
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
                        {getInitials(displayName)}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                // Fallback to initials
                <div className={cn(
                  "w-full h-full text-white flex items-center justify-center text-xs font-bold rounded-full",
                  isAgency ? "bg-violet-500" : "bg-primary-500"
                )}>
                  {getInitials(displayName)}
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
          <div className={cn(
            "absolute -top-1 -right-1 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center border-2 border-white md:-top-2 md:-right-2 md:min-w-[24px] md:h-6 md:text-sm",
            isAgency ? "bg-red-600" : "bg-red-600",
            count > 99 ? 'px-1' : ''
          )}
          style={{
            boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)'
          }}>
            {count > 99 ? '99+' : count}
          </div>
        )}


      </button>
    );
  }
);

MapMarker.displayName = 'MapMarker';