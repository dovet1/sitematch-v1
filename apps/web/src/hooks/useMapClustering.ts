import { useMemo } from 'react';
import { SearchResult } from '@/types/search';

export interface MapCluster<T = SearchResult> {
  id: string;
  type: 'single' | 'cluster';
  coordinates: { lat: number; lng: number };
  count: number;
  listings?: SearchResult[];  // Keep for backward compatibility
  agencies?: T[];  // Generic items when T is not SearchResult
  items: T[];  // Generic items
}

interface ClusteringOptions<T = SearchResult> {
  enabled?: boolean;
  minZoom?: number;
  maxDistance?: number; // in pixels at zoom level 14
  getCoordinates?: (item: T) => [number, number] | null;
  maxZoom?: number;
  clusterRadius?: number;
}

const DEFAULT_OPTIONS: Required<ClusteringOptions<any>> = {
  enabled: true,
  minZoom: 10,
  maxDistance: 50,
  getCoordinates: (item: any) => 
    item.coordinates?.lat && item.coordinates?.lng 
      ? [item.coordinates.lng, item.coordinates.lat] 
      : null,
  maxZoom: 12,
  clusterRadius: 50
};

// Backward compatible function for listings
export function useMapClustering(
  listings: SearchResult[],
  zoom: number,
  options: Partial<ClusteringOptions> = {}
): MapCluster<SearchResult>[] {
  return useGenericMapClustering(listings, zoom, options);
}

// Generic clustering function
export function useGenericMapClustering<T>(
  items: T[],
  zoom: number,
  options: Partial<ClusteringOptions<T>> = {}
): MapCluster<T>[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  return useMemo(() => {
    // Filter items with valid coordinates
    const validItems = items.filter(item => {
      const coords = opts.getCoordinates!(item);
      return coords !== null;
    });

    // If clustering is disabled or there's only one item, return individual markers
    if (!opts.enabled || validItems.length <= 1) {
      return validItems.map(item => {
        const coords = opts.getCoordinates!(item)!;
        return {
          id: `${(item as any).id}-${(item as any).location_id || 'default'}`,
          type: 'single' as const,
          coordinates: { lng: coords[0], lat: coords[1] },
          count: 1,
          items: [item],
          // Backward compatibility
          listings: Array.isArray((item as any).listings) ? (item as any).listings : [item as any],
          agencies: [item]
        };
      });
    }
    
    // If zoom is too high, still cluster exact location matches
    const shouldClusterOnlyExactMatches = zoom >= opts.minZoom;

    // Group items by proximity
    const clusters: MapCluster<T>[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < validItems.length; i++) {
      const item = validItems[i];
      const uniqueKey = `${(item as any).id}-${(item as any).location_id || 'default'}`;
      
      if (processed.has(uniqueKey)) continue;

      const itemCoords = opts.getCoordinates!(item)!;

      // Find nearby items
      const nearby = validItems.filter((other, j) => {
        if (i === j) return false;
        
        const otherKey = `${(other as any).id}-${(other as any).location_id || 'default'}`;
        if (processed.has(otherKey)) return false;
        
        const otherCoords = opts.getCoordinates!(other)!;
        const distance = calculateDistance(
          { lat: itemCoords[1], lng: itemCoords[0] },
          { lat: otherCoords[1], lng: otherCoords[0] }
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
        const clusterItems = [item, ...nearby];
        const center = calculateGenericCenterPoint(clusterItems, opts.getCoordinates!);
        
        // Get unique item IDs for cluster naming
        const uniqueItemIds = Array.from(new Set(clusterItems.map(i => (i as any).id)));
        
        clusters.push({
          id: `cluster-${uniqueItemIds.join('-')}-${i}`,
          type: 'cluster',
          coordinates: center,
          count: clusterItems.length,
          items: clusterItems,
          // Backward compatibility
          listings: Array.isArray((clusterItems[0] as any).listings) ? clusterItems as any : clusterItems as any,
          agencies: clusterItems
        });

        // Mark all items as processed
        processed.add(uniqueKey);
        nearby.forEach(i => processed.add(`${(i as any).id}-${(i as any).location_id || 'default'}`));
      } else {
        // Single item
        const coords = opts.getCoordinates!(item)!;
        clusters.push({
          id: uniqueKey,
          type: 'single',
          coordinates: { lat: coords[1], lng: coords[0] },
          count: 1,
          items: [item],
          // Backward compatibility
          listings: Array.isArray((item as any).listings) ? [(item as any)] : [item as any],
          agencies: [item]
        });
        processed.add(uniqueKey);
      }
    }

    return clusters;
  }, [items, zoom, opts.enabled, opts.minZoom, opts.maxDistance]);
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

function calculateGenericCenterPoint<T>(
  items: T[], 
  getCoordinates: (item: T) => [number, number] | null
): { lat: number; lng: number } {
  let totalLat = 0;
  let totalLng = 0;
  let count = 0;
  
  items.forEach(item => {
    const coords = getCoordinates(item);
    if (coords) {
      totalLng += coords[0];
      totalLat += coords[1];
      count++;
    }
  });
  
  return {
    lat: totalLat / count,
    lng: totalLng / count
  };
}