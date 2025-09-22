'use client';

import { useState, useEffect } from 'react';
import { Map, Source, Layer } from 'react-map-gl/mapbox';
import '@/styles/map-mobile.css';
import { SearchFilters } from '@/types/search';
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

// Default view showing whole UK
const DEFAULT_VIEW_STATE: MapViewState = {
  longitude: -3.5,
  latitude: 54.8,
  zoom: 4.8
};

// Mapbox token
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Calculate map bounds for API requests
function calculateBounds(viewState: MapViewState, bufferPercent: number = 0.2) {
  const latDelta = (180 / Math.pow(2, viewState.zoom + 1)) * (1 + bufferPercent);
  const lngDelta = (360 / Math.pow(2, viewState.zoom + 1)) * (1 + bufferPercent);

  return {
    north: Math.min(85, viewState.latitude + latDelta),
    south: Math.max(-85, viewState.latitude - latDelta),
    east: viewState.longitude + lngDelta,
    west: viewState.longitude - lngDelta
  };
}

export function ListingMap({ filters, onListingClick }: ListingMapProps) {
  const [viewState, setViewState] = useState<MapViewState>(DEFAULT_VIEW_STATE);
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Navigate map when location coordinates change
  useEffect(() => {
    if (filters.coordinates) {
      setViewState({
        longitude: filters.coordinates.lng,
        latitude: filters.coordinates.lat,
        zoom: 10
      });
    } else if (filters.isNationwide) {
      setViewState(DEFAULT_VIEW_STATE);
    }
  }, [filters.coordinates, filters.isNationwide]);

  // Fetch GeoJSON data only once or when filters change - NO zoom dependency
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Use wide bounds to get all data in region, let Mapbox handle clustering
        const bounds = calculateBounds(DEFAULT_VIEW_STATE, 2.0); // Large buffer to get all UK data
        const params = new URLSearchParams();

        // Add wide bounds for comprehensive data
        params.set('north', bounds.north.toString());
        params.set('south', bounds.south.toString());
        params.set('east', bounds.east.toString());
        params.set('west', bounds.west.toString());

        // Add filters only - NO zoom parameter
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
          throw new Error('Failed to fetch map data');
        }

        const data = await response.json();
        setGeoJsonData(data.geojson);

        console.log(`[DEBUG] Loaded ${data.total} listings for map clustering`);
      } catch (err) {
        console.error('Error fetching map data:', err);
        setError('Failed to load map data');
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchData, 300);
    return () => clearTimeout(timeoutId);
  }, [filters]); // ONLY filters dependency - no viewState

  // Handle map clicks
  const handleMapClick = (event: any) => {
    const features = event.features;
    if (!features || features.length === 0) return;

    const feature = features[0];

    if (feature.layer.id === 'clusters') {
      // Clicked on a cluster - zoom in
      const clusterId = feature.properties.cluster_id;
      // In a real implementation, you'd get the cluster expansion zoom
      // For now, just zoom in by 2 levels
      setViewState(prev => ({
        ...prev,
        longitude: feature.geometry.coordinates[0],
        latitude: feature.geometry.coordinates[1],
        zoom: Math.min(prev.zoom + 2, 20)
      }));
    } else if (feature.layer.id === 'unclustered-point') {
      // Clicked on individual point - open listing modal
      const listingId = feature.properties.id;
      onListingClick(listingId);
    }
  };


  // Check for missing Mapbox token
  if (!MAPBOX_TOKEN) {
    return <MapLoadingSkeleton message="Map unavailable - Mapbox token not configured" />;
  }

  // Show loading state
  if (isLoading) {
    return <MapLoadingSkeleton message="Loading map..." />;
  }

  if (error) {
    return <MapLoadingSkeleton message="Map unavailable" />;
  }

  // Mapbox clustering layer styles
  const clusterLayer: any = {
    id: 'clusters',
    type: 'circle',
    source: 'listings',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': [
        'step',
        ['get', 'point_count'],
        '#51bbd6', // Color for clusters with < 100 points
        100,
        '#f1f075', // Color for clusters with 100-750 points
        750,
        '#f28cb1'  // Color for clusters with > 750 points
      ],
      'circle-radius': [
        'step',
        ['get', 'point_count'],
        20, // Radius for clusters with < 100 points
        100,
        30, // Radius for clusters with 100-750 points
        750,
        40  // Radius for clusters with > 750 points
      ]
    }
  };

  const clusterCountLayer: any = {
    id: 'cluster-count',
    type: 'symbol',
    source: 'listings',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': '{point_count_abbreviated}',
      'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
      'text-size': 12
    },
    paint: {
      'text-color': '#ffffff'
    }
  };

  const unclusteredPointLayer: any = {
    id: 'unclustered-point',
    type: 'circle',
    source: 'listings',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': '#11b4da',
      'circle-radius': 8,
      'circle-stroke-width': 1,
      'circle-stroke-color': '#fff'
    }
  };

  return (
    <div className="map-wrapper relative h-full">
      <div className="map-container relative h-[calc(100vh-120px)] md:h-[calc(100vh-100px)] w-full md:rounded-lg overflow-hidden md:border md:border-border">
        <Map
          {...viewState}
          onMove={evt => setViewState(evt.viewState)}
          mapboxAccessToken={MAPBOX_TOKEN}
          style={{width: '100%', height: '100%'}}
          mapStyle="mapbox://styles/mapbox/light-v11"
          attributionControl={false}
          onClick={handleMapClick}
          interactiveLayerIds={['clusters', 'unclustered-point']}
        >
          {geoJsonData && (
            <Source
              id="listings"
              type="geojson"
              data={geoJsonData}
              cluster={true}
              clusterMaxZoom={14}
              clusterRadius={50}
            >
              <Layer {...clusterLayer} />
              <Layer {...clusterCountLayer} />
              <Layer {...unclusteredPointLayer} />
            </Source>
          )}
        </Map>
      </div>
    </div>
  );
}