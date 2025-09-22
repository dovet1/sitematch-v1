'use client';

import { useState, useEffect, useRef } from 'react';
import { Map, Source, Layer } from 'react-map-gl/mapbox';
import { X, ExternalLink } from 'lucide-react';
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
  const [clusterPopup, setClusterPopup] = useState<{
    isOpen: boolean;
    listings: any[];
    position: { x: number; y: number };
  }>({ isOpen: false, listings: [], position: { x: 0, y: 0 } });
  const mapRef = useRef<any>(null);

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
  const handleMapClick = async (event: any) => {
    console.log('[DEBUG] Map click event:', event);
    const features = event.features;
    console.log('[DEBUG] Features:', features);

    if (!features || features.length === 0) return;

    const feature = features[0];
    console.log('[DEBUG] Feature clicked:', feature);

    if (feature.layer.id === 'clusters') {
      console.log('[DEBUG] Cluster clicked, properties:', feature.properties);
      const clusterId = feature.properties.cluster_id;
      const pointCount = feature.properties.point_count;
      const map = mapRef.current?.getMap();

      if (map && map.getSource('listings')) {
        try {
          console.log('[DEBUG] Getting cluster leaves for cluster:', clusterId, 'count:', pointCount);

          // Get all points in this cluster using the source directly
          const source = map.getSource('listings');

          const clusterLeaves = await new Promise((resolve) => {
            source.getClusterLeaves(
              clusterId,
              pointCount,
              0,
              (error: any, clusterFeatures: any) => {
                console.log('[DEBUG] Cluster leaves callback - error:', error, 'features:', clusterFeatures);
                if (error) {
                  console.error('Error getting cluster leaves:', error);
                  resolve([]);
                } else {
                  resolve(clusterFeatures || []);
                }
              }
            );
          });

          console.log('[DEBUG] Cluster leaves result:', clusterLeaves);

          // Extract listing data from cluster features with coordinates
          const listings = (clusterLeaves as any[]).map(leaf => ({
            ...leaf.properties,
            coordinates: leaf.geometry?.coordinates // [lng, lat] format
          }));
          console.log('[DEBUG] Extracted listings:', listings);

          // Calculate smart popup position that stays within viewport
          const mapContainer = document.querySelector('.map-container');
          const mapRect = mapContainer?.getBoundingClientRect();

          // Get header height to avoid overlap - try multiple selectors
          const headerSelectors = [
            '.UnifiedHeader',
            'header',
            '[data-testid="header"]',
            '.search-header',
            '.navbar',
            '.top-nav'
          ];

          let headerHeight = 120; // Conservative default for search bars
          for (const selector of headerSelectors) {
            const element = document.querySelector(selector);
            if (element) {
              headerHeight = Math.max(headerHeight, element.getBoundingClientRect().height + 20);
              console.log(`[DEBUG] Found header element with selector "${selector}":`, element.getBoundingClientRect().height);
              break;
            }
          }

          console.log(`[DEBUG] Using header height: ${headerHeight}px`);

          const popupWidth = 320; // w-80 = 320px
          const availableHeight = window.innerHeight - headerHeight - 40; // Account for header + margins
          const maxPopupHeight = Math.min(400, availableHeight); // Respect available space
          const popupHeight = Math.min(maxPopupHeight, listings.length * 60 + 80); // Dynamic height
          const margin = 20; // margin from screen edge

          // Start with click position relative to viewport
          let x = event.point.x + (mapRect?.left || 0);
          let y = event.point.y + (mapRect?.top || 0);

          // Horizontal positioning - prefer right of click, then left, then force fit
          if (x + popupWidth + margin > window.innerWidth) {
            // Try positioning to the left of click point
            x = x - popupWidth - 20;

            // If still off-screen, force it to fit within viewport
            if (x < margin) {
              x = window.innerWidth - popupWidth - margin;
            }
          }

          // Ensure minimum left margin
          if (x < margin) {
            x = margin;
          }

          // Vertical positioning - account for header and prefer below click
          const minY = headerHeight + margin; // Don't go above header
          const maxY = window.innerHeight - popupHeight - margin;

          if (y + popupHeight > window.innerHeight - margin) {
            // Try positioning above click point
            y = y - popupHeight - 20;
          }

          // Force within bounds accounting for header
          if (y < minY) {
            y = minY;
          }
          if (y > maxY) {
            y = maxY;
          }

          console.log('[DEBUG] Smart popup position:', {
            x, y,
            popupWidth, popupHeight,
            windowWidth: window.innerWidth,
            windowHeight: window.innerHeight,
            clickPoint: event.point,
            mapRect
          });

          setClusterPopup({
            isOpen: true,
            listings,
            position: { x, y }
          });
        } catch (error) {
          console.error('Error handling cluster click:', error);
          // Fallback to zoom
          setViewState(prev => ({
            ...prev,
            longitude: feature.geometry.coordinates[0],
            latitude: feature.geometry.coordinates[1],
            zoom: Math.min(prev.zoom + 2, 20)
          }));
        }
      } else {
        console.error('[DEBUG] Map or source not available');
      }
    } else if (feature.layer.id === 'unclustered-point') {
      console.log('[DEBUG] Individual point clicked:', feature.properties.id);
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
          ref={mapRef}
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

        {/* Cluster Popup */}
        {clusterPopup.isOpen && (
          <div
            className="fixed bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-w-sm w-80 flex flex-col"
            style={{
              left: clusterPopup.position.x,
              top: clusterPopup.position.y,
              maxHeight: `${Math.min(400, window.innerHeight - 140)}px` // Dynamic max height
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-orange-500 rounded flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded"></div>
                </div>
                <h3 className="font-semibold text-gray-900">
                  {(() => {
                    // Check if all listings have the same coordinates
                    if (clusterPopup.listings.length > 1) {
                      // Get coordinates from each listing to check if they're identical
                      const coordinates = clusterPopup.listings
                        .filter(listing => listing.coordinates && Array.isArray(listing.coordinates))
                        .map(listing => ({
                          lng: listing.coordinates[0], // GeoJSON format [lng, lat]
                          lat: listing.coordinates[1]
                        }));

                      if (coordinates.length > 0 && coordinates.length === clusterPopup.listings.length) {
                        // Check if all coordinates are the same (within a small tolerance)
                        const firstCoord = coordinates[0];
                        const tolerance = 0.0001; // Small tolerance for floating point comparison

                        const allSameLocation = coordinates.every(coord =>
                          Math.abs(coord.lat - firstCoord.lat) < tolerance &&
                          Math.abs(coord.lng - firstCoord.lng) < tolerance
                        );

                        if (allSameLocation) {
                          // Find the first place_name available and truncate it
                          const firstPlaceName = clusterPopup.listings.find(listing => listing.place_name)?.place_name;
                          if (firstPlaceName) {
                            // Take only the first two parts (e.g., "Whitstable, Kent" instead of "Whitstable, Kent, England, United Kingdom")
                            const parts = firstPlaceName.split(', ');
                            return parts.slice(0, 2).join(', ');
                          }
                        }
                      }
                    }

                    // Default to showing property count
                    return `${clusterPopup.listings.length} Properties`;
                  })()}
                </h3>
              </div>
              <button
                onClick={() => setClusterPopup({ isOpen: false, listings: [], position: { x: 0, y: 0 } })}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Listings */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {clusterPopup.listings.map((listing, index) => (
                <div
                  key={listing.id || index}
                  className="p-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => {
                    onListingClick(listing.id);
                    setClusterPopup({ isOpen: false, listings: [], position: { x: 0, y: 0 } });
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Logo placeholder */}
                    <div className="w-10 h-10 bg-gray-200 rounded flex-shrink-0 flex items-center justify-center">
                      <span className="text-xs font-medium text-gray-600">
                        {listing.company_name?.charAt(0) || '?'}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 text-sm">
                        {listing.company_name || 'Unknown Company'}
                      </h4>
                    </div>

                    {/* External link icon */}
                    <ExternalLink size={16} className="text-gray-400 flex-shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}