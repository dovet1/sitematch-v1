'use client';

import { useState, useEffect, useMemo } from 'react';
import { Map, Marker } from 'react-map-gl/mapbox';
import { MapPin } from 'lucide-react';
import '@/styles/map-mobile.css';
import { SearchFilters, SearchResult } from '@/types/search';
import { useMapClustering, MapCluster } from '@/hooks/useMapClustering';
import { useMapCache } from '@/hooks/useMapCache';
import { MapMarker } from '@/components/map/MapMarker';
import { MapLoadingSkeleton } from '@/components/map/MapLoadingSkeleton';
import { MultiListingClusterPopup } from '@/components/map/MultiListingClusterPopup';

interface ListingMapProps {
  filters: SearchFilters;
  onListingClick: (listingId: string) => void;
}

interface MapViewState {
  longitude: number;
  latitude: number;
  zoom: number;
}

// Default view showing whole UK
const DEFAULT_VIEW_STATE: MapViewState = {
  longitude: -3.5,
  latitude: 54.8,
  zoom: 4.8  // Slightly zoomed out to ensure all pins are visible
};

// Mapbox token must be provided via environment variables
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Helper function to calculate map bounds from current view state with buffer
function calculateBounds(viewState: MapViewState, bufferPercent: number = 0.2) {
  // Calculate bounds with buffer to preload nearby areas for smooth panning
  const latDelta = (180 / Math.pow(2, viewState.zoom + 1)) * (1 + bufferPercent);
  const lngDelta = (360 / Math.pow(2, viewState.zoom + 1)) * (1 + bufferPercent);
  
  return {
    north: Math.min(85, viewState.latitude + latDelta),    // Cap at max lat
    south: Math.max(-85, viewState.latitude - latDelta),   // Cap at min lat
    east: viewState.longitude + lngDelta,
    west: viewState.longitude - lngDelta
  };
}

// Helper to determine if we should fetch new data based on zoom change
function shouldRefreshData(oldZoom: number, newZoom: number): boolean {
  const zoomDiff = Math.abs(newZoom - oldZoom);
  
  // Refresh on significant zoom changes or crossing clustering thresholds
  if (zoomDiff > 1) return true;
  
  // Refresh when crossing clustering boundaries for better UX
  const clusteringBoundaries = [6, 10, 13, 16];
  const oldBoundary = clusteringBoundaries.find(b => oldZoom < b);
  const newBoundary = clusteringBoundaries.find(b => newZoom < b);
  
  return oldBoundary !== newBoundary;
}

