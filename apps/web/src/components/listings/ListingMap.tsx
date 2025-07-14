'use client';

import { useState, useEffect, useMemo } from 'react';
import Map, { Marker, Popup } from 'react-map-gl/mapbox';
import { MapPin } from 'lucide-react';
import '@/styles/map-mobile.css';
import { SearchFilters, SearchResult } from '@/types/search';
import { useMapClustering, MapCluster } from '@/hooks/useMapClustering';
import { useMapCache } from '@/hooks/useMapCache';
import { MapMarker } from '@/components/map/MapMarker';
import { MultiListingPopup } from '@/components/map/MultiListingPopup';
import { SearchLocationMarker } from '@/components/map/SearchLocationMarker';
import { MapLoadingSkeleton } from '@/components/map/MapLoadingSkeleton';

interface ListingMapProps {
  filters: SearchFilters;
  onListingClick: (listingId: string) => void;
}

interface MapViewState {
  longitude: number;
  latitude: number;
  zoom: number;
}

// Default view centered on UK
const DEFAULT_VIEW_STATE: MapViewState = {
  longitude: -2.0,
  latitude: 54.5,
  zoom: 5.5
};

// Mapbox token must be provided via environment variables
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Helper function to calculate map bounds from current view state
function calculateBounds(viewState: MapViewState) {
  // Calculate approximate bounds based on zoom level and center point
  // This is a simplified calculation - in production you'd use map.getBounds()
  const latDelta = 180 / Math.pow(2, viewState.zoom + 1);
  const lngDelta = 360 / Math.pow(2, viewState.zoom + 1);
  
  return {
    north: viewState.latitude + latDelta,
    south: viewState.latitude - latDelta,
    east: viewState.longitude + lngDelta,
    west: viewState.longitude - lngDelta
  };
}

