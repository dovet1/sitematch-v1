'use client';

import { useState, useEffect, useMemo } from 'react';
import Map, { Marker, Popup } from 'react-map-gl/mapbox';
import { MapPin, Building2, Users, Square } from 'lucide-react';
import { SearchFilters, SearchResult } from '@/types/search';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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

export function ListingMap({ filters, onListingClick }: ListingMapProps) {
  const [viewState, setViewState] = useState<MapViewState>(DEFAULT_VIEW_STATE);
  const [listings, setListings] = useState<SearchResult[]>([]);
  const [selectedListing, setSelectedListing] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter listings that have coordinates
  const mappableListings = useMemo(() => 
    listings.filter(listing => listing.coordinates?.lat && listing.coordinates?.lng),
    [listings]
  );

  // Fetch listings data
  useEffect(() => {
    const fetchListings = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const params = new URLSearchParams();
        if (filters.location) params.set('location', filters.location);
        if (filters.companyName) params.set('company', filters.companyName);
        if (filters.sector.length > 0) params.set('sectors', filters.sector.join(','));
        if (filters.useClass.length > 0) params.set('useClasses', filters.useClass.join(','));
        if (filters.sizeMin) params.set('sizeMin', filters.sizeMin.toString());
        if (filters.sizeMax) params.set('sizeMax', filters.sizeMax.toString());
        if (filters.isNationwide) params.set('nationwide', 'true');

        const response = await fetch(`/api/public/listings/map?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch map listings');
        }

        const data = await response.json();
        setListings(data.results || []);

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
            place_name: 'Manchester, UK',
            coordinates: { lat: 53.4808, lng: -2.2426 },
            created_at: new Date().toISOString()
          }
        ];
        setListings(mockListings);
      } finally {
        setIsLoading(false);
      }
    };

    fetchListings();
  }, [filters]);

  const handleMarkerClick = (listing: SearchResult) => {
    setSelectedListing(listing);
  };

  const handleListingClick = (listingId: string) => {
    setSelectedListing(null);
    onListingClick(listingId);
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
    return (
      <div className="map-container h-96 bg-muted rounded-lg flex items-center justify-center">
        <div className="text-center">
          <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">Map unavailable</p>
          <p className="text-sm text-muted-foreground mt-1">Mapbox token not configured</p>
        </div>
      </div>
    );
  }

  if (error && listings.length === 0) {
    return (
      <div className="map-container h-96 bg-muted rounded-lg flex items-center justify-center">
        <div className="text-center">
          <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">{error}</p>
          <p className="text-sm text-muted-foreground mt-1">Using sample data for demo</p>
        </div>
      </div>
    );
  }

  return (
    <div className="map-container relative h-96 w-full rounded-lg overflow-hidden border border-border">
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <div className="animate-spin w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full" />
            <span className="text-sm text-muted-foreground">Loading map...</span>
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
        {/* Listing Markers */}
        {mappableListings.map((listing) => (
          <Marker
            key={listing.id}
            longitude={listing.coordinates!.lng}
            latitude={listing.coordinates!.lat}
            anchor="bottom"
            onClick={() => handleMarkerClick(listing)}
          >
            <div 
              className="relative cursor-pointer group"
              style={{ transform: 'translate(-50%, -100%)' }}
            >
              {/* Map Pin */}
              <div className="relative">
                <div className="w-8 h-8 bg-primary-500 border-2 border-white rounded-full shadow-lg flex items-center justify-center transform transition-all duration-200 group-hover:scale-110">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
                {/* Pin stem */}
                <div className="absolute top-6 left-1/2 w-0.5 h-2 bg-primary-500 transform -translate-x-1/2" />
              </div>
              
              {/* Hover tooltip */}
              <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 bg-white border border-border rounded-lg shadow-lg p-2 min-w-48 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                <div className="text-sm font-medium">{listing.company_name}</div>
                <div className="text-xs text-muted-foreground">{listing.place_name}</div>
                <div className="text-xs text-muted-foreground">{formatSizeRange(listing.site_size_min, listing.site_size_max)}</div>
              </div>
            </div>
          </Marker>
        ))}

        {/* Listing Details Popup */}
        {selectedListing && selectedListing.coordinates && (
          <Popup
            longitude={selectedListing.coordinates.lng}
            latitude={selectedListing.coordinates.lat}
            anchor="top"
            onClose={() => setSelectedListing(null)}
            closeOnClick={false}
            className="[&_.mapboxgl-popup-content]:p-0 [&_.mapboxgl-popup-content]:rounded-lg [&_.mapboxgl-popup-content]:shadow-lg"
          >
            <div className="w-80 p-4">
              {/* Header */}
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-6 h-6 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm text-foreground truncate">
                    {selectedListing.company_name}
                  </h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {selectedListing.title}
                  </p>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2 mb-4">
                {selectedListing.place_name && (
                  <div className="flex items-center gap-2 text-xs">
                    <MapPin className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground">{selectedListing.place_name}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-2 text-xs">
                  <Square className="w-3 h-3 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {formatSizeRange(selectedListing.site_size_min, selectedListing.site_size_max)}
                  </span>
                </div>

                {selectedListing.contact_name && (
                  <div className="flex items-center gap-2 text-xs">
                    <Users className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {selectedListing.contact_name}
                      {selectedListing.contact_title && `, ${selectedListing.contact_title}`}
                    </span>
                  </div>
                )}
              </div>

              {/* Badges */}
              <div className="flex flex-wrap gap-1 mb-4">
                {selectedListing.sector && (
                  <Badge variant="secondary" className="text-xs">
                    {selectedListing.sector}
                  </Badge>
                )}
                {selectedListing.use_class && (
                  <Badge variant="outline" className="text-xs">
                    {selectedListing.use_class}
                  </Badge>
                )}
                {selectedListing.is_nationwide && (
                  <Badge className="text-xs bg-primary-500 text-primary-foreground">
                    Nationwide
                  </Badge>
                )}
              </div>

              {/* Action Button */}
              <Button 
                onClick={() => handleListingClick(selectedListing.id)}
                className="w-full h-8 text-xs"
                size="sm"
              >
                View Details
              </Button>
            </div>
          </Popup>
        )}
      </Map>

      {/* Map Stats */}
      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm border border-border rounded-lg px-3 py-2 text-sm">
        <span className="text-muted-foreground">
          {mappableListings.length} listing{mappableListings.length !== 1 ? 's' : ''} shown
        </span>
      </div>
    </div>
  );
}