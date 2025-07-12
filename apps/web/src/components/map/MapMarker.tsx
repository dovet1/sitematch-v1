'use client';

import { forwardRef } from 'react';
import { Building2 } from 'lucide-react';
import { MapCluster } from '@/hooks/useMapClustering';

interface MapMarkerProps {
  cluster: MapCluster;
  isSelected?: boolean;
  isHovered?: boolean;
  onClick: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export const MapMarker = forwardRef<HTMLButtonElement, MapMarkerProps>(
  ({ cluster, isSelected, isHovered, onClick, onMouseEnter, onMouseLeave }, ref) => {
    const isSingle = cluster.type === 'single';
    const listing = cluster.listings[0];
    
    return (
      <button
        ref={ref}
        className="map-marker-button relative cursor-pointer group focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 rounded-full"
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        aria-label={
          isSingle 
            ? `Property listing: ${listing.company_name} at ${listing.place_name}`
            : `${cluster.count} property listings at this location`
        }
        aria-pressed={isSelected}
        tabIndex={0}
        style={{ 
          transform: 'translate(-50%, -100%)',
          minWidth: '44px',
          minHeight: '44px'
        }}
      >
        {/* Main marker */}
        <div className={`
          relative flex items-center justify-center rounded-full border-2 border-white shadow-lg
          transition-all duration-300 ease-out
          ${isSingle 
            ? 'w-8 h-8 bg-primary-500 md:w-10 md:h-10' 
            : 'w-10 h-10 bg-orange-500 md:w-12 md:h-12'
          }
          ${isSelected ? 'ring-2 ring-primary-600 ring-offset-2 scale-110' : ''}
          ${isHovered ? 'scale-110 shadow-xl' : ''}
          group-hover:scale-110 group-hover:shadow-xl
        `}>
          {isSingle ? (
            // Single listing icon
            <div className="w-2 h-2 bg-white rounded-full md:w-3 md:h-3" />
          ) : (
            // Multi-listing icon
            <Building2 className="w-4 h-4 text-white md:w-5 md:h-5" />
          )}
        </div>

        {/* Count badge for clusters */}
        {!isSingle && (
          <div className={`
            absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold
            rounded-full min-w-[20px] h-5 flex items-center justify-center
            border-2 border-white shadow-md
            md:min-w-[24px] md:h-6 md:text-sm
            ${cluster.count > 99 ? 'px-1' : ''}
          `}>
            {cluster.count > 99 ? '99+' : cluster.count}
          </div>
        )}

        {/* Pin stem */}
        <div className={`
          absolute top-6 left-1/2 w-0.5 h-2 transform -translate-x-1/2
          ${isSingle ? 'bg-primary-500' : 'bg-orange-500'}
          md:top-8 md:h-3
        `} />

        {/* Hover tooltip */}
        {isHovered && (
          <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 bg-white border border-border rounded-lg shadow-lg p-3 min-w-48 max-w-xs z-50 md:bottom-16">
            {isSingle ? (
              // Single listing tooltip
              <div>
                <div className="text-sm font-medium truncate">{listing.company_name}</div>
                <div className="text-xs text-muted-foreground truncate">{listing.place_name}</div>
                <div className="text-xs text-muted-foreground">
                  {formatSizeRange(listing.site_size_min, listing.site_size_max)}
                </div>
                {listing.sector && (
                  <div className="text-xs text-primary-600 mt-1">{listing.sector}</div>
                )}
              </div>
            ) : (
              // Cluster tooltip
              <div>
                <div className="text-sm font-medium">
                  {cluster.count} Properties at this location
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Click to view all listings
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {Array.from(new Set(cluster.listings.map(l => l.sector).filter(Boolean)))
                    .slice(0, 3)
                    .map(sector => (
                      <span 
                        key={sector} 
                        className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full"
                      >
                        {sector}
                      </span>
                    ))}
                  {cluster.listings.map(l => l.sector).filter(Boolean).length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{cluster.listings.map(l => l.sector).filter(Boolean).length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </button>
    );
  }
);

MapMarker.displayName = 'MapMarker';

function formatSizeRange(min: number | null, max: number | null): string {
  if (!min && !max) return 'Size not specified';
  if (min && max) return `${min.toLocaleString()} - ${max.toLocaleString()} sq ft`;
  if (min) return `From ${min.toLocaleString()} sq ft`;
  if (max) return `Up to ${max.toLocaleString()} sq ft`;
  return '';
}