export function ListingMap({ filters, onListingClick }: ListingMapProps) {
  const [viewState, setViewState] = useState<MapViewState>(DEFAULT_VIEW_STATE);
  const [listings, setListings] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<MapCluster | null>(null);
  const [clusterPopupPosition, setClusterPopupPosition] = useState({ x: 0, y: 0 });
  const [lastFetchedZoom, setLastFetchedZoom] = useState<number>(DEFAULT_VIEW_STATE.zoom);

  // Filter listings that have coordinates
  const mappableListings = useMemo(() => 
    listings.filter(listing => listing.coordinates?.lat && listing.coordinates?.lng),
    [listings]
  );

  // Initialize cache
  const mapCache = useMapCache();

  // Create clusters based on current zoom level - increased clustering
  const clusters = useMapClustering(mappableListings, viewState.zoom, {
    enabled: true,
    minZoom: 8,   // Start clustering at lower zoom level
    maxDistance: 100,  // Increased distance for more aggressive clustering
    maxZoom: 18,  // Continue clustering to very high zoom levels
    clusterRadius: 80  // Larger radius to group more pins together
  });


  // Track the current location to detect changes
  const [currentLocationKey, setCurrentLocationKey] = useState<string>('');
  
  // Navigate map when location coordinates change
  useEffect(() => {
    const locationKey = filters.coordinates 
      ? `${filters.coordinates.lat},${filters.coordinates.lng}`
      : filters.isNationwide ? 'nationwide' : '';
    
    // Only update if location has actually changed
    if (locationKey !== currentLocationKey) {
      setCurrentLocationKey(locationKey);
      
      if (filters.coordinates) {
        const newViewState = {
          longitude: filters.coordinates.lng,
          latitude: filters.coordinates.lat,
          zoom: 10 // Set a reasonable zoom level for location search
        };
        setViewState(newViewState);
      } else if (filters.isNationwide) {
        // Reset to default UK view for nationwide search
        setViewState(DEFAULT_VIEW_STATE);
      }
    }
  }, [filters.coordinates, filters.isNationwide, currentLocationKey]);

  // Fetch listings data with smart refresh logic
  useEffect(() => {
    // Skip fetch if only minor zoom changes that don't affect clustering
    const shouldSkipFetch = !shouldRefreshData(lastFetchedZoom, viewState.zoom) && 
                           !isInitialLoad && 
                           Math.abs(viewState.zoom - lastFetchedZoom) < 0.8;
    
    if (shouldSkipFetch) {
      return;
    }
    
    const fetchListings = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Add map bounds for optimized querying
        const bounds = calculateBounds(viewState);
        
        // Check cache first
        const cacheKey = mapCache.generateCacheKey(filters, bounds);
        const cachedData = mapCache.getCachedData(cacheKey);
        
        if (cachedData) {
          setListings(cachedData);
          setIsLoading(false);
          setIsInitialLoad(false);
          return;
        }

        const params = new URLSearchParams();
        params.set('north', bounds.north.toString());
        params.set('south', bounds.south.toString());
        params.set('east', bounds.east.toString());
        params.set('west', bounds.west.toString());
        params.set('zoom', viewState.zoom.toString());
        
        // Add search filters
        if (filters.location) params.set('location', filters.location);
        if (filters.companyName) params.set('companyName', filters.companyName);
        if (filters.sector.length > 0) params.set('sector', filters.sector.join(','));
        if (filters.useClass.length > 0) params.set('useClass', filters.useClass.join(','));
        if (filters.listingType.length > 0) params.set('listingType', filters.listingType.join(','));
        if (filters.sizeMin) params.set('sizeMin', filters.sizeMin.toString());
        if (filters.sizeMax) params.set('sizeMax', filters.sizeMax.toString());
        if (filters.isNationwide) params.set('isNationwide', 'true');

        const response = await fetch(`/api/public/listings/map?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch map listings');
        }

        const data = await response.json();
        const results = data.listings || data.results || []; // Support both new and old API response format
        
        // Implement hierarchical loading - limit data based on zoom level for performance
        let filteredResults = results;
        if (viewState.zoom < 8) {
          // At country level, show only major listings (simplified dataset)
          filteredResults = results.filter((_: any, index: number) => index % 3 === 0); // Every 3rd listing
        } else if (viewState.zoom < 10) {
          // At regional level, show 70% of listings
          filteredResults = results.filter((_: any, index: number) => index % 3 !== 2); // Skip every 3rd
        }
        // At city level (zoom >= 10), show all listings
        
        setListings(filteredResults);
        setLastFetchedZoom(viewState.zoom); // Track the zoom level we fetched at
        
        // Cache the results
        mapCache.setCachedData(cacheKey, results, bounds);
      } catch (err) {
        console.error('Error fetching map listings:', err);
        setError('Failed to load map data');
        
        // Fallback to mock data for development
        const mockListings: SearchResult[] = [
          {
            id: '1',
            company_name: 'Acme Corp',
            title: 'London Office Space Required',
            description: 'Seeking modern office space in Central London',
            site_size_min: 5000,
            site_size_max: 10000,
            sectors: [{ id: '1', name: 'Technology' }],
            use_classes: [{ id: '1', name: 'Office', code: 'B1' }],
            sector: 'Technology',
            use_class: 'Office',
            contact_name: 'John Smith',
            contact_title: 'Property Manager',
            contact_email: 'john@acme.com',
            contact_phone: '020 1234 5678',
            is_nationwide: false,
            logo_url: null,
            clearbit_logo: false,
            company_domain: null,
            locations: [{
              id: '1',
              place_name: 'London, UK',
              coordinates: { lat: 51.5074, lng: -0.1278 }
            }],
            place_name: 'London, UK',
            coordinates: { lat: 51.5074, lng: -0.1278 },
            created_at: new Date().toISOString()
          },
          {
            id: '2',
            company_name: 'TechStart Ltd',
            title: 'Manchester Tech Hub',
            description: 'Looking for flexible workspace in Manchester',
            site_size_min: 2000,
            site_size_max: 5000,
            sectors: [{ id: '1', name: 'Technology' }],
            use_classes: [{ id: '1', name: 'Office', code: 'B1' }],
            sector: 'Technology',
            use_class: 'Office',
            contact_name: 'Sarah Wilson',
            contact_title: 'CEO',
            contact_email: 'sarah@techstart.com',
            contact_phone: '0161 234 5678',
            is_nationwide: false,
            logo_url: null,
            clearbit_logo: false,
            company_domain: null,
            locations: [{
              id: '2',
              place_name: 'Manchester, UK',
              coordinates: { lat: 53.4808, lng: -2.2426 }
            }],
            place_name: 'Manchester, UK',
            coordinates: { lat: 53.4808, lng: -2.2426 },
            created_at: new Date().toISOString()
          }
        ];
        setListings(mockListings);
      } finally {
        setIsLoading(false);
        setIsInitialLoad(false);
      }
    };

    // Debounce the fetch to avoid too many requests while panning/zooming
    const timeoutId = setTimeout(fetchListings, 800);
    return () => clearTimeout(timeoutId);
  }, [filters, viewState.latitude, viewState.longitude, viewState.zoom]);

  const handleClusterClick = (cluster: MapCluster, event: React.MouseEvent) => {
    // If it's a single listing, directly open the listing details
    if (cluster.type === 'single' && cluster.listings && cluster.listings.length === 1) {
      onListingClick(cluster.listings![0].id);
    } else {
      // For multiple listings, show the cluster popup
      const markerRect = event.currentTarget.getBoundingClientRect();
      
      // Calculate position relative to viewport
      const x = markerRect.left + markerRect.width / 2;
      const y = markerRect.top;
      
      setClusterPopupPosition({ x, y });
      setSelectedCluster(cluster);
    }
  };

  const handleClusterPopupClose = () => {
    setSelectedCluster(null);
  };




  // Check for missing Mapbox token
  if (!MAPBOX_TOKEN) {
    return <MapLoadingSkeleton message="Map unavailable - Mapbox token not configured" />;
  }

  // Show skeleton on initial load
  if (isInitialLoad && isLoading) {
    return <MapLoadingSkeleton message="Loading map..." />;
  }

  if (error && listings.length === 0 && !isLoading) {
    return <MapLoadingSkeleton message="Map unavailable - using demo data" />;
  }

  return (
    <div className="map-wrapper relative h-full">
      <div className="map-container relative h-[calc(100vh-120px)] md:h-[calc(100vh-100px)] w-full md:rounded-lg overflow-hidden md:border md:border-border" style={{ zIndex: 1 }}>
      {isLoading && !isInitialLoad && (
        <div className="absolute top-4 right-4 z-50">
          <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-border rounded-lg px-3 py-2 shadow-lg">
            <div className="animate-spin w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full" />
            <span className="text-xs text-muted-foreground">Updating...</span>
          </div>
        </div>
      )}

      <Map
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{width: '100%', height: '100%'}}
        mapStyle="mapbox://styles/mapbox/light-v11"
        attributionControl={false}
      >

        {/* Enhanced Clustered Markers */}
        {clusters.map((cluster) => (
          <Marker
            key={cluster.id}
            longitude={cluster.coordinates.lng}
            latitude={cluster.coordinates.lat}
            anchor="bottom"
          >
            <MapMarker
              type={cluster.type === 'single' ? 'listing' : 'listing-cluster'}
              count={cluster.count}
              isSelected={selectedCluster?.id === cluster.id}
              cluster={cluster}
              onClick={(event) => handleClusterClick(cluster, event)}
            />
          </Marker>
        ))}

      </Map>


      {/* Multi-listing cluster popup */}
      {selectedCluster && (
        <MultiListingClusterPopup
          listings={selectedCluster.listings || []}
          isOpen={true}
          onClose={handleClusterPopupClose}
          onListingClick={onListingClick}
          position={clusterPopupPosition}
        />
      )}
    </div>
    </div>
  );
}