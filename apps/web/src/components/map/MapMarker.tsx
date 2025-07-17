'use client';

import { forwardRef } from 'react';
import { Building2 } from 'lucide-react';
import { MapCluster } from '@/hooks/useMapClustering';

interface MapMarkerProps {
  cluster: MapCluster;
  onClick: (event: React.MouseEvent) => void;
}

export const MapMarker = forwardRef<HTMLButtonElement, MapMarkerProps>(
  ({ cluster, onClick }, ref) => {
    const isSingle = cluster.type === 'single';
    const listing = cluster.listings[0];
    
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
        {/* Main marker with Story 8.0 styling */}
        <div className={`
          relative flex items-center justify-center rounded-full border-2 border-white
          transition-all duration-300 ease-out cursor-pointer
          ${isSingle 
            ? 'w-8 h-8 bg-primary-500 md:w-11 md:h-11' 
            : 'w-10 h-10 bg-orange-500 md:w-12 md:h-12'
          }
          group-hover:scale-110 group-hover:z-[1000]
        `}
        style={{
          boxShadow: isSingle 
            ? '0 4px 12px rgba(139, 92, 246, 0.3)'
            : '0 4px 12px rgba(249, 115, 22, 0.3)'
        }}>
          {isSingle ? (
            // Single listing icon
            <div className="w-2 h-2 bg-white rounded-full md:w-3 md:h-3" />
          ) : (
            // Multi-listing icon
            <Building2 className="w-4 h-4 text-white md:w-5 md:h-5" />
          )}
        </div>

        {/* Count badge for clusters with Story 8.0 styling */}
        {!isSingle && (
          <div className={`
            absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold
            rounded-full min-w-[20px] h-5 flex items-center justify-center
            border-2 border-white
            md:min-w-[24px] md:h-6 md:text-sm
            ${cluster.count > 99 ? 'px-1' : ''}
          `}
          style={{
            boxShadow: '0 2px 8px rgba(220, 38, 38, 0.3)'
          }}>
            {cluster.count > 99 ? '99+' : cluster.count}
          </div>
        )}

        {/* Pin stem with Story 8.0 styling */}
        <div className={`
          absolute top-6 left-1/2 w-0.5 h-2 transform -translate-x-1/2
          ${isSingle ? 'bg-primary-500' : 'bg-orange-500'}
          md:top-8 md:h-3
        `} />

      </button>
    );
  }
);

MapMarker.displayName = 'MapMarker';