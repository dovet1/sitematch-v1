import { useMemo } from 'react';
import { SearchResult } from '@/types/search';

export interface MapCluster {
  id: string;
  type: 'single' | 'cluster';
  coordinates: { lat: number; lng: number };
  count: number;
  listings: SearchResult[];
}

interface ClusteringOptions {
  enabled: boolean;
  minZoom: number;
  maxDistance: number; // in pixels at zoom level 14
}

const DEFAULT_OPTIONS: ClusteringOptions = {
  enabled: true,
  minZoom: 10,
  maxDistance: 50
};

export function useMapClustering(
  listings: SearchResult[],
  zoom: number,
  options: Partial<ClusteringOptions> = {}
): MapCluster[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return useMemo(() => {
    // Filter listings with valid coordinates
    const validListings = listings.filter(
      listing => listing.coordinates?.lat && listing.coordinates?.lng
    );

    // If clustering is disabled or there's only one listing, return individual markers
    if (!opts.enabled || validListings.length <= 1) {
      return validListings.map(listing => ({
        id: `${listing.id}-${(listing as any).location_id || 'default'}`,
        type: 'single' as const,
        coordinates: listing.coordinates!,
        count: 1,
        listings: [listing]
      }));
    }
    
    // If zoom is too high, still cluster exact location matches
    const shouldClusterOnlyExactMatches = zoom >= opts.minZoom;

    // Group listings by proximity
    const clusters: MapCluster[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < validListings.length; i++) {
      const listing = validListings[i];
      const uniqueKey = `${listing.id}-${(listing as any).location_id || 'default'}`;
      
      if (processed.has(uniqueKey)) continue;

      // Find nearby listings
      const nearby = validListings.filter((other, j) => {
        if (i === j) return false;
        
        const otherKey = `${other.id}-${(other as any).location_id || 'default'}`;
        if (processed.has(otherKey)) return false;
        
        const distance = calculateDistance(
          listing.coordinates!,
          other.coordinates!
        );
        
        // If zoom is high, only cluster exact location matches (very small threshold for floating point precision)
        if (shouldClusterOnlyExactMatches) {
          return distance < 0.1; // Less than 0.1 meters = essentially same location
        }
        
        // Adjust distance threshold based on zoom level for proximity clustering
        const threshold = opts.maxDistance * Math.pow(2, (14 - zoom));
        return distance <= threshold;
      });

      if (nearby.length > 0) {
        // Create cluster
        const clusterListings = [listing, ...nearby];
        const center = calculateCenterPoint(clusterListings);
        
        // Get unique listing IDs for cluster naming
        const uniqueListingIds = Array.from(new Set(clusterListings.map(l => l.id)));
        
        clusters.push({
          id: `cluster-${uniqueListingIds.join('-')}-${i}`,
          type: 'cluster',
          coordinates: center,
          count: clusterListings.length,
          listings: clusterListings
        });

        // Mark all listings as processed
        processed.add(uniqueKey);
        nearby.forEach(l => processed.add(`${l.id}-${(l as any).location_id || 'default'}`));
      } else {
        // Single listing
        clusters.push({
          id: uniqueKey,
          type: 'single',
          coordinates: listing.coordinates!,
          count: 1,
          listings: [listing]
        });
        processed.add(uniqueKey);
      }
    }

    return clusters;
  }, [listings, zoom, opts.enabled, opts.minZoom, opts.maxDistance]);
}

function calculateDistance(
  point1: { lat: number; lng: number },
  point2: { lat: number; lng: number }
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = point1.lat * Math.PI / 180;
  const φ2 = point2.lat * Math.PI / 180;
  const Δφ = (point2.lat - point1.lat) * Math.PI / 180;
  const Δλ = (point2.lng - point1.lng) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function calculateCenterPoint(listings: SearchResult[]): { lat: number; lng: number } {
  const totalLat = listings.reduce((sum, l) => sum + l.coordinates!.lat, 0);
  const totalLng = listings.reduce((sum, l) => sum + l.coordinates!.lng, 0);
  
  return {
    lat: totalLat / listings.length,
    lng: totalLng / listings.length
  };
}