'use client';

import { useState, useEffect, useMemo } from 'react';
import { Map, Marker } from 'react-map-gl/mapbox';
import { MapPin } from 'lucide-react';
import '@/styles/map-mobile.css';
import { useGenericMapClustering, MapCluster } from '@/hooks/useMapClustering';
import { useMapCache } from '@/hooks/useMapCache';
import { MapMarker } from '@/components/map/MapMarker';
import { MapLoadingSkeleton } from '@/components/map/MapLoadingSkeleton';
import { MultiAgencyClusterPopup } from '@/components/map/MultiAgencyClusterPopup';

export interface AgencyMapData {
  id: string;
  name: string;
  classification?: 'Commercial' | 'Residential' | 'Both';
  geographic_patch?: string;
  logo_url?: string;
  office_coordinates?: {
    lat: number;
    lng: number;
  };
  office_address?: string;
}

interface AgencyMapProps {
  search?: string;
  classification?: string;
  onAgencyClick: (agencyId: string) => void;
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

export function AgencyMap({ search, classification, onAgencyClick }: AgencyMapProps) {
  const [viewState, setViewState] = useState<MapViewState>(DEFAULT_VIEW_STATE);
  const [agencies, setAgencies] = useState<AgencyMapData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCluster, setSelectedCluster] = useState<MapCluster<AgencyMapData> | null>(null);
  const [popupCoordinates, setPopupCoordinates] = useState<{ lat: number; lng: number } | null>(null);

  // Create cache key from filters
  const cacheKey = useMemo(() => {
    const filters = { search: search || '', classification: classification || 'all' };
    return JSON.stringify(filters);
  }, [search, classification]);

  // Use map cache
  const mapCache = useMapCache();

  // Filter agencies by map bounds for clustering
  const visibleAgencies = useMemo(() => {
    if (!agencies) return [];
    
    const bounds = calculateBounds(viewState);
    return agencies.filter(agency => {
      if (!agency.office_coordinates) return false;
      const { lat, lng } = agency.office_coordinates;
      return lat >= bounds.south && lat <= bounds.north && lng >= bounds.west && lng <= bounds.east;
    });
  }, [agencies, viewState]);

  // Use clustering hook
  const clusters = useGenericMapClustering(visibleAgencies, viewState.zoom, {
    getCoordinates: (agency: AgencyMapData) => agency.office_coordinates ? [agency.office_coordinates.lng, agency.office_coordinates.lat] : null,
    maxZoom: 12,
    clusterRadius: 50
  });

  // Fetch agencies when filters change
  useEffect(() => {
    async function fetchAgencies() {
      try {
        setLoading(true);
        
        // Check cache first
        const bounds = calculateBounds(viewState);
        const cacheKey = `agencies-${search || ''}-${classification || ''}-${JSON.stringify(bounds)}`;
        const cachedData = mapCache.getCachedData(cacheKey);
        
        if (cachedData && cachedData.length > 0) {
          setAgencies(cachedData as unknown as AgencyMapData[]);
          setLoading(false);
          return;
        }

        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (classification && classification !== 'all') params.set('classification', classification);
        
        const response = await fetch(`/api/agencies/map?${params.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch agencies');
        
        const result = await response.json();
        const agencyData = result.data || [];
        
        setAgencies(agencyData);
        mapCache.setCachedData(cacheKey, agencyData as any, bounds);
      } catch (error) {
        console.error('Error fetching agencies:', error);
        setAgencies([]);
      } finally {
        setLoading(false);
      }
    }

    fetchAgencies();
  }, [search, classification]);

  // Handle cluster click
  const handleClusterClick = (cluster: MapCluster<AgencyMapData>, coordinates: { lat: number; lng: number }) => {
    if (cluster.agencies && cluster.agencies.length === 1) {
      // Single agency - open modal directly
      onAgencyClick(cluster.agencies[0].id);
    } else if (cluster.agencies && cluster.agencies.length > 1) {
      // Multiple agencies - show popup
      setSelectedCluster(cluster);
      setPopupCoordinates(coordinates);
    }
  };

  // Handle agency selection from popup
  const handleAgencySelect = (agencyId: string) => {
    setSelectedCluster(null);
    setPopupCoordinates(null);
    onAgencyClick(agencyId);
  };

  // Show loading skeleton while fetching data
  if (loading) {
    return <MapLoadingSkeleton />;
  }

  // Show error state if no token
  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-100">
        <div className="text-center">
          <MapPin className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600">Map unavailable</p>
          <p className="text-sm text-slate-500">Mapbox configuration required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <Map
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/light-v11"
        attributionControl={false}
        onClick={() => {
          setSelectedCluster(null);
          setPopupCoordinates(null);
        }}
      >
        {/* Render clusters and individual agencies */}
        {clusters.map((cluster) => {
          const { lng, lat } = cluster.coordinates;
          
          if (cluster.agencies && cluster.agencies.length === 1) {
            // Single agency marker
            const agency = cluster.agencies[0];
            return (
              <Marker
                key={agency.id}
                longitude={lng}
                latitude={lat}
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  onAgencyClick(agency.id);
                }}
              >
                <MapMarker
                  type="agency"
                  count={1}
                  isSelected={false}
                  agency={agency}
                />
              </Marker>
            );
          } else if (cluster.agencies && cluster.agencies.length > 1) {
            // Cluster marker
            return (
              <Marker
                key={`cluster-${cluster.id}`}
                longitude={lng}
                latitude={lat}
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  handleClusterClick(cluster, { lat, lng });
                }}
              >
                <MapMarker
                  type="agency-cluster"
                  count={cluster.agencies.length}
                  isSelected={selectedCluster?.id === cluster.id}
                />
              </Marker>
            );
          }
          return null;
        })}
        
        {/* Multi-agency popup */}
        {selectedCluster && popupCoordinates && (
          <MultiAgencyClusterPopup
            cluster={selectedCluster}
            coordinates={popupCoordinates}
            onAgencyClick={handleAgencySelect}
            onClose={() => {
              setSelectedCluster(null);
              setPopupCoordinates(null);
            }}
          />
        )}
      </Map>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
            <span className="text-slate-600 font-medium">Loading agencies...</span>
          </div>
        </div>
      )}
    </div>
  );
}