export function ListingMap({ filters, onListingClick }: ListingMapProps) {
  const [viewState, setViewState] = useState<MapViewState>(DEFAULT_VIEW_STATE);
  const [listings, setListings] = useState<SearchResult[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<MapCluster | null>(null);
  const [hoveredCluster, setHoveredCluster] = useState<MapCluster | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter listings that have coordinates
  const mappableListings = useMemo(() => 
    listings.filter(listing => listing.coordinates?.lat && listing.coordinates?.lng),
    [listings]
  );

  // Initialize cache
  const mapCache = useMapCache();

  // Create clusters based on current zoom level
  const clusters = useMapClustering(mappableListings, viewState.zoom, {
    enabled: true,
    minZoom: 12,
    maxDistance: 60
  });

  // Navigate map when location coordinates change
  useEffect(() => {
    if (filters.coordinates) {
      const newViewState = {
        longitude: filters.coordinates.lng,
        latitude: filters.coordinates.lat,
        zoom: Math.max(viewState.zoom, 10) // Ensure reasonable zoom level for location search
      };
      setViewState(newViewState);
    }
  }, [filters.coordinates]);

  // Fetch listings data
  useEffect(() => {
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
        if (filters.sizeMin) params.set('sizeMin', filters.sizeMin.toString());
        if (filters.sizeMax) params.set('sizeMax', filters.sizeMax.toString());
        if (filters.isNationwide) params.set('isNationwide', 'true');

        const response = await fetch(`/api/public/listings/map?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch map listings');
        }

        const data = await response.json();
        const results = data.results || [];
        setListings(results);
        
        // Cache the results
        mapCache.setCachedData(cacheKey, results, bounds);

        // Adjust view if we have listings with coordinates
        const coordListings = data.results?.filter((l: SearchResult) => l.coordinates) || [];
        if (coordListings.length > 0) {
          // Calculate bounds to fit all listings
          const lats = coordListings.map((l: SearchResult) => l.coordinates!.lat);
          const lngs = coordListings.map((l: SearchResult) => l.coordinates!.lng);
          
          const minLat = Math.min(...lats);
          const maxLat = Math.max(...lats);
          const minLng = Math.min(...lngs);
          const maxLng = Math.max(...lngs);
          
          const centerLat = (minLat + maxLat) / 2;
          const centerLng = (minLng + maxLng) / 2;
          
          // Calculate zoom level based on bounds
          const latDiff = maxLat - minLat;
          const lngDiff = maxLng - minLng;
          const maxDiff = Math.max(latDiff, lngDiff);
          
          let zoom = 10;
          if (maxDiff > 10) zoom = 5;
          else if (maxDiff > 5) zoom = 6;
          else if (maxDiff > 2) zoom = 7;
          else if (maxDiff > 1) zoom = 8;
          else if (maxDiff > 0.5) zoom = 9;
          
          setViewState({
            longitude: centerLng,
            latitude: centerLat,
            zoom
          });
        }
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
    const timeoutId = setTimeout(fetchListings, 300);
    return () => clearTimeout(timeoutId);
  }, [filters, viewState.latitude, viewState.longitude, viewState.zoom]);

  const handleClusterClick = (cluster: MapCluster) => {
    setSelectedCluster(cluster);
  };

  const handleListingClick = (listingId: string) => {
    setSelectedCluster(null);
    onListingClick(listingId);
  };

  const handleClusterHover = (cluster: MapCluster | null) => {
    setHoveredCluster(cluster);
  };

  const formatSizeRange = (min: number | null, max: number | null) => {
    if (!min && !max) return 'Size not specified';
    if (min && max) return `${min.toLocaleString()} - ${max.toLocaleString()} sq ft`;
    if (min) return `From ${min.toLocaleString()} sq ft`;
    if (max) return `Up to ${max.toLocaleString()} sq ft`;
    return '';
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
    <div className="map-wrapper relative">
      <div className="map-container relative h-96 w-full rounded-lg overflow-hidden border border-border">
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
        {/* Search Location Marker */}
        {filters.coordinates && filters.location && (
          <Marker
            longitude={filters.coordinates.lng}
            latitude={filters.coordinates.lat}
            anchor="bottom"
          >
            <SearchLocationMarker
              coordinates={filters.coordinates}
              locationName={filters.location}
            />
          </Marker>
        )}

        {/* Enhanced Clustered Markers */}
        {clusters.map((cluster) => (
          <Marker
            key={cluster.id}
            longitude={cluster.coordinates.lng}
            latitude={cluster.coordinates.lat}
            anchor="bottom"
          >
            <MapMarker
              cluster={cluster}
              isSelected={selectedCluster?.id === cluster.id}
              isHovered={hoveredCluster?.id === cluster.id}
              onClick={() => handleClusterClick(cluster)}
              onMouseEnter={() => handleClusterHover(cluster)}
              onMouseLeave={() => handleClusterHover(null)}
            />
          </Marker>
        ))}

        {/* Enhanced Multi-Listing Popup */}
        {selectedCluster && (
          <Popup
            longitude={selectedCluster.coordinates.lng}
            latitude={selectedCluster.coordinates.lat}
            anchor="bottom"
            onClose={() => setSelectedCluster(null)}
            closeOnClick={false}
            className="[&_.mapboxgl-popup-content]:p-0 [&_.mapboxgl-popup-content]:rounded-lg [&_.mapboxgl-popup-content]:shadow-lg"
            offset={{
              'bottom': [0, -40],
              'top': [0, 40],
              'left': [40, 0],
              'right': [-40, 0],
              'bottom-left': [20, -20],
              'bottom-right': [-20, -20],
              'top-left': [20, 20],
              'top-right': [-20, 20]
            }}
            maxWidth="none"
          >
            <MultiListingPopup
              cluster={selectedCluster}
              onListingClick={handleListingClick}
              onClose={() => setSelectedCluster(null)}
            />
          </Popup>
        )}
      </Map>

      {/* Map Stats */}
      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm border border-border rounded-lg px-3 py-2 text-sm">
        <span className="text-muted-foreground">
          {mappableListings.length} listing{mappableListings.length !== 1 ? 's' : ''} shown
          {clusters.length !== mappableListings.length && (
            <span className="ml-2 text-xs">
              ({clusters.length} marker{clusters.length !== 1 ? 's' : ''})
            </span>
          )}
        </span>
      </div>
    </div>
    </div>
  );
}